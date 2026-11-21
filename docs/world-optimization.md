# World optimization

The isolated `perf/world-optimization` branch combines world LOD `18cb4b1` with Луч-7 on `67fcaea`. The reference mission starts with 50 allied and 150 enemy infantry. This branch uses the LOD infantry scene for the comparison.

## Combat CPU

Chrome on Radeon 780M at 1365 × 768, DPR 1, High, dusk. Each row reports the median of three 20-second captures after warmup. Times are milliseconds. Draw and triangle counts report the mean per capture, then the median across captures.

| Scenario | Baseline p50 | CPU p50 | Baseline p95 | CPU p95 | Baseline pre-render p50 | CPU pre-render p50 |
|---|---:|---:|---:|---:|---:|---:|
| At the hangar | 21.1 | 19.2 | 24.1 | 21.9 | 3.8 | 1.7 |
| Drive toward the river and fire a salvo | 22.9 | 22.4 | 26.5 | 26.5 | 3.7 | 2.5 |
| Hold the cutting laser while changing heading | 24.3 | 20.8 | 28.5 | 24.1 | 4.7 | 2.1 |

| Scenario | Color calls before / after | Shadow calls before / after | Color triangles before / after | Shadow triangles before / after |
|---|---:|---:|---:|---:|
| At the hangar | 650 / 650 | 157 / 157 | 444,512 / 444,054 | 182,859 / 182,859 |
| Drive and salvo | 633 / 633 | 176 / 176 | 534,103 / 534,334 | 188,897 / 188,896 |
| Cutting laser | 653 / 653 | 157 / 157 | 448,505 / 448,129 | 182,858 / 182,858 |

A separate Chrome capture verified actual terrain impacts and damage to the scout APC in all three held-laser runs on each build.

The 342-ray fixture matched collider identity, hit distance, point and normal exactly. Median time per batch dropped from 213.5 ms to 91.4 ms in the local audit. The line-of-sight regression covers bridge edges, the ground surface and segments around the distance cutoffs. Chrome verified zero tracer draws at idle, compact draws during fire and ricochets, and zero instances again after expiry and mission reset.

## Loading the world

`bun run dev` and `bun run build` emit content-hashed grass and water data from the existing generators. The two maps match the generators byte for byte and total 768 KiB with gzip. The experimental baked terrain archive adds 4.90 MiB with gzip.

Use the same build and graphics preset for startup comparisons.

- `?autostart=1&graphics=balanced&terrain=worker` selects the worker, which is the current default.
- `?autostart=1&graphics=balanced&terrain=baked` loads the serialized terrain asset.

With three fresh Chrome profiles per variant, the desktop median to the first controllable frame was 38.3 s using the worker and 22.2 s using the archive. A cached archive reload reached that mark in about 3.8 s. These desktop captures shared the machine with other checks.

The `mecha-first-controllable-frame` performance mark records the first rendered combat frame after terrain readiness. For the physical iPhone comparison, measure cold navigations under the same network and device conditions. Choose baked terrain if the medians differ by at most 5%.

The two variants match across 134 tiles on positions, bounds, indices, LOD ranges and shoreline classification. The worker and desktop build differ by at most 1.5 × 10⁻⁸ in normal components. The 1,096 vertices along the ground and mountain perimeter have a maximum height difference of 1.4 × 10⁻⁵ world units.

## Rendering experiments

Run the experiments one at a time against the default rendering setup.

- `?graphics=balanced&bridgeCells=96` uses size 96 for color batching and 64 for shadow batching on the three bridges.
- `?graphics=balanced&shadowCadence=2` updates the sun shadow on alternating frames in Balanced. Lighting, camera and mission resets schedule an immediate update.

The overhead bridge view dropped from 91 to 56 color calls at 9,026 triangles. The bridge shadow pass stayed at 17 calls and 2,008 triangles in the overhead, cockpit and under-bridge captures. A real crossing-sector click worked in both configurations. The alternating shadow trial confirmed an immediate refresh on day lighting, mission reset, precision aim and the transition to overview. In the first isolated 20-second motion comparison, p95 was 21.1 ms with default rendering, 22.8 ms with split bridge batches and 22.3 ms with alternate-frame shadows. The candidate checks did not establish a movement p95 improvement sufficient to change the defaults.

The experiments are opt-in. Physical acceptance uses the [performance capture workflow](performance.md) on the iPhone 11 Pro Max and includes 15 minutes of combat, opening and closing captures, and movement p95. The targets are 60 FPS on desktop and 30 FPS on iPhone.

## Desktop endurance

The Radeon 780M completed 900 seconds of Balanced combat with no mission restarts and 39,067 frame intervals. The median was 22.0 ms and p95 was 29.0 ms. The opening window recorded 24.6 ms p50 and 31.1 ms p95. The closing window recorded 24.9 ms p50 and 113.1 ms p95 while separate browser checks were using the same machine. The session median corresponds to about 45 FPS.

A physical iPhone was unavailable. The cold iPhone startup selection and sustained iPhone frame-time validation remain pending.

The raw desktop captures, startup measurements and browser screenshots are in `.tools/world-lod-bench/` in the original checkout under the `optimization-` prefix.


## Streamed map overview

Open `?terrain=baked&entry=landmarks&surface=stream` for the interactive preview. Use `?terrain=baked&entry=landmarks&surface=quick` for the previous version that waits for the full world assets before rendering.

The build generates the compact ground and mountain meshes from the same tiles as the detailed terrain. The opening view uses quantized geometry and baked dusk colors for terrain, water, bridges and bases. After the first draw, the game requests the detailed terrain and the grass and water maps. The water material, near terrain and mountain ring enter on separate frames. Entering combat while the files are downloading queues the request. A failed download can be retried from the overview.
