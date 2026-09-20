# xFactor.OS — Truthful Build Matrix

Version: **0.5.0**

This matrix exists so “routed,” “implemented,” “runtime-verified,” and “distribution-ready” are not conflated. `BUILT` means real source implementation exists in the production entry path. `VERIFIED` means the relevant behavior has passed dependency-backed CI and/or real browser/desktop execution. `DEPLOYMENT GATE` means owner credentials, signing, or physical/real-machine acceptance remains outside the engineering build.

| Capability | Status | What is actually built / verified |
|---|---|---|
| The Floor | **BUILT + VERIFIED** | Persistent draggable Incident shards, multi-select, positioning, deterministic Stack It, presentation-only Riot Mode, Saved Damage, empty-state onboarding, reload persistence, and overlap regression coverage. |
| Incidents / Blackbox | **BUILT + VERIFIED** | Editable Incident metadata, next move, status, priority, heat, tags, archive/delete, relations, task-derived counts, and persistent workbench behavior. |
| Piles | **BUILT + VERIFIED** | Multi-Incident pile creation, overlapping membership, collapse/explode, rename, membership removal, delete-pile-without-delete-members, persistence. |
| Signal / Hotwire | **BUILT + VERIFIED** | Sparks/tasks/notes/links, edit, route/unroute, type conversion, pin, complete, delete, search, selected-Incident routing, persistence. |
| Tape | **BUILT + VERIFIED** | Append-only activity ledger and per-Incident recent activity; reachable in core browser regression. |
| Black Vault references | **BUILT + VERIFIED** | URL/reference records, Incident association, favorites, archive/restore, delete, search. |
| Black Vault files | **BUILT + VERIFIED** | File picker, IndexedDB binary persistence, preview/download, metadata linkage; real file/blob survives browser reload acceptance. |
| Workspace backup/restore | **BUILT + VERIFIED** | Branded JSON export/import with schema normalization; core browser regression verifies restore replaces damaged state correctly. |
| Command Deck / global search | **BUILT + VERIFIED** | Keyboard palette, entity search, navigation/actions, deterministic natural grammar; real browser navigation acceptance. |
| Design Lab | **BUILT + VERIFIED FOR CURRENT MILESTONE** | All **25/25** modes are production-routed and the consolidated 25-mode regression plus accumulated focused acceptance suites passed. This is not a claim of specialist-app parity for every tool. |
| Design Lab → Vault | **BUILT + VERIFIED** | Board create/rename/delete metadata integrates with `studio://` Vault records; regression coverage exists across the current milestone. |
| Terminal | **BUILT + VERIFIED** | Real Chromium acceptance boots **Python, Ruby, PHP, Go, and Node.js/WebContainers**. |
| Cross-origin isolation | **VERIFIED** | Production preview verifies required COOP/COEP behavior and `crossOriginIsolated === true`. |
| Local persistence | **BUILT + VERIFIED** | Schema-normalized localStorage workspace plus IndexedDB blobs; core metadata and Vault binaries survive reload. |
| Cloud account UI | **BUILT / LIVE USER GATE** | Email/password and magic-link account surfaces with explicit local-only fallback. No fake cloud state. |
| Cloud metadata sync | **BUILT + HARDENED / LIVE TWO-SESSION GATE** | Owner-scoped workspace mirror, whole-workspace freshness clock, stale-auth-generation isolation, nonfatal offline behavior, and a merged two-client live acceptance harness. Credential-backed A↔B run remains pending. |
| Analytics ingestion | **BUILT + VERIFIED** | Production `/api/analytics` ingestion was verified with synthetic audit evidence; shared summaries exclude explicitly synthetic/audit rows. |
| Desktop/Tauri security | **BUILT + VERIFIED** | Explicit CSP, COOP/COEP preservation, xFactor.OS desktop identity, least-privilege active capability split, permanent security/permission acceptance. |
| Windows packaging | **BUILT + PACKAGE VERIFIED** | Current version-aware CI builds **0.5.0** NSIS EXE and MSI artifacts successfully on Windows. |
| Windows real install | **DEPLOYMENT GATE** | Physical/real Windows install, launch/restart, tray/native-file behavior, upgrade and uninstall still require explicit acceptance. |
| Version identity | **VERIFIED** | Package metadata, npm lock, Tauri, Cargo, Windows artifact naming, document title, and persistent in-app `xFactor.OS // v0.5.0` badge are guarded by Version Release Acceptance. |
| First-run/tutorial | **BUILT + VERIFIED** | Empty workspace onboarding plus persistent tutorial/relaunch path covered by release/browser acceptance. |
| Error containment | **BUILT + VERIFIED** | Root error boundary, visible persistence/sync warnings, normalized payloads, graceful local-only/account behavior. |
| Clean dependency install/build | **VERIFIED** | Clean Node 22 CI runs `npm ci`, release checks, lint/type/build, and Chromium smoke successfully. |
| Production Vercel | **DEPLOYED + VERIFIED READY** | Production deployment is checked against current release merges; no assumption that preview equals production. |

## Deliberately not claimed

- xFactor.OS does **not** claim collaborative simultaneous editing.
- Vault binary file blobs are **not** cloud-synced in 0.5.0; metadata is.
- The 3D tool is a GLB/glTF viewer, not a full modeling/rigging suite.
- Command Deck parsing is deterministic/local; AI semantic routing is not advertised.
- Live Supabase A↔B behavior is not called verified until the credential-backed two-client workflow passes.
- Design Lab's current milestone is regression-verified, but individual tools are not claimed to equal Photoshop/Figma/After Effects/etc.
- Generated Windows packages remain engineering artifacts until real-machine install acceptance and code signing are complete.

## Current release posture

**0.5.0 is READY as a verified engineering release candidate, not yet as a signed public Windows distribution.** The remaining explicit gates are live-user cloud acceptance (only if cloud sync is enabled), real-machine Windows installer acceptance, and signing/SmartScreen readiness.
