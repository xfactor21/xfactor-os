# xFactor.OS 0.8.0 — fabriX native integration

## Product boundary

fabriX Hub and xFactor.OS remain separate products.

- **fabriX Hub** owns suite-wide registry, discovery, managed installs, assets, projects, artifacts, connections, workflows and update/install orchestration.
- **xFactor.OS** owns its approved local filesystem workspace, Shatter Explorer, Workbench/IDE, terminal, browser capture, Vault, local execution and high-capability project workflows.

The integration never treats fabriX registration as an xFactor.OS software entitlement.

## Stable product identity

- Product ID: `planetx.xfactor-os`
- Manifest schema: `0.3`
- Adapter: `native:fabrix-adapter-v1`
- Adapter version: `1.0.0`

## Transport

The desktop adapter reads the Hub-published port from `%USERPROFILE%\\Documents\\fabriX\\Registry\\hub-port.txt` and connects only to `127.0.0.1`.
RC3 compatibility uses status, products and open endpoints. A later Hub can publish `Registry/local-api-token.txt`; xFactor.OS then uses authenticated project/artifact RPC. Until those richer write endpoints exist, explicit sends are staged only in fixed canonical fabriX Home inboxes.
The PWA does not attempt local-machine RPC and truthfully reports that the desktop bridge is required.

## 0.8 surfaces

- First-class fabriX Suite room.
- Live Hub health/version and product registry.
- Capability-ranked Suite Launcher.
- Open / Open with current project.
- Quick workflow deep links.
- Current-project publishing.
- Shatter Explorer fragment publishing.
- Workbench project/build-state publishing.

## Security boundary

Loopback-only, redirect-free transport; bounded/validated product IDs; 2 MiB handoff cap; fixed inbox roots; native-only token access; no arbitrary shell/filesystem grant; xFactor.OS remains entitlement authority.

## Current RC3 limitation

The supplied Hub RC3 native host does not yet expose authenticated projects/artifacts/workflow RPC. 0.8 provides real RC3 health/registry/launch integration plus the forward-compatible write path and safe inbox fallback. Full workflow invocation and Hub-to-xFactor launch acknowledgement remain Hub-side integration work.

## Release truth

Implemented, built, runtime-tested, integration-tested, independently verified and deployed are separate states. Do not collapse them.
