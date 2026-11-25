# River fog and smokestack plumes during battle entry

The control is `main` at `304c0c1`, including the V-Pulse infantry change and the concurrent water caustics and PBR ambient occlusion update. Both measured builds include those changes and have identical baked world assets.

During streamed battle entry, the candidate mounts the enabled mist layer hidden on stage 13 and submits one river sheet and one smokestack plume for parallel WebGL shader compilation. The ten sheets share one program and the four plumes share another. The layer becomes visible and the plumes start animating on stage 14. With the layer switched off, neither the texture nor the meshes are created. Overview, software rendering and hardware without the parallel compilation extension use the ordinary visible mount.

## Cold comparison

The two builds used fresh Chrome profiles on a Radeon 780M (ANGLE D3D11), a 1100 × 730 browser window, AgX, balanced graphics with reduced atmosphere and a fixed 0.85 resolution scale. The emulated connection had 12 Mbit/s download, 4 Mbit/s upload and 35 ms latency. One route drove one world unit after entering battle from the overview. The second also fired once on stage 10. Each pair ran sequentially, alternating build order between pairs. Detailed traces and graphics setting checks ran separately. [Per-run timings](mist-entry.csv)

The peak for a stage is the longest interval between completed scene renders ending on that stage. The wider peak includes only intervals wholly after control, through eight frames on stage 16. Draw and render durations measure CPU wall time.

| Median | Main | Early mist preparation |
| --- | ---: | ---: |
| Stage 14 peak, drive (four pairs) | 387.5 ms | 150 ms |
| Stage 14 peak, drive and fire (four pairs) | 397.5 ms | 151.5 ms |
| Stage 14 peak, both routes | 396.5 ms | 150.5 ms |
| Render duration within that frame | 352.5 ms | 117 ms |
| Stage 13 peak | 53 ms | 59 ms |
| Stage 15 peak | 54 ms | 49.5 ms |
| Longest interval after control | 691 ms | 657 ms |
| Control to first completed stage 16 render | 6,107 ms | 5,730 ms |
| Click to first controllable frame | 5,354.5 ms | 5,355 ms |

All eight pairs reduced the stage 14 peak by 204–258 ms and reached stage 16 sooner after control. Across the entire route, the longest interval was on stage 8 in every run, before mist preparation. That interval improved in five pairs and grew in three. Background 3D engine utilization peaked at 2.6% in the final timing series. Preliminary measurements made before the caustics update were excluded.

## Draw traces

In the traced drive, the first river sheet draw took 47.0 ms in the control and 2.3 ms with early preparation. The first smoke plume draw took 194.0 ms and 10.5 ms respectively. The first visible draws used the program IDs issued during stage 13, even though the first visible instance of a material can differ from the mesh used to compile its program. Both effects first drew on stage 14.

Stage 8 had an expensive ground tile draw in both traced drives. The same terrain material (`sector7-slope-height-terrain-v8`) took 633 ms on the control and 549 ms on the candidate during that draw, before either build prepared the mist layer. The WebGL call reading the program's information log accounted for 632 ms and 548 ms of CPU wall time respectively.

## Functional checks

The layer retained four smokestack plumes and ten river and canyon sheets. Geometry, sheet transforms, opacity, color, material type, blending, depth-write flags and the shared fog texture pixels matched the control snapshots. Plume transforms stayed fixed while hidden and advanced after reveal. Full atmosphere and the extension-disabled path reproduced the same layer. With atmosphere off, neither mist material was submitted or drawn. Toggling the layer off and back on after entry removed and restored all fourteen visible meshes.
