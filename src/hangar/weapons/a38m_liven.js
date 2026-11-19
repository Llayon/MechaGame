import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'a38m',
  code: '2А38М',
  title: '2А38М «Ливень»',
  subtitle: 'СПАРЕННЫЙ 30-ММ ЗЕНИТНЫЙ АВТОМАТ • 2400 ВЫСТР/МИН • ПРОТИВОФАЗА',
  description: 'Спаренный 30-мм зенитный автомат: фланец УСП, сдвоенная ствольная коробка с боковыми радиаторами охлаждения, электропривод перезарядки, рукава боепитания и два откатных ствола с пламегасителями, работающих строго в противофазе (18 Гц на ствол).',
  specs: [
    ['Калибр', '2×30 мм'],
    ['Темп', '2400 выстр/мин суммарно'],
    ['Фазировка', 'Противофаза, 18 Гц/ствол'],
    ['Откат ствола', '48 мм'],
    ['Охлаждение', 'Боковые радиаторы'],
    ['Длина модуля', '~3.20 м'],
  ],
  maxExtension: 1.0,
  unit: '%',
  tipOffset: 2.55,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'twinReceiver', label: '2. Сдвоенная коробка и радиаторы' },
    { key: 'leftBarrelGroup', label: '3. Левый откатной ствол' },
    { key: 'rightBarrelGroup', label: '4. Правый откатной ствол' },
  ],
  cameras: {
    module: { pos: [2.4, 0.65, 2.7], target: [0, -0.32, 0.95] },
  },
  rangeMarkers: [],
  controls: 'aa',
};

const AA_HZ = 18.0;
const AA_TRAVEL = 0.048;
const AA_BASE_Z = 0.45;

/**
 * Процедурная генерация текстуры предупреждающей полосы (жёлто-чёрная диагональная разметка УСП)
 * @returns {THREE.CanvasTexture}
 */
function createHazardStripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Базовый промышленный жёлтый фон
  ctx.fillStyle = '#d99e16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Диагональные чёрные полосы
  ctx.fillStyle = '#1b1d20';
  const stripeWidth = 36;
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += stripeWidth * 2) {
    ctx.beginPath();
    ctx.moveTo(x, canvas.height);
    ctx.lineTo(x + stripeWidth, canvas.height);
    ctx.lineTo(x + stripeWidth + canvas.height, 0);
    ctx.lineTo(x + canvas.height, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Тёмная металлическая окантовка по краям таблички
  ctx.strokeStyle = '#25282c';
  ctx.lineWidth = 14;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  // Трафаретная плашка с маркировкой
  ctx.fillStyle = 'rgba(24, 26, 29, 0.92)';
  ctx.fillRect(156, 36, 200, 56);
  ctx.strokeStyle = '#d99e16';
  ctx.lineWidth = 3;
  ctx.strokeRect(156, 36, 200, 56);

  ctx.fillStyle = '#e5b22b';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('2А38М // УСП', 256, 65);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Вспомогательная функция: создание экструдированного профиля со снятыми фасками вдоль оси Z
 */
function createChamferedBoxGeometry(width, height, depth, chamfer = 0.025) {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const c = Math.min(chamfer, hw * 0.4, hh * 0.4);

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

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    steps: 1
  });
  geom.translate(0, 0, -depth * 0.5);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Создаёт процедурную 3D-модель спаренного 30-мм зенитного автомата 2А38М «Ливень»
 * Единицы измерения: 1 unit = 1 метр. Общая длина: ~3.20 м (от z = -0.65 до z = +2.55).
 * Ориентация: стволы вдоль +Z, верх +Y, бок ±X.
 * Точка привязки (0, 0, 0): центр верхнего фланца УСП.
 *
 * @returns {THREE.Group}
 */
export function createWeapon2A38MLiven() {
  const root = new THREE.Group();
  root.name = 'Weapon2A38MLiven';

  // --- PBR Материалы по спецификации ---
  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0x62686e,
    metalness: 0.50,
    roughness: 0.60
  });

  const barrelMaterial = new THREE.MeshStandardMaterial({
    color: 0x23262a,
    metalness: 0.88,
    roughness: 0.30
  });

  const graphiteMaterial = new THREE.MeshStandardMaterial({
    color: 0x32363b,
    metalness: 0.70,
    roughness: 0.45
  });

  const hazardTexture = createHazardStripeTexture();
  const hazardMaterial = new THREE.MeshStandardMaterial({
    map: hazardTexture,
    metalness: 0.35,
    roughness: 0.55
  });

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Основная стальная плита УСП: 0.58 x 0.14 x 0.90 м (верхняя плоскость ровно на y = 0)
  const flangePlateGeom = new THREE.BoxGeometry(0.58, 0.14, 0.90);
  const flangePlate = new THREE.Mesh(flangePlateGeom, hullMaterial);
  flangePlate.position.set(0, -0.07, 0);
  mountFlange.add(flangePlate);

  // Верхняя привалочная рамка и направляющий шип УСП
  const topRim = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.012, 0.78),
    graphiteMaterial
  );
  topRim.position.set(0, 0.004, 0);
  mountFlange.add(topRim);

  const centerAlignmentPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.038, 0.028, 16),
    barrelMaterial
  );
  centerAlignmentPin.position.set(0, 0.014, 0.18);
  mountFlange.add(centerAlignmentPin);

  // Разъём электроспуска и датчиков УСП
  const umbilicalConnector = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.026, 0.11),
    graphiteMaterial
  );
  umbilicalConnector.position.set(-0.14, 0.013, -0.22);
  mountFlange.add(umbilicalConnector);

  // Боковые пластины с предупреждающей полосой (CanvasTexture)
  const sideHazardGeom = new THREE.PlaneGeometry(0.86, 0.095);
  [-1, 1].forEach((side) => {
    const hazardStrip = new THREE.Mesh(sideHazardGeom, hazardMaterial);
    hazardStrip.position.set(side * 0.291, -0.07, 0);
    hazardStrip.rotation.y = side * (Math.PI * 0.5);
    mountFlange.add(hazardStrip);
  });

  // Замки УСП по углам плиты (4 силовых узла фиксации)
  const lockPositions = [
    [-0.255, -0.35],
    [0.255, -0.35],
    [-0.255, 0.35],
    [0.255, 0.35]
  ];

  lockPositions.forEach(([lx, lz]) => {
    const lockUnit = new THREE.Group();
    lockUnit.position.set(lx, -0.07, lz);

    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.155, 0.11),
      graphiteMaterial
    );
    lockUnit.add(housing);

    const lockPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.175, 16),
      barrelMaterial
    );
    lockUnit.add(lockPin);

    const latchLever = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.03, 0.14),
      barrelMaterial
    );
    latchLever.position.set(Math.sign(lx) * 0.042, -0.02, 0);
    lockUnit.add(latchLever);

    mountFlange.add(lockUnit);
  });

  // Силовые косынки и подвес под плитой УСП, соединяющие фланец со ствольной коробкой
  [-0.28, 0.0, 0.28].forEach((rz) => {
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.50, 0.07, 0.045),
      graphiteMaterial
    );
    rib.position.set(0, -0.17, rz);
    mountFlange.add(rib);
  });

  // =========================================================================
  // 2. СДВОЕННАЯ СТВОЛЬНАЯ КОРОБКА И РАДИАТОРЫ (twinReceiver)
  // =========================================================================
  const twinReceiver = new THREE.Group();
  twinReceiver.name = 'twinReceiver';
  root.add(twinReceiver);

  const barrelY = -0.34;
  const barrelHalfSpacing = 0.16;

  // Основной угловатый бронекожух сдвоенной ствольной коробки (z: -0.56 .. +0.66)
  const mainBodyGeom = createChamferedBoxGeometry(0.54, 0.32, 1.20, 0.04);
  const mainBody = new THREE.Mesh(mainBodyGeom, hullMaterial);
  mainBody.position.set(0, barrelY, 0.05);
  twinReceiver.add(mainBody);

  // Верхняя усиленная крышка затворной группы с ребрами жёсткости
  const topCoverGeom = createChamferedBoxGeometry(0.44, 0.07, 1.06, 0.02);
  const topCover = new THREE.Mesh(topCoverGeom, hullMaterial);
  topCover.position.set(0, -0.17, 0.04);
  twinReceiver.add(topCover);

  for (let i = 0; i < 6; i++) {
    const stiffener = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.022, 0.03),
      graphiteMaterial
    );
    stiffener.position.set(0, -0.145, -0.38 + i * 0.165);
    twinReceiver.add(stiffener);
  }

  // Передний броневой щиток казённой части и гильзоотводы
  const frontBulkhead = new THREE.Mesh(
    createChamferedBoxGeometry(0.56, 0.34, 0.09, 0.035),
    graphiteMaterial
  );
  frontBulkhead.position.set(0, barrelY, 0.66);
  twinReceiver.add(frontBulkhead);

  // Задние гидробуферы / демпферы отката обоих стволов (доводят габарит назад до z = -0.65)
  [-barrelHalfSpacing, barrelHalfSpacing].forEach((bx) => {
    const bufferGroup = new THREE.Group();
    bufferGroup.position.set(bx, barrelY, -0.58);

    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.078, 0.14, 20),
      graphiteMaterial
    );
    cylinder.rotation.x = Math.PI * 0.5;
    bufferGroup.add(cylinder);

    const endCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.068, 0.04, 20),
      barrelMaterial
    );
    endCap.rotation.x = Math.PI * 0.5;
    endCap.position.z = -0.07; // Крайняя задняя точка: -0.58 - 0.07 = -0.65 м
    bufferGroup.add(endCap);

    twinReceiver.add(bufferGroup);
  });

  // Мощные ребристые радиаторы водяного/воздушного охлаждения по бокам
  [-1, 1].forEach((side) => {
    const radiatorPod = new THREE.Group();
    radiatorPod.position.set(side * 0.315, barrelY + 0.01, 0.10);

    // Несущий короб теплообменника
    const coreBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.23, 0.86),
      graphiteMaterial
    );
    radiatorPod.add(coreBox);

    // Верхний и нижний коллекторы охлаждающей жидкости
    [-0.115, 0.115].forEach((cy) => {
      const manifold = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.90, 14),
        hullMaterial
      );
      manifold.rotation.x = Math.PI * 0.5;
      manifold.position.set(side * 0.01, cy, 0);
      radiatorPod.add(manifold);
    });

    // Плотный пакет вертикальных рёбер охлаждения (32 пластины на борт)
    const finCount = 32;
    const finSpan = 0.82;
    const finGeom = new THREE.BoxGeometry(0.045, 0.21, 0.008);
    for (let f = 0; f < finCount; f++) {
      const fin = new THREE.Mesh(finGeom, graphiteMaterial);
      const fz = -finSpan * 0.5 + (f / (finCount - 1)) * finSpan;
      fin.position.set(side * 0.032, 0, fz);
      radiatorPod.add(fin);
    }

    // Защитные ограждающие прутья радиатора
    [-0.06, 0.06].forEach((gy) => {
      const guardBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.88, 8),
        barrelMaterial
      );
      guardBar.rotation.x = Math.PI * 0.5;
      guardBar.position.set(side * 0.06, gy, 0);
      radiatorPod.add(guardBar);
    });

    // Патрубок подачи охлаждающей жидкости от радиатора к кожуху ствола
    const coolantPipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.32, barrelY + 0.11, 0.52),
      new THREE.Vector3(side * 0.27, barrelY + 0.11, 0.68),
      new THREE.Vector3(side * barrelHalfSpacing, barrelY + 0.075, 0.74)
    ]);
    const coolantPipe = new THREE.Mesh(
      new THREE.TubeGeometry(coolantPipeCurve, 16, 0.016, 10, false),
      graphiteMaterial
    );
    twinReceiver.add(coolantPipe);

    twinReceiver.add(radiatorPod);
  });

  // Массивный электропривод перезарядки (на левом верхне-боковом фланце коробки)
  const reloadDrive = new THREE.Group();
  reloadDrive.position.set(-0.24, -0.20, -0.24);

  const motorHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.068, 0.34, 20),
    graphiteMaterial
  );
  motorHousing.rotation.x = Math.PI * 0.5;
  reloadDrive.add(motorHousing);

  // Рёбра охлаждения корпуса электродвигателя
  for (let r = 0; r < 10; r++) {
    const motorRib = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.01, 20),
      barrelMaterial
    );
    motorRib.rotation.x = Math.PI * 0.5;
    motorRib.position.z = -0.12 + r * 0.026;
    reloadDrive.add(motorRib);
  }

  // Редуктор электропривода перезарядки
  const gearbox = new THREE.Mesh(
    createChamferedBoxGeometry(0.14, 0.15, 0.14, 0.02),
    hullMaterial
  );
  gearbox.position.set(0.03, -0.01, 0.20);
  reloadDrive.add(gearbox);

  // Бронированный силовой кабель питания электропривода
  const powerCableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.24, -0.14, -0.38),
    new THREE.Vector3(-0.21, -0.10, -0.45),
    new THREE.Vector3(-0.14, -0.04, -0.34)
  ]);
  const powerCable = new THREE.Mesh(
    new THREE.TubeGeometry(powerCableCurve, 16, 0.014, 10, false),
    barrelMaterial
  );
  twinReceiver.add(powerCable);
  twinReceiver.add(reloadDrive);

  // Два гибких рукава подачи боеприпасов снизу (TubeGeometry)
  [-1, 1].forEach((side) => {
    const startX = side * 0.145;
    const chuteCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(startX, -0.49, 0.14),
      new THREE.Vector3(startX + side * 0.02, -0.64, 0.06),
      new THREE.Vector3(startX + side * 0.03, -0.78, -0.16),
      new THREE.Vector3(startX, -0.85, -0.44)
    ]);

    // Основной гибкий гофрорукав
    const chuteTube = new THREE.Mesh(
      new THREE.TubeGeometry(chuteCurve, 32, 0.056, 14, false),
      graphiteMaterial
    );
    twinReceiver.add(chuteTube);

    // Металлические звеньевые кольца жёсткости вдоль рукава
    const ringCount = 14;
    const ringGeom = new THREE.TorusGeometry(0.059, 0.007, 8, 18);
    const up = new THREE.Vector3(0, 0, 1);

    for (let k = 1; k < ringCount; k++) {
      const t = k / ringCount;
      const pt = chuteCurve.getPointAt(t);
      const tangent = chuteCurve.getTangentAt(t).normalize();

      const ring = new THREE.Mesh(ringGeom, hullMaterial);
      ring.position.copy(pt);
      ring.quaternion.setFromUnitVectors(up, tangent);
      twinReceiver.add(ring);
    }

    // Приёмная горловина в днище ствольной коробки
    const feedCollar = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.05, 0.18),
      hullMaterial
    );
    feedCollar.position.set(startX, -0.495, 0.14);
    twinReceiver.add(feedCollar);
  });

  // Нижняя силовая балка и мостик-демпфер колебаний стволов (z = 1.34)
  const underBoom = new THREE.Mesh(
    createChamferedBoxGeometry(0.24, 0.075, 0.72, 0.018),
    hullMaterial
  );
  underBoom.position.set(0, barrelY - 0.105, 0.99);
  twinReceiver.add(underBoom);

  const damperBridge = new THREE.Group();
  damperBridge.position.set(0, barrelY, 1.34);

  // Поперечная силовая траверса мостика-демпфера
  const bridgeCrossbar = new THREE.Mesh(
    createChamferedBoxGeometry(0.45, 0.085, 0.11, 0.02),
    hullMaterial
  );
  damperBridge.add(bridgeCrossbar);

  // Скользящие демпфирующие втулки, сквозь которые откатываются оба ствола
  [-barrelHalfSpacing, barrelHalfSpacing].forEach((bx) => {
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.13, 24),
      graphiteMaterial
    );
    sleeve.rotation.x = Math.PI * 0.5;
    sleeve.position.set(bx, 0, 0);
    damperBridge.add(sleeve);

    const clampRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.025, 24),
      barrelMaterial
    );
    clampRing.rotation.x = Math.PI * 0.5;
    clampRing.position.set(bx, 0, 0.045);
    damperBridge.add(clampRing);
  });

  // Центральный амортизатор колебаний между стволами
  const centerDamper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 0.15, 16),
    barrelMaterial
  );
  centerDamper.rotation.x = Math.PI * 0.5;
  damperBridge.add(centerDamper);

  twinReceiver.add(damperBridge);

  // =========================================================================
  // 3. ЛЕВЫЙ И ПРАВЫЙ ОТКАТНЫЕ СТВОЛЫ (leftBarrelGroup, rightBarrelGroup)
  // =========================================================================
  /**
   * Конструктор одного откатного 30-мм ствольного блока длиной 2.10 м
   * (от z_local = 0.00 в казённике z = 0.45 до среза пламегасителя z_world = 2.55 м)
   */
  function buildRecoilingBarrelAssembly(groupName, xPos) {
    const barrelGroup = new THREE.Group();
    barrelGroup.name = groupName;
    barrelGroup.position.set(xPos, barrelY, 0.45);

    // 3.1. Кожух жидкостного охлаждения казённой части (z_local: 0.00 .. 0.68)
    const jacketGeom = new THREE.CylinderGeometry(0.064, 0.068, 0.68, 24);
    jacketGeom.rotateX(Math.PI * 0.5);
    const jacket = new THREE.Mesh(jacketGeom, hullMaterial);
    jacket.position.z = 0.34;
    barrelGroup.add(jacket);

    // Сальниковые уплотнительные муфты кожуха охлаждения
    [0.24, 0.66].forEach((cz) => {
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.073, 0.073, 0.038, 24),
        graphiteMaterial
      );
      collar.rotation.x = Math.PI * 0.5;
      collar.position.z = cz;
      barrelGroup.add(collar);
    });

    // 3.2. Основной нарезной 30-мм ствол (LatheGeometry, z_local: 0.68 .. 1.86)
    const barrelProfile = [
      new THREE.Vector2(0.015, 0.68),
      new THREE.Vector2(0.048, 0.68),
      new THREE.Vector2(0.044, 1.15),
      new THREE.Vector2(0.039, 1.18),
      new THREE.Vector2(0.035, 1.65),
      new THREE.Vector2(0.032, 1.86),
      new THREE.Vector2(0.015, 1.86)
    ];
    const barrelTubeGeom = new THREE.LatheGeometry(barrelProfile, 28);
    barrelTubeGeom.rotateX(Math.PI * 0.5);
    const barrelTube = new THREE.Mesh(barrelTubeGeom, barrelMaterial);
    barrelGroup.add(barrelTube);

    // 3.3. Продольные рёбра охлаждения вдоль ствола (8 радиальных рёбер)
    const ribCount = 8;
    const ribLength = 1.08;
    const ribCenterZ = 1.24;
    const ribGeom = new THREE.BoxGeometry(0.007, 0.018, ribLength);

    for (let i = 0; i < ribCount; i++) {
      const angle = (i / ribCount) * Math.PI * 2;
      const rib = new THREE.Mesh(ribGeom, graphiteMaterial);
      const radius = 0.043;
      rib.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        ribCenterZ
      );
      rib.rotation.z = angle + Math.PI * 0.5;
      barrelGroup.add(rib);
    }

    // Стяжные бандажные кольца продольных рёбер
    [0.72, 1.32, 1.76].forEach((bz) => {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.052, 0.022, 24),
        graphiteMaterial
      );
      band.rotation.x = Math.PI * 0.5;
      band.position.z = bz;
      barrelGroup.add(band);
    });

    // 3.4. Конический пламегаситель на дульном срезе (z_local: 1.86 .. 2.10 -> z_world = 2.55)
    const flashHiderGroup = new THREE.Group();
    flashHiderGroup.position.z = 1.86;

    // Контр-гайка крепления пламегасителя
    const lockNut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.041, 0.041, 0.032, 8),
      graphiteMaterial
    );
    lockNut.rotation.x = Math.PI * 0.5;
    lockNut.position.z = 0.016;
    flashHiderGroup.add(lockNut);

    // Конический раструб пламегасителя (полый профиль LatheGeometry)
    const coneProfile = [
      new THREE.Vector2(0.016, 0.03),
      new THREE.Vector2(0.034, 0.03),
      new THREE.Vector2(0.054, 0.235),
      new THREE.Vector2(0.054, 0.24), // Торец ровно на +0.24 => z_world = 0.45 + 1.86 + 0.24 = 2.55 м
      new THREE.Vector2(0.047, 0.24),
      new THREE.Vector2(0.018, 0.05)
    ];
    const coneGeom = new THREE.LatheGeometry(coneProfile, 28);
    coneGeom.rotateX(Math.PI * 0.5);
    const coneMesh = new THREE.Mesh(coneGeom, barrelMaterial);
    flashHiderGroup.add(coneMesh);

    // Продольные силовые долы/щёки на конусе пламегасителя
    for (let f = 0; f < 6; f++) {
      const angle = (f / 6) * Math.PI * 2;
      const flute = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, 0.014, 0.17),
        graphiteMaterial
      );
      const rMid = 0.044;
      flute.position.set(
        Math.cos(angle) * rMid,
        Math.sin(angle) * rMid,
        0.135
      );
      flute.rotation.z = angle + Math.PI * 0.5;
      flute.rotateX(-0.095);
      flashHiderGroup.add(flute);
    }

    barrelGroup.add(flashHiderGroup);
    return barrelGroup;
  }

  const leftBarrelGroup = buildRecoilingBarrelAssembly('leftBarrelGroup', -barrelHalfSpacing);
  const rightBarrelGroup = buildRecoilingBarrelAssembly('rightBarrelGroup', barrelHalfSpacing);

  root.add(leftBarrelGroup);
  root.add(rightBarrelGroup);

  // Включаем тени для всех мешей модели
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  // Сохраняем удобные ссылки в userData для анимации
  root.userData.mountFlange = mountFlange;
  root.userData.twinReceiver = twinReceiver;
  root.userData.leftBarrelGroup = leftBarrelGroup;
  root.userData.rightBarrelGroup = rightBarrelGroup;

  return root;
}

