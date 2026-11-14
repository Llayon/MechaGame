import * as THREE from 'three';

function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createCastArmorTextures(maxAniso: number) {
  const rand = createRng(19520316);
  const size = 512;
  const diffCanvas = document.createElement('canvas');
  const heightCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  diffCanvas.width = heightCanvas.width = roughCanvas.width = size;
  diffCanvas.height = heightCanvas.height = roughCanvas.height = size;

  const dCtx = diffCanvas.getContext('2d')!;
  const hCtx = heightCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;

  dCtx.fillStyle = '#5c6440';
  dCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#a8a8a8';
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 18 + rand() * 56;
    const g = dCtx.createRadialGradient(x, y, 2, x, y, rad);
    if (i % 3 === 0) {
      g.addColorStop(0, 'rgba(134, 136, 64, 0.25)');
    } else if (i % 3 === 1) {
      g.addColorStop(0, 'rgba(54, 62, 38, 0.34)');
    } else {
      g.addColorStop(0, 'rgba(116, 94, 58, 0.22)');
    }
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dCtx.fillStyle = g;
    dCtx.beginPath();
    dCtx.arc(x, y, rad, 0, Math.PI * 2);
    dCtx.fill();
  }

  for (let i = 0; i < 16000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 2.4;
    const shade = 68 + Math.floor(rand() * 54);
    dCtx.fillStyle = `rgba(${shade + 6}, ${shade + 12}, ${shade - 18}, 0.28)`;
    dCtx.fillRect(x, y, r, r);

    const hVal = 108 + Math.floor(rand() * 42);
    hCtx.fillStyle = `rgb(${hVal},${hVal},${hVal})`;
    hCtx.fillRect(x, y, r, r);
  }

  for (let row = 44; row < size; row += 128) {
    for (let col = 28; col < size; col += 64) {
      hCtx.fillStyle = '#e4e4e4';
      hCtx.beginPath();
      hCtx.arc(col, row, 4.4, 0, Math.PI * 2);
      hCtx.fill();

      const streakLen = 22 + rand() * 54;
      const grad = dCtx.createLinearGradient(col, row, col, row + streakLen);
      grad.addColorStop(0, 'rgba(68, 38, 18, 0.65)');
      grad.addColorStop(0.5, 'rgba(84, 46, 20, 0.34)');
      grad.addColorStop(1, 'rgba(54, 34, 20, 0)');
      dCtx.fillStyle = grad;
      dCtx.fillRect(col - 3, row, 6, streakLen);

      rCtx.fillStyle = 'rgba(65, 65, 65, 0.55)';
      rCtx.fillRect(col - 2.5, row, 5, streakLen * 0.7);
    }
  }

  for (let i = 0; i < 75; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 5 + rand() * 18;
    const h = 2 + rand() * 5;
    dCtx.fillStyle = 'rgba(158, 165, 154, 0.56)';
    dCtx.fillRect(x, y, w, h);
    rCtx.fillStyle = 'rgba(52, 52, 52, 0.7)';
    rCtx.fillRect(x, y, w, h);
  }

  const srcData = hCtx.getImageData(0, 0, size, size).data;
  const normCanvas = document.createElement('canvas');
  normCanvas.width = normCanvas.height = size;
  const nCtx = normCanvas.getContext('2d')!;
  const outImg = nCtx.createImageData(size, size);
  const out = outImg.data;
  const sample = (x: number, y: number) => {
    const wx = (x + size) % size;
    const wy = (y + size) % size;
    return srcData[(wy * size + wx) * 4] / 255.0;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);
      const dx = tr + 2 * r + br - (tl + 2 * l + bl);
      const dy = bl + 2 * b + br - (tl + 2 * t + tr);
      const nx = -dx * 2.5;
      const ny = -dy * 2.5;
      const nz = 1.0;
      const len = Math.hypot(nx, ny, nz);
      const idx = (y * size + x) * 4;
      out[idx] = ((nx / len) * 0.5 + 0.5) * 255;
      out[idx + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      out[idx + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      out[idx + 3] = 255;
    }
  }
  nCtx.putImageData(outImg, 0, 0);

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(normCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  [map, normalMap, roughnessMap].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    t.anisotropy = maxAniso;
  });
  return { map, normalMap, roughnessMap };
}

