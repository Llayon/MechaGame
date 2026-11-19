import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const meta = {
  id: 'klk4',
  code: 'КЛК-4',
  title: 'КЛК-4 «Спектр»',
  subtitle: 'СПАРЕННЫЙ БОЕВОЙ ЛАЗЕРНЫЙ КОМПЛЕКС • СЛОТ MAIN • НЕПРЕРЫВНАЯ НАКАЧКА',
  description: 'Спаренный боевой лазерный комплекс: фланец УСП с гидроприводами наклона, бронированная оптическая гондола с двумя каналами (силовой сине-бирюзовый + наведение рубиновый), криогенные баллоны азота, защитные бугели. Непрерывная накачка резонаторов с пульсацией готовности.',
  specs: [
    ['Каналы', '2 (силовой + наведение)'],
    ['Охлаждение', 'N2-крио + радиаторы'],
    ['Слот', 'MAIN'],
    ['Габариты', '~1.5×1.0×2.6 м'],
    ['Маркировка', 'КЛК-4 / лазерная опасность'],
  ],
  maxExtension: 1.0,
  unit: '%',
  tipOffset: 1.65,
  subgroups: [
    { key: 'mountFlange', label: '1. Усиленный фланец УСП' },
    { key: 'opticalPod', label: '2. Оптическая гондола' },
    { key: 'cryoTanksGroup', label: '3. Криогенные баллоны' },
  ],
  cameras: {
    module: { pos: [2.35, 0.95, 2.55], target: [0.05, -0.42, 0.18] },
  },
  rangeMarkers: [],
  controls: 'beam',
};

/**
 * Создаёт процедурные карты микрорельефа и шероховатости (копоть, царапины, заклёпки)
 * для основного индустриального грунта бронекорпуса.
 */
function createArmorSurfaceMaps() {
  const size = 512;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  // Базовый нейтральный тон
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#e6e6e6';
  rCtx.fillRect(0, 0, size, size);

  // Лёгкая зернистость порошкового грунта и копоть
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 2.2 + 0.5;
    const shade = Math.floor(118 + Math.random() * 24);
    bCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
    bCtx.fillRect(x, y, r, r);

    const rShade = Math.floor(205 + Math.random() * 50);
    rCtx.fillStyle = `rgba(${rShade},${rShade},${rShade},0.35)`;
    rCtx.beginPath();
    rCtx.arc(x, y, r * 2.5, 0, Math.PI * 2);
    rCtx.fill();
  }

  // Технологические швы и линии расшивки бронелистов
  bCtx.strokeStyle = '#4a4a4a';
  bCtx.lineWidth = 2;
  bCtx.strokeRect(12, 12, size - 24, size - 24);
  bCtx.beginPath();
  bCtx.moveTo(0, size * 0.5);
  bCtx.lineTo(size, size * 0.5);
  bCtx.moveTo(size * 0.5, 0);
  bCtx.lineTo(size * 0.5, size);
  bCtx.stroke();

  // Заклёпки вдоль швов
  bCtx.fillStyle = '#b8b8b8';
  for (let i = 28; i < size - 20; i += 32) {
    [22, size - 22, size * 0.5 - 10, size * 0.5 + 10].forEach((pos) => {
      bCtx.beginPath();
      bCtx.arc(i, pos, 2.2, 0, Math.PI * 2);
      bCtx.fill();
    });
  }

  // Тонкие эксплуатационные потёртости
  rCtx.strokeStyle = 'rgba(130, 130, 130, 0.45)';
  for (let i = 0; i < 65; i++) {
    rCtx.lineWidth = Math.random() * 1.5 + 0.4;
    const x1 = Math.random() * size;
    const y1 = Math.random() * size;
    rCtx.beginPath();
    rCtx.moveTo(x1, y1);
    rCtx.lineTo(x1 + (Math.random() - 0.5) * 45, y1 + (Math.random() - 0.5) * 18);
    rCtx.stroke();
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);

  return { bumpMap, roughnessMap };
}

/**
 * Создаёт CanvasTexture жёлто-чёрной предупреждающей разметки для плиты УСП.
 */
function createHazardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#e0a514';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1b1d1f';
  const stripeWidth = 32;
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += stripeWidth * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeWidth, 0);
    ctx.lineTo(x + stripeWidth - canvas.height, canvas.height);
    ctx.lineTo(x - canvas.height, canvas.height);
    ctx.closePath();
    ctx.fill();
  }

  // Лёгкие потёртости краски по краям
  ctx.fillStyle = 'rgba(80, 84, 88, 0.25)';
  for (let i = 0; i < 240; i++) {
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 4, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  return texture;
}

