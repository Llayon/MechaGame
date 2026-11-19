import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'rpb12',
  code: 'РПБ-12',
  title: 'РПБ-12 «Грань»',
  subtitle: 'НАРУЧНЫЙ РЕАКТИВНЫЙ ВИБРОКЛИНОК • УСП-AUX • ХОД 0.75 М',
  description: 'Наручный реактивный виброклинок: стыковочный узел УСП, бронированный отбойник с высокочастотным виброгенератором (190 Гц), П-образная направляющая кассета и выдвижное полотно с серрейтором, полированной кромкой и двумя микро-ТТД у основания.',
  specs: [
    ['Ход клинка', '0.75 м'],
    ['Слот', 'УСП-AUX'],
    ['Подача', 'Гидроцилиндр подачи'],
    ['Вибрация', '190 Гц в рабочей зоне'],
    ['Ускорители', '2 микро-ТТД'],
    ['Обух', 'Серрейтор, 8 зубьев'],
  ],
  maxExtension: 0.75,
  unit: 'mm',
  tipOffset: 1.75,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел (УСП)' },
    { key: 'armShieldGuard', label: '2. Отбойник и вибропривод' },
    { key: 'bladeHousing', label: '3. Направляющая кассета' },
    { key: 'vibratingBlade', label: '4. Выдвижной виброклинок' },
  ],
  cameras: {
    module: { pos: [1.65, 0.55, 1.85], target: [0, -0.18, 0.65] },
  },
  rangeMarkers: [],
  controls: 'blade',
};

const BLADE_STROKE = 0.75;
const BLADE_BASE_Y = -0.222;

/**
 * Процедурная генерация текстуры предупреждающей жёлто-чёрной маркировки
 */
function createHazardStripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Промышленный жёлтый фон
  ctx.fillStyle = '#cfa019';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Диагональные чёрные полосы
  ctx.fillStyle = '#1b1d1f';
  const stripeWidth = 36;
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += stripeWidth * 2) {
    ctx.beginPath();
    ctx.moveTo(x, canvas.height);
    ctx.lineTo(x + canvas.height, 0);
    ctx.lineTo(x + canvas.height + stripeWidth, 0);
    ctx.lineTo(x + stripeWidth, canvas.height);
    ctx.closePath();
    ctx.fill();
  }

  // Лёгкий индустриальный износ и рамка
  ctx.strokeStyle = '#141618';
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(30, 32, 30, 0.18)';
  for (let i = 0; i < 180; i++) {
    ctx.fillRect(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      Math.random() * 14 + 2,
      Math.random() * 4 + 1
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Процедурная трафаретная маркировка «РПБ-12» для кожуха направляющей
 */
function createStencilLabelTexture(label = 'РПБ-12', subLabel = 'УСП-AUX // ГРАНЬ') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Основной трафаретный шрифт
  ctx.fillStyle = 'rgba(224, 228, 220, 0.86)';
  ctx.font = 'bold 58px "Courier New", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 28, 52);

  // Дополнительный технический индекс
  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.fillStyle = 'rgba(205, 210, 200, 0.72)';
  ctx.fillText(subLabel, 30, 98);

  // Трафаретные перемычки и тактические риски
  ctx.fillStyle = 'rgba(224, 228, 220, 0.78)';
  ctx.fillRect(360, 26, 8, 76);
  ctx.fillRect(376, 26, 22, 76);
  ctx.fillRect(406, 26, 6, 76);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Создаёт процедурную 3D-модель наручного реактивного виброклинка РПБ-12 «Грань»
 * Масштаб: 1 unit = 1 метр | Выдвижение: +Z | Верх: +Y | Точка привязки (0,0,0): центр фланца УСП
 * @returns {THREE.Group}
 */
export function createWeaponRPB12Gran() {
  const root = new THREE.Group();
  root.name = 'RPB12_Gran';

  // --- PBR МАТЕРИАЛЫ ---
  const oliveArmorMat = new THREE.MeshStandardMaterial({
    color: 0x4b5346,
    metalness: 0.45,
    roughness: 0.65,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x282c30,
    metalness: 0.80,
    roughness: 0.40,
  });

  const polishedSteelMat = new THREE.MeshStandardMaterial({
    color: 0xc2c9d1,
    metalness: 0.92,
    roughness: 0.22,
  });

  const copperWindingMat = new THREE.MeshStandardMaterial({
    color: 0x9c6b3b,
    metalness: 0.85,
    roughness: 0.35,
  });

  const hazardMat = new THREE.MeshStandardMaterial({
    map: createHazardStripeTexture(),
    metalness: 0.30,
    roughness: 0.60,
  });

  const stencilMat = new THREE.MeshStandardMaterial({
    map: createStencilLabelTexture('РПБ-12', 'УСП-AUX // ГРАНЬ'),
    transparent: true,
    roughness: 0.70,
    metalness: 0.20,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  // Списки трансформаций для инстансированных болтов и заклёпок
  const staticBoltMatrices = [];
  const bladeBoltMatrices = [];
  const dummy = new THREE.Object3D();

  const registerBolt = (targetList, x, y, z, rx = 0, ry = 0, rz = 0, scale = 1) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    targetList.push(dummy.matrix.clone());
  };

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Плита фланца 0.35 x 0.10 x 0.55 м со скошенными фасками
  const fW = 0.35;
  const fH = 0.10;
  const fL = 0.55;
  const chamfer = 0.032;
  const bevel = 0.012;

  const flangeShape = new THREE.Shape();
  const hw = fW / 2 - bevel;
  const hl = fL / 2 - bevel;
  flangeShape.moveTo(-hw + chamfer, -hl);
  flangeShape.lineTo(hw - chamfer, -hl);
  flangeShape.lineTo(hw, -hl + chamfer);
  flangeShape.lineTo(hw, hl - chamfer);
  flangeShape.lineTo(hw - chamfer, hl);
  flangeShape.lineTo(-hw + chamfer, hl);
  flangeShape.lineTo(-hw, hl - chamfer);
  flangeShape.lineTo(-hw, -hl + chamfer);
  flangeShape.closePath();

  const flangeCoreDepth = fH - bevel * 2;
  const flangeGeo = new THREE.ExtrudeGeometry(flangeShape, {
    depth: flangeCoreDepth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  flangeGeo.translate(0, 0, -flangeCoreDepth / 2);
  flangeGeo.rotateX(-Math.PI / 2);

  const flangePlate = new THREE.Mesh(flangeGeo, oliveArmorMat);
  mountFlange.add(flangePlate);

  // Верхние направляющие полозья УСП и центральный силовой разъём
  const railGeo = new THREE.BoxGeometry(0.036, 0.016, 0.48);
  [-0.085, 0.085].forEach((rx) => {
    const rail = new THREE.Mesh(railGeo, darkSteelMat);
    rail.position.set(rx, fH / 2 + 0.008, 0);
    mountFlange.add(rail);
  });

  const connectorBase = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 0.12), darkSteelMat);
  connectorBase.position.set(0, fH / 2 + 0.011, -0.04);
  mountFlange.add(connectorBase);

  // 4 цилиндрических гидравлических замка по углам
  const lockBodyGeo = new THREE.CylinderGeometry(0.024, 0.026, 0.116, 16);
  const lockCollarGeo = new THREE.CylinderGeometry(0.029, 0.029, 0.024, 16);
  const lockPinGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.132, 12);

  const lockOffsets = [
    [-0.132, -0.222],
    [0.132, -0.222],
    [-0.132, 0.222],
    [0.132, 0.222],
  ];
  lockOffsets.forEach(([lx, lz]) => {
    const lockGroup = new THREE.Group();
    lockGroup.position.set(lx, 0, lz);

    const body = new THREE.Mesh(lockBodyGeo, darkSteelMat);
    const collar = new THREE.Mesh(lockCollarGeo, oliveArmorMat);
    collar.position.y = 0.022;
    const pin = new THREE.Mesh(lockPinGeo, polishedSteelMat);

    lockGroup.add(body, collar, pin);
    mountFlange.add(lockGroup);
  });

  // Жёлто-чёрные полосатые предупреждающие накладки по бокам фланца
  const hazardPlateGeo = new THREE.BoxGeometry(0.006, 0.052, 0.36);
  [-1, 1].forEach((side) => {
    const strip = new THREE.Mesh(hazardPlateGeo, hazardMat);
    strip.position.set(side * (fW / 2 + 0.002), 0, 0);
    mountFlange.add(strip);
  });

  // Болты крепления на фланце
  for (let z = -0.18; z <= 0.18; z += 0.09) {
    registerBolt(staticBoltMatrices, -0.135, fH / 2 + 0.002, z, 0, 0, 0, 1.0);
    registerBolt(staticBoltMatrices, 0.135, fH / 2 + 0.002, z, 0, 0, 0, 1.0);
  }

  // =========================================================================
  // 2. ЗАЩИТНЫЙ ОТБОЙНИК И ВИБРОПРИВОД (armShieldGuard)
  // =========================================================================
  const armShieldGuard = new THREE.Group();
  armShieldGuard.name = 'armShieldGuard';
  root.add(armShieldGuard);

  // Скошенный бронированный кожух-отбойник под фланцем (центр около y = -0.22, z = -0.05)
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(-0.24, -0.05);  // Верхний тыльный край под фланцем
  shieldShape.lineTo(0.22, -0.05);   // Верхний передний край под фланцем
  shieldShape.lineTo(0.26, -0.14);   // Переход к направляющей кассете
  shieldShape.lineTo(0.26, -0.30);   // Передний нижний срез
  shieldShape.lineTo(-0.14, -0.35);  // Нижняя бронеплита отбойника
  shieldShape.lineTo(-0.29, -0.24);  // Скошенный тыльный таранный отбойник
  shieldShape.closePath();

  const shieldWidth = 0.25;
  const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, {
    depth: shieldWidth,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  shieldGeo.translate(0, 0, -shieldWidth / 2);
  shieldGeo.rotateY(-Math.PI / 2); // X формы -> +Z мира

  const shieldMain = new THREE.Mesh(shieldGeo, oliveArmorMat);
  armShieldGuard.add(shieldMain);

  // Боковые усиленные бронещёки отбойника
  const cheekGeo = new THREE.BoxGeometry(0.022, 0.17, 0.34);
  [-0.142, 0.142].forEach((cx) => {
    const cheek = new THREE.Mesh(cheekGeo, darkSteelMat);
    cheek.position.set(cx, -0.21, -0.03);
    cheek.rotation.x = 0.12;
    armShieldGuard.add(cheek);

    // Заклёпки по периметру бронещёк
    for (let bz = -0.16; bz <= 0.10; bz += 0.065) {
      registerBolt(
        staticBoltMatrices,
        cx + Math.sign(cx) * 0.012,
        -0.15 + bz * -0.12,
        bz,
        0,
        0,
        -Math.sign(cx) * (Math.PI / 2),
        1.1
      );
      registerBolt(
        staticBoltMatrices,
        cx + Math.sign(cx) * 0.012,
        -0.27 + bz * -0.12,
        bz,
        0,
        0,
        -Math.sign(cx) * (Math.PI / 2),
        1.1
      );
    }
  });

  // Открытый высокочастотный виброгенератор на правой боковой грани (+X)
  const vibroUnit = new THREE.Group();
  vibroUnit.name = 'vibroActuator';
  vibroUnit.position.set(0.185, -0.205, 0.01);
  armShieldGuard.add(vibroUnit);

  // Кронштейны крепления вибропривода к корпусу
  const bracketGeo = new THREE.BoxGeometry(0.065, 0.085, 0.032);
  [-0.10, 0.10].forEach((bz) => {
    const bracket = new THREE.Mesh(bracketGeo, darkSteelMat);
    bracket.position.set(-0.02, 0, bz);
    vibroUnit.add(bracket);
  });

  // Силовой корпус и сердечник электромагнитного привода (ориентирован вдоль Z)
  const coreShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.30, 18).rotateX(Math.PI / 2),
    polishedSteelMat
  );
  vibroUnit.add(coreShaft);

  // Медная электромагнитная обмотка
  const copperCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.13, 24).rotateX(Math.PI / 2),
    copperWindingMat
  );
  copperCore.position.z = -0.025;
  vibroUnit.add(copperCore);

  // Витки медной обмотки для рельефных бликов
  const coilRingGeo = new THREE.TorusGeometry(0.0425, 0.0032, 8, 24);
  for (let wz = -0.082; wz <= 0.032; wz += 0.0085) {
    const turn = new THREE.Mesh(coilRingGeo, copperWindingMat);
    turn.position.z = wz;
    vibroUnit.add(turn);
  }

  // Ребристый радиатор охлаждения в передней части виброгенератора
  const finGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.0045, 22).rotateX(Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    const fin = new THREE.Mesh(finGeo, darkSteelMat);
    fin.position.z = 0.052 + i * 0.011;
    vibroUnit.add(fin);
  }

  // Торцевые крышки и ударный волновод вибропривода, уходящий в направляющую кассету
  const rearCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.042, 0.028, 20).rotateX(Math.PI / 2),
    darkSteelMat
  );
  rearCap.position.z = -0.105;
  vibroUnit.add(rearCap);

  const waveguideCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0.145),
    new THREE.Vector3(-0.025, -0.005, 0.195),
    new THREE.Vector3(-0.105, -0.015, 0.235),
  ]);
  const waveguide = new THREE.Mesh(
    new THREE.TubeGeometry(waveguideCurve, 14, 0.014, 12, false),
    polishedSteelMat
  );
  vibroUnit.add(waveguide);

  // Две тонкие трубки гидромагистрали (от коллектора фланца к виброприводу и вперёд)
  const hydroCurve1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.125, -0.045, -0.10),
    new THREE.Vector3(0.175, -0.095, -0.11),
    new THREE.Vector3(0.195, -0.165, -0.095),
  ]);
  const hydroCurve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.125, -0.045, -0.065),
    new THREE.Vector3(0.178, -0.088, -0.065),
    new THREE.Vector3(0.205, -0.155, -0.025),
    new THREE.Vector3(0.165, -0.165, 0.16),
    new THREE.Vector3(0.085, -0.165, 0.22),
  ]);

  [hydroCurve1, hydroCurve2].forEach((curve) => {
    const pipe = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 22, 0.0055, 8, false),
      darkSteelMat
    );
    armShieldGuard.add(pipe);
  });

  // =========================================================================
  // 3. НАПРАВЛЯЮЩАЯ КАССЕТА (bladeHousing)
  // =========================================================================
  const bladeHousing = new THREE.Group();
  bladeHousing.name = 'bladeHousing';
  root.add(bladeHousing);

  // П-образный стальной пенал-направляющая (от z = 0.12 до z = 0.85, центр y = -0.22)
  const hStart = 0.12;
  const hEnd = 0.85;
  const hLen = hEnd - hStart;
  const hCenterZ = (hStart + hEnd) / 2;

  // Верхняя перемычка П-образного профиля
  const topBridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.156, 0.034, hLen),
    darkSteelMat
  );
  topBridge.position.set(0, -0.145, hCenterZ);
  bladeHousing.add(topBridge);

  // Верхний защитный кожух гидроцилиндра подачи
  const cylinderShroud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.030, hLen - 0.06, 14).rotateX(Math.PI / 2),
    oliveArmorMat
  );
  cylinderShroud.position.set(0, -0.124, hCenterZ - 0.02);
  bladeHousing.add(cylinderShroud);

  // Боковые стенки П-образного пенала с вентиляционными прорезями и рёбрами жёсткости
  const sideWallGeo = new THREE.BoxGeometry(0.022, 0.142, hLen);
  const ribGeo = new THREE.BoxGeometry(0.008, 0.132, 0.024);
  const ventSlotGeo = new THREE.BoxGeometry(0.025, 0.011, 0.056);
  const ventMat = new THREE.MeshStandardMaterial({
    color: 0x0f1113,
    metalness: 0.3,
    roughness: 0.9,
  });

  [-1, 1].forEach((side) => {
    const wallX = side * 0.067;
    const wall = new THREE.Mesh(sideWallGeo, darkSteelMat);
    wall.position.set(wallX, -0.222, hCenterZ);
    bladeHousing.add(wall);

    // Вертикальные рёбра жёсткости и болты
    for (let rz = 0.24; rz <= 0.78; rz += 0.18) {
      const rib = new THREE.Mesh(ribGeo, oliveArmorMat);
      rib.position.set(wallX + side * 0.012, -0.222, rz);
      bladeHousing.add(rib);

      registerBolt(
        staticBoltMatrices,
        wallX + side * 0.016,
        -0.172,
        rz,
        0,
        0,
        -side * (Math.PI / 2),
        0.85
      );
      registerBolt(
        staticBoltMatrices,
        wallX + side * 0.016,
        -0.272,
        rz,
        0,
        0,
        -side * (Math.PI / 2),
        0.85
      );
    }

    // Вентиляционные прорези в передней зоне кассеты
    for (let vz = 0.62; vz <= 0.76; vz += 0.034) {
      const slot = new THREE.Mesh(ventSlotGeo, ventMat);
      slot.position.set(wallX + side * 0.002, -0.245, vz);
      slot.rotation.x = -0.35;
      bladeHousing.add(slot);
    }

    // Трафаретная техническая надпись «РПБ-12» сбоку кассеты
    const stencilPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.07),
      stencilMat
    );
    stencilPlane.position.set(wallX + side * 0.012, -0.205, 0.42);
    stencilPlane.rotation.y = side * (Math.PI / 2);
    bladeHousing.add(stencilPlane);
  });

  // Скребки-грязесъёмники на выходе кассеты (z = 0.85)
  const wiperGroup = new THREE.Group();
  wiperGroup.position.set(0, -0.222, hEnd);
  bladeHousing.add(wiperGroup);

  const wiperTop = new THREE.Mesh(new THREE.BoxGeometry(0.168, 0.036, 0.032), oliveArmorMat);
  wiperTop.position.set(0, 0.075, 0.008);
  wiperGroup.add(wiperTop);

  const wiperJawGeo = new THREE.BoxGeometry(0.034, 0.155, 0.036);
  const scraperLipGeo = new THREE.BoxGeometry(0.016, 0.145, 0.022);
  [-1, 1].forEach((side) => {
    const jaw = new THREE.Mesh(wiperJawGeo, oliveArmorMat);
    jaw.position.set(side * 0.068, 0, 0.008);
    wiperGroup.add(jaw);

    // Резинометаллический скребок, плотно облегающий полотно клинка
    const lip = new THREE.Mesh(scraperLipGeo, polishedSteelMat);
    lip.position.set(side * 0.042, -0.005, 0.018);
    lip.rotation.y = -side * 0.18;
    wiperGroup.add(lip);
  });

  // =========================================================================
  // 4. ВЫДВИЖНОЙ РЕАКТИВНЫЙ КЛИНОК (vibratingBlade)
  // =========================================================================
  const vibratingBlade = new THREE.Group();
  vibratingBlade.name = 'vibratingBlade';
  // Базовая позиция (выдвинут): от z = 0.25 до z = 1.75 на уровне канала y = -0.22
  vibratingBlade.position.set(0, -0.222, 0);
  root.add(vibratingBlade);

  // Профиль основного полотна клинка в плоскости (Z, Y) с пильным серрейтором на обухе
  const bladeCoreShape = new THREE.Shape();
  bladeCoreShape.moveTo(0.25, -0.042);   // Пятка хвостовика (низ)
  bladeCoreShape.lineTo(0.84, -0.042);   // Выход из направляющей кассеты
  bladeCoreShape.lineTo(0.90, -0.068);   // Расширение рубящей части клинка
  bladeCoreShape.lineTo(1.56, -0.068);   // Прямая нижняя линия кромки
  bladeCoreShape.lineTo(1.75, 0.018);    // Остриё клинка (скос снизу вверх)
  bladeCoreShape.lineTo(1.56, 0.056);    // Передняя часть обуха

  // Крупный пильный серрейтор на обухе сверху (от z = 1.54 до z = 0.96)
  const teethCount = 8;
  const teethStartZ = 1.54;
  const teethStep = 0.068;
  for (let i = 0; i < teethCount; i++) {
    const tz = teethStartZ - i * teethStep;
    bladeCoreShape.lineTo(tz, 0.040);               // Впадина зуба
    bladeCoreShape.lineTo(tz - teethStep * 0.65, 0.062); // Острая вершина зуба с обратным наклоном
  }

  bladeCoreShape.lineTo(0.86, 0.048);    // Переход обуха в кассету
  bladeCoreShape.lineTo(0.25, 0.048);    // Верх хвостовика
  bladeCoreShape.closePath();

  const bladeCoreThickness = 0.024;
  const bladeCoreGeo = new THREE.ExtrudeGeometry(bladeCoreShape, {
    depth: bladeCoreThickness,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.003,
    bevelSegments: 2,
  });
  bladeCoreGeo.translate(0, 0, -bladeCoreThickness / 2);
  bladeCoreGeo.rotateY(-Math.PI / 2);

  const bladeCoreMesh = new THREE.Mesh(bladeCoreGeo, darkSteelMat);
  vibratingBlade.add(bladeCoreMesh);

  // Закалённая полированная режущая кромка снизу со скошенными спусками
  const edgeShape = new THREE.Shape();
  edgeShape.moveTo(0.85, -0.044);
  edgeShape.lineTo(0.90, -0.088);
  edgeShape.lineTo(1.57, -0.088);
  edgeShape.lineTo(1.75, 0.018);
  edgeShape.lineTo(1.56, -0.064);
  edgeShape.lineTo(0.90, -0.064);
  edgeShape.closePath();

  const edgeGeo = new THREE.ExtrudeGeometry(edgeShape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.002,
    bevelSegments: 1,
  });
  edgeGeo.translate(0, 0, -0.003);
  edgeGeo.rotateY(-Math.PI / 2);

  const cuttingEdgeMesh = new THREE.Mesh(edgeGeo, polishedSteelMat);
  vibratingBlade.add(cuttingEdgeMesh);

  // Дол (кровосток) и силовая планка у основания клинка
  const fullerGeo = new THREE.BoxGeometry(0.036, 0.022, 0.56);
  const fullerBar = new THREE.Mesh(fullerGeo, oliveArmorMat);
  fullerBar.position.set(0, 0.005, 1.18);
  vibratingBlade.add(fullerBar);

  // Два твердотопливных микро-ускорителя по бокам у основания клинка (z = 0.94)
  // Конические сопла направлены назад-вверх (-Z, +Y) для придания рубящего импульса вниз при ударе
  const boosterBodyGeo = new THREE.CylinderGeometry(0.021, 0.023, 0.145, 16).rotateX(Math.PI / 2);
  const nozzleGeo = new THREE.CylinderGeometry(0.015, 0.027, 0.058, 16, 1, true).rotateX(Math.PI / 2);
  const nozzleCoreGeo = new THREE.CylinderGeometry(0.012, 0.022, 0.052, 14).rotateX(Math.PI / 2);
  const clampGeo = new THREE.BoxGeometry(0.046, 0.046, 0.026);

  const emberMat = new THREE.MeshStandardMaterial({
    color: 0x3b1c0e,
    emissive: 0xd94e1f,
    emissiveIntensity: 0.35,
    roughness: 0.5,
  });

  [-1, 1].forEach((side) => {
    const boosterAssembly = new THREE.Group();
    // Крепление у основания клинка сразу за выходом из кассеты
    boosterAssembly.position.set(side * 0.036, 0.016, 0.96);
    // Разворот соплами назад-вверх (-Z, +Y) и лёгкий развал в стороны
    boosterAssembly.rotation.set(0.58, -side * 0.14, 0);

    const motorBody = new THREE.Mesh(boosterBodyGeo, darkSteelMat);
    const noseCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.021, 0.042, 16).rotateX(Math.PI / 2),
      oliveArmorMat
    );
    noseCone.position.z = 0.092;

    const nozzle = new THREE.Mesh(nozzleGeo, polishedSteelMat);
    nozzle.material = polishedSteelMat.clone();
    nozzle.material.side = THREE.DoubleSide;
    nozzle.position.z = -0.095;

    const nozzleInner = new THREE.Mesh(nozzleCoreGeo, emberMat);
    nozzleInner.position.z = -0.092;

    const clamp = new THREE.Mesh(clampGeo, oliveArmorMat);
    clamp.position.set(-side * 0.012, -0.004, 0.015);

    boosterAssembly.add(motorBody, noseCone, nozzle, nozzleInner, clamp);
    vibratingBlade.add(boosterAssembly);

    // Болты крепления ускорителей к полотну клинка (движутся вместе с клинком)
    registerBolt(
      bladeBoltMatrices,
      side * 0.022,
      0.012,
      0.94,
      0,
      0,
      -side * (Math.PI / 2),
      0.95
    );
    registerBolt(
      bladeBoltMatrices,
      side * 0.022,
      0.012,
      1.01,
      0,
      0,
      -side * (Math.PI / 2),
      0.95
    );
  });

  // Хромированный шток гидроцилиндра подачи
  const pistonLug = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.034, 0.048), darkSteelMat);
  pistonLug.position.set(0, 0.062, 0.87);
  vibratingBlade.add(pistonLug);

  const pistonRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 0.82, 16).rotateX(Math.PI / 2),
    polishedSteelMat
  );
  pistonRod.position.set(0, 0.066, 0.46);
  vibratingBlade.add(pistonRod);

  // =========================================================================
  // 5. INSTANCED MESH ДЛЯ БОЛТОВ И ЗАКЛЁПОК
  // =========================================================================
  const boltGeo = new THREE.CylinderGeometry(0.0065, 0.0065, 0.008, 6); // Шестигранная головка болта

  if (staticBoltMatrices.length > 0) {
    const staticBoltsInstanced = new THREE.InstancedMesh(
      boltGeo,
      polishedSteelMat,
      staticBoltMatrices.length
    );
    staticBoltsInstanced.name = 'staticBoltsInstanced';
    staticBoltMatrices.forEach((mat, idx) => staticBoltsInstanced.setMatrixAt(idx, mat));
    staticBoltsInstanced.instanceMatrix.needsUpdate = true;
    root.add(staticBoltsInstanced);
  }

  if (bladeBoltMatrices.length > 0) {
    const bladeBoltsInstanced = new THREE.InstancedMesh(
      boltGeo,
      polishedSteelMat,
      bladeBoltMatrices.length
    );
    bladeBoltsInstanced.name = 'bladeBoltsInstanced';
    bladeBoltMatrices.forEach((mat, idx) => bladeBoltsInstanced.setMatrixAt(idx, mat));
    bladeBoltsInstanced.instanceMatrix.needsUpdate = true;
    vibratingBlade.add(bladeBoltsInstanced);
  }

  // Включение теней для всех мешей модели
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return root;
}

