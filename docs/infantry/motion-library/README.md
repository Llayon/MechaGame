# User Mixamo motion library

The latest audited snapshot of `D:\Programms\Max\Assets` contains **131 FBXs**,
with **122 distinct sets of skeletal key times/values** and nine duplicate
motion groups. Full file hashes differ because file metadata can differ.
See [catalog.json](catalog.json) for filenames, hashes, durations, bone counts,
stack names and duplicate groups. This is a dated snapshot; downloads can
continue after it was recorded. The original files were not edited.

The audited files use 65-bone `mixamorig` skeletons with a `mixamo.com` animation
stack. A base-pose character file is included in the catalog; a two-frame pose
is not treated as a useful locomotion clip. Catalog presence is not visual
approval or proof that every downloaded clip has been retargeted.

## What is connected now

Open **`http://127.0.0.1:3000/?demo=infantry`**, refresh, and choose a movement in
**ПРОСМОТР ДВИЖЕНИЯ**. All three rig variants and all three LODs have these seven
clips. The preview displays the actual source filename. Pause/scrub to compare
the same phase of standard Rigify, preserved-twist Rigify and the 14-joint rig.

| State | Actual source | Use |
|---|---|---|
| Idle / Walk / Run | Existing verified Three.js r187 Mixamo donor | Retained locomotion |
| Crouch | `Idle Crouching.fbx`, frames 1–64 | C toggles this low idle stance |
| CrouchWalk | `Crouch Walking.fbx`, frames 1–36 | Movement while C is active |
| Jump | `Pistol Jump.fbx`, frames 1–19, retimed to 20/30 s | Space in gameplay; skeletal pose preview separately |
| Kneel | `Pistol Kneeling Idle.fbx`, frames 1–115 | Separately named preview; does not replace C |

The four new clips replace the remaining authored prototypes. Runtime manifests
now have an empty `pendingMixamoClips` list. The original hand-authored exports
under `demo/` remain available. **Only these four user files are connected so
far**; the other downloaded actions are cataloged candidates, not active states.
No firing logic, enemies, squads or mission changes were introduced.

The source soldier is still our existing candidate, with the same geometry,
three PBR maps per LOD, 0.48 game-unit height, five palettes and **3999 / 1999 /
999 triangles**. Donor character meshes and textures are discarded. Four
animation-only FBXs are committed under `sources/infantry-motions/`, totaling
**1,716,496 bytes**, instead of copying the downloaded character into each clip.
The complete raw directory is about 1.52 GB; it is not added to the repository
or loaded by the game. The audit's remaining stripped caches stay in `.tools/`.

## Processing and checks

* [Selection and provenance](selection.json): original FBX SHA-256, stripped
  source SHA-256, selected source frames, duration, inferred speed and processing.
* [Original-vs-stripped verification](source-verification.json): each selected
  original imports with two meshes, each stripped file with zero. All 65 rest
  bone matrices and three sampled poses match within approximately **0.0000005**.
  The unmodified originals remain in the user-provided directory.
* Mixamo-to-candidate retarget uses actual joint positions, target bone lengths,
  source knee planes and narrow existing armor weights. Horizontal root travel
  is removed. Crouch-walk authored speed is about **0.30685 units/s**; gameplay
  time-scales it to the controller's actual speed.
* Jump retains articulation and removes positive source root lift above its
  linear hip baseline, in addition to horizontal travel. `stepHero` supplies
  the world-space arc. The 0.6667 s track closely matches the controller's
  approximately 0.673 s ballistic airtime. Pose preview deliberately does not
  add a second vertical trajectory; use Space in gameplay to inspect the jump.
* Source loop endpoints are checked before closing tiny numerical seams. The
  largest seam adjustment is recorded per clip. A gross non-loop is rejected.
* Imported NLA strips are placed at frame zero while preserving their action
  intervals. Otherwise Blender can add an unanimated first frame to legacy
  clips. Tests verify zero start time and matching manifest duration on **every
  sampler**, across all nine exported GLBs.
* [Standard Rigify verification](../playground/rigify/standard/verification.json)
  and [preserved twist](../playground/rigify/preserved-twist/verification.json)
  compare actual glTF deformation transforms against Blender at every baked
  frame of all seven clips. Maximum matrix-component difference is below
  **0.000033**. The control rig still has 146 bones; exports contain 18.
