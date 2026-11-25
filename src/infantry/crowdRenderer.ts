import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { chooseLod, projectedPixels, readWorldLod } from '../lod/worldLod';
import type { InfantrySoldier } from '../game/infantrySkirmishes';
import { INFANTRY_PER_SITE, INFANTRY_SITES } from '../map/infantryEncounters';

const SITE_CAPACITY = INFANTRY_PER_SITE.friendly + INFANTRY_PER_SITE.enemy;

interface Motion {
  name: string;
  offset: number;
  frames: number;
  duration: number;
}
interface Atlas {
  width: number;
  height: number;
  clips: Motion[];
}

const thresholds = [64, 32, 15];
const skinVertex = `
uniform sampler2D uCrowdAtlas;
attribute vec4 _joints;
attribute vec4 _weights;
attribute vec4 aCrowdPose;
varying float vCrowdFriendly;
varying float vCrowdPatch;

mat4 crowdBone(int bone) {
  ivec2 a = ivec2(bone*3,int(aCrowdPose.x));
  ivec2 b = ivec2(bone*3,int(aCrowdPose.y));
  vec4 row0 = mix(texelFetch(uCrowdAtlas,a,0),texelFetch(uCrowdAtlas,b,0),aCrowdPose.z);
  a.x++; b.x++;
  vec4 row1 = mix(texelFetch(uCrowdAtlas,a,0),texelFetch(uCrowdAtlas,b,0),aCrowdPose.z);
  a.x++; b.x++;
  vec4 row2 = mix(texelFetch(uCrowdAtlas,a,0),texelFetch(uCrowdAtlas,b,0),aCrowdPose.z);
  return transpose(mat4(row0,row1,row2,vec4(0.,0.,0.,1.)));
}
`;

