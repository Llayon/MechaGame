import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'lk1',
  code: 'ЛК-1',
  title: 'ЛК-1 «Луч»',
  subtitle: 'МАЛЫЙ НАРУЧНЫЙ ИМПУЛЬСНЫЙ ЛАЗЕР • СЛОТ AUX • ЦИКЛ 4.4 С',
  description: 'Малый наручный импульсный лазер: фланец УСП, корпус с термоплиткой и радиаторами, криоконтур, фокусирующий объектив с 4-лепестковой бронешторкой. Цикл 4.4 с: открытие шторок → накачка резонатора → импульсный выстрел → охлаждение → закрытие.',
  specs: [
    ['Тип', 'Импульсный лазер'],
    ['Слот', 'AUX'],
    ['Цикл', '4.4 с'],
    ['Длина модуля', '1.55 м'],
    ['Шторка', '4 лепестка, 118°'],
    ['Маркировка', 'ЛК-1 / лазерная опасность'],
  ],
  maxExtension: 4.4,
  unit: 's',
  tipOffset: 1.05,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'emitterBody', label: '2. Оптический корпус' },
    { key: 'lensAssembly', label: '3. Объектив и шторка' },
  ],
  cameras: {
    module: { pos: [1.45, 0.42, 1.55], target: [0, -0.18, 0.28] },
  },
  rangeMarkers: [],
  controls: 'laser',
};

const LASER_CYCLE = 4.4;

const sstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Создаёт процедурную текстуру жёлто-чёрной полосы опасности с лёгким индустриальным износом.
 */
function createHazardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d89b14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#191b1e';
  const stripeWidth = 48;
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += stripeWidth * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeWidth, 0);
    ctx.lineTo(x + stripeWidth - canvas.height, canvas.height);
    ctx.lineTo(x - canvas.height, canvas.height);
    ctx.closePath();
    ctx.fill();
  }

  // Металлические потёртости и рамка
  ctx.strokeStyle = 'rgba(20, 22, 25, 0.85)';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  for (let i = 0; i < 180; i++) {
    const rx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const ry = (Math.sin(i * 78.233) * 29413.123) % 1;
    const x = Math.abs(rx) * canvas.width;
    const y = Math.abs(ry) * canvas.height;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(44, 48, 53, 0.25)' : 'rgba(235, 220, 180, 0.16)';
    ctx.fillRect(x, y, 6 + (i % 10), 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Создаёт процедурную текстуру сетки космической термозащитной плитки.
 */
function createThermalTileTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#cfd4d8';
  ctx.fillRect(0, 0, 512, 512);

  const cols = 4;
  const rows = 8;
  const cellW = 512 / cols;
  const cellH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const shade = ((r * 7 + c * 13) % 5) - 2;
      const v = 207 + shade * 2;
      ctx.fillStyle = `rgb(${v}, ${v + 5}, ${v + 9})`;
      ctx.fillRect(c * cellW + 2, r * cellH + 2, cellW - 4, cellH - 4);
    }
  }

  // Тёмные межплиточные термошвы
  ctx.strokeStyle = '#7e858c';
  ctx.lineWidth = 3;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cellW, 0);
    ctx.lineTo(c * cellW, 512);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * cellH);
    ctx.lineTo(512, r * cellH);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 8;
  return texture;
}

/**
 * Создаёт процедурную трафаретную маркировку «ЛК-1 / ОПАСНО: ЛАЗЕРНОЕ ИЗЛУЧЕНИЕ».
 */
