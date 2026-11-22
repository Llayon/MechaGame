# First detailed terrain and road frame

On a streamed map the compact ground covers the near terrain until stage 8. The [river investigation](river-reveal-hitch.md) measured 843 ms in the first terrain draw and 403 ms in the first road draw on that transition. Another standard material took 179 ms in the same trace.

From stage 5, once world data is available, the hardware WebGL path can mount the near surfaces in a hidden group. Three.js compiles the group's actual materials against the active scene lights, fog and reflection map when parallel shader compilation is available. At stage 8 the group becomes visible as the compact ground is removed. The distant ring still appears at stage 9. The reveal proceeds on schedule even if compilation is incomplete.

## Cold Chrome replay

Both local production builds used the same dependencies and the same Radeon 780M. The baseline was main at `211ef78`. Each run used a fresh Chrome profile, an 1100 × 730 window, 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. The replay clicked battle from the overview and moved to the waypoint used in the river investigation. The eight pairs covered movement alone and a confirmed barrel hit, each with fixed resolution (0.85) and automatic resolution (30 FPS target). Each combination ran twice with reversed build order.

The probe identified the first completed main-scene render containing both visible materials by their program cache keys. The frame interval includes everything since the previous scene render ended. The GPU interval is an asynchronous WebGL timer query around that render. The intervals overlap.

| Median across eight pairs | Main | Candidate |
| --- | ---: | ---: |
| Navigation to first overview draw | 1.434 s | 1.450 s |
| Battle click to first controllable frame | 4.982 s | 4.963 s |
| Control to first detailed ground and roads | 3.730 s | 2.276 s |
| First detailed ground and roads frame | 1,624 ms | 80 ms |
| GPU timer on that render | 1,498 ms | 40 ms |
| Longest frame from the first controllable frame up to, excluding, the reveal | 825 ms | 837 ms |
| Longest frame from the first controllable frame through the reveal | 1,624 ms | 837 ms |

The reveal improved in all eight pairs. Earlier work has a cost. The median largest recorded stage-5 frame was 597 ms on main and 626 ms on the candidate, among runs that observed that stage after control. A separate early streaming frame still took about 0.84 s. These measurements cover one GPU and this startup replay.

Windows load counters stopped reporting during part of the series, so three pairs were repeated for a load-matched check. Six of the eleven pairs had comparable measured load between control and the reveal under the criteria used for the river investigation (median external CPU ≤30% per run with a difference ≤10 percentage points, peak external 3D ≤8% per run). The median reveal in those six pairs was 1,666 ms on main and 76 ms on the candidate.

A separate Chrome check followed the terrain and road materials through the overview transition. Both were hidden during preparation and used the same program objects at their first visible render. Direct battle entry, a context with the parallel compilation extension disabled, and SwiftShader all rendered both materials successfully.
