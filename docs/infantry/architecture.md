# Infantry GPU animation architecture

Baseline `919aa20`; isolated branch `feat/infantry-gpu-animation-lab`.
`main.tsx` imports either the lab or App. The lab never constructs the mission,
combat AI, enemies, squads, projectiles or game audio. The gameplay camera uses
the existing static Object 316 mesh solely as a scale reference on the test floor.

## Decision

Use Blender-authored animation baked into a **bone quaternion/translation atlas**
and GPU skinning on shared instanced geometry. This is variant B (baked GPU
animation), a compact alternative to storing every vertex in a conventional VAT.
The source GLB has 1247 triangles and 1452 vertices. Export splits six normal-seam
vertices: 1458 render vertices, still 1247 triangles. Three embedded images are
byte-identical to the original. Height .48 game units at 3.75 m/unit is 1.8 m;
glTF up is +Y, forward +Z.

| Criterion | A: procedural vertex animation | B: full position/normal VAT | Selected: baked bone atlas |
|---|---|---|---|
| Motion quality | Can be good, but authoring and joint logic must be duplicated in GLSL | Exact sampled Blender surface, linear interpolation can shrink rotating plates | Blender rigid transforms, normalized quaternion interpolation preserves plate rotation |
| Animation memory, 282 samples | Small analytic parameters | 4,933,872 bytes packed half-float position+normal (RGBA padding can increase this) | 63,168 bytes; 14 bones, 28 x 282 RGBA16F texels |
| WebGL/mobile | Math and attributes only; shader complexity grows | Vertex texture sampling, larger transfers/storage | WebGL2 vertex texture sampling, small atlas; actual phone still unverified |
| Draw calls | One per visible batch/pass/material | Same | Same; one PBR material, matching depth/distance shader |
| Maintenance | Independent shader animation system, harder art iteration | Blender rebake, heavier asset | Blender rebake; deformation restricted to rigid transforms and narrow blended joints |
| 200 independent actors | Phase/state attributes | Phase/state attributes | Clip, phase, playback rate and faction attributes per instance |

This choice preserves authored motion instead of selecting the shortest shader.
No per-actor SkinnedMesh, AnimationMixer, React component or CPU bone update.
GLTFLoader retains one prototype skeleton for asset metadata, outside the scene.

## Pipeline and resources

`audit_model.py` imports and measures the original; `build_asset.py` normalizes
axes/scale, creates 14 bones and weights, authors seven actions, exports the GLB
and samples rigid deformation transforms. `render_previews.py` creates actual
Blender images/video. `verify_roundtrip.py` reimports the exported GLB.

Armor cores, helmet, backpack and rifle have rigid weights; only narrow leg-joint
regions blend two influences. The rifle is one rigid transform and arms preserve
the existing two-handed carry pose. This deliberately limits independent arm
motion. No topology or UV replacement is used.

The atlas stores quaternion xyzw then translation xyz/padding per bone per frame.
GLSL samples two adjacent frames with `texelFetch`, sign-corrects and normalizes
quaternion interpolation, then transforms positions and normals with the same
rotation. PBR base-color, normal and metal/roughness maps remain active. A small
procedural shoulder mask adds muted blue-gray or red-orange identification;
it does not globally recolor the original armor or visor.

RGBA16F **sampling** is core in WebGL2; rendering into a floating-point target is
not required. Nearest filtering plus explicit interpolation avoids a dependency
on float-linear extensions. Runtime checks vertex texture units and atlas size;
shader/pixel smoke tests verify actual sampling on available drivers. Optional
disjoint timer queries return null where unavailable. There is no WebGL1 fallback
(the current Three.js renderer also requires WebGL2). No claim is made about every
mobile browser. See [OpenGL ES 3 reference](https://www.khronos.org/files/opengles3-quick-reference-card.pdf).

One population generation owns one cloned vertex/index buffer set, one atlas,
one visible material and matching depth/distance materials. Ten thin geometry
wrappers share that buffer set, each with its own configuration and matrix buffer.
Generations must not share BufferAttribute objects: disposing an old generation
otherwise deletes buffers referenced by the new VAOs. This bug was reproduced
and fixed; smoke tests now require visible original visor pixels as well as
counters. Source textures are disposed only when their loaded owner unmounts.
See [Three.js disposal](https://threejs.org/manual/pages/how-to-dispose-of-objects.html).

Static matrix writes happen on configuration creation; default per-frame update
is one shared time uniform. An explicit comparison option uploads every matrix
each frame. Spatial batches use Morton ordering and conservative animated bounds;
one batch cannot cull individual actors. `alive=false` removes actors before
batch construction. Bounds cover all seven clips and the optional 60-second root
travel inspection lane. Zero surviving actors is supported.

Walk/run are in-place clips with recorded movementSpeed in game units/second.
Root-travel mode adds matching GPU translation; for a single actor the camera
tracks this travel. Benchmarks explicitly disable root travel to keep the same
visible population. The 60-second reset is a preview convenience, not navigation.

## Integration and future battle contract

`types.ts` defines the requested id/faction/squadId/position/heading/animation/
animationPhase/movementSpeed/alive contract. 200 actors use 50 friendly and 150
enemy identifiers. One shared asset is sufficient. Runtime compact attributes
are clip index, phase, playback speed, faction; matrices supply transforms.

The lab reuses `withGraphicsPreset`/`resolveGraphicsRuntime`, `frameProfiler` and
`analyzeSceneComplexity`. It records actual renderer calls/triangles, frame
percentiles, JS update time, optional asynchronous GPU queries and owned resource
bytes. Byte accounting is an estimate of owned buffers, not total process VRAM.
GPU query results arrive later than the originating frame. Only fresh results
are included; they cannot be correlated to a specific rAF sample.

No LOD is included: geometry is already 1247 triangles. Cross-clip blends and
additive upper-body fire are not implemented. Hard switches can pop visually;
they are included in transition captures. The final art gate remains open.