// ===========================================================================
// ТЕСТОВАЯ СЦЕНА (автономный стенд; во вьювере не вызывается —
// движок index.html сам ставит свет, пол и анимацию очереди).
// ===========================================================================
function initTestScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16191d);
  scene.fog = new THREE.FogExp2(0x16191d, 0.055);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 50);
  camera.position.set(2.4, 0.65, 2.7);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, -0.32, 0.95);
  controls.update();

  // Освещение (индустриальный ангар / полигон)
  const hemiLight = new THREE.HemisphereLight(0xdce6f2, 0x2b3036, 0.85);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff6ea, 2.4);
  keyLight.position.set(3.5, 4.5, 4.0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 15;
  keyLight.shadow.camera.left = -3.5;
  keyLight.shadow.camera.right = 3.5;
  keyLight.shadow.camera.top = 3.5;
  keyLight.shadow.camera.bottom = -3.5;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x7aa2d4, 1.1);
  rimLight.position.set(-3.0, -1.5, -2.5);
  scene.add(rimLight);

  // Координатная сетка и маркер точки привязки УСП (0, 0, 0)
  const gridHelper = new THREE.GridHelper(10, 20, 0x3b424a, 0x262b30);
  gridHelper.position.y = -1.2;
  scene.add(gridHelper);

  const axesHelper = new THREE.AxesHelper(0.35);
  scene.add(axesHelper);

  // Создаём и добавляем 2А38М «Ливень»
  const weapon = createWeapon2A38MLiven();
  scene.add(weapon);

  const { leftBarrelGroup, rightBarrelGroup } = weapon.userData;
  const baseBarrelZ = leftBarrelGroup.position.z; // 0.45 м

  // Параметры поочерёдной скорострельной отдачи (~2400 выстр/мин суммарно -> 20 Гц на ствол)
  let isFiring = true;
  const cycleHz = 18.0; // Частота выстрелов на каждый ствол (Гц)
  const maxRecoilTravel = 0.048; // Ход отката ствола назад по -Z (48 мм)

  // Профиль импульса отдачи: мгновенный удар назад и экспоненциальный накат пружины
  function computeRecoilDisplacement(phase01) {
    const impulseEnd = 0.18;
    if (phase01 < impulseEnd) {
      const t = phase01 / impulseEnd;
      return -maxRecoilTravel * Math.sin(t * Math.PI * 0.5);
    }
    const recoveryT = (phase01 - impulseEnd) / (1.0 - impulseEnd);
    return -maxRecoilTravel * Math.pow(1.0 - recoveryT, 2.2);
  }

  // Переключение огня по клавише Space
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      isFiring = !isFiring;
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    if (isFiring) {
      // Левый и правый стволы работают строго в противофазе (сдвиг 0.5 периода)
      const leftPhase = (elapsed * cycleHz) % 1.0;
      const rightPhase = (elapsed * cycleHz + 0.5) % 1.0;

      leftBarrelGroup.position.z = baseBarrelZ + computeRecoilDisplacement(leftPhase);
      rightBarrelGroup.position.z = baseBarrelZ + computeRecoilDisplacement(rightPhase);

      // Микровибрация лафета при стрельбе
      weapon.position.z = Math.sin(elapsed * cycleHz * Math.PI * 4) * 0.0015;
    } else {
      leftBarrelGroup.position.z = THREE.MathUtils.lerp(leftBarrelGroup.position.z, baseBarrelZ, 0.25);
      rightBarrelGroup.position.z = THREE.MathUtils.lerp(rightBarrelGroup.position.z, baseBarrelZ, 0.25);
      weapon.position.z = THREE.MathUtils.lerp(weapon.position.z, 0, 0.25);
    }

    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

