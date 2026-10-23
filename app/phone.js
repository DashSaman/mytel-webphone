/* MyTel WebPhone — original client built on JsSIP 3.10.1 (MIT).
   Registration over secure WebSocket (wss://<pbx>:8089/ws).
   Credentials are stored ONLY after the first successful `registered`
   event; localStorage is primary, cookie is a fallback when localStorage
   is unavailable. Logout invalidates pending async work, stops the
   microphone, clears both stores and unregisters this browser only.
   Single-call policy: a second call while one is active is refused. */

(function () {
  "use strict";

  /* ---------- config ---------- */
  var WSS_URL = "wss://" + location.hostname + ":8089/ws";
  var SIP_DOMAIN = location.hostname;
  var LS_KEY = "mytel-phone.auth";
  var CK_NAME = "mytel-phone-auth";

  /* ---------- tiny helpers ---------- */
  var $ = function (id) { return document.getElementById(id); };
  function show(el, on) { el.classList.toggle("hidden", !on); }
  function setBadge(state, text) {
    var b = $("regBadge");
    b.className = "mt-badge " + state;
    $("regText").textContent = text;
  }
  function logErr(tag, e) { try { console.warn("[mytel-phone]", tag, e && e.message ? e.message : e); } catch (x) {} }

  /* ---------- credential storage ---------- */
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

  /* ---------- state ---------- */
  var ua = null, session = null, ringSession = null;
  var localStream = null;
  var timerIv = null, t0 = 0;
  /* epoch invalidates stale async work (mic callbacks, UA events) after logout */
  var epoch = 0;
  function stale(myEpoch) { return myEpoch !== epoch; }

  /* ---------- UI wiring ---------- */
  var loginForm = $("loginForm"), loginCard = $("loginCard"), phoneUI = $("phoneUI");
  var dialInput = $("dialInput"), callPanel = $("callPanel");

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
    epoch++;                       /* invalidate every pending callback */
    store.clear();
    stopMic();
    teardown();
    /* R3-2 fix: sign-out during the mic prompt must release the pending
       sign-in lock (done() is skipped by the stale check otherwise). */
    connecting = false;
    var cb = $("btnConnect");
    if (cb) { cb.disabled = false; cb.textContent = "Connect"; }
    show(loginCard, true); show(phoneUI, false);
    $("inSecret").value = "";
    setBadge("off", "Offline");
  });

  $("dialPad").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-d]");
    if (!b) return;
    sendDTMFChar(b.dataset.d);
  });
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT") return;
    if (/^[0-9*#]$/.test(e.key)) sendDTMFChar(e.key);
  });
  function sendDTMFChar(c) {
    if (session && session.isEstablished()) { try { session.sendDTMF(c); } catch (e) { logErr("dtmf", e); } }
    dialInput.value += c;
  }

  $("btnCall").addEventListener("click", function () { startCall(dialInput.value.trim()); });
  dialInput.addEventListener("keydown", function (e) { if (e.key === "Enter") startCall(dialInput.value.trim()); });

  $("btnHang").addEventListener("click", function () {
    if (session) { try { session.terminate(); } catch (e) { logErr("hang", e); } }
  });

  /* P1 fix: mute the live session, not a detached preflight stream */
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

  $("btnAccept").addEventListener("click", function () {
    if (!ringSession) return;
    stopRing();
    /* R3-1 fix: reuse the preflight stream so JsSIP never acquires (and can
       never leak) a separate capture; stopMic() then releases everything. */
    var answerOpts = {
      mediaConstraints: { audio: true, video: false },
      pcConfig: PC_CONFIG
    };
    if (localStream && localStream.getAudioTracks().length) {
      answerOpts.mediaStream = localStream;
    }
    try { ringSession.answer(answerOpts); }
    catch (e) { logErr("answer", e); }
  });
  $("btnReject").addEventListener("click", function () {
    if (!ringSession) return;
    stopRing();
    try { ringSession.terminate(); } catch (e) { logErr("reject", e); }
  });

  /* R3-3 fix: during auto sign-in (no UI yet), surface the login card so the
     certificate-recovery help inside it is actually reachable. */
  function revealRecovery() {
    if (phoneUI.classList.contains("hidden")) show(loginCard, true);
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
    if (localStream && localStream.getAudioTracks().length) { cb(null); return; }
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(function (stream) {
        if (stale(myEpoch)) {            /* superseded or logged out meanwhile */
          stream.getTracks().forEach(function (t) { t.stop(); });
          return;
        }
        if (localStream && localStream !== stream) {
          /* never leak a previous capture when replacing it */
          localStream.getTracks().forEach(function (t) { t.stop(); });
        }
        localStream = stream; cb(null);
      })
      .catch(function (err) { if (!stale(myEpoch)) cb(err); });
  }

  /* P2 fix: release the preflight microphone capture */
  function stopMic() {
    if (localStream) {
      localStream.getTracks().forEach(function (t) { t.stop(); });
      localStream = null;
    }
  }

  function attachRemote(s) {
    try {
      var stream = new MediaStream();
      var receiver = s.connection.getReceivers()[0];
      if (receiver && receiver.track) stream.addTrack(receiver.track);
      remoteAudio.srcObject = stream;
      remoteAudio.play().catch(function () {});
    } catch (e) { logErr("attach", e); }
  }

  /* ---------- connection ---------- */
  var connecting = false;
  function connect(ext, secret, opts) {
    opts = opts || {};
    if (connecting) return;               /* serialize sign-in attempts */
    connecting = true;
    var connectBtn = $("btnConnect");
    if (connectBtn) { connectBtn.disabled = true; connectBtn.textContent = "Connecting…"; }
    var done = function () {
      connecting = false;
      if (connectBtn) { connectBtn.disabled = false; connectBtn.textContent = "Connect"; }
    };
    epoch++;                              /* invalidate any earlier attempt */
    var myEpoch = epoch;
    setBadge("trying", "Connecting…");
    show($("certHelp"), false);
    ensureMedia(function (micErr) {
      if (stale(myEpoch)) { done(); return; }
      if (micErr) {
        setBadge("off", "Microphone blocked");
        var errEl = $("loginErr");
        errEl.textContent = "Microphone access is required for calls. Allow the microphone for this site and try again.";
        show(errEl, true);
        show(loginCard, true); show(phoneUI, false);
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
          connection_recovery_min_interval: 5,
          connection_recovery_max_interval: 120
        });
        ua.on("registered", function () {
          if (stale(myEpoch)) return;
          setBadge("on", ext + " online");
          show(loginCard, false); show(phoneUI, true);
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
          show(loginCard, true); show(phoneUI, false);
        });
        ua.on("disconnected", function (e) {
          if (stale(myEpoch)) return;
          setBadge("trying", "Reconnecting…");
          /* JsSIP gives {error:boolean, code, reason}; 1006/1015 = TLS/WS failure */
          var code = e && e.code;
          if ((e && e.error) || code === 1006 || code === 1015) {
            show($("certHelp"), true);
            revealRecovery();          /* help must be visible during auto sign-in */
          }
        });
        ua.on("newRTCSession", onNewSession);
        ua.start();
        done();
      } catch (e) {
        if (stale(myEpoch)) return;
        logErr("connect", e);
        setBadge("off", "Error");
        show($("certHelp"), true);
        done();
      }
    });
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
  }

  /* ---------- sessions (single-call policy, P1 fix) ---------- */
  function busy() {
    return (session && !session.isEnded()) || (ringSession && !ringSession.isEnded());
  }

  function onNewSession(e) {
    var s = e.session;

    if (e.originator === "remote") {
      if (busy()) {
        /* in a call already → decline with Busy Here */
        try { s.terminate({ status_code: 486, reason_phrase: "Busy Here" }); } catch (x) {}
        return;
      }
      ringSession = s;
      var peer = (s.remote_identity && s.remote_identity.uri) ? s.remote_identity.uri.user : "Unknown";
      $("incPeer").textContent = peer;
      show($("incomingBar"), true);
      show(callPanel, true);
      $("callState").textContent = "Ringing…";
      startRing();
      bindSession(s, true);
      return;
    }

    /* outgoing */
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
    startTimerDisplay(true);
    bindSession(s, false);
  }

  function bindSession(s, incoming) {
    s.on("accepted", function () {
      stopRing();
      session = s; ringSession = null;
      show($("incomingBar"), false);
      $("callDir").textContent = incoming ? "IN" : "OUT";
      $("callState").textContent = "Connected";
      resetMuteButton();               /* each new session starts unmuted */
      startTimerDisplay();
      attachRemote(s);
      /* zombie guard: if this answered session is never confirmed (e.g. a
         200-OK vs CANCEL race leaves it hanging), force-clear it so later
         calls are not swallowed by the single-call policy. */
      if (s.__guard) clearTimeout(s.__guard);
      s.__guard = setTimeout(function () {
        if (!s.isEnded()) { try { s.terminate(); } catch (e) {} }
        if (session === s) session = null;
        if (ringSession === s) ringSession = null;
        show(callPanel, false);
        show($("incomingBar"), false);
        if (timerIv) { clearInterval(timerIv); timerIv = null; }
        $("callState").textContent = "";
      }, 8000);
    });
    s.on("confirmed", function () {
      if (s.__guard) { clearTimeout(s.__guard); s.__guard = null; }
      attachRemote(s);
    });
    s.on("failed", function () {
      if (s.__guard) { clearTimeout(s.__guard); s.__guard = null; }
      stopRing();
      if (session === s || ringSession === s) {
        show(callPanel, false);
        show($("incomingBar"), false);
        if (timerIv) { clearInterval(timerIv); timerIv = null; }
      }
      if (ringSession === s) ringSession = null;
    });
    s.on("ended", function () {
      if (s.__guard) { clearTimeout(s.__guard); s.__guard = null; }
      stopRing();
      if (session === s || ringSession === s) {
        show(callPanel, false);
        show($("incomingBar"), false);
        if (timerIv) { clearInterval(timerIv); timerIv = null; }
      }
      if (session === s) session = null;
      if (ringSession === s) ringSession = null;
    });
  }

  function resetMuteButton() {
    var btn = $("btnMute");
    btn.classList.remove("active");
    btn.textContent = "Mute";
    /* JsSIP mute disables the SHARED mic track; re-enable it so the next
       call/answer starts audible (UI reset alone is not enough). */
    if (localStream) {
      localStream.getAudioTracks().forEach(function (t) { t.enabled = true; });
    }
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

  var PC_CONFIG = {
    /* public STUN only for candidate discovery (Chrome mDNS obfuscation):
       media still flows peer-to-peer over the LAN */
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  };

  function startCall(dest) {
    if (!dest) { dialInput.focus(); return; }
    if (busy()) { $("callState").textContent = "Another call is in progress"; show(callPanel, true); return; }
    if (!ua || !ua.isConnected()) { setBadge("trying", "Reconnecting…"); return; }
    ensureMedia(function (err) {
      if (err) { $("callState").textContent = "Microphone blocked"; show(callPanel, true); return; }
      ua.call("sip:" + dest + "@" + SIP_DOMAIN, {
        mediaConstraints: { audio: true, video: false },
        mediaStream: localStream,
        pcConfig: PC_CONFIG
      });
    });
  }

  /* ---------- boot ---------- */
  var saved = store.load();
  if (saved) {
    $("inExt").value = saved.ext;
    connect(saved.ext, saved.secret, { persist: false });
  } else {
    show(loginCard, true);
    setBadge("off", "Offline");
  }

  window.addEventListener("beforeunload", function () {
    stopRing();
  });
})();
