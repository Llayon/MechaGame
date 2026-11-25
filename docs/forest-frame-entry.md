# Stage 12 during battle entry

The control is `main` at `68ae171`, including the detailed terrain handoff and foliage lighting update. Stage 12 reveals the pine forest. On a streamed hardware drive, it also prepares ferns, rock outcrops, vines, waterfalls and flank cover. The latter two groups become visible on stage 14.

In a Chrome CPU profile the control's longest stage 12 interval took 361 ms, including 121 ms inside the scene render. In the preceding 240 ms, samples attributed about 46 ms to the waterfall site search and 60 ms to static mesh batching. These are inclusive main-thread samples. In the candidate trace the interval took 211 ms, including 118 ms inside the render.

The world asset plugin now evaluates the existing site search when Vite loads the waterfall data module. The production scene chunk contains the resulting site parameters. This keeps the data tied to the terrain source, with no separate network request. On hardware with parallel shader compilation the flank-cover meshes are now batched and warmed on stage 13. The waterfalls still warm on stage 12.

## Measurement

Each pair used fresh Chrome profiles and the same local production builds, on a Radeon 780M at 1100 × 730, balanced settings, fixed 0.85 resolution scale and AgX. Network emulation used 12 Mbit/s down, 4 Mbit/s up and 35 ms latency. The harness clicked into battle from the overview, moved the mech one world unit, optionally fired once on stage 10 and collected eight frames on stage 16. Build order alternated within each route. CPU profiles and fallback checks were separate from the timed runs.

The peak is the longest interval between successive completed scene renders, counting intervals wholly after control. The renderer measurement is CPU wall time within the scene render call. The time from control to stage 16 ends at the first completed render on that stage. The CSV includes background CPU and 3D engine activity sampled while each run was active. [Per-run measurements](forest-frame-entry.csv)

| Median across eight pairs | Main | Candidate |
| --- | ---: | ---: |
| Stage 12 peak | 381 ms | 208.5 ms |
| Within the render of that frame | 124.5 ms | 119 ms |
| Outside the render of that frame | 255.5 ms | 89.5 ms |
| Stage 13 peak | 63 ms | 177.5 ms |
| Stage 14 peak | 157.5 ms | 167 ms |
| Longest interval after control | 381 ms | 316 ms |
| Click to control | 5,816 ms | 5,761 ms |
| Control to first stage 16 frame | 5,134 ms | 5,040.5 ms |

All eight pairs had a shorter stage 12 interval and a shorter worst interval after control. In the four drives the median worst interval fell from 406 to 292 ms. With one shot it fell from 375 to 320 ms. The candidate's worst interval occurred on stage 10 in six runs and stage 3 in two. Time to stage 16 improved in five pairs and increased in three. External 3D engine activity peaked at 63–73% across the runs, which limits interpretation of small timing differences.

## Scene verification

Both builds first showed the waterfall and flank cover groups on stage 14. An additional drive compared the 15 waterfall buffer checksums, including the rock instance matrices, and the geometry types, vertex/index counts and instance counts of all 903 meshes in the cover group. All matched. The four baked world binaries also matched by SHA-256. The Vite dev module returned the same four site descriptors as the live search.

With parallel shader compilation disabled both groups mounted and appeared on stage 14. With minimal vegetation and shadows disabled the candidate prepared the waterfalls on stage 12 and cover on stage 13, then showed both on stage 14.
