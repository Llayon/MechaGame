# Hanging vines during streamed battle entry

The control is the pine experiment at `89ba96b`. Both production builds have the same four baked world assets and use AgX. On hardware WebGL with parallel shader compilation, the candidate mounts the vine mesh during battle at foliage level 7 (stream stage 12). Once the instance matrices and tints have been assigned, it submits the real mesh to `compileAsync` with the battle lights and camera. Texture creation and instance initialization also move earlier. The mesh becomes visible at level 9 (stream stage 14), when the wind animation can start. Minimal vegetation skips the mesh entirely.

## Cold battle entry

Each run used a fresh Chrome profile on Radeon 780M (ANGLE D3D11), 1100 × 730, balanced graphics with reduced vegetation, fixed 0.85 resolution scale, and 12 Mbit/s down, 4 Mbit/s up, 35 ms latency. From the first overview the mech entered battle and drove one world unit. The firing route added one shot at stage 10. The primary measure is the longest interval between consecutive completed scene renders over stages 12–16, ending after eight stage 16 frames. The CSV also includes time to control, individual stage peaks, the longest frame after control, and background CPU and 3D utilization. Detailed draw traces and functional checks were collected separately. [Per-run timings](vine-shader-entry.csv)

| Median per build | Pine control | Early vine preparation |
| --- | ---: | ---: |
| Longest frame on stages 12–16, drive (3 pairs) | 551 ms | 464 ms |
| Longest frame on stages 12–16, drive and fire (3 pairs) | 555 ms | 457 ms |
| Longest frame on stages 12–16, both routes | 553 ms | 462 ms |
| First visible vine frame | 553 ms | 350.5 ms |
| Longest frame on preparation stage 12 | 432 ms | 439.5 ms |
| Longest frame after control through the end of capture | 676 ms | 682.5 ms |
| Battle click to first controllable frame | 4,810.5 ms | 4,810.5 ms |

All six pairs reduced the slowest frame on stages 12–16 by 75–115 ms. The peak moved from stage 14 to stage 13 in five runs and to stage 12 in one. The largest frame across the whole capture after control occurred on stage 5 in all twelve runs. Peak external 3D utilization during the measured window remained below 2% in all pairs.

All six candidate runs submitted the mesh at stage 12 and completed compilation 817–920 ms before the first visible vine draw on stage 14. In the separate diagnostic drive the control spent 191 ms on its first vine draw and 177 ms on the subsequent program variant with instance colors. The candidate's first draw used the exact program ID prepared while hidden and took 9.4 ms.

The control, candidate, full-vegetation candidate, and extension-disabled candidate produced identical post-reveal snapshots for all 51 instances, including transforms, tints, sway phases, geometry, UVs, texture pixels, alpha cutoff and sidedness. The full-vegetation run advanced the wind uniform after reveal. With parallel compilation disabled, vines appeared at stage 14 using the ordinary mount. With minimal vegetation the scene contained no vine mesh and the renderer recorded no vine draw or warmup.
