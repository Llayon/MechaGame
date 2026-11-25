# Infantry formations during battle entry

The control is `main` at `fb9d827`, including the stage 5 refinery fix. The detailed infantry rig already submits its body and rifle materials for parallel compilation when its assets arrive. The initial distant formations, rifle lines and spotter diamonds were still compiling their own programs on the first visible infantry render.

On an early battle request, the scene can now use the infantry component as soon as the actor module resolves, while the world data is in flight. The mech still uses its independent player entry. On hardware with parallel shader compilation the infantry component builds the three formation batches once, initializes their instance attributes from the combat state and submits the hidden group with the current camera and scene. It retains these objects for the visible battle. The detailed rig still loads on activation, and the visible crowd reads the current simulation and camera every frame. Failure to warm a shader leaves the normal draw path available.

## Cold comparison

Each pair uses fresh Chrome profiles, a Radeon 780M, AgX and balanced settings at a fixed 0.85 resolution scale and 1100 × 730 viewport. Local production builds are served with 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. The harness clicks into battle from the overview, drives one world unit and captures eight frames on stage 16. Half the routes also fire once on stage 10. Build order alternates within each route. Hardware traces and fallback checks run separately from the timing series. [Individual runs](infantry-frame-entry.csv)

The stage 3 peak counts intervals between consecutive completed scene renders wholly after control and ending on stage 3. The wider peak uses the same definition through stage 16. The formation interval is the interval containing the first nonempty visible formation draw, even if it straddles control or lands on another stage. Click to formation ends at completion of that render. Times within the renderer measure CPU wall time.

In the final diagnostic drive both builds first drew the formations on stage 3. On main the first silhouette, rifle-line and spotter draws took 111.3, 41.8 and 38.7 ms. In the candidate they took 2.1, 1.7 and 1.0 ms. All three reused the object IDs, program IDs and shader cache keys observed at hidden submission on stage 2. The callback completed before control. The four baked world binaries and deployed infantry GLBs matched by SHA-256.

| Median across eight final pairs | Main | Prepared formations |
| --- | ---: | ---: |
| Stage 3 peak after control | 319.5 ms | 109 ms |
| Render within that peak | 279 ms | 37.5 ms |
| Worst interval after control | 319.5 ms | 234 ms |
| Click to control | 6,320.5 ms | 6,317.5 ms |
| Click to first visible formations | 6,649 ms | 6,317.5 ms |
| Interval containing the controllable frame | 548.5 ms | 563 ms |
| Control to stage 16 | 4,597.5 ms | 4,433.5 ms |

All eight pairs improved on the stage 3 peak, the worst post-control interval and time from control to stage 16. The candidate drew the first formations within the controllable frame in every final run. Main first drew them 273–342 ms after control. The longest post-control interval in the candidate fell on stages 4 and 12 in four runs each. The final series had 8–15% median external CPU utilization per run and external 3D engine peaks of 2–3%.

Time to control varied between pairs. In a preliminary eight-pair series the candidate median was 108 ms later despite the shorter stage 3 pause. The final series reversed the initial build order and had a 3 ms difference in the other direction. The repeatable gain was in frames after control.

Four separate drives checked main, the candidate, extension-disabled hardware, and an injected rejection of formation compilation. Every sampled frame with a visible crowd accounted for all living soldiers across near and far batches. Rifle and near-body counts matched, and the marker count matched the number of living spotters. All four drives initially drew the silhouettes and later drew up to 40 detailed soldiers. The extension-disabled run skipped hidden submission.
