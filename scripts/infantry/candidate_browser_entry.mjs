import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(800, 760); document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#18212b');
scene.add(new THREE.HemisphereLight('#e8efff', '#454039', 2.2));
const light = new THREE.DirectionalLight('#ffffff', 3); light.position.set(1, 2, 3); scene.add(light);
const camera = new THREE.PerspectiveCamera(30, 800 / 760, .01, 10);
camera.position.set(.6, .43, 1.1); camera.lookAt(0, .24, 0);
let current;
function dispose(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(o => { if (o.isMesh) { geometries.add(o.geometry); materials.add(o.material); } });
  materials.forEach(m => Object.values(m).forEach(value => { if (value?.isTexture) textures.add(value); }));
  geometries.forEach(g => g.dispose()); textures.forEach(t => { t.source.data?.close?.(); t.dispose(); }); materials.forEach(m => m.dispose());
  scene.remove(root);
}
function pixels() {
  const context = renderer.getContext(), data = new Uint8Array(800 * 760 * 4);
  context.readPixels(0,0,800,760,context.RGBA,context.UNSIGNED_BYTE,data);
  return data;
}
async function show(level) {
  if (current) dispose(current);
  const gltf = await new GLTFLoader().loadAsync(`/assets/infantry-candidate-lod${level}.glb`);
  current = gltf.scene; scene.add(current);
  let mesh; current.traverse(o => { if (o.isMesh) mesh=o; });
  const material = mesh.material;
  if (!material.map || !material.normalMap || !material.roughnessMap || !material.metalnessMap) throw Error('Missing PBR map');
  renderer.render(scene,camera); const normalPixels=pixels();
  const counters = { calls:renderer.info.render.calls, triangles:renderer.info.render.triangles,
    geometries:renderer.info.memory.geometries, textures:renderer.info.memory.textures };
  material.normalScale.set(0,0); renderer.render(scene,camera); const flatPixels=pixels();
  let changed=0;
  for(let i=0;i<normalPixels.length;i+=4) {
    if(Math.abs(normalPixels[i]-flatPixels[i])+Math.abs(normalPixels[i+1]-flatPixels[i+1])+Math.abs(normalPixels[i+2]-flatPixels[i+2])>8) changed++;
  }
  material.normalScale.set(1,1); renderer.render(scene,camera);
  return { level, ...counters, changedNormalPixels:changed,
    textureSizes:[material.map,material.normalMap,material.roughnessMap].map(t=>[t.image.width,t.image.height]),
    normalColorSpace:material.normalMap.colorSpace, hasTangents:!!mesh.geometry.getAttribute('tangent') };
}
window.__candidateAssetTest={ready:false};
(async()=>{
  const reports=[];
  for(const level of [0,1,2,0]) reports.push(await show(level));
  const context=renderer.getContext(), ext=context.getExtension('WEBGL_debug_renderer_info');
  window.__candidateAssetTest={ready:true, reports, renderer:String(context.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:context.RENDERER))};
})().catch(error=>{console.error(error);window.__candidateAssetTest={ready:true,error:String(error)};});
