import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { InfantrySoldier } from '../../game/infantrySkirmishes';

type Clip = { name: string; offset: number; frames: number; duration: number; muzzleTime?: number };
type Atlas = {
  width: number;
  heightTexels: number;
  bones: string[];
  clips: Clip[];
  weaponGrip: { position: [number, number, number]; quaternion: [number, number, number, number] };
};

/** The atlas stores two RGBA16F texels per bone: a quaternion and bind-space translation. */
function animateMaterial(material: THREE.Material, texture: THREE.DataTexture, handBone?: number) {
  const rigid = handBone !== undefined;
  material.customProgramCacheKey = () => 'skirmish-atlas-' + (handBone ?? 'skin');
  material.onBeforeCompile = shader => {
    shader.uniforms.uPoseAtlas = { value: texture };
    shader.vertexShader = `
      uniform highp sampler2D uPoseAtlas;
      attribute float poseFrame;
      ${rigid ? '' : 'attribute vec4 poseBones; attribute vec4 poseWeights; varying float teamMark;'}
      vec3 poseRotate(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
      void poseBone(float bone, float weight, inout vec3 p, inout vec3 n, inout vec3 t) {
        ivec2 address = ivec2(int(bone) * 2, int(poseFrame));
        vec4 q = normalize(texelFetch(uPoseAtlas, address, 0));
        vec3 tr = texelFetch(uPoseAtlas, address + ivec2(1,0), 0).xyz;
        p += weight * (poseRotate(q, position) + tr);
        n += weight * poseRotate(q, normal);
        #ifdef USE_TANGENT
          t += weight * poseRotate(q, tangent.xyz);
        #endif
      }
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('void main() {', `void main() {
      vec3 poseP = vec3(0.), poseN = vec3(0.), poseT = vec3(0.);
      ${rigid ? '' : 'teamMark = step(0.065, abs(position.x)) * step(0.345, position.y) * step(position.y, 0.398);'}
      ${rigid ? `poseBone(${handBone.toFixed(1)}, 1., poseP, poseN, poseT);` :
        'for (int i=0; i<4; ++i) if (poseWeights[i] > 0.) poseBone(poseBones[i], poseWeights[i], poseP, poseN, poseT);'}
    `);
    shader.vertexShader = shader.vertexShader
      .replace('#include <begin_vertex>', 'vec3 transformed = poseP;')
      .replace('#include <beginnormal_vertex>', `vec3 objectNormal = normalize(poseN);
        #ifdef USE_TANGENT
          vec3 objectTangent = normalize(poseT);
        #endif`);
    if (!rigid) {
      // Reflective uniform markings stay legible in the dusk map's deep shadows.
      shader.fragmentShader = 'varying float teamMark;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         totalEmissiveRadiance += diffuseColor.rgb * 0.28;
         #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
           totalEmissiveRadiance += teamMark * vColor.rgb * 0.35;
         #endif`);
    }
  };
}

async function fetchAsset(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Infantry asset ${url} returned ${response.status}`);
  return response;
}

function releaseAsset(asset: GLTF) {
  asset.scene.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    if (node instanceof THREE.SkinnedMesh) node.skeleton.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) {
          value.source.data?.close?.();
          value.dispose();
        }
      }
      material.dispose();
    }
  });
}

export async function loadInfantryRig(capacity: number) {
  const base = import.meta.env.BASE_URL + 'assets/';
  const directory = base + 'infantry-armed/';
  const loader = new GLTFLoader();
  const [model, rifle, metadata, binary] = await Promise.allSettled([
    loader.loadAsync(directory + 'infantry-demo-lod2.glb'),
    loader.loadAsync(base + 'infantry-vpulse/v-pulse-crowd.glb'),
    fetchAsset(directory + 'animation.json').then(r => r.json() as Promise<Atlas>),
    fetchAsset(directory + 'animation.rgba16f').then(r => r.arrayBuffer()),
  ]);
  function release() {
    if (model.status === 'fulfilled') releaseAsset(model.value);
    if (rifle.status === 'fulfilled') releaseAsset(rifle.value);
  }
  try {
    if (model.status === 'rejected') throw model.reason;
    if (rifle.status === 'rejected') throw rifle.reason;
    if (metadata.status === 'rejected') throw metadata.reason;
    if (binary.status === 'rejected') throw binary.reason;
    const body = model.value.scene.getObjectByName('DemoInfantry');
    const gun = rifle.value.scene.getObjectByName('V_Pulse');
    const atlas = metadata.value;
    const hand = atlas.bones.indexOf('hand_R');
    if (!(body instanceof THREE.SkinnedMesh) || !(gun instanceof THREE.Mesh) || hand < 0 ||
        atlas.width !== atlas.bones.length * 2 || binary.value.byteLength !== atlas.width * atlas.heightTexels * 8) {
      throw Error('Invalid infantry rig or atlas');
    }
    const namedClip = (name: string) => {
      const clip = atlas.clips.find(entry => entry.name === name);
      if (!clip) throw Error('Missing infantry animation: ' + name);
      return clip;
    };
    const idle = namedClip('idle'), run = namedClip('run'), fire = namedClip('fire'), crouch = namedClip('crouch');
    const boneOrder = body.skeleton.bones.map(bone => atlas.bones.indexOf(bone.name));
    const gltfHand = boneOrder.indexOf(hand);
    if (gltfHand < 0 || boneOrder.includes(-1)) throw Error('Infantry skeleton differs from baked atlas');
    const skin = body.geometry.getAttribute('skinIndex');
    const mapped = new Float32Array(skin.count * 4);
    for (let i = 0; i < skin.count; i++) {
      for (let j = 0; j < 4; j++) mapped[4 * i + j] = boneOrder[skin.getComponent(i, j)];
    }
    body.geometry.setAttribute('poseBones', new THREE.BufferAttribute(mapped, 4));
    body.geometry.setAttribute('poseWeights', body.geometry.getAttribute('skinWeight'));

    // Bake the grip into vertices once. The atlas hand transform then carries the rifle.
    rifle.value.scene.updateMatrixWorld(true);
    const grip = new THREE.Matrix4().compose(new THREE.Vector3(...atlas.weaponGrip.position),
      new THREE.Quaternion(...atlas.weaponGrip.quaternion), new THREE.Vector3(1, 1, 1));
    gun.geometry.applyMatrix4(body.skeleton.boneInverses[gltfHand].clone().invert().multiply(grip).multiply(gun.matrixWorld));
    const texture = new THREE.DataTexture(new Uint16Array(binary.value), atlas.width, atlas.heightTexels,
      THREE.RGBAFormat, THREE.HalfFloatType);
    texture.needsUpdate = true;
    const frames = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
    function batch(source: THREE.Mesh, rigidBone?: number) {
      source.geometry.setAttribute('poseFrame', frames);
      animateMaterial(source.material as THREE.Material, texture, rigidBone);
      const batch = new THREE.InstancedMesh(source.geometry, source.material, capacity);
      batch.count = 0;
      batch.frustumCulled = false;
      batch.receiveShadow = true;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      return batch;
    }
    const bodies = batch(body);
    const rifles = batch(gun, hand);
    rifles.instanceMatrix = bodies.instanceMatrix;
    const root = new THREE.Group();
    root.name = 'Infantry · V-Pulse';
    root.add(bodies, rifles);
    return {
      root,
      set(i: number, soldier: InfantrySoldier, elapsed: number, matrix: THREE.Matrix4, color: THREE.Color) {
        const sinceShot = elapsed - soldier.lastShotAt;
        const firing = sinceShot >= 0 && sinceShot < fire.duration - (fire.muzzleTime ?? 0);
        const clip = soldier.moving ? run : firing ? fire : soldier.inCover ? crouch : idle;
        const time = clip === fire ? sinceShot + (fire.muzzleTime ?? 0) : (elapsed + soldier.id * .317) % clip.duration;
        frames.setX(i, clip.offset + Math.min(clip.frames - 1, Math.floor(time / clip.duration * (clip.frames - 1))));
        bodies.setMatrixAt(i, matrix);
        bodies.setColorAt(i, color);
      },
      flush(count: number) {
        bodies.count = rifles.count = count;
        bodies.instanceMatrix.needsUpdate = frames.needsUpdate = true;
        if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
      },
      dispose() {
        bodies.dispose();
        rifles.dispose();
        texture.dispose();
        release();
      },
    };
  } catch (error) {
    release();
    throw error;
  }
}
