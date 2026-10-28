#!/bin/bash
# MyTel WebPhone cleanup — safe, repeatable removal for existing installations.
# Product discontinued by owner decision 2026-10-27. Removes ONLY WebPhone-owned
# resources; shared telephony is preserved. All edits are binary-safe (no
# newline/CRLF normalization). Asterisk is NEVER restarted: only live-safe
# pjsip reload + dialplan reload. --dry-run mutates nothing.
#
# Owned-by-WebPhone rules (exact, header-based):
#   - the endpoint template whose header is exactly [mytel-webrtc](!)
#   - endpoint sections whose header is exactly [name](mytel-webrtc)
#   - referenced auth/aor objects, only with the matching explicit type and
#     no surviving same-file auth=/aors=/outbound_auth= reference (comma-aware)
set -Eeuo pipefail
DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1
TS=$(date -u +%Y%m%dT%H%M%SZ)
BK="${MYTEL_CLEANUP_BK:-/root/mytel-webphone-cleanup-$TS}"
PJSIP=/etc/asterisk/pjsip_custom.conf
DIAL=/etc/asterisk/extensions_custom.conf
CHANGED=0
ROLLBACK=()

say(){ echo "[mytel-webphone-cleanup] $*"; }
die(){ echo "[mytel-webphone-cleanup] FATAL: $*" >&2; exit 1; }
# Complete ALL backups before any removal or configuration write.
backup(){
  local f="$1" name="${2:-${1##*/}}" cmd
  [[ ! -e "$BK/$name" && ! -L "$BK/$name" ]] || die "backup already exists: $BK/$name; choose a new backup directory"
  if (( DRY )); then
    say "DRY-RUN: would back up $f to $BK/$name"
  else
    cp -a -- "$f" "$BK/$name" || die "backup failed for $f — aborting before any cleanup change"
    say "backed up $f to $BK/$name"
  fi
  printf -v cmd 'cp -a -- %q %q' "$BK/$name" "$f"
  ROLLBACK+=("$cmd")
}

