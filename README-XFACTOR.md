> **Current engineering milestone:** xFactor.OS **0.8.2** — Controlled Chaos core + startup/spatial desktop quality candidate.

# xFactor.OS — Controlled Chaos System

> **The studio after an explosion — except every piece knows exactly where it belongs.**

xFactor.OS is the deliberately physical, damaged, loud counterpart to xOS. It reuses proven engines where that saves real work, but it does not inherit xOS's galaxy/brain visual language.

## 0.8.2 test-candidate product surfaces

- **The Floor** — spatial draggable Incident workspace with Riot/Stack and Saved Damage layouts.
- **Incidents + Blackbox** — editable project workbench with status, priority, heat, description, next move, tags, tasks, relations and Tape.
- **Piles** — overlapping, collapsible collections without forced hierarchy.
- **Signal + Hotwire** — rapid sparks/tasks/notes/links with routing and lifecycle controls.
- **Black Vault** — local files, URLs, references and Design Lab documents tied to Incidents.
- **Tape** — append-only activity ledger.
- **Command Deck** — keyboard control, entity search and deterministic natural command grammar.
- **Design Lab** — inherited 25-tool creative suite integrated at the xFactor product boundary and mirrored into Vault metadata.
- **Terminal** — inherited multi-runtime Node/Python/Ruby/PHP/Go surface.
- **Spatial Organizer** — global Normal/Plasma/Matter system with visible liquid/material bodies, movable surfaces, semantic Plasma bundles, and durable organization back in Normal mode.
- **Project Cockpit** — CodeMirror editor, real-folder binding, Explorer, preview, Terminal, Problems, Git, Search, resizable panes, and view presets.
- **Files / Browser / Settings** — scoped desktop file explorer, bounded research/capture browser, and device-local readability/spatial/workbench settings.
- **Account / cloud mirror** — optional Supabase metadata sync while preserving local-first operation.
- **Backup / restore** — normalized workspace metadata export/import.
- **fabriX Suite** — first-class Hub connection/health surface, live product registry + capability-ranked launcher, authenticated project/artifact handoff, Shatter Explorer send actions, Workbench publishing, deep links to Hub workflows/assets, and native self-registration so Hub can discover/launch xFactor.OS. xFactor.OS remains a distinct licensed product.

## Truthful completeness

Read `BUILD-MATRIX.md`. It explicitly distinguishes **BUILT** from **BUILT / VERIFICATION GATE** and lists what is deliberately not claimed. The 0.8.2 source scope preserves the verified 0.7 core and adds the fabriX adapter/surfaces. Browser/runtime and Windows packaging gates must be green on the exact 0.8.2 head. The previously shipped native integration is owner-confirmed end-to-end on Windows with the RC6-era Protocol 1.2 pairing: registration, suite-product launch, project publishing, artifact handoff, and reciprocal Hub → xFactor.OS launch all worked. This candidate does not change that client contract. Public distribution still requires live credential-backed cloud acceptance if cloud sync is enabled, Windows signing, and real-machine installer acceptance.


## 0.8.2 quality delta
- Branded boot shell is present before React loads, eliminating the ambiguous black startup gap.
- Noncritical analytics/PWA/enhancement work is staged after first paint or idle.
- Studio, Workbench, Browser, Files, Settings and fabriX room UI are lazy-loaded.
- Normal-mode WebGL prewarming waits for idle; entering Plasma/Matter still mounts immediately.
- Plasma↔Matter changes recast directly instead of bouncing through Normal.
- Recast masking is shorter/lighter and keeps content/canvas visible.

This candidate requires exact-head CI and owner Windows interaction acceptance before merge.
