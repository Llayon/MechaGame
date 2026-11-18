import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AnimationAtlas, InfantryInstanceState, InfantryKit, LabSettings } from './types';
import { SUPPORTED_ANIMATIONS, makeInstances } from './types';

function atlasPreamble(clipCount: number, rigid: boolean) {
  return /* glsl */`
uniform sampler2D uInfantryAtlas;
uniform vec4 uInfantryClips[${clipCount}];
uniform float uInfantrySpeeds[${clipCount}];
uniform float uInfantryTime;
uniform float uInfantryTravel;
attribute vec4 aInfantryConfig;
${rigid ? '#define INFANTRY_RIGID' : ''}
#ifdef INFANTRY_RIGID
uniform float uInfantryRigidBone;
#else
attribute vec4 aBoneIndex;
attribute vec4 aBoneWeight;
attribute float aFactionMask;
#endif
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
void infantryPose(vec3 p, vec3 n, vec3 t, out vec3 outP, out vec3 outN, out vec3 outT) {
  int clipId=int(aInfantryConfig.x+.5);
  vec4 clip=uInfantryClips[clipId];
  float localTime=max(0.0,uInfantryTime*aInfantryConfig.z+aInfantryConfig.y*clip.z);
  float progress=clip.w>.5?fract(localTime/clip.z):min(1.0,localTime/clip.z);
  float f=progress*(clip.y-1.0);
  vec2 frames=clip.x+vec2(floor(f),min(clip.y-1.0,floor(f)+1.0));
  #ifdef INFANTRY_RIGID
  vec4 q; vec3 tr; infantryBone(uInfantryRigidBone,frames,fract(f),q,tr);
  outP=infantryRotate(q,p)+tr;
  outN=infantryRotate(q,n);
  outT=infantryRotate(q,t);
  vFactionMask=0.0;
  #else
  outP=vec3(0.0); outN=vec3(0.0); outT=vec3(0.0);
  for(int i=0;i<4;i++) {
    float weight=aBoneWeight[i];
    if(weight>0.00001) {
      vec4 q; vec3 tr; infantryBone(aBoneIndex[i],frames,fract(f),q,tr);
      outP+=(infantryRotate(q,p)+tr)*weight;
      outN+=infantryRotate(q,n)*weight;
      outT+=infantryRotate(q,t)*weight;
    }
  }
  vFactionMask=aFactionMask;
  #endif
  outN=normalize(outN);
  #ifdef USE_TANGENT
  outT=normalize(outT);
  #endif
  outP.z+=uInfantryTravel*uInfantryTime*uInfantrySpeeds[clipId]*aInfantryConfig.z;
  vFaction=aInfantryConfig.w;
}
`;
}

export interface GpuInfantry {
  root: THREE.Group;
  atlas: AnimationAtlas;
  instances: InfantryInstanceState[];
  meshes: THREE.InstancedMesh[];
  weaponMeshes: THREE.InstancedMesh[];
  resourceBytes: { geometry: number; animation: number; instanceMatrices: number; configuration: number };
  uniforms: { uInfantryTime: { value: number }; uInfantryTravel: { value: number } };
  updateMatrices(): number;
  dispose(): void;
}

