import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { chooseLod, projectedPixels, readWorldLod, viewDepth } from './worldLod';
import {
  AdaptiveDrsController,
  DRS_CONTEXT_LOST_CAP,
  DRS_INITIAL_RECOVERY_WAIT,
  DRS_MAX_RECOVERY_WAIT,
  DRS_STORAGE_KEY,
  MAX_CASCADE_STEP,
  MIN_DRS_SCALE,
  applyContextLostFallback,
  clearPersistedDrs,
  createInitialAdaptiveState,
  effectiveGraphics,
  isAdaptiveDegraded,
  readPersistedDrs,
  savePersistedDrs,
  type AdaptiveState,
} from './adaptiveQuality';
import { withGraphicsPreset, sanitizeGraphicsSettings } from '../game/graphicsSettings';

function feedWindow(
  controller: AdaptiveDrsController,
  frameDelta: number,
  targetFps: number,
  baseScale: number,
  state: AdaptiveState,
  spikeDelta?: number,
): AdaptiveState {
  let next = state;
  let elapsed = 0;
  let injected = false;
  while (elapsed < 1.02) {
    const dt = !injected && spikeDelta != null ? (injected = true, spikeDelta) : frameDelta;
    next = controller.sample(dt, targetFps, baseScale, next);
    elapsed += dt;
  }
  return next;
}

test('screen projection uses effective camera FOV and two-sided hysteresis', () => {
  const camera = new THREE.PerspectiveCamera(45, 1);
  const view = readWorldLod(camera);
  const pixels = () => {
    camera.updateProjectionMatrix();
    view.focalPixels = 384 * camera.projectionMatrix.elements[5];
    return projectedPixels(.9, viewDepth(camera, 0, 0, -80), view);
  };
  assert.equal(Math.round(pixels()), 21);
  camera.fov = 29;
  assert.equal(Math.round(pixels()), 33);
  assert.equal(chooseLod(33, -1, [50,30,12]), 1);
  assert.equal(chooseLod(29, 1, [50,30,12]), 1);
  assert.equal(chooseLod(24, 1, [50,30,12]), 2);
  assert.equal(chooseLod(31, 2, [50,30,12]), 2);
  assert.equal(chooseLod(36, 2, [50,30,12]), 1);
});

test('DRS discards single longest spike frame per 1s window and ignores >=1s glitches', () => {
  const controller = new AdaptiveDrsController();
  const settings = { ...withGraphicsPreset('high'), autoQuality: true };
  let state = createInitialAdaptiveState(settings);

  // 4 windows running at 60 FPS (16.6ms) each with a 240ms GC/shader hitch.
  for (let w = 0; w < 4; w++) {
    state = feedWindow(controller, 1 / 60, 60, 1.0, state, 0.24);
  }
  assert.equal(state.drsScale, 1.0);
  assert.equal(state.cascadeStep, 0);

  // Background-tab glitch frame (>= 1s) resets window without penalizing scale.
  state = controller.sample(2.5, 60, 1.0, state);
  assert.equal(state.drsScale, 1.0);
  assert.equal(state.cascadeStep, 0);
});

