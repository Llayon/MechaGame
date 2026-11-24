# Refinery reveal at stage 5

The control is `main` at `75febc6`, with the pine and vine changes in PR #32. Two cold traces reproduced the long frame after control. The refinery's weathered, corrugated workshop wall and corrugated steel roof used two new shader programs on their first color draws.

| Control trace | Stage 5 interval | Time inside scene render | Wall draw | Roof draw |
| --- | ---: | ---: | ---: | ---: |
| Drive | 692 ms | 547 ms | 324 ms | 211 ms |
| Drive and fire later at stage 10 | 660 ms | 515 ms | 312 ms | 192 ms |

These timings are wall-clock durations and include waits inside the WebGL driver. The hidden water and terrain called their existing shader preparation after the slow render in both traces.

## Change

After a battle request, hardware WebGL with parallel shader compilation can mount the refinery while the detailed world is loading. This starts at structure detail level 2 (stream stage 3 or 4). After static batching, the code submits one actual mesh for each corrugated material variant using the active scene lights and camera. The hidden group has no sector click handler. The stage 5 handoff replaces the overview landmark with the visible, selectable refinery. An overview-only entry and renderers without the extension use the ordinary visible mount.

## Cold comparison

Both builds used the same four baked world assets, default AgX, Chrome on Radeon 780M (ANGLE D3D11), 1100 × 730, balanced graphics, fixed 0.85 resolution scale, 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. Each run used a fresh profile and entered battle from the first overview. The mech drove one world unit. The firing route added one shot at stage 10.

The primary measure uses the longest stage 5 interval between consecutive completed scene renders that both occurred after control. The wider post-control window ends after eight stage 16 frames. The pre-control diagnostic uses animation frame timestamps starting at the battle click, including the first callback after the control mark. External CPU and GPU utilization were sampled from click through the stage 5 peak. [Per-run timings](refinery-entry.csv)

| Median per build | Main | Early refinery preparation |
| --- | ---: | ---: |
| Longest stage 5 frame, drive (3 pairs) | 677 ms | 149 ms |
| Longest stage 5 frame, drive and fire (3 pairs) | 679 ms | 165 ms |
| Longest stage 5 frame, both routes | 678 ms | 150 ms |
| Time inside scene render in the longest stage 5 frame | 524 ms | 19 ms |
| Longest frame after control through the end of capture | 678 ms | 526.5 ms |
| Battle click to first controllable frame | 4,812 ms | 4,820.5 ms |
| Longest animation frame interval during entry | 1,192 ms | 1,183 ms |

All six pairs reduced both the stage 5 peak and the maximum after control. In one candidate run a later frame on stage 5 took 368 ms, while the refinery reveal frame took 170 ms. Peak external 3D utilization stayed below 2.4% throughout the sampled entry intervals. These are cold local measurements on one GPU.

Both compilations completed 543–919 ms before the first visible refinery draw across the six candidate runs. The reveal frame created zero new programs in all six, down from two in the control. In the candidate diagnostic drive, the two meshes drew with the same program IDs as their early submissions. The complete stage 5 peak was 156 ms, including 20 ms inside the scene render.

The refinery had no click handler while hidden and regained it at stage 5. In a separate overview-only run the refinery first mounted at stage 5 and its scene click handler selected the refinery sector. With the parallel compilation extension disabled it first drew at stage 5 without early submission. Snapshots of 168 meshes after reveal matched across the control, candidate, and extension-disabled path for the recorded visibility, position buffers, instance matrices, material program keys and shadow flags.

All six candidates reached their highest post-control interval on stage 10. In one diagnostic drive that interval was 525 ms, including two standard material draws in the structures group at 161 and 162 ms. Identifying their source meshes is the next profiling step.
