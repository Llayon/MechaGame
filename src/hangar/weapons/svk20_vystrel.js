import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'svk20',
  code: 'СВК-20',
  title: 'СВК-20 «Выстрел»',
  subtitle: '20-ММ КРУПНОКАЛИБЕРНАЯ СНАЙПЕРСКАЯ ВИНТОВКА МЕХА • СЛОТ AUX',
  description: '20-мм крупнокалиберная снайперская винтовка меха: фланец УСП, фрезерованная ствольная коробка с боковым магазином на 5 патронов 20×138, перископический прицел с лазерным дальномером и метеодатчиком, откатной рифлёный ствол с трёхкамерным ДТК. Откат 350 мм, выстрел каждые 3 с.',
  specs: [
    ['Калибр', '20×138 мм'],
    ['Откат ствола', '350 мм'],
    ['Темп', 'Выстрел / 3.0 с'],
    ['Магазин', 'Коробчатый, 5 патр.'],
    ['Прицел', 'Перископ + ЛД'],
    ['Слот', 'AUX'],
  ],
  maxExtension: 0.35,
  unit: 'mm',
  tipOffset: 3.65,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'receiverAndOptics', label: '2. Коробка, магазин, оптика' },
    { key: 'sniperBarrelGroup', label: '3. Откатной ствол и ДТК' },
  ],
  cameras: {
    module: { pos: [2.9, 1.35, 3.3], target: [0, 0.24, 1.35] },
  },
  rangeMarkers: [],
  controls: 'volley',
  volley: {
    mode: 'single',
    shotPeriod: 3.0,
    recoilTime: 0.055,
    holdTime: 0,
    returnTime: 0.68,
    heatPerShot: 0.08,
    coolRate: 0.06,
    single: true,
  },
  drive: {
    title: 'Затвор и накат',
    caption: 'ОТКАТ СТВОЛА',
    fire: 'ВЫСТРЕЛ',
  },
};

const MAX_RECOIL = 0.35;
const RET_TIME = 0.055;
const RETURN_TIME = 0.68;

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

function createMilledMetalBumpTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#929292';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 2) {
    const shade = 122 + (y * 13 % 19);
    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
    ctx.fillRect(0, y, canvas.width, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

export function createWeaponSVK20Vystrel() {
  const weaponRoot = new THREE.Group();
  weaponRoot.name = 'SVK20_Vystrel_Main';

  const milledBumpMap = createMilledMetalBumpTexture();
  const hazardTexture = createHazardTexture();

  // Основные PBR-материалы по спецификации
  const matReceiver = new THREE.MeshStandardMaterial({
    name: 'ReceiverOliveSteel',
    color: 0x4a5248,
    metalness: 0.50,
    roughness: 0.60,
    bumpMap: milledBumpMap,
    bumpScale: 0.0015,
  });

  const matDarkSteel = new THREE.MeshStandardMaterial({
    name: 'DarkBluedSteel',
    color: 0x23262a,
    metalness: 0.88,
    roughness: 0.32,
    bumpMap: milledBumpMap,
    bumpScale: 0.001,
  });

  const matOpticLens = new THREE.MeshPhysicalMaterial({
    name: 'OpticRubyGreenLens',
    color: 0x1e463a,
    metalness: 0.35,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 1.0,
    emissive: 0x18090c,
    emissiveIntensity: 0.35,
  });

  // Вспомогательные индустриальные акцентные материалы
  const matHazard = new THREE.MeshStandardMaterial({
    map: hazardTexture,
    metalness: 0.45,
    roughness: 0.55,
  });

  const matLatchAccent = new THREE.MeshStandardMaterial({
    color: 0x8a2822,
    metalness: 0.40,
    roughness: 0.55,
  });

  const matBrass = new THREE.MeshStandardMaterial({
    color: 0xb58d3d,
    metalness: 0.85,
    roughness: 0.28,
  });

  const addMesh = (parent, geometry, material, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ УСП (mountFlange)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  weaponRoot.add(mountFlange);

  // Стальная плита УСП 0.50 x 0.14 x 0.90 м (верхняя плоскость строго на Y = 0)
  addMesh(mountFlange, new THREE.BoxGeometry(0.50, 0.14, 0.90), matDarkSteel, [0, -0.07, 0]);

  // Верхний центрирующий венец фланца в (0, 0, 0)
  addMesh(mountFlange, new THREE.BoxGeometry(0.42, 0.02, 0.78), matReceiver, [0, 0.01, 0]);

  // Предупреждающие полосы (CanvasTexture) вдоль левого, правого, переднего и заднего торцов
  addMesh(mountFlange, new THREE.BoxGeometry(0.006, 0.055, 0.84), matHazard, [0.251, -0.07, 0]);
  addMesh(mountFlange, new THREE.BoxGeometry(0.006, 0.055, 0.84), matHazard, [-0.251, -0.07, 0]);
  addMesh(mountFlange, new THREE.BoxGeometry(0.44, 0.055, 0.006), matHazard, [0, -0.07, 0.451]);
  addMesh(mountFlange, new THREE.BoxGeometry(0.44, 0.055, 0.006), matHazard, [0, -0.07, -0.451]);

  // Нижние рёбра жёсткости плиты УСП
  for (const zOff of [-0.30, 0, 0.30]) {
    addMesh(mountFlange, new THREE.BoxGeometry(0.44, 0.035, 0.08), matDarkSteel, [0, -0.155, zOff]);
  }

  // 4 силовых стыковочных замка по углам УСП
  const lockPositions = [
    [-0.245, -0.035, -0.33],
    [0.245, -0.035, -0.33],
    [-0.245, -0.035, 0.33],
    [0.245, -0.035, 0.33],
  ];

  lockPositions.forEach(([lx, ly, lz]) => {
    const lockGroup = new THREE.Group();
    lockGroup.position.set(lx, ly, lz);
    const sideSign = Math.sign(lx);

    // Корпус замка
    addMesh(lockGroup, new THREE.BoxGeometry(0.055, 0.085, 0.14), matDarkSteel, [sideSign * 0.015, 0, 0]);
    // Запорный эксцентриковый вал
    addMesh(
      lockGroup,
      new THREE.CylinderGeometry(0.022, 0.022, 0.16, 16),
      matReceiver,
      [sideSign * 0.032, 0.01, 0],
      [Math.PI / 2, 0, 0]
    );
    // Красный рычаг-фиксатор замка
    addMesh(
      lockGroup,
      new THREE.BoxGeometry(0.018, 0.065, 0.024),
      matLatchAccent,
      [sideSign * 0.048, -0.015, 0.045],
      [0.25, 0, -sideSign * 0.18]
    );

    mountFlange.add(lockGroup);
  });

  // =========================================================================
  // 2. СТВОЛЬНАЯ КОРОБКА, МАГАЗИН И ОПТИКА (receiverAndOptics)
  // =========================================================================
  const receiverAndOptics = new THREE.Group();
  receiverAndOptics.name = 'receiverAndOptics';
  weaponRoot.add(receiverAndOptics);

  const boreY = 0.25; // Ось канала ствола на высоте 0.25 м над УСП

  // Силовой лафет-основание между УСП и ствольной коробкой
  addMesh(receiverAndOptics, new THREE.BoxGeometry(0.30, 0.11, 0.72), matDarkSteel, [0, 0.075, 0.04]);
  // Боковые гидроамортизаторы лафета
  for (const sx of [-0.17, 0.17]) {
    addMesh(
      receiverAndOptics,
      new THREE.CylinderGeometry(0.026, 0.026, 0.56, 16),
      matDarkSteel,
      [sx, 0.08, 0.06],
      [Math.PI / 2, 0, 0]
    );
  }

  // Основной удлинённый фрезерованный бронекожух ствольной коробки (Z: -0.45 .. +0.85)
  addMesh(receiverAndOptics, new THREE.BoxGeometry(0.25, 0.26, 1.30), matReceiver, [0, boreY, 0.20]);
  // Верхняя скошенная грань бронекожуха
  addMesh(receiverAndOptics, new THREE.BoxGeometry(0.19, 0.045, 1.28), matReceiver, [0, boreY + 0.145, 0.20]);

  // Продольные долы жёсткости на левом и правом бортах бронекожуха
  for (const side of [-1, 1]) {
    for (const yOff of [-0.065, 0.0, 0.065]) {
      // Углублённый паз-дол
      addMesh(
        receiverAndOptics,
        new THREE.BoxGeometry(0.012, 0.024, 1.05),
        matDarkSteel,
        [side * 0.126, boreY + yOff, 0.20]
      );
      // Внутренняя фрезерованная вставка ребра
      addMesh(
        receiverAndOptics,
        new THREE.BoxGeometry(0.006, 0.012, 0.98),
        matReceiver,
        [side * 0.130, boreY + yOff, 0.20]
      );
    }
  }

  // Задний буферный узел отката и затыльник (Z: -0.75 .. -0.45 — задаёт общую длину ~4.40 м)
  addMesh(receiverAndOptics, new THREE.BoxGeometry(0.21, 0.23, 0.30), matDarkSteel, [0, boreY - 0.005, -0.60]);
  addMesh(
    receiverAndOptics,
    new THREE.CylinderGeometry(0.075, 0.085, 0.32, 20),
    matReceiver,
    [0, boreY + 0.01, -0.59],
    [Math.PI / 2, 0, 0]
  );
  // Задний демпферный диск (z = -0.75)
  addMesh(
    receiverAndOptics,
    new THREE.CylinderGeometry(0.09, 0.09, 0.03, 20),
    matDarkSteel,
    [0, boreY + 0.01, -0.745],
    [Math.PI / 2, 0, 0]
  );
  // Такелажные проушины сверху затыльника и цевья
  for (const zLug of [-0.52, 0.92]) {
    addMesh(receiverAndOptics, new THREE.BoxGeometry(0.03, 0.045, 0.08), matDarkSteel, [0, boreY + 0.175, zLug]);
  }

  // Передний вентилируемый кожух цевья (Z: +0.85 .. +1.52) — направляющая для отката ствола
  addMesh(receiverAndOptics, new THREE.BoxGeometry(0.21, 0.21, 0.67), matReceiver, [0, boreY, 1.185]);
  addMesh(
    receiverAndOptics,
    new THREE.CylinderGeometry(0.082, 0.082, 0.70, 24),
    matDarkSteel,
    [0, boreY, 1.19],
    [Math.PI / 2, 0, 0]
  );
  // Вентиляционные щели в кожухе цевья
  for (let i = 0; i < 4; i++) {
    const zSlot = 0.95 + i * 0.14;
    for (const side of [-1, 1]) {
      addMesh(
        receiverAndOptics,
        new THREE.BoxGeometry(0.014, 0.075, 0.085),
        matDarkSteel,
        [side * 0.106, boreY, zSlot]
      );
    }
  }

  // Массивный затворный узел (справа, +X)
  const boltAssembly = new THREE.Group();
  boltAssembly.name = 'boltAssembly';
  boltAssembly.position.set(0.135, boreY + 0.015, 0.12);
  receiverAndOptics.add(boltAssembly);

  // Окно выброса гильз и затворная рама
  addMesh(boltAssembly, new THREE.BoxGeometry(0.035, 0.095, 0.44), matDarkSteel, [0, 0, 0]);
  addMesh(
    boltAssembly,
    new THREE.CylinderGeometry(0.034, 0.034, 0.36, 18),
    matReceiver,
    [0.012, 0, -0.02],
    [Math.PI / 2, 0, 0]
  );
  // Массивная рукоять взведения затвора
  addMesh(boltAssembly, new THREE.BoxGeometry(0.085, 0.024, 0.032), matDarkSteel, [0.055, -0.01, -0.08], [0, 0, -0.25]);
  addMesh(
    boltAssembly,
    new THREE.CylinderGeometry(0.022, 0.022, 0.065, 16),
    matDarkSteel,
    [0.095, -0.022, -0.08]
  );

  // Боковой коробчатый магазин на 5 крупнокалиберных 20-мм патронов (-X)
  const sideMagazine = new THREE.Group();
  sideMagazine.name = 'sideMagazine5Rnd';
  sideMagazine.position.set(-0.125, boreY - 0.02, 0.32);
  sideMagazine.rotation.z = 0.34; // Наклон влево-вниз (-X)
  receiverAndOptics.add(sideMagazine);

  // Приёмная горловина магазина
  addMesh(sideMagazine, new THREE.BoxGeometry(0.11, 0.11, 0.36), matDarkSteel, [-0.04, 0, 0]);
  // Защёлка магазина
  addMesh(sideMagazine, new THREE.BoxGeometry(0.03, 0.045, 0.06), matLatchAccent, [-0.08, -0.065, -0.14]);

  // Корпус коробчатого магазина на 5 патронов 20x138 мм
  addMesh(sideMagazine, new THREE.BoxGeometry(0.38, 0.088, 0.33), matReceiver, [-0.25, 0, 0]);
  // Пятка магазина
  addMesh(sideMagazine, new THREE.BoxGeometry(0.028, 0.102, 0.35), matDarkSteel, [-0.445, 0, 0]);

  // Выштампованные рёбра жёсткости на стенках магазина
  for (const yRib of [-0.046, 0.046]) {
    for (const zRib of [-0.09, 0, 0.09]) {
      addMesh(sideMagazine, new THREE.BoxGeometry(0.32, 0.008, 0.024), matDarkSteel, [-0.24, yRib, zRib]);
    }
  }

  // Видимые 5 крупнокалиберных 20-мм патронов в горловине/окне контроля боезапаса
  for (let i = 0; i < 5; i++) {
    const zRound = -0.11 + i * 0.055;
    // Гильза 20 мм
    addMesh(
      sideMagazine,
      new THREE.CylinderGeometry(0.015, 0.016, 0.13, 14),
      matBrass,
      [-0.14, 0.045, zRound],
      [0, 0, Math.PI / 2]
    );
    // Снаряд 20 мм
    addMesh(
      sideMagazine,
      new THREE.ConeGeometry(0.012, 0.055, 14),
      matDarkSteel,
      [-0.055, 0.045, zRound],
      [0, 0, -Math.PI / 2]
    );
  }

  // Верхняя длинная монтажная планка Пикатинни (Z: -0.40 .. +0.86)
  const railBaseY = boreY + 0.175;
  addMesh(receiverAndOptics, new THREE.BoxGeometry(0.085, 0.022, 1.26), matDarkSteel, [0, railBaseY, 0.23]);

  // Зубцы планки через InstancedMesh
  const railToothGeo = new THREE.BoxGeometry(0.088, 0.012, 0.014);
  const toothCount = 42;
  const railTeethInstanced = new THREE.InstancedMesh(railToothGeo, matDarkSteel, toothCount);
  railTeethInstanced.castShadow = true;
  railTeethInstanced.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < toothCount; i++) {
    dummy.position.set(0, railBaseY + 0.015, -0.37 + i * 0.0295);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    railTeethInstanced.setMatrixAt(i, dummy.matrix);
  }
  receiverAndOptics.add(railTeethInstanced);

  // Перископический оптико-электронный прицельный комплекс
  const opticsComplex = new THREE.Group();
  opticsComplex.name = 'periscopicOpticsComplex';
  opticsComplex.position.set(0, railBaseY + 0.022, 0.18);
  receiverAndOptics.add(opticsComplex);

  // Силовые кронштейны крепления прицела к планке
  for (const zClamp of [-0.18, 0.18]) {
    addMesh(opticsComplex, new THREE.BoxGeometry(0.115, 0.055, 0.09), matDarkSteel, [0, 0.028, zClamp]);
  }

  // Нижний бронекорпус электронно-оптического блока
  addMesh(opticsComplex, new THREE.BoxGeometry(0.145, 0.135, 0.56), matDarkSteel, [0, 0.115, 0.02]);
  // Боковые защитные щёчки корпуса
  addMesh(opticsComplex, new THREE.BoxGeometry(0.162, 0.085, 0.42), matReceiver, [0, 0.115, 0.0]);

  // Верхняя перископическая шахта и головка оптического канала
  addMesh(opticsComplex, new THREE.BoxGeometry(0.125, 0.115, 0.34), matDarkSteel, [0, 0.235, 0.08]);
  // Скошенный козырёк перископа
  addMesh(opticsComplex, new THREE.BoxGeometry(0.132, 0.032, 0.38), matReceiver, [0, 0.298, 0.09], [0.06, 0, 0]);

  // Защитная бленда объектива перископа (спереди)
  addMesh(opticsComplex, new THREE.BoxGeometry(0.136, 0.118, 0.16), matDarkSteel, [0, 0.235, 0.32], [0.04, 0, 0]);
  // Верхний выступ бленды от засветки
  addMesh(opticsComplex, new THREE.BoxGeometry(0.138, 0.018, 0.21), matDarkSteel, [0, 0.292, 0.345]);

  // Главная линза объектива с рубиново-зелёным просветлением (#1e463a, roughness: 0.08)
  addMesh(
    opticsComplex,
    new THREE.CylinderGeometry(0.046, 0.046, 0.016, 28),
    matOpticLens,
    [0, 0.232, 0.265],
    [Math.PI / 2, 0, 0]
  );

  // Окулярная часть с резиновым наглазником (сзади)
  addMesh(
    opticsComplex,
    new THREE.CylinderGeometry(0.036, 0.042, 0.11, 20),
    matDarkSteel,
    [0, 0.135, -0.31],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    opticsComplex,
    new THREE.TorusGeometry(0.038, 0.009, 12, 24),
    matDarkSteel,
    [0, 0.135, -0.365]
  );

  // Барабанчики баллистических поправок
  addMesh(opticsComplex, new THREE.CylinderGeometry(0.026, 0.026, 0.035, 20), matReceiver, [0, 0.315, -0.02]);
  addMesh(
    opticsComplex,
    new THREE.CylinderGeometry(0.024, 0.024, 0.035, 20),
    matReceiver,
    [-0.088, 0.23, -0.02],
    [0, 0, Math.PI / 2]
  );

  // Лазерный дальномер (справа на корпусе прицела, +X)
  const lrfModule = new THREE.Group();
  lrfModule.name = 'laserRangefinder';
  lrfModule.position.set(0.115, 0.145, 0.08);
  opticsComplex.add(lrfModule);

  addMesh(lrfModule, new THREE.BoxGeometry(0.075, 0.095, 0.34), matDarkSteel, [0, 0, 0]);
  addMesh(lrfModule, new THREE.BoxGeometry(0.082, 0.024, 0.36), matReceiver, [0, 0.052, 0.01]);
  // Излучатель и приёмник лазерного дальномера с рубиново-зелёными линзами
  addMesh(
    lrfModule,
    new THREE.CylinderGeometry(0.016, 0.016, 0.012, 20),
    matOpticLens,
    [0, 0.018, 0.168],
    [Math.PI / 2, 0, 0]
  );
  addMesh(
    lrfModule,
    new THREE.CylinderGeometry(0.022, 0.022, 0.012, 20),
    matOpticLens,
    [0, -0.018, 0.168],
    [Math.PI / 2, 0, 0]
  );

  // Метеодатчик (ультразвуковой анемометр / датчик температуры и давления на мачте)
  const meteoSensor = new THREE.Group();
  meteoSensor.name = 'meteoSensor';
  meteoSensor.position.set(-0.085, 0.28, -0.05);
  opticsComplex.add(meteoSensor);

  // Усиленная стойка-мачта
  addMesh(meteoSensor, new THREE.CylinderGeometry(0.011, 0.015, 0.22, 12), matDarkSteel, [0, 0.11, 0]);
  // Измерительная головка с двумя кольцами и стойками ультразвуковых излучателей
  addMesh(meteoSensor, new THREE.CylinderGeometry(0.028, 0.028, 0.016, 16), matReceiver, [0, 0.22, 0]);
  addMesh(meteoSensor, new THREE.CylinderGeometry(0.026, 0.022, 0.018, 16), matDarkSteel, [0, 0.285, 0]);
  for (let a = 0; a < 3; a++) {
    const ang = (a / 3) * Math.PI * 2;
    addMesh(
      meteoSensor,
      new THREE.CylinderGeometry(0.0035, 0.0035, 0.065, 8),
      matDarkSteel,
      [Math.cos(ang) * 0.021, 0.252, Math.sin(ang) * 0.021]
    );
  }

  // =========================================================================
  // 3. ОТКАТНОЙ РИФЛЁНЫЙ СТВОЛ И СОШКА (sniperBarrelGroup)
  // Отдельная группа для анимации отката по -Z на 0.35 м
  // =========================================================================
  const sniperBarrelGroup = new THREE.Group();
  sniperBarrelGroup.name = 'sniperBarrelGroup';
  weaponRoot.add(sniperBarrelGroup);

  // Казённая направляющая втулка отката (входит внутрь кожуха цевья при откате на -0.35 м)
  addMesh(
    sniperBarrelGroup,
    new THREE.CylinderGeometry(0.068, 0.068, 1.00, 24),
    matDarkSteel,
    [0, boreY, 1.05],
    [Math.PI / 2, 0, 0]
  );

  // Массивный толстостенный 20-мм ствол (Z: +1.50 .. +3.16)
  addMesh(
    sniperBarrelGroup,
    new THREE.CylinderGeometry(0.044, 0.056, 1.66, 28),
    matDarkSteel,
    [0, boreY, 2.33],
    [Math.PI / 2, 0, 0]
  );

  // Усиливающие бандажные кольца ствола
  for (const [zRing, rRing] of [
    [1.56, 0.064],
    [2.25, 0.056],
    [2.98, 0.050],
  ]) {
    addMesh(
      sniperBarrelGroup,
      new THREE.CylinderGeometry(rRing, rRing, 0.055, 24),
      matReceiver,
      [0, boreY, zRing],
      [Math.PI / 2, 0, 0]
    );
  }

  // Продольные каннелюры / рёбра охлаждения ствола через InstancedMesh
  const fluteCount = 12;
  const fluteGeo = new THREE.BoxGeometry(0.009, 0.015, 1.34);
  const barrelFlutesInstanced = new THREE.InstancedMesh(fluteGeo, matDarkSteel, fluteCount);
  barrelFlutesInstanced.castShadow = true;
  barrelFlutesInstanced.receiveShadow = true;

  for (let i = 0; i < fluteCount; i++) {
    const angle = (i / fluteCount) * Math.PI * 2;
    const radius = 0.050;
    dummy.position.set(
      Math.cos(angle) * radius,
      boreY + Math.sin(angle) * radius,
      2.28
    );
    dummy.rotation.set(0, 0, angle + Math.PI / 2);
    dummy.updateMatrix();
    barrelFlutesInstanced.setMatrixAt(i, dummy.matrix);
  }
  sniperBarrelGroup.add(barrelFlutesInstanced);

  // Массивный трёхкамерный щелевой дульный тормоз реактивного типа (на конце, z = 3.65)
  const muzzleBrake = new THREE.Group();
  muzzleBrake.name = 'reactiveMuzzleBrake3Chamber';
  // Размещаем так, чтобы передний срез дульного тормоза находился ровно на z = 3.65
  const brakeLength = 0.52;
  const brakeCenterZ = 3.65 - brakeLength / 2; // 3.39
  muzzleBrake.position.set(0, boreY, brakeCenterZ);
  sniperBarrelGroup.add(muzzleBrake);

  // Посадочная муфта дульного тормоза
  addMesh(
    muzzleBrake,
    new THREE.CylinderGeometry(0.054, 0.054, 0.08, 24),
    matDarkSteel,
    [0, 0, -brakeLength / 2 + 0.02],
    [Math.PI / 2, 0, 0]
  );

  // Верхняя и нижняя силовые плиты дульного тормоза (с трапециевидным скосом спереди)
  addMesh(muzzleBrake, new THREE.BoxGeometry(0.165, 0.024, brakeLength - 0.04), matDarkSteel, [0, 0.056, 0.01]);
  addMesh(muzzleBrake, new THREE.BoxGeometry(0.165, 0.024, brakeLength - 0.04), matDarkSteel, [0, -0.056, 0.01]);

  // 4 поперечные перегородки, образующие 3 реактивные щелевые камеры
  const baffleOffsetsZ = [-0.18, -0.055, 0.07, 0.21];
  baffleOffsetsZ.forEach((bz, idx) => {
    const isFront = idx === baffleOffsetsZ.length - 1;
    const width = isFront ? 0.155 : 0.168;
    const thickness = isFront ? 0.055 : 0.042;
    // Перегородка с реактивным наклоном назад для отвода пороховых газов
    addMesh(muzzleBrake, new THREE.BoxGeometry(width, 0.112, thickness), matDarkSteel, [0, 0, bz]);

    // Боковые реактивные дефлекторы между камерами
    if (!isFront) {
      for (const side of [-1, 1]) {
        addMesh(
          muzzleBrake,
          new THREE.BoxGeometry(0.016, 0.095, 0.032),
          matReceiver,
          [side * 0.074, 0, bz + 0.018],
          [0, side * 0.38, 0]
        );
      }
    }
  });

  // Ствольный канал внутри дульного тормоза и тёмное дульное отверстие 20 мм на z = 3.65
  addMesh(
    muzzleBrake,
    new THREE.CylinderGeometry(0.026, 0.026, brakeLength - 0.02, 20),
    matDarkSteel,
    [0, 0, 0.01],
    [Math.PI / 2, 0, 0]
  );
  const boreHoleMat = new THREE.MeshBasicMaterial({ color: 0x050607 });
  addMesh(
    muzzleBrake,
    new THREE.CylinderGeometry(0.010, 0.010, 0.01, 16),
    boreHoleMat,
    [0, 0, brakeLength / 2 - 0.002],
    [Math.PI / 2, 0, 0]
  );

  // Сложенная двуногая тактическая сошка под цевьём/стволом
  const foldedBipod = new THREE.Group();
  foldedBipod.name = 'foldedTacticalBipod';
  foldedBipod.position.set(0, boreY - 0.062, 1.58);
  sniperBarrelGroup.add(foldedBipod);

  // Хомут крепления сошки на стволе и шарнирная траверса
  addMesh(
    foldedBipod,
    new THREE.CylinderGeometry(0.064, 0.064, 0.075, 20),
    matDarkSteel,
    [0, 0.062, 0],
    [Math.PI / 2, 0, 0]
  );
  addMesh(foldedBipod, new THREE.BoxGeometry(0.15, 0.045, 0.07), matReceiver, [0, -0.015, 0]);

  // Две сложенные вперёд телескопические опоры сошки с пружинами и башмаками
  for (const side of [-1, 1]) {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.088, -0.025, 0.02);
    // Сложены вдоль ствола (+Z) с лёгким развалом
    legGroup.rotation.set(0.02, side * 0.035, 0);
    foldedBipod.add(legGroup);

    // Шарнирный кулак
    addMesh(
      legGroup,
      new THREE.CylinderGeometry(0.022, 0.022, 0.032, 14),
      matDarkSteel,
      [0, 0, 0],
      [0, 0, Math.PI / 2]
    );
    // Верхняя труба опоры
    addMesh(
      legGroup,
      new THREE.CylinderGeometry(0.017, 0.017, 0.48, 16),
      matDarkSteel,
      [0, 0, 0.25],
      [Math.PI / 2, 0, 0]
    );
    // Возвратная пружина (витки)
    for (let s = 0; s < 8; s++) {
      addMesh(
        legGroup,
        new THREE.TorusGeometry(0.021, 0.003, 8, 16),
        matReceiver,
        [0, 0, 0.09 + s * 0.018]
      );
    }
    // Нижняя выдвижная штанга и фиксирующая муфта
    addMesh(
      legGroup,
      new THREE.CylinderGeometry(0.021, 0.021, 0.04, 16),
      matReceiver,
      [0, 0, 0.49],
      [Math.PI / 2, 0, 0]
    );
    addMesh(
      legGroup,
      new THREE.CylinderGeometry(0.012, 0.012, 0.30, 14),
      matDarkSteel,
      [0, 0, 0.64],
      [Math.PI / 2, 0, 0]
    );
    // Шипованный опорный башмак-лыжа
    addMesh(legGroup, new THREE.BoxGeometry(0.048, 0.024, 0.095), matDarkSteel, [0, -0.008, 0.80]);
  }

  return weaponRoot;
}

