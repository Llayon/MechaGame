import {
  ACESFilmicToneMapping, Color, DirectionalLight, Group, HemisphereLight, InstancedMesh, Mesh,
  Object3D, PCFShadowMap, PerspectiveCamera, PMREMGenerator, Scene, WebGLRenderer,
  type BufferGeometry, type Material, type Texture,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import mechUrl from './assets/mech-042.glb?url';

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

export async function createHangarViewer(container: HTMLElement, signal: AbortSignal, onFirstFrame: () => void) {
  const response = await fetch(mechUrl, { signal });
  if (!response.ok) throw new Error(`Hangar model request failed: ${response.status}`);
  const { scene: model } = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
  let renderer: WebGLRenderer;
  try {
    signal.throwIfAborted();
    const stock = { left: namedPart(model, 'Stock_Left'), right: namedPart(model, 'Stock_Right') };
    const sockets = { left: namedPart(model, 'Mount_Left'), right: namedPart(model, 'Mount_Right') };
    renderer = new WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;

    const scene = new Scene();
    scene.background = new Color('#161a1d');
    model.traverse((part) => {
      if (part instanceof Mesh) {
        part.castShadow = true;
        part.receiveShadow = true;
      }
    });
    scene.add(model, new HemisphereLight('#a8bed4', '#24282b', 0.75));
    const key = new DirectionalLight('#fff8ee', 2.25);
    key.position.set(6.5, 11.5, 7.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { near: 2, far: 26, left: -5.6, right: 5.6, top: 7.1, bottom: -4.6 });
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    const rim = new DirectionalLight('#78aee0', 1.25);
    rim.position.set(-7.5, 7.5, -6.5);
    const fill = new DirectionalLight('#9aa69d', 0.55);
    fill.position.set(-5, 3.5, 6);
    scene.add(key, rim, fill);

    const room = new RoomEnvironment();
    const generator = new PMREMGenerator(renderer);
    const studio = generator.fromScene(room, 0.04);
    scene.environment = studio.texture;
    scene.environmentIntensity = 0.65;
    generator.dispose();
    room.dispose();
    renderer.shadowMap.needsUpdate = true;

    const camera = new PerspectiveCamera(35, 1, 0.1, 75);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.32, 0);
    camera.position.set(7.3, 5.7, 9.1);
    controls.minDistance = 5.1;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI * 0.48;
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
    function invalidate() {
      if (frame || signal.aborted) return;
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
      camera.setViewOffset(width, height, 0, height * 0.045, width, height);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      invalidate();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    controls.addEventListener('change', invalidate);
    const attachments: Partial<Record<Pylon, Object3D>> = {};
    signal.addEventListener('abort', () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      canvas.removeEventListener('keydown', rotate);
      disposeModel(scene);
      key.shadow.dispose();
      studio.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    }, { once: true });
    resize();

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
    disposeModel(model);
    throw error;
  }
}
