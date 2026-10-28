# Manual cleanup of an existing MyTel WebPhone installation

The automated path is [`server/cleanup.sh`](../server/cleanup.sh).
Run as root on the Issabel 5 / Asterisk 20 host with Bash and Python 3.
Never restart Asterisk. Only the PJSIP and dialplan reloads below are used;
Apache receives a graceful reload after a successful configuration test.

Preview from the repository root:

    bash server/cleanup.sh --dry-run

The preview reads configuration in binary mode and reports planned backups,
removals, logs, reloads and rollback commands. It creates no files or
directories, performs no backups, and executes no service commands.

The exit contract is intentionally preserved:

- Exit 0 with `done. changed=1`: resources were removed, or a dry-run found work.
- Exit 1 with `done. changed=0`: nothing matched; this is the expected clean-host result.
- A `FATAL` message or a missing `done` line means the run failed. Exit 1 alone
  does not distinguish failure from a clean host.

A normal clean-host rerun creates no backup directory and runs no service
commands. An actual cleanup first completes every required backup. Any failed
`cp` or `tar` is fatal before any cleanup removal or configuration write.

Configuration files must be regular files, not symlinks; the script aborts
rather than following a configuration symlink without backing up its target.
Keep the installation and configuration unchanged throughout cleanup.

## 0) Back up

For automated cleanup, run `bash server/cleanup.sh` after reviewing a completed
preview. The script prints its backup directory and exact rollback commands.

For manual cleanup, proceed only after the preview reports `changed=1`.
If it reports `changed=0`, stop here. Run all manual command blocks in the
same root Bash session. Complete this entire backup block before removing
or editing anything. An absent optional file is logged and skipped; failure
to back up an existing selected resource stops the session.

