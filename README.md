> **Current engineering milestone:** xFactor.OS **0.8.2** — startup/spatial desktop-quality candidate on the verified 0.8.1 integration line.

# xFactor.OS

**The studio after an explosion — except every piece knows exactly where it belongs.**

xFactor.OS is a local-first controlled-chaos operating workspace for builders, creators, developers, and people whose real work refuses to fit inside a tidy dashboard.

## What the 0.8.2 test candidate contains

The product entry path includes the verified 0.7 controlled-chaos core: persistent spatial Floor, editable Incidents, overlapping Piles, Signal/Hotwire, Blackbox, Tape, Black Vault, backup/restore, Command Deck, optional Supabase metadata sync, the 25-tool Design Lab, multi-runtime Terminal, Spatial Organizer, Project Cockpit/Workbench, scoped Files, bounded Browser, and Settings. **0.8.2 keeps the verified native fabriX client contract unchanged and focuses on desktop quality:** immediate branded boot feedback, post-paint/idle startup staging, lazy heavy rooms, idle-only WebGL prewarm, and direct Plasma↔Matter recast. The existing native bridge remains intact: a stable `planetx.xfactor-os` manifest, loopback Hub health/product registry, Suite Launcher, capability matching, authenticated project/artifact handoff, Shatter Explorer actions, Workbench publishing, and external-native self-registration while preserving xFactor.OS licensing and privilege boundaries.

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

Apply `supabase/migrations/20260815_xfactor_workspace.sql` before live testing. Binary Vault file blobs remain local to the device in 0.8.2; links, file metadata, Studio documents, Incidents, Signal, Piles, layouts, and Tape metadata are in the workspace envelope.

## Desktop

Tauri configuration lives in `src-tauri/`. The desktop route shares the same React product and preserves tray Hotwire capture. Windows EXE/MSI packaging is verified in CI. Public distribution still requires code signing and real-machine install/upgrade/uninstall acceptance.

## Verification

The verified 0.8.1 baseline passed dependency install, release checks, lint/build, real Chromium acceptance, core-product regression, cloud freshness/account-isolation contracts, Tauri permission checks, and Windows Tauri packaging. The 0.8.2 candidate must pass the same exact-head gates before merge. Production Vercel is deployed from current `main`. Live credential-backed two-session Supabase acceptance, code signing, and real-machine installer acceptance remain explicit external gates.
