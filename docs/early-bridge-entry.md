# Detailed bridges after an early battle handover

Two cold runs of the preceding ruins experiment handed control to the player on stage 2. The next stage included post-control intervals of 1,339 and 1,354 ms. In the usual stage 3 handover this bridge work can land before or within the controllable frame and is excluded from post-control peaks.

## Reproduction on main

The control is the published stage 4 merge `8b0f058`. To reproduce the rare handover, a browser-only probe held the stage 2 streaming timer until the first controllable frame, then released it on the next poll (15 ms). The game still built the same scene, rendered the mech and accepted input through its usual battle entry. This probe alters the arrival order and cannot estimate how often the issue occurs. Separate natural runs used the unmodified timer.

In two diagnostic drives the stage 3 interval was 1,451 and 1,461 ms. The renderer occupied 1,156 and 1,181 ms. In the first color draw of the central bridge's batched concrete, the renderer spent 936 and 950 ms respectively. Seven programs appeared during the render. Smaller first draws included other concrete variants, the viaduct searchlight beam and the lens. WebGL program-log queries occupied 1,089 and 1,114 ms across the two renders. Those measurements include time waiting for the driver and do not isolate the GPU cost of drawing concrete.

## Experiment

When a streamed hardware battle gives control before stage 3 and supports parallel shader compilation, the crossing keeps its baked overview mesh while the detailed bridges mount and compile with the active camera and lights. The switch enables the detailed group and removes the preview in the same scene update. Driver rejection or a 1,500 ms timer releases the detailed draw. Each other sector follows its existing stage schedule.

The first version submitted the bridge group in a layout effect. Across eight early-handover pairs the median worst interval after control fell from 1,220 to 473 ms. However, the median stage 4 peak rose from 51 to 307 ms. In the diagnostic drive the first draw of the ruins' concrete took 202 ms while the bridge compilation was pending. A second version gave the ruins' layout effect priority and submitted the bridges in a passive effect.

In the two pilot pairs, changing submission order alone left a median stage 4 peak of 215 ms. The 120 ms fallback for the ruins had already expired by the time they were requested. In the final version, the ruins can appear as soon as their programs settle. While the bridge batch is pending, the ruins wait for their own completion or the normal end of stage 4. Once the bridge is released, the usual 120 ms fallback is available. The bridge timeout also covers a driver that never settles its promise.

Each timing pair used fresh Chrome profiles on Radeon 780M, balanced graphics with a fixed resolution scale of 0.85, AgX and an 1100 × 730 viewport. The local production builds used emulated 12 Mbit/s download, 4 Mbit/s upload and 35 ms latency. The route enters battle from the overview and moves one world unit. The firing route also fires once on stage 10. Frame intervals run between completed scene renders. The post-control window excludes the handover frame and ends after eight renders on stage 16. Timing runs exclude CPU tracing, fault injection and geometry readback. [Individual runs for all three versions](early-bridge-entry.csv)

## Final early-handover comparison

| Median across six runs per build | Published main | Early bridge preparation |
| --- | ---: | ---: |
| Click to first controllable frame | 4,942.5 ms | 4,947.5 ms |
| Worst post-control interval through stage 16 | 1,176 ms | 402 ms |
| First detailed bridge interval | 1,176 ms | 76 ms |
| Control to first detailed bridge | 1,308 ms | 1,604.5 ms |
| Stage 4 peak | 48 ms | 38 ms |
| Stage 5 peak (rounded) | 241 ms | 356 ms |
| Control to first ruins (rounded) | 1,657 ms | 1,481 ms |
| Control to stage 16 | 6,055 ms | 5,361 ms |

All six pairs improved the worst post-control interval by 730–805 ms. The baked crossing stayed on screen until the detailed bridges appeared on stage 5 in every candidate run. The main build showed the detailed bridges on stage 3. The candidate first drew the ruins on stage 4 once and on stage 5 five times. Those five reveal intervals took 331–384 ms alongside other stage 5 work. Stage 4 timing alone would conceal this cost.

Both natural pairs handed over on stage 3 and skipped the new bridge preparation. Their median worst post-control intervals were 222 ms on main and 225.5 ms in the candidate, on stage 12 in every run. This small sample checks the ordinary path and does not establish a change to general startup performance.

In the final instrumented drive the residual stage 3 interval included 264 ms outside the renderer and 195 ms inside. The first mech depth draw occupied 181 ms. CPU sampling attributed approximately 59 ms outside the renderer to static geometry batching. The long stage 5 intervals and the shader wait in the mech's shadow pass are separate follow-up targets.

At a stationary camera on stage 16 the two builds produced 91 matching visible bridge draw signatures, including vertex and index buffer hashes, instance matrices, material colors and shadow flags. All four baked world binaries matched by SHA-256. During early handover the visibility probe checked the preview and detailed group on every sampled scene render through stage 7.

Fault-injection runs showed the detailed bridge on stage 3 after a rejection and on stage 7 when the promise never settled (1,630 ms from submission to completed render). Removing the parallel compilation extension used the existing stage 3 reveal. The preview and detailed bridge were mutually exclusive, with one present at every sampled frame in these three checks.