The backup directory defaults to `/root/mytel-webphone-cleanup-$TS`.
`MYTEL_CLEANUP_BK` overrides it. Choose an unused directory outside the web
application directory. Existing backup files or removal logs are never
overwritten. Whenever cleanup work exists, both existing Asterisk custom
configuration files are backed up, including one that needs no edit.

    set -Eeuo pipefail
    say(){ echo "[mytel-webphone-cleanup] $*"; }
    fatal(){ echo "[mytel-webphone-cleanup] FATAL: $*" >&2; exit 1; }
    [[ $EUID -eq 0 ]] || fatal "run as root"
    TS=$(date -u +%Y%m%dT%H%M%SZ)
    BK="${MYTEL_CLEANUP_BK:-/root/mytel-webphone-cleanup-$TS}"
    BK=$(realpath -m -- "$BK") || fatal "cannot resolve backup directory"
    CHANGED=0
    PHONE=0
    TOOLS=()
    CSP_FILES=()
    if [[ -e /var/www/html/Phone || -L /var/www/html/Phone ]]; then
      [[ -d /var/www/html/Phone ]] || fatal "/var/www/html/Phone is not a directory"
      PHONE=1
      PHONE_REAL=$(realpath -m -- /var/www/html/Phone) || fatal "cannot resolve Phone directory"
      case "$BK/" in "$PHONE_REAL/"*) fatal "backup directory must be outside /var/www/html/Phone";; esac
    fi
    mkdir -p -- "$BK" || fatal "cannot create $BK"
    chmod 0700 -- "$BK" || fatal "cannot restrict $BK (credential-bearing backups)"
    say "backup directory: $BK (0700)"
    for F in removed-dialplan.bin removed-pjsip.bin; do
      [[ ! -e "$BK/$F" && ! -L "$BK/$F" ]] || fatal "removal log already exists: $BK/$F"
    done
    backup(){
      local f="$1" name="${2:-${1##*/}}"
      [[ ! -e "$BK/$name" && ! -L "$BK/$name" ]] || fatal "backup already exists: $BK/$name"
      cp -a -- "$f" "$BK/$name" || fatal "backup failed for $f; do not remove or edit anything"
      say "backed up $f to $BK/$name"
    }
    if (( PHONE )); then
      [[ ! -e "$BK/Phone.tgz" && ! -L "$BK/Phone.tgz" ]] || fatal "Phone.tgz already exists"
      tar -C /var/www/html -czf "$BK/Phone.tgz" -- Phone || fatal "Phone backup failed; do not remove or edit anything"
      say "backed up /var/www/html/Phone"
    else
      say "no /var/www/html/Phone"
    fi
    for T in mytel-phone-addext mytel-phone-webrtc; do
      if [[ -e "/usr/local/sbin/$T" || -L "/usr/local/sbin/$T" ]]; then
        [[ -f "/usr/local/sbin/$T" || -L "/usr/local/sbin/$T" ]] || fatal "helper is not a file: $T"
        TOOLS+=("$T")
        backup "/usr/local/sbin/$T"
      else
        say "no helper $T"
      fi
    done
    for F in /etc/asterisk/extensions_custom.conf /etc/asterisk/pjsip_custom.conf; do
      if [[ -e "$F" || -L "$F" ]]; then
        [[ -f "$F" && ! -L "$F" ]] || fatal "configuration must be a regular, non-symlink file: $F"
        backup "$F"
      else
        say "no $F"
      fi
    done
    for F in /etc/httpd/conf.d/mytel-phone-csp.conf /etc/apache2/conf-available/mytel-phone-csp.conf; do
      if [[ -e "$F" || -L "$F" ]]; then
        [[ -f "$F" && ! -L "$F" ]] || fatal "configuration must be a regular, non-symlink file: $F"
        if grep -aq '<Location /Phone' "$F"; then
          CSP_FILES+=("$F")
          case "$F" in
            /etc/httpd/*) backup "$F" httpd-mytel-phone-csp.conf;;
            /etc/apache2/*) backup "$F" apache2-mytel-phone-csp.conf;;
          esac
        else
          RC=$?
          [[ $RC -eq 1 ]] || fatal "cannot inspect $F"
          say "preserving $F (no <Location /Phone marker)"
        fi
      else
        say "no $F"
      fi
    done
    say "all backups complete; cleanup may now begin"

## 1) Remove the web app

    say "1) web app"
    if (( PHONE )); then
      [[ -f "$BK/Phone.tgz" ]] || fatal "Phone backup is missing"
      rm -rf -- /var/www/html/Phone || fatal "cannot remove /var/www/html/Phone"
      say "removed /var/www/html/Phone"
      CHANGED=1
    else
      say "no /var/www/html/Phone"
    fi

## 2) Remove the helper tools

    say "2) helper tools"
    if (( ${#TOOLS[@]} )); then
      for T in "${TOOLS[@]}"; do
        [[ -e "$BK/$T" || -L "$BK/$T" ]] || fatal "helper backup is missing: $T"
        rm -f -- "/usr/local/sbin/$T" || fatal "cannot remove helper $T"
        say "removed helper $T"
        CHANGED=1
      done
    else
      say "no helper tools"
    fi

## 3) Remove the dialplan context

In `/etc/asterisk/extensions_custom.conf`, remove only sections whose entire
header line is `[mytel-webphone]`, allowing trailing whitespace. A matching
name prefix, an inheritance suffix, or a comment mentioning the name does
not establish ownership.

Before editing a matching file, verify that it still equals its backup:

    cmp -s -- /etc/asterisk/extensions_custom.conf "$BK/extensions_custom.conf" || fatal "dialplan changed since backup"

Remove the matching header and its section content up to the next section
header or end of file, with these structural exceptions:

- Preserve every `#include`, `#tryinclude` and `#exec` directive line, including
  directives after the removed context and before the next header.
- Preserve all blank lines from the removed section.
- Keep preserved lines in their original relative order and retain their
  exact bytes, including indentation and line endings.

Perform configuration edits using binary reads and writes (`'rb'` and
`'wb'`). Construct the result from retained original bytes. Do not decode
and re-encode the file or normalize CRLF, LF, encoding or unrelated bytes.
These requirements also apply to the PJSIP edit in step 4.

Concatenate only the discarded bytes, in file order, into
`$BK/removed-dialplan.bin`. Preserve the complete original backup separately.
After a successful edit, run `CHANGED=1`. If there is no exact matching
context, log that fact and leave the file untouched.

## 4) Remove WebPhone-owned PJSIP objects

In `/etc/asterisk/pjsip_custom.conf`, classify ownership using complete
header lines, allowing trailing whitespace:

- Remove the exact `[mytel-webrtc](!)` endpoint template.
- Remove endpoint sections whose exact header is `[name](mytel-webrtc)`.
- Comments mentioning the template and section names beginning with
  `mytel-webrtc` do not establish ownership.

Inspect the file even when the template is already absent: matching
inheriting endpoint sections still establish ownership.

From every removed endpoint, collect references under all three keys:

| Reference key | Required explicit object type |
| --- | --- |
| `auth=` | `type=auth` |
| `outbound_auth=` | `type=auth` |
| `aors=` | `type=aor` |

For each value, discard a trailing `;` or `#` comment, split on commas, strip
whitespace from every name, and ignore empty entries. Option keys and type
values are case-insensitive; object names are compared literally.

Find referenced sections throughout the file, regardless of whether they
appear before or after their endpoints. A referenced section is a removal
candidate only when its name exists and its explicit `type=` matches the
reference context. Preserve sections with no explicit type, unknown types,
conflicting type declarations or a mismatched type. Do not infer ownership
from names such as `auth6001` or assume the AOR shares the endpoint's name.

Check all three reference keys on every surviving section, including
registrations, templates and other section types. Any surviving reference
protects that object name, regardless of which key contains it.

**Template inheritance also protects.** A surviving section whose header is
`[name](template-list)` — for example `[ordinary](base,shared-auth)` —
depends on EVERY template named in the comma-separated `template-list`.
Split the list on commas and treat each name as a protected dependency,
exactly like an option reference. A candidate whose name matches any
inherited template of a surviving section must NOT be removed, even if no
surviving section references it through `auth=`/`aors=`/`outbound_auth=`.

Start with all unrelated and non-candidate sections as survivors. Protect
any candidate referenced by a survivor — through option references OR
through a comma-separated inherited-template dependency — promote that
candidate to the survivor set, and repeat until no additional candidates
are protected. Remove only the remaining unprotected candidates. This also
preserves objects referenced (or inherited) by a candidate that must itself
survive.

Before editing a matching file:

    cmp -s -- /etc/asterisk/pjsip_custom.conf "$BK/pjsip_custom.conf" || fatal "PJSIP configuration changed since backup"

Apply the same binary preservation and structural-directive rules as step 3.
Write the discarded bytes, including removed template headers, in file
order to `$BK/removed-pjsip.bin`. After a successful edit, run `CHANGED=1`.
If no exact owned headers exist, log that fact and leave the file untouched.

Any real extension still using the exact WebPhone template is covered by
this removal rule. Migrate such extensions before cleanup. Certificates,
other DTLS assets, trunks, ordinary extensions, recordings, CDR and queues
receive no independent removal action.

## 5) Remove the Apache /Phone security snippets

The script selects only these filenames when their contents contain the
literal marker `<Location /Phone`:

- `/etc/httpd/conf.d/mytel-phone-csp.conf`
- `/etc/apache2/conf-available/mytel-phone-csp.conf`

Step 0 recorded and backed up those selections using separate backup names.
Other files and snippets without the marker are preserved.

    say "5) Apache /Phone security snippets"
    if (( ${#CSP_FILES[@]} )); then
      for F in "${CSP_FILES[@]}"; do
        case "$F" in
          /etc/httpd/*) NAME=httpd-mytel-phone-csp.conf;;
          /etc/apache2/*) NAME=apache2-mytel-phone-csp.conf;;
        esac
        [[ -f "$BK/$NAME" ]] || fatal "Apache snippet backup is missing: $F"
        rm -f -- "$F" || fatal "cannot remove $F"
        say "removed $F"
        CHANGED=1
      done
    else
      say "no matching /Phone security snippets"
    fi

## 6) Apply live (no Asterisk restart)

Run service commands only when something was actually removed or edited.
The automated script logs reload failures as warnings; inspect those
warnings before assuming the live configuration has changed.

    say "6) apply live"
    if (( CHANGED )); then
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
    else
      say "no changes; no service commands"
    fi

## 7) Verify absence

Check the removed web application and helpers:

    for F in /var/www/html/Phone /usr/local/sbin/mytel-phone-addext /usr/local/sbin/mytel-phone-webrtc; do
      [[ ! -e "$F" && ! -L "$F" ]] || fatal "still present: $F"
    done

From the repository root, repeat the read-only plan. A completed cleanup
must report `changed=0` and return 1:

    rc=0
    output=$(bash server/cleanup.sh --dry-run 2>&1) || rc=$?
    printf '%s\n' "$output"
    [[ $rc -eq 1 && "$output" == *"done. changed=0 dry-run=1"* ]] || fatal "cleanup verification failed"

This verifies configured ownership matches. It does not establish that a
previously failed reload succeeded; resolve any reload warnings separately.

## Rollback

The automated script prints exact, shell-quoted restore commands for its
actual backups. A preview prints illustrative rollback commands but creates
no backups; do not execute those commands for the preview.

For manual rollback, use the same root Bash session with its `BK`, or set
`BK` to the actual backup directory first. Restore only backups that exist.
Restoring a complete configuration backup also reverts edits made after
that backup.

    say "rollback from $BK"
    if [[ -f "$BK/Phone.tgz" ]]; then
      tar -C /var/www/html -xzf "$BK/Phone.tgz" || fatal "Phone restore failed"
    fi
    for F in /usr/local/sbin/mytel-phone-addext /usr/local/sbin/mytel-phone-webrtc /etc/asterisk/extensions_custom.conf /etc/asterisk/pjsip_custom.conf; do
      SRC="$BK/${F##*/}"
      if [[ -e "$SRC" || -L "$SRC" ]]; then
        cp -a -- "$SRC" "$F" || fatal "restore failed for $F"
      fi
    done
    if [[ -f "$BK/httpd-mytel-phone-csp.conf" ]]; then
      cp -a -- "$BK/httpd-mytel-phone-csp.conf" /etc/httpd/conf.d/mytel-phone-csp.conf || fatal "httpd snippet restore failed"
    fi
    if [[ -f "$BK/apache2-mytel-phone-csp.conf" ]]; then
      cp -a -- "$BK/apache2-mytel-phone-csp.conf" /etc/apache2/conf-available/mytel-phone-csp.conf || fatal "apache2 snippet restore failed"
    fi
    asterisk -rx "pjsip reload" || fatal "pjsip reload failed"
    asterisk -rx "dialplan reload" || fatal "dialplan reload failed"
    if command -v apachectl >/dev/null 2>&1; then
      apachectl configtest || fatal "Apache configtest failed"
      systemctl reload httpd || systemctl reload apache2 || fatal "graceful Apache reload failed"
    fi

