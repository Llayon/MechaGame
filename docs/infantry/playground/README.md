# Infantry wardrobe / free-roam playground

Open **`?demo=infantry`**, e.g. `http://localhost:3000/?demo=infantry`.
The benchmark lab also links to the playground. The main mission is not mounted.

## Play

* WASD / arrows: camera-relative running, 3.2 m/s; Shift: 4.5 m/s sprint.
* Alt: walking, 1.35 m/s. C: toggle crouch; crouch movement is .8 m/s.
* Space: jump. R: return to the start without changing the selected outfit.
* Mouse drag / one-finger drag on the scene: orbit; wheel / pinch: zoom.
* Q/E or 1–5: select an outfit. The wardrobe has all five buttons and a front-view action.
* Mobile layout: left joystick, right jump/crouch buttons, wardrobe toggle.
* Choose 3999 / 1999 / 999 triangles, graphics preset, shadows and normal mapping.
  The default is the requested 999-triangle model.

Five palettes: original olive, urban blue-gray, arctic, desert and assault.
These are material variations on the same original candidate geometry. A shared
shader adjusts armor and orange identification accents while retaining dark
undersuit/visor details, the base texture's painted structure, roughness, metalness
and baked normals. No separate GLB per palette and no paid service is used.

## Assets and animation

`scripts/infantry/rig_candidate_demo.py` really runs in Blender and produces
`public/assets/infantry-candidate/demo/`: three skinned GLBs, a working blend and
a manifest. There are 14 bones and six clips: idle, walk, run, crouch, crouchWalk,
jump. Shoulder plates/backpack stay on the torso; armor cores use rigid weights,
with narrow two-influence joint seams. Coincident seam vertices get identical weights.
Leg IK targets remain reachable; stance displacement matches each authored speed.
Arm swing is authored for the free-handed candidate, not borrowed from the Tripo
rifle-carry pose. The jump clip changes the pose; the controller supplies gravity
and actual vertical movement. Running still needs final artist review for combat use.

This mode controls **one hero with one active AnimationMixer**. Three fixed LOD
prototypes are preloaded, but hidden LOD mixers do not update. LOD changes carry
clip phase and retain world position/camera; the new LOD starts immediately at that
pose rather than fading from the A-pose. Locomotion changes within one LOD crossfade.
Three's standard skinning handles positions, normals, tangents and shadow passes.
This is not a new 200-character CPU animation system. The existing crowd GPU lab
continues to use its original Tripo asset and bone atlas.

The controller uses bounded acceleration, speed-normalized diagonal movement,
axis sliding against crate bounds, finite frame-delta limits, gravity and platform
landing. It is a small deterministic playground controller, not navigation or AI.
The camera uses OrbitControls; pointer lock is not required. Input is cleared on
blur/visibility changes. The graphics presets reuse the existing game resolver,
without saving changes into the main game's settings.

## Evidence / checks

[Browser report](browser-smoke.json) verifies movement, sprint, walking, real jump
height/landing, crouch movement, five palettes with actual pixel differences,
all LODs, unchanged position and settled resource counters. No console errors.
[Touch report](mobile-smoke.json) verifies an emulated 390x844 viewport, real CDP
touch input on the joystick, release and the palette menu. **Physical mobile QA
is not verified**; an emulated viewport is not a phone performance measurement.

[Preview video](demo-running.mp4) is a 15-fps screen capture of actual keyboard
movement and outfit changes, not an FPS benchmark.
[Front outfit view](images/demo-final.png), [running](images/demo-run.png),
[arctic](images/skin-arctic.png), [mobile](images/demo-mobile.png).
[Blender Run pose](images/run-4.png), [Crouch pose](images/crouch-0.png).

Automated tests read the real GLBs and verify maps remain byte-identical to each
source LOD, expected faces/bones/clips, finite weights/normals/tangents and closed
loop endpoints. Controller tests cover diagonal speed, collisions, limits, jump
landing, crouch state selection and invalid delta handling.

```powershell
& 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/infantry/rig_candidate_demo.py
& 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/infantry/review_demo_rig.py
npm run lint
bun test
npm run build
node scripts/infantry/demo_smoke.mjs
node scripts/infantry/demo_mobile_smoke.mjs
node scripts/infantry/demo_video.mjs
npm run preview -- --host 0.0.0.0 --port 3000
```

No mission infantry, squads, gunfire, combat AI or balance changes were added.
Physical-device performance and final animation art acceptance remain separate
from this playable wardrobe demo.
