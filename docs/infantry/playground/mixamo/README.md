# Mixamo motion migration

Status: **Idle / Walk / Run replaced with actual Mixamo motion on all three LODs.**
Crouch, CrouchWalk and Jump still use the previous explicitly attributed demo
clips pending user-selected Mixamo FBXs. They are not labelled as Mixamo.

The active playground loads `assets/infantry-candidate/mixamo-demo/`. Previous
hand-authored exports remain separately under `demo/` for comparison. The runtime
inspector reports `animationSource` per state; the desktop HUD says MIXAMO only
for states backed by real source motion, otherwise ДЕМО-КЛИП.

## Provenance

The motion donor is the Xbot GLB from the official Three.js r187 example:
[skeletal additive blending](https://threejs.org/examples/webgl_animation_skinning_additive_blending.html),
which credits Mixamo. Download URL and SHA-256 are recorded in the runtime manifest
and [retarget metrics](retarget-metrics.json).

Source SHA-256:
`002f8d269de68e5dce3d25195caf390d1aa359bbfaae3fcf4c8dc78ec36c3ba5`.
`fetch_mixamo_source.mjs` checks this hash rather than accepting an arbitrary cache.
No downloaded donor character geometry or donor textures are exported or bundled
in the game or working blend. Only its animation and skeleton transforms drive
the original candidate soldier. The character's own three PBR maps remain
byte-identical to the corresponding static LOD; unit tests verify this.

Mixamo content follows its own Adobe terms; it is not relabelled MIT/CC0 just
because the example code belongs to Three.js. Adobe's [Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)
describes use of its animations in games and access with an Adobe ID.

## Actual retarget

Blender samples source actions, removes clip-specific horizontal offsets/root
drift, and maps global bone motion to the existing 14-bone rig. Rest-frame arm
alignment accounts for the source T-pose and candidate A-pose. Imported glTF bone
tails can be display-only, so actual child joints establish limb directions.
The reduced torso follows source chest rotation; target bone lengths and armor
weights remain intact. Two-bone leg IK preserves mapped ankle targets while
handling proportion differences. Vertical support correction uses deformed shoe
vertices; source airborne phases remain airborne. Per-clip locomotion speed is
estimated from low-foot backward stance samples and used by the existing runtime
to match playback to actual character speed.

This is animation data retargeting, not a new sine-wave gait with a Mixamo label.
The exported loop endpoints close and all skin weights/normal/tangent data remain
finite. [Idle pose](images/idle-0.png), [Run pose](images/run-4.png),
[Walk pose](images/walk-7.png).

The original shoulder/backpack rigid weighting limitations still apply. The
single controlled hero uses the existing AnimationMixer and transitions; no crowd
CPU animation or main-mission change is introduced.

## Missing clips / next input

The verified donor contains idle, walk, run and gestures; it does not contain an
actual Jump or CrouchWalk. Downloaded local asset folders contained no matching
Mixamo FBXs. Browser access to Mixamo could not be established because the browser
access host was unavailable. No account/security workaround or substituted clip
is used.

To finish the remaining states, supply the local folder containing the selected
Mixamo **Jump**, **Crouch Idle**, and **Crouch Walk** FBXs. Prefer FBX Binary,
30 fps and no keyframe reduction; locomotion should be in-place. A standard Mixamo
character such as XBot is sufficient: the soldier geometry does not need replacing.
Those files still require actual import, retarget, timing/physics alignment and
visual QA; this report does not claim that work is already done.

## Reproduce available core

```powershell
node scripts/infantry/fetch_mixamo_source.mjs
& 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/infantry/retarget_mixamo_demo.py
& 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/infantry/review_demo_rig.py -- --mixamo
npm run lint
bun test
npm run build
node scripts/infantry/demo_smoke.mjs
```

The playable URL remains `http://127.0.0.1:3000/?demo=infantry`. Refresh the page
after rebuilding the production preview. The existing five palettes and three
LOD switches continue to work. Physical-phone QA remains unverified.
