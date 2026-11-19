import {
  BoxGeometry, CanvasTexture, Color, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, MirroredRepeatWrapping, Object3D, PlaneGeometry, RingGeometry,
  ShadowMaterial, SRGBColorSpace, Texture,
} from 'three';

function createWorkshopRoom(image: HTMLImageElement | null) {
  const room = new Group();
  room.name = 'Repair depot';
  const halfWidth = 23, halfDepth = 22, height = 14.5;
  let backdrop: Texture | null = null;
  let concrete: CanvasTexture | null = null;
  if (image) {
    backdrop = new Texture(image);
    backdrop.colorSpace = SRGBColorSpace;
    backdrop.needsUpdate = true;
    const tile = document.createElement('canvas');
    tile.width = 512;
    tile.height = 256;
    const ctx = tile.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, image.width * 0.37, image.height * 0.67, image.width * 0.27,
        image.height * 0.26, 0, 0, tile.width, tile.height);
      concrete = new CanvasTexture(tile);
      concrete.colorSpace = SRGBColorSpace;
      concrete.wrapS = concrete.wrapT = MirroredRepeatWrapping;
      concrete.repeat.set(6, 10);
      concrete.anisotropy = 4;
    }
  }
  const walls = new MeshBasicMaterial({ map: backdrop, color: backdrop ? '#bcc6c7' : '#424b4d', toneMapped: false });
  function wall(width: number, x: number, z: number, yaw: number, left: number, right: number) {
    const geometry = new PlaneGeometry(width, height);
    // Project just the facade onto vertical planes. The photographed floor has
    // its own perspective and would otherwise bend the foot of each column.
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, left + (right - left) * uv.getX(i), 0.425 + 0.50 * uv.getY(i));
    }
    const face = new Mesh(geometry, walls);
    face.rotation.y = yaw;
    face.position.set(x, height / 2 - 0.05, z);
    room.add(face);
  }
  wall(halfWidth * 2, 0, -halfDepth, 0, 0.055, 0.945);
  wall(halfWidth * 2, 0, halfDepth, Math.PI, 0.90, 0.06);
  wall(halfDepth * 2, -halfWidth, 0, Math.PI / 2, 0.50, 0.025);
  wall(halfDepth * 2, halfWidth, 0, -Math.PI / 2, 0.97, 0.42);
  const slab = new PlaneGeometry(halfWidth * 2, halfDepth * 2, 64, 64);
  const positions = slab.getAttribute('position');
  const tones: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = -positions.getY(i);
    const bayLight = Math.exp(-(x * x / 105 + z * z / 76));
    const doorLight = Math.exp(-((x - 10) ** 2 / 4 + (z + 17) ** 2 / 48));
    const brightness = 0.30 + 0.71 * bayLight + 0.58 * doorLight;
    tones.push(brightness * 0.93, brightness * 0.97, brightness);
  }
  slab.setAttribute('color', new Float32BufferAttribute(tones, 3));
  const floor = new Mesh(slab, new MeshBasicMaterial({
    map: concrete, color: concrete ? '#d4d0c8' : '#464a49', vertexColors: true, toneMapped: false,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.05;
  room.add(floor);
  const shadows = new Mesh(new PlaneGeometry(25, 22), new ShadowMaterial({ opacity: 0.32, depthWrite: false }));
  shadows.rotation.x = -Math.PI / 2;
  shadows.position.y = -0.046;
  shadows.receiveShadow = true;
  room.add(shadows);
  const roof = new Mesh(new PlaneGeometry(halfWidth * 2, halfDepth * 2), new MeshBasicMaterial({ color: '#222d31' }));
  roof.rotation.x = Math.PI / 2;
  roof.position.y = height - 0.05;
  room.add(roof);
  return room;
}

function contactShadows(bay: Group) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 96;
  const ctx = tile.getContext('2d');
  if (!ctx) return;
  const fade = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  fade.addColorStop(0, 'rgba(6,10,12,0.9)');
  fade.addColorStop(0.67, 'rgba(6,10,12,0.68)');
  fade.addColorStop(0.89, 'rgba(6,10,12,0.32)');
  fade.addColorStop(1, 'rgba(6,10,12,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 96, 96);
  const shadow = new MeshBasicMaterial({ map: new CanvasTexture(tile), transparent: true, depthWrite: false, toneMapped: false });
  const patch = new PlaneGeometry(1, 1);
  for (const [x, z, w, d] of [[0, 0, 10.5, 10.5], [-6.5, -4.75, 6.5, 2.5], [7.3, -6.3, 2.5, 1.55]]) {
    const mesh = new Mesh(patch, shadow);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(w, d, 1);
    mesh.position.set(x, -0.041, z);
    bay.add(mesh);
  }
}

// The turntable in the original model is 8.7 m across. The service stairs and
// inspection rails give the pilot a human-scale reference when orbiting it.
export function createServiceBay(image: HTMLImageElement | null) {
  const bay = new Group();
  bay.name = 'Service bay';
  bay.rotation.y = 0.25;
  bay.add(createWorkshopRoom(image));
  contactShadows(bay);
  const metal = '#394443', tread = '#2c3737', edge = '#8b6b37', rail = '#92703a';
  const parts: { matrix: Matrix4; color: string }[] = [];
  const pose = new Object3D();

  function box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, yaw = 0, roll = 0) {
    pose.position.set(x, y, z);
    pose.rotation.set(0, yaw, roll);
    pose.scale.set(w, h, d);
    pose.updateMatrix();
    parts.push({ matrix: pose.matrix.clone(), color });
  }

  for (const side of [-1, 1]) {
    const x = side * 5.4;
    box(x, -0.028, 0, 0.26, 0.02, 16.5, '#253032');
    for (let i = -24; i <= 24; i++) {
      box(x, -0.013, i * 0.33, 0.22, 0.014, 0.065, '#53605b');
    }
    for (let i = 0; i < 7; i++) {
      box(side * (3.65 + i * 0.25), -0.017, 4.05, 0.105, 0.012, 0.75, edge, -side * 0.48);
    }
  }

  // A fixed service platform with an open stair at the end nearest the bay.
  const deckY = 1.48, deckX = -6.65, deckZ = -4.75;
  box(deckX, deckY - 0.09, deckZ, 4.6, 0.18, 1.5, metal);
  for (let i = 0; i < 24; i++) box(deckX - 2.17 + i * 0.19, deckY + 0.011, deckZ, 0.055, 0.02, 1.33, tread);
  for (const x of [-8.75, -6.65, -4.55]) {
    for (const z of [deckZ - 0.62, deckZ + 0.62]) {
      box(x, deckY / 2, z, 0.13, deckY, 0.13, tread);
      box(x, deckY + 0.49, z, 0.055, 1.0, 0.055, rail);
    }
  }
  for (const z of [deckZ - 0.62, deckZ + 0.62]) {
    box(deckX, deckY + 0.97, z, 4.28, 0.06, 0.06, rail);
    box(deckX, deckY + 0.47, z, 4.28, 0.042, 0.042, metal);
    box(deckX, deckY + 0.05, z, 4.55, 0.1, 0.065, edge);
  }
  for (let step = 0; step < 7; step++) {
    const x = -4.22 + step * 0.26, y = deckY - step * 0.21;
    box(x, y - 0.055, deckZ, 0.29, 0.11, 1.08, tread);
    box(x + 0.13, y - 0.026, deckZ, 0.035, 0.055, 1.08, edge);
  }
  for (const side of [-1, 1]) {
    box(-3.45, 0.79, deckZ + side * 0.47, 2.3, 0.15, 0.08, metal, 0, -0.68);
  }

  // A rolling tool cabinet opposite the stairs.
  const cartX = 7.3, cartZ = -6.3;
  box(cartX, 0.6, cartZ, 1.55, 0.97, 0.79, '#34434a');
  box(cartX, 1.12, cartZ, 1.65, 0.10, 0.86, '#475455');
  for (let drawer = 0; drawer < 4; drawer++) {
    box(cartX, 0.35 + drawer * 0.19, cartZ + 0.4, 1.38, 0.14, 0.028, '#485355');
    box(cartX, 0.4 + drawer * 0.19, cartZ + 0.425, 0.74, 0.027, 0.045, '#4c5350');
  }
  for (const x of [cartX - 0.57, cartX + 0.57]) {
    for (const z of [cartZ - 0.25, cartZ + 0.25]) box(x, 0.09, z, 0.14, 0.18, 0.15, tread);
  }
  for (const z of [cartZ - 0.26, cartZ + 0.26]) box(cartX + 0.84, 1.13, z, 0.07, 0.30, 0.07, metal);
  box(cartX + 0.84, 1.27, cartZ, 0.075, 0.075, 0.6, edge);

  // Repeated portal frames give the long hall depth as the camera moves.
  for (const z of [-20, -12, -4, 4, 12, 20]) {
    for (const side of [-1, 1]) {
      box(side * 22.65, 6.9, z, 0.40, 13.8, 0.44, '#394b50');
      box(side * 21.65, 12.85, z, 3.05, 0.24, 0.36, metal, 0, -side * 0.64);
    }
    box(0, 13.9, z, 45.7, 0.34, 0.52, '#3d4e52');
    box(0, 13.0, z, 45.4, 0.19, 0.28, '#455457');
    for (let x = -20; x <= 20; x += 4) {
      box(x, 13.45, z, 2.32, 0.11, 0.16, '#46565a', 0, 0.42);
      box(x + 2, 13.45, z, 2.32, 0.11, 0.16, '#46565a', 0, -0.42);
    }
  }

  const fittings = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial({
    roughness: 0.78, metalness: 0.32,
  }), parts.length);
  const color = new Color();
  parts.forEach((part, i) => {
    fittings.setMatrixAt(i, part.matrix);
    fittings.setColorAt(i, color.set(part.color));
  });
  fittings.castShadow = true;
  fittings.receiveShadow = true;
  bay.add(fittings);

  const circle = new Mesh(new RingGeometry(4.62, 4.66, 96), new MeshBasicMaterial({ color: '#9b8050' }));
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = -0.026;
  bay.add(circle);
  return bay;
}
