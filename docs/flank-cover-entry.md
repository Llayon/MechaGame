# Flank cover during streamed battle entry

The experiment starts from `b15b8b0`, with the existing waterfall preparation and default AgX on both builds. In two diagnostic runs on this revision, the first rocky ledge and the batch of instanced rocks accounted for 418 ms of the 1,169 ms reveal frame while driving and 382 ms of the 1,092 ms reveal frame while firing. These are elapsed times inside renderer draw calls, including driver waits.

On hardware WebGL with parallel shader compilation, the candidate mounts the hidden flank cover at foliage level 7 (stream stage 12). After static batching it submits one real draw object per cold shader variant to `compileAsync`, using the battle camera and scene lights. The group becomes visible at foliage level 9 (stage 14). Overview, software WebGL and hardware without the extension mount the cover at the visible stage.

## Measurement

Each run used a new Chrome profile, hardware ANGLE D3D11 on a Radeon 780M, a 1100 × 730 viewport, the balanced preset, fixed 0.85 resolution scale, and 12 Mbit/s down, 4 Mbit/s up, 35 ms latency. From the first overview the test entered battle, drove one world unit, and either stopped or fired once at stage 10. Both builds used identical baked world assets.

The primary measure is the longest interval between successive completed scene renders across stages 12 through 16, including the first eight frames at stage 16. The reveal interval contains the first color draw of a flank cover mesh. Entry runs from the battle click to the first controllable frame. Detailed draw traces and the extension-disabled check are separate from the paired timings. The CSV includes external CPU (median) and external GPU 3D engine utilization (peak) during the measurement window. [Per-run measurements](flank-cover-entry.csv)

## Results

| Median per build | Main | Early preparation |
| --- | ---: | ---: |
| Longest frame on stages 12–16, drive (3 pairs) | 1,081 ms | 749 ms |
| Longest frame on stages 12–16, drive and fire (3 pairs) | 1,115 ms | 754 ms |
| Longest frame on stages 12–16, both routes | 1,098 ms | 751.5 ms |
| First visible flank cover frame, both routes | 1,098 ms | 614.5 ms |
| Battle click to first controllable frame, both routes | 4,983 ms | 5,008 ms |

All six paired runs reduced the longest frame in the window (by 193–386 ms). Its peak moved from stage 14 to stage 12 in two runs and stage 13 in four. In one detailed driving trace, three foliage draw calls together took 627 ms in the 721 ms stage 13 frame. This is a candidate for follow-up profiling. Background 3D utilization in the paired runs peaked at 18.7%. In the pair with less than 8% external 3D activity on both sides, the maximum fell from 1,129 to 743 ms. Entry times overlapped across the two builds.

Both cover shader compilations started on stage 12 and finished before reveal in every candidate timing run. New programs during the reveal render fell from six to four. Instrumented flank draw calls of at least 3 ms totaled 418 → 10 ms while driving and 382 → 16 ms while firing. Every run first drew the cover at stage 14. With the parallel compilation extension disabled, the candidate also reached stage 14 and drew the cover without early compilation.

Five post-reveal snapshots matched across the baseline, candidate, and extension-disabled candidate. They covered 905 objects with position/index buffers, instance matrices and counts, material program keys, colors, sidedness, and shadow flags.