function createMustardMaskTexture(maxAniso: number) {
  const rand = createRng(195207);
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#9c9428');
  grad.addColorStop(0.5, '#898826');
  grad.addColorStop(1, '#646720');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 6500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(54, 58, 16, 0.28)' : 'rgba(192, 192, 78, 0.20)';
    ctx.fillRect(x, y, 2 + rand() * 3.5, 2 + rand() * 3.5);
  }

  ctx.strokeStyle = 'rgba(34, 38, 16, 0.65)';
  ctx.lineWidth = 14;
  ctx.strokeRect(4, 4, size - 8, size - 8);

  ctx.save();
  ctx.translate(size * 0.28, size * 0.46);
  ctx.rotate(-0.3);
  ctx.fillStyle = 'rgba(240, 238, 224, 0.90)';
  ctx.fillRect(-16, -220, 32, 410);

  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = '#8b8a27';
    const sx = (rand() > 0.5 ? -18 : 10) + (rand() - 0.5) * 12;
    const sy = -220 + rand() * 410;
    ctx.fillRect(sx, sy, 4 + rand() * 10, 3 + rand() * 10);
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createTowCableTexture(maxAniso: number) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3c4042';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = -128; i < 256; i += 12) {
    ctx.strokeStyle = '#73797d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 128, 128);
    ctx.stroke();

    ctx.strokeStyle = '#1b1d1e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(i + 6, 0);
    ctx.lineTo(i + 134, 128);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 2);
  tex.anisotropy = maxAniso;
  return tex;
}

function createCanvasRollTexture(maxAniso: number) {
  const rand = createRng(195299);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#6d6648';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.fillStyle =
      rand() > 0.5 ? 'rgba(42,38,24,0.22)' : 'rgba(145,136,102,0.20)';
    ctx.fillRect(x, y, 2, 2);
  }
  for (let y = 16; y < 256; y += 28) {
    ctx.fillStyle = 'rgba(36, 32, 20, 0.35)';
    ctx.fillRect(0, y, 256, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAniso;
  return tex;
}

type DecalType = '316' | 'star' | 'recoil' | 'nostep' | 'fuel' | 'scale';

function createDecalMaterial(type: DecalType, maxAniso: number) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 128);

  if (type === '316') {
    ctx.fillStyle = 'rgba(242, 240, 226, 0.95)';
    ctx.font = 'bold 78px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('316', 128, 66);
  } else if (type === 'star') {
    ctx.fillStyle = '#bd2622';
    ctx.strokeStyle = 'rgba(242, 236, 218, 0.90)';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 48 : 20;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const x = 128 + Math.cos(a) * r;
      const y = 64 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (type === 'recoil') {
    ctx.fillStyle = 'rgba(240, 214, 92, 0.92)';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ОПАСНО • ОТКАТ', 128, 46);
    ctx.fillStyle = 'rgba(235, 234, 222, 0.88)';
    ctx.font = 'bold 17px monospace';
    ctx.fillText('37-ММ АЗП', 128, 76);
  } else if (type === 'nostep') {
    ctx.strokeStyle = 'rgba(220, 68, 52, 0.90)';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 34, 208, 60);
    ctx.fillStyle = 'rgba(238, 234, 216, 0.92)';
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('НЕ НАСТУПАТЬ', 128, 71);
  } else if (type === 'fuel') {
    ctx.fillStyle = 'rgba(242, 218, 96, 0.92)';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('МАСЛО / ГСМ', 128, 70);
  } else if (type === 'scale') {
    ctx.strokeStyle = 'rgba(242, 240, 224, 0.90)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(128, 118, 92, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    for (let a = -50; a <= 50; a += 10) {
      const rad = ((a - 90) * Math.PI) / 180;
      const r1 = 92;
      const r2 = a % 20 === 0 ? 78 : 84;
      ctx.beginPath();
      ctx.moveTo(128 + Math.cos(rad) * r1, 118 + Math.sin(rad) * r1);
      ctx.lineTo(128 + Math.cos(rad) * r2, 118 + Math.sin(rad) * r2);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    roughness: 0.72,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
  });
}

