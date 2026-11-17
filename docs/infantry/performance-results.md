# Measured infantry laboratory results

Generated from committed JSON, 2026-11-17T16:35:09.840Z. All numbers below are the arithmetic
mean of the two independently warmed captures for each scenario (percentiles are
averages of capture percentiles, not pooled quantiles). Raw frame samples and CSV
are in [benchmarks](benchmarks/). No FPS is inferred from draw calls.

## Available desktop hardware

Renderer: ANGLE (AMD, AMD Radeon 780M Graphics (0x00001900) Direct3D11 vs_5_0 ps_5_0, D3D11).
Headless Chrome production build, high preset, fixed 1280x800 browser window;
actual viewport/DPR are recorded in each raw report. Warmup 1000 ms, capture
2000 ms, repeated twice. These short runs verify this isolated scene; they are
not prolonged thermal, maximum-throughput or full-mission acceptance measurements.
Near 60 FPS indicates scheduling/VSync limitation. JS update excludes renderer
submission; sub-0.1 ms readings are below browser clock precision. GPU timings
are asynchronous fresh timer-query results, and include floor/grid/shadows.

| N | Clip | Batches | Shadow | Camera | CPU matrix uploads | FPS | p50 ms | p95 ms | p99 ms | Calls | Triangles | JS p95 ms | GPU p95 ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | idle | 1 | false | medium | false | 60.00 | 16.65 | 17.25 | 17.70 | 3.00 | 1249 | 0.00 | 1.52 |
| 1 | run | 1 | false | medium | false | 60.00 | 16.70 | 17.30 | 17.55 | 3.00 | 1249 | 0.00 | 1.49 |
| 20 | idle | 1 | false | medium | false | 60.00 | 16.70 | 17.40 | 17.55 | 3.00 | 24942 | 0.05 | 1.68 |
| 20 | idle | 10 | false | medium | false | 59.98 | 16.70 | 17.40 | 17.65 | 12.00 | 24942 | 0.05 | 1.68 |
| 20 | run | 1 | false | medium | false | 60.03 | 16.70 | 17.35 | 18.35 | 3.00 | 24942 | 0.05 | 1.70 |
| 20 | run | 10 | false | medium | false | 59.99 | 16.65 | 17.40 | 17.90 | 12.00 | 24942 | 0.00 | 1.67 |
| 20 | mixed | 1 | false | medium | false | 59.99 | 16.60 | 17.45 | 17.75 | 3.00 | 24942 | 0.00 | 1.68 |
| 20 | mixed | 10 | false | medium | false | 60.00 | 16.65 | 17.35 | 17.55 | 12.00 | 24942 | 0.00 | 1.67 |
| 100 | idle | 1 | false | medium | false | 60.00 | 16.70 | 17.60 | 17.85 | 3.00 | 124702 | 0.05 | 1.98 |
| 100 | idle | 10 | false | medium | false | 60.01 | 16.65 | 17.55 | 17.90 | 12.00 | 124702 | 0.10 | 1.96 |
| 100 | run | 1 | false | medium | false | 59.98 | 16.65 | 17.40 | 17.50 | 3.00 | 124702 | 0.05 | 1.97 |
| 100 | run | 10 | false | medium | false | 60.00 | 16.60 | 17.45 | 17.90 | 12.00 | 124702 | 0.05 | 1.97 |
| 100 | mixed | 1 | false | medium | false | 59.99 | 16.65 | 17.40 | 17.70 | 3.00 | 124702 | 0.00 | 1.98 |
| 100 | mixed | 10 | false | medium | false | 60.00 | 16.70 | 17.45 | 17.85 | 12.00 | 124702 | 0.00 | 1.97 |
| 200 | idle | 1 | false | medium | false | 60.01 | 16.70 | 17.10 | 17.20 | 3.00 | 249402 | 0.00 | 1.88 |
| 200 | idle | 10 | false | medium | false | 59.97 | 16.70 | 17.55 | 18.30 | 12.00 | 249402 | 0.00 | 2.31 |
| 200 | run | 1 | false | medium | false | 60.00 | 16.70 | 17.40 | 17.65 | 3.00 | 249402 | 0.05 | 2.36 |
| 200 | run | 10 | false | medium | false | 60.00 | 16.70 | 17.25 | 17.50 | 12.00 | 249402 | 0.00 | 2.32 |
| 200 | mixed | 1 | false | medium | false | 59.99 | 16.65 | 17.15 | 17.35 | 3.00 | 249402 | 0.00 | 2.33 |
| 200 | mixed | 10 | false | medium | false | 60.00 | 16.70 | 17.20 | 18.70 | 12.00 | 249402 | 0.00 | 2.36 |
| 200 | mixed | 1 | true | medium | false | 60.00 | 16.65 | 17.20 | 17.45 | 4.00 | 498802 | 0.00 | 2.82 |
| 200 | mixed | 1 | false | close | false | 60.00 | 16.70 | 17.10 | 17.25 | 3.00 | 249402 | 0.00 | 2.80 |
| 200 | mixed | 1 | false | medium | true | 60.00 | 16.70 | 17.00 | 17.10 | 3.00 | 249402 | 0.20 | 2.41 |
| 200 | mixed | 10 | true | medium | false | 60.01 | 16.70 | 17.20 | 18.20 | 22.00 | 498802 | 0.10 | 2.87 |
| 200 | mixed | 10 | false | close | false | 60.00 | 16.70 | 17.20 | 17.40 | 10.00 | 199522 | 0.05 | 1.94 |
| 200 | mixed | 10 | false | medium | true | 60.01 | 16.70 | 17.20 | 17.40 | 12.00 | 249402 | 0.15 | 2.38 |

