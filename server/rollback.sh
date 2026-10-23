#!/bin/bash
# MyTel WebPhone FULL rollback — restores pre-phone state (created 2026-10-22)
set -e
B=/root/mytel-phone-backup-20261022-233841

echo "[1/4] restoring asterisk config files ..."
cp -a "$B/pjsip_custom.conf" /etc/asterisk/pjsip_custom.conf
cp -a "$B/pjsip_custom_post.conf" /etc/asterisk/pjsip_custom_post.conf
cp -a "$B/extensions_custom.conf" /etc/asterisk/extensions_custom.conf
chown asterisk:asterisk /etc/asterisk/pjsip_custom.conf /etc/asterisk/pjsip_custom_post.conf /etc/asterisk/extensions_custom.conf

echo "[2/4] removing web app ..."
rm -rf /var/www/html/Phone

echo "[3/4] removing helper tool ..."
rm -f /usr/local/sbin/mytel-phone-addext

echo "[4/4] reloading asterisk (live-safe) ..."
asterisk -rx "pjsip reload" >/dev/null
asterisk -rx "dialplan reload" >/dev/null

echo "ROLLBACK-DONE"
asterisk -rx "pjsip show endpoints" | tail -4
