# Mixamo Run polish

The original retarget raised the entire skeleton whenever the imported boot geometry went through the ground. The per-frame lift peaked at 0.023775 game units (89 mm at the declared scale). It caused two sharp body impulses per 0.7-second stride. The unarmed forearms also snapped to their initial rotations every time the loop wrapped.

The revised clip distributes the support lift over neighboring frames with a circular filter. Blender keeps the root stationary and applies the filtered motion to the pelvis and upper body. A two-link solve keeps both leg segment lengths and the original boot targets at each authored frame. The unarmed Mixamo and Rigify variants blend their forearm rotations toward a shared endpoint over four frames on either side of the seam. V-Pulse's existing two-handed carry closes its own wrist loop.

| 30 Hz key measurements, LOD0 | Before | After |
| --- | ---: | ---: |
| Peak vertical root acceleration (units/s²) | 22.727 | 0.000 |
| Peak vertical pelvis acceleration (units/s²) | 25.510 | 7.242 |
| Maximum unarmed forearm angle at the seam | 5.144° | 0.000° |

The run still uses 22 keys at 30 Hz, including the shared loop endpoint. Across all 12 revised GLBs, embedded texture payloads retained their SHA-256 digests and other clips produced identical bone matrices at their authored keys. Only Run changed in the V-Pulse GPU atlas. Its 3 LODs agreed with the atlas within 0.000653 maximum matrix element error. The left palm remained within 0.0000041 game units of its support socket at the authored keys.

At 120 Hz, the maximum Mixamo LOD0 boot origin difference was 0.001742 units (6.5 mm), with boot transforms matching at the authored keys within the export tolerance. Linear interpolation can still place a boot slightly below the floor between keys. The worst sampled penetration was about 4.9 mm after the change and 4.5 mm before it. Remaining velocity differences at the loop boundary reflect the original mocap and linear playback.

## Reproduce

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
