# Reproduction and device QA

Use Node, Bun, ffmpeg and local Blender 5.2. No paid/cloud API is used.
The untouched source is versioned as `public/assets/infantry/source.glb`.
Scripts prefer the original root filename when present and otherwise use this copy.

```powershell
& 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/infantry/audit_model.py
& 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/infantry/build_asset.py
& 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/infantry/verify_roundtrip.py
& 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/infantry/render_previews.py -- --video
npm run lint
bun test
npm run build
node scripts/infantry/smoke.mjs
node scripts/infantry/smoke.mjs --hardware
node scripts/infantry/smoke.mjs --hardware --edge
node scripts/infantry/benchmark.mjs
node scripts/infantry/benchmark.mjs --software
node scripts/infantry/video.mjs
node scripts/infantry/report.mjs
npm run preview -- --host 0.0.0.0 --port 3000
```

Open `http://localhost:3000/?lab=infantry`. The test helpers start their own preview
server when needed. Run browser scripts sequentially, on an idle machine, after
building. Their headless profiles are separate from the user's browser. `CHROME`
and `LAB_ORIGIN` override executable/origin; Edge has its own flag. Existing
dependency peer conflicts may require `npm install --legacy-peer-deps`; this
task does not update the repository lockfile. On this installation Vite's dev
optimizer failed on dynamic imports, so all QA used the successful production build.

## Physical mobile acceptance — DEVICE QA NOT VERIFIED

No physical smartphone was available. SwiftShader is only a software correctness
and regression target. Radeon 780M results are desktop results. Neither measures
the eventual mission with AI, mech, terrain and battle effects.

1. Connect PC and physical phone to the same LAN; use the PC's actual LAN IP and
   port 3000 with the preview command above. Permit that local connection only
   if the host firewall requires it. Alternatively serve the same feature build
   from an existing HTTPS test host. Do not publish or merge main for this test.
2. Record device/model, OS/browser version, renderer/capabilities, battery and
   thermal state, viewport/DPR and graphics preset. Test Android Chrome and iOS
   Safari on physical devices. An emulated viewport is not a device test.
3. Use 1/20/100/200, Idle/Run/Mixed, 1 and 10 batches, low/balanced/high presets,
   and shadows on/off. Warm up 5 seconds, collect at least 20 seconds per case,
   repeat three times. The console API accepts `capture(5000,20000)`; JSON/CSV
   buttons export reports. GPU timings may be unavailable: retain null values.
4. Inspect close/formation/gameplay scale, enable root travel, orbit around knee,
   shoulder, rifle and backpack. Film actual playback and note any shader errors,
   clipping, foot sliding, state pops and normal-map changes.
5. Repeat 20→100→200→20 for ten minutes; compare settled geometry/texture counts,
   process memory trends, calls, p95/p99 and thermal throttling. Counts returning
   to baseline in a short smoke test do not prove a ten-minute leak-free session.
6. Only after art approval, test the intended real mission load. >=30 FPS on a weak
   phone is an acceptance target, not an achieved result of this isolated lab.
