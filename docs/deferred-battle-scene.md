# Deferring the mech and battle actors

This branch extends the effects-only experiment. The first overview draw starts a dynamic import of the SovietMech component, including its rig, combat camera and controller dependencies. The existing full-world loading phase then requests the actor module and awaits both modules alongside the map data. The actor module includes CombatActors, both infantry renderers and the eight effect renderers. Direct battle entry requests both modules alongside the world from the start. The scene uses the existing detail stages for mounting and has the loaded components available before entering drive mode.

## JS transferred

Production builds were compared with main at `02946da`. The Vite manifests list one static JS entry in each build. All three JS sizes below are gzip response-body bytes, checked against Chrome Resource Timing.

| Resource | Main | Candidate |
| --- | ---: | ---: |
| Initial JS | 540,511 | 487,907 |
| Mech, requested at first overview draw | included in entry | 19,369 |
| Combat actors, infantry and effects, requested with map details | included in entry | 35,968 |

This removes 52,604 bytes (9.7%) before the first draw. Once both modules have loaded, their combined size with the entry is 2,733 bytes larger than main. The meshoptimizer decoder, terrain worker and map data are shared between the two builds.

## Cold startup and immediate battle entry

The comparison used the same localhost gzip server implementation, Chrome with a fresh profile for each run, Radeon 780M, balanced settings, 1100 × 730 browser window, 12 Mbit/s download, 4 Mbit/s upload and 35 ms configured latency. Each pair alternated which build ran first. A DOM observer clicked the first available battle button after the overview draw and before full-world readiness. The browser recorded the first draw, the click, the controllable frame and resource transfers. The render mark records scene submission. No screenshot tracing ran during these timings.

Before each session the runner waited for about six seconds of lower load (median system CPU at most 20%, maximum external 3D at most 5%). External CPU and 3D loads were also recorded at approximately 500 ms intervals throughout each session, excluding the test browser's processes. For each phase, comparable-load pairs had a sampled external 3D peak at most 8% in both runs, median external CPU at most 30% in both runs, and an inter-run CPU difference at most 10 percentage points. The raw data retains runs with interference. [Per-run data](deferred-battle-scene.csv)

## Results

Twelve pairs completed. The first overview draw was earlier in all twelve. The median paired improvement was 50 ms overall and 43 ms among the ten pairs with comparable load during startup. In those ten pairs the median draw times per build were 1,467 ms and 1,418 ms.

Seven pairs had comparable load between the battle click and the first controllable frame. The candidate reached control earlier in four of them. The median paired difference was 13 ms faster, with individual differences ranging from 73 ms faster to 485 ms slower. Medians per build were 7.13 s and 7.18 s. The effect on battle entry remains uncertain. The two-second difference in the first pair coincided with external 3D load reaching 58% in the control.

The mech request began 0.8–1.5 ms after the draw mark. The battle actor request began 487–839 ms after the draw, finished at least 3.59 s before full-world readiness in every measured run and transferred once. Both dynamic modules were present when control became available. These are measurements on one desktop GPU under network emulation.

Browser checks also covered direct battle entry, reaching the final overview stage with the assembled mech rig and infantry crowd, and recovery after blocking each module individually. The existing details retry button recovered both failures. The first burst after recovery produced tracers, muzzle flashes and ejected casings.
