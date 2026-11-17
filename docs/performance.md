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
