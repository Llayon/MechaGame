# MechaGame — performance profiling

The profiler is opt-in: normal gameplay has no sampling overhead except a cheap
disabled check in the R3F frame loop.

## Measure on a physical PC or phone

1. Open \`https://llayon.github.io/MechaGame/?autostart=1&profile=1\`
   on **that physical device** (Chrome, Android Chrome, iPhone Safari).
   On a keyboard, F8 also toggles the overlay.
2. Use a consistent lighting preset and play/turn/move for ~5 seconds to let
   assets and shaders warm up. Avoid menus and pause during a capture.
3. Tap **Записать 20 с**; continue similar gameplay for the full capture.
4. Save **JSON** (summary + frame samples + environment) and optional CSV.
   Share these files to compare a physical PC versus a physical phone.

### Metrics, interpretation and limitations

- FPS is calculated from real elapsed intervals between R3F animation-frame callbacks.
  It is **not** the CPU render function duration or GPU fragment execution time.
- \`p50Ms\`, \`p95Ms\`, \`p99Ms\` describe inter-frame time tails; high p95 is
  stutter even if the average FPS is okay.
- \`drawCallsMean\` and \`trianglesMean\` are previous-frame Three.js WebGLRenderer
  counters, not GPU utilization.
- \`geometries\` and \`textures\` are Three.js resource counts, **not** VRAM MB.
- Chromium may expose JavaScript heap MB; mobile Safari often does not.
- GPU utilization, VRAM usage, GPU busy time and CPU power are not available through
  stable standard browser APIs; use native device/OS profilers for those.

### Rough targets (not pass/fail guarantees)

- Desktop target: ~60 FPS / p95 under 25 ms in the same gameplay segment.
- Mobile target: ~30 FPS / p95 under 45 ms and low >50 ms stutter counts.
- Compare **like-for-like scenarios** on physical hardware, same quality settings,
  same battle route, same device orientation and warm-up.

## World detail and profiling

Open the graphics menu with **G** to set object detail or enable adaptive quality
at 30, 45 or 60 FPS. Adaptive quality is opt-in. It lowers render resolution,
shadow detail, object detail, grass density and particle quality in that order.
It takes several slow sampling windows to lower quality and a longer sustained
recovery to raise it. Changing the saved settings starts a fresh evaluation.

Open **F8 → Цвета LOD** to inspect the active visual levels. Green, yellow, red
and purple correspond to levels 0 through 3. The JSON capture includes the
settings, per-frame main and shadow pass counters, and a scene inventory at the
end of the recording. Per-group `lodInstances` counts are taken before frustum
culling. For the infantry group, the four visual counts sum to the live
population. Shadow and contact representations have their own draw calls.

Ground and mountain tiles cache vertex data and select an index range at run
time. Trees keep their simulation ID when the mesh level changes. Patrol squads
use one 157,248-byte bone matrix atlas for all four infantry meshes. A vertex
animation texture would need a separate mapping for each mesh topology.
`scripts/infantry/bake-crowd.mjs` rebuilds the assets from the Git revision
recorded in `public/assets/crowd/atlas.json`. The source revision must be present
in the local Git object database. Regenerate the patrol lanes with
`bun scripts/infantry/bake-patrols.ts` after changing the walkable map.

## Local desktop GPU comparison

Build and start a production preview, then run
`node scripts/perf-benchmark.mjs --hardware` with the preview URL in
`BENCH_ORIGIN` and the Chrome executable in `CHROME`. The script starts at the
combat spawn, warms the scene for five seconds and captures twenty seconds at
1365 × 768, DPR 1. It checks the renderer and records its name in the JSON report.
Use `BENCH_OUTPUT` to keep separate results for two revisions.

## Reproducible CI smoke/relative benchmark

The \`MechaGame performance benchmark\` GitHub Actions workflow runs Chrome on
GitHub-hosted Ubuntu with **SwiftShader software WebGL**, in two configurations:
desktop 1365×768 DPR1, and emulated Android touch 390×844 DPR2. It uses real
wall-clock capture time, warm-up, and Chrome DevTools Protocol (not virtual time).
Reports are uploaded as \`mech-perf-swiftshader-reports\` artifacts.

**Important:** Mobile emulation is **not** a phone. It uses the runner's CPU-based
SwiftShader instead of iPhone/Android GPU hardware. The CI numbers only prove that
the profiler works and offer a repeatable software-rendering comparison. They are
not evidence of real device performance. Never mark a physical device as measured
unless its own JSON export has been collected.

### Capture data and privacy

The JSON contains user agent, viewport dimensions, approximate reported device
capabilities and frame statistics. It contains **no screenshots or images** and
is generated entirely locally on the device. Review before sharing.
