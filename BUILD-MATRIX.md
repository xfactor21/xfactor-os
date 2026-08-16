# xFactor.OS — Truthful Build Matrix

Version: **0.3.0**

This matrix exists so “routed,” “implemented,” “runtime-verified,” and “distribution-ready” are not conflated. `BUILT` means real source implementation exists in the production entry path. `VERIFIED` means the relevant behavior has passed dependency-backed CI and/or real browser/desktop execution. `DEPLOYMENT GATE` means signing, live cloud, or physical-device acceptance remains outside the engineering build.

| Capability | Status | What is actually built / verified |
|---|---|---|
| The Floor | **BUILT + VERIFIED** | Persistent draggable Incident shards, multi-select, positioning, status/priority/heat display, empty-state onboarding. Main shell, first-run, Incident creation and reload persistence pass Chromium acceptance. |
| Riot Mode | **BUILT** | Randomizes presentation coordinates/rotation only; canonical Incident data is untouched. Covered by release checks. |
| Stack It | **BUILT** | Deterministic layout restoration independent of canonical content. Covered by release checks. |
| Saved Damage | **BUILT** | Save, restore, and delete named layout snapshots. |
| Incidents | **BUILT + VERIFIED** | Editable name, type, tagline, description, next move, status, priority, heat, tags, archive, permanent delete; creation and persistence pass browser acceptance. |
| Piles | **BUILT** | Multi-Incident pile creation, overlapping membership, collapse/explode, rename, remove membership, delete pile. |
| Signal | **BUILT + VERIFIED** | Sparks/tasks/notes/links, edit, route/unroute, type conversion, pin, complete, delete, search; Hotwire task capture passes browser acceptance. |
| Hotwire | **BUILT + VERIFIED** | One-line capture with task/note/link/spark modes and selected-Incident routing; real browser capture passes. |
| Blackbox | **BUILT** | Incident workbench with editable metadata, derived task counts, next move, quick task capture, relations, recent Tape. |
| Incident relations | **BUILT** | Bidirectional related-Incident links with integrity cleanup when an Incident is removed. |
| Tape | **BUILT + VERIFIED** | Dedicated append-only activity ledger plus per-Incident recent activity; Tape opens in browser acceptance. |
| Black Vault references | **BUILT** | URL/reference records, project association, favorites, archive/restore, delete, search. |
| Black Vault files | **BUILT + VERIFIED** | File picker, IndexedDB binary persistence, image/audio/video previews, download, metadata linkage. CI ingests a real file and verifies the blob plus metadata survive reload. |
| Workspace backup/restore | **BUILT** | Branded JSON export/import with schema normalization before acceptance; release suite validates round-trip behavior. |
| Command Deck | **BUILT + VERIFIED** | Keyboard palette, entity search, navigation/actions, deterministic natural grammar; browser acceptance verifies real navigation. |
| Global search | **BUILT** | Incident, Signal, and Asset search inside Command Deck; per-surface search in Signal and Vault. |
| Design Lab | **BUILT / ROUTES VERIFIED** | All **25/25** declared modes have concrete production routes. Real Chromium acceptance opens the Design Lab shell. Individual edit/import/export click-through for all 25 tools is not yet claimed. |
| Design Lab → Vault | **BUILT** | New/renamed/deleted board metadata emits xFactor events and creates/updates/removes `studio://` Vault records. Existing boards are discovered on startup. |
| Terminal | **BUILT + VERIFIED** | Mounted production Terminal surface. Chromium acceptance successfully boots **Python, Ruby, PHP, Go, and Node.js/WebContainers**. |
| Cross-origin isolation | **VERIFIED** | Production Vite preview returns the required COOP/COEP behavior and `crossOriginIsolated === true` in Chromium. |
| Local persistence | **BUILT + VERIFIED** | Schema-normalized localStorage workspace plus IndexedDB blobs; Incident metadata and Vault binary persistence survive reload in browser acceptance. |
| Cloud account UI | **BUILT / DEPLOYMENT GATE** | Optional email/password or magic-link account panel. Local-first remains available with no cloud configuration. Live Supabase acceptance/RLS remains required before advertising cloud sync. |
| Cloud metadata sync | **BUILT / DEPLOYMENT GATE** | Owner-scoped Supabase workspace mirror with slow-pull overwrite protection and nonfatal offline behavior. Vault binary blobs intentionally remain device-local. |
| Desktop/Tauri | **BUILT + PACKAGE VERIFIED** | Tauri identity, tray Hotwire capture, file support, icons and capabilities. Clean GitHub Actions packaging passes on **Windows, macOS, and Linux**, with artifacts produced for each. Physical install/signing remains a deployment gate. |
| First-run experience | **BUILT + VERIFIED** | Empty Floor CTA, Hotwire and Command Deck discovery, no fake seeded projects; browser acceptance passes. |
| Error containment | **BUILT** | Root ErrorBoundary, visible persistence/sync warnings, normalized payloads and graceful account errors. |
| Clean dependency install | **VERIFIED** | Node 22 `npm ci` passes from clean GitHub checkout. |
| Dependency security audit | **VERIFIED** | Production and full npm audit both report **0 vulnerabilities** in release CI. |
| TypeScript/Vite production build | **VERIFIED** | `tsc -b && vite build` passes in clean release CI. |
| Release smoke suite | **VERIFIED** | **64/64** release checks pass. |

## Deliberately not claimed

- xFactor.OS does **not** claim collaborative simultaneous editing.
- Vault file blobs are **not** cloud-synced in 0.3.0; metadata is.
- The inherited 3D tool is a GLB/glTF **viewer**, not a full 3D modeling/character-rigging suite.
- AI semantic routing is not advertised as implemented; Command Deck parsing is deterministic and local.
- Live Supabase RLS/two-session behavior is not claimed verified until a production cloud target is configured and exercised.
- All 25 Design Lab modes are routed, but exhaustive edit/import/export QA for every tool is not claimed.
- Generated desktop packages are engineering artifacts; signed/notarized public distribution and physical installation smoke remain deployment tasks.

## Current release posture

**READY as a verified 0.3.0 engineering release candidate.** Public distribution should wait for the signing/notarization and physical installer smoke appropriate to the intended platform, plus live cloud acceptance only if cloud sync is enabled for users.
