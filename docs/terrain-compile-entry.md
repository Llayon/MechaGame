# Detailed terrain handoff during battle entry

The baseline is `main` at `9a8fc11`, including the caustics, ambient occlusion and mist changes. On streamed hardware WebGL, the baseline already submits the hidden near surfaces for parallel compilation at stage 5. In the baseline trace, the first detailed ground tile drew with the exact program ID and cache key submitted during preparation. Stage 8 exposed the ground while the driver was still working, so that first draw stalled while inspecting the program.

The experiment keeps the existing near and far compact meshes visible while the actual surface group compiles. It switches each region to its detailed representation once both its ordinary stage threshold and the compilation handoff allow it. The distant ring shares the ground shader and observes the same readiness gate. Water and the rest of the scene continue streaming. A failed compilation releases the gate, and a stale callback from an earlier preparation is ignored after cleanup.

The first implementation kept the stage 5 submission. Across eight pairs, the median ground reveal interval fell from 662 to 107 ms, but the detailed ground appeared 328 ms later after control (2,385 to 2,713 ms). The second implementation allows preparation to start as soon as the first battle frame has been rendered and the world data is available on hardware with parallel shader compilation. It keeps the original stage 5 opportunity for ordinary streamed entry. Both implementations were measured against the same baseline in separate series.

## Measurement

Each pair used two production builds with identical baked world assets, a fresh Chrome profile for each run, the Radeon 780M (ANGLE D3D11), AgX, a 1100 × 730 browser window and balanced graphics at fixed 0.85 resolution scale. Network emulation used 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. Each route entered from the overview and drove one world unit. The firing route also fired once on stage 10. The build order alternated between pairs. Instrumented traces and fallback checks ran separately.

The ground reveal is the first completed scene render drawing a detailed near tile. Its frame interval counts the time since the previous completed scene render. The wider window counts intervals wholly after control through eight frames on stage 16. Draw and render timings measure CPU wall time. Time to the first detailed frame is reported separately from the duration of that frame.

| Median in the final eight pairs | Main | Preparation after the first battle frame |
| --- | ---: | ---: |
| Stage 8 peak | 716.5 ms | 38.5 ms |
| Frame interval at actual ground reveal | 716.5 ms | 95 ms |
| Render duration within that frame | 694 ms | 70.5 ms |
| Longest interval anywhere after control | 716.5 ms | 337.5 ms |
| Click to control | 5,303 ms | 5,295.5 ms |
| Control to near ground reveal | 2,393.5 ms | 2,412 ms |
| Control to horizon reveal | 2,654.5 ms | 2,412 ms |
| Control to first completed stage 16 render | 5,585 ms | 5,085 ms |

The first detailed frame interval improved in all eight pairs, including when it landed on stage 9 or 10. The longest interval after control fell by 252–445 ms in every pair. The candidate peaked on stage 12 in all eight runs. The traced candidate drive spent 115 ms inside the scene render during that 358 ms interval.

Time to see the near ground varied by route. Median control-to-ground time on the four drive pairs went from 2,408 to 2,595.5 ms. On the four firing pairs it went from 2,393.5 to 2,209.5 ms. The two routes and their ordering are described above; the observations do not establish a causal effect of firing. The CSV includes both experimental series and their controls. [Per-run measurements](terrain-compile-entry.csv)

In the second series' traced drive, the baseline submitted the near group 904 ms after control, on stage 5. Its first ground draw used the prepared program but took 536.3 ms. The candidate submitted the group 446 ms after control, on stage 4. Its first ground draw used that program 61 ms after the completion callback and took 11.7 ms. Both builds revealed the detailed ground on stage 8 in that trace.

## Coverage and failure cases

The captured frames had exactly one visible representation of each region (compact or detailed), including when the completion notification was deliberately held until stage 12. The index and attribute buffers of all 80 ground tiles and 54 horizon tiles matched the control, as did their material keys, bump scales and shadow flags. With parallel compilation disabled, or with an injected submission rejection, near and far detail appeared on the original stages 8 and 9. The drive also completed with shadows disabled. A separate run exited to overview while completion was held, then released the old callback and re-entered battle. Both regions remained detailed after re-entry.
