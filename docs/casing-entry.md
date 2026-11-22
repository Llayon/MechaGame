# Shell casings on the first shot

Main at `1e59630` creates the casing mesh when the combat effects mount. Its per-instance colors select a shader variant. In a cold Chrome draw trace, the first submission with those colors took 169 ms when the player fired immediately. When the player walked first, Three.js spent 195 ms submitting the same variant with zero instances.

The player entry module now prepares the actual casing mesh along with the mech during a streamed battle request. The mesh reserves its instance-color attribute before parallel compilation. The combat renderer attaches that same mesh, runs the ballistic simulation and shows it when at least one casing passes distance culling. On a renderer without parallel compilation, normal visible-mesh submission handles the shader. Direct battle entry and entry from an already-loaded overview both ejected casings. Restart cleared the mesh and a second shot repopulated it, including with the extension disabled.

## Cold replay

Each run used a fresh local production build session in hardware Chrome on Radeon 780M. The balanced preset ran at 1100 × 730 with a 0.85 resolution scale, either fixed or adaptive with a 30 FPS target. Network emulation used 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. The harness clicked battle from the first overview, then pressed Space immediately after the controllable frame or after holding W for at least 1.8 seconds and moving more than 0.5 world units. It released Space when the game's shot counter advanced.

The harness recorded elapsed time between consecutive main-scene render completions and the first render with a positive visible casing count. In a separate instrumented candidate run the casing mesh started compilation before the full-world mark. The first nonempty draw used the same mesh and program IDs and took 2.2 ms inside the draw submission. That shot's complete frame took 238 ms.

## Results

Eight cold pairs covered both firing scenarios and resolution settings twice, reversing build order. The first visible casing and the first recorded shot shared a frame in every run. Times below are medians across the four pairs in each firing scenario.

| Frame interval | Main | Candidate |
| --- | ---: | ---: |
| Immediate shot and casing | 410 ms | 229 ms |
| Following frame | 27 ms | 27 ms |
| Immediate shot plus following frame, summed per run | 436 ms | 264 ms |
| Shot and casing after movement | 59 ms | 51 ms |
| Following frame | 24 ms | 26 ms |

Across the eight pairs the median click-to-control time increased from 4.755 s to 4.937 s. The first controllable frame increased from 514 ms to 573 ms. Four candidate entries coincided with streaming stage 5, including two control frames over one second. The baseline entries all coincided with stage 3 or 4. Only one pair met the load limits used in the [crater investigation](crater-entry.md). External 3D utilization reached 70%. The cause of the entry difference remains unresolved.

Two additional diagnostic pairs waited for six rendered frames at the last streaming stage after movement. With fixed resolution, shot frames took 51 ms on main and 56 ms on the candidate. With automatic resolution they took 55 ms and 50 ms. The first casing submission in each of those four runs took at most 0.3 ms.

Two more immediate-shot pairs reached control at stage 4 on both builds. The shot alone was slower on the candidate in these repeats (249 vs 198 ms and 243 vs 204 ms). Main spent another 201 and 191 ms on the following frame. The two-frame totals fell from 399 to 285 ms and from 396 to 270 ms. A repeat draw trace measured 142 ms for the first casing submission on main and 3.7 ms for the candidate. Frame placement varies while the rest of the scene is streaming.
