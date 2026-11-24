# Horizon landmarks and wind turbines during streamed battle entry

The control is `main` at `24896be`, including the refinery change in PR #33. On stage 10 the renderer first draws the merged horizon silhouettes (780 vertices) and seven instanced turbine towers (564 vertices per tower). The materials match the flat-shaded, vertex-colored material definitions and roughness values for those meshes. The rotors have 648 vertices and share the tower shader program.

During hardware battle entry with parallel WebGL shader compilation, the candidate mounts these objects behind a visibility flag at structure detail level 4 (stream stage 6). It submits the actual landmark mesh and the tower batch to the renderer with the battle camera and lighting. The turbine rig initializes while hidden. Rotation and beacon pulses start when the group becomes visible at detail level 5 (stream stage 10). The overview, software renderer, and extension-disabled paths keep the visible mount.

## Cold comparison

The two production builds used identical baked world assets, AgX, Chrome on Radeon 780M (ANGLE D3D11), a 1100 × 730 viewport, balanced settings at fixed 0.85 resolution scale, and 12 Mbit/s down, 4 Mbit/s up, 35 ms latency. Every run used a fresh profile, entered battle from the first overview and drove one world unit. The firing route fired once at stage 10. The primary metric is the longest interval between completed scene renders during stage 10. The wider window starts with intervals wholly after control and includes eight frames at stage 16. Preparation-stage peaks and entry time track costs shifted earlier. Detailed traces and functional checks were separate from the six timing pairs. [Per-run timings](horizon-entry.csv)

| Median per build | Main | Early preparation |
| --- | ---: | ---: |
| Stage 10 peak, drive (3 pairs) | 552 ms | 236 ms |
| Stage 10 peak, drive and fire (3 pairs) | 597 ms | 277 ms |
| Stage 10 peak, both routes | 583.5 ms | 242 ms |
| Scene render within that frame | 546.5 ms | 213.5 ms |
| Longest frame across stages 5 and 6 | 395 ms | 383 ms |
| Longest frame after control through stage 16 | 583.5 ms | 476.5 ms |
| Click to first controllable frame | 4,797.5 ms | 4,756 ms |

Every pair reduced the stage 10 peak by 298–351 ms and the wider post-control peak by 60–138 ms. Stage 10 was the slowest in all six control runs. The candidate peaked on stage 12 four times and stage 13 twice. Background 3D utilization reached 16.1% in one run. All preparation started after control, and both programs were ready 554–771 ms ahead of first draw (the shorter lead time per run).

In a separate traced drive the first landmark draw fell from 172.9 to 33.5 ms and the first tower draw from 175.0 to 1.2 ms. The landmark and tower drew with the program IDs issued during preparation. The first rotor draw reused the tower program.

Landmarks, towers and rotors first drew at stage 10 in all captures. Geometry positions, baked vertex colors and tower transforms matched across control, candidate and extension-disabled snapshots. While hidden, rotor matrices and beacon colors received no animation updates after initialization. After reveal, six rotors turned, one remained stationary, and the firing trace confirmed that beacon colors changed. The extension-disabled run skipped both early submissions and drew the objects on the original stage.

In the follow-up firing trace, the wind-animated shrub draw took 173 ms on stage 12. Fern bushes and rocks took 182 and 204 ms on stage 13.