test('Phase 1 DRS steps down after 2 slow windows, hits 0.5 floor, then Phase 2 escalates & recovers in reverse order', () => {
  const controller = new AdaptiveDrsController();
  const settings = { ...withGraphicsPreset('high'), autoQuality: true };
  let state = createInitialAdaptiveState(settings);

  // Single slow window (30 FPS vs 60 target) does not drop yet.
  state = feedWindow(controller, 1 / 30, 60, 1.0, state);
  assert.equal(state.drsScale, 1.0);

  // Second consecutive slow window triggers proportional Phase 1 DRS drop (effects untouched).
  state = feedWindow(controller, 1 / 30, 60, 1.0, state);
  assert.ok(state.drsScale < 1.0 && state.drsScale >= 0.75, `expected proportional drop, got ${state.drsScale}`);
  assert.equal(state.cascadeStep, 0);
  const effPhase1 = effectiveGraphics(settings, state);
  assert.equal(effPhase1.resolutionScale, state.drsScale);
  assert.equal(effPhase1.vegetation, 'full');
  assert.equal(effPhase1.particles, 'full');

  // Simulate GPU fill-rate bound load (each DRS drop improves frame time by >4% until 0.5 floor).
  let frameMs = 31;
  for (let i = 0; i < 20 && state.drsScale > MIN_DRS_SCALE; i++) {
    const prevScale = state.drsScale;
    state = feedWindow(controller, frameMs / 1000, 60, 1.0, state);
    if (state.drsScale < prevScale) frameMs = Math.max(22, frameMs * 0.91);
  }
  assert.equal(state.drsScale, MIN_DRS_SCALE);
  assert.equal(state.cascadeStep, 0);

  // Sustained load at 0.50 floor escalates into Phase 2 (cascadeStep 1 -> 4).
  for (let i = 0; i < 12; i++) {
    state = feedWindow(controller, 1 / 30, 60, 1.0, state);
  }
  assert.equal(state.drsScale, MIN_DRS_SCALE);
  assert.equal(state.cascadeStep, MAX_CASCADE_STEP);
  assert.ok(state.recoveryWait > DRS_INITIAL_RECOVERY_WAIT && state.recoveryWait <= DRS_MAX_RECOVERY_WAIT);

  const effFloor = effectiveGraphics(settings, state);
  assert.equal(effFloor.resolutionScale, MIN_DRS_SCALE);
  assert.equal(effFloor.vegetation, 'reduced');
  assert.equal(effFloor.particles, 'reduced');
  assert.equal(effectiveGraphics({ ...withGraphicsPreset('balanced'), autoQuality: true }, state).vegetation, 'minimal');

  // Deadband (e.g. 58 FPS -> ratio 1.03) holds completely steady without breathing.
  const locked = state;
  for (let i = 0; i < 20; i++) {
    state = feedWindow(controller, 1 / 58, 60, 1.0, state);
  }
  assert.deepEqual(state, locked);

  // Recovery under abundant headroom (120 FPS) restores Phase 2 steps BEFORE raising drsScale.
  let sawEffectRestoredBeforeScale = false;
  for (let i = 0; i < 600; i++) {
    const prev = state;
    state = feedWindow(controller, 1 / 120, 60, 1.0, state);
    if (state.cascadeStep < prev.cascadeStep) {
      assert.equal(state.drsScale, MIN_DRS_SCALE, 'drsScale must stay at floor until cascadeStep returns to 0');
      sawEffectRestoredBeforeScale = true;
    }
    if (state.drsScale > prev.drsScale) {
      assert.equal(state.cascadeStep, 0, 'cascadeStep must be 0 before drsScale rises');
    }
    if (state.drsScale === 1.0 && state.cascadeStep === 0 && state.recoveryWait === DRS_INITIAL_RECOVERY_WAIT) {
      break;
    }
  }
  assert.ok(sawEffectRestoredBeforeScale);
  assert.equal(state.drsScale, 1.0);
  assert.equal(state.cascadeStep, 0);
  assert.equal(state.recoveryWait, DRS_INITIAL_RECOVERY_WAIT);
});

test('CPU bottleneck detection escalates to Phase 2 without unnecessarily blurring to 50%', () => {
  const controller = new AdaptiveDrsController();
  const settings = { ...withGraphicsPreset('high'), autoQuality: true };
  let state = createInitialAdaptiveState(settings);

  // Constant 28ms frame time regardless of resolution scale => CPU/draw-call bound.
  for (let i = 0; i < 8; i++) {
    state = feedWindow(controller, 0.028, 60, 1.0, state);
  }
  assert.ok(state.drsScale > MIN_DRS_SCALE, `expected scale above 0.5 floor, got ${state.drsScale}`);
  assert.ok(state.cascadeStep >= 1, `expected early Phase 2 escalation, got step ${state.cascadeStep}`);
});

