import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AnimationAtlas, InfantryInstanceState, LabSettings } from './types';
import { ANIMATIONS, makeInstances } from './types';

const PREAMBLE = /* glsl */`
uniform sampler2D uInfantryAtlas;
uniform vec4 uInfantryClips[7];
uniform float uInfantrySpeeds[7];
uniform float uInfantryTime;
uniform float uInfantryTravel;
attribute vec4 aInfantryConfig;
attribute vec4 aBoneIndex;
attribute vec4 aBoneWeight;
attribute float aFactionMask;
varying float vFactionMask;
varying float vFaction;
vec3 infantryRotate(vec4 q, vec3 v) { return v + 2.0*cross(q.xyz,cross(q.xyz,v)+q.w*v); }
void infantryBone(float bone, vec2 frames, float alpha, out vec4 q, out vec3 tr) {
  ivec2 address=ivec2(int(bone)*2,int(frames.x));
  vec4 qa=texelFetch(uInfantryAtlas,address,0);
  vec3 ta=texelFetch(uInfantryAtlas,address+ivec2(1,0),0).xyz;
  address.y=int(frames.y);
  vec4 qb=texelFetch(uInfantryAtlas,address,0);
  vec3 tb=texelFetch(uInfantryAtlas,address+ivec2(1,0),0).xyz;
  if(dot(qa,qb)<0.0) qb=-qb;
  q=normalize(mix(qa,qb,alpha)); tr=mix(ta,tb,alpha);
}
void infantryPose(vec3 p, vec3 n, out vec3 outP, out vec3 outN) {
  int clipId=int(aInfantryConfig.x+.5);
  vec4 clip=uInfantryClips[clipId];
  float localTime=max(0.0,uInfantryTime*aInfantryConfig.z+aInfantryConfig.y*clip.z);
  float progress=clip.w>.5?fract(localTime/clip.z):min(1.0,localTime/clip.z);
  float f=progress*(clip.y-1.0);
  vec2 frames=clip.x+vec2(floor(f),min(clip.y-1.0,floor(f)+1.0));
  outP=vec3(0.0); outN=vec3(0.0);
  for(int i=0;i<4;i++) {
    float weight=aBoneWeight[i];
    if(weight>0.00001) {
      vec4 q; vec3 tr; infantryBone(aBoneIndex[i],frames,fract(f),q,tr);
      outP+=(infantryRotate(q,p)+tr)*weight;
      outN+=infantryRotate(q,n)*weight;
    }
  }
  outN=normalize(outN);
  outP.z+=uInfantryTravel*uInfantryTime*uInfantrySpeeds[clipId]*aInfantryConfig.z;
  vFaction=aInfantryConfig.w;
  vFactionMask=aFactionMask;
}
`;

export interface GpuInfantry {
  root: THREE.Group;
  atlas: AnimationAtlas;
  instances: InfantryInstanceState[];
  meshes: THREE.InstancedMesh[];
  resourceBytes: { geometry: number; animation: number; instanceMatrices: number; configuration: number };
  uniforms: { uInfantryTime: { value: number }; uInfantryTravel: { value: number } };
  updateMatrices(): number;
  dispose(): void;
}

export async function loadInfantryData(base = import.meta.env.BASE_URL) {
  const url = base + 'assets/infantry/';
  const [gltf, atlasResponse, binaryResponse] = await Promise.all([
    new GLTFLoader().loadAsync(url + 'infantry-rigged.glb'), fetch(url + 'animation.json'), fetch(url + 'animation.rgba16f'),
  ]);
  if (!atlasResponse.ok || !binaryResponse.ok) throw Error('Infantry atlas could not load');
  const atlas = await atlasResponse.json() as AnimationAtlas;
  const binary = await binaryResponse.arrayBuffer();
  const mesh = gltf.scene.getObjectByName('TripoInfantry') as THREE.SkinnedMesh;
  if (!mesh?.isSkinnedMesh || Array.isArray(mesh.material)) throw Error('Expected one original skinned mesh/material');
  if (binary.byteLength !== atlas.byteLength || atlas.width * atlas.heightTexels * 8 !== binary.byteLength) throw Error('Atlas length mismatch');
  return { gltf, atlas, binary, mesh };
}
export type InfantryData = Awaited<ReturnType<typeof loadInfantryData>>;