## WHY

1. Dry-run uses read-only planning and guards every mutation and service command.
2. Complete ownership headers exclude name prefixes and comment mentions.
3. Comma-aware survivor checks protect shared objects; reference context restricts object type.
4. Every backup must succeed before any cleanup removal or configuration write.
5. Order-independent reference collection handles all three keys, even without the template.
6. Binary reads/writes preserve retained bytes, directives, blank lines and line endings.

Residual risk: same-file checks cannot inspect dependencies in included files
or external consumers. Previously orphaned objects without endpoint ownership
evidence remain preserved. Cleanup spans multiple files and is not a
transaction; concurrent changes or interrupted writes can require rollback.
Reload warnings require administrator action before live removal is assumed.

## Verification before final approval

Run syntax verification from the repository root:

    bash -n server/cleanup.sh

Run isolated fixtures covering exact ownership, comment mentions, shared
objects, comma lists under all three keys, registration references,
mismatched/unknown types, reordered objects, missing templates, EOF headers,
CRLF and unrelated binary bytes, preserved directives and blank lines.
Verify that dry-run invokes no mutating or service commands. Force each
`cp`/`tar` backup to fail and assert a fatal exit before any cleanup mutation.

On the already-cleaned isolated fixture host, verify the actual rerun
contract as well as the dry-run check in step 7:

    rc=0
    output=$(bash server/cleanup.sh 2>&1) || rc=$?
    printf '%s\nexit=%s\n' "$output" "$rc"
    [[ $rc -eq 1 && "$output" == *"done. changed=0 dry-run=0"* ]]

The idempotency harness must assert both `changed=0` and exit 1.
It must also assert that the rerun creates no backups and runs no reloads.
