# xFactor.OS — Build Notes

## Product split
xFactor.OS is intentionally not xOS. xOS owns the universe/brain/galaxy metaphor; xFactor.OS owns physical disorder, backstage artifacts, ripped surfaces, shards, piles, vaults, signal, tape, and controlled vandalism.

## Architecture rule
Visual chaos is presentation metadata. Canonical work remains structured and recoverable.

## Web → desktop
The web application remains the primary implementation target. Existing Tauri infrastructure stays in the project for the later PC packaging pass and native filesystem integration.

## Verification note
This workspace could not install package dependencies, so a complete Vite build was not executable here. Source was written to the existing React/TypeScript structure and dependency-free xFactor-specific modules were kept isolated.
