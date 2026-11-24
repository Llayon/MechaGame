# Preparing grass before its first battle frame

The control uses the game tree from `main` at `31822a6`, including default AgX and preparation of the waterfalls and flank cover. The four baked world assets match byte for byte between control and candidate.

On hardware WebGL with parallel shader compilation, the candidate mounts the grass after foliage detail level 6 is reached in drive mode and the grass map is available. In streamed entry this can start at stage 11. It submits the first of the three real grass meshes to `compileAsync` with the battle lights and camera. All three meshes share their grass material. Mounting also creates the usual terrain texture and grass band data earlier. The group stays hidden and its frame callback skips band updates until foliage level 8 (stream stage 13). The shader, blade geometry, density settings and visibility threshold are shared by both builds.

## Cold battle entry comparison

The comparison used fresh Chrome profiles on Radeon 780M (ANGLE D3D11), a 1100 × 730 viewport, balanced settings with reduced vegetation, fixed 0.85 resolution scale, and emulated 12 Mbit/s down, 4 Mbit/s up, 35 ms latency. Starting from the first overview, the mech drove one world unit. The firing route added one shot at stage 10. The primary measure is the longest interval between consecutive completed scene renders on stages 12–16, through the first eight stage 16 frames. Click-to-control and the longest interval after control were recorded separately to catch work moved earlier. [Per-run results](grass-shader-entry.csv)

| Median of per-run values | Main | Early grass preparation |
| --- | ---: | ---: |
| Longest frame on stages 12–16, drive (3 pairs) | 795 ms | 764 ms |
| Longest frame on stages 12–16, drive and fire (3 pairs) | 772 ms | 726 ms |
| Longest frame on stages 12–16, both routes | 783.5 ms | 745.5 ms |
| First visible grass frame, both routes | 783.5 ms | 511 ms |
| Longest frame on stage 11, both routes | 37 ms | 49 ms |
| Longest frame on stage 12, both routes | 753 ms | 745.5 ms |
| Longest frame after control through end of capture | 819 ms | 764.5 ms |
| Battle click to first controllable frame | 5,077.5 ms | 5,065 ms |

All six paired runs improved the visible grass frame. Five pairs reduced the longest frame on stages 12–16, by 2 to 99 ms. In the sixth pair it grew by 4 ms. All six candidate runs peaked at stage 12. Background 3D activity peaked at 20.7% in one run. In the firing pair with 1.9% peak background 3D activity in both runs, the longest interval fell from 772 to 726 ms. The size of the overall improvement is less certain than the reduction on the grass frame.

In all six candidate runs, compilation started after control on stage 11 and finished 876–1,040 ms before the first grass draw. Both builds drew grass on stage 13. A separate traced drive measured 269 ms in grass draw calls of at least 3 ms on the reveal frame of the control and 5 ms on the candidate. In the candidate trace, stage 12 took 777 ms, including 217 ms for pine color, 65 ms for pine depth, and 186 ms for the wind-animated shrub material.

All three bands matched in the baseline and candidate drive snapshots, including geometry hashes, vertex colors, bud masks, material keys, shadow flags, and live instance counts (0, 5, 194). With parallel compilation disabled, the candidate drew grass at stage 13 without early compilation. Its snapshot matched the same geometry and materials, with 189 instances in the far band at its slightly different final mech position.
