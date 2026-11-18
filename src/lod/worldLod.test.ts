import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { chooseLod, projectedPixels, readWorldLod, viewDepth } from './worldLod';
import { AdaptiveFrameWindow, effectiveGraphics } from './adaptiveQuality';
import { withGraphicsPreset, sanitizeGraphicsSettings } from '../game/graphicsSettings';

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

test('auto quality waits for sustained load and leaves saved manual settings intact', () => {
  const window = new AdaptiveFrameWindow();
  let step = 0;
  for (let i = 0; i < 90; i++) step = window.sample(.05, 60, step);
  assert.equal(step, 0);
  for (let i = 0; i < 40; i++) step = window.sample(.05, 60, step);
  assert.equal(step, 1);
  for (let i = 0; i < 1600; i++) step = window.sample(1/60, 60, step);
  assert.equal(step, 0);
  const settings = withGraphicsPreset('high');
  assert.equal(effectiveGraphics(settings, 5), settings);
  const active = {...settings, autoQuality:true};
  assert.equal(effectiveGraphics(active, 4).vegetation, 'reduced');
  assert.equal(effectiveGraphics({...withGraphicsPreset('balanced'), autoQuality:true}, 4).vegetation, 'minimal');
  assert.equal(effectiveGraphics(active, 4).particles, 'full');
  assert.equal(active.resolutionScale, 1);
});

test('previously saved low preset acquires the matching object-detail setting', () => {
  const {objectDetail, autoQuality, targetFps, ...legacy} = withGraphicsPreset('low');
  assert.deepEqual(sanitizeGraphicsSettings(legacy), {...legacy, objectDetail, autoQuality, targetFps});
});
