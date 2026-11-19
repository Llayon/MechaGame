import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'k51m',
  code: '9К51М',
  title: '9К51М «Град-П»',
  subtitle: 'ПАКЕТ РСЗО 122-ММ • 16 НАПРАВЛЯЮЩИХ • СЛОТ MAIN',
  description: 'Пакет РСЗО 122 мм: фланец УСП с полосой опасности, бронированный короб-обойма 0.95×0.85×2.2 м с рёбрами и рымами, матрица 4×4 направляющих труб со снарядами, противокумулятивная решётка, газоотводные жалюзи и кабельный щиток поджига. Залп 16 снарядов за 2.08 с, перезарядка 1.35 с.',
  specs: [
    ['Калибр', '122 мм, 16 труб'],
    ['Темп залпа', '1 / 0.13 с'],
    ['Цикл', '3.43 с'],
    ['Слот', 'MAIN'],
    ['Порядок', 'Шахматный, 16 стволов'],
    ['Короб', '0.95×0.85×2.2 м'],
  ],
  maxExtension: 3.43,
  unit: 's',
  tipOffset: 1.07,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'launcherBox', label: '2. Бронекороб-обойма' },
    { key: 'tubesMatrix', label: '3. Матрица труб и снаряды' },
  ],
  cameras: {
    module: { pos: [2.35, 1.55, 2.75], target: [0, 0.55, 0.15] },
  },
  rangeMarkers: [],
  controls: 'mlrs',
};

const MLRS_ORDER = [0, 15, 3, 12, 5, 10, 6, 9, 1, 14, 2, 13, 4, 11, 7, 8];
const MLRS_INTERVAL = 0.13;
const MLRS_COOL = 1.35;
const MLRS_CYCLE = 16 * MLRS_INTERVAL + MLRS_COOL; // 3.43 с

/**
 * Процедурная генерация текстуры потёртой советской защитной краски (хаки #4b5346)
 */
function createKhakiArmorTextures() {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  // Базовый оттенок #4b5346 (RGB: 75, 83, 70)
  cCtx.fillStyle = '#4b5346';
  cCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = 'rgb(166, 166, 166)'; // ~0.65 roughness
  rCtx.fillRect(0, 0, size, size);

  // Детерминированный ГПСЧ для стабильного результата
  let seed = 95104;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Пятна выгорания краски, копоти и масла
  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 6 + rand() * 38;
    const dark = rand() > 0.45;
    cCtx.fillStyle = dark ? 'rgba(42, 47, 39, 0.08)' : 'rgba(102, 110, 94, 0.07)';
    cCtx.beginPath();
    cCtx.arc(x, y, r, 0, Math.PI * 2);
    cCtx.fill();

    rCtx.fillStyle = dark ? 'rgba(205, 205, 205, 0.09)' : 'rgba(120, 120, 120, 0.09)';
    rCtx.beginPath();
    rCtx.arc(x, y, r, 0, Math.PI * 2);
    rCtx.fill();
  }

  // Металлические царапины и потёртости до грунта/стали
  for (let i = 0; i < 260; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 4 + rand() * 26;
    const angle = rand() * Math.PI * 2;
    cCtx.strokeStyle = rand() > 0.3 ? 'rgba(115, 120, 114, 0.32)' : 'rgba(34, 37, 33, 0.35)';
    cCtx.lineWidth = 0.7 + rand() * 1.4;
    cCtx.beginPath();
    cCtx.moveTo(x, y);
    cCtx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    cCtx.stroke();

    rCtx.strokeStyle = 'rgba(95, 95, 95, 0.45)';
    rCtx.lineWidth = 1.2;
    rCtx.beginPath();
    rCtx.moveTo(x, y);
    rCtx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    rCtx.stroke();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);

  return { map, roughnessMap };
}

/**
 * Текстура жёлто-чёрной предупреждающей разметки для плиты УСП
 */