export interface MechMaterialsBundle {
  armorMat: THREE.MeshStandardMaterial;
  mustardArmorMat: THREE.MeshStandardMaterial;
  faceMaskMat: THREE.MeshStandardMaterial;
  greenAmmoMat: THREE.MeshStandardMaterial;
  darkSteelMat: THREE.MeshStandardMaterial;
  towCableMat: THREE.MeshStandardMaterial;
  tarpRollMat: THREE.MeshStandardMaterial;
  leatherStrapMat: THREE.MeshStandardMaterial;
  gunmetalBlueMat: THREE.MeshStandardMaterial;
  chromeRodMat: THREE.MeshStandardMaterial;
  brassMat: THREE.MeshStandardMaterial;
  canvasBootMat: THREE.MeshStandardMaterial;
  terracottaMudMat: THREE.MeshStandardMaterial;
  whiteStripeMat: THREE.MeshStandardMaterial;
  opticLensMat: THREE.MeshStandardMaterial;
  redSensorGlintMat: THREE.MeshStandardMaterial;
  amberLampMat: THREE.MeshStandardMaterial;
  redBeaconMat: THREE.MeshStandardMaterial;
  decal316Mat: THREE.MeshStandardMaterial;
  decalStarMat: THREE.MeshStandardMaterial;
  decalRecoilMat: THREE.MeshStandardMaterial;
  decalNoStepMat: THREE.MeshStandardMaterial;
  decalFuelMat: THREE.MeshStandardMaterial;
  decalScaleMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createMechMaterials(maxAniso: number): MechMaterialsBundle {
  const armorTex = createCastArmorTextures(maxAniso);
  const maskTex = createMustardMaskTexture(maxAniso);
  const cableTex = createTowCableTexture(maxAniso);
  const tarpTex = createCanvasRollTexture(maxAniso);

  const armorMat = new THREE.MeshStandardMaterial({
    map: armorTex.map,
    normalMap: armorTex.normalMap,
    roughnessMap: armorTex.roughnessMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughness: 0.72,
    metalness: 0.24,
  });

  const mustardArmorMat = new THREE.MeshStandardMaterial({
    color: 0x9b9328,
    normalMap: armorTex.normalMap,
    roughnessMap: armorTex.roughnessMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.52,
    metalness: 0.2,
  });

  const faceMaskMat = new THREE.MeshStandardMaterial({
    map: maskTex,
    normalMap: armorTex.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.44,
    metalness: 0.16,
  });

  const greenAmmoMat = new THREE.MeshStandardMaterial({
    color: 0x4b7334,
    normalMap: armorTex.normalMap,
    roughness: 0.58,
    metalness: 0.24,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x262b29,
    roughness: 0.42,
    metalness: 0.78,
  });

  const towCableMat = new THREE.MeshStandardMaterial({
    map: cableTex,
    roughness: 0.38,
    metalness: 0.82,
  });

  const tarpRollMat = new THREE.MeshStandardMaterial({
    map: tarpTex,
    roughness: 0.88,
    metalness: 0.05,
  });

  const leatherStrapMat = new THREE.MeshStandardMaterial({
    color: 0x4a2916,
    roughness: 0.62,
    metalness: 0.1,
  });

  const gunmetalBlueMat = new THREE.MeshStandardMaterial({
    color: 0x242b36,
    roughness: 0.3,
    metalness: 0.84,
  });

  const chromeRodMat = new THREE.MeshStandardMaterial({
    color: 0xd0d8dc,
    roughness: 0.16,
    metalness: 0.9,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd1a33c,
    roughness: 0.3,
    metalness: 0.85,
  });

  const canvasBootMat = new THREE.MeshStandardMaterial({
    color: 0x252320,
    roughness: 0.9,
    metalness: 0.08,
  });

  const terracottaMudMat = new THREE.MeshStandardMaterial({
    color: 0x9c4c24,
    normalMap: armorTex.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 0.94,
    metalness: 0.04,
  });

  const whiteStripeMat = new THREE.MeshStandardMaterial({
    color: 0xe6e4d5,
    roughness: 0.65,
    metalness: 0.12,
  });

  const opticLensMat = new THREE.MeshStandardMaterial({
    color: 0x101814,
    emissive: 0x1ee074,
    emissiveIntensity: 0.65,
    roughness: 0.1,
    metalness: 0.6,
  });

  const redSensorGlintMat = new THREE.MeshStandardMaterial({
    color: 0x450d0d,
    emissive: 0xff261b,
    emissiveIntensity: 1.5,
    toneMapped: false,
    roughness: 0.12,
  });

  const amberLampMat = new THREE.MeshStandardMaterial({
    color: 0x6b4c12,
    emissive: 0xffb82e,
    emissiveIntensity: 1.15,
    toneMapped: false,
    roughness: 0.2,
  });

  const redBeaconMat = new THREE.MeshStandardMaterial({
    color: 0x6e1818,
    emissive: 0xff2a1a,
    emissiveIntensity: 1.1,
    toneMapped: false,
    roughness: 0.25,
  });

  const decal316Mat = createDecalMaterial('316', maxAniso);
  const decalStarMat = createDecalMaterial('star', maxAniso);
  const decalRecoilMat = createDecalMaterial('recoil', maxAniso);
  const decalNoStepMat = createDecalMaterial('nostep', maxAniso);
  const decalFuelMat = createDecalMaterial('fuel', maxAniso);
  const decalScaleMat = createDecalMaterial('scale', maxAniso);

  const allMaterials = [
    armorMat,
    mustardArmorMat,
    faceMaskMat,
    greenAmmoMat,
    darkSteelMat,
    towCableMat,
    tarpRollMat,
    leatherStrapMat,
    gunmetalBlueMat,
    chromeRodMat,
    brassMat,
    canvasBootMat,
    terracottaMudMat,
    whiteStripeMat,
    opticLensMat,
    redSensorGlintMat,
    amberLampMat,
    redBeaconMat,
    decal316Mat,
    decalStarMat,
    decalRecoilMat,
    decalNoStepMat,
    decalFuelMat,
    decalScaleMat,
  ];

  const allTextures = [
    armorTex.map,
    armorTex.normalMap,
    armorTex.roughnessMap,
    maskTex,
    cableTex,
    tarpTex,
    decal316Mat.map!,
    decalStarMat.map!,
    decalRecoilMat.map!,
    decalNoStepMat.map!,
    decalFuelMat.map!,
    decalScaleMat.map!,
  ];

  return {
    armorMat,
    mustardArmorMat,
    faceMaskMat,
    greenAmmoMat,
    darkSteelMat,
    towCableMat,
    tarpRollMat,
    leatherStrapMat,
    gunmetalBlueMat,
    chromeRodMat,
    brassMat,
    canvasBootMat,
    terracottaMudMat,
    whiteStripeMat,
    opticLensMat,
    redSensorGlintMat,
    amberLampMat,
    redBeaconMat,
    decal316Mat,
    decalStarMat,
    decalRecoilMat,
    decalNoStepMat,
    decalFuelMat,
    decalScaleMat,
    dispose: () => {
      allTextures.forEach((t) => t.dispose());
      allMaterials.forEach((m) => m.dispose());
    },
  };
}