// ============================================================================
// ПРИМЕР ИНИЦИАЛИЗАЦИИ СЦЕНЫ И АНИМАЦИИ ВЫДВИЖЕНИЯ / МИКРОВИБРАЦИИ
// ============================================================================
function initDemoScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16191c);
  scene.fog = new THREE.FogExp2(0x16191c, 0.14);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 50);
  camera.position.set(1.65, 0.55, 1.85);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -0.18, 0.65);
  controls.enableDamping = true;

  // 3-точечное студийное освещение
  const hemiLight = new THREE.HemisphereLight(0xdbe4ee, 0x2a2e28, 0.55);
  scene.add(hemiLight);

  // 1. Ключевой свет (Key Light)
  const keyLight = new THREE.DirectionalLight(0xfff4e4, 2.4);
  keyLight.position.set(2.5, 3.2, 2.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 10;
  keyLight.shadow.camera.left = -2;
  keyLight.shadow.camera.right = 2;
  keyLight.shadow.camera.top = 2;
  keyLight.shadow.camera.bottom = -2;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  // 2. Заполняющий холодный свет (Fill Light)
  const fillLight = new THREE.DirectionalLight(0x8ab4e8, 0.95);
  fillLight.position.set(-2.5, 0.8, 1.5);
  scene.add(fillLight);

  // 3. Контровой свет (Rim Light) для подчёркивания металлических фасок
  const rimLight = new THREE.DirectionalLight(0xffb870, 1.6);
  rimLight.position.set(-1.2, 1.8, -2.5);
  scene.add(rimLight);

  // Опорная сетка и плоскость для теней
  const grid = new THREE.GridHelper(6, 24, 0x3b4248, 0x24282c);
  grid.position.y = -0.65;
  scene.add(grid);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShadowMaterial({ opacity: 0.35 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.65;
  floor.receiveShadow = true;
  scene.add(floor);

  // Добавляем модель РПБ-12 «Грань»
  const weapon = createWeaponRPB12Gran();
  scene.add(weapon);

  const bladeGroup = weapon.getObjectByName('vibratingBlade');
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Плавный цикл выдвижения (0) и складывания (-0.75) с паузами в крайних точках
    const rawWave = Math.sin(t * 1.15);
    const clamped = THREE.MathUtils.clamp(rawWave * 1.6, -1, 1);
    const deployFactor = THREE.MathUtils.smoothstep(clamped, -1, 1); // 0 = сложен, 1 = выдвинут

    const baseZ = THREE.MathUtils.lerp(-0.75, 0.0, deployFactor);

    // Высокочастотная микровибрация клинка в рабочем (выдвинутом) положении
    const vibroActive = Math.max(0, (deployFactor - 0.85) / 0.15);
    const microJitterZ = Math.sin(t * 190.0) * 0.0022 * vibroActive;
    const microJitterY = Math.cos(t * 230.0) * 0.0008 * vibroActive;

    bladeGroup.position.z = baseZ + microJitterZ;
    bladeGroup.position.y = -0.222 + microJitterY;

    controls.update();
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
}

// initDemoScene(); // Раскомментируйте для запуска демо-сцены в браузере

// =========================================================================
// Адаптер под единый просмотрщик: ход клинка 0..0.75 м.
// setExtension(stroke) ставит базу; микровибрация (190/230 Гц) накладывается
// движком каждый кадр через ud.poseBlade.
// =========================================================================
export function createWeapon() {
  const root = createWeaponRPB12Gran();
  const ud = root.userData;
  const blade = root.getObjectByName('vibratingBlade');

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  ud.blade = blade;
  ud.bladeBaseY = BLADE_BASE_Y;
  ud.setExtension = (stroke) => {
    const s = Math.max(0, Math.min(BLADE_STROKE, stroke));
    blade.position.z = -s;
    return s / BLADE_STROKE;
  };
  ud.poseBlade = (stroke, t) => {
    const s = Math.max(0, Math.min(BLADE_STROKE, stroke));
    const deployFactor = s / BLADE_STROKE;
    const vibroActive = Math.max(0, (deployFactor - 0.85) / 0.15);
    blade.position.z = -s + Math.sin(t * 190.0) * 0.0022 * vibroActive;
    blade.position.y = BLADE_BASE_Y + Math.cos(t * 230.0) * 0.0008 * vibroActive;
    return vibroActive;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
