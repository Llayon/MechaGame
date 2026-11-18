# Rigify authoring and same-phase comparison

Open `http://127.0.0.1:3000/?demo=infantry`. The default is **Rigify standard**.
In the wardrobe choose **РИГ ДЛЯ СРАВНЕНИЯ**, then **ПРОСМОТР ДВИЖЕНИЯ**.
Select Run/Walk/Idle, enable **Пауза**, and scrub **Фаза цикла**. Switching rigs
retains the same phase, character position, camera, skin and LOD. Choose
**Игровое управление** to resume WASD movement.

This is ready for artist comparison; it is **not final animation art approval**.
No candidate GPU atlas is baked yet. The original Tripo crowd lab is unchanged.

## The three choices

| Choice | Authoring | Export joints | What differs |
|---|---|---:|---|
| Rigify standard | Actual generated Rigify | 18 | Standard Rigify limb deformation, without additional axial-twist correction |
| Rigify preserved twist | Same generated Rigify | 18 | Editable first-tweak Y rotation restores the original limb axial twist |
| Previous rig | Retained Mixamo retarget | 14 | Original compact rig, retained as the reference |

Axial twist means rotation **around a limb's long axis**, rather than raising
the arm or bending the knee. Standard Rigify's first limb tweak follows the
limb direction and derives its roll from the parent. It can therefore produce
a different axial rotation from the incoming FK motion. This difference is
not automatically an error: both versions are provided for visual judgment.
No Rigify addon source or generated constraints are rewritten in either version.

The standard and preserved-twist versions have identical bind poses, weighting,
geometry, materials, clip durations and locomotion speeds. Only the extra first
tweak rotation differs. The previous rig is the unchanged baseline; new glove
weights follow the previous forearm deformation until a wrist is deliberately
edited. The numerical comparison is therefore useful in addition to screenshots.

## Actual Blender deliverables

* Standard: [`infantry-rigify.blend`](../../../../public/assets/infantry-candidate/rigify-demo/infantry-rigify.blend).
* Preserved twist: [`infantry-rigify.blend`](../../../../public/assets/infantry-candidate/rigify-twist-demo/infantry-rigify.blend).
* Each directory also contains three exported playable GLBs and its manifest.
* Each blend contains the fitted metarig, generated controls, all three LODs
  bound to the Rigify DEF bones, packed textures, seven editable control actions,
  and the separate `QA_IK_PlantedFeet` study. LOD0 is visible by default.
* The donor/previous armature is removed. Playback does not depend on a hidden
  source skeleton or external animation file.

Blender **5.2.0 LTS**, its installed **Rigify 0.6.10**: 19 metarig bones,
146 generated bones, 17 DEF bones. The metarig uses standard `limbs.arm` and
`limbs.leg` components plus `basic.super_copy` torso/head controls, fitted to
this armored model. This is a modular humanoid, not the unmodified full Human
template with face and finger rigs. The rigid chest shell has deliberately
simple pelvis/chest/head controls. There is no benefit in bending that shell
with a long flexible spine.

Hands and toes are explicit joints. Gloves have separate hand weights; boots
retain rigid foot weights, with toe controls reserved until a suitable boot
hinge is authored. Limb segments and B-Bone segments are both **1**. Existing
shoulder-plate/backpack/armor weights are preserved; no automatic heat weighting
was applied. Narrow existing joint blends and the new wrist blend remain
normalized with at most two influences. Source art, faces and all three maps
per LOD are preserved, checked against the static LODs by SHA-256.

The game skeleton contains only root + 17 DEF transforms. It has no Rigify
MCH/ORG/control bones, widgets, constraints or per-character rig generation.
LOD triangle counts remain **3999 / 1999 / 999**. Current playback still uses
one active AnimationMixer for the controlled hero.

