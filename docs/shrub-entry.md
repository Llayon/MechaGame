# Forest shrubs during streamed battle entry

The baseline is `main` at `96dcd26`, including the stage 10 horizon changes. Stage 12 reveals 746 forest shrubs in one instanced mesh. Previously, its first color draw compiled a wind shader with the battle lights, shadows and per-instance colors. On hardware WebGL with parallel compilation, the candidate submits that mesh to the renderer on stage 11, immediately after the forest initializes its instance data and submits the pine shader. The first visible draw still occurs on stage 12.

## Cold comparison

Each run started in a fresh Chrome profile on a Radeon 780M (ANGLE D3D11) and entered battle from the overview. Both production builds used identical baked world assets, AgX, a 1100 × 730 browser window, balanced graphics at fixed 0.85 resolution scale, and emulated 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. Each route drove one world unit. The firing route also fired once on stage 10. Three cold pairs per route alternated the order of the builds. Instrumented draw traces and functional checks ran separately. [Per-run measurements](shrub-entry.csv)

The stage peak is the longest interval between completed scene renders ending on that stage. The wider peak counts intervals wholly after the first controllable frame, through eight frames on stage 16. The render duration is the CPU wall time inside the renderer for the frame with the longest interval.

| Median per build | Main | Early shrub compilation |
| --- | ---: | ---: |
| Stage 12 peak, drive | 485 ms | 287 ms |
| Stage 12 peak, drive and fire | 475 ms | 302 ms |
| Stage 12 peak, both routes | 480 ms | 296 ms |
| Scene render within that frame | 280 ms | 102 ms |
| Stage 11 peak | 142.5 ms | 146.5 ms |
| Stage 13 peak | 477.5 ms | 482.5 ms |
| Longest interval after control | 490.5 ms | 482.5 ms |
| Click to first controllable frame | 4,750.5 ms | 4,777 ms |
| Control to first completed stage 16 render | 5,867.5 ms | 5,553 ms |

All six pairs reduced the stage 12 peak (131–229 ms) and reached stage 16 sooner after control (80–631 ms). The longest interval over the whole route improved in three pairs and increased in three. Stage 13 produced that interval in five of the six candidate runs. Peak external 3D utilization reached 15.3% during the series.

The shader submission occurred on stage 11 in every candidate run. In five of six timing runs, the browser delivered the completion callback 244–282 ms before first draw. In the sixth it delivered the callback 55 ms after first draw. The callback timestamp reflects when the renderer polled for completion. In the instrumented drive, the first shrub color draw used the submitted program and took 3.0 ms, down from 177.5 ms. The first shrub depth draw took 11.6 ms, compared with 11.3 ms in the control. On stage 13 the candidate trace recorded first color draws of 187 ms for fern bushes and 202 ms for rock outcrops.

## Functional checks

The first shrub color draw occurred on stage 12 in every run. Geometry positions, all 746 instance transforms and colors, material roughness and shadow flags matched across the baseline and the candidate snapshots, including full vegetation and the extension-disabled path. While the forest was hidden, the instance attribute versions and wind time stayed constant after initialization. On full vegetation the wind clock advanced after reveal. On reduced vegetation it held at 0.85 as in the baseline. Disabling parallel shader compilation skipped the early submission and the shrubs still appeared on stage 12.
