# xFactor.OS Release Audit — 0.3.0

## Current verdict

**ENGINEERING RELEASE CANDIDATE VERIFIED.**

The defined 0.3.0 source scope now passes clean dependency installation, security audit, static/release checks, TypeScript/Vite production build, real Chromium runtime acceptance, and Tauri packaging on Windows, macOS, and Linux.

This does **not** mean signed public-store distribution is complete. Code signing/notarization, installer smoke on physical target machines, and live Supabase/RLS acceptance remain separate deployment gates where those capabilities are advertised.

## Completion work performed

### Core operating system
- Expanded Incident records with description, next move, priority, relations, archive state, and safer normalization.
- Blackbox is a real workbench rather than a static summary card.
- Task open/done counts derive from routed Signal tasks.
- Added bidirectional Incident relationships with dangling-relation cleanup.
- Piles support collapse/explode/delete and individual membership removal.
- Saved layout snapshots can be saved, restored, and removed.

### Signal / Hotwire
- Signal records can be edited, retyped, routed/unrouted, pinned, completed, searched, or deleted.
- Command grammar supports typed task/note/link capture and search.

### Black Vault
- Real local file ingestion through a file picker.
- File blobs persist in IndexedDB rather than localStorage JSON.
- Image/audio/video preview, download, favorite, archive/restore, and delete are implemented.
- URL/reference assets remain supported.
- Design Lab board metadata appears as `studio://` Vault assets and follows create/rename/delete events.

### Tape / backup
- Dedicated append-only Tape view.
- Normalized JSON workspace backup and restore from UI and Command Deck.

### Account / sync
- Optional account sheet with email/password, signup, magic link, sign-out, and explicit local-only state when cloud is not configured.
- Cloud sync remains local-first and nonfatal.
- Binary Vault blobs intentionally remain device-local.

## Verified release evidence

### Clean web build and security
GitHub Actions clean runner verification on Node 22 completed successfully:
- `npm ci`: pass.
- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilities**.
- `npm audit --audit-level=high`: **0 vulnerabilities**.
- `npm run test:release`: **64/64 pass**.
- `npm run lint`: **0 errors** (16 non-blocking warnings in inherited/current modules).
- `npm run build`: TypeScript project build + Vite production build **pass**.

### Real Chromium acceptance
The production Vite preview was launched in CI and exercised with Playwright/Chromium. Verified:
- main shell loads;
- production preview reports `crossOriginIsolated === true`;
- first-run workspace is empty;
- Incident creation survives reload;
- Hotwire task capture works;
- Command Deck navigation to Vault works;
- a real Black Vault file is persisted to IndexedDB and survives reload;
- Tape opens;
- Terminal opens;
- Python runtime boots;
- Ruby runtime boots;
- PHP runtime boots;
- Go runtime boots;
- Node.js/WebContainers runtime boots;
- Design Lab opens.

### Design Lab truth boundary
- **25/25 declared Design Lab modes have concrete production routes.**
- The Design Lab shell opens in the real browser acceptance run.
- A full edit/import/export click-through for every one of the 25 tools has **not** been individually automated; this remains a deeper QA pass rather than a source-completeness blocker.

### Desktop/Tauri
An isolated GitHub Actions matrix successfully executed `npm ci`, production dependency audit, Rust/Tauri compilation, packaging, and artifact upload on:
- **Windows** — pass;
- **macOS** — pass;
- **Linux** — pass.

Final 0.3.0 package artifacts were produced for all three platforms. They remain unsigned engineering artifacts until signing/notarization and physical install smoke are completed.

## Remaining deployment gates

1. Code-sign Windows installer and notarize/sign macOS distribution before broad public distribution.
2. Install the generated packages on physical target machines and run tray/file-picker/restart smoke tests.
3. If cloud sync is publicly enabled, run live Supabase sign-up/sign-in, RLS isolation, pull/push, reconnect, and two-session conflict acceptance.
4. If claiming exhaustive Design Lab QA, individually exercise edit/import/export paths for all 25 tools.

## Release-manager conclusion

**0.3.0 is READY as a verified engineering release candidate.** The remaining items are distribution/platform acceptance and optional cloud/deep-tool QA gates, not hidden missing core source features.