# Prints the number of removed sections; preview mode only reads files.
edit_config(){
  python3 -B - "$1" "$2" "$3" "${4:-$DRY}" "${5:-}" <<'PY'
import os, re, sys
kind, path, log, dry, backup = sys.argv[1:6]
with open(path, 'rb') as f:
    raw = f.read()

# Split on header lines only; keep every original line ending and byte.
# Track Asterisk block-comment state (;-- ... --;) so headers and options
# inside comments are never classified as real configuration.
start = re.compile(rb'^[ \t]*\[([^\]\r\n]+)\]')
header = re.compile(rb'[ \t]*\[([^\]\r\n]+)\](?:\([^)\r\n]*\))?[ \t\v\f]*(?:;[^\r\n]*)?')
exact = re.compile(rb'\[([^\]\r\n]+)\](\([^)\r\n]*\))?[ \t\v\f]*')
# Asterisk accepts both key=val and key => val assignments.
option = re.compile(rb'^[ \t]*(auth|aors|outbound_auth|type)[ \t]*(?:=>|=)[ \t]*([^;#\r\n]*)', re.I)
directive = re.compile(rb'^[ \t]*#[ \t]*(?:include|tryinclude|exec)\b', re.I)
block_open = re.compile(rb';--(?!-)')  # ;-- not followed by another dash
block_close = re.compile(rb'--;')  # Asterisk accepts ---;, ----; etc. as closers
# Asterisk syntax forms that require a full config lexer or create
# cross-section dependencies this script cannot safely resolve. Abort
# BEFORE any mutation when any of them are present.
danger_plus_eq = re.compile(rb'^[ \t]*\w+[ \t]*\+=', re.M)    # key += value
danger_cat_ext = re.compile(rb'^[ \t]*\[[^\]\r\n]+\]\([^)\r\n]*\+', re.M)  # [name](+ or (+type=...))
danger_exec    = re.compile(rb'^[ \t]*#[ \t]*exec\b', re.I | re.M)
danger_escaped = re.compile(rb'^[ \t]*\\', re.M)  # \auth=shared, \key+=val, etc.
danger_bom     = b'\xef\xbb\xbf'  # UTF-8 BOM: Asterisk strips it; we cannot safely
danger_nested  = re.compile(rb';--.*;--')  # multiple block-open on one line
if raw.startswith(danger_bom):
    sys.stderr.write(b'FATAL: ' + path.encode() + b' starts with a UTF-8 BOM. '
                     b'Remove the BOM before running cleanup.\n')
    sys.exit(1)
if danger_nested.search(raw):
    sys.stderr.write(b'FATAL: ' + path.encode() + b' contains nested block-comment '
                     b'openings on a single line. Manually review before cleanup.\n')
    sys.exit(1)
if danger_plus_eq.search(raw) or danger_cat_ext.search(raw) or danger_exec.search(raw) or danger_escaped.search(raw):
    sys.stderr.write(b'FATAL: ' + path.encode() + b' uses unsupported advanced '
                     b'Asterisk syntax (+= append, (+) category extension, #exec, '
                     b'or backslash-escaped options). '
                     b'Manually review and simplify before running cleanup.\n')
    sys.exit(1)

# Build parts as lists of (line_bytes, is_comment) tuples so comment status
# is tracked by POSITION, not by byte content (identical bytes inside and
# outside a block comment must not be conflated). Lines with LIVE content
# before an inline ;-- ... --; are unsupported (they require a full Asterisk
# lexer); the script aborts on them rather than silently miscategorizing.
parts = []
in_block_comment = False
for line in raw.splitlines(keepends=True):
    if in_block_comment:
        # Live content after a closing --; is a mixed line we cannot safely
        # parse without a full Asterisk lexer; nested ;-- inside an open
        # comment is also unsupported. Abort on both.
        after_close = b''
        if block_close.search(line):
            after_close = line[block_close.search(line).end():]
        if block_open.search(line) or after_close.strip(b' \t\r\n'):
            sys.stderr.write(b'FATAL: unsupported mixed/nested block-comment '
                             b'line: ' + line.strip() + b'\n'
                             b'Manually review this line before running cleanup.\n')
            sys.exit(1)
        if not parts:
            parts.append([])
        parts[-1].append((line, True))
        if block_close.search(line):
            in_block_comment = False
        continue
    if block_open.search(line):
        before = line[:line.find(b';--')]
        if before.strip(b' \t\r\n'):
            sys.stderr.write(b'FATAL: unsupported inline block comment with live '
                             b'content: ' + line.strip() + b'\n'
                             b'Manually review this line before running cleanup.\n')
            sys.exit(1)
        # Search for a closer ONLY after the opener position — an overlapping
        # ;--; line is an opener with no closer on the same line.
        open_end = block_open.search(line).end()
        close_match = block_close.search(line, open_end)
        if close_match:
            after = line[close_match.end():]
            if after.strip(b' \t\r\n'):
                sys.stderr.write(b'FATAL: unsupported live content after block-comment '
                                 b'close: ' + line.strip() + b'\n'
                                 b'Manually review this line before running cleanup.\n')
                sys.exit(1)
        if not parts:
            parts.append([])
        parts[-1].append((line, True))
        in_block_comment = not close_match
        continue
    if not parts or start.match(line):
        parts.append([])
    parts[-1].append((line, False))

names, refs, types, inherits = [], [], [], []
owned, endpoints = set(), set()
for i, part in enumerate(parts):
    # Only classify a section when its FIRST line is a real (non-comment)
    # header line; a part starting with a block-comment line is comment-only
    # or comment-led content and must never trigger ownership.
    if not part or part[0][1]:  # first line is a comment
        names.append(None)
        refs.append(set())
        types.append(set())
        inherits.append(set())
        continue
    text = part[0][0].rstrip(b'\r\n')
    if not start.match(part[0][0]):
        names.append(None)
        refs.append(set())
        types.append(set())
        inherits.append(set())
        continue
    h = header.fullmatch(text)
    names.append(h.group(1) if h else None)
    used, declared = set(), set()
    inherit_names = set()
    for line, is_comment in part[1:]:
        if is_comment:
            continue  # never classify options inside block comments
        m = option.match(line)
        if not m:
            continue
        key, value = m.group(1).lower(), m.group(2).strip()
        if key == b'type':
            declared.add(value.lower())
        else:
            implied = b'aor' if key == b'aors' else b'auth'
            for name in value.split(b','):
                name = name.strip()
                if name:
                    used.add((name, implied))
    refs.append(used)
    types.append(declared)
    # Extract inheritance ONLY from a validated complete header line —
    # unanchored search can false-match on malformed lines with trailing text
    hm = re.match(rb'[ \t]*\[([^\]\r\n]+)\](\([^)\r\n]*\))?[ \t\v\f]*(?:;.*)?$', text)
    if hm and hm.group(2):
        for tmpl in hm.group(2)[1:-1].split(b','):
            tmpl = tmpl.strip()
            if tmpl:
                inherit_names.add(tmpl)
    inherits.append(inherit_names)
    if hm:
        name, inherit = hm.group(1), hm.group(2) or b''
        if kind == 'dialplan':
            if name == b'mytel-webphone' and not inherit:
                owned.add(i)
        elif name == b'mytel-webrtc' and inherit == b'(!)':
            owned.add(i)
        elif inherit == b'(mytel-webrtc)':
            owned.add(i)
            endpoints.add(i)

drop = set(owned)
if kind == 'pjsip':
    removed_refs = {ref for i in endpoints for ref in refs[i]}
    candidates = set()
    for i, name in enumerate(names):
        if i not in owned and len(types[i]) == 1:
            declared = next(iter(types[i]))
            if declared in (b'auth', b'aor') and (name, declared) in removed_refs:
                candidates.add(i)

    # A candidate is protected when a surviving section references it by
    # option (auth/aors/outbound_auth, comma-aware) OR inherits from it by
    # header — Asterisk resolves inherited category names CASE-INSENSITIVELY
    # (ast_get_category uses strcasecmp), so all inheritance comparisons
    # here use lowercased names.
    survivors = set(range(len(parts))) - owned - candidates
    while candidates:
        used = {name for i in survivors for name, _ in refs[i]}
        used_inherit = set()
        for inh_set in (inherits[i] for i in survivors):
            if inh_set:
                for n in inh_set:
                    used_inherit.add(n.lower())
        protected = {i for i in candidates
                     if names[i] in used or (names[i] or b'').lower() in used_inherit}
        if not protected:
            break
        survivors.update(protected)
        candidates.difference_update(protected)
    drop.update(candidates)

# SAFETY (after final drop set is computed): a SURVIVING section that
# inherits from ANY section in the drop set would be broken by its removal.
# Asterisk matches inherited names case-insensitively, so compare lowered.
dropped_lower = {(names[i] or b'').lower() for i in drop if names[i]}
for i, inh_set in enumerate(inherits):
    if i in drop or not inh_set:
        continue
    broken = {n for n in inh_set if n.lower() in dropped_lower}
    if broken:
        sys.stderr.write(
            b'FATAL: surviving section [' + (names[i] or b'?') + b'] '
            b'inherits from section(s) [' + b','.join(sorted(broken)) + b'] '
            b'that cleanup would remove. Migrate these extensions before cleanup.\n')
        sys.exit(1)

kept, removed = [], []
for i, part in enumerate(parts):
    for j, (line, is_comment) in enumerate(part):
        # Preprocessor directives, blank lines, and block-comment lines are
        # file structure: preserved byte-exact even inside removed sections
        # (including position zero of a comment-led part).
        structural = is_comment or (j > 0 and (
            not line.strip(b' \t\r\n\v\f') or directive.match(line)))
        if i not in drop or structural:
            kept.append(line)
        else:
            removed.append(line)
new = b''.join(kept)
if new != raw and dry == '0':
    with open(backup, 'rb') as f:
        if f.read() != raw:
            raise RuntimeError('configuration changed since backup: ' + path)
    # Removal logs contain credential-bearing config bytes: write 0600.
    fd = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'wb') as f:
        f.write(b''.join(removed))
    with open(path, 'wb') as f:
        f.write(new)
