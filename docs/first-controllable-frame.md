# Immediate battle entry

An early click on the battle button now prepares the player mech while the detailed world downloads. Once the overview sky has supplied its reflection texture, the scene builds the same materials and rig it will use in battle. On hardware WebGL with parallel shader compilation, it starts compiling the body and detached feet against the current lighting and environment. The two assemblies stay offscreen until the world is ready. Movement, combat, audio and camera control start through the existing battle path. Entering battle can proceed while compilation is still running.

## Where the time went on main

A Chrome trace of `4598780` measured 3,076 ms from `full-world-loaded` to `mecha-first-controllable-frame`. During this interval, material construction took 214 ms and rig construction took 58 ms. The first battle render started 436 ms after world readiness and occupied the main thread for 2,640 ms, submitting 428 draw calls and 150,422 triangles. CPU samples concentrated in the first use of WebGL programs. These wall times include browser and driver waits.

In a second instrumented run, individual draw submissions longer than 4 ms accounted for 1,573 ms in the mech group and 998 ms in the combat group. This included 279 ms for ground trails and 145 ms for armor debris. Building the infantry crowd took approximately 1 ms and occurred after the controllable-frame mark in that run.

## Why the reflection map matters

An initial implementation compiled the rig as soon as its JS module was available. In a diagnostic run, only one of the 15 shader programs seen on the mech during gameplay was already in the renderer cache at the end of preparation. The physical-material program keys showed that preparation had run before the sky supplied its environment texture. Over eight alternating pairs this version moved about 241 ms of work ahead of world readiness, with a median paired change of +7 ms from the click to control.

The revised implementation begins when the sky is mounted, checks the live environment texture, and includes both rig assemblies. In a separate diagnostic run 14 of the 15 programs subsequently observed on the mech were present in the cache. Preparation completed 1.14 s before world readiness. The remaining program was a depth shader.

## Measurement

Each pair used a production build of main and the candidate, in alternating order, in separate fresh Chrome profiles on a Radeon 780M. The viewport used a 1100 × 730 browser window and balanced graphics. Both builds used the same local gzip server with 12 Mbit/s down, 4 Mbit/s up and 35 ms emulated latency. A DOM observer clicked the first available battle button after the overview draw. Every click preceded full-world readiness.

The browser pressed forward and fire at the controllable-frame mark and sampled each animation frame until the mech moved more than 0.05 world units and the tracer, muzzle flash and casing pools each had a live instance. Overview and control are renderer submission marks. Motion and flash denote the first sampled frame with the corresponding scene state. Timing runs used neither CPU tracing nor draw-call wrappers.

Background load was sampled about twice a second, excluding the benchmark browser processes. Each run started after a six-second window with median system CPU at most 20% and peak external 3D at most 5%. Each phase was also checked for comparable load across the pair, using median external CPU at most 30%, a CPU difference of at most 10 percentage points and peak external 3D at most 8% in both runs. The CSV gives times in ms and phase-specific median external CPU and peak external 3D in percent. [Per-run timings](first-controllable-frame.csv)

## Results with the reflection map ready

| Interval | Main median | Candidate median | Median paired change |
| --- | ---: | ---: | ---: |
| Navigation to overview draw | 1.443 s | 1.471 s | +0.011 s |
| Click to world readiness | 4.251 s | 4.132 s | +0.040 s |
| World readiness to control | 2.927 s | 1.321 s | −1.606 s |
| Click to control | 7.093 s | 5.480 s | −1.576 s |
| Click to motion and first muzzle flash | 7.466 s | 5.877 s | −1.584 s |

The table uses all eight pairs. The paired change is the median of the eight individual differences. The candidate reached control 1.07–1.75 s earlier in every pair. Motion and the first flash occurred on the same sampled frame in each run. All eight pairs passed the load criteria during battle entry and input response. Six passed during overview startup, where the median paired change was also +11 ms. The interval from click to world readiness varied by up to 568 ms slower in one pair. These results cover cold immediate battle entry on one desktop GPU.

Separate browser checks covered cancellation during compilation followed by another early click, a browser context with the parallel compilation extension disabled, and direct battle entry. A blocked mech module recovered using the existing retry button. The completed overview contained the mech and infantry, and the first burst after recovery emitted tracers, muzzle flashes and casings.
