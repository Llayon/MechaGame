# Pine forest during streamed battle entry

The control is the published grass optimization at `04c97a8`. In a traced drive, the first pine color draw took 213 ms and the first shadow draw took 53 ms. On a later frame of the same stage, the renderer compiled variants with instance colors (218 ms for color and 27 ms for depth). The renderer's program keys confirmed the change in instance coloring.

On hardware WebGL with parallel shader compilation, the candidate mounts the hidden forest at stream stage 11 during battle entry. After instance transforms and tints have been assigned it submits one real tree batch to `compileAsync`; all pine cells share that material. Rendering, forest LOD updates, wind, collisions, falling trees and chips start at the normal reveal at stage 12. This also moves forest construction and instance initialization one stage earlier. The shadow pass uses the ordinary custom depth material when the forest appears. The overview and the extension-disabled path use the original mount stage.

## Measurements

Each run entered battle from the first overview in a new Chrome profile, using Radeon 780M (ANGLE D3D11), AgX, 1100 × 730, balanced graphics with fixed 0.85 resolution scale, and 12 Mbit/s down, 4 Mbit/s up, 35 ms latency. The mech drove one world unit. The second route added one shot at stage 10. The primary metric is the longest interval between consecutive completed scene renders over stages 12–16, including the first eight stage 16 frames. The stage 11 peak and the maximum from control to the end of the capture check for costs moved earlier. Detailed traces and functional checks were separate from the paired timings. [Per-run results](pine-shader-entry.csv)

| Median per build | Main | Early pine preparation |
| --- | ---: | ---: |
| Longest frame on stages 12–16, drive (3 pairs) | 711 ms | 594 ms |
| Longest frame on stages 12–16, drive and fire (3 pairs) | 749 ms | 609 ms |
| Longest frame on stages 12–16, both routes | 733 ms | 602 ms |
| First visible pine frame, both routes | 733 ms | 493 ms |
| Longest frame on stage 11 | 45.5 ms | 151.5 ms |
| Longest frame after control through end of capture | 758.5 ms | 731 ms |
| Battle click to first controllable frame | 5,050 ms | 4,935 ms |

All six window peaks improved by 94–180 ms. Every control peaked at stage 12 and every candidate peaked at stage 14. The longer stage 11 reflects the early mount and preparation. Click-to-control varied with external load and preceded the pine work in all six runs. Background 3D utilization peaked at 18.3% in the paired series.

The submission led first color draw by 459–547 ms. The JavaScript completion callback ran after the reveal frame in these runs. In the diagnostic drive, the first color draw took 1.6 ms and the first shadow draw took 17.5 ms. The ordinary shadow pass used the tinted instance variant directly. Stage 14 in the same trace included a 197 ms hanging-vine draw.

In the firing trace the first pine color draw reused the exact program ID issued at stage 11 and took 1.5 ms. The first shadow draw took 18.3 ms and the hanging vines later took 213 ms. A dedicated depth precompile is deferred given these costs.

All recorded snapshots across the control, candidate and extension-disabled fallback matched for 1,388 trees in 35 cells, including transforms, tints, sway attributes, LOD selection, material keys, and shadow flags. With the extension disabled both color and shadow first drew on stage 12 without pine warmup. On minimal vegetation with shadows disabled, the forest first drew at stage 12 and no pine shadow draw was recorded.
