# GAUNTLET — Infantry GPU Animation Lab

**Overall: HOLD for final art acceptance. The GPU laboratory is implemented.**

The original Tripo soldier has been processed in local Blender 5.2, rigged,
animated and exported. The isolated `?lab=infantry` route runs 1/20/100/200
genuinely animated instances with individual states/phases and no per-actor CPU
skeleton. The main mission and its balance/enemies/mech systems were not changed.

## Gate results

| Gate / phase | Result | Evidence / qualification |
|---|---|---|
| 1 — model audit | PASS | Original SHA, axes, dimensions, UV/maps, 157 components and topology diagnostics in [audit](model-audit.md) / [metrics](model-metrics.json) |
| 2 — rigging | PARTIAL | Working blend, 14-bone GLB, rigid armor/weapon, narrow joint weights; limited shoulder ranges and carried-arm assembly still require artist approval |
| 3 — animation authoring | HOLD | All seven Blender actions exist; looping Run/Idle/Fire videos; Death settling, fully shouldered aim and state transitions are not final quality |
| 4 — GPU method | PASS in available environment | Baked bone atlas, positions and normals, shared PBR and animated shadow shaders, 200 independent instances; [architecture](architecture.md) |
| 5 — benchmark lab | PASS | Isolated route, 1/20/100/200, states/mixed/phases, presets, shadows, camera, one or ten spatial batches, JSON/CSV; no LOD |
| 6 — performance gauntlet | PARTIAL | Repeatable desktop hardware and separate SwiftShader measurements; [results](performance-results.md). No physical-device or full-mission acceptance |
| 7 — visual review | HOLD | Close/formation/mech scale screenshots and videos exist; [remaining art issues](visual-review.md). Real map readability remains unverified |
| 8 — future battle preparation | PASS for data contract | Requested state fields, shared asset, 50/150 faction identifiers and local shoulder mask; no combat behavior implemented |
| 9 — tests / QA | PARTIAL | GLB byte/rig/atlas/footplant/ownership tests, TypeScript/build, Chrome+Edge and software smoke, existing gameplay smoke; Safari/Firefox/phone and long leak/thermal session unverified |

Automated result: 144 tests passed across 37 files; TypeScript and production
build passed. All three infantry browser smoke configurations passed with zero
runtime errors. The existing gameplay smoke **did not pass**: headless Windows
Chrome did not capture pointer lock. An isolated build of unchanged `919aa20`
failed at the identical assertion and mounted the identical 2746-mesh/578651-
triangle scene inventory. This is a reproduced baseline failure, not a passing
regression claim. See [feature result](browser/game-regression.json) and
[baseline result](browser/game-baseline-regression.json); full logs accompany them.

## Inspect and reproduce

See [commands and mobile procedure](reproduce.md). Open
`http://localhost:3000/?lab=infantry` after running the preview server.
Lab mode does not import App. The static existing Object 316 is only a scale
reference in one inspection camera; it has no gameplay controller or weapon system.

* [Untouched source](../../public/assets/infantry/source.glb)
* [Working Blender file](../../public/assets/infantry/infantry-work.blend)
* [Rigged animated GLB](../../public/assets/infantry/infantry-rigged.glb)
* [Reproducible Blender builder](../../scripts/infantry/build_asset.py)
* [Atlas manifest](../../public/assets/infantry/animation.json)
* [Round-trip import proof](roundtrip-metrics.json)
* [Architecture and alternatives](architecture.md)
* [Visual evidence and limitations](visual-review.md)
* [Measured results](performance-results.md), [raw JSON / CSV](benchmarks/)

1247 triangles/actor; 1458 exported render vertices (1452 source vertices).
Three original 512x512 texture byte streams are preserved. Shared geometry buffers
112458 bytes, atlas 63168 bytes; at 200 actors, matrices 12800 and configuration
3200 bytes. These figures exclude texture decoding/mips, renderer caches, render
targets and total GPU/driver overhead. One batch contributes one visible draw;
floor/grid add two. A shadow pass adds one character draw per visible batch.

## Next stage — Infantry Battlefield 50 Friendly vs 150 Enemy

1. Resolve the art HOLD first: refine Death impact/settling, improve anatomical
   shoulder/elbow segmentation for a shouldered firing pose, add cross-clip blends
   and optional upper-body recoil overlay. Re-render close-ups and moving footplant
   previews. Obtain explicit visual acceptance before treating these as final motions.
2. Run the committed physical-device procedure on weak Android hardware and iOS
   Safari. Collect repeated longer captures, thermal behavior and memory trends.
   **DEVICE QA NOT VERIFIED** remains until that evidence exists.
3. Build the next isolated battlefield using this instance contract, 50 friendly /
   150 enemy markers and shared assets. First establish terrain-height placement,
   visibility and locomotion speeds; choose spatial batches from camera coverage.
4. Only in that later authorized stage add navigation, squads, firing events and
   background combat. Re-profile with the real mech/map/effects and enforce the
   target phone frame budget. The current lab's ~60 desktop FPS is not that budget.

No main push, mission infantry, AI or battlefield behavior is part of this change.
