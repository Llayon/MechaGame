# Refinery window stalls during battle entry

The control is `main` at `e6dfd94`, including the stage 10 horizon changes. The refinery already mounts hidden on capable hardware during battle entry. Its warmup selects merged wall and roof meshes by their corrugated bump texture. The shared interior-window material has no bump texture, so its first visible merged draw on stage 5 requested a cold shader program.

The candidate includes the existing shared window material in the same selection. It submits one actual merged window draw to the renderer with the battle camera and lighting. The existing visibility, quality, picking and material paths still apply.

In a cold drive trace, the first visible refinery window draw took 364.6 ms on main and 2.5 ms in the candidate. The candidate submitted the hidden mesh on stage 3. Its shader completion callback ran 1.62 s before the stage 5 draw. The submitted and drawn mesh IDs, shader program IDs and cache keys matched. The baseline first draw used the same cache key.

## Measurement

Fresh Chrome profiles ran the local production builds on Radeon 780M with AgX, balanced graphics, fixed 0.85 resolution scale, 1100 × 730 viewport and emulated 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. Each route entered battle from the first overview and drove one world unit. The firing route fired once at stage 10. Build order alternated over four pairs on each route. Diagnostic traces were separate from timed runs.

Stage peaks are the longest intervals between completed scene renders ending on that stage, counting intervals wholly after control. The wider peak includes eight frames on stage 16. Click to control is the time from entering battle to the first controllable frame. Render measurements use CPU wall time. [Individual runs](refinery-window-entry.csv)

| Median across eight pairs | Main | Window warmup |
| --- | ---: | ---: |
| Stage 5 peak | 466.5 ms | 94.5 ms |
| Scene render within that frame | 387 ms | 22 ms |
| Worst interval after control | 466.5 ms | 290 ms |
| Click to control | 6,108 ms | 6,092 ms |
| Control to first stage 16 frame | 4,841.5 ms | 4,451.5 ms |

Stage 5 improved by 345–391 ms and the wider peak fell by 135–209 ms in all eight pairs. The candidate completed stage 16 earlier in each pair. External 3D engine activity peaked at 1.8–2.5% across these runs. The candidate's longest post-control interval was on stage 3 every time. In the traced drive it included 106 ms drawing distant infantry formations, 44 ms drawing rifle tracers and 45 ms drawing enemy spotter rings.

Both builds drew the first refinery window on stage 5. All four visible window batches matched in geometry-attribute checksums, transforms, material key, roughness and shadow flags. All four baked world assets matched by SHA-256. With parallel compilation disabled, the candidate used the usual stage 5 draw without a window warmup submission.
