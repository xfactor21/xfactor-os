> **Current engineering milestone:** xFactor.OS **0.8.2** — native fabriX Suite integration on the verified 0.7 core.

# xFactor.OS Release Audit — 0.8.2

## Current verdict

**0.8.2 TEST CANDIDATE — ENGINEERING VERIFICATION REQUIRED BEFORE MERGE.**

The 0.8.2 line is the verified 0.7 controlled-chaos core plus the native fabriX integration layer. Exact-head gates cover dependency/release/security checks, production build, real Chromium product/runtime acceptance, Design Lab regression, cloud contracts, Tauri permissions/security, native adapter unit tests, and Windows packaging.

Production Vercel is currently deployed from the latest verified `main` line. This does **not** mean signed public Windows distribution is complete.

## Verified product scope

### Core operating environment
- Persistent spatial Floor with deterministic Stack It, presentation-only Riot Mode, Saved Damage layouts, multi-Incident selection, and reload persistence.
- Editable Incidents with Blackbox workbench, priorities, heat/status, next move, relations, archive/delete, and task-derived counts.
- Piles with overlapping membership, rename, collapse/explode, membership removal, and deletion without deleting contained Incidents.
- Signal/Hotwire supports sparks/tasks/notes/links, editing, type conversion, routing, pinning, completion, deletion, and search.
- Tape activity ledger plus normalized workspace backup/restore.
- Black Vault supports URL references and real IndexedDB-backed local binary files with preview/download/favorite/archive/restore/delete.
- Command Deck and global entity search use deterministic local grammar rather than advertised AI routing.

### Design Lab
- The current Design Lab milestone contains **25/25 production modes**.
- A consolidated 25-mode regression plus the accumulated focused acceptance suites have passed on the milestone line.
- Several major editors have deeper dedicated acceptance beyond route existence.
- No claim is made that every tool has feature parity with specialist professional desktop applications.

### Terminal/runtime
Real Chromium acceptance boots the supported Terminal runtime surfaces:
- Python
- Ruby
- PHP
- Go
- Node.js / WebContainers

Production preview also verifies the required cross-origin isolation behavior.

### Cloud/account boundary
- Dedicated xFactor.OS Supabase project exists and is healthy.
- `xfactor_workspaces` exists with owner-scoped RLS.
- Whole-workspace freshness logic prevents newer non-Incident mutations from being overwritten by older cloud state.
- Auth-generation isolation prevents stale pull/push results from a previous user session from hydrating or changing a newer session.
- A repeatable two-client live sync harness is merged.
- **Credential-backed first-user / two-session A↔B acceptance is still not claimed**, because no dedicated test Auth user has been supplied yet.
- Vault binary blobs intentionally remain device-local; workspace metadata is the cloud-sync boundary.

### Analytics / production
- xFactor.OS production analytics ingestion has been verified end-to-end with clearly marked synthetic audit probes.
- Shared product summaries exclude rows explicitly marked synthetic/audit so CI evidence does not inflate user metrics.
- Production Vercel deployment is expected to track the current `main` SHA and must be checked after substantive release merges.

### fabriX integration
- Stable xFactor.OS suite identity: `planetx.xfactor-os`, manifest schema 0.3, adapter v1.
- Desktop adapter uses only the Hub-published `127.0.0.1` port; redirects are disabled and product IDs/payloads are bounded.
- **Owner-confirmed real Windows acceptance:** installed Hub discovery, product registry visibility, and launching suite products from xFactor.OS worked on October 5, 2026.
- Hub RC4 adds authenticated project/artifact RPC, native inbox ingestion, deep-link routing, and external-native registration. xFactor.OS 0.8.2 self-registers through that authenticated bridge so Hub can discover and launch the real desktop executable.
- PWA/browser acceptance verifies the first-class fabriX room and truthful `DESKTOP BRIDGE REQUIRED` state.
- **Owner-confirmed real integration acceptance:** registration, suite-product launch, project publishing, artifact handoff, and reciprocal Hub → xFactor.OS native launch all worked with the RC6-era Protocol 1.2 pairing. 0.8.2 does not change that client contract.
- fabriX registration/discovery never grants xFactor.OS entitlement.

### Desktop / Windows
- Tauri CSP is explicit and compatible with required WASM/blob-worker behavior.
- Reachable desktop identity uses xFactor.OS branding.
- Active Tauri capabilities are least-privilege split; the capture window does not inherit broad main-window privileges.
- Current Windows CI builds versioned EXE/MSI installers successfully.

## Current required gates for release-affecting changes
- focused acceptance for the changed subsystem;
- Core Product Acceptance when core behavior is touched;
- Verify Release Candidate;
- Version Release Acceptance;
- Tauri Permissions / Desktop Security where applicable;
- Windows packaging for release-affecting changes.

## Remaining deployment gates

1. **Live Supabase user acceptance:** create one dedicated Auth test user and run the merged two-client A→B / B→A sync harness.
2. **Windows install acceptance:** install the generated EXE/MSI on a real Windows environment and verify launch, restart/persistence, native file dialog, tray/Hotwire behavior, upgrade, and uninstall.
3. **Code signing / SmartScreen:** sign the Windows release before broad public distribution.
4. **fabriX regression boundary:** the RC6-era Protocol 1.2 pairing is owner-verified end-to-end. Later Hub builds are owned by the fabriX project/agent and require their own regression if they change the client contract; xFactor.OS must not modify Hub source without explicit owner direction.
5. **macOS/public multi-platform distribution:** current release work is Windows-focused; signed/notarized macOS distribution is not claimed for 0.8.2.

## Release-manager conclusion

**0.8.2 is the current engineering release candidate once its exact-head gates are green.** The remaining blockers are explicit deployment/owner-backed gates rather than hidden missing core implementation. Public Windows distribution should remain gated until real installer acceptance and signing are complete; cloud sync should remain described as unverified until the credential-backed two-session test passes.


## 0.8.2 candidate scope
This candidate changes startup scheduling and spatial transition behavior only. It does not modify fabriX Hub code or broaden the xFactor.OS client protocol. Required acceptance: branded first paint instead of black startup, direct Plasma↔Matter transitions without multi-second instability, readable content during recast, repeated mode switching, teardown/re-entry, and Windows packaging.
