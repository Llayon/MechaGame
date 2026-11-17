import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { projectMuzzleDirection, smoothMuzzleIndicator } from './reticlePresentation';

function forwardCamera() {
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, .1, 500);
  camera.position.set(6, 4, -20);
  camera.lookAt(6, 4, 20); // actual MechaGame camera looks toward +Z
  camera.updateMatrixWorld(true);
  return camera;
}

test('physical muzzle heading is projected relative to camera view, not world-space hit depth', () => {
  const camera = forwardCamera();
  const barrel = new THREE.Vector3(0, 0, 1);
  const projected = projectMuzzleDirection(camera, barrel);
  assert.ok(projected);
  assert.ok(Math.abs(projected.x) < 1e-6);
  assert.ok(Math.abs(projected.y) < 1e-6);
  // Changing distance/position with an identical view has no screen parallax.
  camera.position.set(-15, 12, -65);
  camera.lookAt(-15, 12, -40);
  camera.updateMatrixWorld(true);
  const after = projectMuzzleDirection(camera, barrel);
  assert.ok(after);
  assert.ok(Math.abs(projected.x - after.x) < 1e-6);
  assert.ok(Math.abs(projected.y - after.y) < 1e-6);
});

test('physical gun direction displays independent angular lag, screen right vs screen left', () => {
  const camera = forwardCamera();
  const left = projectMuzzleDirection(camera, new THREE.Vector3(0.08, 0, 1));
  const right = projectMuzzleDirection(camera, new THREE.Vector3(-0.08, 0, 1));
  const up = projectMuzzleDirection(camera, new THREE.Vector3(0, 0.08, 1));
  assert.ok(left && right && up);
  assert.ok(left.x < 0 && right.x > 0);
  assert.ok(up.y > 0);
});

test('invalid and behind-camera muzzle vectors never jump to opposite edge of view', () => {
  const camera = forwardCamera();
  assert.equal(projectMuzzleDirection(camera, new THREE.Vector3(0, 0, -1)), null);
  assert.equal(projectMuzzleDirection(camera, new THREE.Vector3(0, 0, 0)), null);
  assert.equal(projectMuzzleDirection(camera, new THREE.Vector3(NaN, 0, 1)), null);
  assert.equal(projectMuzzleDirection(camera, new THREE.Vector3(3, 0, 1)), null);
});

test('muzzle marker ignores subtle walking jitter and approaches real turning smoothly', () => {
  const initial = {x:50,y:50};
  assert.strictEqual(smoothMuzzleIndicator(initial, {x:50.08,y:49.94}, 1/60), initial);
  const step = smoothMuzzleIndicator(initial, {x:70,y:30}, 1/60);
  assert.ok(step.x > 50 && step.x < 70);
  assert.ok(step.y < 50 && step.y > 30);
  let position = initial;
  for(let i=0;i<90;i++) position=smoothMuzzleIndicator(position,{x:70,y:30},1/60);
  assert.ok(Math.abs(position.x - 70) < 0.4);
  assert.ok(Math.abs(position.y - 30) < 0.4);
});

test('smoothing is frame-rate independent and hidden/resumed reset can snap without stale drift', () => {
  const start={x:40,y:50}, target={x:52,y:50};
  let at60=start;
  for(let i=0;i<6;i++) at60=smoothMuzzleIndicator(at60,target,1/60);
  let at30=start;
  for(let i=0;i<3;i++) at30=smoothMuzzleIndicator(at30,target,1/30);
  assert.ok(Math.abs(at60.x-at30.x)<1e-6);
  assert.deepEqual(smoothMuzzleIndicator(null,target,0),target);
  assert.deepEqual(smoothMuzzleIndicator(start,{x:NaN,y:NaN},1/60),start);
});