export async function loadInfantryData(base = import.meta.env.BASE_URL, kit: InfantryKit = 'original') {
  const armed = kit === 'vpulse';
  const url = base + (armed ? 'assets/infantry-armed/' : 'assets/infantry/');
  const loader = new GLTFLoader();
  const [bodyAsset, weaponAsset, atlasAsset, binaryAsset] = await Promise.allSettled([
    loader.loadAsync(url + (armed ? 'infantry-demo-lod2.glb' : 'infantry-rigged.glb')),
    armed ? loader.loadAsync(base + 'assets/infantry-vpulse/v-pulse-crowd.glb') : Promise.resolve(null),
    fetch(url + 'animation.json'),
    fetch(url + 'animation.rgba16f'),
  ]);
  const gltf = bodyAsset.status === 'fulfilled' ? bodyAsset.value : null;
  const weaponGltf = weaponAsset.status === 'fulfilled' ? weaponAsset.value : null;
  try {
    if (!gltf) throw bodyAsset.status === 'rejected' ? bodyAsset.reason : Error('Infantry model could not load');
    if (weaponAsset.status === 'rejected') throw weaponAsset.reason;
    if (atlasAsset.status !== 'fulfilled' || !atlasAsset.value.ok || binaryAsset.status !== 'fulfilled' || !binaryAsset.value.ok) {
      throw Error('Infantry atlas could not load');
    }
    const atlas = await atlasAsset.value.json() as AnimationAtlas;
    const binary = await binaryAsset.value.arrayBuffer();
    const mesh = gltf.scene.getObjectByName(armed ? 'DemoInfantry' : 'TripoInfantry') as THREE.SkinnedMesh;
    if (!mesh?.isSkinnedMesh || Array.isArray(mesh.material)) throw Error('Expected one skinned infantry mesh/material');
    if (atlas.format !== 'RGBA16F' || atlas.width !== atlas.bones.length * 2 ||
        binary.byteLength !== atlas.byteLength || atlas.width * atlas.heightTexels * 8 !== binary.byteLength) {
      throw Error('Infantry atlas layout mismatch');
    }
    const names = atlas.clips.map(clip => clip.name);
    if (!names.includes('idle') || new Set(names).size !== names.length || names.some(name => !SUPPORTED_ANIMATIONS.includes(name)) ||
        atlas.clips.some(clip => !Number.isInteger(clip.offset) || clip.offset < 0 || !Number.isInteger(clip.frames) ||
          clip.frames < 1 || clip.offset + clip.frames > atlas.heightTexels || !Number.isFinite(clip.duration) || clip.duration <= 0 ||
          !Number.isFinite(clip.movementSpeed) || clip.movementSpeed < 0)) {
      throw Error('Infantry atlas has invalid clip metadata');
    }
    const weaponNodes: THREE.Mesh[] = [];
    weaponGltf?.scene.traverse(node => { if ((node as THREE.Mesh).isMesh) weaponNodes.push(node as THREE.Mesh); });
    const weapon = weaponNodes.at(0);
    if (armed && (!weapon || weaponNodes.length !== 1 || Array.isArray(weapon.material) || !weapon.geometry.hasAttribute('normal'))) {
      throw Error('Expected one V-Pulse crowd mesh/material with normals');
    }
    weaponGltf?.scene.updateMatrixWorld(true);
    let weaponBind: THREE.Matrix4 | undefined;
    if (weapon) {
      const grip = atlas.weaponGrip;
      const hand = mesh.skeleton.bones.findIndex(bone => bone.name === 'hand_R');
      if (!grip || grip.position.length !== 3 || grip.quaternion.length !== 4 ||
          ![...grip.position, ...grip.quaternion].every(Number.isFinite) ||
          Math.abs(Math.hypot(...grip.quaternion) - 1) > .001 || hand < 0 || !atlas.bones.includes('hand_R')) {
        throw Error('V-Pulse grip bind transform missing or invalid');
      }
      const offset = new THREE.Matrix4().compose(new THREE.Vector3(...grip.position),
        new THREE.Quaternion(...grip.quaternion).normalize(), new THREE.Vector3(1, 1, 1));
      // In bind space this is HandBind × GripOffset × RifleNode. The atlas
      // stores HandPose × InverseHandBind, so the shader cancels HandBind.
      weaponBind = mesh.skeleton.boneInverses[hand].clone().invert().multiply(offset).multiply(weapon.matrixWorld);
    }
    return { gltf, atlas, binary, mesh, kit, weapon, weaponBind, weaponGltf };
  } catch (error) {
    disposeLoadedMeshes([gltf?.scene, weaponGltf?.scene]);
    throw error;
  }
}
export type InfantryData = Awaited<ReturnType<typeof loadInfantryData>>;

function wrapper(source: THREE.BufferGeometry) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  geometry.setIndex(source.index);
  return geometry;
}

function geometryBytes(geometry: THREE.BufferGeometry) {
  const attributes = new Set(Object.values(geometry.attributes));
  return [...attributes].reduce((sum, attribute) => sum + attribute.array.byteLength, geometry.index?.array.byteLength ?? 0);
}

/** Bound a rigid bind-space sphere under every atlas quaternion and translation. */
function weaponMotionBounds(source: THREE.BufferGeometry, atlas: AnimationAtlas, binary: ArrayBuffer, bone: number) {
  source.computeBoundingSphere();
  const sphere = source.boundingSphere!;
  const reach = sphere.center.length() + sphere.radius;
  const samples = new Uint16Array(binary);
  const translations = new THREE.Box3();
  const translation = new THREE.Vector3();
  for (let frame = 0; frame < atlas.heightTexels; frame++) {
    const i = (frame * atlas.width + bone * 2 + 1) * 4;
    translation.set(THREE.DataUtils.fromHalfFloat(samples[i]), THREE.DataUtils.fromHalfFloat(samples[i + 1]),
      THREE.DataUtils.fromHalfFloat(samples[i + 2]));
    translations.expandByPoint(translation);
  }
  // A unit quaternion rotates any point by at most its distance from the
  // origin; interpolated translations stay inside the sampled AABB.
  translations.expandByScalar(reach);
  const radius = Math.hypot(Math.max(Math.abs(translations.min.x), Math.abs(translations.max.x)),
    Math.max(Math.abs(translations.min.z), Math.abs(translations.max.z)));
  return { radius, minY: translations.min.y, maxY: translations.max.y };
}

