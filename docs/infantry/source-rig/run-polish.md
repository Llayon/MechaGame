# Mixamo Run polish

The original retarget raised the entire skeleton whenever the imported boot geometry went through the ground. The per-frame lift peaked at 0.023775 game units (89 mm at the declared scale). It caused two sharp body impulses per 0.7-second stride. The unarmed forearms also snapped to their initial rotations every time the loop wrapped.

The revised clip distributes the support lift over neighboring frames with a circular filter. Blender keeps the root stationary and applies the filtered motion to the pelvis and upper body. A two-link solve keeps both leg segment lengths and the original boot targets at each authored frame. The unarmed Mixamo and Rigify variants blend their forearm rotations toward a shared endpoint over four frames on either side of the seam. V-Pulse's existing two-handed carry closes its own wrist loop.

| 30 Hz key measurements, LOD0 | Before | After |
| --- | ---: | ---: |
| Peak vertical root acceleration (units/s²) | 22.727 | 0.000 |
| Peak vertical pelvis acceleration (units/s²) | 25.510 | 7.242 |
| Maximum unarmed forearm angle at the seam | 5.144° | 0.000° |

The run still uses 22 keys at 30 Hz, including the shared loop endpoint. Across all 12 revised GLBs, embedded texture payloads retained their SHA-256 digests and other clips produced identical bone matrices at their authored keys. Only Run changed in the V-Pulse GPU atlas. Its 3 LODs agreed with the atlas within 0.000653 maximum matrix element error. The left palm remained within 0.0000041 game units of its support socket at the authored keys.

The first polish preserved boot transforms at the authored keys. Later sampling revealed penetration between keys. The floor pass solves the two legs at their original lengths using a smooth vertical ankle correction. The root and pelvis tracks, horizontal ankle positions and 22-key timing were preserved. The top of the playground pad is now at the controller's ground height.

| Bind geometry and playback | Lowest sole point before floor pass | Lowest sole point after floor pass |
| --- | ---: | ---: |
| Unarmed Mixamo, worst of three LODs at 960 Hz | −6.60 mm | +0.37 mm |
| Standard Rigify, worst of three LODs at 960 Hz | −5.44 mm | +0.22 mm |
| Preserved-twist Rigify, worst of three LODs at 960 Hz | −5.44 mm | +0.26 mm |
| Armed GLB, worst of three LODs across 1,025 phases | −5.44 mm | +0.22 mm |
| Armed RGBA16F atlas with shader interpolation, worst of three LODs across 1,025 phases | −4.40 mm | +0.35 mm |
| Armed source, 40 000 triangles at 240 Hz | −4.28 mm | +0.24 mm |

Negative clearance is below the floor. The measurements cover the steady Run loop on a flat surface. They sample the deformed mesh, including phases between keyframes. The atlas stayed at 36 × 428 texels and its other seven clips remained byte-identical. [Armed GLB and atlas report](../../../public/assets/infantry-armed/rig-verification.json).

A separate 960 Hz sweep found the lowest source GLB sole point at +0.22 mm. On that model the largest upward change at any sampled phase was 6.95 mm. Some phases previously within 5 mm of the floor now reach up to 9.1 mm of clearance. The two unarmed Rigify authoring actions use linear Run curves to avoid cubic overshoot between their editable keys. The live deformed mesh in the 40 000-triangle Blender project cleared the floor by at least 0.27 mm at 960 Hz. [Source model sole close-up](run-boot-contact.png).

## Reproduce

To reproduce the floor pass, use the assets from `8faa241` as the input. Pass the already polished Mixamo folder followed by a separate output folder, `--boot-floor`, and one `--support-reference` for each of the standard, preserved-twist and armed LODs plus the armed 40 000 GLB. The three Mixamo meshes in the input folder are included automatically.

