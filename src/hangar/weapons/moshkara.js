import * as THREE from 'three';

export const meta = {
  id: 'moshkara',
  code: 'КДМ-12',
  title: 'КДМ-12 «Мошкара»',
  subtitle: 'ЛЁГКИЙ КАССЕТНЫЙ ДИСПЕНСЕР МИКРО-ДРОНОВ • СЛОТ AUX • 12 ЯЧЕЕК • ЦИКЛ 6.0 С',
  description:
    'Лёгкий кассетный диспенсер микро-дронов: фланец УСП, бронированный корпус с радиаторами аккумуляторов, трафаретом «МОШКАРА» и блоком связи (антенна, проблесковый маяк). Сотовая матрица 4×3 с 12 сложенными микро-дронами за откидной бронешторкой. Цикл: шторка вверх → поочерёдный выброс роя → возврат.',
  specs: [
    ['Ячейки', '12 (4×3)'],
    ['Направление', 'Выброс +Z'],
    ['Шторка', 'Откидная, 113°'],
    ['Цикл', '6.0 с'],
    ['Слот', 'УСП-AUX'],
    ['Габариты', '0.42×0.36×1.15 м'],
  ],
  maxExtension: 6.0,
  unit: 's',
  tipOffset: 0.58,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'dispenserHousing', label: '2. Корпус и блок связи' },
    { key: 'cellsMatrixGroup', label: '3. Сотовая матрица ячеек' },
    { key: 'frontShutterGroup', label: '4. Бронешторка' },
  ],
  cameras: {
    module: { pos: [1.15, 0.42, 1.32], target: [0, -0.15, 0.05] },
  },
  rangeMarkers: [],
  controls: 'atgm',
};

const MOSHKARA_CYCLE = 6.0;
const MOSHKARA_COUNT = 12;
const MOSHKARA_FIRST = 1.4;
const MOSHKARA_INTERVAL = 0.28;

/**
 * Создаёт процедурную CanvasTexture с жёлто-чёрной полосой опасности.
 */
function createHazardStripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#e2a318';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1b1d21';
  const stripeW = 32;
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW - canvas.height, canvas.height);
    ctx.lineTo(x - canvas.height, canvas.height);
    ctx.closePath();
    ctx.fill();
  }

  // Лёгкие потёртости и техническая кайма
  ctx.strokeStyle = 'rgba(15, 17, 20, 0.75)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

  ctx.fillStyle = 'rgba(207, 212, 216, 0.14)';
  for (let i = 0; i < 90; i++) {
    const sx = (i * 73) % canvas.width;
    const sy = (i * 41) % canvas.height;
    ctx.fillRect(sx, sy, (i % 7) + 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Создаёт процедурную CanvasTexture с трафаретной маркировкой «МОШКАРА».
 */
function createStencilDecalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Оранжевая плашка-рамка warning-блока
  ctx.fillStyle = '#c45d24';
  ctx.fillRect(24, 34, 42, 188);

  // Чёрные диагональные риски на оранжевой плашке
  ctx.fillStyle = '#1d2024';
  for (let y = 42; y < 210; y += 22) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(66, y + 10);
    ctx.lineTo(66, y + 18);
    ctx.lineTo(24, y + 8);
    ctx.closePath();
    ctx.fill();
  }

  // Основной трафарет «МОШКАРА»
  ctx.fillStyle = '#1f2328';
  ctx.font = '900 84px "Arial Black", "Impact", "DejaVu Sans", sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('МОШКАРА', 86, 28);

  // Трафаретные перемычки поверх букв для эффекта напыления через шаблон
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  const stencilCuts = [118, 188, 268, 336, 405, 480, 545];
  for (const cx of stencilCuts) {
    ctx.fillRect(cx, 26, 4, 92);
  }
  ctx.globalCompositeOperation = 'source-over';

  // Индекс изделия справа
  ctx.fillStyle = '#26292e';
  ctx.font = '700 24px "Consolas", "Courier New", monospace';
  ctx.fillText('КДМ-12 // AUX-РОЙ', 630, 42);
  ctx.fillText('ПН-84.03-АРКТИКА', 630, 74);

  // Предупреждающая плашка «ОПАСНО: АВТОМАТИЧЕСКИЙ ПУСК»
  ctx.fillStyle = '#c45d24';
  ctx.fillRect(86, 134, 898, 52);

  ctx.fillStyle = '#141619';
  ctx.font = '900 32px "Arial Black", "DejaVu Sans", sans-serif';
  ctx.fillText('▲ ОПАСНО: АВТОМАТИЧЕСКИЙ ПУСК', 104, 144);

  // Нижняя техническая строка
  ctx.fillStyle = '#343940';
  ctx.font = '700 20px "Consolas", monospace';
  ctx.fillText('ЗОНА ВЫБРОСА +Z • НЕ ПЕРЕКРЫВАТЬ СТВОРКУ • ТЕМП. -55°C...+50°C', 88, 200);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Создаёт трафаретную предупреждающую текстуру для передней бронешторки.
 */
function createShutterStencilTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Оранжевая шевронная полоса сверху и снизу
  ctx.fillStyle = '#c45d24';
  ctx.fillRect(28, 36, 456, 44);
  ctx.fillRect(28, 428, 456, 48);

  // Трафаретный текст по центру шторки
  ctx.fillStyle = '#23272c';
  ctx.font = '900 56px "Arial Black", "DejaVu Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('МОШКАРА', 256, 195);

  ctx.fillStyle = '#c45d24';
  ctx.font = '900 30px "Arial Black", "DejaVu Sans", sans-serif';
  ctx.fillText('ПУСК РОЯ // +Z', 256, 260);

  ctx.fillStyle = '#2b3036';
  ctx.font = '700 22px "Consolas", monospace';
  ctx.fillText('12 ЯЧЕЕК • УСП-AUX', 256, 315);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Генерирует процедурную 3D-модель лёгкого кассетного диспенсера микро-дронов «Мошкара».
 * Габариты: ~0.42 x 0.36 x 1.15 м.
 * Ориентация: +Z — направление выброса, +Y — верх, +X — правый борт.
 * Начало координат (0, 0, 0): центр верхнего стыковочного фланца УСП.
 *
 * @returns {THREE.Group}
 */
export function createWeaponMoshkara() {
  const root = new THREE.Group();
  root.name = 'WeaponMoshkara';

  // --- PBR МАТЕРИАЛЫ ---
  const polarWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xcfd4d8,
    metalness: 0.35,
    roughness: 0.60,
  });

  const arcticOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xc45d24,
    metalness: 0.25,
    roughness: 0.55,
  });

  const darkGraphiteMat = new THREE.MeshStandardMaterial({
    color: 0x26292e,
    metalness: 0.80,
    roughness: 0.40,
  });

  const machinedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x6e757d,
    metalness: 0.85,
    roughness: 0.32,
  });

  const rubberSealMat = new THREE.MeshStandardMaterial({
    color: 0x16181b,
    metalness: 0.05,
    roughness: 0.88,
  });

  const droneCapMat = new THREE.MeshStandardMaterial({
    color: 0xe3661e,
    metalness: 0.20,
    roughness: 0.42,
    emissive: 0x3a1400,
    emissiveIntensity: 0.25,
  });

  const beaconGlowMat = new THREE.MeshStandardMaterial({
    color: 0xff7b1c,
    emissive: 0xff5a00,
    emissiveIntensity: 2.0,
    roughness: 0.22,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
  });

  const hazardTexture = createHazardStripeTexture();
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTexture,
    metalness: 0.30,
    roughness: 0.55,
  });

  const stencilTexture = createStencilDecalTexture();
  const stencilMat = new THREE.MeshStandardMaterial({
    map: stencilTexture,
    transparent: true,
    roughness: 0.62,
    metalness: 0.25,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  const shutterStencilTex = createShutterStencilTexture();
  const shutterStencilMat = new THREE.MeshStandardMaterial({
    map: shutterStencilTex,
    transparent: true,
    roughness: 0.58,
    metalness: 0.25,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ УСП (mountFlange)
  // Размер: 0.34 x 0.10 x 0.55 м, центр в (0, 0, 0)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Основная стальная плита УСП
  const flangeBasePlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.044, 0.55),
    machinedSteelMat
  );
  flangeBasePlate.position.set(0, -0.008, 0);
  flangeBasePlate.castShadow = true;
  flangeBasePlate.receiveShadow = true;
  mountFlange.add(flangeBasePlate);

  // Верхний стыковочный гребень (ласточкин хвост / направляющая УСП, верх на y = +0.05)
  const railShape = new THREE.Shape();
  railShape.moveTo(-0.11, 0);
  railShape.lineTo(0.11, 0);
  railShape.lineTo(0.13, 0.036);
  railShape.lineTo(-0.13, 0.036);
  railShape.closePath();

  const railGeo = new THREE.ExtrudeGeometry(railShape, {
    depth: 0.51,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
  });
  railGeo.translate(0, 0.014, -0.255);
  const topDockRail = new THREE.Mesh(railGeo, darkGraphiteMat);
  topDockRail.castShadow = true;
  topDockRail.receiveShadow = true;
  mountFlange.add(topDockRail);

  // Нижний переходной воротник к корпусу (y = -0.05 ... -0.03)
  const flangeCollar = new THREE.Mesh(
    new THREE.BoxGeometry(0.31, 0.024, 0.52),
    darkGraphiteMat
  );
  flangeCollar.position.set(0, -0.038, 0);
  flangeCollar.castShadow = true;
  flangeCollar.receiveShadow = true;
  mountFlange.add(flangeCollar);

  // Жёлто-чёрные полосы опасности по боковым граням плиты УСП
  const hazardStripGeo = new THREE.BoxGeometry(0.004, 0.036, 0.53);
  const hazardLeft = new THREE.Mesh(hazardStripGeo, hazardMat);
  hazardLeft.position.set(-0.171, -0.008, 0);
  mountFlange.add(hazardLeft);

  const hazardRight = new THREE.Mesh(hazardStripGeo, hazardMat);
  hazardRight.position.set(0.171, -0.008, 0);
  mountFlange.add(hazardRight);

  // 4 силовых замка фиксации УСП (2 по левому борту, 2 по правому)
  const lockPositions = [
    [-0.155, 0.012, -0.18],
    [0.155, 0.012, -0.18],
    [-0.155, 0.012, 0.18],
    [0.155, 0.012, 0.18],
  ];

  lockPositions.forEach(([lx, ly, lz], idx) => {
    const lockUnit = new THREE.Group();
    lockUnit.name = `uspLock_${idx + 1}`;
    lockUnit.position.set(lx, ly, lz);

    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.034, 0.072),
      darkGraphiteMat
    );
    housing.castShadow = true;
    lockUnit.add(housing);

    // Запорный кулачок / скоба
    const sideSign = Math.sign(lx);
    const latchClaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.022, 0.044),
      machinedSteelMat
    );
    latchClaw.position.set(-sideSign * 0.014, 0.018, 0);
    lockUnit.add(latchClaw);

    // Оранжевый индикатор взвода замка
    const indicator = new THREE.Mesh(
      new THREE.BoxGeometry(0.006, 0.012, 0.028),
      arcticOrangeMat
    );
    indicator.position.set(sideSign * 0.022, 0.002, 0);
    lockUnit.add(indicator);

    mountFlange.add(lockUnit);
  });

  // Разъём шины данных и питания (ШР) на переднем торце фланца
  const dataPlug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.024, 16),
    darkGraphiteMat
  );
  dataPlug.rotation.x = Math.PI / 2;
  dataPlug.position.set(0, -0.012, 0.282);
  mountFlange.add(dataPlug);

  // =========================================================================
  // 2. БРОНИРОВАННЫЙ КАССЕТНЫЙ КОРПУС И БЛОК СВЯЗИ (dispenserHousing)
  // Габариты блока: X = 0.42 м, Y = -0.31..+0.05 (0.36 м), Z = -0.57..+0.58 (1.15 м)
  // =========================================================================
  const dispenserHousing = new THREE.Group();
  dispenserHousing.name = 'dispenserHousing';
  root.add(dispenserHousing);

  // Основной угловатый бронекорпус со скошенными гранями (y от -0.305 до -0.045)
  const hullW = 0.376;
  const hullH = 0.256;
  const chamfer = 0.028;

  const hullShape = new THREE.Shape();
  const hw = hullW / 2;
  hullShape.moveTo(-hw + chamfer, 0);
  hullShape.lineTo(hw - chamfer, 0);
  hullShape.lineTo(hw, -chamfer);
  hullShape.lineTo(hw, -hullH + chamfer);
  hullShape.lineTo(hw - chamfer, -hullH);
  hullShape.lineTo(-hw + chamfer, -hullH);
  hullShape.lineTo(-hw, -hullH + chamfer);
  hullShape.lineTo(-hw, -chamfer);
  hullShape.closePath();

  const mainHullLength = 1.04; // z от -0.51 до +0.53
  const mainHullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: mainHullLength,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 2,
  });
  mainHullGeo.translate(0, -0.046, -0.51);

  const mainHullMesh = new THREE.Mesh(mainHullGeo, polarWhiteMat);
  mainHullMesh.castShadow = true;
  mainHullMesh.receiveShadow = true;
  dispenserHousing.add(mainHullMesh);

  // Оранжевые полярные технические полосы и носовой/кормовой пояса
  const frontOrangeCollar = new THREE.Mesh(
    new THREE.BoxGeometry(0.382, 0.224, 0.095),
    arcticOrangeMat
  );
  frontOrangeCollar.position.set(0, -0.174, 0.455);
  frontOrangeCollar.castShadow = true;
  frontOrangeCollar.receiveShadow = true;
  dispenserHousing.add(frontOrangeCollar);

  // Верхняя продольная оранжевая полоса вдоль хребта
  const topOrangeSpine = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.006, 0.98),
    arcticOrangeMat
  );
  topOrangeSpine.position.set(0, -0.044, 0.01);
  dispenserHousing.add(topOrangeSpine);

  // Нижние силовые полозья-амортизаторы из тёмного графита (до y = -0.31)
  [-0.125, 0.125].forEach((sx) => {
    const skidRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.014, 1.02),
      darkGraphiteMat
    );
    skidRail.position.set(sx, -0.303, 0.01);
    skidRail.castShadow = true;
    skidRail.receiveShadow = true;
    dispenserHousing.add(skidRail);
  });

  // Передний графитовый бронефланец вокруг сотовой матрицы (z = 0.53 .. 0.574)
  const frontBezelOuter = new THREE.Mesh(
    new THREE.BoxGeometry(0.386, 0.264, 0.044),
    darkGraphiteMat
  );
  frontBezelOuter.position.set(0, -0.174, 0.552);
  frontBezelOuter.castShadow = true;
  frontBezelOuter.receiveShadow = true;
  dispenserHousing.add(frontBezelOuter);

  // Кормовой отсек блока управления роем и аккумуляторов (z = -0.57 .. -0.51)
  const rearCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.364, 0.244, 0.062),
    darkGraphiteMat
  );
  rearCap.position.set(0, -0.174, -0.539);
  rearCap.castShadow = true;
  rearCap.receiveShadow = true;
  dispenserHousing.add(rearCap);

  // Оранжевый кормовой бампер-окантовка
  const rearOrangeTrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.378, 0.056, 0.048),
    arcticOrangeMat
  );
  rearOrangeTrim.position.set(0, -0.258, -0.532);
  dispenserHousing.add(rearOrangeTrim);

  // --- РЕБРИСТЫЕ РАДИАТОРЫ ОХЛАЖДЕНИЯ АККУМУЛЯТОРОВ (слева и справа) ---
  // Вместе с радиаторами полная ширина блока составляет ровно 0.42 м (x = ±0.21)
  const finCountPerSide = 14;
  const totalFins = finCountPerSide * 2;
  const finGeo = new THREE.BoxGeometry(0.018, 0.146, 0.006);
  const finsInstanced = new THREE.InstancedMesh(finGeo, darkGraphiteMat, totalFins);
  finsInstanced.castShadow = true;
  finsInstanced.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let finIdx = 0;

  [-1, 1].forEach((side) => {
    // Основание радиатора
    const radBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.162, 0.34),
      darkGraphiteMat
    );
    radBase.position.set(side * 0.192, -0.176, -0.26);
    radBase.castShadow = true;
    dispenserHousing.add(radBase);

    // Оранжевая защитная рама вокруг радиатора
    const guardTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.012, 0.35),
      arcticOrangeMat
    );
    guardTop.position.set(side * 0.199, -0.092, -0.26);
    dispenserHousing.add(guardTop);

    const guardBot = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.012, 0.35),
      arcticOrangeMat
    );
    guardBot.position.set(side * 0.199, -0.260, -0.26);
    dispenserHousing.add(guardBot);

    // Рёбра охлаждения (доходят до x = ±0.210 -> общая ширина 0.42 м)
    for (let i = 0; i < finCountPerSide; i++) {
      const zPos = -0.415 + i * 0.0238;
      dummy.position.set(side * 0.201, -0.176, zPos);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      finsInstanced.setMatrixAt(finIdx++, dummy.matrix);
    }
  });
  finsInstanced.instanceMatrix.needsUpdate = true;
  finsInstanced.computeBoundingSphere();
  dispenserHousing.add(finsInstanced);

  // --- ТРАФАРЕТ «МОШКАРА / ОПАСНО: АВТОМАТИЧЕСКИЙ ПУСК» НА ОБОИХ БОРТАХ ---
  const decalPlaneGeo = new THREE.PlaneGeometry(0.42, 0.105);

  const rightDecal = new THREE.Mesh(decalPlaneGeo, stencilMat);
  rightDecal.position.set(0.1895, -0.174, 0.16);
  rightDecal.rotation.y = Math.PI / 2;
  dispenserHousing.add(rightDecal);

  const leftDecal = new THREE.Mesh(decalPlaneGeo, stencilMat);
  leftDecal.position.set(-0.1895, -0.174, 0.16);
  leftDecal.rotation.y = -Math.PI / 2;
  dispenserHousing.add(leftDecal);

  // --- СКЛАДНАЯ ШТЫРЕВАЯ АНТЕННА УПРАВЛЕНИЯ РОЕМ СЗАДИ (-Z) ---
  const antennaAssembly = new THREE.Group();
  antennaAssembly.name = 'swarmAntennaGroup';
  antennaAssembly.position.set(0.135, -0.075, -0.545);
  dispenserHousing.add(antennaAssembly);

  // Основание шарнира на корме
  const antennaBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.036, 0.042, 0.036),
    machinedSteelMat
  );
  antennaAssembly.add(antennaBase);

  // Поворотный коленный узел
  const antennaPivot = new THREE.Group();
  antennaPivot.position.set(0, 0.016, -0.01);
  // Лёгкий рабочий наклон назад (-Z) и в сторону
  antennaPivot.rotation.x = -0.32;
  antennaPivot.rotation.z = -0.08;
  antennaAssembly.add(antennaPivot);

  const hingeDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 0.038, 16),
    darkGraphiteMat
  );
  hingeDrum.rotation.z = Math.PI / 2;
  antennaPivot.add(hingeDrum);

  // Пружинный демпфер у основания штыря
  const springCoil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.010, 0.011, 0.042, 14),
    machinedSteelMat
  );
  springCoil.position.set(0, 0.028, 0);
  antennaPivot.add(springCoil);

  // Гибкий графитовый штырь антенны
  const whipMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0025, 0.0065, 0.34, 12),
    darkGraphiteMat
  );
  whipMast.position.set(0, 0.215, 0);
  whipMast.castShadow = true;
  antennaPivot.add(whipMast);

  // Оранжевый защитный наконечник антенны
  const antennaTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.0055, 12, 12),
    arcticOrangeMat
  );
  antennaTip.position.set(0, 0.386, 0);
  antennaPivot.add(antennaTip);

  // --- ОРАНЖЕВЫЙ ПРОБЛЕСКОВЫЙ МАЯК СОСТОЯНИЯ ---
  const beaconGroup = new THREE.Group();
  beaconGroup.name = 'statusBeacon';
  beaconGroup.position.set(-0.115, -0.046, -0.455);
  dispenserHousing.add(beaconGroup);

  const beaconPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.026, 0.016, 16),
    darkGraphiteMat
  );
  beaconPedestal.position.y = 0.008;
  beaconGroup.add(beaconPedestal);

  const beaconDome = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.018, 0.032, 16),
    beaconGlowMat
  );
  beaconDome.position.y = 0.031;
  beaconGroup.add(beaconDome);

  const beaconCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.015, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    beaconGlowMat
  );
  beaconCap.position.y = 0.047;
  beaconGroup.add(beaconCap);

  // Защитная дуга вокруг маяка
  const guardRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.024, 0.0025, 8, 20),
    machinedSteelMat
  );
  guardRing.rotation.x = Math.PI / 2;
  guardRing.position.y = 0.044;
  beaconGroup.add(guardRing);

  // Точечный источник света для бликов маяка на корпусе
  const beaconPointLight = new THREE.PointLight(0xff6a00, 0.6, 0.45);
  beaconPointLight.position.set(0, 0.045, 0);
  beaconGroup.add(beaconPointLight);

  // --- ЗАКЛЁПКИ И ВИНТЫ ЧЕРЕЗ THREE.InstancedMesh ---
  const rivetTransforms = [];
  const pushRivet = (x, y, z, rx = 0, ry = 0, rz = 0) => {
    rivetTransforms.push({ x, y, z, rx, ry, rz });
  };

  // Заклёпки по верхним и нижним кромкам левого и правого бортов
  for (let z = -0.48; z <= 0.50; z += 0.07) {
    // Боковые верхние
    pushRivet(0.189, -0.082, z, 0, 0, -Math.PI / 2);
    pushRivet(-0.189, -0.082, z, 0, 0, Math.PI / 2);
    // Боковые нижние
    pushRivet(0.189, -0.266, z, 0, 0, -Math.PI / 2);
    pushRivet(-0.189, -0.266, z, 0, 0, Math.PI / 2);
    // Верхняя палуба вдоль стыка фланца
    if (Math.abs(z) > 0.28) {
      pushRivet(0.125, -0.045, z, 0, 0, 0);
      pushRivet(-0.125, -0.045, z, 0, 0, 0);
    }
  }

  // Винты крепления переднего бронефланца и кормовой крышки
  for (let x = -0.16; x <= 0.161; x += 0.08) {
    pushRivet(x, -0.056, 0.575, Math.PI / 2, 0, 0);
    pushRivet(x, -0.292, 0.575, Math.PI / 2, 0, 0);
    pushRivet(x, -0.068, -0.571, -Math.PI / 2, 0, 0);
    pushRivet(x, -0.280, -0.571, -Math.PI / 2, 0, 0);
  }

  const rivetGeo = new THREE.CylinderGeometry(0.0038, 0.0044, 0.003, 6);
  const rivetsInstanced = new THREE.InstancedMesh(
    rivetGeo,
    machinedSteelMat,
    rivetTransforms.length
  );
  rivetTransforms.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(t.rx, t.ry, t.rz);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    rivetsInstanced.setMatrixAt(i, dummy.matrix);
  });
  rivetsInstanced.instanceMatrix.needsUpdate = true;
  rivetsInstanced.computeBoundingSphere();
  dispenserHousing.add(rivetsInstanced);

  // =========================================================================
  // 3. СОТОВАЯ МАТРИЦА ЯЧЕЕК ЗАПУСКА (cellsMatrixGroup) И ШТОРКА (frontShutterGroup)
  // =========================================================================
  const cellsMatrixGroup = new THREE.Group();
  cellsMatrixGroup.name = 'cellsMatrixGroup';
  root.add(cellsMatrixGroup);

  // 12 квадратных пусковых ячеек (4 столбца по X × 3 ряда по Y) через InstancedMesh
  const cols = 4;
  const rows = 3;
  const totalCells = cols * rows; // 12 ячеек
  const pitchX = 0.082;
  const pitchY = 0.072;
  const cellOuter = 0.076;
  const cellInner = 0.066;
  const cellDepth = 0.34;
  const matrixCenterY = -0.174;
  const matrixFrontZ = 0.572;

  // Создаём полый квадратный профиль пусковой шахты
  const cellShape = new THREE.Shape();
  const co = cellOuter / 2;
  cellShape.moveTo(-co, -co);
  cellShape.lineTo(co, -co);
  cellShape.lineTo(co, co);
  cellShape.lineTo(-co, co);
  cellShape.closePath();

  const holePath = new THREE.Path();
  const ci = cellInner / 2;
  holePath.moveTo(-ci, -ci);
  holePath.lineTo(-ci, ci);
  holePath.lineTo(ci, ci);
  holePath.lineTo(ci, -ci);
  holePath.closePath();
  cellShape.holes.push(holePath);

  const cellTubeGeo = new THREE.ExtrudeGeometry(cellShape, {
    depth: cellDepth,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.0015,
    bevelSegments: 1,
  });
  cellTubeGeo.translate(0, 0, -cellDepth);

  const cellsInstanced = new THREE.InstancedMesh(
    cellTubeGeo,
    darkGraphiteMat,
    totalCells
  );
  cellsInstanced.name = 'cellsInstanced';
  cellsInstanced.castShadow = true;
  cellsInstanced.receiveShadow = true;

  // Тыльная вышибная плита матрицы (z = 0.23)
  const matrixBackplate = new THREE.Mesh(
    new THREE.BoxGeometry(cols * pitchX + 0.01, rows * pitchY + 0.01, 0.016),
    machinedSteelMat
  );
  matrixBackplate.position.set(0, matrixCenterY, matrixFrontZ - cellDepth);
  cellsMatrixGroup.add(matrixBackplate);

  // Геометрии сложенных микро-дронов внутри ячеек (корпус + оранжевый колпачок)
  const droneBodyGeo = new THREE.CylinderGeometry(0.022, 0.024, 0.21, 8);
  droneBodyGeo.rotateX(Math.PI / 2);

  const droneCapGeo = new THREE.CylinderGeometry(0.012, 0.022, 0.036, 12);
  droneCapGeo.rotateX(Math.PI / 2);

  const droneBodiesInstanced = new THREE.InstancedMesh(
    droneBodyGeo,
    machinedSteelMat,
    totalCells
  );
  droneBodiesInstanced.name = 'droneBodies';

  const droneCapsInstanced = new THREE.InstancedMesh(
    droneCapGeo,
    droneCapMat,
    totalCells
  );
  droneCapsInstanced.name = 'droneCaps';

  const cellXY = [];
  let cellIdx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c - (cols - 1) / 2) * pitchX;
      const cy = matrixCenterY + ((rows - 1) / 2 - r) * pitchY;
      cellXY.push([cx, cy]);

      // Ячейка сотовой матрицы
      dummy.position.set(cx, cy, matrixFrontZ);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cellsInstanced.setMatrixAt(cellIdx, dummy.matrix);

      // Сложенный корпус микро-дрона в глубине ячейки
      dummy.position.set(cx, cy, matrixFrontZ - 0.145);
      dummy.updateMatrix();
      droneBodiesInstanced.setMatrixAt(cellIdx, dummy.matrix);

      // Оранжевый маркировочный носовой колпачок микро-дрона
      dummy.position.set(cx, cy, matrixFrontZ - 0.024);
      dummy.updateMatrix();
      droneCapsInstanced.setMatrixAt(cellIdx, dummy.matrix);

      cellIdx++;
    }
  }

  cellsInstanced.instanceMatrix.needsUpdate = true;
  cellsInstanced.computeBoundingSphere();
  droneBodiesInstanced.instanceMatrix.needsUpdate = true;
  droneCapsInstanced.instanceMatrix.needsUpdate = true;

  cellsMatrixGroup.add(cellsInstanced);
  cellsMatrixGroup.add(droneBodiesInstanced);
  cellsMatrixGroup.add(droneCapsInstanced);

  // --- ОТКИДНАЯ ЗАЩИТНАЯ БРОНЕШТОРКА НА ВЕРХНЕЙ ПЕТЛЕ (frontShutterGroup) ---
  // Позиция на переднем торце z = 0.58, ось вращения вдоль верхней петли
  const frontShutterGroup = new THREE.Group();
  frontShutterGroup.name = 'frontShutterGroup';
  const hingeY = -0.056;
  frontShutterGroup.position.set(0, hingeY, 0.58);
  root.add(frontShutterGroup);

  // Стальной шарнирный вал и 3 петлевых кулака в локальном (0, 0, 0)
  const hingePin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.007, 0.36, 14),
    machinedSteelMat
  );
  hingePin.rotation.z = Math.PI / 2;
  frontShutterGroup.add(hingePin);

  [-0.125, 0, 0.125].forEach((hx) => {
    const knuckle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.044, 14),
      darkGraphiteMat
    );
    knuckle.rotation.z = Math.PI / 2;
    knuckle.position.set(hx, 0, 0);
    frontShutterGroup.add(knuckle);
  });

  // Бронеплита шторки свисает вниз от петли (локальный y от -0.006 до -0.244)
  const doorHeight = 0.238;
  const doorWidth = 0.366;
  const doorPlate = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth, doorHeight, 0.016),
    polarWhiteMat
  );
  doorPlate.position.set(0, -doorHeight / 2 - 0.004, 0.008);
  doorPlate.castShadow = true;
  doorPlate.receiveShadow = true;
  frontShutterGroup.add(doorPlate);

  // Рельефные силовые рёбра жёсткости на внешней стороне шторки
  [-0.145, 0.145].forEach((rx) => {
    const sideRib = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, doorHeight - 0.02, 0.008),
      darkGraphiteMat
    );
    sideRib.position.set(rx, -doorHeight / 2 - 0.004, 0.018);
    sideRib.castShadow = true;
    frontShutterGroup.add(sideRib);
  });

  // Трафаретная маркировка на внешней стороне бронешторки
  const shutterDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.22),
    shutterStencilMat
  );
  shutterDecal.position.set(0, -doorHeight / 2 - 0.004, 0.0165);
  frontShutterGroup.add(shutterDecal);

  // Внутренний резиновый уплотнитель по периметру шторки
  const innerSeal = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth - 0.018, doorHeight - 0.018, 0.006),
    rubberSealMat
  );
  innerSeal.position.set(0, -doorHeight / 2 - 0.004, -0.001);
  frontShutterGroup.add(innerSeal);

  // Нижние замки-защёлки шторки
  [-0.11, 0.11].forEach((lx) => {
    const bottomCatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.022, 0.022),
      machinedSteelMat
    );
    bottomCatch.position.set(lx, -doorHeight - 0.004, 0.006);
    frontShutterGroup.add(bottomCatch);
  });

  // Сохраняем ссылки на ключевые узлы и метод покадровой анимации
  root.userData = {
    mountFlange,
    dispenserHousing,
    cellsMatrixGroup,
    frontShutterGroup,
    beaconGlowMat,
    beaconPointLight,
    antennaPivot,
    droneCells: {
      bodies: droneBodiesInstanced,
      caps: droneCapsInstanced,
      xy: cellXY,
      zBody0: matrixFrontZ - 0.145,
      zCap0: matrixFrontZ - 0.024,
    },
  };

  return root;
}