/**
 * Создаёт трафаретную маркировку «КЛК-4» в советско-российской военной эстетике.
 */
function createStencilDecalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Полупрозрачная тёмная подложка-рамка и тактические метки
  ctx.strokeStyle = 'rgba(235, 238, 240, 0.78)';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  // Предупреждающий знак лазерной опасности (треугольник слева)
  ctx.fillStyle = 'rgba(224, 165, 20, 0.9)';
  ctx.beginPath();
  ctx.moveTo(115, 75);
  ctx.lineTo(175, 180);
  ctx.lineTo(55, 180);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#181a1c';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Вспышка внутри знака
  ctx.fillStyle = '#181a1c';
  ctx.beginPath();
  ctx.arc(115, 146, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(113, 108, 4, 38);
  ctx.fillRect(92, 144, 46, 4);

  // Основной трафаретный индекс «КЛК-4»
  ctx.fillStyle = 'rgba(236, 240, 242, 0.88)';
  ctx.font = 'bold 124px "Courier New", Consolas, monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('КЛК-4', 215, 132);

  // Трафаретные перемычки (эффект прорезного трафарета)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,1)';
  [252, 326, 402, 476, 560].forEach((cutX) => {
    ctx.fillRect(cutX, 65, 5, 135);
  });
  ctx.globalCompositeOperation = 'source-over';

  // Подзаголовок и технический шифр
  ctx.fillStyle = 'rgba(225, 230, 234, 0.82)';
  ctx.font = 'bold 34px "Courier New", Consolas, monospace';
  ctx.fillText('КОМПЛЕКС ЛАЗЕРНЫЙ «СПЕКТР»', 60, 252);

  ctx.font = '24px "Courier New", Consolas, monospace';
  ctx.fillStyle = 'rgba(210, 215, 220, 0.72)';
  ctx.fillText('СЛОТ: ОСН // ОХЛ: N2-КРИО // ИЗД. 404-М', 60, 310);

  // Эффект лёгкого износа краски
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.55})`;
    ctx.fillRect(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      Math.random() * 6 + 1,
      Math.random() * 3 + 1
    );
  }
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Создаёт криогенную маркировку для баллонов жидкого азота.
 */
function createCryoTankDecalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Синяя опознавательная полоса криогенного газа
  ctx.fillStyle = 'rgba(26, 98, 168, 0.85)';
  ctx.fillRect(0, 38, canvas.width, 26);

  ctx.fillStyle = 'rgba(28, 32, 36, 0.85)';
  ctx.font = 'bold 36px "Courier New", Consolas, monospace';
  ctx.fillText('N2 ЖИДКИЙ', 36, 118);

  ctx.font = 'bold 22px "Courier New", Consolas, monospace';
  ctx.fillText('Р раб. 3.2 МПа', 36, 158);
  ctx.fillText('КРИО-КОНТУР', 36, 192);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/**
 * Вспомогательная функция создания трубчатого бугеля с крепёжными фланцами.
 */
function createProtectiveGuardBar(points, tubeRadius, frameMat, boltMat) {
  const guardGroup = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    'catmullrom',
    0.15
  );

  const tubeGeo = new THREE.TubeGeometry(curve, 36, tubeRadius, 12, false);
  const tubeMesh = new THREE.Mesh(tubeGeo, frameMat);
  tubeMesh.castShadow = true;
  tubeMesh.receiveShadow = true;
  guardGroup.add(tubeMesh);

  // Крепёжные пятки на концах бугеля
  const flangeGeo = new THREE.CylinderGeometry(tubeRadius * 2.1, tubeRadius * 2.3, 0.018, 12);
  const boltGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.024, 6);

  [points[0], points[points.length - 1]].forEach((pt, idx) => {
    const tangent = curve.getTangent(idx === 0 ? 0 : 1);
    const flange = new THREE.Mesh(flangeGeo, frameMat);
    flange.position.set(pt[0], pt[1], pt[2]);
    flange.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    flange.castShadow = true;
    guardGroup.add(flange);

    const bolt = new THREE.Mesh(boltGeo, boltMat);
    bolt.position.copy(flange.position);
    bolt.quaternion.copy(flange.quaternion);
    guardGroup.add(bolt);
  });

  return guardGroup;
}

/**
 * Процедурный генератор 3D-модели спаренного боевого лазерного комплекса КЛК-4 «Спектр».
 * Координатная система:
 *   +Z — направление оптических каналов (вперёд), общая длина ~2.9 м (z: -1.25 .. +1.65)
 *   +Y — верх; (0, 0, 0) — центр верхнего фланца плиты УСП
 *   +X — внешняя боковая грань (блок криогенных баллонов)
 *
 * @returns {THREE.Group}
 */
export function createWeaponKLK4Spektr() {
  const root = new THREE.Group();
  root.name = 'KLK4_Spektr';

  // === ОБЩИЕ PBR-МАТЕРИАЛЫ ===
  const { bumpMap, roughnessMap } = createArmorSurfaceMaps();

  // Основной корпус гондолы: светло-серый индустриальный грунт с лёгкой копотью
  const podArmorMat = new THREE.MeshStandardMaterial({
    color: 0x73797f,
    metalness: 0.45,
    roughness: 0.60,
    bumpMap,
    bumpScale: 0.004,
    roughnessMap,
  });

  // Тёмная оружейная сталь (шасси, радиаторы, замки УСП, бленды, хомуты)
  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x262a2e,
    metalness: 0.78,
    roughness: 0.42,
  });

  // Оцинкованный/шлифованный крепёж и силовые штоки
  const chromeSteelMat = new THREE.MeshStandardMaterial({
    color: 0x9aa2aa,
    metalness: 0.88,
    roughness: 0.28,
  });

  // Баллоны хладагента: матовый светло-серый/белый металл
  const cryoTankMat = new THREE.MeshStandardMaterial({
    color: 0xb8bfc6,
    metalness: 0.55,
    roughness: 0.45,
  });

  // Трубки коллектора: медь
  const copperMat = new THREE.MeshStandardMaterial({
    color: 0x9c6b3b,
    metalness: 0.85,
    roughness: 0.35,
  });

  // Оптические линзы (глубокое сине-бирюзовое и рубиновое стекло)
  const cyanLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x065c73,
    emissive: 0x004d66,
    emissiveIntensity: 0.45,
    metalness: 0.05,
    roughness: 0.08,
    ior: 1.54,
    reflectivity: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.84,
  });

  const rubyLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x7a0416,
    emissive: 0x5c0010,
    emissiveIntensity: 0.4,
    metalness: 0.05,
    roughness: 0.08,
    ior: 1.54,
    reflectivity: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.84,
  });

  // Светящиеся излучатели за линзами (для анимации готовности)
  const mainEmitterCoreMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00c8ff,
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.1,
  });

  const targetEmitterCoreMat = new THREE.MeshStandardMaterial({
    color: 0xff1744,
    emissive: 0xff1744,
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.1,
  });

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Массивная плита УСП: 0.75 x 0.18 x 1.05 м (нижняя грань строго на y = -0.09)
  const flangeW = 0.75;
  const flangeH = 0.18;
  const flangeL = 1.05;

  const basePlate = new THREE.Mesh(
    new THREE.BoxGeometry(flangeW, flangeH, flangeL),
    darkSteelMat
  );
  basePlate.position.set(0, -flangeH * 0.5 + 0.09, 0);
  basePlate.castShadow = true;
  basePlate.receiveShadow = true;
  mountFlange.add(basePlate);

  // Полосы Hazard маркировки
  const hazardMat = new THREE.MeshStandardMaterial({
    map: createHazardTexture(),
    metalness: 0.3,
    roughness: 0.55,
  });

  const sideHazardGeo = new THREE.BoxGeometry(0.012, 0.055, flangeL - 0.04);
  [-1, 1].forEach((side) => {
    const stripe = new THREE.Mesh(sideHazardGeo, hazardMat);
    stripe.position.set(side * (flangeW * 0.5 + 0.003), 0.0, 0);
    mountFlange.add(stripe);
  });

  const endHazardGeo = new THREE.BoxGeometry(flangeW - 0.04, 0.055, 0.012);
  [-1, 1].forEach((end) => {
    const stripe = new THREE.Mesh(endHazardGeo, hazardMat);
    stripe.position.set(0, 0.0, end * (flangeL * 0.5 + 0.003));
    mountFlange.add(stripe);
  });

  // =========================================================================
  // 2. БРОНИРОВАННАЯ ОПТИЧЕСКАЯ ГОНДОЛА (opticalPod)
  // =========================================================================
  const opticalPod = new THREE.Group();
  opticalPod.name = 'opticalPod';
  opticalPod.position.set(0, 0.10, 0.05);
  root.add(opticalPod);

  // Основной бронекожух гондолы
  const podBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.55, 1.85),
    podArmorMat
  );
  podBody.position.set(0, 0.32, 0);
  podBody.castShadow = true;
  podBody.receiveShadow = true;
  opticalPod.add(podBody);

  // Скошенные лобовые бронелисты переднего среза
  const noseWedge = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.42, 0.22),
    podArmorMat
  );
  noseWedge.position.set(0, 0.30, 1.00);
  noseWedge.rotation.x = 0.0;
  noseWedge.castShadow = true;
  opticalPod.add(noseWedge);

  // Защитная решётка радиатора на крыше
  const roofGrille = new THREE.Mesh(
    new THREE.BoxGeometry(0.40, 0.03, 1.40),
    darkSteelMat
  );
  roofGrille.position.set(0, 0.615, -0.05);
  opticalPod.add(roofGrille);

  for (let i = 0; i < 9; i++) {
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.022, 0.035),
      darkSteelMat
    );
    slat.position.set(0, 0.625, -0.62 + i * 0.145);
    opticalPod.add(slat);
  }

  // Трафарет «КЛК-4» (боковые декали)
  const stencilMat = new THREE.MeshStandardMaterial({
    map: createStencilDecalTexture(),
    transparent: true,
    roughness: 0.68,
    metalness: 0.15,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  const decalGeo = new THREE.PlaneGeometry(0.95, 0.34);
  [-1, 1].forEach((side) => {
    const decal = new THREE.Mesh(decalGeo, stencilMat);
    decal.position.set(side * 0.313, 0.33, 0.28);
    decal.rotation.y = side * Math.PI * 0.5;
    opticalPod.add(decal);
  });

  // =========================================================================
  // 3. ДВА ОПТИЧЕСКИХ КАНАЛА (emitterA + emitterB)
  // =========================================================================
  function buildEmitterChannel(name, xPos, lensMat, emitterCoreMat, isMain) {
    const ch = new THREE.Group();
    ch.name = name;
    ch.position.set(xPos, 0.30, 0.96);

    const barrelLen = isMain ? 0.62 : 0.5;
    const barrelR = isMain ? 0.115 : 0.082;

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(barrelR, barrelR * 1.04, barrelLen, 28),
      darkSteelMat
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = barrelLen / 2;
    barrel.castShadow = true;
    ch.add(barrel);

    // Оребрённый радиатор вокруг ствола излучателя
    for (let i = 0; i < 5; i++) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(barrelR + 0.004, 0.007, 8, 28),
        darkSteelMat
      );
      rib.position.z = 0.10 + i * 0.10;
      ch.add(rib);
    }

    // Передняя фокусирующая линза (выпуклая)
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(barrelR * 0.92, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.42),
      lensMat
    );
    lens.rotation.x = Math.PI / 2;
    lens.scale.set(1, 1, 0.42);
    lens.position.z = barrelLen - 0.01;
    ch.add(lens);

    // Светящийся сердечник излучателя за линзой
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(barrelR * 0.55, barrelR * 0.62, 0.03, 20),
      emitterCoreMat
    );
    core.rotation.x = Math.PI / 2;
    core.position.z = barrelLen - 0.10;
    ch.add(core);

    // Дульный срез-бленда
    const hood = new THREE.Mesh(
      new THREE.CylinderGeometry(barrelR + 0.012, barrelR + 0.006, 0.09, 28, 1, true),
      darkSteelMat
    );
    hood.material = darkSteelMat.clone();
    hood.material.side = THREE.DoubleSide;
    hood.rotation.x = Math.PI / 2;
    hood.position.z = barrelLen + 0.03;
    ch.add(hood);

    return ch;
  }

  const emitterA = buildEmitterChannel('emitterChannelA_main', -0.145, cyanLensMat, mainEmitterCoreMat, true);
  const emitterB = buildEmitterChannel('emitterChannelB_target', 0.145, rubyLensMat, targetEmitterCoreMat, false);
  opticalPod.add(emitterA);
  opticalPod.add(emitterB);

  // =========================================================================
  // 4. БЛОК КРИОГЕННЫХ БАЛЛОНОВ (cryoTanksGroup)
  // =========================================================================
  const cryoTanksGroup = new THREE.Group();
  cryoTanksGroup.name = 'cryoTanksGroup';
  cryoTanksGroup.position.set(0, 0.10, -0.55);
  root.add(cryoTanksGroup);

  const cryoDecalMat = new THREE.MeshStandardMaterial({
    map: createCryoTankDecalTexture(),
    transparent: true,
    roughness: 0.5,
    metalness: 0.2,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  [-0.16, 0.16].forEach((tx, idx) => {
    const tankG = new THREE.Group();
    tankG.name = `cryoTank_${idx + 1}`;
    tankG.position.set(tx, 0.02, 0);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.62, 24),
      cryoTankMat
    );
    body.castShadow = true;
    body.receiveShadow = true;
    tankG.add(body);

    [-0.31, 0.31].forEach((capY) => {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        cryoTankMat
      );
      cap.position.y = capY;
      if (capY < 0) cap.rotation.x = Math.PI;
      cap.castShadow = true;
      tankG.add(cap);
    });

    // Стяжные хомуты баллона
    [-0.2, 0.2].forEach((bandY) => {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.087, 0.008, 8, 24),
        darkSteelMat
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = bandY;
      tankG.add(band);
    });

    // Криогенная маркировка N2
    const tankLabel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0865, 0.0865, 0.20, 24, 1, true, -0.6, 1.9),
      cryoDecalMat
    );
    tankLabel.position.y = -0.02;
    tankG.add(tankLabel);

    // Запорный вентиль и медный отвод
    const valve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.05, 12),
      copperMat
    );
    valve.position.y = 0.42;
    tankG.add(valve);

    cryoTanksGroup.add(tankG);
  });

  // Верхний защитный бугель криоблока
  cryoTanksGroup.add(
    createProtectiveGuardBar(
      [
        [-0.16, -0.10, 0.33],
        [-0.16, 0.24, 0.30],
        [0.16, 0.24, 0.30],
        [0.16, -0.10, 0.33],
      ],
      0.012,
      darkSteelMat,
      chromeSteelMat
    )
  );

  // Метод плавной пульсации готовности оптических каналов
  // (хук для внешнего контроллера; реальная частота задаётся адаптером)
  root.userData.emitterMats = {
    main: mainEmitterCoreMat,
    cyan: cyanLensMat,
    target: targetEmitterCoreMat,
    ruby: rubyLensMat,
  };
  root.userData.update = (elapsedTime) => {
    const mainPulse = 0.5 + 0.5 * Math.sin(elapsedTime * 2.6);
    mainEmitterCoreMat.emissiveIntensity = 1.4 + mainPulse * 2.1;
    cyanLensMat.emissiveIntensity = 0.25 + mainPulse * 0.45;

    const targetPulse = 0.5 + 0.5 * Math.sin(elapsedTime * 5.2 + 0.8);
    targetEmitterCoreMat.emissiveIntensity = 1.1 + targetPulse * 1.4;
    rubyLensMat.emissiveIntensity = 0.2 + targetPulse * 0.35;
  };

  return root;
}

// =========================================================================
// Адаптер под единый просмотрщик: непрерывная накачка двух каналов.
// applyBeam(t): пульсация готовности с масштабом мощности. Возвращает { main, target }.
// =========================================================================
export function createWeapon() {
  const root = createWeaponKLK4Spektr();
  const ud = root.userData;
  const EM = ud.emitterMats;

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  ud.charge = 1;
  ud.applyBeam = (t) => {
    const s = ud.charge;
    const mainPulse = 0.5 + 0.5 * Math.sin(t * 2.6);
    EM.main.emissiveIntensity = s * (1.4 + mainPulse * 2.1);
    EM.cyan.emissiveIntensity = s * (0.25 + mainPulse * 0.45);
    const targetPulse = 0.5 + 0.5 * Math.sin(t * 5.2 + 0.8);
    EM.target.emissiveIntensity = s * (1.1 + targetPulse * 1.4);
    EM.ruby.emissiveIntensity = s * (0.2 + targetPulse * 0.35);
    return { main: mainPulse * s, target: targetPulse * s };
  };
  ud.setExtension = (v) => {
    ud.charge = Math.max(0, Math.min(1, v));
    return ud.charge;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
