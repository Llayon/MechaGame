# V-Pulse infantry during streamed battle entry

The baseline is `main` at `121ac7c` with the fern and rock change. Unlike the foliage stage transitions, the detailed infantry appears when its two models and pose atlas finish loading. On these cold runs the first detailed draw was expensive: the driver compiled separate materials for the rifle and the soldier.

The candidate submits the detached rig with its actual instance attributes, camera and scene lighting to the hardware WebGL renderer after loading. While parallel compilation is pending, all living soldiers continue to use the existing animated formation silhouettes and the simulation continues. Once compilation settles, the crowd attaches the rig and uses the latest simulation and camera state to populate it. A disposal during compilation releases the rig and prevents it from attaching. The software and extension-disabled paths attach the loaded rig directly. A rejected warmup also falls back to a visible draw.

## Cold comparison

Each pair used a fresh Chrome profile per build on a Radeon 780M (ANGLE D3D11), a 1100 × 730 browser window, AgX, balanced graphics, fixed 0.85 resolution scale and emulated 12 Mbit/s download, 4 Mbit/s upload and 35 ms latency. Both production builds used identical baked world data and infantry assets. Four pairs drove one world unit and four also fired once on stage 10. The builds alternated running order. Separate traced runs checked first-draw costs and representation of live soldiers. [Per-run measurements](infantry-shader-entry.csv)

The stage peak is the longest interval between completed scene renders ending on that stage. The wider peak counts intervals wholly after control through eight frames on stage 16. Time to detailed infantry ends at the completion of the first scene render drawing both nonempty batches. The clock starts when control is handed to the player. Render and draw submission times are CPU wall times.

| Median | Main | Parallel compilation |
| --- | ---: | ---: |
| Frame interval at the first detailed infantry draw | 404.5 ms | 33 ms |
| Scene render within that frame | 394.5 ms | 20.5 ms |
| Stage 5 peak (six matched pairs with post-control stage 5 frames) | 404.5 ms | 169 ms |
| Longest interval after control (eight pairs) | 404.5 ms | 382.5 ms |
| Control to first detailed infantry render | 1,395.5 ms | 1,302.5 ms |
| Click to first controllable frame | 4,797.5 ms | 4,852.5 ms |
| Click to first detailed infantry render | 6,201 ms | 6,117 ms |
| Control to first completed stage 16 render | 5,188.5 ms | 5,139 ms |

In all eight pairs the interval containing the first detailed infantry draw became shorter. The first detailed frame landed on stages 5–8 on the baseline and stages 6–9 on the candidate. The candidate overlapped 213–275 ms of shader preparation with the ordinary silhouette rendering. Drive pair 3 (candidate) and firing pair 3 (baseline) handed control over on stage 6. Their missing stage 5 values are blank in the CSV and both pairs are included in all other headline metrics.

The longest post-control interval fell in seven of the eight pairs. In firing pair 2 it rose from 390 to 504 ms, with the candidate peak on stage 8. Across all candidate runs the remaining peaks fell on stages 14 (three), 12 (three), and 8 (two). In the traced drive stage 14 included a 165 ms draw of the gray mist material and a 53 ms draw of the river fog material in `AtmosphereMist`.

## Draws and representation

In a separate traced drive, first rifle and body draws took 183.5 and 255 ms on the baseline and 1.8 and 2.7 ms on the candidate. The candidate reused both program IDs issued during preparation. Positions, indices, bone weights and indices, animation atlas data, material types and shadow flags matched across the baseline, the candidate, the extension-disabled run and the injected compilation rejection. Bodies and rifles still shared their instance transforms and pose frames.

During the traced firing route, the renderer accounted for all 200 living soldiers as silhouettes while the shaders compiled. On reveal, the crowd contained 40 detailed soldiers with rifles and 160 silhouettes. The expected ten spotter markers remained visible and the pose buffer continued updating. Both fallback runs reached battle with a populated detailed rig.

A separate lifecycle check held the compilation promise, exited to the overview, then released it. Both pending instance batches emitted disposal events. The old rig stayed detached and a fresh rig drew soldiers when the player entered battle again.
