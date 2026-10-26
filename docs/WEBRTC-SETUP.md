# MyTel WebPhone — WebRTC Setup for FreePBX/IssabelPBX Extensions

## The Problem

Extensions created through the IssabelPBX admin console are configured for **UDP** transport by default (no WebRTC). The WebPhone requires **WSS** + DTLS + ICE. Additionally, using a custom `pjsip_custom.conf` with the same extension number as a FreePBX-managed extension causes a **duplicate object error** that prevents ALL PJSIP endpoints from loading.

## The Solution: Database-based WebRTC Override

Instead of a custom config file (which conflicts), update the FreePBX database directly. The settings survive `retrieve_conf` regeneration because they're stored in the same place FreePBX reads from.

### One-time server fix (if pjsip endpoints won't load)

```bash
# Extract private key from the combined PEM if transport-tls fails
cd /etc/asterisk/keys
openssl rsa -in asterisk.pem -out asterisk.key 2>/dev/null
openssl x509 -in asterisk.pem -out asterisk.crt 2>/dev/null
chown asterisk:asterisk asterisk.key asterisk.crt
chmod 640 asterisk.key asterisk.crt
```

### Enable WebRTC for an extension

Replace `6002` with your extension number. Run as root on the PBX server:

```bash
mysql -uasteriskuser -p<password> asterisk -e "
UPDATE sip SET data='transport-wss' WHERE id='6002' AND keyword='transport';
UPDATE sip SET data='yes' WHERE id='6002' AND keyword='ice_support';
UPDATE sip SET data='yes' WHERE id='6002' AND keyword='use_avpf';
UPDATE sip SET data='dtls' WHERE id='6002' AND keyword='media_encryption';
UPDATE sip SET data='yes' WHERE id='6002' AND keyword='dtls_auto_generate_cert';
UPDATE sip SET data='fingerprint' WHERE id='6002' AND keyword='dtls_verify';
UPDATE sip SET data='actpass' WHERE id='6002' AND keyword='dtls_setup';
UPDATE sip SET data='yes' WHERE id='6002' AND keyword='rtcp_mux';
UPDATE sip SET data='no' WHERE id='6002' AND keyword='direct_media';
UPDATE sip SET data='yes' WHERE id='6002' AND keyword='force_rport';
UPDATE sip SET data='yes' WHERE id='6002' AND keyword='rewrite_contact';
UPDATE sip SET data='yes' WHERE id='6002' AND keyword='rtp_symmetric';
INSERT IGNORE INTO sip (id, keyword, data, flags) VALUES ('6002','webrtc','yes',0);
"

# Regenerate FreePBX config and reload
/var/lib/asterisk/bin/retrieve_conf
asterisk -rx "pjsip reload"
```

### Verify

```bash
asterisk -rx "pjsip show endpoint 6002" | grep -E 'Transport|ice_sup|media_enc|webrtc'
# Should show: transport-wss, ice_support=true, media_encryption=dtls, webrtc=yes
```

## Important Notes

- **Do NOT use `/etc/asterisk/pjsip_custom.conf`** for WebRTC endpoints that also exist in FreePBX — this causes a duplicate object error that breaks ALL endpoint loading
- The database changes survive `Apply Config` / `retrieve_conf` because they're in the same table FreePBX reads
- Each browser needs a one-time certificate trust at `https://PBX-IP:8089/ws`