test('exponential backoff doubles wait on repeated drops to prevent oscillation', () => {
  const controller = new AdaptiveDrsController();
  const settings = { ...withGraphicsPreset('high'), autoQuality: true };
  let state = createInitialAdaptiveState(settings);

  // Drop 1: wait stays at initial 4s.
  state = feedWindow(controller, 1 / 40, 60, 1.0, state);
  state = feedWindow(controller, 1 / 40, 60, 1.0, state);
  assert.equal(state.recoveryWait, DRS_INITIAL_RECOVERY_WAIT);

  // Drop 2 while degraded: wait doubles to 8s.
  state = feedWindow(controller, 1 / 40, 60, 1.0, state);
  state = feedWindow(controller, 1 / 40, 60, 1.0, state);
  assert.equal(state.recoveryWait, DRS_INITIAL_RECOVERY_WAIT * 2);

  // Drop 3: wait doubles to 16s.
  state = feedWindow(controller, 1 / 40, 60, 1.0, state);
  state = feedWindow(controller, 1 / 40, 60, 1.0, state);
  assert.equal(state.recoveryWait, DRS_INITIAL_RECOVERY_WAIT * 4);
});

test('persisted DRS cache restores tuned scale without mutating user settings and clears at 100%', () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };

  const settings = { ...withGraphicsPreset('high'), autoQuality: true };
  const degraded: AdaptiveState = {
    drsScale: 0.75,
    cascadeStep: 1,
    recoveryWait: 8,
    contextLostFallback: false,
  };

  savePersistedDrs(settings, degraded, storage);
  assert.ok(store.has(DRS_STORAGE_KEY));

  const restored = readPersistedDrs(settings, storage);
  assert.ok(restored);
  assert.equal(restored.drsScale, 0.75);
  assert.equal(restored.cascadeStep, 1);
  // Original user setting remains untouched.
  assert.equal(settings.resolutionScale, 1.0);

  // Changing target FPS invalidates signature so stale cache is ignored.
  assert.equal(readPersistedDrs({ ...settings, targetFps: 30 }, storage), null);

  // Returning to 100% clears persisted cache automatically.
  savePersistedDrs(settings, createInitialAdaptiveState(settings), storage);
  assert.equal(store.has(DRS_STORAGE_KEY), false);

  // Context lost fallback caps scale at <= 0.70 and persists cleanly.
  const fallback = applyContextLostFallback(createInitialAdaptiveState(settings), settings);
  assert.equal(fallback.drsScale, DRS_CONTEXT_LOST_CAP);
  assert.equal(fallback.contextLostFallback, true);
  assert.ok(fallback.recoveryWait >= 16);
  assert.equal(isAdaptiveDegraded(fallback, settings), true);
  savePersistedDrs(settings, fallback, storage);
  const restoredFallback = readPersistedDrs(settings, storage);
  assert.equal(restoredFallback?.drsScale, DRS_CONTEXT_LOST_CAP);
  assert.equal(restoredFallback?.contextLostFallback, true);

  clearPersistedDrs(storage);
  assert.equal(store.has(DRS_STORAGE_KEY), false);
});

test('effectiveGraphics leaves settings untouched when autoQuality is off', () => {
  const manual = withGraphicsPreset('high');
  const degraded: AdaptiveState = {
    drsScale: 0.5,
    cascadeStep: 4,
    recoveryWait: 16,
    contextLostFallback: false,
  };
  assert.equal(effectiveGraphics(manual, degraded), manual);
});

test('previously saved low preset acquires the matching object-detail setting', () => {
  const {objectDetail, autoQuality, targetFps, ...legacy} = withGraphicsPreset('low');
  assert.deepEqual(sanitizeGraphicsSettings(legacy), {...legacy, objectDetail, autoQuality, targetFps});
});