function bindAtlas(material: THREE.Material, texture: THREE.DataTexture, faction: boolean) {
  material.customProgramCacheKey = () => 'crowd-matrix-atlas-v1-' + faction;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCrowdAtlas = { value: texture };
    shader.vertexShader =
      skinVertex +
      shader.vertexShader
        .replace(
          'void main() {',
          `void main() {
      mat4 crowdPose = mat4(0.0);
      for(int i=0; i<4; i++){
        if (_weights[i] > 0.00001) crowdPose += crowdBone(int(_joints[i]+0.5))*_weights[i];
      }
      vCrowdFriendly=aCrowdPose.w;
      vCrowdPatch=step(.054,abs(position.x))*step(.33,position.y)*(1.-step(.405,position.y));
      `,
        )
        .replace('#include <begin_vertex>', 'vec3 transformed = (crowdPose * vec4(position,1.)).xyz;')
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
        objectNormal=mat3(crowdPose)*objectNormal;
        #ifdef USE_TANGENT
        objectTangent=mat3(crowdPose)*objectTangent;
        #endif`,
        );
    if (faction) {
      shader.fragmentShader =
        'varying float vCrowdFriendly;\nvarying float vCrowdPatch;\n' +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        vec3 patchColor=mix(vec3(.58,.105,.035),vec3(.055,.26,.47),vCrowdFriendly);
        diffuseColor.rgb=mix(diffuseColor.rgb,patchColor,.72*clamp(vCrowdPatch,0.,1.));`,
        );
    }
  };
}

function batch(
  source: THREE.Mesh,
  level: number,
  poseTexture: THREE.DataTexture,
  shadowMaterial: THREE.MeshDepthMaterial,
) {
  // All squads share immutable source vertex buffers. Instance state belongs to this spatial batch.
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(source.geometry.index);
  for (const [name, attr] of Object.entries(source.geometry.attributes)) geometry.setAttribute(name, attr);
  const pose = new THREE.InstancedBufferAttribute(new Float32Array(SITE_CAPACITY * 4), 4).setUsage(
    THREE.DynamicDrawUsage,
  );
  geometry.setAttribute('aCrowdPose', pose);
  const material = source.material as THREE.MeshStandardMaterial;
  bindAtlas(material, poseTexture, true);
  const mesh = new THREE.InstancedMesh(geometry, material, SITE_CAPACITY);
  mesh.customDepthMaterial = shadowMaterial;
  mesh.receiveShadow = level <= 1;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.userData.lodLevel = level;
  mesh.count = 0;
  return { mesh, pose };
}

async function readResponse(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw Error('Infantry asset failed to load: ' + url);
  return response;
}

export async function loadCrowdRenderer() {
  const base = import.meta.env.BASE_URL + 'assets/crowd/';
  const loader = new GLTFLoader();
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  const meshes: THREE.InstancedMesh[] = [];
  function dispose() {
    for (const m of meshes) m.dispose();
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    const images = new Set<ImageBitmap>();
    for (const t of textures) {
      if (typeof ImageBitmap !== 'undefined' && t.image instanceof ImageBitmap) images.add(t.image);
      t.dispose();
    }
    for (const bitmap of images) bitmap.close();
  }

  try {
    const [manifest, binary, ...loaded] = await Promise.allSettled([
      readResponse(base + 'atlas.json').then((r) => r.json() as Promise<Atlas>),
      readResponse(base + 'poses.rgba16f').then((r) => r.arrayBuffer()),
      ...[0, 1, 2].map((i) => loader.loadAsync(base + 'lod' + i + '.glb')),
    ] as const);
    const sources: THREE.Mesh[] = [];
    for (const result of loaded) {
      if (result.status === 'rejected') continue;
      (result.value as GLTF).scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        sources.push(node);
        geometries.add(node.geometry);
        const material = node.material as THREE.MeshStandardMaterial;
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      });
    }
    if (manifest.status === 'rejected') throw manifest.reason;
    if (binary.status === 'rejected') throw binary.reason;
    if (sources.length !== 4) throw Error('Expected four infantry LOD meshes');
    const atlas = manifest.value as Atlas;
    if ((binary.value as ArrayBuffer).byteLength !== atlas.width * atlas.height * 8)
      throw Error('Invalid infantry atlas dimensions');
    const poseTexture = new THREE.DataTexture(
      new Uint16Array(binary.value as ArrayBuffer),
      atlas.width,
      atlas.height,
      THREE.RGBAFormat,
      THREE.HalfFloatType,
    );
    poseTexture.needsUpdate = true;
    textures.add(poseTexture);
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    materials.add(depth);
    bindAtlas(depth, poseTexture, false);
    const contacts = new THREE.CircleGeometry(0.17, 8).rotateX(-Math.PI / 2).scale(1, 1, 0.78);
    const contactMat = new THREE.MeshBasicMaterial({
      color: 0x282423,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    materials.add(contactMat);
    geometries.add(contacts);
    const group = new THREE.Group();
    group.name = 'perf:infantry';
    const squads = INFANTRY_SITES.map((_, index) => {
      const levels = sources.map((source, lod) => batch(source, lod, poseTexture, depth));
      const shadow = batch(sources[3], 3, poseTexture, depth);
      delete shadow.mesh.userData.lodLevel;
      shadow.mesh.layers.set(1);
      shadow.mesh.castShadow = true;
      shadow.mesh.receiveShadow = false;
      shadow.mesh.name = 'infantry-shadow-' + index;
      const contact = new THREE.InstancedMesh(contacts, contactMat, SITE_CAPACITY);
      contact.count = 0;
      contact.name = 'infantry-contact-' + index;
      contact.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (const item of [...levels, shadow]) {
        geometries.add(item.mesh.geometry);
        meshes.push(item.mesh);
        group.add(item.mesh);
      }
      for (let lod = 0; lod < levels.length; lod++)
        levels[lod].mesh.name = 'infantry-squad-' + index + '-lod' + lod;
      group.add(contact);
      meshes.push(contact);
      return { levels, shadow, contact };
    });
    const motions = new Map(atlas.clips.map((c) => [c.name, c]));
    const previous = new Int8Array(SITE_CAPACITY * squads.length).fill(-1);
    const shadowLevels = new Int8Array(previous.length).fill(-1);
    const transform = new THREE.Object3D(),
      point = new THREE.Vector3();
    let lastPopulation: InfantrySoldier[] | undefined;
    let nextClassification = -Infinity;
    function update(population: InfantrySoldier[], camera: THREE.Camera, time: number, shadows: boolean) {
      const reset = population !== lastPopulation;
      if (reset) {
        lastPopulation = population;
        previous.fill(-1);
        shadowLevels.fill(-1);
        const bounds = squads.map(() => new THREE.Box3());
        for (const actor of population) {
          const box = bounds[actor.siteIndex];
          for (const p of actor.route) box.expandByPoint(point.set(p.x, p.y, p.z));
          box.expandByPoint(point.set(actor.cover.x, actor.cover.y, actor.cover.z));
        }
        for (let i = 0; i < squads.length; i++) {
          const sphere = bounds[i].expandByScalar(0.75).getBoundingSphere(new THREE.Sphere());
          for (const b of squads[i].levels) b.mesh.boundingSphere = sphere;
          squads[i].shadow.mesh.boundingSphere = sphere;
          squads[i].contact.boundingSphere = sphere;
        }
      }
      const view = readWorldLod(camera);
      const classify = reset || time >= nextClassification;
      if (classify) nextClassification = time + 0.12;
      for (const squad of squads) {
        for (const item of squad.levels) item.mesh.count = 0;
        squad.shadow.mesh.count = 0;
        squad.contact.count = 0;
      }
      function submit(item: ReturnType<typeof batch>, a: number, b: number, t: number, friendly: boolean) {
        const slot = item.mesh.count++;
        item.mesh.setMatrixAt(slot, transform.matrix);
        item.pose.setXYZW(slot, a, b, t, +friendly);
      }
      for (const actor of population) {
        if (actor.hp <= 0) continue;
        if (classify) {
          point.set(actor.x, actor.y + 0.24, actor.z).applyMatrix4(camera.matrixWorldInverse);
          const depth = point.z < 0 ? Math.max(-point.z, point.length() * 0.4) : point.length();
          const px = projectedPixels(0.24, depth, view);
          previous[actor.id] = chooseLod(px, previous[actor.id], thresholds, actor.id);
          shadowLevels[actor.id] = chooseLod(
            (px * view.shadowScale) / Math.max(0.01, view.detailScale),
            shadowLevels[actor.id],
            [24, 8],
            actor.id,
          );
        }
        const squad = squads[actor.siteIndex];
        const friendly = actor.side === 'friendly';
        const clip = motions.get(actor.moving ? 'run' : actor.inCover ? 'crouch' : 'idle')!;
        const phase = (actor.id * 0.618033989 + time / clip.duration) % 1;
        const frame = phase * (clip.frames - 1),
          local = Math.floor(frame);
        const a = clip.offset + local,
          b = clip.offset + Math.min(local + 1, clip.frames - 1);
        transform.position.set(actor.x, actor.y, actor.z);
        transform.rotation.y = actor.yaw;
        transform.updateMatrix();
        submit(squad.levels[previous[actor.id]], a, b, frame - local, friendly);
        if (shadows && shadowLevels[actor.id] === 0)
          submit(squad.shadow, a, b, frame - local, friendly);
        if (shadows && shadowLevels[actor.id] === 1) {
          transform.matrix.elements[13] += 0.013;
          squad.contact.setMatrixAt(squad.contact.count++, transform.matrix);
        }
      }
      for (const squad of squads) {
        for (const item of squad.levels) flush(item);
        flush(squad.shadow);
        squad.contact.visible = squad.contact.count > 0;
        if (squad.contact.visible) squad.contact.instanceMatrix.needsUpdate = true;
      }
    }
    function flush(item: ReturnType<typeof batch>) {
      item.mesh.visible = item.mesh.count > 0;
      if (!item.mesh.visible) return;
      item.pose.needsUpdate = true;
      item.mesh.instanceMatrix.needsUpdate = true;
    }
    return { group, update, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