// =========================================================================
// Адаптер под единый просмотрщик: одиночный выстрел 20 мм, откат 0..0.35 м.
// applyVolley(t): резкий откат → накат, вспышка. Возвращает { recoil, flash }.
// =========================================================================
export function createWeapon() {
  const root = createWeaponSVK20Vystrel();
  const ud = root.userData;
  const barrel = root.getObjectByName('sniperBarrelGroup');
  const basePos = barrel ? barrel.position.clone() : new THREE.Vector3();

  const flashLight = new THREE.PointLight(0xff9b3d, 0, 7.5, 1.6);
  flashLight.position.set(0, 0.25, 3.75);
  root.add(flashLight);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffc86b,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const flashCone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 12), flashMat);
  flashCone.rotation.x = Math.PI / 2;
  flashCone.position.set(0, 0.25, 3.98);
  root.add(flashCone);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  // Детерминированная поза выстрела по абсолютному времени t (с):
  // резкий откат 55 мс (кубика) → плавный накат 0.68 с (степень 2.4).
  const pose = (t) => {
    let off = 0;
    let fl = 0;
    if (t < RET_TIME) {
      const u = t / RET_TIME;
      off = MAX_RECOIL * (1 - Math.pow(1 - u, 3));
      fl = Math.max(0, 1 - t / RET_TIME);
    } else if (t < RET_TIME + RETURN_TIME) {
      const u = (t - RET_TIME) / RETURN_TIME;
      off = MAX_RECOIL * Math.pow(1 - u, 2.4);
    }
    if (barrel) barrel.position.z = basePos.z - off;
    root.rotation.x = -0.008 * Math.max(0, fl);
    flashLight.intensity = 18 * fl;
    flashMat.opacity = 0.92 * fl;
    flashCone.scale.setScalar(0.8 + 0.5 * fl);
    return { recoil: off, flash: fl };
  };

  ud.barrel = barrel;
  ud.applyVolley = (t) => {
    if (t === null || t === undefined || t > 10) {
      if (barrel) barrel.position.z = basePos.z;
      root.rotation.x = 0;
      flashLight.intensity = 0;
      flashMat.opacity = 0;
      flashCone.scale.setScalar(0.8);
      return { recoil: 0, flash: 0 };
    }
    return pose(t);
  };
  ud.setExtension = (recoil) => {
    const r = Math.max(0, Math.min(MAX_RECOIL, recoil));
    if (barrel) barrel.position.z = basePos.z - r;
    return r / MAX_RECOIL;
  };
  ud.setFlash = (k) => {
    flashLight.intensity = 18.0 * Math.max(0, Math.min(1, k));
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
