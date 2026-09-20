# xFactor.OS Release Audit — 0.5.0

## Current verdict

**ENGINEERING RELEASE CANDIDATE VERIFIED / PUBLIC DISTRIBUTION STILL GATED.**

The current 0.5.0 line passes clean dependency installation, release/security checks, TypeScript/Vite production build, real Chromium product/runtime acceptance, consolidated Design Lab regression, cloud-sync freshness/account-isolation contracts, Tauri least-privilege checks, and Windows Tauri packaging.

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
4. **macOS/public multi-platform distribution:** current release work is Windows-focused; signed/notarized macOS distribution is not claimed for 0.5.0.

## Release-manager conclusion

**0.5.0 is a verified engineering release candidate.** The remaining blockers are explicit deployment/owner-backed gates rather than hidden missing core implementation. Public Windows distribution should remain gated until real installer acceptance and signing are complete; cloud sync should remain described as unverified until the credential-backed two-session test passes.
