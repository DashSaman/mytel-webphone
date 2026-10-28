# MyTel WebPhone — DISCONTINUED

**This product is discontinued and no longer supported (owner decision,
2026-10-27).** It is removed from the active product line and from the
default branch of this repository.

## What this repository is now

- This branch contains only the **retirement notice** (this file), the MIT
  **license**, and a **safe cleanup path** for existing installations.
- **No application code, assets, installers, or tests ship from this branch.**

## Historical artifacts (intentionally retained)

- The full WebPhone implementation and its history remain reachable via the
  Git history and the immutable historical tags/releases:
  `v1.0.0`, `v1.1.0`, `v1.1.1`, `v1.1.2` (see the GitHub *Releases* page).
  Those releases contain vendored **JsSIP 3.10.1 (MIT)**; its license notice
  is preserved inside each tagged revision (`LICENSE-JSSIP`, `NOTICE`).
- Historical releases are provided for archaeological/rollback reference
  only and are **not** maintained.
- The repository is archived (read-only) after this retirement change.

## Removing an existing installation

If you installed MyTel WebPhone on an Issabel 5 / Asterisk 20 host and want
to remove it cleanly:

1. Download `server/cleanup.sh` from this branch.
2. Review what it will do (it prints every step and supports a dry run):
   ```bash
   bash cleanup.sh --dry-run
   ```
3. Run it as root on the PBX host:
   ```bash
   bash cleanup.sh
   ```

The cleanup removes **only WebPhone-owned resources**:

- the `/var/www/html/Phone` web app (backed up first),
- the `mytel-phone-addext` / `mytel-phone-webrtc` helper tools,
- the `[mytel-webphone]` dialplan context,
- PJSIP endpoint/auth/aor sections that use the WebPhone `[mytel-webrtc]`
  endpoint template (nothing else — your trunks, normal extensions,
  recordings, CDR and queues are untouched),
- the Apache `<Location /Phone>` security-headers snippet, if present.

It never restarts Asterisk: only live-safe `pjsip reload` +
`dialplan reload` (plus a graceful Apache reload) are issued, and every
mutated file is backed up to `/root/mytel-webphone-cleanup-<timestamp>/`
with restore instructions. The script is idempotent — running it again is a
no-op.

Manual steps (equivalent to the script) are documented in
[`docs/CLEANUP.md`](docs/CLEANUP.md).
