# Design Lab final utilities 2.0

Final narrow-utility deep pass for Screenshot Annotator, GIF Maker, Chart Builder, Print Layout, and 3D Model Viewer.

- Screenshot Annotator: xFactor v2 prefs/migration, bounded undo/redo, named PNG, editable annotation JSON sidecar/import.
- GIF Maker: per-board v2 settings, named output, default frame delay, contain/cover fit, background color, genuine GIF89a export.
- Chart Builder: xFactor v2 document persistence/migration, title/output/colors, bar/line/pie, JSON project import/export, CSV and PNG exports.
- Print Layout: per-board v2 document persistence, Letter/A4 portrait/landscape, multi-page text/image layout, editable JSON project import/export, real multi-page PDF export.
- 3D Model Viewer: per-board v2 viewer settings, object URL cleanup, lighting/grid/autorotate/reset controls, real glTF/GLB preview. Uploaded model binaries remain session-only by design.

Dedicated browser acceptance is in `scripts/design-final-utilities-smoke.mjs` and `.github/workflows/design-final-utilities-2-acceptance.yml`.