function createHazardStripeTexture() {
  const width = 512;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d89b0c';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#181a1c';
  const stripeW = 32;
  for (let x = -height; x < width + height; x += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x, height);
    ctx.lineTo(x + height, 0);
    ctx.lineTo(x + height + stripeW, 0);
    ctx.lineTo(x + stripeW, height);
    ctx.closePath();
    ctx.fill();
  }

  // Тёмная металлическая окантовка и сколы краски
  ctx.strokeStyle = '#25282c';
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, width, height);

  let seed = 4412;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = 'rgba(45, 48, 52, 0.55)';
    ctx.fillRect(rand() * width, rand() * height, 2 + rand() * 8, 1 + rand() * 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Текстура бортовой трафаретной маркировки «9К51М» и знаков огневой опасности
 */
function createSideStencilTexture(mirror = false) {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);

  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  // Белый/светло-серый тактический трафарет индекса «9К51М»
  ctx.save();
  ctx.fillStyle = 'rgba(232, 230, 218, 0.88)';
  ctx.font = '900 108px "Arial Black", Impact, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('9К51М', 54, 58);

  // Трафаретные перемычки поверх шрифта
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  [92, 168, 244, 322, 412].forEach((sx) => {
    ctx.fillRect(sx, 50, 5, 130);
  });
  ctx.restore();

  // Технические надписи ниже индекса
  ctx.fillStyle = 'rgba(225, 223, 210, 0.82)';
  ctx.font = 'bold 26px "Courier New", monospace';
  ctx.fillText('ПАКЕТ 16 НАПР. 122-ММ', 58, 184);
  ctx.fillText('УСП-М  СЛОТ: ОСНОВНОЙ', 58, 220);

  // Тактическая полоса
  ctx.fillStyle = 'rgba(218, 162, 22, 0.85)';
  ctx.fillRect(58, 266, 390, 10);

  // Жёлтый треугольный знак огневой / реактивной опасности
  const triX = 630;
  const triY = 74;
  const triSize = 185;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(triX + triSize / 2, triY);
  ctx.lineTo(triX + triSize, triY + triSize * 0.88);
  ctx.lineTo(triX, triY + triSize * 0.88);
  ctx.closePath();
  ctx.fillStyle = '#e2a308';
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#16181a';
  ctx.stroke();

  // Символ пламени внутри треугольника
  ctx.fillStyle = '#16181a';
  ctx.beginPath();
  ctx.moveTo(triX + triSize * 0.5, triY + triSize * 0.28);
  ctx.bezierCurveTo(
    triX + triSize * 0.68, triY + triSize * 0.48,
    triX + triSize * 0.65, triY + triSize * 0.72,
    triX + triSize * 0.5, triY + triSize * 0.76
  );
  ctx.bezierCurveTo(
    triX + triSize * 0.35, triY + triSize * 0.72,
    triX + triSize * 0.32, triY + triSize * 0.48,
    triX + triSize * 0.5, triY + triSize * 0.28
  );
  ctx.fill();

  // Табличка «ОГНЕОПАСНО» под знаком
  ctx.fillStyle = '#e2a308';
  ctx.fillRect(triX - 18, triY + triSize * 0.93, triSize + 36, 44);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#16181a';
  ctx.strokeRect(triX - 18, triY + triSize * 0.93, triSize + 36, 44);

  ctx.fillStyle = '#16181a';
  ctx.font = '900 24px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ОГНЕОПАСНО', triX + triSize / 2, triY + triSize * 0.93 + 31);
  ctx.restore();

  // Потёртости трафарета
  ctx.globalCompositeOperation = 'destination-out';
  let seed = 8821;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 320; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.25 + rand() * 0.55})`;
    ctx.fillRect(rand() * width, rand() * height, 2 + rand() * 14, 1 + rand() * 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Процедурная текстура радиальной вспышки пламени для emissive-дисков
 */
function createMuzzleFlashTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 4, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 255, 240, 1.0)');
  grad.addColorStop(0.28, 'rgba(255, 210, 90, 0.95)');
  grad.addColorStop(0.62, 'rgba(255, 95, 15, 0.65)');
  grad.addColorStop(1.0, 'rgba(255, 40, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Радиальные лучи пороховых газов
  ctx.save();
  ctx.translate(half, half);
  for (let i = 0; i < 16; i++) {
    ctx.rotate((Math.PI * 2) / 16);
    const rayGrad = ctx.createLinearGradient(0, 0, half * 0.95, 0);
    rayGrad.addColorStop(0, 'rgba(255, 245, 200, 0.85)');
    rayGrad.addColorStop(1, 'rgba(255, 110, 20, 0.0)');
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(half * (0.72 + (i % 3) * 0.1), 0);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Создаёт процедурную 3D-модель плечевого/наручного пакета РСЗО 9К51М «Град-П» (слот MAIN).
 * Система координат: +Z вперёд (направление стрельбы), +Y вверх, +X вправо.
 * Точка привязки (0, 0, 0) — центр нижней опорной плоскости стыковочного узла УСП.
 *
 * @returns {THREE.Group} Корневая группа модели с userData.muzzleFlashes для анимации залпа
 */
export function createWeapon9K51MGradP() {
  const root = new THREE.Group();
  root.name = 'Weapon_9K51M_GradP';

  // --- PBR МАТЕРИАЛЫ ---
  const khakiTex = createKhakiArmorTextures();
  const matKhakiArmor = new THREE.MeshStandardMaterial({
    color: 0x4b5346,
    map: khakiTex.map,
    roughnessMap: khakiTex.roughnessMap,
    metalness: 0.45,
    roughness: 0.65,
  });

  const matDarkSteel = new THREE.MeshStandardMaterial({
    color: 0x24272b,
    metalness: 0.85,
    roughness: 0.45,
  });

  const matCastIron = new THREE.MeshStandardMaterial({
    color: 0x3c4045,
    metalness: 0.70,
    roughness: 0.40,
  });

  const matLockSteel = new THREE.MeshStandardMaterial({
    color: 0x565c63,
    metalness: 0.82,
    roughness: 0.35,
  });

  const matCableRubber = new THREE.MeshStandardMaterial({
    color: 0x1a1c1e,
    metalness: 0.15,
    roughness: 0.80,
  });

  const matBrass = new THREE.MeshStandardMaterial({
    color: 0xa68238,
    metalness: 0.85,
    roughness: 0.32,
  });

  const hazardTex = createHazardStripeTexture();
  const matHazardStripe = new THREE.MeshStandardMaterial({
    map: hazardTex,
    metalness: 0.40,
    roughness: 0.55,
  });

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange): 0.65 x 0.14 x 0.95 м, центр низа (0,0,0)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  const flangeW = 0.65;
  const flangeH = 0.14;
  const flangeL = 0.95;

  // Нижняя опорная подошва и верхняя плита УСП
  const basePlate = new THREE.Mesh(
    new THREE.BoxGeometry(flangeW, 0.04, flangeL),
    matDarkSteel
  );
  basePlate.position.set(0, 0.02, 0);
  basePlate.castShadow = true;
  basePlate.receiveShadow = true;
  mountFlange.add(basePlate);

  const coreBlock = new THREE.Mesh(
    new THREE.BoxGeometry(flangeW - 0.04, 0.06, flangeL - 0.04),
    matKhakiArmor
  );
  coreBlock.position.set(0, 0.07, 0);
  coreBlock.castShadow = true;
  coreBlock.receiveShadow = true;
  mountFlange.add(coreBlock);

  const topPlate = new THREE.Mesh(
    new THREE.BoxGeometry(flangeW, 0.04, flangeL),
    matDarkSteel
  );
  topPlate.position.set(0, flangeH - 0.02, 0);
  topPlate.castShadow = true;
  topPlate.receiveShadow = true;
  mountFlange.add(topPlate);

  // Боковые и торцевые полосы жёлто-чёрной разметки УСП
  const sideStripeGeo = new THREE.PlaneGeometry(flangeL - 0.06, 0.056);
  [-1, 1].forEach((dir) => {
    const sideStripe = new THREE.Mesh(sideStripeGeo, matHazardStripe);
    sideStripe.position.set(dir * (flangeW / 2 - 0.018), 0.07, 0);
    sideStripe.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    mountFlange.add(sideStripe);
  });

  const frontStripeGeo = new THREE.PlaneGeometry(flangeW - 0.06, 0.056);
  [-1, 1].forEach((dir) => {
    const endStripe = new THREE.Mesh(frontStripeGeo, matHazardStripe);
    endStripe.position.set(0, 0.07, dir * (flangeL / 2 - 0.018));
    if (dir < 0) endStripe.rotation.y = Math.PI;
    mountFlange.add(endStripe);
  });

  // 4 силовых замка УСП по углам плиты
  const lockPositions = [
    [-0.27, -0.38],
    [0.27, -0.38],
    [-0.27, 0.38],
    [0.27, 0.38],
  ];
  const lockHousingGeo = new THREE.BoxGeometry(0.11, 0.11, 0.14);
  const lockPinGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.16, 16);
  lockPinGeo.rotateZ(Math.PI / 2);
  const lockLeverGeo = new THREE.BoxGeometry(0.025, 0.08, 0.03);

  lockPositions.forEach(([lx, lz]) => {
    const lockGroup = new THREE.Group();
    lockGroup.position.set(lx, 0.07, lz);

    const housing = new THREE.Mesh(lockHousingGeo, matLockSteel);
    housing.castShadow = true;
    lockGroup.add(housing);

    const pin = new THREE.Mesh(lockPinGeo, matBrass);
    pin.position.x = Math.sign(lx) * 0.02;
    lockGroup.add(pin);

    const lever = new THREE.Mesh(lockLeverGeo, matDarkSteel);
    lever.position.set(Math.sign(lx) * 0.065, 0.02, 0);
    lever.rotation.z = Math.sign(lx) * -0.25;
    lockGroup.add(lever);

    mountFlange.add(lockGroup);
  });

  // Силовые косынки перехода от УСП к бронекоробу
  const gussetGeo = new THREE.BoxGeometry(0.03, 0.06, 0.12);
  [-0.22, 0.22].forEach((gx) => {
    [-0.3, 0, 0.3].forEach((gz) => {
      const gusset = new THREE.Mesh(gussetGeo, matKhakiArmor);
      gusset.position.set(gx, flangeH + 0.01, gz);
      mountFlange.add(gusset);
    });
  });

  // =========================================================================
  // 2. БРОНИРОВАННЫЙ КОРОБ-ОБОЙМА (launcherBox): ~0.95 x 0.85 x 2.2 м
  // =========================================================================
  const launcherBox = new THREE.Group();
  launcherBox.name = 'launcherBox';
  root.add(launcherBox);

  const boxW = 0.95;
  const boxH = 0.85;
  const boxL = 2.20;
  const wallT = 0.042;
  const boxCenterY = flangeH + boxH / 2; // 0.14 + 0.425 = 0.565 м

  // Внешние бронеплиты (верх, низ, левый и правый борта) — образуют полый бронекожух
  const topArmor = new THREE.Mesh(
    new THREE.BoxGeometry(boxW, wallT, boxL),
    matKhakiArmor
  );
  topArmor.position.set(0, flangeH + boxH - wallT / 2, 0);
  topArmor.castShadow = true;
  topArmor.receiveShadow = true;
  launcherBox.add(topArmor);

  const bottomArmor = new THREE.Mesh(
    new THREE.BoxGeometry(boxW, wallT, boxL),
    matKhakiArmor
  );
  bottomArmor.position.set(0, flangeH + wallT / 2, 0);
  bottomArmor.castShadow = true;
  bottomArmor.receiveShadow = true;
  launcherBox.add(bottomArmor);

  const sideArmorGeo = new THREE.BoxGeometry(wallT, boxH - wallT * 2, boxL);
  [-1, 1].forEach((dir) => {
    const sideArmor = new THREE.Mesh(sideArmorGeo, matKhakiArmor);
    sideArmor.position.set(dir * (boxW / 2 - wallT / 2), boxCenterY, 0);
    sideArmor.castShadow = true;
    sideArmor.receiveShadow = true;
    launcherBox.add(sideArmor);
  });

  // Передняя и задняя внутренние переборки (опорные плиты для 16 труб)
  const bulkheadGeo = new THREE.BoxGeometry(
    boxW - wallT * 1.6,
    boxH - wallT * 1.6,
    0.04
  );
  const frontBulkhead = new THREE.Mesh(bulkheadGeo, matDarkSteel);
  frontBulkhead.position.set(0, boxCenterY, boxL / 2 - 0.04);
  frontBulkhead.receiveShadow = true;
  launcherBox.add(frontBulkhead);

  const rearBulkhead = new THREE.Mesh(bulkheadGeo, matDarkSteel);
  rearBulkhead.position.set(0, boxCenterY, -boxL / 2 + 0.14);
  launcherBox.add(rearBulkhead);

  // Угловые сварные накладки (фаски) по продольным рёбрам бронекороба
  const cornerStripGeo = new THREE.BoxGeometry(0.036, 0.036, boxL + 0.006);
  [
    [-boxW / 2 + 0.012, flangeH + boxH - 0.012],
    [boxW / 2 - 0.012, flangeH + boxH - 0.012],
    [-boxW / 2 + 0.012, flangeH + 0.012],
    [boxW / 2 - 0.012, flangeH + 0.012],
  ].forEach(([cx, cy]) => {
    const strip = new THREE.Mesh(cornerStripGeo, matKhakiArmor);
    strip.position.set(cx, cy, 0);
    strip.rotation.z = Math.PI / 4;
    strip.castShadow = true;
    launcherBox.add(strip);
  });

  // Продольные рёбра жёсткости на бортах и крыше
  const sideRibGeo = new THREE.BoxGeometry(0.024, 0.032, boxL - 0.16);
  [-1, 1].forEach((dir) => {
    [-0.24, 0, 0.24].forEach((dy) => {
      const rib = new THREE.Mesh(sideRibGeo, matKhakiArmor);
      rib.position.set(dir * (boxW / 2 + 0.01), boxCenterY + dy, 0);
      rib.castShadow = true;
      rib.receiveShadow = true;
      launcherBox.add(rib);
    });
  });

  const topRibGeo = new THREE.BoxGeometry(0.034, 0.024, boxL - 0.18);
  [-0.28, 0, 0.28].forEach((dx) => {
    const topRib = new THREE.Mesh(topRibGeo, matKhakiArmor);
    topRib.position.set(dx, flangeH + boxH + 0.01, 0);
    topRib.castShadow = true;
    launcherBox.add(topRib);
  });

  // 4 такелажные рым-проушины на крыше
  const lugGeo = new THREE.TorusGeometry(0.026, 0.008, 8, 16, Math.PI);
  [
    [-0.36, -0.78],
    [0.36, -0.78],
    [-0.36, 0.78],
    [0.36, 0.78],
  ].forEach(([lx, lz]) => {
    const lug = new THREE.Mesh(lugGeo, matDarkSteel);
    lug.position.set(lx, flangeH + boxH + 0.005, lz);
    lug.rotation.y = Math.PI / 2;
    launcherBox.add(lug);
  });

  // Защитный бронекозырёк сверху над передним срезом (+Z)
  const visorGroup = new THREE.Group();
  visorGroup.position.set(0, flangeH + boxH, boxL / 2);

  const visorPlate = new THREE.Mesh(
    new THREE.BoxGeometry(boxW + 0.02, 0.028, 0.22),
    matKhakiArmor
  );
  visorPlate.position.set(0, -0.022, 0.09);
  visorPlate.rotation.x = 0.22;
  visorPlate.castShadow = true;
  visorGroup.add(visorPlate);

  const visorCheekGeo = new THREE.BoxGeometry(0.024, 0.11, 0.18);
  [-1, 1].forEach((dir) => {
    const cheek = new THREE.Mesh(visorCheekGeo, matKhakiArmor);
    cheek.position.set(dir * (boxW / 2 - 0.004), -0.055, 0.075);
    cheek.castShadow = true;
    visorGroup.add(cheek);
  });
  launcherBox.add(visorGroup);

  // Боковой распределительный щиток с кабелями поджига (+X борт, кормовая часть)
  const junctionGroup = new THREE.Group();
  junctionGroup.position.set(boxW / 2 + 0.036, boxCenterY - 0.02, -0.56);

  const jBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.072, 0.34, 0.42),
    matKhakiArmor
  );
  jBox.castShadow = true;
  jBox.receiveShadow = true;
  junctionGroup.add(jBox);

  const jLid = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.30, 0.38),
    matDarkSteel
  );
  jLid.position.set(0.038, 0, 0);
  junctionGroup.add(jLid);

  // Разъёмы и 4 кабеля поджига, уходящие в казённую часть пакета
  const connGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.035, 12);
  for (let i = 0; i < 4; i++) {
    const cz = -0.12 + i * 0.08;
    const connector = new THREE.Mesh(connGeo, matBrass);
    connector.position.set(0.015, -0.18, cz);
    junctionGroup.add(connector);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.015, -0.19, cz),
      new THREE.Vector3(0.025, -0.27 - i * 0.012, cz - 0.06),
      new THREE.Vector3(0.015, -0.29 - i * 0.01, -0.28),
      new THREE.Vector3(-0.04, -0.22 - i * 0.015, -0.38),
    ]);
    const cableGeo = new THREE.TubeGeometry(curve, 20, 0.0085, 8, false);
    const cable = new THREE.Mesh(cableGeo, matCableRubber);
    cable.castShadow = true;
    junctionGroup.add(cable);
  }
  launcherBox.add(junctionGroup);

  // Откидные газоотводные жалюзи сзади (-Z)
  const exhaustGroup = new THREE.Group();
  exhaustGroup.position.set(0, boxCenterY, -boxL / 2);

  // Рама кормового газоотводного короба
  const frameBarTop = new THREE.Mesh(
    new THREE.BoxGeometry(boxW - 0.04, 0.045, 0.09),
    matDarkSteel
  );
  frameBarTop.position.set(0, boxH / 2 - 0.04, -0.035);
  exhaustGroup.add(frameBarTop);

  const frameBarBot = frameBarTop.clone();
  frameBarBot.position.set(0, -boxH / 2 + 0.04, -0.035);
  exhaustGroup.add(frameBarBot);

  const frameSideGeo = new THREE.BoxGeometry(0.045, boxH - 0.08, 0.09);
  [-1, 1].forEach((dir) => {
    const fSide = new THREE.Mesh(frameSideGeo, matDarkSteel);
    fSide.position.set(dir * (boxW / 2 - 0.04), 0, -0.035);
    exhaustGroup.add(fSide);
  });

  // Верхние петли откидной решётки жалюзи
  const hingeGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.08, 12);
  hingeGeo.rotateZ(Math.PI / 2);
  [-0.32, 0, 0.32].forEach((hx) => {
    const hinge = new THREE.Mesh(hingeGeo, matLockSteel);
    hinge.position.set(hx, boxH / 2 - 0.025, -0.08);
    exhaustGroup.add(hinge);
  });

  // 7 наклонных бронестворок газоотводных жалюзи
  const louverCount = 7;
  const louverGeo = new THREE.BoxGeometry(boxW - 0.12, 0.014, 0.095);
  for (let i = 0; i < louverCount; i++) {
    const ly = -0.28 + (i / (louverCount - 1)) * 0.56;
    const louver = new THREE.Mesh(louverGeo, matDarkSteel);
    louver.position.set(0, ly, -0.04);
    louver.rotation.x = 0.48; // Наклон вниз для отвода реактивной струи
    louver.castShadow = true;
    exhaustGroup.add(louver);
  }
  launcherBox.add(exhaustGroup);

  // Бортовые трафареты «9К51М» и знаки огневой опасности
  const decalRightMat = new THREE.MeshStandardMaterial({
    map: createSideStencilTexture(false),
    transparent: true,
    roughness: 0.72,
    metalness: 0.25,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const decalLeftMat = new THREE.MeshStandardMaterial({
    map: createSideStencilTexture(false),
    transparent: true,
    roughness: 0.72,
    metalness: 0.25,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  const decalGeo = new THREE.PlaneGeometry(1.12, 0.56);
  const decalRight = new THREE.Mesh(decalGeo, decalRightMat);
  decalRight.position.set(boxW / 2 + 0.023, boxCenterY + 0.02, 0.34);
  decalRight.rotation.y = Math.PI / 2;
  launcherBox.add(decalRight);

  const decalLeft = new THREE.Mesh(decalGeo, decalLeftMat);
  decalLeft.position.set(-boxW / 2 - 0.023, boxCenterY + 0.02, -0.15);
  decalLeft.rotation.y = -Math.PI / 2;
  launcherBox.add(decalLeft);

  // =========================================================================
  // 3. МАТРИЦА 16 НАПРАВЛЯЮЩИХ ТРУБ (tubesMatrix): 4x4 InstancedMesh + Снаряды
  // =========================================================================
  const tubesMatrix = new THREE.Group();
  tubesMatrix.name = 'tubesMatrix';
  root.add(tubesMatrix);

  const cols = 4;
  const rows = 4;
  const tubeCount = cols * rows;
  const pitchX = 0.195;
  const pitchY = 0.175;
  const tubeOuterR = 0.083;
  const tubeInnerR = 0.064;
  const tubeLen = 2.08;

  // Профиль толстостенной направляющей трубы (LatheGeometry вдоль +Z)
  const tubeProfile = [
    new THREE.Vector2(tubeInnerR, -tubeLen / 2),
    new THREE.Vector2(tubeOuterR, -tubeLen / 2),
    new THREE.Vector2(tubeOuterR, tubeLen / 2 - 0.18),
    new THREE.Vector2(tubeOuterR + 0.005, tubeLen / 2 - 0.16), // Дульное утолщение
    new THREE.Vector2(tubeOuterR + 0.005, tubeLen / 2 - 0.02),
    new THREE.Vector2(tubeOuterR, tubeLen / 2),
    new THREE.Vector2(tubeInnerR, tubeLen / 2),
    new THREE.Vector2(tubeInnerR, -tubeLen / 2),
  ];
  const tubeGeo = new THREE.LatheGeometry(tubeProfile, 28);
  tubeGeo.rotateX(Math.PI / 2); // Ориентируем ось цилиндра вдоль +Z

  const instancedTubes = new THREE.InstancedMesh(tubeGeo, matDarkSteel, tubeCount);
  instancedTubes.castShadow = true;
  instancedTubes.receiveShadow = true;
  tubesMatrix.add(instancedTubes);

  // Оживальные головные обтекатели реактивных снарядов (чугун #3c4045) внутри труб
  const warheadR = 0.059;
  const warheadProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(warheadR, 0.0),
    new THREE.Vector2(warheadR, 0.14),
    new THREE.Vector2(warheadR * 0.84, 0.23),
    new THREE.Vector2(warheadR * 0.54, 0.30),
    new THREE.Vector2(0.014, 0.35),
    new THREE.Vector2(0.014, 0.38), // Взрыватель МРВ-У
    new THREE.Vector2(0.0, 0.385),
  ];
  const warheadGeo = new THREE.LatheGeometry(warheadProfile, 20);
  warheadGeo.rotateX(Math.PI / 2);

  const instancedWarheads = new THREE.InstancedMesh(
    warheadGeo,
    matCastIron,
    tubeCount
  );
  tubesMatrix.add(instancedWarheads);

  // Заглушки казённой части внутри труб (чтобы трубы не просвечивали насквозь)
  const breechPlugGeo = new THREE.CircleGeometry(tubeInnerR, 16);
  const instancedPlugs = new THREE.InstancedMesh(
    breechPlugGeo,
    matDarkSteel,
    tubeCount
  );
  tubesMatrix.add(instancedPlugs);

  // Эмиссивные диски дульных вспышек для 16 труб
  const flashTex = createMuzzleFlashTexture();
  const flashGeo = new THREE.CircleGeometry(0.115, 24);
  const muzzleFlashes = [];
  const muzzlePositions = [];

  const dummy = new THREE.Object3D();
  const tubeCenterZ = 0.03; // Срез дула на z = 0.03 + 1.04 = +1.07 м (чуть выступает из плиты)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      // Нумерация сверху вниз, слева направо
      const x = (c - (cols - 1) / 2) * pitchX;
      const y = boxCenterY + ((rows - 1) / 2 - r) * pitchY;

      // Позиция направляющей трубы
      dummy.position.set(x, y, tubeCenterZ);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      instancedTubes.setMatrixAt(idx, dummy.matrix);

      // Позиция головной части снаряда внутри трубы (носик на z ≈ +0.94 м)
      dummy.position.set(x, y, 0.56);
      dummy.updateMatrix();
      instancedWarheads.setMatrixAt(idx, dummy.matrix);

      // Позиция внутренней заглушки на z = +0.55 м
      dummy.position.set(x, y, 0.55);
      dummy.updateMatrix();
      instancedPlugs.setMatrixAt(idx, dummy.matrix);

      // Эмиссивный диск вспышки у дульного среза
      const flashMat = new THREE.MeshStandardMaterial({
        color: 0xffaa33,
        map: flashTex,
        emissive: new THREE.Color(0xff6b00),
        emissiveMap: flashTex,
        emissiveIntensity: 0.0,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const flashDisc = new THREE.Mesh(flashGeo, flashMat);
      const muzzleZ = tubeCenterZ + tubeLen / 2 + 0.012;
      flashDisc.position.set(x, y, muzzleZ);
      flashDisc.visible = false;
      tubesMatrix.add(flashDisc);

      muzzleFlashes.push(flashDisc);
      muzzlePositions.push(new THREE.Vector3(x, y, muzzleZ));
    }
  }

  instancedTubes.instanceMatrix.needsUpdate = true;
  instancedWarheads.instanceMatrix.needsUpdate = true;
  instancedPlugs.instanceMatrix.needsUpdate = true;

  // Съёмная противокумулятивная решётчатая рамка по переднему контуру (+Z)
  const slatFrameGroup = new THREE.Group();
  slatFrameGroup.name = 'antiCumulativeSlatFrame';
  // Шарнирная ось по левому краю (-X) переднего среза
  slatFrameGroup.position.set(-boxW / 2 + 0.01, boxCenterY, boxL / 2 + 0.075);

  const grateW = boxW - 0.02;
  const grateH = boxH - 0.02;

  // Внешняя силовая рамка противокумулятивного экрана
  const gTop = new THREE.Mesh(
    new THREE.BoxGeometry(grateW, 0.024, 0.042),
    matDarkSteel
  );
  gTop.position.set(grateW / 2, grateH / 2 - 0.012, 0);
  gTop.castShadow = true;
  slatFrameGroup.add(gTop);

  const gBot = gTop.clone();
  gBot.position.set(grateW / 2, -grateH / 2 + 0.012, 0);
  slatFrameGroup.add(gBot);

  const gLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.024, grateH, 0.042),
    matDarkSteel
  );
  gLeft.position.set(0.012, 0, 0);
  gLeft.castShadow = true;
  slatFrameGroup.add(gLeft);

  const gRight = gLeft.clone();
  gRight.position.set(grateW - 0.012, 0, 0);
  slatFrameGroup.add(gRight);

  // Горизонтальные и вертикальные противокумулятивные ламели (пластины)
  const hSlatGeo = new THREE.BoxGeometry(grateW - 0.03, 0.007, 0.038);
  for (let i = -2; i <= 2; i++) {
    const sy = i * (pitchY * 0.86);
    const hSlat = new THREE.Mesh(hSlatGeo, matDarkSteel);
    hSlat.position.set(grateW / 2, sy, 0);
    hSlat.castShadow = true;
    slatFrameGroup.add(hSlat);
  }

  const vSlatGeo = new THREE.BoxGeometry(0.007, grateH - 0.03, 0.038);
  for (let i = -2; i <= 2; i++) {
    const sx = grateW / 2 + i * (pitchX * 0.86);
    const vSlat = new THREE.Mesh(vSlatGeo, matDarkSteel);
    vSlat.position.set(sx, 0, 0);
    vSlat.castShadow = true;
    slatFrameGroup.add(vSlat);
  }

  // Петли крепления слева и быстросъёмные чеки-замки справа
  [-0.24, 0.24].forEach((hy) => {
    const hingePin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.07, 10),
      matLockSteel
    );
    hingePin.position.set(0, hy, -0.025);
    slatFrameGroup.add(hingePin);

    const latchPin = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.03, 0.07),
      matBrass
    );
    latchPin.position.set(grateW, hy, -0.03);
    slatFrameGroup.add(latchPin);
  });

  // Лёгкий рабочий угол откидывания (4°), подчёркивающий съёмную конструкцию
  slatFrameGroup.rotation.y = -0.07;
  tubesMatrix.add(slatFrameGroup);

  // Сохраняем данные для анимации залповой стрельбы
  root.userData.muzzleFlashes = muzzleFlashes;
  root.userData.muzzlePositions = muzzlePositions;

  return root;
}

// ===========================================================================
// Адаптер под единый просмотрщик: залп 16 снарядов шахматным порядком.
// applyMlrs(t): абсолютное время цикла — вспышки, отдача, свет.
// Возвращает { fired, flash } для телеметрии.
// =========================================================================
export function createWeapon() {
  const root = createWeapon9K51MGradP();
  const ud = root.userData;
  const flashes = ud.muzzleFlashes;
  const positions = ud.muzzlePositions;

  const muzzleLight = new THREE.PointLight(0xff7b1a, 0, 4.5, 1.6);
  root.add(muzzleLight);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  const order = MLRS_ORDER;
  const interval = MLRS_INTERVAL;

  ud.applyMlrs = (t) => {
    let fired = 0;
    let maxLife = 0;
    let lastPos = null;
    for (let k = 0; k < order.length; k++) {
      const tubeIdx = order[k];
      const tFire = k * interval;
      const disc = flashes[tubeIdx];
      if (t < tFire) {
        disc.visible = false;
        disc.material.opacity = 0;
        disc.material.emissiveIntensity = 0;
      } else {
        fired++;
        const life = Math.max(0, 1 - (t - tFire) * 6.8);
        maxLife = Math.max(maxLife, life);
        lastPos = positions[tubeIdx];
        if (life > 0.01) {
          disc.visible = true;
          disc.material.opacity = life;
          disc.material.emissiveIntensity = life * 9.5;
          const scale = 0.75 + (1.0 - life) * 0.65;
          disc.scale.set(scale, scale, 1);
          disc.rotation.z = t * 14.0 + tubeIdx;
        } else {
          disc.visible = false;
        }
      }
    }
    // Лёгкий импульс отдачи пакета по -Z, затухающий после последнего выстрела
    const lastFire = (order.length - 1) * interval;
    const recoil = t < lastFire
      ? -0.022
      : -0.022 * Math.exp(-18 * Math.min(2, t - lastFire));
    root.position.z = recoil;
    if (lastPos && maxLife > 0.01) {
      muzzleLight.position.copy(lastPos).add(new THREE.Vector3(0, 0, 0.18));
      muzzleLight.intensity = 6.5 * maxLife;
    } else {
      muzzleLight.intensity = 0;
    }
    return { fired, flash: maxLife };
  };

  ud.setExtension = (t) => {
    const info = ud.applyMlrs(Math.max(0, Math.min(MLRS_CYCLE, t)));
    return info;
  };
  ud.setFlash = (k) => {
    muzzleLight.intensity = 6.5 * Math.max(0, Math.min(1, k));
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