```powershell
$blender = 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe'
$work = Join-Path $PWD '.tools/reproduce-run-floor'
New-Item -ItemType Directory -Force $work | Out-Null
git archive --format=zip --output="$work/baseline.zip" 8faa241 public/assets/infantry-candidate public/assets/infantry-armed
Expand-Archive -LiteralPath "$work/baseline.zip" -DestinationPath "$work/baseline" -Force
$assets = "$work/baseline/public/assets"
$references = @()
foreach ($directory in @('infantry-candidate/rigify-demo', 'infantry-candidate/rigify-twist-demo', 'infantry-armed')) {
    foreach ($lod in 0..2) { $references += @('--support-reference', "$assets/$directory/infantry-demo-lod$lod.glb") }
}
$references += @('--support-reference', "$assets/infantry-candidate/high-rig/infantry-high.glb")
& $blender --background --factory-startup --python-exit-code 1 --python scripts/infantry/polish_mixamo_run.py -- "$assets/infantry-candidate/mixamo-demo" "$work/mixamo" --boot-floor @references
```

Point `INFANTRY_MIXAMO_SOURCE` to `$work/mixamo` and rebuild standard and preserved-twist Rigify as below. Point `VPULSE_RIG_SOURCE` to the rebuilt standard rig for the armed bake. Run the armed verifier with `-- --require-run-clearance`, then run `build_high_rig.py` with `VPULSE_RIG_OUT` still pointing to the new armed folder.

### Original retarget pass

Start with the unpolished demo from `b7f84fb`. With Blender 5.2 and Rigify 0.6.10 installed, run these commands from the repository root in PowerShell. The working copies are written under `.tools`.

```powershell
$blender = 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe'
$work = Join-Path $PWD '.tools/reproduce-run'
New-Item -ItemType Directory -Force $work | Out-Null
git archive --format=zip --output="$work/baseline.zip" b7f84fb:public/assets/infantry-candidate/mixamo-demo
Expand-Archive -LiteralPath "$work/baseline.zip" -DestinationPath "$work/baseline" -Force

& $blender --background --factory-startup --python-exit-code 1 --python scripts/infantry/polish_mixamo_run.py -- "$work/baseline" "$work/mixamo"
$env:INFANTRY_MIXAMO_SOURCE = "$work/mixamo"
$env:INFANTRY_RIG_OUT = "$work/standard"
$env:INFANTRY_RIG_DOC = "$work/standard-doc"
& $blender --background --factory-startup --python-exit-code 1 --python scripts/infantry/build_rigify_candidate.py
& $blender --background --factory-startup --python-exit-code 1 --python scripts/infantry/verify_rigify_candidate.py

$env:INFANTRY_RIG_OUT = "$work/twist"
$env:INFANTRY_RIG_DOC = "$work/twist-doc"
& $blender --background --factory-startup --python-exit-code 1 --python scripts/infantry/build_rigify_candidate.py -- --restore-twist
& $blender --background --factory-startup --python-exit-code 1 --python scripts/infantry/verify_rigify_candidate.py -- --restore-twist
```

The V-Pulse bake uses a standard Rigify intermediate with the same lower-body polish and its own upper-body carry. Rebuild its input with `--armed-donor`, then point `VPULSE_RIG_SOURCE` to the resulting Rigify directory. The rifle donor FBXs must be available in the local motion cache or a source folder passed after `--` to `build_armed_rigify.py`.

```powershell
& $blender --background --factory-startup --python-exit-code 1 --python scripts/infantry/polish_mixamo_run.py -- "$work/baseline" "$work/mixamo-rifle" --armed-donor
$env:INFANTRY_MIXAMO_SOURCE = "$work/mixamo-rifle"
$env:INFANTRY_RIG_OUT = "$work/rigify-rifle"
$env:INFANTRY_RIG_DOC = "$work/rigify-rifle-doc"
& $blender --background --factory-startup --python-exit-code 1 --python scripts/infantry/build_rigify_candidate.py

$env:VPULSE_RIG_SOURCE = "$work/rigify-rifle"
$env:VPULSE_RIG_OUT = "$work/armed"
& $blender --background --factory-startup --python-exit-code 1 --python scripts/infantry/build_armed_rigify.py
& $blender --background --factory-startup --python-exit-code 1 --python scripts/infantry/build_armed_verify.py
```
