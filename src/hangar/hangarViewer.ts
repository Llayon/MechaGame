import {
  CircleGeometry, Color, CylinderGeometry, DirectionalLight, Group, HemisphereLight, InstancedMesh, Mesh,
  MeshStandardMaterial, Object3D, PerspectiveCamera, Scene, WebGLRenderer,
  type BufferGeometry, type Material, type Texture,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
  for (const texture of textures) texture.dispose();
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
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    const scene = new Scene();
    scene.background = new Color('#14201f');
    scene.add(model, new HemisphereLight('#cedfed', '#776650', 2));
    const key = new DirectionalLight('#fff1d0', 2.5);
    key.position.set(5, 10, 6);
    const rim = new DirectionalLight('#91c4df', 2);
    rim.position.set(-6, 6, -7);
    scene.add(key, rim);

    const platform = new Mesh(
      new CylinderGeometry(3.42, 3.5, 0.25, 64),
      new MeshStandardMaterial({ color: '#34423d', roughness: 0.86 }),
    );
    platform.position.y = 0.125;
    const deck = new Mesh(new CircleGeometry(3.1, 64), new MeshStandardMaterial({ color: '#46554e', roughness: 0.9 }));
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 0.253;
    scene.add(platform, deck);

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
        if (next) sockets[side].add(next);
        attachments[side] = next;
        stock[side].visible = !next;
        if (previous) {
          previous.removeFromParent();
          disposeModel(previous);
        }
        invalidate();
        return true;
      },
    };
  } catch (error) {
    disposeModel(model);
    throw error;
  }
}
