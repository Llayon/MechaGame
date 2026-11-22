# Ground trails and armor debris during battle entry

The control was `main` at `35c6d82`, which already prepares the player mech while the world downloads. In a Chrome renderer trace of a cold, immediate battle entry, both instanced meshes had a count of zero in the first combat render. Three.js still spent 272 ms in the ground-trail draw submission and 145 ms in the armor-debris submission. These are main-thread wall times, including possible driver waits.

The first candidate hid both meshes until the existing simulation and distance checks produced a visible instance. It enabled control earlier in all three pilot pairs, with a median paired gain of 500 ms. The first visible trail frame then took 302 ms versus 27 ms on main. A draw trace attributed 297 ms to the first nonempty trail submission.

The final candidate starts parallel compilation on the actual two meshes with the active camera and scene, after their per-instance attributes have been initialized. It keeps each mesh hidden until its renderer has populated at least one instance. Physics, foot contacts, distance culling and the casing renderer retain their usual update paths. Renderers without `KHR_parallel_shader_compile` keep the original visibility behavior. In a separate candidate trace, the first nonempty trail submission took 1.1 ms and the first nonempty debris submission took 0.1 ms.

## Test conditions

Each pair alternated the order of two local production builds. The test launched Chrome with a fresh profile, hardware rendering on Radeon 780M, balanced settings, an 1100 × 730 browser window, gzip responses, and network emulation at 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. After the first overview draw, a DOM observer clicked the battle button while the world was still loading.

The concrete spawn pad rejects footprints. Immediately after the controllable render, the harness positioned the simulation at the soil test location (−76, 86), set yaw to 0.4 radians and held forward. The normal gait, foot-contact and stamping logic produced the footprint. The sampler distinguished a mech footprint by its per-instance kind because an APC track can activate the same renderer first. A controlled `armor-hit` was queued near the mech four rendered frames after the first footprint. This exercised the normal impact consumer, fragment simulation and draw path, with projectile travel excluded. A second scenario queued the hit after the first movement frame.

The click-to-control timing ends at the game's renderer submission mark. Each effect frame interval runs from the end of the previous main-scene render to the end of the first render containing that effect. It includes simulation, scheduling and other objects in the same frame. The CSV also records the submission time of the whole scene. Tracing and per-object draw wrappers were enabled only in the separate diagnostic sessions.

External CPU and 3D activity were sampled approximately every 500 ms with the browser process tree excluded. Each timed run started after six seconds with median system CPU at most 20% and peak external 3D at most 5%. Phase-matched pairs required median external CPU at most 30%, at most 10 percentage points difference between runs, and peak external 3D at most 8%. CPU and GPU columns in the CSV report median external CPU and peak external 3D in percent. [Per-run measurements](empty-effect-pools.csv)

## Results

The primary series used eight pairs and the hit-after-footprint scenario. The last column gives the median of the differences within pairs. Each build column gives its own median.

| Metric | Main | Candidate | Paired change |
| --- | ---: | ---: | ---: |
| Navigation to first overview draw | 1.479 s | 1.501 s | +18 ms |
| Battle click to control | 5.529 s | 5.117 s | −436 ms |
| World readiness to control | 1.403 s | 0.938 s | −457 ms |
| Frame with first visible trail of any kind | 19.8 ms | 24.4 ms | +0.7 ms |
| Frame with first mech footprint | 29.4 ms | 23.9 ms | −3.2 ms |
| Frame with first armor debris | 65.4 ms | 70.4 ms | +11.5 ms |

All eight entries met the background-load criteria and reached control 255–679 ms earlier. Seven pairs met the load criteria during the effects phase. Their median paired changes were +1.0 ms for the footprint and +11.1 ms for the impact frame. Six of the eight candidate impact frames took longer. The largest increase was 71 ms, with 91 ms between queuing the hit and the start of rendering in that candidate run. The median paired change in whole-scene render duration for the eight impact frames was +1.7 ms.

Four more pairs moved the controlled impact to immediately after the first movement frame. Their first debris frames took 63.5 ms on main and 63.9 ms on the candidate (paired median −1.3 ms). All four effects windows met the background-load criteria.

Four additional pairs used the game's Space-key firing path. The fixture positioned existing barrel targets near the gun barrels and stopped forward movement when it issued the fire input. The combat simulation registered a hit and rendered debris in every run. The first impact frame took 100.2 ms on main and 93.8 ms on the candidate. Three pairs were faster, with a median paired change of −6.5 ms and a range of −37 to +15 ms. Individual first-footprint frames reached about 360 ms in both builds in this series. The entry improvement reproduced across all three scenarios; first-hit frame times varied with the workload.

Restarting the mission cleared both instance counts. On the optimized path both meshes became hidden, then became visible again when new effects appeared. The same reset/reactivation check passed with the parallel compilation extension disabled.