function createStencilTexture(mirror = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');

  // Фон в цвет термоплитки корпуса
  ctx.fillStyle = '#cfd4d8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Лёгкая фактура плитки на панели
  ctx.strokeStyle = 'rgba(110, 118, 126, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  ctx.beginPath();
  ctx.moveTo(512, 10);
  ctx.lineTo(512, canvas.height - 10);
  ctx.stroke();

  const drawContent = () => {
    // Предупреждающий знак лазерной опасности (ГОСТ)
    const tx = 135;
    const ty = 192;
    const size = 96;

    ctx.fillStyle = '#e0a214';
    ctx.beginPath();
    ctx.moveTo(tx, ty - size);
    ctx.lineTo(tx + size * 0.92, ty + size * 0.72);
    ctx.lineTo(tx - size * 0.92, ty + size * 0.72);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#1b1d20';
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Звезда и луч внутри треугольника
    const cx = tx - 8;
    const cy = ty + 20;
    ctx.fillStyle = '#1b1d20';
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1b1d20';
    ctx.lineWidth = 4;
    for (let a = 0; a < 12; a++) {
      const ang = (a * Math.PI) / 6;
      const len = a % 2 === 0 ? 28 : 18;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
      ctx.stroke();
    }
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx + 46, cy);
    ctx.stroke();

    // Трафаретный индекс изделия
    ctx.fillStyle = '#1e2125';
    ctx.font = '900 74px "Arial Black", Impact, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('ЛК-1 «ЛУЧ»', 265, 56);

    // Плашка опасности
    ctx.fillStyle = '#1e2125';
    ctx.fillRect(265, 148, 705, 58);
    ctx.fillStyle = '#e0a214';
    ctx.font = 'bold 34px "Arial Narrow", Arial, sans-serif';
    ctx.fillText('ОПАСНО: ЛАЗЕРНОЕ ИЗЛУЧЕНИЕ', 282, 159);

    // Технический трафарет УСП / криогеника
    ctx.fillStyle = '#2d3136';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('УЗЕЛ AUX • ОПТИКА КЛ.4 • КРИОКОНТУР 77К', 265, 232);
    ctx.fillText('ИНД. 14Ф-82 / СЕР. № 019-УСП', 265, 272);

    // Регистрационные засечки
    ctx.fillStyle = '#8b261d';
    ctx.fillRect(265, 316, 140, 12);
    ctx.fillStyle = '#1e2125';
    ctx.fillRect(420, 316, 60, 12);
  };

  if (mirror) {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    drawContent();
    ctx.restore();
  } else {
    drawContent();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Создаёт карту рельефа гофрированного металлорукава.
 */
function createCorrugatedBumpTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, '#222222');
  grad.addColorStop(0.25, '#dcdcdc');
  grad.addColorStop(0.5, '#ffffff');
  grad.addColorStop(0.75, '#dcdcdc');
  grad.addColorStop(1.0, '#222222');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(54, 1);
  return texture;
}

/**
 * Создаёт процедурную 3D-модель малого наручного импульсного лазера ЛК-1 «Луч» (слот AUX).
 * Система координат: +Z — ось излучения, +Y — верх, +X — бок. (0,0,0) — центр верхнего фланца УСП.
 * Общая длина: 1.55 м (z от -0.50 до +1.05).
 *
 * @returns {THREE.Group}
 */
