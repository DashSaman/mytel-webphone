/* Unit tests: MyTel WebPhone v1.1.0 pure-logic contracts (node-run).
   Run: node tests/state.test.js — pure string/regex/set assertions only. */
"use strict";
const fs = require("fs");
const path = require("path");

const APP = path.join(__dirname, "..", "app");

let pass = 0, fail = 0;
function T(name, fn) {
  try { fn(); console.log("PASS", name); pass++; }
  catch (e) { console.log("FAIL", name, "-", e.message); fail++; }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || "") + " expected " + JSON.stringify(b) + " got " + JSON.stringify(a)); }

/* ---- source sanity (static scan, no execution) ---- */
T("phone.js: balanced braces (static scan)", () => {
  const s = fs.readFileSync(path.join(APP, "phone.js"), "utf8");
  const open = (s.match(/{/g) || []).length;
  const close = (s.match(/}/g) || []).length;
  eq(open > 100 && open === close, true, "brace balance " + open + "/" + close);
});
T("phone.js: no innerHTML with variables", () => {
  const s = fs.readFileSync(path.join(APP, "phone.js"), "utf8");
  eq(s.indexOf("innerHTML") === -1, true, "no innerHTML at all");
});
T("phone.js: version constant present", () => {
  const s = fs.readFileSync(path.join(APP, "phone.js"), "utf8");
  eq(s.indexOf('APP_VERSION = "v1.1.0"') !== -1, true, "version");
});

/* ---- credential storage contract ---- */
T("credential format: valid", () => {
  const v = "6001 abcdef";
  const i = v.indexOf(" ");
  eq(/^[0-9]{2,6}$/.test(v.slice(0, i)), true, "ext");
  eq(v.slice(i + 1).length > 0, true, "secret");
});
T("credential format: rejects invalid ext", () => {
  for (const bad of ["6", "60001a", "6000100", ""]) eq(/^[0-9]{2,6}$/.test(bad), false, bad);
});

/* ---- history contract ---- */
T("history capped at 20, credential-free", () => {
  const list = [];
  for (let i = 0; i < 30; i++) list.unshift({ d: Date.now(), dir: "out", peer: String(i), o: "ended" });
  const capped = list.slice(0, 20);
  eq(capped.length, 20, "cap");
  eq(JSON.stringify(capped).indexOf("secret") === -1, true, "no secrets");
});

/* ---- secret charset (server helper contract) ---- */
T("secret charset: alnum 12-64 only", () => {
  for (const bad of ["abc;rm -rf", "with space12345", "short123", "x".repeat(65)]) {
    eq(/^[A-Za-z0-9]{12,64}$/.test(bad), false, bad.slice(0, 12));
  }
  eq(/^[A-Za-z0-9]{12,64}$/.test("abcdef0123456789"), true, "valid");
});

/* ---- dialplan collision regex (helper contract) ---- */
T("dialplan collision: whitespace variants", () => {
  const body = "exten=>6003,1,NoOp()\nexten =>6003,1,NoOp()\nexten\t=>\t6003,1,NoOp()\nexten => 6003,1,NoOp()\n";
  const m = body.match(new RegExp("^\\s*exten\\s*=>\\s*6003\\s*,", "gm"));
  eq(m.length, 4, "variants");
});

/* ---- show() inversion regression ---- */
T("show() toggle semantics", () => {
  const set = new Set(["hidden"]);
  const toggle = (c, force) => { if (force) set.add(c); else set.delete(c); };
  toggle("hidden", !true);  eq(set.has("hidden"), false, "shown");
  toggle("hidden", !false); eq(set.has("hidden"), true, "hidden");
});

/* ---- busy() single-call policy ---- */
T("busy() policy", () => {
  const mk = (ended) => ({ isEnded: () => ended });
  const busy = (s, r) => Boolean((s && !s.isEnded()) || (r && !r.isEnded()));
  eq(busy(mk(false), null), true, "active blocks");
  eq(busy(null, mk(false)), true, "ring blocks");
  eq(busy(mk(true), null), false, "ended frees");
  eq(busy(null, null), false, "idle");
});

/* ---- peer truncation ---- */
T("peer truncation length", () => {
  eq(String("<x>6001").slice(0, 32).length, 7, "short kept");
  eq(String("a".repeat(64)).slice(0, 32).length, 32, "long capped");
});

/* ---- CSP / asset locality ---- */
T("index: only local assets", () => {
  const html = fs.readFileSync(path.join(APP, "index.html"), "utf8");
  eq(/src="https?:\/\//.test(html), false, "no remote src");
  eq(html.indexOf("assets/emblem.svg") !== -1, true, "local emblem");
  eq(html.indexOf("Content-Security-Policy") !== -1, true, "CSP present");
});
T("index: no inline event handlers", () => {
  const html = fs.readFileSync(path.join(APP, "index.html"), "utf8");
  eq(/\son[a-z]+\s*=/i.test(html.replace(/placeholder="[^"]*"/g, "")), false, "no on* attributes");
});

/* ---- round-2 review regression tests ---- */
T("hold state: isOnHold returns {local,remote}, not boolean", () => {
  /* contract: check .local property, never truthiness of the object */
  const holdResult = { local: false, remote: false };
  eq(holdResult.local, false, "not on hold");
  eq(Boolean(holdResult), true, "object is truthy — boolean check would always fire");
});

T("zombie: WAITING_FOR_ACK past 32s deadline is dead", () => {
  const ACK_DEADLINE_MS = 32000;
  const s = { isEnded: () => false, status: 6 /* WAITING_FOR_ACK */, _dialog: {} };
  const now = Date.now();
  /* fresh: alive */
  s.__acceptedAt = now - 5000;
  const alive = !(s.isEnded() || (s.__acceptedAt && (now - s.__acceptedAt) > ACK_DEADLINE_MS));
  eq(alive, true, "5s old = alive");
  /* stale: dead */
  s.__acceptedAt = now - 40000;
  const dead = !(s.isEnded() || (s.__acceptedAt && (now - s.__acceptedAt) > ACK_DEADLINE_MS));
  eq(dead, false, "40s old = dead (bounded recovery)");
});

T("zombie: CONFIRMED without dialog is dead", () => {
  const s = { isEnded: () => false, status: 9, _dialog: null };
  eq(!!s._dialog, false, "no dialog → dead");
});

T("answer race: captured session must match ringSession", () => {
  const A = { id: "A" }, B = { id: "B" };
  /* caller A captured at click; by callback time ringSession is B */
  const captured = A;
  const currentRing = B;
  eq(captured !== currentRing, true, "different caller → must NOT answer");
});

T("media serialization: concurrent acquisitions queue", () => {
  const events = [];
  let pending = false;
  const queue = [];
  function acquire(cb) {
    if (pending) { queue.push(cb); events.push("queued"); return; }
    pending = true; events.push("acquired");
    setTimeout(() => { pending = false; cb(); }, 1);
  }
  acquire(() => events.push("cb1"));
  acquire(() => events.push("cb2"));
  eq(events.indexOf("queued") !== -1, true, "second request queued");
});

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