// ============================================================================
// Адаптер под единый просмотрщик: цикл 6.0 с — шторка, выброс роя, возврат.
// applyAtgm(t): детерминированная поза — шторка, 12 микро-дронов, маяк.
// Возвращает { left, right, flash } для телеметрии.
// ============================================================================
export function createWeapon() {
  const root = createWeaponMoshkara();
  const ud = root.userData;

  const launchLight = new THREE.PointLight(0xffa63d, 0, 2.5);
  launchLight.position.set(0, -0.174, 0.72);
  root.add(launchLight);

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

  const dummyL = new THREE.Object3D();

  // Детерминированная поза роя в абсолютное время t (с)
  const poseAt = (t) => {
    const ct = Math.max(0, Math.min(MOSHKARA_CYCLE, t));

    // Шторка: открытие 0.3–1.2 с, удержание, закрытие 4.8–5.7 с
    const open = sstep(0.3, 1.2, ct) * (1 - sstep(4.8, 5.7, ct));
    ud.frontShutterGroup.rotation.x = -open * 1.98;

    // Маяк: пульсация ускоряется при открытой шторке
    const pulseSpeed = open > 0.2 ? 12.0 : 4.5;
    const pulse = 0.5 + 0.5 * Math.sin(ct * pulseSpeed);
    ud.beaconGlowMat.emissiveIntensity = 0.6 + pulse * 2.6;
    ud.beaconPointLight.intensity = 0.15 + pulse * 0.95;

    // Микровибрация антенны
    ud.antennaPivot.rotation.z = -0.08 + Math.sin(ct * 3.2) * 0.012;

    // Выброс 12 микро-дронов: пуск k-го в FIRST + k*INTERVAL
    let flash = 0;
    const cells = ud.droneCells;
    for (let k = 0; k < MOSHKARA_COUNT; k++) {
      const tFire = MOSHKARA_FIRST + k * MOSHKARA_INTERVAL;
      const [cx, cy] = cells.xy[k];
      if (ct < tFire) {
        dummyL.position.set(cx, cy, cells.zBody0);
        dummyL.rotation.set(0, 0, 0);
        dummyL.scale.set(1, 1, 1);
        dummyL.updateMatrix();
        cells.bodies.setMatrixAt(k, dummyL.matrix);

        dummyL.position.set(cx, cy, cells.zCap0);
        dummyL.updateMatrix();
        cells.caps.setMatrixAt(k, dummyL.matrix);
      } else {
        const dt = ct - tFire;
        // Разгон вышибным зарядом + планирование роя вперёд
        const dz = 2.2 * dt + 3.5 * dt * dt;
        const spread = Math.min(1, dt * 1.5);
        const dx = ((k % 4) - 1.5) * 0.10 * spread;
        const dy = (Math.floor(k / 4) - 1) * 0.08 * spread + 0.25 * dt;
        const inRange = dz < 7.0;
        dummyL.position.set(cx + dx, cy + dy, cells.zBody0 + dz);
        dummyL.rotation.set(dt * 0.6, 0, dt * 1.1);
        dummyL.scale.setScalar(inRange ? 1 : 0);
        dummyL.updateMatrix();
        cells.bodies.setMatrixAt(k, dummyL.matrix);

        dummyL.position.set(cx + dx, cy + dy, cells.zCap0 + dz);
        dummyL.updateMatrix();
        cells.caps.setMatrixAt(k, dummyL.matrix);

        flash = Math.max(flash, 5.0 * Math.exp(-dt * 7.0));
      }
    }
    cells.bodies.instanceMatrix.needsUpdate = true;
    cells.caps.instanceMatrix.needsUpdate = true;

    launchLight.intensity = flash * 0.8;
    return { left: open > 0.5, right: open > 0.5, flash };
  };

  ud.applyAtgm = (t) => poseAt(t);
  ud.setExtension = (t) => {
    poseAt(t);
    return t / MOSHKARA_CYCLE;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