export function createWeaponLK1Luch() {
  const root = new THREE.Group();
  root.name = 'LK1_Luch_Weapon';

  // --- ОБЩИЕ PBR-МАТЕРИАЛЫ ---
  const tileTex = createThermalTileTexture();
  const whiteTileMat = new THREE.MeshStandardMaterial({
    color: 0xcfd4d8,
    map: tileTex,
    bumpMap: tileTex,
    bumpScale: 0.0018,
    metalness: 0.25,
    roughness: 0.55,
  });

  const graphiteMat = new THREE.MeshStandardMaterial({
    color: 0x2c3035,
    metalness: 0.75,
    roughness: 0.40,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1d2024,
    metalness: 0.82,
    roughness: 0.34,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xb8c0c8,
    metalness: 0.90,
    roughness: 0.22,
  });

  const brassFittingMat = new THREE.MeshStandardMaterial({
    color: 0x9c8244,
    metalness: 0.85,
    roughness: 0.32,
  });

  const matteBaffleMat = new THREE.MeshStandardMaterial({
    color: 0x111316,
    metalness: 0.20,
    roughness: 0.88,
  });

  const hazardMat = new THREE.MeshStandardMaterial({
    map: createHazardTexture(),
    metalness: 0.35,
    roughness: 0.48,
  });

  const stencilRightMat = new THREE.MeshStandardMaterial({
    map: createStencilTexture(false),
    metalness: 0.25,
    roughness: 0.52,
  });

  const stencilLeftMat = new THREE.MeshStandardMaterial({
    map: createStencilTexture(false),
    metalness: 0.25,
    roughness: 0.52,
  });

  const hoseBump = createCorrugatedBumpTexture();
  const hoseMat = new THREE.MeshStandardMaterial({
    color: 0x454b52,
    bumpMap: hoseBump,
    bumpScale: 0.004,
    metalness: 0.82,
    roughness: 0.36,
  });

  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x1b4d5c,
    metalness: 0.15,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.95,
    transparent: true,
    opacity: 0.90,
    emissive: 0x1b4d5c,
    emissiveIntensity: 0.15,
  });

  // Коллектор трансформов для единого InstancedMesh заклёпок и винтов
  const fastenerMatrices = [];
  const dummy = new THREE.Object3D();

  const addFastener = (x, y, z, rx = 0, ry = 0, rz = 0, scale = 1.0) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    fastenerMatrices.push(dummy.matrix.clone());
  };

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange) — центр в (0, 0, 0)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Основная стальная плита УСП: 0.34 x 0.10 x 0.55 м в (0, 0, 0)
  const flangePlateGeo = new THREE.BoxGeometry(0.34, 0.10, 0.55);
  const flangePlate = new THREE.Mesh(flangePlateGeo, graphiteMat);
  flangePlate.position.set(0, 0, 0);
  flangePlate.castShadow = true;
  flangePlate.receiveShadow = true;
  mountFlange.add(flangePlate);

  // Верхние направляющие «ласточкин хвост» стыковочного интерфейса УСП
  const railGeo = new THREE.BoxGeometry(0.045, 0.014, 0.51);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeo, darkSteelMat);
    rail.position.set(side * 0.105, 0.056, 0);
    rail.castShadow = true;
    mountFlange.add(rail);
  }

  // Центральный стыковочный разъём телеметрии и питания
  const connectorHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.016, 0.16),
    darkSteelMat
  );
  connectorHousing.position.set(0, 0.056, 0);
  mountFlange.add(connectorHousing);

  // Полосы опасности по боковым граням плиты УСП
  const hazardStripGeo = new THREE.BoxGeometry(0.004, 0.042, 0.52);
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(hazardStripGeo, hazardMat);
    strip.position.set(side * 0.171, 0.012, 0);
    mountFlange.add(strip);
  }

  // Поперечные полосы опасности спереди и сзади фланца
  const hazardFrontBackGeo = new THREE.BoxGeometry(0.31, 0.036, 0.004);
  for (const end of [-1, 1]) {
    const strip = new THREE.Mesh(hazardFrontBackGeo, hazardMat);
    strip.position.set(0, 0.012, end * 0.276);
    mountFlange.add(strip);
  }

  // 4 гидрозамка по углам стыковочной плиты УСП
  const lockPositions = [
    [-0.145, 0.215],
    [0.145, 0.215],
    [-0.145, -0.215],
    [0.145, -0.215],
  ];

  const lockBodyGeo = new THREE.CylinderGeometry(0.024, 0.028, 0.075, 12);
  const lockPinGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.095, 12);
  lockPinGeo.rotateZ(Math.PI / 2);
  const lockCollarGeo = new THREE.CylinderGeometry(0.030, 0.030, 0.018, 12);

  for (const [lx, lz] of lockPositions) {
    const lockGroup = new THREE.Group();
    lockGroup.position.set(lx, 0.008, lz);

    const body = new THREE.Mesh(lockBodyGeo, darkSteelMat);
    body.castShadow = true;
    lockGroup.add(body);

    const piston = new THREE.Mesh(lockPinGeo, chromeMat);
    piston.position.y = 0.012;
    lockGroup.add(piston);

    const collar = new THREE.Mesh(lockCollarGeo, brassFittingMat);
    collar.position.y = 0.028;
    lockGroup.add(collar);

    mountFlange.add(lockGroup);
  }

  // Крепёжные болты плиты УСП
  for (let z = -0.24; z <= 0.24; z += 0.08) {
    addFastener(-0.15, 0.051, z, 0, 0, 0, 1.1);
    addFastener(0.15, 0.051, z, 0, 0, 0, 1.1);
  }

  // =========================================================================
  // 2. ОПТИЧЕСКИЙ КОРПУС И РАДИАТОРЫ (emitterBody)
  //    Оптическая ось проходит вдоль +Z на высоте y = -0.22 м
  //    Длина корпуса: от z = -0.50 до z = +0.85 (1.35 м)
  // =========================================================================
  const OPTICAL_Y = -0.22;

  const emitterBody = new THREE.Group();
  emitterBody.name = 'emitterBody';
  root.add(emitterBody);

  // Силовой пилон-переходник от фланца УСП (y = -0.05) к корпусу (y = -0.075)
  const neckAdapter = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.04, 0.50),
    darkSteelMat
  );
  neckAdapter.position.set(0, -0.06, 0);
  neckAdapter.castShadow = true;
  emitterBody.add(neckAdapter);

  // Вспомогательная функция создания скошенного восьмиугольного профиля корпуса
  const createChamferedHullGeometry = (width, height, chamfer, depth) => {
    const hw = width / 2;
    const hh = height / 2;
    const c = chamfer;
    const shape = new THREE.Shape();
    shape.moveTo(-hw + c, -hh);
    shape.lineTo(hw - c, -hh);
    shape.lineTo(hw, -hh + c);
    shape.lineTo(hw, hh - c);
    shape.lineTo(hw - c, hh);
    shape.lineTo(-hw + c, hh);
    shape.lineTo(-hw, hh - c);
    shape.lineTo(-hw, -hh + c);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
    });
    return geo;
  };

  // Внутренний силовой каркас из тёмного графита (z от -0.47 до +0.85)
  const coreChassisGeo = createChamferedHullGeometry(0.32, 0.27, 0.045, 1.31);
  const coreChassis = new THREE.Mesh(coreChassisGeo, graphiteMat);
  coreChassis.position.set(0, OPTICAL_Y, -0.47);
  coreChassis.castShadow = true;
  coreChassis.receiveShadow = true;
  emitterBody.add(coreChassis);

  // Силовые шпангоуты (рёбра жёсткости) из тёмного графита
  const bulkheadZPositions = [-0.47, -0.22, 0.14, 0.52, 0.83];
  const bulkheadGeo = createChamferedHullGeometry(0.356, 0.306, 0.052, 0.024);
  for (const bz of bulkheadZPositions) {
    const bulkhead = new THREE.Mesh(bulkheadGeo, darkSteelMat);
    bulkhead.position.set(0, OPTICAL_Y, bz);
    bulkhead.castShadow = true;
    emitterBody.add(bulkhead);
  }

  // Сегментированные бронепанели из белой космической термоплитки
  const armorSections = [
    { zStart: -0.44, length: 0.21, w: 0.348, h: 0.296 },
    { zStart: -0.19, length: 0.32, w: 0.348, h: 0.296 },
    { zStart: 0.17, length: 0.34, w: 0.348, h: 0.296 },
    { zStart: 0.55, length: 0.27, w: 0.342, h: 0.290 },
  ];

  for (const sec of armorSections) {
    // Верхний термокожух
    const topArmor = new THREE.Mesh(
      new THREE.BoxGeometry(sec.w - 0.06, 0.032, sec.length),
      whiteTileMat
    );
    topArmor.position.set(0, OPTICAL_Y + sec.h / 2 - 0.008, sec.zStart + sec.length / 2);
    topArmor.castShadow = true;
    topArmor.receiveShadow = true;
    emitterBody.add(topArmor);

    // Нижний поддон термозащиты
    const bottomArmor = new THREE.Mesh(
      new THREE.BoxGeometry(sec.w - 0.07, 0.028, sec.length),
      whiteTileMat
    );
    bottomArmor.position.set(0, OPTICAL_Y - sec.h / 2 + 0.008, sec.zStart + sec.length / 2);
    bottomArmor.castShadow = true;
    bottomArmor.receiveShadow = true;
    emitterBody.add(bottomArmor);

    // Боковые верхние скуловые панели термоплитки
    for (const side of [-1, 1]) {
      const cheekPanel = new THREE.Mesh(
        new THREE.BoxGeometry(0.024, 0.088, sec.length),
        whiteTileMat
      );
      cheekPanel.position.set(
        side * (sec.w / 2 - 0.004),
        OPTICAL_Y + 0.072,
        sec.zStart + sec.length / 2
      );
      cheekPanel.castShadow = true;
      cheekPanel.receiveShadow = true;
      emitterBody.add(cheekPanel);

      // Заклёпки по углам боковых термоплиток
      const z1 = sec.zStart + 0.022;
      const z2 = sec.zStart + sec.length - 0.022;
      const yTop = OPTICAL_Y + 0.106;
      const yBot = OPTICAL_Y + 0.038;
      const xOut = side * (sec.w / 2 + 0.009);
      const rotZ = side > 0 ? -Math.PI / 2 : Math.PI / 2;

      addFastener(xOut, yTop, z1, 0, 0, rotZ, 0.85);
      addFastener(xOut, yTop, z2, 0, 0, rotZ, 0.85);
      addFastener(xOut, yBot, z1, 0, 0, rotZ, 0.85);
      addFastener(xOut, yBot, z2, 0, 0, rotZ, 0.85);
    }
  }

  // Трафаретные маркировочные щитки «ЛК-1 / ОПАСНО: ЛАЗЕРНОЕ ИЗЛУЧЕНИЕ» по обоим бортам
  const stencilGeo = new THREE.BoxGeometry(0.006, 0.082, 0.24);
  const stencilRight = new THREE.Mesh(stencilGeo, stencilRightMat);
  stencilRight.position.set(0.174, OPTICAL_Y + 0.072, 0.685);
  emitterBody.add(stencilRight);

  const stencilLeft = new THREE.Mesh(stencilGeo, stencilLeftMat);
  stencilLeft.position.set(-0.174, OPTICAL_Y + 0.072, 0.685);
  emitterBody.add(stencilLeft);

  // Ребристые радиаторные пластины по бокам через InstancedMesh
  const finCountPerSide = 34;
  const totalFins = finCountPerSide * 2;
  const finGeo = new THREE.BoxGeometry(0.026, 0.105, 0.005);
  const radiatorFinsInstanced = new THREE.InstancedMesh(finGeo, graphiteMat, totalFins);
  radiatorFinsInstanced.castShadow = true;
  radiatorFinsInstanced.receiveShadow = true;

  let finIdx = 0;
  const finStartZ = -0.17;
  const finSpacing = 0.0195;
  for (const side of [-1, 1]) {
    // Коллекторные шины радиатора (верхняя и нижняя)
    const manifoldGeo = new THREE.BoxGeometry(0.022, 0.012, finCountPerSide * finSpacing + 0.02);
    for (const vOff of [-0.056, 0.056]) {
      const manifold = new THREE.Mesh(manifoldGeo, darkSteelMat);
      manifold.position.set(
        side * 0.168,
        OPTICAL_Y - 0.038 + vOff,
        finStartZ + ((finCountPerSide - 1) * finSpacing) / 2
      );
      emitterBody.add(manifold);
    }

    for (let i = 0; i < finCountPerSide; i++) {
      dummy.position.set(
        side * 0.170,
        OPTICAL_Y - 0.038,
        finStartZ + i * finSpacing
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      radiatorFinsInstanced.setMatrixAt(finIdx++, dummy.matrix);
    }
  }
  radiatorFinsInstanced.instanceMatrix.needsUpdate = true;
  radiatorFinsInstanced.computeBoundingSphere();
  emitterBody.add(radiatorFinsInstanced);

  // Задний криогенно-конденсаторный блок (z от -0.50 до -0.22)
  const rearCap = new THREE.Mesh(
    createChamferedHullGeometry(0.31, 0.26, 0.045, 0.03),
    darkSteelMat
  );
  rearCap.position.set(0, OPTICAL_Y, -0.50);
  rearCap.castShadow = true;
  emitterBody.add(rearCap);

  // Волноводный тыльный штуцер на задней крышке
  const rearPort = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.068, 0.025, 16),
    graphiteMat
  );
  rearPort.rotation.x = Math.PI / 2;
  rearPort.position.set(0, OPTICAL_Y + 0.02, -0.505);
  emitterBody.add(rearPort);

  // Два горизонтальных криогенных баллона охлаждения в кормовой нише
  const cryoTankGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.24, 18);
  const cryoCapGeo = new THREE.SphereGeometry(0.042, 18, 12);
  for (const side of [-1, 1]) {
    const tankGroup = new THREE.Group();
    tankGroup.position.set(side * 0.105, OPTICAL_Y - 0.065, -0.35);

    const cyl = new THREE.Mesh(cryoTankGeo, chromeMat);
    cyl.rotation.x = Math.PI / 2;
    cyl.castShadow = true;
    tankGroup.add(cyl);

    const frontDome = new THREE.Mesh(cryoCapGeo, chromeMat);
    frontDome.position.z = 0.12;
    tankGroup.add(frontDome);

    const rearDome = new THREE.Mesh(cryoCapGeo, chromeMat);
    rearDome.position.z = -0.12;
    tankGroup.add(rearDome);

    // Запорный вентиль криоконтура
    const valve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.04, 12),
      brassFittingMat
    );
    valve.position.set(side * 0.02, 0.045, 0.06);
    tankGroup.add(valve);

    emitterBody.add(tankGroup);
  }

  // Гибкая гофра охлаждения (TubeGeometry) по левому и правому нижним бортам
  const fittingGeo = new THREE.CylinderGeometry(0.021, 0.021, 0.032, 12);
  for (const side of [-1, 1]) {
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.125, OPTICAL_Y - 0.095, -0.26),
      new THREE.Vector3(side * 0.158, OPTICAL_Y - 0.135, -0.12),
      new THREE.Vector3(side * 0.162, OPTICAL_Y - 0.145, 0.18),
      new THREE.Vector3(side * 0.156, OPTICAL_Y - 0.138, 0.50),
      new THREE.Vector3(side * 0.128, OPTICAL_Y - 0.092, 0.72),
    ]);

    const hoseGeo = new THREE.TubeGeometry(hoseCurve, 64, 0.015, 12, false);
    const hoseMesh = new THREE.Mesh(hoseGeo, hoseMat);
    hoseMesh.castShadow = true;
    emitterBody.add(hoseMesh);

    // Латунные обжимные муфты на концах гофры
    const startFitting = new THREE.Mesh(fittingGeo, brassFittingMat);
    startFitting.position.set(side * 0.125, OPTICAL_Y - 0.095, -0.26);
    startFitting.rotation.x = Math.PI / 3;
    emitterBody.add(startFitting);

    const endFitting = new THREE.Mesh(fittingGeo, brassFittingMat);
    endFitting.position.set(side * 0.128, OPTICAL_Y - 0.092, 0.72);
    endFitting.rotation.x = -Math.PI / 3;
    emitterBody.add(endFitting);
  }

  // =========================================================================
  // 3. ФОКУСИРУЮЩИЙ ОБЪЕКТИВ И ЗАЩИТНАЯ ШТОРКА (lensAssembly) в z = 0.85
  //    Включает sub-group shutterBlades для анимации открытия
  // =========================================================================
  const lensAssembly = new THREE.Group();
  lensAssembly.name = 'lensAssembly';
  lensAssembly.position.set(0, OPTICAL_Y, 0.85);
  root.add(lensAssembly);

  // Массивный фланец крепления объектива к корпусу (z локальный 0.00..0.03)
  const mountRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.158, 0.162, 0.032, 16),
    darkSteelMat
  );
  mountRing.rotation.x = Math.PI / 2;
  mountRing.position.z = 0.016;
  mountRing.castShadow = true;
  lensAssembly.add(mountRing);

  // Болты по окружности фланца объектива
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    addFastener(
      Math.cos(a) * 0.146,
      OPTICAL_Y + Math.sin(a) * 0.146,
      0.85 + 0.033,
      Math.PI / 2,
      0,
      0,
      1.0
    );
  }

  // Массивная металлическая бленда (z локальный 0.025..0.200 -> итог z = 1.05 м)
  const outerR = 0.156;
  const innerR = 0.136;
  const hoodDepth = 0.175;
  const hoodShape = new THREE.Shape();
  const segs = 16;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = Math.cos(a) * outerR;
    const y = Math.sin(a) * outerR;
    if (i === 0) hoodShape.moveTo(x, y);
    else hoodShape.lineTo(x, y);
  }
  const holePath = new THREE.Path();
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = Math.cos(a) * innerR;
    const y = Math.sin(a) * innerR;
    if (i === 0) holePath.moveTo(x, y);
    else holePath.lineTo(x, y);
  }
  hoodShape.holes.push(holePath);

  const hoodGeo = new THREE.ExtrudeGeometry(hoodShape, {
    depth: hoodDepth,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  const hoodMesh = new THREE.Mesh(hoodGeo, graphiteMat);
  hoodMesh.position.z = 0.025;
  hoodMesh.castShadow = true;
  hoodMesh.receiveShadow = true;
  lensAssembly.add(hoodMesh);

  // Верхний защитный козырёк бленды от солнечных бликов
  const visorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.016, 0.055),
    darkSteelMat
  );
  visorMesh.position.set(0, outerR - 0.004, 0.185);
  visorMesh.castShadow = true;
  lensAssembly.add(visorMesh);

  // Внутренние антибликовые диафрагмы (светоловушки)
  for (const bz of [0.042, 0.068]) {
    const baffleRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.124, 0.008, 8, 24),
      matteBaffleMat
    );
    baffleRing.position.z = bz;
    lensAssembly.add(baffleRing);
  }

  // Внутренний излучатель / вторичный коллиматор за линзой
  const emitterCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.065, 0.03, 20),
    darkSteelMat
  );
  emitterCore.rotation.x = Math.PI / 2;
  emitterCore.position.z = 0.025;
  lensAssembly.add(emitterCore);

  const emitterApertureGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.036, 24),
    new THREE.MeshBasicMaterial({ color: 0x163842 })
  );
  emitterApertureGlow.position.z = 0.041;
  lensAssembly.add(emitterApertureGlow);

  // Оправа фокусирующей линзы
  const lensCell = new THREE.Mesh(
    new THREE.TorusGeometry(0.112, 0.010, 12, 32),
    darkSteelMat
  );
  lensCell.position.z = 0.056;
  lensAssembly.add(lensCell);

  // Крупная выпуклая фокусирующая линза сине-зелёного просветления (LatheGeometry)
  const lensRadius = 0.108;
  const lensCurvature = 0.026;
  const lathePoints = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = t * lensRadius;
    const zProfile = Math.cos(t * (Math.PI / 2)) * lensCurvature;
    lathePoints.push(new THREE.Vector2(r, zProfile));
  }
  lathePoints.push(new THREE.Vector2(lensRadius, -0.008));
  lathePoints.push(new THREE.Vector2(0, -0.008));

  const lensGeo = new THREE.LatheGeometry(lathePoints, 36);
  // Поворачиваем ось LatheGeometry с +Y на +Z
  lensGeo.rotateX(Math.PI / 2);

  const mainLens = new THREE.Mesh(lensGeo, lensMat);
  mainLens.name = 'focusingLens';
  mainLens.position.z = 0.056;
  lensAssembly.add(mainLens);

  // -------------------------------------------------------------------------
  // Подвижные лепестки механической бронешторки (sub-group shutterBlades)
  // -------------------------------------------------------------------------
  const shutterBlades = new THREE.Group();
  shutterBlades.name = 'shutterBlades';
  shutterBlades.position.z = 0.092;
  lensAssembly.add(shutterBlades);

  const bladeRadius = 0.132;
  const bladeThick = 0.009;

  // Геометрия клиновидного лепестка: основание в x = 0 (ось шарнира), вершина в x = -bladeRadius (центр)
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, -bladeRadius);
  bladeShape.lineTo(0, bladeRadius);
  bladeShape.lineTo(-bladeRadius + 0.001, 0.001);
  bladeShape.lineTo(-bladeRadius + 0.001, -0.001);
  bladeShape.closePath();

  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: bladeThick,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.0015,
    bevelSegments: 1,
  });

  const hingePinGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.09, 10);
  const ribGeo = new THREE.BoxGeometry(0.085, 0.012, 0.005);

  const bladeHinges = [];

  for (let i = 0; i < 4; i++) {
    // Поворотная база лепестка в плоскости XY под углом 0, 90, 180, 270 град
    const radialSlot = new THREE.Group();
    radialSlot.rotation.z = (i * Math.PI) / 2;
    shutterBlades.add(radialSlot);

    // Шарнирный узел на внешнем радиусе бленды
    const hingeGroup = new THREE.Group();
    hingeGroup.name = `shutterBlade_${i}`;
    hingeGroup.position.set(bladeRadius, 0, 0);
    radialSlot.add(hingeGroup);

    const bladeMesh = new THREE.Mesh(bladeGeo, graphiteMat);
    bladeMesh.castShadow = true;
    bladeMesh.receiveShadow = true;
    hingeGroup.add(bladeMesh);

    // Силовое ребро жёсткости на внешней грани лепестка
    const spineRib = new THREE.Mesh(ribGeo, darkSteelMat);
    spineRib.position.set(-0.052, 0, bladeThick + 0.003);
    hingeGroup.add(spineRib);

    // Шарнирный валик петли
    const hingePin = new THREE.Mesh(hingePinGeo, chromeMat);
    hingePin.position.set(-0.002, 0, bladeThick / 2);
    hingeGroup.add(hingePin);

    bladeHinges.push(hingeGroup);
  }

  // =========================================================================
  // 4. ФИНАЛИЗАЦИЯ INSTANCEDMESH ДЛЯ ВСЕХ ЗАКЛЁПОК И ВИНТОВ
  // =========================================================================
  const rivetGeo = new THREE.CylinderGeometry(0.0042, 0.0048, 0.004, 6);
  const rivetsInstanced = new THREE.InstancedMesh(
    rivetGeo,
    chromeMat,
    fastenerMatrices.length
  );
  for (let i = 0; i < fastenerMatrices.length; i++) {
    rivetsInstanced.setMatrixAt(i, fastenerMatrices[i]);
  }
  rivetsInstanced.instanceMatrix.needsUpdate = true;
  rivetsInstanced.computeBoundingSphere();
  root.add(rivetsInstanced);

  // Метод управления состоянием бронешторок (0 = закрыто, 1 = полностью открыто) и накачкой линзы
  root.userData.setShutterOpen = (openFactor) => {
    const clamped = THREE.MathUtils.clamp(openFactor, 0, 1);
    // При повороте вокруг локальной оси +Y лепестки уходят вперёд внутрь бленды, открывая линзу
    const angle = clamped * 1.42;
    for (let i = 0; i < bladeHinges.length; i++) {
      bladeHinges[i].rotation.y = angle;
    }
  };

  root.userData.setPulseCharge = (intensity) => {
    lensMat.emissiveIntensity = 0.15 + intensity * 2.4;
    emitterApertureGlow.material.color.setRGB(
      0.08 + intensity * 0.45,
      0.22 + intensity * 0.72,
      0.26 + intensity * 0.74
    );
  };

  return root;
}

