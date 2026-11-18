// Build the two rigid game meshes from the supplied V-Pulse showcase model.
// Usage: node scripts/infantry/vpulse_build.mjs [path-to-original-html]
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { atlasUV, embedVpulseTextures } from './vpulse_texture.mjs';

const sourcePath = process.argv[2] ?? 'D:/Programms/Max/Assets/v_pulse_pulse_rifle_3d_cad_glb_exporter.html';
const outputDir = resolve(import.meta.dirname, '../../public/assets/infantry-vpulse');
const source = await readFile(sourcePath);
const sourceHash = createHash('sha256').update(source).digest('hex');
const expectedSourceHash = '5a52762ff1391192c7fa808f41648d5d9ba03df929fbbed78b6da9499e4b26d2';
if (sourceHash !== expectedSourceHash) throw new Error('V-Pulse source HTML changed. Review the geometry generator before running this build.');

// Execute only the reviewed geometry functions. Camera, UI, CDN dependencies,
// timers and effects from the original page never enter the export pipeline.
const html = source.toString('utf8');
const first = html.indexOf('      function expandPolygonWithVariableBevels');
const last = '      rifleRoot.add(boltInstanced);';
const recipe = html.slice(first, html.indexOf(last) + last.length);
const sourceToGame = new THREE.Matrix4()
  .makeRotationY(-Math.PI / 2)
  .multiply(new THREE.Matrix4().makeScale(.12, .12, .12))
  .multiply(new THREE.Matrix4().makeTranslation(.143, .182, -.027));

const markerPositions = {
  grip_right: [0, 0, 0],
  grip_left: [.0138, .01152, .05796],
  muzzle: [.00324, .02964, .12396],
};

const colors = {
  Armor: 0x4b5563,
  Dark: 0x1e242d,
  Gunmetal: 0x333c4a,
  Rubber: 0x14171c,
  AccentRed: 0xdc2626,
  Visor: 0x10b981,
  LedGreen: 0x10b981,
  Bolt: 0x161b22,
};

function buildSource(crowd) {
  let code = recipe.replace('bevelSegments: 6,', crowd ? 'bevelSegments: 0,' : 'bevelSegments: 2,')
    .replace('curveSegments: 28', crowd ? 'curveSegments: 2' : 'curveSegments: 10');
  if (crowd) {
    code = code.replaceAll('bevelEnabled: true', 'bevelEnabled: false')
      .replace('return expandPolygonWithVariableBevels(scaled, st.bevels || baseBevels, st.bevelScale);', 'return scaled;')
      .replace('let receiverGeom = createCADVariableBevelHullGeometry(stations, baseProfile, baseBevels);',
        `let receiverGeom = createCADVariableBevelHullGeometry([
          stations[0], stations[2], { ...stations[5], x: .0654 },
          { ...stations[5], x: .1214 }, stations[8], stations[10],
        ], baseProfile, baseBevels);`)
      .replace('0.26, 20)', '0.26, 8)');
  }
  const materials = Object.fromEntries(Object.entries(colors).map(([name, color]) => [
    'mat' + name, new THREE.MeshStandardMaterial({ name, color }),
  ]));
  return runInNewContext(code + `\n({ rifleRoot, receiverMesh, carryHandle, barrel, flashSuppGroup, muzzleFlash,
    camHousing, underbarrel, gripMesh, visorHood, visorScreen, hingeDrum, springMesh, weldMesh,
    stockFrame, buttPad, batteryBody, batteryLed, boltInstanced })`, {
    THREE, CSG: null, scene: new THREE.Scene(), ...materials,
  }, { timeout: 3000 });
}

function buildWeapon(crowd) {
  const weapon = buildSource(crowd);
  const ignored = new Set([weapon.muzzleFlash, weapon.springMesh, weapon.weldMesh, weapon.boltInstanced]);
  const crowdPieces = new Set([
    weapon.receiverMesh, weapon.carryHandle, weapon.barrel, ...weapon.flashSuppGroup.children,
    weapon.camHousing, weapon.underbarrel, weapon.gripMesh, weapon.visorHood, weapon.visorScreen,
    weapon.stockFrame, weapon.buttPad, weapon.batteryBody, weapon.batteryLed,
  ]);
  weapon.rifleRoot.updateMatrixWorld(true);
  const parts = [];
  weapon.rifleRoot.traverse(mesh => {
    if (!mesh.isMesh || ignored.has(mesh) || (crowd && !crowdPieces.has(mesh))) return;
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld).applyMatrix4(sourceToGame);
    const position = geometry.getAttribute('position');
    if (crowd) {
      const rgb = new Float32Array(position.count * 3);
      const armorLower = new THREE.Color(0x374151);
      const stripe = new THREE.Color(0xe2e8f0);
      const color = mesh.material.color;
      for (let i = 0; i < position.count; i += 3) {
        const centerZ = (position.getZ(i) + position.getZ(i + 1) + position.getZ(i + 2)) / 3;
        const whiteStripe = mesh === weapon.receiverMesh && centerZ > .025 && centerZ < .03173;
        for (let corner = i; corner < i + 3; corner++) {
          const base = mesh === weapon.receiverMesh && position.getY(corner) < .020 ? armorLower : color;
          (whiteStripe ? stripe : base).toArray(rgb, corner * 3);
        }
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    } else {
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i += 3) {
        const centerX = (position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3;
        for (let corner = i; corner < i + 3; corner++) {
          uv.setXY(corner, ...atlasUV(mesh.material.name, uv.getX(corner), uv.getY(corner), centerX > markerPositions.muzzle[0]));
        }
      }
    }
    geometry.clearGroups();
    parts.push(geometry);
  });
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('Cannot merge V-Pulse mesh buffers');
  const geometry = mergeVertices(merged, .000001);
  geometry.computeBoundingBox();
  const material = new THREE.MeshStandardMaterial({ name: 'V-Pulse shared PBR', vertexColors: crowd, metalness: .38, roughness: .48 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'V_Pulse';
  const root = new THREE.Group();
  root.name = 'V_PulseRoot';
  root.add(mesh);
  for (const [name, position] of Object.entries(markerPositions)) {
    const marker = new THREE.Object3D();
    marker.name = name;
    marker.position.fromArray(position);
    root.add(marker);
  }
  return { root, geometry };
}

// The stock Three.js GLB exporter uses FileReader for its final Blob in browsers.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => {
      this.result = result;
      this.onloadend?.();
    }, error => this.onerror?.(error));
  }
};

await mkdir(outputDir, { recursive: true });
const variants = {};
for (const [name, filename] of [['close', 'v-pulse.glb'], ['crowd', 'v-pulse-crowd.glb']]) {
  const { root, geometry } = buildWeapon(name === 'crowd');
  const triangles = geometry.index.count / 3;
  const budget = name === 'crowd' ? 800 : 3900;
  if (!Number.isInteger(triangles) || triangles > budget) throw new Error(`${name} mesh has ${triangles} triangles (budget ${budget})`);
  const glb = await new GLTFExporter().parseAsync(root, { binary: true });
  const bytes = name === 'crowd' ? Buffer.from(glb) : embedVpulseTextures(glb);
  await writeFile(resolve(outputDir, filename), bytes);
  variants[name] = {
    file: filename,
    triangles,
    vertices: geometry.getAttribute('position').count,
    bytes: bytes.byteLength,
    meshes: 1,
    materials: 1,
    textures: name === 'crowd' ? 0 : 4,
    bounds: { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() },
  };
}
const manifest = { sourceSha256: sourceHash, forward: '+Z', up: '+Y', markers: markerPositions, variants };
await writeFile(resolve(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
