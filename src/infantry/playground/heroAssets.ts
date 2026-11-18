import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { HeroAnimation } from './controller';

export const SKINS = [
  { id: 'original', name: 'Оригинал', color: '#8c9070', accent: '#db762d', description: 'Оливковая броня · исходные цвета' },
  { id: 'urban', name: 'Городской', color: '#536f83', accent: '#83c8dc', description: 'Сине-серая броня · холодные маркеры' },
  { id: 'arctic', name: 'Арктика', color: '#c3cecf', accent: '#5aa6cf', description: 'Светлая броня · синие маркеры' },
  { id: 'desert', name: 'Пустыня', color: '#b99a68', accent: '#f0b64f', description: 'Песочная броня · янтарные маркеры' },
  { id: 'assault', name: 'Штурмовой', color: '#66555a', accent: '#ed6741', description: 'Тёмная броня · красные маркеры' },
] as const;
export type SkinId = typeof SKINS[number]['id'];
export const LOD_TRIANGLES = [3999, 1999, 999] as const;
export interface DemoManifest { clips: Array<{ name: HeroAnimation; duration: number; movementSpeed: number; loop: boolean }> }
export async function loadHeroAssets() {
  const base = import.meta.env.BASE_URL + 'assets/infantry-candidate/demo/';
  const response = await fetch(base + 'manifest.json');
  if (!response.ok) throw Error('Не удалось загрузить описание анимаций');
  const manifest = await response.json() as DemoManifest;
  const results = await Promise.allSettled([0, 1, 2].map(level => new GLTFLoader().loadAsync(base + `infantry-demo-lod${level}.glb`)));
  const loaded = results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
  const release = () => {
    const materials = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>();
    loaded.forEach(gltf => gltf.scene.traverse(o => {
      if (o instanceof THREE.Mesh) {
        geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m));
        if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
      }
    }));
    materials.forEach(m => Object.values(m).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); }));
    geometries.forEach(g => g.dispose()); textures.forEach(t => { (t.source.data as { close?: () => void })?.close?.(); t.dispose(); }); materials.forEach(m => m.dispose());
  };
  if (results.some(r => r.status === 'rejected')) { release(); throw Error('Не удалось загрузить одну из моделей'); }
  const root = new THREE.Group(), uniforms = { demoSkinArmor: { value: new THREE.Color() }, demoSkinAccent: { value: new THREE.Color() }, demoSkinBlend: { value: 0 } };
  const models = loaded.map((gltf, level) => {
    const mesh = gltf.scene.getObjectByName('DemoInfantry') as THREE.SkinnedMesh;
    if (!mesh?.isSkinnedMesh || Array.isArray(mesh.material)) throw Error('Ожидалась подготовленная модель со скелетом');
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = 'uniform vec3 demoSkinArmor; uniform vec3 demoSkinAccent; uniform float demoSkinBlend;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec3 sourceColor=diffuseColor.rgb;
        float brightness=dot(sourceColor,vec3(.2126,.7152,.0722));
        float orange=smoothstep(1.35,2.1,sourceColor.r/max(.001,sourceColor.g))*smoothstep(1.2,1.8,sourceColor.g/max(.001,sourceColor.b));
        float armor=smoothstep(.035,.11,brightness)*(1.0-orange);
        vec3 coating=demoSkinArmor*(.35+brightness*2.3);
        diffuseColor.rgb=mix(sourceColor,coating,armor*demoSkinBlend*.88);
        diffuseColor.rgb=mix(diffuseColor.rgb,demoSkinAccent*(.45+brightness*1.6),orange*demoSkinBlend*.9);`);
    };
    material.customProgramCacheKey = () => 'infantry-playground-palette-v1';
    gltf.scene.visible = level === 2; root.add(gltf.scene);
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const actions = Object.fromEntries(gltf.animations.map(clip => [clip.name, mixer.clipAction(clip)])) as Record<HeroAnimation, THREE.AnimationAction>;
    for (const clip of manifest.clips) if (!actions[clip.name]) throw Error('Missing demo animation: ' + clip.name);
    return { ...gltf, mesh, mixer, actions };
  });
  let disposed = false;
  return { root, models, manifest,
    setSkin(id: SkinId) {
      const skin = SKINS.find(s => s.id === id) ?? SKINS[0];
      uniforms.demoSkinBlend.value = skin.id === 'original' ? 0 : 1;
      uniforms.demoSkinArmor.value.set(skin.color); uniforms.demoSkinAccent.value.set(skin.accent);
    },
    setNormals(enabled: boolean) { models.forEach(m => (m.mesh.material as THREE.MeshStandardMaterial).normalScale.setScalar(enabled ? 1 : 0)); },
    dispose() {
      if (disposed) return; disposed = true;
      models.forEach(m => { m.mixer.stopAllAction(); m.mixer.uncacheRoot(m.scene); });
      release(); root.clear();
    },
  };
}
export type HeroAssets = Awaited<ReturnType<typeof loadHeroAssets>>;
