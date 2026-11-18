import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DataUtils } from 'three';
import {
  createInfantryPopulation,
  splashHostileInfantry,
  stepInfantry,
  traceHostileInfantry,
} from './population';
import { createCombatState, resetCombatState, stepCombatSimulation } from '../game/combatSimulation';
import { MECH_SPAWN, getWalkableSurfaceY } from '../map/mechKinematics';
import { resolveWorldObstacles } from '../map/worldColliders';

test('baked patrol lanes stay on dry unobstructed walkable surfaces', () => {
  const actors = createInfantryPopulation();
  assert.equal(actors.length, 200);
  for (const { lane } of actors) {
    for (let i = 0; i < lane.heights.length; i++) {
      const x = lane.x + i * 0.5 * lane.dx,
        z = lane.z + i * 0.5 * lane.dz;
      const surface = getWalkableSurfaceY(x, z, lane.heights[Math.max(0, i - 1)]);
      assert.ok(Math.abs(surface.y - lane.heights[i]) < 0.001, 'Rebake after terrain edits');
      assert.equal(surface.inWater, false);
      assert.equal(resolveWorldObstacles(x, z, surface.y + 0.2, 0.12).collided, false);
    }
  }
});

test('the mission owns 50 friendly and 150 hostile infantry independently of rendering, pause and reset', () => {
  const state = createCombatState(true);
  const { x, y, z } = MECH_SPAWN;
  stepCombatSimulation(state, x, y, z, false, 0.05);
  assert.equal(state.infantry.soldiers.length, 200);
  assert.equal(state.infantry.soldiers.filter((a) => a.side === 'friendly').length, 50);
  const actor = state.infantry.soldiers[88];
  const elapsed = state.infantry.elapsed;
  state.missionStatus = 'paused';
  stepCombatSimulation(state, x, y, z, false, 0.05);
  assert.equal(state.infantry.elapsed, elapsed);
  state.missionStatus = 'playing';
  stepCombatSimulation(state, x, y, z, false, 0.05);
  assert.ok(state.infantry.elapsed > elapsed);
  actor.hp = 0;
  resetCombatState(state);
  stepCombatSimulation(state, x, y, z, false, 0.05);
  assert.equal(state.infantry.soldiers[88].id, actor.id);
  assert.ok(state.infantry.soldiers[88].hp > 0);
});

test('infantry ray hits respect the nearest occluder, team, range, and dead slots', () => {
  const soldiers = createInfantryPopulation();
  const friend = { ...soldiers[0], x: 0, y: 0, z: 1 };
  const foe = { ...soldiers[50], x: 0, y: 0, z: 2 };
  const far = { ...soldiers[51], x: 0, y: 0, z: 5 };
  const line = [far, friend, foe];
  const closest = (range: number) => traceHostileInfantry(line, 0, 0.24, 0, 0, 0, 1, range)?.actor;
  assert.equal(closest(1.5), undefined);
  assert.equal(closest(6), foe);
  assert.equal(splashHostileInfantry(line, 0, 0.24, 2, 1.5, 100), 1);
  assert.equal(closest(6), far);
  assert.equal(friend.hp, 15);
  const previous = foe.phase;
  stepInfantry(line, 0.05, 0, 0, true);
  assert.equal(foe.phase, previous);
});

test('packed meshes have matching influences, finite animation transforms, and the advertised four LOD budgets', () => {
  const root = 'public/assets/crowd/';
  const atlas = JSON.parse(readFileSync(root + 'atlas.json', 'utf8'));
  assert.deepEqual(atlas.triangles, [3999, 1999, 999, 298]);
  assert.equal(atlas.width, 3 * atlas.bones.length);
  const binary = readFileSync(root + 'poses.rgba16f');
  assert.equal(binary.length, atlas.width * atlas.height * 8);
  let magnitude = 0;
  for (let i = 0; i < binary.length; i += 2) {
    const value = DataUtils.fromHalfFloat(binary.readUInt16LE(i));
    assert.ok(Number.isFinite(value));
    magnitude = Math.max(magnitude, Math.abs(value));
  }
  assert.ok(magnitude >= 1 && magnitude < 2);
  const shapes: number[] = [];
  for (let lod = 0; lod < 3; lod++) {
    const glb = readFileSync(root + 'lod' + lod + '.glb');
    const jsonEnd = 20 + glb.readUInt32LE(12);
    const doc = JSON.parse(glb.subarray(20, jsonEnd).toString());
    const data = glb.subarray(jsonEnd + 8);
    for (const mesh of doc.meshes) {
      const primitive = mesh.primitives[0];
      shapes.push(doc.accessors[primitive.indices].count / 3);
      const attrs = primitive.attributes;
      for (const key of ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', '_JOINTS', '_WEIGHTS'])
        assert.ok(key in attrs);
      const joints = doc.accessors[attrs._JOINTS],
        weights = doc.accessors[attrs._WEIGHTS];
      assert.equal(weights.count, joints.count);
      const js = doc.bufferViews[joints.bufferView].byteOffset,
        ws = doc.bufferViews[weights.bufferView].byteOffset;
      for (let v = 0; v < joints.count; v++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          assert.ok(data[js + 4 * v + k] < atlas.bones.length);
          sum += data.readFloatLE(ws + 16 * v + 4 * k);
        }
        assert.ok(Math.abs(sum - 1) < 0.001);
      }
    }
  }
  assert.deepEqual(shapes, atlas.triangles);
});
