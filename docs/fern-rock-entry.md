# Fern bushes and rock outcrops during battle entry

The control is `main` at `41201e1`, including the stage 12 forest shrub change. On hardware WebGL with parallel shader compilation, the candidate mounts ferns and rocks hidden on stream stage 12. The fern batch initializes its transforms and colors before submitting its material. Both rock LOD batches use the same material with per-instance colors, so one submission covers both. Camera-dependent rock selection and fern wind updates start on reveal at stage 13. Minimal vegetation omits the ferns.

## Cold comparison

Each pair compared two production builds with identical baked world assets. Each run used a fresh Chrome profile on the Radeon 780M (ANGLE D3D11), AgX, a 1100 × 730 browser window, balanced graphics at a fixed 0.85 resolution scale and an emulated connection with 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. Each route entered battle from the overview and drove one world unit. The firing route fired once on stage 10. The builds exchanged running order between pairs. Detailed traces and graphics-setting checks ran separately. [Per-run measurements](fern-rock-entry.csv)

The peak for a stage is the longest interval between completed scene renders ending on that stage. The render duration measures CPU wall time inside the renderer during that interval. The wider window counts intervals wholly after control through eight frames on stage 16.

| Median per build | Main | Early fern and rock compilation |
| --- | ---: | ---: |
| Stage 13 peak, drive | 487 ms | 60 ms |
| Stage 13 peak, drive and fire | 505 ms | 56 ms |
| Stage 13 peak, both routes | 488.5 ms | 58 ms |
| Render duration within that frame | 413.5 ms | 24 ms |
| Stage 12 peak | 318.5 ms | 356 ms |
| Stage 14 peak | 371.5 ms | 370 ms |
| Longest interval after control | 488.5 ms | 404 ms |
| Control to first completed stage 16 render | 5,878.5 ms | 5,243.5 ms |
| Click to first controllable frame | 4,817.5 ms | 4,772.5 ms |

In all six pairs, stage 12 took longer (13–52 ms at its peak), stage 13 became faster (415–470 ms at its peak), and the longest interval after control fell by 76–119 ms. The widest interval occurred on stage 13 in every control run and on stage 5 in every candidate run. The candidate drive trace attributed 184 and 208 ms of that stage 5 interval to two V-Pulse infantry draw submissions. Both new shader submissions occurred after control. The small difference in time to gain control varied with run conditions, including background 3D utilization that peaked at 20.9%.

## Draw traces

In the traced control drive, the fern batch submitted a color draw before its instance colors were available (196 ms), then used a second shader program with instance colors (196 ms). The first rock draw took 202 ms. In the candidate, the first visible fern draw already had its instance colors and took 2.1 ms. The first rock draw took 1.2 ms. Their program IDs matched the two hidden submissions. Both rock LODs used the same program. These are CPU-side draw submission times.

## Appearance and fallback

Both builds first drew the ferns and rocks on stage 13. Across balanced and full vegetation, geometry, instance colors, transforms and shadow flags matched the control for the same setting. Rock snapshots compared all 860 instances across both camera-selected LOD batches. The fern count was 96 on reduced vegetation and 162 on full vegetation. The wind clock advanced after reveal on full vegetation and stayed at 0.65 on reduced vegetation. During preparation the rock batches stayed empty and the fern matrices, colors and wind clock stayed constant. With minimal vegetation only rocks were prepared and drawn. With parallel compilation disabled both objects first appeared on stage 13 via the ordinary visible mount.
