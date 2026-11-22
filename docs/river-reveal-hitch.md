# The hitch on the river reveal

On main at `aabca3c`, advancing the streamed map to stage 7 mounts the detailed river. This transition can land on the frame that handles the player's first impact. In a cold Chrome trace with **no shot**, that frame lasted 766 ms. Of the 395 ms before scene submission, CPU samples attributed 211 ms to the water normal texture's lattice hash and 73 ms to the terrain bump texture's lattice hash. Scene submission then took 371 ms. The first draw using `sector7-shoreline-water-v2` took 356 ms. With fixed resolution and a miss, Three.js spent about 356 sampled ms in `WebGLProgram.onFirstUse` on the reveal frame. With auto resolution and a hit, the reveal took 704 ms. The no-shot trace recorded the same pixel ratio (0.65) on the preceding render and the water render.

The texture generators now calculate the periodic noise lattice once per octave and interpolate its values for each texel. Both maps retain their original resolution, filter settings and pixel values. A byte comparison of the old and new generated images covered all 1,048,576 bytes of the water normal map and 262,144 bytes of the terrain bump map. The streamed hardware path mounts the real water mesh offscreen from stage 5 when world data is available. Three.js can prepare its program with the current camera, lighting and reflection texture on renderers supporting parallel compilation. The material becomes visible on the original stage 7 and then starts its animation. Detailed ground still arrives on stage 8.

## Test method

Cold local production builds, Radeon 780M, hardware Chrome, balanced settings, a fresh browser profile, 1100 × 730 window, 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. The runner clicked battle after the overview and before the world was ready. It replayed movement across the same patch of soil and stopped at (−77.18, 90.23). In the paired series it issued the action on the first completed scene render at or after 1.8 seconds of control with the player at the waypoint. The three actions were movement without firing, a real Space-key miss, and a real Space-key hit on a nearby barrel. The simulation's shot and hit counters verified each scenario; an intended miss that hit another target had to be repeated. The fixed-resolution condition used a scale of 0.85. The auto condition enabled DRS with the same base scale and a 30 FPS target.

The primary outcome is the interval between the previous scene submission ending and the first main-scene submission ending with the detailed water visible. It captures both synchronous construction and rendering even if React commits on a different frame from the stage label. GPU time uses asynchronous disjoint timer queries around the same main-scene render and is reported separately. CPU wall time inside a renderer call can include driver waits, and the GPU interval can include gaps between submitted commands. These times overlap. Separate diagnostic sessions used Chrome CPU sampling and per-object draw wrappers. Timed comparisons omitted those probes.

The CSV gives times in ms. The action frame is the first render after the no-shot signal or the first render with a new fired shot. The pre-water peak covers completed battle renders after the control mark through the reveal. The stage-8 peak covers the subsequent detailed-ground transition. The CSV also gives median external CPU and peak external 3D utilization (%) from half-second system samples excluding the test browser, for the click-to-control and control-to-water intervals. [Per-run results](river-reveal-hitch.csv)

## Results

Twelve pairs covered each action/resolution combination twice, reversing build order on the second pass. The water reveal was faster in every pair. All 24 runs returned a valid GPU timer result for the reveal. Ten pairs had comparable load between control and water (median external CPU at most 30% in both runs, CPU difference at most 10 percentage points, and peak external 3D at most 8% in both). The median reveal in those ten pairs was 623 ms on main and 43 ms on the candidate. One main run overlapped a separate workload using 60% of a 3D engine.

| Metric, median across runs | Main | Candidate |
| --- | ---: | ---: |
| Battle click to control | 4.965 s | 4.959 s |
| First render interval with visible detailed water | 648 ms | 43 ms |
| Portion before entering the main render call | 297 ms | 28 ms |
| Wall time inside that render call | 341 ms | 17 ms |
| GPU timer interval for that render | 341 ms | 16 ms |
| Frame recording the first successful shot (four hit pairs) | 673 ms | 79 ms |
| Largest post-control frame through the water reveal | 648 ms | 553 ms |
| Largest stage-8 frame | 1.533 s | 1.518 s |

The original successful shot and the first water render shared a frame in three of the four main hit runs. The fourth hit frame was 79 ms, with the later water frame taking 618 ms. The candidate hit frames took 73–91 ms. These results are specific to the replay and one GPU.

| First water frame, median of two runs per build | Main | Candidate |
| --- | ---: | ---: |
| Auto, no shot | 765 ms | 45 ms |
| Auto, miss | 619 ms | 72 ms |
| Auto, hit | 656 ms | 51 ms |
| Fixed, no shot | 636 ms | 36 ms |
| Fixed, miss | 662 ms | 52 ms |
| Fixed, hit | 673 ms | 43 ms |

Other streaming transitions are still visible. In the candidate no-shot diagnostic, a stage-8 frame lasted 1.53 s, with first submissions for the detailed slope/height terrain and road-puddle programs taking 843 ms and 403 ms. That transition is a separate optimization target.
