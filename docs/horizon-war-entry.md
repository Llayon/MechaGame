# Stage 10 shaders during battle entry

The control is `main` at `c5907be`, including interior mapping and the stage 12 waterfall/cover change. A cold drive trace spent 234 ms inside the render of the longest stage 10 frame. Individual WebGL calls waited on program information for the turbine beacons, hologram panels, horizon smoke and two passes of the distant tracer material. With one player shot, the first draw of the player's ballistic tracer also took 44 ms.

The candidate submits the beacon material alongside the turbine tower on stage 6. On stage 7 it mounts the actual hologram and distant-war objects hidden, initializes their instance colors and requests parallel compilation using the battle scene. Both groups become visible at the usual detail level on stage 10. While hidden, the simulation callback skips animation, combat-state polling and distant cannon audio. The existing distant-war setting controls the smoke, distant tracers and flashes. Holograms and turbine beacons are independent of that setting.

## Cold comparison

Each build ran in a fresh Chrome profile on Radeon 780M, using AgX, balanced settings, fixed 0.85 resolution scale, 1100 × 730 viewport, and 12 Mbit/s down, 4 Mbit/s up with 35 ms latency. Each route entered battle from the overview and drove one world unit. The firing route also fired once on stage 10. Four pairs per route alternated build order. Timing runs and diagnostic traces were separate.

The stage peak is the longest interval between completed scene renders ending on that streaming stage. The wider peak counts intervals wholly after control through eight frames on stage 16. Render durations are CPU wall time. The CSV includes background CPU and 3D engine samples for each timed run. [Individual runs](horizon-war-entry.csv)

| Median | Main | Candidate |
| --- | ---: | ---: |
| Stage 10 peak, drive (4 pairs) | 256 ms | 60 ms |
| Stage 10 peak, drive and fire (4 pairs) | 289.5 ms | 77.5 ms |
| Stage 10 peak, both routes | 262 ms | 65 ms |
| Render within the stage 10 peak | 232.5 ms | 48 ms |
| Stage 7 peak, both routes | 40.5 ms | 78 ms |
| Worst interval after control | 417 ms | 413.5 ms |
| Control to stage 16 | 4,933 ms | 4,557.5 ms |

Stage 10 improved by 169–257 ms across the eight pairs. Every pair reached stage 16 earlier. External 3D engine activity peaked between 2% and 71% depending on the run. Both builds had their worst interval on stage 5 in every timed run. In the candidate traces the first refinery window draw (`sector7-interior-window-v1`) took 346 ms while driving and 317 ms on the firing route.

The stage 10 drive trace went from 265 to 65 ms. With one shot it went from 296 to 116 ms, including 44 ms for the first draw of the player's ballistic tracer in the candidate. That shot registered on stage 10 in every firing run.

## Visibility and settings

Both builds exposed all five batches on stage 10, with 7 beacons, 20 signs, 4 smoke columns and pools of 72 distant tracers and 36 flashes. After initialization the candidate's hidden instance-buffer versions and smoke/sign clocks stayed fixed until reveal. Animation advanced after reveal. With parallel compilation disabled all five mounted at stage 10. Turning off distant war kept the beacons and signs visible and omitted the three distant-war batches. The four baked world binaries matched the control by SHA-256.
