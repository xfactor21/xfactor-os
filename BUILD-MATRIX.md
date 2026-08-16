# xFactor.OS — Truthful Build Matrix

Version: **0.3.0**

This matrix exists to prevent “routed” or “scaffolded” from being mistaken for “finished.” `BUILT` means the feature has real source implementation in the production entry path. `VERIFICATION GATE` means the implementation is present but still requires a dependency-backed browser/desktop acceptance run before public release.

| Capability | Status | What is actually built |
|---|---|---|
| The Floor | **BUILT** | Persistent draggable Incident shards, multi-select, manual positioning, status/priority/heat display, empty-state onboarding. |
| Riot Mode | **BUILT** | Randomizes presentation coordinates/rotation only; canonical Incident data is untouched. |
| Stack It | **BUILT** | Deterministic layout restoration independent of canonical content. |
| Saved Damage | **BUILT** | Save, restore, and delete named layout snapshots. |
| Incidents | **BUILT** | Editable name, type, tagline, long description, next move, status, priority, heat, tags, archive, permanent delete. |
| Piles | **BUILT** | Multi-Incident pile creation, overlapping membership, collapse/explode, rename, remove membership, delete pile. |
| Signal | **BUILT** | Sparks/tasks/notes/links, edit in place, route/unroute to Incidents, type conversion, pin, complete, delete, search. |
| Hotwire | **BUILT** | One-line capture with task/note/link/spark modes and automatic routing to a singular selected Incident. |
| Blackbox | **BUILT** | Full Incident workbench with editable metadata, derived open/done task counts, next move, quick task capture, relations, recent Tape. |
| Incident relations | **BUILT** | Bidirectional related-Incident links with integrity cleanup when an Incident is removed. |
| Tape | **BUILT** | Dedicated append-only activity ledger plus per-Incident recent activity. |
| Black Vault references | **BUILT** | URL/reference records, project association, favorites, archive/restore, delete, search. |
| Black Vault files | **BUILT** | Browser/Tauri file picker, IndexedDB blob persistence, image/audio/video previews, download, metadata linkage. |
| Workspace backup/restore | **BUILT** | Branded JSON export/import with schema normalization before acceptance. |
| Command Deck | **BUILT** | Keyboard palette, entity search, navigation/actions, natural grammar for new project, capture/task/note/link, search, Riot, Stack. |
| Global search | **BUILT** | Incident, Signal, and Asset search inside the Command Deck; per-surface search in Signal and Vault. |
| Design Lab | **BUILT / VERIFICATION GATE** | All 25 declared modes route to concrete implementations inherited from xOS. xFactor board metadata is mirrored into Black Vault and uses a migrated xFactor board index. Runtime behavior still requires browser acceptance testing. |
| Design Lab → Vault | **BUILT** | New/renamed/deleted Design Lab board metadata emits xFactor events and creates/updates/removes `studio://` Vault records. Existing boards are discovered on app startup. |
| Terminal | **BUILT / VERIFICATION GATE** | Existing Node/Python/Ruby/PHP/Go runtime surface is mounted directly. Runtime payloads exist, but each runtime still needs execution testing in a successful production build. |
| Local persistence | **BUILT** | Schema-normalized localStorage workspace plus IndexedDB file blobs; malformed payloads are rejected/normalized. |
| Cloud account UI | **BUILT / VERIFICATION GATE** | Optional email/password or magic-link account panel. Local-first remains available with no cloud configuration. Live Supabase acceptance/RLS test remains required. |
| Cloud metadata sync | **BUILT / VERIFICATION GATE** | Owner-scoped Supabase workspace mirror with slow-pull overwrite protection and nonfatal offline behavior. Vault binary blobs intentionally remain device-local. |
| Desktop route | **BUILT / VERIFICATION GATE** | Tauri identity, tray Hotwire capture, file support, build workflows, icons and capabilities are present. Signed installer build remains unverified here. |
| First-run experience | **BUILT** | Empty Floor CTA, Hotwire and Command Deck discovery, no fake seeded projects. |
| Error containment | **BUILT / VERIFICATION GATE** | Root ErrorBoundary, visible persistence/sync warnings, normalized payloads and graceful account errors. Runtime testing still required. |

## Deliberately not claimed

- xFactor.OS does **not** claim collaborative simultaneous editing.
- Vault file blobs are **not** cloud-synced in 0.3.0; metadata is. This avoids pretending a JSON workspace row is a binary storage service.
- The inherited 3D tool is a real GLB/glTF **viewer**, not a full 3D modeling/character-rigging suite.
- AI semantic routing is not advertised as implemented. The current Command Deck parser is deterministic and local.
- Public desktop/mobile store readiness is not claimed until package signing and store-specific acceptance are completed.