// =========================================================================
// Адаптер под единый просмотрщик: цикл 4.4 с — шторки → накачка → импульс.
// applyLaser(t): поза шторок, накал линзы, луч, вспышка. Возвращает { open, charge, pulse }.
// =========================================================================
export function createWeapon() {
  const root = createWeaponLK1Luch();
  const ud = root.userData;

  const beamGeo = new THREE.CylinderGeometry(0.014, 0.022, 4.5, 12, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, 2.25);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x9be8ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0, -0.22, 0.92);
  root.add(beam);

  const flashLight = new THREE.PointLight(0x7cd8f5, 0, 3.5, 2);
  flashLight.position.set(0, -0.22, 1.08);
  root.add(flashLight);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  const sstep = (e0, e1, x) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  ud.applyLaser = (t) => {
    let open = 0;
    if (t >= 0.8 && t < 2.9) open = sstep(0.8, 1.55, t);
    else if (t >= 2.9 && t < 3.7) open = 1 - sstep(2.9, 3.65, t);

    let charge = 0;
    if (t >= 1.55 && t < 2.0) charge = sstep(1.55, 2.0, t) * 0.45;
    else if (t >= 2.0 && t < 2.25) charge = 1 - sstep(2.05, 2.25, t);

    let pulse = 0;
    if (t >= 2.0 && t < 2.18) pulse = Math.sin(((t - 2.0) / 0.18) * Math.PI);

    ud.setShutterOpen(open);
    ud.setPulseCharge(charge + pulse * 0.8);
    root.position.z = -pulse * 0.012;
    beamMat.opacity = pulse * 0.85;
    flashLight.intensity = pulse * 6.0;
    return { open, charge, pulse };
  };
  ud.setExtension = (t) => {
    const info = ud.applyLaser(Math.max(0, Math.min(LASER_CYCLE, t)));
    return info;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
