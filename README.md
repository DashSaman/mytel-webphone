# MyTel WebPhone

A MyTel-branded browser softphone (WebRTC) for Issabel 5 / Asterisk 20 (PJSIP).
Open `https://YOUR-PBX/Phone`, sign in once with your extension — the browser
remembers it and auto-registers on every later visit.

Built as a **pure static single-page app** on [JsSIP](https://jssip.net) (MIT),
following the approach popularized by
[cloudsip.app](https://github.com/CONNXTA/cloudsip.app) (GPL-3 — approach only,
no code copied). This repository is original code under MIT.

## Features

- SIP registration over **secure WebSocket** (`wss://PBX:8089/ws`)
- First-visit sign-in (extension + secret); credentials stored **only after a
  successful registration**, in `localStorage` (cookie fallback with
  `Secure; SameSite=Strict; path=/Phone` when localStorage is unavailable)
- Automatic re-registration on every later visit — no re-typing
- Dial pad + keyboard DTMF, incoming-call popup with synthesized ring,
  call timer, mute, hang-up
- English UI, MyTel (mytel.one) visual identity matching the MyTel PBX panel
- All assets served locally — no CDN, works on an isolated LAN

> ⚠️ **Not for emergency calls.**

## One-time certificate trust (self-signed PBX)

If Connect fails with a TLS/WebSocket error, the browser has not trusted the
PBX certificate yet:

1. Open `https://YOUR-PBX:8089/ws` in the same browser
2. Accept the certificate warning
3. Return to `/Phone` and press **Connect** again

## Install on Issabel 5 (Asterisk 20, PJSIP)

Requirements already present on a standard Issabel 5 + Asterisk 20 install:

- Asterisk HTTP server enabled with TLS (`tlsbindaddr=0.0.0.0:8089`,
  `tlscertfile=/etc/asterisk/keys/asterisk.pem`, `/ws` enabled)
- PJSIP transports `transport-wss` defined

Steps (MERGE, never replace whole files — existing custom content must be preserved):

1. Copy `app/` to `/var/www/html/Phone/` on the PBX server
   (`chown asterisk:asterisk`, files `644`, dirs `755`)
2. **Merge** the endpoint template and endpoints into `/etc/asterisk/pjsip_custom.conf`
   (append the contents of `server/pjsip_custom.conf.example` and edit in real
   extension numbers + strong secrets — or use the helper below), and **merge**
   the `[mytel-webphone]` context from `server/extensions_custom.conf` into
   `/etc/asterisk/extensions_custom.conf`. If those files already contain other
   customizations, keep them and add only the new sections.
3. Apply live (no restart needed):
   ```
   asterisk -rx "pjsip reload"
   asterisk -rx "dialplan reload"
   ```
4. Verify:
   ```
   asterisk -rx "pjsip show endpoints"   # your endpoints listed
   asterisk -rx "pjsip show contacts"    # contact appears after web login
   ```

### Adding more extensions

Install `server/mytel-phone-addext` to `/usr/local/sbin/` on the PBX, then:

```
mytel-phone-addext 6003 "$(openssl rand -hex 16)"
```

The endpoint template (`webrtc=yes`, DTLS-SRTP with auto-generated cert, ICE,
`direct_media=no`, opus/ulaw/alaw) is defined once in `pjsip_custom.conf`
as `[mytel-webrtc](!)`.

## Echo test

Dial **600** from the phone to verify two-way audio with a single client.

## License

- This app: **MIT** (see `LICENSE`)
- JsSIP 3.10.1 vendored under `app/vendor/` — MIT (see `LICENSE-JSSIP`,
  SHA-256 of the vendored file: `0c9a19fa52a0450127847c566a05340ad57120c756d9c63e1f4e252013590b1b`)
- See `NOTICE` for attribution.