// initTestScene(); // Автономный стенд: раскомментировать только вне просмотрщика.

// =========================================================================
// Адаптер под единый просмотрщик: спаренная противофазная отдача 18 Гц.
// applyAA(phase, firing, t): левый и правый стволы со сдвигом 0.5 периода.
// =========================================================================
export function createWeapon() {
  const root = createWeapon2A38MLiven();
  const ud = root.userData;
  const left = root.getObjectByName('leftBarrelGroup');
  const right = root.getObjectByName('rightBarrelGroup');

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  const recoilDisp = (phase01) => {
    const impulseEnd = 0.18;
    if (phase01 < impulseEnd) {
      const t = phase01 / impulseEnd;
      return -AA_TRAVEL * Math.sin(t * Math.PI * 0.5);
    }
    const recoveryT = (phase01 - impulseEnd) / (1.0 - impulseEnd);
    return -AA_TRAVEL * Math.pow(1.0 - recoveryT, 2.2);
  };

  ud.leftBarrel = left;
  ud.rightBarrel = right;
  ud.applyAA = (phase, firing, t) => {
    const lp = ((phase % 1) + 1) % 1;
    const rp = (lp + 0.5) % 1;
    left.position.z = AA_BASE_Z + recoilDisp(lp);
    right.position.z = AA_BASE_Z + recoilDisp(rp);
    root.position.z = firing ? Math.sin(t * AA_HZ * Math.PI * 4) * 0.0015 : 0;
  };
  ud.setExtension = (phase) => {
    const p = Math.max(0, Math.min(1, phase));
    ud.applyAA(p, false, 0);
    return p;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