One infantry batch without shadows contributes one draw; plane and grid add two.
200 actors submit 249400 character triangles, plus two floor triangles. Animated
shadows add another character pass. The close view can cull whole spatial groups
in configuration B, whereas A retains the entire population. Therefore the
relative benefit depends on camera coverage and vertex work, not merely draw count.

Default frame matrix uploads and CPU skeleton updates are zero. Comparison cases
explicitly upload N matrices/frame; setup writes occur once on creation and are
outside steady-state JS update timing. Their latency is separately recorded in
index.json switches (includes React commit, CDP and 150 ms polling).

Continuous 20→100→200→20 transition capture: 60.01 FPS;
p50/p95/p99 16.60/17.70/33.40 ms;
worst 34.50 ms, frames over 33.33 ms 3.
This capture keeps frame history across changes instead of resetting away spikes.

## Software WebGL — correctness/regression only

Renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver).
Do not interpret this table as a real GPU or smartphone measurement.

| N | Clip | Batches | Shadow | Camera | CPU matrix uploads | FPS | p50 ms | p95 ms | p99 ms | Calls | Triangles | JS p95 ms | GPU p95 ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20 | mixed | 1 | false | medium | false | 17.27 | 57.85 | 64.65 | 65.25 | 3.00 | 24942 | 0.00 | n/a |
| 20 | mixed | 10 | false | medium | false | 17.63 | 56.75 | 62.25 | 63.30 | 12.00 | 24942 | 0.05 | n/a |
| 100 | mixed | 1 | false | medium | false | 8.34 | 120.30 | 125.20 | 125.20 | 3.00 | 124702 | 0.00 | n/a |
| 100 | mixed | 10 | false | medium | false | 8.67 | 114.80 | 123.45 | 123.45 | 12.00 | 124702 | 0.05 | n/a |
| 200 | mixed | 1 | false | medium | false | 4.91 | 202.15 | 215.00 | 215.00 | 3.00 | 249402 | 0.00 | n/a |
| 200 | mixed | 10 | false | medium | false | 4.95 | 200.40 | 210.15 | 210.15 | 12.00 | 249402 | 0.00 | n/a |

## Limits and acceptance

**DEVICE QA NOT VERIFIED.** No physical smartphone, Safari or Firefox was available.
Chrome and Edge are separate browser runs but both use Chromium/ANGLE; they are
not evidence of independent browser-engine compatibility. Resource counters return
to baseline after 20→100→200→20 in smoke tests; no ten-minute leak/thermal test was
performed. Owned geometry/atlas/configuration/matrix byte counts are in raw JSON;
WebGL memory.geometries counts wrappers rather than unique shared vertex buffers,
and total GPU VRAM cannot be inferred from it. Short captures do not prove absence
of all memory leaks. Desktop 200-actor stability and weak-phone >=30 FPS in the
eventual target mission remain acceptance goals. See [device procedure](reproduce.md).