* [Chrome QA](../playground/rigify/browser-chrome.json) and
  [Edge QA](../playground/rigify/browser-edge.json) cover **63 rig/LOD/state
  combinations**, source attribution, finite skinning, pause, same-phase
  comparison and repeated resource replacement after equal LOD warmup.
  Physical bind positions are matched when comparing meshes, since render
  vertex indices can change during glTF round trips.
* TypeScript, production build and **152 unit tests** pass. Existing gameplay
  movement/outfits/LOD/presets and emulated touch controls are smoke-tested.

## Visual evidence and remaining art work

[Motion preview video](mixamo-motions.mp4): standard Rigify, Crouch, CrouchWalk,
Jump pose, then Kneel; 6.4 seconds at 15 capture fps. It is not an FPS benchmark.

* [Crouch in browser](images/rigify-crouch.png), [crouch locomotion](images/rigify-crouchWalk.png),
  [jump pose](images/rigify-jump.png), [kneeling](images/rigify-kneel.png).
* [Blender crouch](images/standard/images/crouch-0.png),
  [Blender crouch walk](images/standard/images/crouchWalk-8.png),
  [Blender jump](images/standard/images/jump-10.png),
  [Blender kneel](images/standard/images/kneel-0.png).
* Matching preserved-twist renders are in `images/preserved-twist/images/`.

Status: **PARTIAL / READY FOR MOTION REVIEW**. Export/import correctness is
verified; final battlefield animation quality is not certified. These source
poses include raised protective hands and pistol/rifle carrying gestures. The
candidate currently has no weapon attached, so a source filename does not mean
a visible gun was added. The deep idle crouch and moving crouch have different
heights; their short runtime crossfade still needs a dedicated transition for
heavy infantry. Weapon grip, close armor contacts and all foot contacts need
the next art pass. At the sampled 40% crouch phase, LOD2's sole reaches about
**0.00202 units / 7.6 mm** below the floor with the shared LOD0 motion; this small
LOD-specific contact difference still needs correction before final approval.
Do not approve the future battle only because these clips
load correctly. **DEVICE QA NOT VERIFIED**; no real-phone or new 200-character
performance result is claimed. Candidate GPU atlas baking is still pending.

The remaining catalog includes firing, reloads, hits, deaths, directional
movement, turns, rolls, prone motion and transitions. Next, audition an armed
locomotion/idle set with a held rifle, choose the preferred Rigify variant,
author the low-stance transitions, then bake the compact deformation skeleton.

## Reproduce

From the repository root, using local Blender:

```powershell
$blenderExe = 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe'
# Optional full inventory: requires the user's raw download directory.
& $blenderExe --background --factory-startup --threads 2 --python-exit-code 1 --python scripts/infantry/audit_motion_library.py
# These selected animation-only sources are already included in the repository.
& $blenderExe --background --factory-startup --threads 1 --python-exit-code 1 --python scripts/infantry/retarget_user_motions.py
& $blenderExe --background --factory-startup --threads 1 --python-exit-code 1 --python scripts/infantry/build_rigify_candidate.py
& $blenderExe --background --factory-startup --threads 1 --python-exit-code 1 --python scripts/infantry/build_rigify_candidate.py -- --restore-twist
& $blenderExe --background --factory-startup --threads 1 --python-exit-code 1 --python scripts/infantry/verify_rigify_candidate.py
& $blenderExe --background --factory-startup --threads 1 --python-exit-code 1 --python scripts/infantry/verify_rigify_candidate.py -- --restore-twist
# Original-vs-stripped comparison additionally requires the four raw FBXs.
& $blenderExe --background --factory-startup --threads 1 --python-exit-code 1 --python scripts/infantry/verify_motion_sources.py
& $blenderExe --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/infantry/review_rigify_candidate.py -- --motions
& $blenderExe --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/infantry/review_rigify_candidate.py -- --motions --restore-twist
npm run lint
bun test
npm run build
node scripts/infantry/rigify_smoke.mjs --library-video
node scripts/infantry/rigify_smoke.mjs --edge
node scripts/infantry/demo_smoke.mjs
node scripts/infantry/demo_mobile_smoke.mjs
```

Run browser scripts sequentially. No paid API or cloud generation is used.
