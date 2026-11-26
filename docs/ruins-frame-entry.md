# Flooded ruins during stage 4 of battle entry

Stage 4 adds the flooded eastern ruins, the power line through the northern pass and the quarry details. In the initial profile the renderer waited on three concrete programs: the ordinary, instanced and merged concrete draws. The first wire draw also compiled its line shader.

The candidate mounts the quarry details hidden during streamed stage 3 once the player has a controllable frame and the hardware renderer supports parallel shader compilation. After static batching, it submits one draw per concrete material and instancing mode, plus the power line, with the active camera and scene lighting. The first visible draw can reuse those programs. Stage 4 reveals the group and enables the two sector click handlers even if a compile promise rejects or the renderer skips preparation.

## Cold comparison

The final control is the published merge `d858ac8`. This includes a concurrent canyon lighting update that changed the concrete shader to version 4. Both builds in the final series include that update. Preliminary version 3 traces were used to identify the cold draws.

Each timing run uses a fresh Chrome profile on Radeon 780M, balanced graphics at fixed 0.85 resolution scale, AgX, 1100 × 730 viewport, and emulated 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. The route enters battle from the overview and drives one world unit. The firing route also fires once on stage 10. Four pairs per route alternate build order. Geometry checks, shader traces and fallback runs are separate from timing. [Individual runs](ruins-frame-entry.csv)

The peak is the longest interval between completed scene renders wholly after control. The wider window runs through eight frames on stage 16. The ruins interval contains the first color draw of the detailed ruins. Render and draw durations are CPU wall times including driver waits.

## Timing the preparation

The first experiment allowed preparation before the player gained control. Across eight pairs the median stage 4 peak fell from 200 to 49.5 ms, but the median time from click to control rose from 6,359.5 to 6,745 ms. The median peak across the wider window barely moved (228.5 to 226.5 ms). A second series tested starting the work after control, with a fresh set of baseline runs.

| Median per build across eight runs | Published main | Prepare after control |
| --- | ---: | ---: |
| Click to first controllable frame | 6,391 ms | 6,603 ms |
| Stage 3 peak after control | 115 ms | 136.5 ms |
| Stage 4 peak after control | 208 ms | 70 ms |
| Time inside the renderer on the stage 4 peak frame | 160 ms | 38.5 ms |
| Click to first completed render showing ruins | 6,828.5 ms | 7,004 ms |
| Worst interval after control through stage 16 | 229.5 ms | 241.5 ms |
| First controllable frame to stage 16 | 4,739.5 ms | 4,657.5 ms |

Five candidate runs showed the ruins in a 58–71 ms interval with zero programs added during that render. The other three still added four programs and took 272–305 ms. In those three the candidate was slower than its paired control by 43–83 ms. In the five successful runs the worst remaining pause occurred on stage 12. Across all eight pairs the median change in the worst interval was +1 ms. All 16 runs in this series handed over control at stage 3. One control in the earlier series handed over at stage 2 and included a long stage 3 stall in its post-control peak.

The branch keeps the after-control variant for further testing. It improves the ruins reveal when there is time to compile, but the improvement depends on the interval between the first controllable frame and the stage transition. Neither series demonstrated faster access to the controls. Per-run median external CPU usage ranged from 9.3% to 21.8% in the second series, with external 3D engine peaks of 4.5% to 11.8%. These runs describe one machine.

## Rendering checks

In the diagnostic drive on main, the first three distinct ruin concrete programs cost 34.1, 26.9 and 30.4 ms in draw order, and the power line cost 81.3 ms. With after-control preparation the corresponding calls cost 1.3, 1.9, 6.4 and 3.1 ms. All eight monitored draws reused program IDs and cache keys seen during hidden preparation. The stage 4 geometry attributes, indices, instance data, world transforms, material colors and shadow flags matched the baseline. All four baked world binaries matched by SHA-256.

The visibility check found zero sector click handlers while the group was hidden and two on stage 4. With parallel shader compilation disabled the renderer skipped the hidden submissions and still drew the eight objects on stage 4.

A separate fault-injection run extended the stage 3 timer by 1.2 seconds so all five hidden submissions could be intercepted and rejected. All eight monitored draws appeared on stage 4 and both sector handlers were present. This run is excluded from timing.
