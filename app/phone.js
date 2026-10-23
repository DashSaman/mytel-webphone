/* MyTel WebPhone v1.1.0 — original client on JsSIP 3.10.1 (MIT).
   Registration over secure WebSocket (wss://<pbx>:8089/ws).
   Credentials stored ONLY after first successful `registered` (localStorage;
   Secure/SameSite=Strict/path=/Phone cookie fallback only if LS unavailable).

   v1.1.0 hardening:
   - explicit UI state machine (idle/connecting/ready/in-call) — no stale badges
   - state-aware zombie recovery (dialog-level check, 8s guard kept only as
     last-resort fallback with a visible note)
   - idempotent media cleanup (per-session RTCPeerConnection registry)
   - mute verified per accepted session (session.isMuted)
   - hold/resume, call history (localStorage, last 20, clearable),
     microphone device selection, version display
   - single-call policy; second caller auto-declined 486 Busy */

(function () {
  "use strict";

  var APP_VERSION = "v1.1.0";

  /* ---------- config ---------- */
  var WSS_URL = "wss://" + location.hostname + ":8089/ws";
  var SIP_DOMAIN = location.hostname;
  var LS_KEY = "mytel-phone.auth";
  var LS_HIST = "mytel-phone.history";
  var CK_NAME = "mytel-phone-auth";
  var PC_CONFIG = {
    /* public STUN only for candidate discovery (Chrome mDNS obfuscation):
       media still flows peer-to-peer over the LAN */
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  };

  /* ---------- tiny helpers ---------- */
  var $ = function (id) { return document.getElementById(id); };
  function show(el, on) { el.classList.toggle("hidden", !on); }
  function setBadge(state, text) {
    $("regBadge").className = "mt-badge " + state;
    $("regText").textContent = text;
  }
  function logErr(tag, e) { try { console.warn("[mytel-phone]", tag, e && e.message ? e.message : e); } catch (x) {} }

  /* ---------- credential storage (scoped — only our own keys) ---------- */
  var store = {
    lsWorks: (function () {
      try { localStorage.setItem("__mt", "1"); localStorage.removeItem("__mt"); return true; }
      catch (e) { return false; }
    })(),
    save: function (ext, secret) {
      var v = ext + " " + secret;
      if (this.lsWorks) { localStorage.setItem(LS_KEY, v); return; }
      document.cookie = CK_NAME + "=" + encodeURIComponent(v) +
        "; path=/Phone; SameSite=Strict; Secure; max-age=31536000";
    },
    load: function () {
      if (this.lsWorks) {
        var v = localStorage.getItem(LS_KEY);
        if (v) return this._parse(v);
      }
      var m = document.cookie.match(new RegExp("(?:^|;\\s*)" + CK_NAME + "=([^;]*)"));
      if (m) return this._parse(decodeURIComponent(m[1]));
      return null;
    },
    clear: function () {
      /* removes ONLY this app's key/cookie */
      if (this.lsWorks) localStorage.removeItem(LS_KEY);
      document.cookie = CK_NAME + "=; path=/Phone; SameSite=Strict; Secure; max-age=0";
    },
    _parse: function (v) {
      var i = v.indexOf(" ");
      if (i < 2) return null;
      var ext = v.slice(0, i), secret = v.slice(i + 1);
      if (!/^[0-9]{2,6}$/.test(ext) || !secret) return null;
      return { ext: ext, secret: secret };
    }
  };

  /* ---------- call history (no credentials; last 20) ---------- */
  var history = {
    add: function (dir, peer, outcome) {
      try {
        var list = JSON.parse(localStorage.getItem(LS_HIST) || "[]");
        list.unshift({ d: Date.now(), dir: dir, peer: String(peer).slice(0, 32), o: outcome });
        if (list.length > 20) list.length = 20;
        localStorage.setItem(LS_HIST, JSON.stringify(list));
      } catch (e) {}
    },
    all: function () {
      try { return JSON.parse(localStorage.getItem(LS_HIST) || "[]"); }
      catch (e) { return []; }
    },
    clear: function () { try { localStorage.removeItem(LS_HIST); } catch (e) {} }
  };

  /* ---------- state ---------- */
  var ua = null, session = null, ringSession = null;
  var localStream = null;
  var timerIv = null, t0 = 0;
  var epoch = 0;                 /* invalidates stale async work after logout */
  var connecting = false;
  var pcRegistry = [];           /* live RTCPeerConnections for idempotent cleanup */
  var micWanted = "";            /* selected input device id */
  function stale(myEpoch) { return myEpoch !== epoch; }

  /* ---------- UI state machine ---------- */
  var UI = {
    set: function (state) {
      /* idle | connecting | ready | call */
      this.state = state;
      switch (state) {
        case "idle":
          show(loginCard, true); show(phoneUI, false);
          setBadge("off", "Offline");
          break;
        case "connecting":
          setBadge("trying", "Connecting…");
          break;
        case "ready":
          show(loginCard, false); show(phoneUI, true);
          break;
        case "call":
          show(loginCard, false); show(phoneUI, true);
          break;
      }
    },
    state: "idle"
  };

  /* ---------- UI wiring ---------- */
  var loginForm = $("loginForm"), loginCard = $("loginCard"), phoneUI = $("phoneUI");
  var dialInput = $("dialInput"), callPanel = $("callPanel");

  $("verInfo").textContent = APP_VERSION;
  $("certLink").href = "https://" + location.hostname + ":8089/ws";

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var ext = $("inExt").value.trim();
    var secret = $("inSecret").value;
    var errEl = $("loginErr");
    show(errEl, false);
    if (!/^[0-9]{2,6}$/.test(ext)) { errEl.textContent = "Extension must be 2-6 digits."; show(errEl, true); return; }
    if (secret.length < 4) { errEl.textContent = "Secret is too short."; show(errEl, true); return; }
    connect(ext, secret, { persist: true });
  });

  $("btnLogout").addEventListener("click", function () {
    epoch++;
    store.clear();
    stopMic();
    teardown();
    /* release pending sign-in lock (stale mic callbacks skip done()) */
    connecting = false;
    var cb = $("btnConnect");
    if (cb) { cb.disabled = false; cb.textContent = "Connect"; }
    $("inSecret").value = "";
    renderHistory();
    UI.set("idle");
  });

  $("dialPad").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-d]");
    if (!b) return;
    sendDTMFChar(b.dataset.d);
  });
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (/^[0-9*#]$/.test(e.key)) sendDTMFChar(e.key);
  });
  function sendDTMFChar(c) {
    if (session && session.isEstablished() && !holdState().local) {
      try { session.sendDTMF(c); } catch (e) { logErr("dtmf", e); }
    }
    dialInput.value += c;
  }

  $("btnCall").addEventListener("click", function () { startCall(dialInput.value.trim()); });
  dialInput.addEventListener("keydown", function (e) { if (e.key === "Enter") startCall(dialInput.value.trim()); });

  $("btnHang").addEventListener("click", function () {
    var s = session || ringSession;
    if (s) { try { s.terminate(); } catch (e) { logErr("hang", e); } }
  });

  /* mute the live session (shared track stays ours) */
  $("btnMute").addEventListener("click", function () {
    if (!session || !session.isEstablished()) return;
    var btn = $("btnMute");
    try {
      if (session.isMuted().audio) {
        session.unmute({ audio: true });
        btn.classList.remove("active");
        btn.textContent = "Mute";
      } else {
        session.mute({ audio: true });
        btn.classList.add("active");
        btn.textContent = "Unmute";
      }
    } catch (e) { logErr("mute", e); }
  });

  /* hold / resume — JsSIP isOnHold() returns {local, remote}, not boolean */
  function holdState() {
    try {
      var h = session && session.isOnHold ? session.isOnHold() : null;
      if (h && typeof h === "object") return h;
      return { local: !!h, remote: false };
    } catch (e) { return { local: false, remote: false }; }
  }

  $("btnHold").addEventListener("click", function () {
    if (!session || !session.isEstablished()) return;
    var btn = $("btnHold");
    try {
      if (holdState().local) {
        session.unhold({ useUpdate: true }, function (err) {
          if (err) { logErr("unhold", err); return; }
          btn.classList.remove("active");
          btn.textContent = "Hold";
          $("callState").textContent = "Connected";
        });
      } else {
        session.hold({ useUpdate: true }, function (err) {
          if (err) { logErr("hold", err); return; }
          btn.classList.add("active");
          btn.textContent = "Resume";
          $("callState").textContent = "On hold";
        });
      }
    } catch (e) { logErr("hold", e); }
  });

  $("btnAccept").addEventListener("click", function () {
    /* capture THIS session and epoch — a pending mic callback must never
       answer a different caller that arrived while getUserMedia resolved */
    var s = ringSession;
    var myEpoch = epoch;
    if (!s || s.isEnded()) return;
    stopRing();
    ensureMedia(function (err) {
      /* verify the SAME session is still the ringing one AND epoch is valid */
      if (stale(myEpoch) || ringSession !== s || s.isEnded()) {
        return;
      }
      if (err) {
        $("callState").textContent = "Microphone blocked";
        try { s.terminate(); } catch (e) {}
        return;
      }
      var answerOpts = {
        mediaConstraints: { audio: true, video: false },
        pcConfig: PC_CONFIG,
        mediaStream: localStream
      };
      try { s.answer(answerOpts); }
      catch (e) { logErr("answer", e); }
    });
  });
  $("btnReject").addEventListener("click", function () {
    if (!ringSession) return;
    stopRing();
    history.add("in", peerOf(ringSession), "rejected");
    try { ringSession.terminate(); } catch (e) { logErr("reject", e); }
  });

  /* history UI */
  $("btnHistory").addEventListener("click", function () {
    var p = $("histPanel");
    var open = p.classList.toggle("hidden") === false;
    show($("btnClearHist"), open);
    if (open) renderHistory();
  });
  $("btnClearHist").addEventListener("click", function () {
    history.clear();
    renderHistory();
  });
  function renderHistory() {
    var list = history.all();
    var ul = $("histList");
    ul.textContent = "";
    $("histCount").textContent = list.length ? "(" + list.length + ")" : "";
    list.forEach(function (h) {
      var li = document.createElement("li");
      var t = new Date(h.d);
      var ts = ("0" + t.getHours()).slice(-2) + ":" + ("0" + t.getMinutes()).slice(-2) + " " +
               ("0" + t.getDate()).slice(-2) + "/" + ("0" + (t.getMonth() + 1)).slice(-2);
      var b = document.createElement("b");
      b.textContent = (h.dir === "in" ? "↙ " : "↗ ") + h.peer;
      var s = document.createElement("span");
      s.textContent = ts + " · " + h.o;
      li.appendChild(b); li.appendChild(s);
      ul.appendChild(li);
    });
  }

  /* microphone device selection — deferred during an active call */
  var micSelect = $("micSelect");
  var pendingMicChange = null;
  micSelect.addEventListener("change", function () {
    micWanted = micSelect.value;
    if (busy()) {
      /* do NOT stop the live track mid-call; queue the switch */
      pendingMicChange = micWanted;
      $("callState").textContent = "Mic change pending until call ends";
      return;
    }
    stopMic();
    refreshMicList();
  });
  function applyPendingMicChange() {
    if (pendingMicChange !== null) {
      micWanted = pendingMicChange;
      pendingMicChange = null;
      stopMic();
      refreshMicList();
    }
  }
  function refreshMicList() {
    if (!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices)) return;
    navigator.mediaDevices.enumerateDevices().then(function (devices) {
      var cur = micSelect.value;
      micSelect.textContent = "";
      var def = document.createElement("option");
      def.value = ""; def.textContent = "Default";
      micSelect.appendChild(def);
      devices.forEach(function (d) {
        if (d.kind !== "audioinput") return;
        var o = document.createElement("option");
        o.value = d.deviceId;
        o.textContent = d.label ? d.label.slice(0, 28) : "Microphone";
        micSelect.appendChild(o);
      });
      if (cur) micSelect.value = cur;
    }).catch(function () {});
  }
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", refreshMicList);
  }

  function peerOf(s) {
    try {
      if (s.remote_identity && s.remote_identity.uri) return s.remote_identity.uri.user;
      if (s.remote_identity && s.remote_identity.display_name) return s.remote_identity.display_name;
    } catch (e) {}
    return "Unknown";
  }

  /* ---------- audio plumbing ---------- */
  var remoteAudio = $("remoteAudio");

  /* synthesized classic ring cadence */
  var ringCtx = null, ringNodes = null, ringIv = null;
  function startRing() {
    stopRing();
    try {
      ringCtx = ringCtx || new (window.AudioContext || window.webkitAudioContext)();
      var beep = function () {
        var t = ringCtx.currentTime;
        var g = ringCtx.createGain();
        g.connect(ringCtx.destination);
        var o1 = ringCtx.createOscillator(), o2 = ringCtx.createOscillator();
        o1.frequency.value = 440; o2.frequency.value = 480;
        o1.connect(g); o2.connect(g);
        g.gain.setValueAtTime(0.12, t);
        g.gain.setValueAtTime(0.12, t + 1.6);
        g.gain.setValueAtTime(0.0, t + 2.0);
        o1.start(t); o2.start(t);
        o1.stop(t + 2.0); o2.stop(t + 2.0);
        ringNodes = [o1, o2, g];
      };
      beep();
      ringIv = setInterval(beep, 4000);
    } catch (e) { logErr("ring", e); }
  }
  function stopRing() {
    if (ringIv) { clearInterval(ringIv); ringIv = null; }
    if (ringNodes) { ringNodes.forEach(function (n) { try { n.stop && n.stop(); n.disconnect && n.disconnect(); } catch (e) {} }); ringNodes = null; }
  }

  function ensureMedia(cb) {
    var myEpoch = epoch;
    /* serialize concurrent acquisitions — never stop a live call's track */
    if (mediaPending) {
      mediaQueue.push({ cb: cb, epoch: myEpoch });
      return;
    }
    if (localStream && localStream.getAudioTracks().length) {
      cb(null); return;
    }
    mediaPending = true;
    var opts = { audio: true, video: false };
    if (micWanted) opts.audio = { deviceId: { exact: micWanted } };
    navigator.mediaDevices.getUserMedia(opts)
      .then(function (stream) {
        mediaPending = false;
        if (stale(myEpoch)) {
          stream.getTracks().forEach(function (t) { t.stop(); });
          drainQueue(); return;
        }
        /* only replace a stream that is NOT attached to an active call */
        if (localStream && localStream !== stream && !busy()) {
          localStream.getTracks().forEach(function (t) { t.stop(); });
        }
        localStream = stream;
        refreshMicList();
        cb(null);
        drainQueue();
      })
      .catch(function (err) {
        mediaPending = false;
        drainQueue();
        if (!stale(myEpoch)) cb(err);
      });
  }
  var mediaPending = false, mediaQueue = [];
  function drainQueue() {
    var q = mediaQueue; mediaQueue = [];
    q.forEach(function (entry) {
      /* epoch-guard: queued requests from a pre-logout session are void */
      if (stale(entry.epoch)) return;
      if (localStream && localStream.getAudioTracks().length) entry.cb(null);
      else ensureMedia(entry.cb);
    });
  }

  function stopMic() {
    if (localStream) {
      localStream.getTracks().forEach(function (t) { t.stop(); });
      localStream = null;
    }
  }

  function attachRemote(s) {
    try {
      var stream = new MediaStream();
      var receiver = s.connection && s.connection.getReceivers()[0];
      if (receiver && receiver.track) stream.addTrack(receiver.track);
      remoteAudio.srcObject = stream;
      remoteAudio.play().catch(function () {});
    } catch (e) { logErr("attach", e); }
  }

  /* idempotent PC cleanup */
  function trackPC(pc) { if (pc && pcRegistry.indexOf(pc) === -1) pcRegistry.push(pc); }
  function closePCs() {
    pcRegistry.forEach(function (pc) {
      try { if (pc.connectionState !== "closed") pc.close(); } catch (e) {}
    });
    pcRegistry = [];
  }

  /* ---------- connection ---------- */
  function connect(ext, secret, opts) {
    opts = opts || {};
    if (connecting) return;
    connecting = true;
    var connectBtn = $("btnConnect");
    if (connectBtn) { connectBtn.disabled = true; connectBtn.textContent = "Connecting…"; }
    var done = function () {
      connecting = false;
      if (connectBtn) { connectBtn.disabled = false; connectBtn.textContent = "Connect"; }
    };
    epoch++;
    var myEpoch = epoch;
    UI.set("connecting");
    show($("certHelp"), false);
    ensureMedia(function (micErr) {
      if (stale(myEpoch)) { done(); return; }
      if (micErr) {
        setBadge("off", "Microphone blocked");
        var errEl = $("loginErr");
        errEl.textContent = "Microphone access is required for calls. Allow the microphone for this site and try again.";
        show(errEl, true);
        UI.set("idle");
        done();
        return;
      }
      teardown();
      try {
        var socket = new JsSIP.WebSocketInterface(WSS_URL);
        ua = new JsSIP.UA({
          sockets: [socket],
          uri: "sip:" + ext + "@" + SIP_DOMAIN,
          password: secret,
          register: true,
          register_expires: 300,
          connection_recovery_min_interval: 5,   /* bounded backoff (JsSIP) */
          connection_recovery_max_interval: 120
        });
        ua.on("registered", function () {
          if (stale(myEpoch)) return;
          setBadge("on", ext + " online");
          UI.set("ready");
          $("uaInfo").textContent = ext + " · " + WSS_URL.replace("wss://", "");
          if (opts.persist) store.save(ext, secret);   /* save ONLY after success */
        });
        ua.on("unregistered", function () {
          if (!stale(myEpoch)) setBadge("off", "Unregistered");
        });
        ua.on("registrationFailed", function (e) {
          if (stale(myEpoch)) return;
          setBadge("off", "Registration failed");
          var errEl = $("loginErr");
          var why = (e && e.cause) || "";
          if (/WebSocket|socket|ws/i.test(why)) {
            show($("certHelp"), true);
            errEl.textContent = "Could not open the secure WebSocket.";
          } else {
            errEl.textContent = "Registration rejected — check the extension number and secret.";
          }
          show(errEl, true);
          UI.set("idle");
        });
        ua.on("disconnected", function (e) {
          if (stale(myEpoch)) return;
          setBadge("trying", "Reconnecting…");
          var code = e && e.code;
          if ((e && e.error) || code === 1006 || code === 1015) {
            show($("certHelp"), true);
            revealRecovery();
          }
        });
        ua.on("connected", function () {
          if (!stale(myEpoch) && UI.state === "connecting") setBadge("trying", "Signing in…");
        });
        ua.on("newRTCSession", onNewSession);
        ua.start();
        done();
      } catch (e) {
        if (stale(myEpoch)) return;
        logErr("connect", e);
        setBadge("off", "Error");
        show($("certHelp"), true);
        UI.set("idle");
        done();
      }
    });
  }

  /* cert help must be reachable during auto sign-in */
  function revealRecovery() {
    if (phoneUI.classList.contains("hidden")) show(loginCard, true);
  }

  function teardown() {
    stopRing();
    if (timerIv) { clearInterval(timerIv); timerIv = null; }
    if (session) { try { session.terminate(); } catch (e) {} session = null; }
    ringSession = null;
    if (ua) {
      try { ua.stop(); } catch (e) {}
      ua = null;
    }
    closePCs();
  }

  /* ---------- sessions (single-call policy) ---------- */
  function busy() {
    return (session && !session.isEnded()) || (ringSession && !ringSession.isEnded());
  }

  function onNewSession(e) {
    var s = e.session;

    if (e.originator === "remote") {
      if (busy()) {
        try { s.terminate({ status_code: 486, reason_phrase: "Busy Here" }); } catch (x) {}
        return;
      }
      ringSession = s;
      var peer = peerOf(s);
      $("incPeer").textContent = peer;
      show($("incomingBar"), true);
      show(callPanel, true);
      $("callState").textContent = "Ringing…";
      startRing();
      bindSession(s, true);
      return;
    }

    if (busy()) {
      try { s.terminate(); } catch (x) {}
      $("callState").textContent = "Another call is in progress";
      return;
    }
    session = s;
    show(callPanel, true);
    $("callDir").textContent = "OUT";
    $("callPeer").textContent = dialInput.value.trim();
    $("callState").textContent = "Calling…";
    resetMuteButton();
    resetHoldButton();
    startTimerDisplay(true);
    bindSession(s, false);
  }

  /* state-aware zombie detection with BOUNDED recovery:
     - CANCELED/TERMINATED → dead
     - CONFIRMED with dialog → alive
     - WAITING_FOR_ACK/ANSWERED: alive only within a hard 32s deadline
       (exceeds JsSIP's own ACK timers); after that → dead (fallback fires) */
  var JSIP = { STATUS_NULL: 0, STATUS_INVITE_SENT: 1, STATUS_1XX_RECEIVED: 2,
               STATUS_INVITE_RECEIVED: 3, STATUS_WAITING_FOR_ANSWER: 4,
               STATUS_ANSWERED: 5, STATUS_WAITING_FOR_ACK: 6,
               STATUS_CANCELED: 7, STATUS_TERMINATED: 8,
               STATUS_CONFIRMED: 9 };
  var ACK_DEADLINE_MS = 32000;   /* hard cap on unconfirmed accepted state */
  function dialogAlive(s) {
    try {
      if (s.isEnded()) return false;
      if (s.status === JSIP.STATUS_CANCELED || s.status === JSIP.STATUS_TERMINATED) return false;
      if (s.status === JSIP.STATUS_CONFIRMED) {
        return !!s._dialog;   /* confirmed but dialog gone → dead */
      }
      if (s.status === JSIP.STATUS_WAITING_FOR_ACK || s.status === JSIP.STATUS_ANSWERED) {
        /* hard deadline: if accepted more than 32s ago without confirmation,
           JsSIP is stalled — force recovery */
        if (s.__acceptedAt && (Date.now() - s.__acceptedAt) > ACK_DEADLINE_MS) {
          return false;
        }
        return true;
      }
      return true;
    } catch (x) { return true; }
  }

  function bindSession(s, incoming) {
    var peer = incoming ? peerOf(s) : dialInput.value.trim();

    if (s.connection) trackPC(s.connection);

    s.on("accepted", function () {
      stopRing();
      session = s; ringSession = null;
      if (!s.__acceptedAt) s.__acceptedAt = Date.now();   /* zombie deadline anchor */
      show($("incomingBar"), false);
      $("callDir").textContent = incoming ? "IN" : "OUT";
      $("callPeer").textContent = peer;
      $("callState").textContent = "Connected";
      resetMuteButton();
      resetHoldButton();
      startTimerDisplay();
      attachRemote(s);
      if (s.connection) trackPC(s.connection);
      /* zombie guard: LAST-RESORT fallback only. Dialog-aware check first. */
      if (s.__guard) clearTimeout(s.__guard);
      s.__guard = setTimeout(function () {
        if (!s.isEnded() && !dialogAlive(s)) {
          try { s.terminate(); } catch (e) {}
          clearCallUI(s);
          $("callState").textContent = "Call dropped (no confirmation)";
        } else if (!s.isEnded()) {
          /* dialog still alive — re-check every 4s instead of killing */
          var recheck = setInterval(function () {
            if (s.isEnded()) { clearInterval(recheck); return; }
            if (!dialogAlive(s)) {
              clearInterval(recheck);
              try { s.terminate(); } catch (e) {}
              clearCallUI(s);
              $("callState").textContent = "Call dropped (no confirmation)";
            }
          }, 4000);
          s.__recheck = recheck;
        }
      }, 8000);
    });
    s.on("confirmed", function () {
      if (s.__guard) { clearTimeout(s.__guard); s.__guard = null; }
      if (s.__recheck) { clearInterval(s.__recheck); s.__recheck = null; }
      attachRemote(s);
      if (s.connection) trackPC(s.connection);
    });
    s.on("hold", function () { $("callState").textContent = "On hold"; });
    s.on("unhold", function () { $("callState").textContent = "Connected"; });
    s.on("failed", function (e) {
      if (s.__guard) { clearTimeout(s.__guard); s.__guard = null; }
      if (s.__recheck) { clearInterval(s.__recheck); s.__recheck = null; }
      stopRing();
      var cause = (e && e.cause) || "";
      history.add(incoming ? "in" : "out", peer, cause === "Canceled" ? "canceled" : "failed");
      clearCallUI(s);
    });
    s.on("ended", function () {
      if (s.__guard) { clearTimeout(s.__guard); s.__guard = null; }
      if (s.__recheck) { clearInterval(s.__recheck); s.__recheck = null; }
      stopRing();
      history.add(incoming ? "in" : "out", peer, "ended");
      clearCallUI(s);
      /* release this session's PC */
      try { if (s.connection && s.connection.connectionState !== "closed") s.connection.close(); } catch (e) {}
      /* apply queued mic device change now that the call is over */
      applyPendingMicChange();
    });
  }

  function clearCallUI(s) {
    if (session === s || ringSession === s) {
      show(callPanel, false);
      show($("incomingBar"), false);
      if (timerIv) { clearInterval(timerIv); timerIv = null; }
    }
    if (session === s) session = null;
    if (ringSession === s) ringSession = null;
  }

  function resetMuteButton() {
    var btn = $("btnMute");
    btn.classList.remove("active");
    btn.textContent = "Mute";
    /* shared track re-enable + session truth check */
    if (localStream) {
      localStream.getAudioTracks().forEach(function (t) { t.enabled = true; });
    }
  }
  function resetHoldButton() {
    var btn = $("btnHold");
    btn.classList.remove("active");
    btn.textContent = "Hold";
  }

  function startTimerDisplay(pending) {
    if (timerIv) clearInterval(timerIv);
    t0 = Date.now();
    $("callTimer").textContent = pending ? "--:--" : "00:00";
    if (pending) return;
    timerIv = setInterval(function () {
      var s = Math.floor((Date.now() - t0) / 1000);
      $("callTimer").textContent =
        ("0" + Math.floor(s / 60)).slice(-2) + ":" + ("0" + (s % 60)).slice(-2);
    }, 1000);
  }

  function startCall(dest) {
    if (!dest) { dialInput.focus(); return; }
    if (busy()) { $("callState").textContent = "Another call is in progress"; show(callPanel, true); return; }
    if (!ua || !ua.isConnected()) { setBadge("trying", "Reconnecting…"); return; }
    var myEpoch = epoch;
    ensureMedia(function (err) {
      if (stale(myEpoch)) return;   /* signed out while acquiring mic */
      if (err) { $("callState").textContent = "Microphone blocked"; show(callPanel, true); return; }
      if (!ua || !ua.isConnected()) { setBadge("trying", "Reconnecting…"); return; }
      ua.call("sip:" + dest + "@" + SIP_DOMAIN, {
        mediaConstraints: { audio: true, video: false },
        mediaStream: localStream,
        pcConfig: PC_CONFIG
      });
    });
  }

  /* ---------- boot ---------- */
  var saved = store.load();
  renderHistory();
  refreshMicList();
  if (saved) {
    $("inExt").value = saved.ext;
    connect(saved.ext, saved.secret, { persist: false });
  } else {
    UI.set("idle");
  }

  window.addEventListener("beforeunload", function () {
    stopRing();
  });

  /* expose version for support */
  window.MYTEL_WEBPHONE = { version: APP_VERSION };
})();
