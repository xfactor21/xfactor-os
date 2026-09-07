# Animation 2.0

Animation 2.0 deepens the existing real keyframe/FK/GIF engine rather than replacing it.

Implemented in this pass:
- exact duration and work-area in/out controls
- playback constrained to the work area
- per-object rename, visibility, lock, duplicate and layer order
- draggable combined keyframes for retiming
- expanded per-property tracks
- key-all, copy/paste/clear-frame keyframe workflow
- stage zoom controls
- keyboard workflow for playback, scrubbing, undo/redo, duplicate, key-all and delete
- persistent object lock state and backward-compatible document normalization
- real JSON document export
- GIF and sprite-sheet export now honor the work area
- dedicated browser acceptance workflow

Deliberately still outside this editor's current claim: inverse kinematics, mesh deformation, particle/physics simulation, audio-waveform synchronization, nested reusable animated symbols, and MP4/WebM/Lottie export.