/** Thin geometry wrappers share ALL source vertex/index buffers between batches. */
export function createGpuInfantry(data: InfantryData, settings: LabSettings, suppliedStates?: readonly InfantryInstanceState[]): GpuInfantry {
  const { atlas, mesh, binary } = data;
  const clipIndices = new Map(atlas.clips.map((clip, index) => [clip.name, index]));
  const instances = (suppliedStates ?? makeInstances(settings, data.kit === 'vpulse' ? atlas.clips : undefined)).filter(state => state.alive);
  if (instances.some(state => ![...state.position, state.heading, state.animationPhase, state.movementSpeed].every(Number.isFinite))) throw Error('Non-finite infantry instance data');
  if (instances.some(state => !clipIndices.has(state.animation))) throw Error('Animation is not available for this infantry kit');
  // Own one set of vertex buffers per population generation. Reusing the loaded
  // BufferAttribute objects across React replacements leaves new VAOs referring
  // to buffers deleted by the old generation's disposal (shadows can still work).
  // The ten batch wrappers below share THIS single set, never 200 copies.
  const source = mesh.geometry.clone();
  const weaponSource = data.weapon && data.weaponBind ? data.weapon.geometry.clone().applyMatrix4(data.weaponBind) : null;
  const rigidBone = atlas.bones.indexOf('hand_R');
  const weaponBounds = weaponSource ? weaponMotionBounds(weaponSource, atlas, binary, rigidBone) : null;
  const boundsRadius = Math.max(.75, weaponBounds?.radius ?? 0);
  const boundsMinY = Math.min(-.1, weaponBounds?.minY ?? 0);
  const boundsMaxY = Math.max(.6, weaponBounds?.maxY ?? 0);
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
    uInfantryClips: { value: atlas.clips.map(clip => new THREE.Vector4(clip.offset, clip.frames, clip.duration, +clip.loop)) },
    uInfantrySpeeds: { value: atlas.clips.map(clip => clip.movementSpeed) },
    uInfantryTime: { value: 0 }, uInfantryTravel: { value: +settings.travel },
  };
  function patch(material: THREE.Material, tint: boolean, rigid: boolean) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      if (rigid) shader.uniforms.uInfantryRigidBone = { value: rigidBone };
      shader.vertexShader = atlasPreamble(atlas.clips.length, rigid) + shader.vertexShader;
      // Both meshes use the same time and clip data, including their shadow passes.
      shader.vertexShader = shader.vertexShader.replace('void main() {', `void main() {
        vec3 infantryPosition; vec3 infantryNormal; vec3 infantryTangent;
        #ifdef USE_TANGENT
          infantryPose(position, normal, tangent.xyz, infantryPosition, infantryNormal, infantryTangent);
        #else
          infantryPose(position, normal, vec3(0.0), infantryPosition, infantryNormal, infantryTangent);
        #endif`);
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = infantryPosition;');
      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        objectNormal = infantryNormal;
        #ifdef USE_TANGENT
          objectTangent = infantryTangent;
        #endif`);
      if (tint) {
        shader.fragmentShader = 'varying float vFactionMask; varying float vFaction;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          vec3 identification=mix(vec3(.20,.32,.43),vec3(.63,.20,.075),vFaction);
          diffuseColor.rgb=mix(diffuseColor.rgb,identification*(.5+dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))),vFactionMask*.75);`);
      }
    };
    material.customProgramCacheKey = () => `infantry-quaternion-atlas-v2-${atlas.clips.length}-${tint}-${rigid}`;
  }
  function materials(sourceMaterial: THREE.Material, rigid: boolean) {
    const color = sourceMaterial.clone();
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    const distance = new THREE.MeshDistanceMaterial();
    patch(color, !rigid, rigid);
    patch(depth, false, rigid);
    patch(distance, false, rigid);
    return { color, depth, distance };
  }
  const bodyMaterials = materials(mesh.material as THREE.Material, false);
  const weaponMaterials = data.weapon ? materials(data.weapon.material as THREE.Material, true) : null;
  const root = new THREE.Group(); root.name = 'perf:infantry';
  const meshes: THREE.InstancedMesh[] = [];
  const weaponMeshes: THREE.InstancedMesh[] = [];
  const weaponRoot = new THREE.Group(); weaponRoot.name = 'perf:infantry-weapons';
  if (weaponSource) root.add(weaponRoot);
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
    const geometry = wrapper(source);
    geometry.setAttribute('aBoneIndex', boneAttribute); geometry.setAttribute('aBoneWeight', boneWeights);
    geometry.setAttribute('aFactionMask', maskAttribute);
    const configuration = new Float32Array(group.length * 4);
    group.forEach((state, i) => {
      const clipIndex = clipIndices.get(state.animation)!;
      const speed = atlas.clips[clipIndex].movementSpeed;
      const playback = speed > 0 ? state.movementSpeed / speed : settings.individualPhases ? .9 + ((state.id * .371) % .2) : 1;
      configuration.set([clipIndex, state.animationPhase, playback, +(state.faction === 'enemy')], i * 4);
    });
    const config = new THREE.InstancedBufferAttribute(configuration, 4);
    geometry.setAttribute('aInfantryConfig', config);
    const batch = new THREE.InstancedMesh(geometry, bodyMaterials.color, group.length);
    batch.name = 'InfantryBatch-' + meshes.length;
    batch.userData.states = group;
    batch.castShadow = settings.shadows; batch.receiveShadow = settings.shadows;
    batch.customDepthMaterial = bodyMaterials.depth; batch.customDistanceMaterial = bodyMaterials.distance;
    group.forEach((state, i) => { matrix.makeRotationY(state.heading); matrix.setPosition(...state.position); batch.setMatrixAt(i, matrix); });
    batch.instanceMatrix.needsUpdate = true;
    // Rest-pose bounds are insufficient. Include every clip and root-travel range.
    const bounds = new THREE.Box3();
    group.forEach(state => {
      const travel = settings.travel ? Math.max(0, state.movementSpeed) * 60 : 0;
      for (const distance of [0, travel]) {
        const x = state.position[0] + Math.sin(state.heading) * distance;
        const z = state.position[2] + Math.cos(state.heading) * distance;
        bounds.expandByPoint(new THREE.Vector3(x - boundsRadius, state.position[1] + boundsMinY, z - boundsRadius));
        bounds.expandByPoint(new THREE.Vector3(x + boundsRadius, state.position[1] + boundsMaxY, z + boundsRadius));
      }
    });
    batch.boundingBox = bounds; batch.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    meshes.push(batch); root.add(batch);
    if (weaponSource && weaponMaterials) {
      const geometry = wrapper(weaponSource);
      geometry.setAttribute('aInfantryConfig', config);
      const rifle = new THREE.InstancedMesh(geometry, weaponMaterials.color, group.length);
      rifle.name = 'VPulseBatch-' + weaponMeshes.length;
      // The rigid weapon shares the actual matrices and shader config buffers.
      rifle.instanceMatrix = batch.instanceMatrix;
      rifle.boundingBox = batch.boundingBox;
      rifle.boundingSphere = batch.boundingSphere;
      rifle.castShadow = settings.shadows; rifle.receiveShadow = settings.shadows;
      rifle.customDepthMaterial = weaponMaterials.depth; rifle.customDistanceMaterial = weaponMaterials.distance;
      weaponMeshes.push(rifle); weaponRoot.add(rifle);
    }
  }
  let disposed = false;
  return {
    root, atlas, instances, meshes, weaponMeshes, uniforms,
    resourceBytes: {
      geometry: geometryBytes(source) + (weaponSource ? geometryBytes(weaponSource) : 0) + indices.byteLength + mask.byteLength,
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
      [...meshes, ...weaponMeshes].forEach(batch => { batch.geometry.dispose(); batch.dispose(); });
      source.dispose();
      weaponSource?.dispose();
      [bodyMaterials, weaponMaterials].forEach(set => { if (set) Object.values(set).forEach(material => material.dispose()); });
      texture.dispose(); root.clear();
      // Source maps and source BufferAttributes belong to the loaded asset, not a batch.
    },
  };
}

function disposeLoadedMeshes(roots: Array<THREE.Group | undefined>) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const skeletons = new Set<THREE.Skeleton>();
  roots.forEach(root => root?.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) skeletons.add((mesh as THREE.SkinnedMesh).skeleton);
  }));
  const textures = new Set<THREE.Texture>();
  materials.forEach(material => Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); }));
  textures.forEach(texture => { (texture.source.data as { close?: () => void } | undefined)?.close?.(); texture.dispose(); });
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
  skeletons.forEach(skeleton => skeleton.dispose());
}

export function disposeInfantryData(data: InfantryData) {
  disposeLoadedMeshes([data.gltf.scene, data.weaponGltf?.scene]);
}
