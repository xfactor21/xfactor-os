# xFactor.OS

**The studio after an explosion — except every piece knows exactly where it belongs.**

xFactor.OS is a local-first controlled-chaos operating workspace for builders, creators, developers, and people whose real work refuses to fit inside a tidy dashboard.

## What 0.3.0 actually contains

The product entry path now includes a persistent spatial Floor, editable Incidents, overlapping Piles, Signal/Hotwire capture and routing, a full Blackbox Incident workbench, bidirectional Incident relations, Tape history, a Black Vault with real IndexedDB-backed local file ingestion/previews plus URL references, JSON workspace backup/restore, the Command Deck, optional Supabase account/sync UI, the inherited 25-tool Design Lab with Vault metadata integration, and the inherited Node/Python/Ruby/PHP/Go Terminal.

See **`BUILD-MATRIX.md`** for the precise BUILT vs VERIFICATION GATE status of every major capability. That file is the source of truth; do not infer completeness merely because a route exists.

## Development

```bash
npm ci
npm run test:release
npm run lint
npm run build
npm run dev
```

Node 22 is the CI target. Production hosting must preserve the COOP/COEP headers in `vercel.json` or `public/_headers` because WebContainer execution requires cross-origin isolation.

## Data model

Workspace metadata is normalized before local persistence, import, or cloud synchronization. Visual Floor coordinates remain presentation metadata, so Riot Mode cannot corrupt Incident content. Local file blobs are kept in IndexedDB (`xfactor-os-assets`) and are deliberately separate from the JSON workspace envelope.

## Cloud sync

Cloud accounts are optional. Without environment variables, xFactor.OS operates fully local-first and the account panel explicitly reports local-only mode.

To enable cloud metadata sync:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Apply `supabase/migrations/20260815_xfactor_workspace.sql` before live testing. Binary Vault file blobs remain local to the device in 0.3.0; links, file metadata, Studio documents, Incidents, Signal, Piles, layouts, and Tape metadata are in the workspace envelope.

## Desktop

Tauri configuration lives in `src-tauri/`. The desktop route shares the same React product and preserves tray Hotwire capture. Public installers still require a successful CI package run plus platform signing/notarization.

## Verification

The source tree passes the repository release smoke suite and syntax transpilation in the current handoff environment. A clean dependency-backed `npm ci → lint → build → browser acceptance` run and Tauri package run remain mandatory before public release because this execution environment cannot fetch the npm dependency tree or compile Rust artifacts.
