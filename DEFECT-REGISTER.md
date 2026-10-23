# MyTel WebPhone v1.1.0 — Defect Register & Change Log

## Prior findings (3 independent review rounds, all fixed in v1.0.0)

### Round 1 (REJECT — 8 findings)
| # | Finding | Fix |
|---|---------|-----|
| P1-1 | Mute left call audio transmitting (preflight tracks ≠ session tracks) | RTCSession.mute()/unmute() on live session |
| P1-2 | README instructed replacing whole config files (would destroy existing config) | MERGE instructions + helper creates context only if absent |
| P1-3 | Overlapping calls lost controls (one global session ref) | Single-call policy: busy() guard + 486 auto-decline; per-session event scoping |
| P2-4 | Sign-out undone by pending mic callback (stale UA events restored UI/creds) | epoch token invalidates every async path |
| P2-5 | Mic capture survived sign-out (preflight stream tracks not stopped) | stopMic() on logout |
| P2-6 | Helper appended dial rule into wrong context | python3 block-scoped inserter inside [mytel-webphone] |
| P2-7 | Secret charset injection (';' comment / newline config injection) | ^[A-Za-z0-9]{12,64}$ |
| P2-8 | Cert help card missed real connection failures (e.code boolean) | e.error boolean || code 1006/1015 |

### Round 2 (REJECT — 6 findings)
| # | Finding | Fix |
|---|---------|-----|
| P1-9 | show(el,true) ADDED the hidden class (entire UI inverted) | classList.toggle("hidden", !on) |
| P2-10 | Double sign-in leaked first mic capture (two getUserMedia) | connecting flag serialization + epoch++ per attempt + stop replaced stream |
| P2-11 | Incoming call inherited stale "Unmute" indicator | resetMuteButton() on accepted |
| P2-12 | Helper partial update (pjsip written, dialplan collision then failed) | validate BOTH files pre-write + trap restores on failure |
| P2-13 | Missing final newline corrupted dialplan on insertion | inserter guarantees line boundary |
| P2-14 | Documented secret generator (base64) incompatible with charset | openssl rand -hex 16 |

### Round 3 (REJECT — 4 findings)
| # | Finding | Fix |
|---|---------|-----|
| P2-15 | Late JsSIP media stream could leak after sign-out | mediaStream passed into call/answer (no second capture) |
| P2-16 | Sign-out during mic prompt locked Connect disabled | logout resets connecting flag + button |
| P2-17 | Auto sign-in hid cert recovery card (login panel hidden) | revealRecovery() shows login when phoneUI hidden |
| P2-18 | Collision regex missed 'exten=>6003' whitespace variants | ^\s*exten\s*=>\s*EXT\s*,

### GPT-6.1-sol MAX polish (post-review)
| # | Finding | Fix |
|---|---------|-----|
| RT-1 | Muted track stays disabled across calls (next call silent) | resetMuteButton re-enables shared tracks |

### Live-verification runtime fixes (production)
| # | Finding | Root cause | Fix |
|---|---------|-----------|-----|
| RT-2 | DTLS packets dropped ("Source not in ICE active candidate list") | Chrome mDNS-obfuscated host candidates unresolvable by pjproject | public STUN in pcConfig (candidate discovery only; media stays LAN P2P) |
| RT-3 | Answered-then-cancelled session froze all future calls (zombie) | 200-OK vs CANCEL race leaves session un-confirmed, busy() true forever | 8s accepted-without-confirmed guard (v1.1.0: state-aware improvement) |

### v1.1.0 audit findings (this pass)
| # | Finding | Fix |
|---|---------|-----|
| A-1 | rollback.sh absent from server backup dir (hook denial had silently skipped it) | installed as /root/mytel-phone-backup-20261022-233841/rollback, bash -n verified |
| A-2 | v1.0.0 visibility contradiction → resolved: gh api shows private:false, visibility:public (recorded) | — |

## v1.1.0 hardening changes (this release)
(to be appended as implemented)
