# V-Pulse GPU lab measurements

Open `?lab=infantry&kit=vpulse` and select a formation size and animation. The benchmark uses the 999-triangle Rigify character with the 458-triangle rifle. Each visible batch submits one body draw and one rifle draw per render pass. The scene’s floor and grid add two draws and two triangles to the color pass.

Body and rifle read the same RGBA16F atlas and share the instance matrices, clip selection, phase and playback rate. The rigid rifle shader samples only `hand_R`. CPU work during a regular frame updates time, with zero skeleton or instance matrix updates. The opt-in matrix upload comparison updates one shared matrix per soldier. For 200 soldiers, the report counts 155,790 bytes for geometry, 123,264 bytes for the atlas, 12,800 bytes for matrices and 3,200 bytes for per-instance settings. These are buffer sizes, excluding textures and driver allocations.

| Soldiers | Batches per mesh | Shadows | Draws | Rendered triangles | FPS | Frame p95 | GPU p95 |
| ---: | ---: | :---: | ---: | ---: | ---: | ---: | ---: |
| 20 | 1 | off | 4 | 29,142 | 59.9–60.0 | 18.3–18.7 ms | 0.87–0.92 ms |
| 100 | 1 | off | 4 | 145,702 | 59.9 | 17.4–17.8 ms | 1.29–1.33 ms |
| 200 | 1 | off | 4 | 291,402 | 59.9 | 17.2–17.5 ms | 1.77–1.80 ms |
| 200 | 10 | off | 22 | 291,402 | 59.8–59.9 | 18.4–18.6 ms | 1.77–1.78 ms |
| 200 | 1 | on | 6 | 582,802 | 59.9 | 17.2–18.0 ms | 2.48–2.70 ms |

Chrome on AMD Radeon 780M, WebGL2 via ANGLE D3D11. Each case was captured twice with 800 ms of warm-up and 1.5 s of sampling at a requested 1280 × 800 viewport with the High preset. These are short lab samples with a mostly static environment. [Chrome JSON](chrome/summary.json) · [Chrome CSV](chrome/summary.csv)

In the ten-batch case, close inspection culled two body-and-rifle pairs, taking the scene from 22 to 18 draws. Geometry and texture counts remained at 22 and 7 after three 200→20→200 rebuilds. The browser checked all eight clips and logged zero shader or runtime errors. [20 soldiers](chrome/formation-20.png) · [100 soldiers](chrome/formation-100.png) · [200 soldiers](chrome/formation-200.png) · [Close fire pose](chrome/close-fire.png)

SwiftShader measured 17.7, 8.8 and 4.9 FPS for one batch per mesh with 20, 100 and 200 soldiers. This run uses software rendering. Physical mobile performance remains unverified. [SwiftShader JSON](swiftshader/summary.json) · [SwiftShader CSV](swiftshader/summary.csv)

Build with `npm run build` and run `node scripts/infantry/armed_benchmark.mjs` against the Vite preview. Pass `--software` to select SwiftShader or `--edge` to use Edge. Set `LAB_ORIGIN` if the preview uses a different port.