For editing, enable Blender's installed Rigify addon. The generated
`Infantry_Controls_ui.py` is saved inside each blend; allowing this local
generated script supplies Rigify's snapping panels. Select the rig in Pose Mode.
Actions `Rigify_idle`, `Rigify_walk`, `Rigify_run`, etc. are editable control
curves. Imported locomotion is FK; use the generated IK/FK snap controls before
switching modes. Keep the metarig for regeneration. Regenerating alone does not
replay our retarget step: use the builder for a reproducible fresh result.
See the [official Rigify workflow](https://docs.blender.org/manual/en/latest/addons/rigify/basics.html).

## Evidence and limits

* [Standard metrics](standard/rig-metrics.json), [standard verification](standard/verification.json).
* [Preserved-twist metrics](preserved-twist/rig-metrics.json), [verification](preserved-twist/verification.json).
* [Chrome comparison](browser-chrome.json), [Edge comparison](browser-edge.json).
* [Comparison video](rigify-comparison.mp4): standard, preserved twist, then
  previous rig; same Run timing and camera. 15-fps capture is not a performance measurement.
* [Standard same-phase screenshot](images/rigify-run-phase020.png),
  [preserved twist](images/rigifyTwist-run-phase020.png), [previous rig](images/mixamo-run-phase020.png).
* [Actual skeleton diagnostic](standard/images/skeleton-rest.png).
  The translucent body is an inspection render, not a replacement game model.
* [Blender standard Run](standard/images/run-4.png), [preserved twist Run](preserved-twist/images/run-4.png).

The verification reimports every GLB in Blender and independently evaluates its
actual glTF joint TRS and inverse bind matrices against the authoring rig at
every sampled frame of all seven clips. Maximum matrix-component difference is
below **0.000033**. This is numerical export fidelity, not an angular
quality score. All three PBR maps per LOD remain byte-identical to the static LOD.
The IK planted-foot study holds ankles within **0.051 mm** physical distance in
the tested pelvis movement. Standard soft IK still compresses leg segments by
up to **2.02%** in that separate study even with the Stretch slider at zero;
we retain and report this stock behavior. The seven playback clips use FK.
These measurements do not certify every locomotion contact or eliminate all
pre-existing sliding/proportion limitations.

**Idle/Walk/Run** retain the verified Mixamo source documented in
[Mixamo provenance](../mixamo/README.md). **Crouch/CrouchWalk/Jump/Kneel** now use
[four user-provided Mixamo FBXs](../../motion-library/README.md). No active
prototype clips remain. Imported source action intervals are respected and
exported strips start at zero, preserving complete loops and comparable phases.

Browser QA covers all 63 rig/LOD/state combinations, finite deformed positions,
same-phase comparison, pause/play, and repeated replacement with all LODs warmed
before comparing resource counters. Existing movement, outfit, LOD, graphics
and mobile-layout tests also apply. **DEVICE QA NOT VERIFIED**: no physical phone
test and no new 200-character hardware performance claim. GPU baking follows
the artist's choice of variant; do not bake all 146 authoring bones.

## Reproduce

From the repository root in PowerShell:

```powershell
$blenderExe = 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe'
node scripts/infantry/fetch_mixamo_source.mjs
& $blenderExe --background --factory-startup --threads 1 --python-exit-code 1 --python scripts/infantry/build_rigify_candidate.py
& $blenderExe --background --factory-startup --threads 1 --python-exit-code 1 --python scripts/infantry/build_rigify_candidate.py -- --restore-twist
& $blenderExe --background --factory-startup --threads 1 --python-exit-code 1 --python scripts/infantry/verify_rigify_candidate.py
& $blenderExe --background --factory-startup --threads 1 --python-exit-code 1 --python scripts/infantry/verify_rigify_candidate.py -- --restore-twist
& $blenderExe --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/infantry/review_rigify_candidate.py
& $blenderExe --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/infantry/review_rigify_candidate.py -- --restore-twist
npm run lint
bun test
npm run build
node scripts/infantry/rigify_smoke.mjs --video
node scripts/infantry/rigify_smoke.mjs --edge
node scripts/infantry/demo_smoke.mjs
node scripts/infantry/demo_mobile_smoke.mjs
```

Run browser scripts sequentially. Existing detached Vite preview on port 3000
serves `dist`; the helper starts an owned preview if one is absent.