/** Thin geometry wrappers share ALL source vertex/index buffers between batches. */
export function createGpuInfantry(data: InfantryData, settings: LabSettings, suppliedStates?: readonly InfantryInstanceState[]): GpuInfantry {
  const { atlas, mesh, binary } = data;
  // Own one set of vertex buffers per population generation. Reusing the loaded
  // BufferAttribute objects across React replacements leaves new VAOs referring
  // to buffers deleted by the old generation's disposal (shadows can still work).
  // The ten batch wrappers below share THIS single set, never 200 copies.
  const source = mesh.geometry.clone();
  const texture = new THREE.DataTexture(new Uint16Array(binary), atlas.width, atlas.heightTexels, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false; texture.needsUpdate = true;
  const boneIndices = source.getAttribute('skinIndex');
  const boneWeights = source.getAttribute('skinWeight');
  const indices = new Float32Array(boneIndices.count * 4);
  for (let i = 0; i < boneIndices.count; i++) for (let j = 0; j < 4; j++) {
    const bone = mesh.skeleton.bones[boneIndices.getComponent(i, j)];
    const mapped = atlas.bones.indexOf(bone.name);
    if (mapped < 0) throw Error('Unknown exported bone: ' + bone.name);
    indices[i * 4 + j] = mapped;
  }
  const boneAttribute = new THREE.BufferAttribute(indices, 4);
  const position = source.getAttribute('position');
  const mask = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const lateral = Math.abs(position.getX(i)) / atlas.height, height = position.getY(i) / atlas.height;
    mask[i] = lateral > .145 && height > .74 && height < .82 ? 1 : 0;
  }
  const maskAttribute = new THREE.BufferAttribute(mask, 1);
  const uniforms = {
    uInfantryAtlas: { value: texture },
    uInfantryClips: { value: ANIMATIONS.map(name => { const c = atlas.clips.find(c => c.name === name)!; return new THREE.Vector4(c.offset, c.frames, c.duration, +c.loop); }) },
    uInfantrySpeeds: { value: ANIMATIONS.map(name => atlas.clips.find(c => c.name === name)!.movementSpeed) },
    uInfantryTime: { value: 0 }, uInfantryTravel: { value: +settings.travel },
  };
  function patch(material: THREE.Material, normals: boolean) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = PREAMBLE + shader.vertexShader;
      // Compute once, before Three's instance normal matrix and PBR normal mapping.
      shader.vertexShader = shader.vertexShader.replace('void main() {', 'void main() {\nvec3 infantryPosition; vec3 infantryNormal; infantryPose(position,normal,infantryPosition,infantryNormal);');
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = infantryPosition;');
      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = infantryNormal;');
      if (normals) {
        shader.fragmentShader = 'varying float vFactionMask; varying float vFaction;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          vec3 identification=mix(vec3(.20,.32,.43),vec3(.63,.20,.075),vFaction);
          diffuseColor.rgb=mix(diffuseColor.rgb,identification*(.5+dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))),vFactionMask*.75);`);
      }
    };
    material.customProgramCacheKey = () => 'infantry-quaternion-atlas-v1-' + normals;
  }
  const material = (mesh.material as THREE.MeshStandardMaterial).clone();
  patch(material, true);
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); patch(depth, false);
  const distance = new THREE.MeshDistanceMaterial(); patch(distance, false);
  const root = new THREE.Group(); root.name = 'perf:infantry';
  const instances = (suppliedStates ?? makeInstances(settings)).filter(state => state.alive);
  if (instances.some(state => ![...state.position, state.heading, state.animationPhase, state.movementSpeed].every(Number.isFinite))) throw Error('Non-finite infantry instance data');
  const meshes: THREE.InstancedMesh[] = [];
  const minX = Math.min(...instances.map(s => s.position[0]));
  const minZ = Math.min(...instances.map(s => s.position[2]));
  const morton = (state: InfantryInstanceState) => {
    const x = Math.max(0, Math.round((state.position[0] - minX) / .55));
    const z = Math.max(0, Math.round((state.position[2] - minZ) / .7));
    let key = 0;
    for (let bit = 0; bit < 12; bit++) key |= ((x >> bit) & 1) << (bit * 2) | ((z >> bit) & 1) << (bit * 2 + 1);
    return key;
  };
  const spatial = settings.batches === 10 ? [...instances].sort((a, b) => morton(a) - morton(b)) : instances;
  const size = settings.batches === 1 ? settings.count : Math.ceil(settings.count / 10);
  const matrix = new THREE.Matrix4();
  for (let start = 0; start < instances.length; start += size) {
    const group = spatial.slice(start, start + size);
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
    geometry.setIndex(source.index);
    geometry.setAttribute('aBoneIndex', boneAttribute); geometry.setAttribute('aBoneWeight', boneWeights);
    geometry.setAttribute('aFactionMask', maskAttribute);
    const configuration = new Float32Array(group.length * 4);
    group.forEach((state, i) => {
      const speed = atlas.clips.find(c => c.name === state.animation)!.movementSpeed;
      const playback = speed > 0 ? state.movementSpeed / speed : settings.individualPhases ? .9 + ((state.id * .371) % .2) : 1;
      configuration.set([ANIMATIONS.indexOf(state.animation), state.animationPhase, playback, +(state.faction === 'enemy')], i * 4);
    });
    geometry.setAttribute('aInfantryConfig', new THREE.InstancedBufferAttribute(configuration, 4));
    const batch = new THREE.InstancedMesh(geometry, material, group.length);
    batch.name = 'InfantryBatch-' + meshes.length;
    batch.userData.states = group;
    batch.castShadow = settings.shadows; batch.receiveShadow = settings.shadows;
    batch.customDepthMaterial = depth; batch.customDistanceMaterial = distance;
    group.forEach((state, i) => { matrix.makeRotationY(state.heading); matrix.setPosition(...state.position); batch.setMatrixAt(i, matrix); });
    batch.instanceMatrix.needsUpdate = true;
    // Rest-pose bounds are insufficient. Include every clip and root-travel range.
    const bounds = new THREE.Box3();
    group.forEach(state => {
      const travel = settings.travel ? Math.max(0, state.movementSpeed) * 60 : 0;
      for (const distance of [0, travel]) {
        const x = state.position[0] + Math.sin(state.heading) * distance;
        const z = state.position[2] + Math.cos(state.heading) * distance;
        bounds.expandByPoint(new THREE.Vector3(x - .75, -.1, z - .75));
        bounds.expandByPoint(new THREE.Vector3(x + .75, .6, z + .75));
      }
    });
    batch.boundingBox = bounds; batch.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    meshes.push(batch); root.add(batch);
  }
  let disposed = false;
  const uniqueAttributes = new Set(Object.values(source.attributes));
  return {
    root, atlas, instances, meshes, uniforms,
    resourceBytes: {
      geometry: [...uniqueAttributes].reduce((n, a) => n + a.array.byteLength, source.index?.array.byteLength ?? 0) + indices.byteLength + mask.byteLength,
      animation: binary.byteLength, instanceMatrices: instances.length * 64, configuration: instances.length * 16,
    },
    updateMatrices() {
      let updated = 0;
      meshes.forEach(batch => {
        (batch.userData.states as InfantryInstanceState[]).forEach((state, i) => {
          matrix.makeRotationY(state.heading); matrix.setPosition(...state.position); batch.setMatrixAt(i, matrix); updated++;
        });
        batch.instanceMatrix.needsUpdate = true;
      });
      return updated;
    },
    dispose() {
      if (disposed) return; disposed = true;
      meshes.forEach(batch => { batch.geometry.dispose(); batch.dispose(); });
      source.dispose();
      material.dispose(); depth.dispose(); distance.dispose(); texture.dispose(); root.clear();
      // Source maps and source BufferAttributes belong to the loaded asset, not a batch.
    },
  };
}

export function disposeInfantryData(data: InfantryData) {
  data.mesh.geometry.dispose();
  const material = data.mesh.material as THREE.MeshStandardMaterial;
  const textures = new Set<THREE.Texture>();
  for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
  textures.forEach(texture => { (texture.source.data as { close?: () => void } | undefined)?.close?.(); texture.dispose(); });
  material.dispose(); data.mesh.skeleton.dispose();
}
