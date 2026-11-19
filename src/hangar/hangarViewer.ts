import {
  ACESFilmicToneMapping, Color, DirectionalLight, Group, HemisphereLight, InstancedMesh, Mesh,
  Object3D, PCFShadowMap, PerspectiveCamera, PMREMGenerator, Scene, WebGLRenderer,
  type BufferGeometry, type Material, type Texture, type WebGLRenderTarget,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createServiceBay } from './hangarBay';
import mechUrl from './assets/mech-042.glb?url';
import roomUrl from './assets/service-depot.webp?url';

export type Pylon = 'left' | 'right';

interface WeaponModule {
  createWeapon: () => Object3D;
}

const weaponModules = import.meta.glob<WeaponModule>('./weapons/*.js');

function disposeModel(root: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((node) => {
    if (node instanceof InstancedMesh) node.dispose();
    if (node instanceof Mesh) {
      geometries.add(node.geometry);
      const meshMaterials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of meshMaterials) materials.add(material);
    }
  });
  for (const material of materials) {
    for (const property of Object.values(material)) {
      if (property?.isTexture) textures.add(property);
    }
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  const bitmaps = new Set<ImageBitmap>();
  for (const texture of textures) {
    if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) bitmaps.add(texture.image);
    texture.dispose();
  }
  for (const bitmap of bitmaps) bitmap.close();
}

function namedPart(model: Group, name: string) {
  const part = model.getObjectByName(name);
  if (!part) throw new Error(`Missing hangar model part: ${name}`);
  return part;
}

async function loadRoomImage(signal: AbortSignal) {
  const response = await fetch(roomUrl, { signal });
  if (!response.ok) throw new Error('Hangar panorama unavailable');
  const url = URL.createObjectURL(await response.blob());
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function lightWorkshop(renderer: WebGLRenderer) {
  const generator = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  try {
    return generator.fromScene(room, 0.04);
  } finally {
    generator.dispose();
    room.dispose();
  }
}

async function loadMech(signal: AbortSignal) {
  const response = await fetch(mechUrl, { signal });
  if (!response.ok) throw new Error(`Hangar model request failed: ${response.status}`);
  const data = await response.arrayBuffer();
  signal.throwIfAborted();
  return (await new GLTFLoader().parseAsync(data, '')).scene;
}

export async function createHangarViewer(container: HTMLElement, signal: AbortSignal, onFirstFrame: () => void) {
  const [model, roomImage] = await Promise.all([loadMech(signal), loadRoomImage(signal).catch(() => null)]);
  const scene = new Scene();
  scene.add(model);
  let rendererToDispose: WebGLRenderer | undefined;
  let studio: WebGLRenderTarget | undefined;
  let releaseControls: (() => void) | undefined;
  let disposed = false;
  const key = new DirectionalLight('#ffe3bd', 2.4);
  function dispose() {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener('abort', dispose);
    releaseControls?.();
    disposeModel(scene);
    key.shadow.dispose();
    studio?.dispose();
    rendererToDispose?.dispose();
    rendererToDispose?.forceContextLoss();
    rendererToDispose?.domElement.remove();
  }
  try {
    signal.throwIfAborted();
    signal.addEventListener('abort', dispose, { once: true });
    const stock = { left: namedPart(model, 'Stock_Left'), right: namedPart(model, 'Stock_Right') };
    const sockets = { left: namedPart(model, 'Mount_Left'), right: namedPart(model, 'Mount_Right') };
    const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    rendererToDispose = renderer;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.03;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;

    scene.background = new Color('#202a2d');
    model.traverse((part) => {
      if (part instanceof Mesh) {
        part.castShadow = true;
        part.receiveShadow = true;
      }
    });
    scene.add(createServiceBay(roomImage), new HemisphereLight('#bbd5e0', '#524337', 0.68));
    key.position.set(2.5, 9.5, 7.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { near: 1, far: 34, left: -10, right: 10, top: 9, bottom: -8 });
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    const rim = new DirectionalLight('#94c8f2', 2.05);
    rim.position.set(-6.5, 6.5, -8);
    const fill = new DirectionalLight('#aebdc1', 0.54);
    fill.position.set(-5, 3.5, 6);
    scene.add(key, rim, fill);

    studio = lightWorkshop(renderer);
    scene.environment = studio.texture;
    scene.environmentIntensity = 0.54;
    renderer.shadowMap.needsUpdate = true;

    const camera = new PerspectiveCamera(35, 1, 0.1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.65, 0);
    camera.position.set(7.25, 4.35, 12.9);
    controls.minDistance = 6.6;
    controls.maxDistance = 18.5;
    controls.minPolarAngle = Math.PI * 0.30;
    controls.maxPolarAngle = Math.PI * 0.51;
    controls.enablePan = false;
    controls.update();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '3D-модель меха Т2-042. Вращение стрелками.');
    const directions: Record<string, () => void> = {
      ArrowLeft: () => controls.rotateLeft(0.13),
      ArrowRight: () => controls.rotateLeft(-0.13),
      ArrowUp: () => controls.rotateUp(0.13),
      ArrowDown: () => controls.rotateUp(-0.13),
    };
    const rotate = (event: KeyboardEvent) => {
      const turn = directions[event.key];
      if (!turn) return;
      event.preventDefault();
      turn();
    };
    canvas.addEventListener('keydown', rotate);
    container.appendChild(canvas);

    let frame = 0;
    let firstFrame = true;
    let compiled = false;
    function invalidate() {
      if (frame || !compiled || signal.aborted) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (signal.aborted || !container.clientWidth || !container.clientHeight) return;
        renderer.render(scene, camera);
        if (firstFrame) {
          firstFrame = false;
          onFirstFrame();
        }
      });
    }

    function resize() {
      const { clientWidth: width, clientHeight: height } = container;
      if (!width || !height) return;
      camera.aspect = width / height;
      const framing = Math.max(1, 1.0 / camera.aspect);
      camera.fov = 2 * Math.atan(Math.tan(35 * Math.PI / 360) * framing) * 180 / Math.PI;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      invalidate();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    controls.addEventListener('change', invalidate);
    const attachments: Partial<Record<Pylon, Object3D>> = {};
    releaseControls = () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.removeEventListener('change', invalidate);
      controls.dispose();
      canvas.removeEventListener('keydown', rotate);
    };
    resize();
    await renderer.compileAsync(scene, camera);
    signal.throwIfAborted();
    compiled = true;
    invalidate();

    return {
      async setWeapon(side: Pylon, modulePath: string | undefined, isCurrent: () => boolean) {
        const load = modulePath ? weaponModules[modulePath] : undefined;
        if (modulePath && !load) throw new Error(`Missing hangar weapon module: ${modulePath}`);
        const weapon = await load?.();
        if (signal.aborted || !isCurrent()) return false;
        const next = weapon?.createWeapon();
        if (next && !next.isObject3D) throw new Error(`Invalid hangar weapon: ${modulePath}`);
        const previous = attachments[side];
        if (next) {
          next.traverse((part) => {
            if (part instanceof Mesh) part.receiveShadow = true;
          });
          sockets[side].add(next);
        }
        attachments[side] = next;
        stock[side].visible = !next;
        if (previous) {
          previous.removeFromParent();
          disposeModel(previous);
        }
        renderer.shadowMap.needsUpdate = true;
        invalidate();
        return true;
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