print(len(drop))
PY
}

[[ $EUID -eq 0 ]] || die "run as root"
[[ $# -le 1 && ( $# -eq 0 || "${1:-}" == "--dry-run" ) ]] || die "usage: $0 [--dry-run]"
command -v python3 >/dev/null 2>&1 || die "python3 is required"
BK=$(realpath -m -- "$BK") || die "cannot resolve backup directory"
if (( DRY )); then say "dry-run: no filesystem changes, backups, or service commands"; fi

# ---------- 0) inspect and back up before ANY cleanup change ----------
say "0) inspect resources and prepare backups"
PHONE=0
TOOLS=()
CSP_FILES=()
DIAL_COUNT=0
PJSIP_COUNT=0
if [[ -e /var/www/html/Phone || -L /var/www/html/Phone ]]; then
  [[ -d /var/www/html/Phone ]] || die "/var/www/html/Phone is not a directory"
  PHONE=1
  PHONE_REAL=$(realpath -m -- /var/www/html/Phone) || die "cannot resolve /var/www/html/Phone"
  case "$BK/" in "$PHONE_REAL/"*) die "backup directory must be outside /var/www/html/Phone";; esac
fi
for T in mytel-phone-addext mytel-phone-webrtc; do
  if [[ -e "/usr/local/sbin/$T" || -L "/usr/local/sbin/$T" ]]; then
    [[ -f "/usr/local/sbin/$T" || -L "/usr/local/sbin/$T" ]] || die "helper is not a file: /usr/local/sbin/$T"
    TOOLS+=("$T")
  fi
done
for F in "$DIAL" "$PJSIP"; do
  if [[ -e "$F" || -L "$F" ]]; then
    [[ -f "$F" && ! -L "$F" ]] || die "configuration must be a regular, non-symlink file: $F"
  fi
done
if [[ -f "$DIAL" ]]; then
  DIAL_COUNT=$(edit_config dialplan "$DIAL" "" 1) || die "cannot inspect $DIAL"
fi
if [[ -f "$PJSIP" ]]; then
  PJSIP_COUNT=$(edit_config pjsip "$PJSIP" "" 1) || die "cannot inspect $PJSIP"
fi
for F in /etc/httpd/conf.d/mytel-phone-csp.conf /etc/apache2/conf-available/mytel-phone-csp.conf; do
  if [[ -e "$F" || -L "$F" ]]; then
    [[ -f "$F" && ! -L "$F" ]] || die "configuration must be a regular, non-symlink file: $F"
    if grep -aq '<Location /Phone' "$F"; then
      CSP_FILES+=("$F")
    else
      RC=$?
      [[ $RC -eq 1 ]] || die "cannot inspect $F"
      say "preserving $F (no <Location /Phone marker)"
    fi
  fi
done
PLANNED=0
if (( PHONE || DIAL_COUNT || PJSIP_COUNT || ${#TOOLS[@]} || ${#CSP_FILES[@]} )); then
  PLANNED=1
  if (( ! DRY )); then mkdir -p -- "$BK" && chmod 0700 -- "$BK" || die "cannot create private backup dir $BK"; fi
  say "backup directory: $BK"
  for F in removed-dialplan.bin removed-pjsip.bin; do
    [[ ! -e "$BK/$F" && ! -L "$BK/$F" ]] || die "removal log already exists: $BK/$F; choose a new backup directory"
  done
  if (( PHONE )); then
    [[ ! -e "$BK/Phone.tgz" && ! -L "$BK/Phone.tgz" ]] || die "backup already exists: $BK/Phone.tgz; choose a new backup directory"
    if (( DRY )); then say "DRY-RUN: would archive /var/www/html/Phone to $BK/Phone.tgz"
    else
      tar -C /var/www/html -czf "$BK/Phone.tgz" -- Phone || die "Phone backup failed — aborting before any cleanup change"
      say "backed up /var/www/html/Phone to $BK/Phone.tgz"
    fi
    printf -v CMD 'tar -C /var/www/html -xzf %q' "$BK/Phone.tgz"
    ROLLBACK+=("$CMD")
  fi
  for T in "${TOOLS[@]}"; do backup "/usr/local/sbin/$T"; done
  for F in "$DIAL" "$PJSIP"; do
    if [[ -f "$F" ]]; then backup "$F"; else say "no $F to back up"; fi
  done
  for F in "${CSP_FILES[@]}"; do
    case "$F" in
      /etc/httpd/*) backup "$F" httpd-mytel-phone-csp.conf;;
      /etc/apache2/*) backup "$F" apache2-mytel-phone-csp.conf;;
    esac
  done
else
  say "nothing needs cleanup; no backup directory created"
fi

# ---------- 1) web app ----------
say "1) web app"
if (( PHONE )); then
  if (( DRY )); then say "DRY-RUN: would remove /var/www/html/Phone"
  else rm -rf -- /var/www/html/Phone || die "cannot remove /var/www/html/Phone"; say "removed /var/www/html/Phone"; fi
  CHANGED=1
else
  say "no /var/www/html/Phone"
fi

# ---------- 2) helper tools ----------
say "2) helper tools"
if (( ${#TOOLS[@]} )); then
  for T in "${TOOLS[@]}"; do
    if (( DRY )); then say "DRY-RUN: would remove helper $T"
    else rm -f -- "/usr/local/sbin/$T" || die "cannot remove helper $T"; say "removed helper $T"; fi
    CHANGED=1
  done
else
  say "no helper tools"
fi

# ---------- 3) dialplan context (binary-safe, exact header) ----------
say "3) dialplan context"
if (( DIAL_COUNT )); then
  if (( DRY )); then
    say "DRY-RUN: would remove $DIAL_COUNT exact [mytel-webphone] context(s), preserving directives and blank lines; log: $BK/removed-dialplan.bin"
  else
    DIAL_COUNT=$(edit_config dialplan "$DIAL" "$BK/removed-dialplan.bin" 0 "$BK/extensions_custom.conf") || die "cannot edit $DIAL; backups: $BK"
    say "removed $DIAL_COUNT [mytel-webphone] context(s); directives and blank lines preserved; removed bytes logged"
  fi
  if (( DIAL_COUNT )); then CHANGED=1; fi
else
  say "no exact [mytel-webphone] context in $DIAL (or file absent)"
fi

# ---------- 4) WebPhone-owned PJSIP objects ----------
say "4) WebPhone-owned PJSIP objects"
if (( PJSIP_COUNT )); then
  if (( DRY )); then
    say "DRY-RUN: would remove $PJSIP_COUNT owned PJSIP section(s), including correctly typed, unshared referenced objects; log: $BK/removed-pjsip.bin"
  else
    PJSIP_COUNT=$(edit_config pjsip "$PJSIP" "$BK/removed-pjsip.bin" 0 "$BK/pjsip_custom.conf") || die "cannot edit $PJSIP; backups: $BK"
    say "removed $PJSIP_COUNT owned PJSIP section(s) (binary-safe; removed bytes logged)"
  fi
  if (( PJSIP_COUNT )); then CHANGED=1; fi
else
  say "no exact WebPhone template or inheriting endpoint in $PJSIP (or file absent)"
fi

# ---------- 5) Apache scoped CSP conf (if it targets /Phone) ----------
say "5) Apache /Phone security snippets"
if (( ${#CSP_FILES[@]} )); then
  for F in "${CSP_FILES[@]}"; do
    if (( DRY )); then say "DRY-RUN: would remove $F"
    else rm -f -- "$F" || die "cannot remove $F"; say "removed $F"; fi
    CHANGED=1
  done
else
  say "no matching /Phone security snippets"
fi

# ---------- 6) apply (live-safe; never an Asterisk restart) ----------
say "6) apply live"
if (( CHANGED )); then
  if (( DRY )); then
    say 'DRY-RUN: would run asterisk -rx "pjsip reload" and asterisk -rx "dialplan reload", then apachectl configtest and a graceful httpd/apache2 reload if it passes'
  else
    asterisk -rx "pjsip reload" >/dev/null 2>&1 || say "WARN: pjsip reload failed"
    asterisk -rx "dialplan reload" >/dev/null 2>&1 || say "WARN: dialplan reload failed"
    if command -v apachectl >/dev/null 2>&1; then
      if apachectl configtest; then
        systemctl reload httpd || systemctl reload apache2 || say "WARN: graceful Apache reload failed"
      else
        say "WARN: Apache configtest failed; graceful reload skipped"
      fi
    else
      say "WARN: apachectl unavailable; graceful Apache reload skipped"
    fi
  fi
else
  say "no changes; no service commands"
fi

echo
say "done. changed=$CHANGED dry-run=$DRY"
if (( DRY )); then say "backups: $BK (preview only; none created)"
elif (( PLANNED )); then say "backups: $BK"
else say "backups: $BK (not created by this run)"; fi
if (( ${#ROLLBACK[@]} )); then
  if (( DRY )); then say "rollback commands after a completed real run (do not run for this preview):"
  else say "exact rollback commands (run as root):"; fi
  echo '  ('
  echo '    set -Eeuo pipefail'
  printf '    %s\n' "${ROLLBACK[@]}"
  echo '    asterisk -rx "pjsip reload"'
  echo '    asterisk -rx "dialplan reload"'
  echo '    if command -v apachectl >/dev/null 2>&1; then'
  echo '      apachectl configtest'
  echo '      systemctl reload httpd || systemctl reload apache2'
  echo '    fi'
  echo '  )'
else
  say "rollback: nothing to restore"
fi
# Existing exit contract: changes (or planned changes in dry-run) = 0; no-op = 1.
[[ $CHANGED -eq 1 ]]
