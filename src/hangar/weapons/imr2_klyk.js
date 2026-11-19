import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'imr2',
  code: 'ИМР-2',
  title: 'ИМР-2 «Клык»',
  subtitle: 'ТЯЖЁЛАЯ КЛЕШНЯ-РЕЗАК С ЦЕПНОЙ ПИЛОЙ • СЛОТ HEAVY • L=3.4 М',
  description: 'Тяжёлая инженерная клешня-резак: усиленный фланец УСП, бронированный корпус редуктора с гидронасосом, подвижная нижняя челюсть-захват на гидроцилиндре и верхняя шина цепной пилы (64 твердосплавных зуба, гидромотор). Вылет пилы ~3.4 м.',
  specs: [
    ['Длина модели', '3.4 м'],
    ['Слот', 'HEAVY'],
    ['Привод', 'Гидравлика + гидромотор цепи'],
    ['Челюсть', 'Поворотная, гидроцилиндр'],
    ['Пила', 'Шина 1.88 м, 64 зуба'],
    ['Цепь', '2.8 м/с, разводка зубьев'],
  ],
  maxExtension: 1.0,
  unit: '%',
  tipOffset: 3.4,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный фланец УСП' },
    { key: 'powerDriveBlock', label: '2. Редуктор и гидронасос' },
    { key: 'lowerJaw', label: '3. Нижняя челюсть-захват' },
    { key: 'upperChainsawArm', label: '4. Верхняя цепная пила' },
  ],
  cameras: {
    module: { pos: [3.2, 1.6, 4.2], target: [0, 0, 1.6] },
    saw: { pos: [1.6, 0.9, 4.6], target: [0, 0.1, 2.4] },
  },
  rangeMarkers: [],
  controls: 'jaw',
};

/**
 * Создаёт процедурную 3D-модель тяжёлой инженерной клешни-резака с цепной пилой ИМР-2 «Клык» (слот HEAVY).
 * Ориентация: +Z вперёд, +Y вверх. Точка (0, 0, 0) — центр заднего стыковочного фланца УСП.
 * Общая длина: ~3.4 м.
 *
 * @returns {THREE.Group} Корневая группа модели с методом update(dt, elapsedTime) в userData.
 */
export function createWeaponIMR2Klyk() {
  const root = new THREE.Group();
  root.name = 'IMR2_Klyk_Heavy';

  // --- 1. ПРОЦЕДУРНЫЕ ТЕКСТУРЫ И PBR МАТЕРИАЛЫ ---

  function createStenciledWarningTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Базовый фон защитного хаки
    ctx.fillStyle = '#4a5344';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Потёртости / грязь по краям
    ctx.fillStyle = 'rgba(25, 28, 22, 0.35)';
    ctx.fillRect(0, 0, canvas.width, 14);
    ctx.fillRect(0, canvas.height - 14, canvas.width, 14);

    // Жёлто-чёрная предупреждающая полоса сверху и снизу
    const stripeW = 24;
    ctx.save();
    ctx.beginPath();
    ctx.rect(16, 12, canvas.width - 32, 18);
    ctx.rect(16, canvas.height - 30, canvas.width - 32, 18);
    ctx.clip();

    ctx.fillStyle = '#d49b1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#181a17';
    for (let x = -canvas.height; x < canvas.width + canvas.height; x += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW - 40, canvas.height);
      ctx.lineTo(x - 40, canvas.height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Трафаретная советская маркировка
    ctx.fillStyle = '#e4e2d5';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('УСП-М // ИМР-2 «КЛЫК»', canvas.width / 2, 56);

    ctx.fillStyle = '#d49b1a';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText('ОПАСНО! ЗОНА РЕЗА И ЗАХВАТА — 25 МПа', canvas.width / 2, 84);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  function createArmorBumpTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(256, 256);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const n = 115 + Math.random() * 26;
      imgData.data[i] = n;
      imgData.data[i + 1] = n;
      imgData.data[i + 2] = n;
      imgData.data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  const armorBump = createArmorBumpTexture();
  const warningTex = createStenciledWarningTexture();

  const materials = {
    khakiArmor: new THREE.MeshStandardMaterial({
      color: 0x4a5344,
      roughness: 0.68,
      metalness: 0.35,
      bumpMap: armorBump,
      bumpScale: 0.004,
    }),
    khakiDark: new THREE.MeshStandardMaterial({
      color: 0x353c31,
      roughness: 0.72,
      metalness: 0.45,
      bumpMap: armorBump,
      bumpScale: 0.005,
    }),
    hardenedSteel: new THREE.MeshStandardMaterial({
      color: 0x24272b,
      roughness: 0.34,
      metalness: 0.85,
    }),
    wornEdgeSteel: new THREE.MeshStandardMaterial({
      color: 0x5c6269,
      roughness: 0.25,
      metalness: 0.9,
    }),
    copperPipe: new THREE.MeshStandardMaterial({
      color: 0x9c6b3b,
      roughness: 0.32,
      metalness: 0.88,
    }),
    chromeRod: new THREE.MeshStandardMaterial({
      color: 0xe6ebf0,
      roughness: 0.1,
      metalness: 0.98,
    }),
    rubberHose: new THREE.MeshStandardMaterial({
      color: 0x18191b,
      roughness: 0.85,
      metalness: 0.1,
    }),
    warningPlate: new THREE.MeshStandardMaterial({
      map: warningTex,
      roughness: 0.55,
      metalness: 0.3,
    }),
    exhaustSoot: new THREE.MeshStandardMaterial({
      color: 0x1b1a19,
      roughness: 0.9,
      metalness: 0.6,
    }),
  };

  // Вспомогательная коллекция для всех болтов (единый InstancedMesh)
  const boltTransforms = [];
  const dummy = new THREE.Object3D();

  function addBolt(x, y, z, rx = 0, ry = 0, rz = 0, scale = 1) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    boltTransforms.push(dummy.matrix.clone());
  }

  // =========================================================================
  // 1. mountFlange — Усиленный стыковочный фланец УСП в (0, 0, 0)
  // Габариты ~ 0.65 (X) x 1.0 (Y) x 0.16 (Z)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Основная бронеплита фланца (0.65 x 1.0 x 0.16)
  const flangePlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 1.0, 0.16),
    materials.khakiArmor
  );
  flangePlate.position.set(0, 0, 0.08);
  flangePlate.castShadow = true;
  flangePlate.receiveShadow = true;
  mountFlange.add(flangePlate);

  // Силовые вертикальные рёбра жёсткости по бокам фланца
  for (const side of [-1, 1]) {
    const sideRib = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 1.04, 0.22),
      materials.khakiDark
    );
    sideRib.position.set(side * 0.31, 0, 0.11);
    sideRib.castShadow = true;
    mountFlange.add(sideRib);

    // Боковые таблички с предупреждающей маркировкой
    const signPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.16, 0.64),
      materials.warningPlate
    );
    signPlate.rotation.z = Math.PI / 2;
    signPlate.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    signPlate.position.set(side * 0.348, 0.22, 0.12);
    mountFlange.add(signPlate);
  }

  // Четыре клиновых силовых замка УСП по углам фланца
  const lockPositions = [
    [-0.24, 0.39],
    [0.24, 0.39],
    [-0.24, -0.39],
    [0.24, -0.39],
  ];

  lockPositions.forEach(([lx, ly]) => {
    const lockHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.15, 0.2),
      materials.hardenedSteel
    );
    lockHousing.position.set(lx, ly, 0.1);
    lockHousing.castShadow = true;
    mountFlange.add(lockHousing);

    // Стопорный штифт замка
    const lockPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.24, 12),
      materials.wornEdgeSteel
    );
    lockPin.rotation.x = Math.PI / 2;
    lockPin.position.set(lx, ly, 0.1);
    mountFlange.add(lockPin);
  });

  // Центральный стыковочный гидроразъём и направляющий конус
  const centerHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.16, 0.22, 16),
    materials.hardenedSteel
  );
  centerHub.rotation.x = Math.PI / 2;
  centerHub.position.set(0, 0, 0.09);
  mountFlange.add(centerHub);

  // Болты по периметру фланца
  for (let y = -0.44; y <= 0.44; y += 0.11) {
    addBolt(-0.29, y, 0.165, Math.PI / 2, 0, 0, 1.1);
    addBolt(0.29, y, 0.165, Math.PI / 2, 0, 0, 1.1);
  }

  // =========================================================================
  // 2. powerDriveBlock — Бронированный корпус редуктора и гидронасоса
  // Расположение: Z от 0.16 до 1.25 м
  // =========================================================================
  const powerDriveBlock = new THREE.Group();
  powerDriveBlock.name = 'powerDriveBlock';
  powerDriveBlock.position.set(0, 0, 0.16);
  root.add(powerDriveBlock);

  // Главный бронекорпус редуктора
  const mainHull = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.78, 0.96),
    materials.khakiArmor
  );
  mainHull.position.set(0, 0.04, 0.48);
  mainHull.castShadow = true;
  mainHull.receiveShadow = true;
  powerDriveBlock.add(mainHull);

  // Скошенный верхний бронелист (характерная геометрия ИМР-2)
  const topSlope = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.22, 0.88),
    materials.khakiDark
  );
  topSlope.position.set(0, 0.44, 0.44);
  topSlope.rotation.x = 0.14;
  topSlope.castShadow = true;
  powerDriveBlock.add(topSlope);

  // Передний массивный шарнирный узел (проушины для челюсти и пилы)
  const frontClevis = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.68, 0.26),
    materials.hardenedSteel
  );
  frontClevis.position.set(0, 0.02, 1.02);
  frontClevis.castShadow = true;
  powerDriveBlock.add(frontClevis);

  // Защитные решётчатые экраны по левому и правому бортам
  for (const side of [-1, 1]) {
    const cageGroup = new THREE.Group();
    cageGroup.position.set(side * 0.35, 0.06, 0.48);

    // Рамка решётки
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.78), materials.khakiDark);
    frameTop.position.y = 0.26;
    const frameBot = frameTop.clone();
    frameBot.position.y = -0.26;
    cageGroup.add(frameTop, frameBot);

    // Вертикальные стойки
    for (let z = -0.36; z <= 0.36; z += 0.18) {
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.54, 0.03), materials.khakiDark);
      vBar.position.z = z;
      cageGroup.add(vBar);
    }

    // Горизонтальные прутья сетки
    for (let y = -0.2; y <= 0.2; y += 0.08) {
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.76), materials.hardenedSteel);
      hBar.position.y = y;
      cageGroup.add(hBar);
    }

    // Болты крепления экрана
    for (const bz of [-0.35, 0, 0.35]) {
      addBolt(side * 0.35, 0.32, 0.16 + 0.48 + bz, 0, 0, Math.PI / 2, 0.9);
      addBolt(side * 0.35, -0.2, 0.16 + 0.48 + bz, 0, 0, Math.PI / 2, 0.9);
    }

    powerDriveBlock.add(cageGroup);
  }

  // Массивный выхлопной патрубок с теплозащитным кожухом (сверху слева)
  const exhaustGroup = new THREE.Group();
  exhaustGroup.position.set(-0.2, 0.54, 0.35);

  const exhaustPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.075, 0.34, 16),
    materials.exhaustSoot
  );
  exhaustPipe.rotation.x = -0.28;
  exhaustGroup.add(exhaustPipe);

  // Перфорированный кожух глушителя
  const heatShield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.088, 0.24, 16, 1, true),
    materials.khakiDark
  );
  heatShield.material.side = THREE.DoubleSide;
  heatShield.rotation.x = -0.28;
  heatShield.position.y = -0.02;
  exhaustGroup.add(heatShield);

  // Откидной грибок/козырёк выхлопа
  const exhaustCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.015, 16),
    materials.hardenedSteel
  );
  exhaustCap.position.set(0, 0.17, -0.05);
  exhaustCap.rotation.x = 0.25;
  exhaustGroup.add(exhaustCap);

  powerDriveBlock.add(exhaustGroup);

  // Гидроаккумуляторы (два баллона высокого давления сверху справа)
  for (const xOff of [0.12, 0.24]) {
    const accumulator = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.052, 0.42, 8, 16),
      materials.hardenedSteel
    );
    accumulator.rotation.x = Math.PI / 2;
    accumulator.position.set(xOff, 0.52, 0.48);
    accumulator.castShadow = true;
    powerDriveBlock.add(accumulator);
  }

  // Толстые медные гидромагистрали и РВД (рукава высокого давления)
  function createPipe(points, radius, material) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const geo = new THREE.TubeGeometry(curve, 24, radius, 10, false);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    return mesh;
  }

  // Медные трубки подачи масла к распределителю
  powerDriveBlock.add(
    createPipe(
      [
        [0.12, 0.46, 0.72],
        [0.12, 0.42, 0.92],
        [0.26, 0.28, 1.02],
        [0.26, -0.15, 1.06],
      ],
      0.018,
      materials.copperPipe
    ),
    createPipe(
      [
        [0.24, 0.46, 0.72],
        [0.24, 0.4, 0.94],
        [0.31, 0.24, 1.03],
        [0.31, -0.18, 1.05],
      ],
      0.018,
      materials.copperPipe
    ),
    // Гибкие бронированные шланги РВД к переднему узлу
    createPipe(
      [
        [-0.18, 0.38, 0.85],
        [-0.29, 0.25, 1.02],
        [-0.26, 0.05, 1.18],
      ],
      0.024,
      materials.rubberHose
    ),
    createPipe(
      [
        [-0.12, 0.38, 0.88],
        [-0.25, 0.2, 1.06],
        [-0.22, -0.12, 1.2],
      ],
      0.024,
      materials.rubberHose
    )
  );

  // =========================================================================
  // 3. lowerJaw — Подвижная нижняя челюсть-захват (поворот по оси X)
  // Шарнир находится в точке (0, -0.22, 1.18)
  // =========================================================================
  const lowerJaw = new THREE.Group();
  lowerJaw.name = 'lowerJaw';
  lowerJaw.position.set(0, -0.22, 1.18);
  root.add(lowerJaw);

  // Мощный шарнирный палец оси вращения челюсти
  const jawPivotPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.62, 18),
    materials.wornEdgeSteel
  );
  jawPivotPin.rotation.z = Math.PI / 2;
  lowerJaw.add(jawPivotPin);

  // Профиль изогнутого стального крюка-упора в плоскости YZ (Z -> X_shape, Y -> Y_shape)
  const hookShape = new THREE.Shape();
  hookShape.moveTo(-0.08, -0.14);
  hookShape.lineTo(0.85, -0.32);   // Нижняя силовая балка
  hookShape.lineTo(1.58, -0.18);   // Подъём к носку крюка
  hookShape.lineTo(1.88, 0.28);    // Остриё клыка вверх навстречу пиле
  hookShape.lineTo(1.72, 0.34);    // Верхний срез клыка
  hookShape.lineTo(1.42, 0.02);    // Внутренняя выемка захвата
  hookShape.lineTo(0.85, -0.06);   // Зубчатая площадка упора
  hookShape.lineTo(0.12, 0.08);    // Верхняя проушина
  hookShape.closePath();

  // Облегчающее технологическое окно в теле крюка
  const holePath = new THREE.Path();
  holePath.moveTo(0.45, -0.16);
  holePath.lineTo(0.95, -0.21);
  holePath.lineTo(0.95, -0.11);
  holePath.lineTo(0.45, -0.06);
  holePath.closePath();
  hookShape.holes.push(holePath);

  const extrudeSettings = {
    depth: 0.14,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  };

  const hookGeo = new THREE.ExtrudeGeometry(hookShape, extrudeSettings);
  // Поворачиваем так, чтобы X формы смотрел вдоль +Z, Y вверх, а толщина по X
  hookGeo.rotateY(-Math.PI / 2);
  hookGeo.translate(0.07, 0, 0);

  // Сдвоенные бронещеки нижнего крюка для жёсткости и захвата брёвен/балок
  for (const xOffset of [-0.13, 0.13]) {
    const hookBlade = new THREE.Mesh(hookGeo, materials.hardenedSteel);
    hookBlade.position.x = xOffset;
    hookBlade.castShadow = true;
    hookBlade.receiveShadow = true;
    lowerJaw.add(hookBlade);
  }

  // Силовые перемычки между щеками крюка
  const bridgeMid = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.14, 0.38),
    materials.khakiArmor
  );
  bridgeMid.position.set(0, -0.18, 0.68);
  bridgeMid.rotation.x = 0.15;
  lowerJaw.add(bridgeMid);

  const tipReinforcement = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.22, 0.14),
    materials.wornEdgeSteel
  );
  tipReinforcement.position.set(0, 0.16, 1.72);
  tipReinforcement.rotation.x = -0.45;
  lowerJaw.add(tipReinforcement);

  // Зубчатая гребёнка на внутренней кромке нижней челюсти
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const tz = 0.32 + t * 1.05;
    const ty = 0.04 - t * 0.08;
    const gripTooth = new THREE.Mesh(
      new THREE.ConeGeometry(0.036, 0.08, 4),
      materials.wornEdgeSteel
    );
    gripTooth.rotation.y = Math.PI / 4;
    gripTooth.scale.set(3.8, 1, 1);
    gripTooth.position.set(0, ty, tz);
    lowerJaw.add(gripTooth);
  }

  // Крупный гидроцилиндр привода челюсти снизу (телескопическая пара корпус + шток)
  // Гильза цилиндра крепится к нижней части powerDriveBlock
  const cylBasePivot = new THREE.Group();
  cylBasePivot.position.set(0, -0.36, 0.72); // В координатах root
  root.add(cylBasePivot);

  const cylinderBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.092, 0.68, 20),
    materials.khakiDark
  );
  cylinderBarrel.rotation.x = Math.PI / 2;
  cylinderBarrel.position.z = 0.34;
  cylinderBarrel.castShadow = true;
  cylBasePivot.add(cylinderBarrel);

  // Усиленная букса (крышка сальника) гидроцилиндра + медный штуцер
  const cylinderGland = new THREE.Mesh(
    new THREE.CylinderGeometry(0.098, 0.098, 0.08, 20),
    materials.hardenedSteel
  );
  cylinderGland.rotation.x = Math.PI / 2;
  cylinderGland.position.z = 0.68;
  cylBasePivot.add(cylinderGland);

  // Хромированный шток крепится к проушине нижней челюсти
  const jawRodAnchor = new THREE.Object3D();
  jawRodAnchor.position.set(0, -0.22, 0.56); // В координатах lowerJaw
  lowerJaw.add(jawRodAnchor);

  const chromeRodMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.046, 0.65, 16),
    materials.chromeRod
  );
  chromeRodMesh.rotation.x = Math.PI / 2;
  chromeRodMesh.position.z = 0.325;
  cylBasePivot.add(chromeRodMesh);

  // =========================================================================
  // 4. upperChainsawArm — Верхняя шина тяжёлой цепной пилы
  // Общий вылет до ~3.4 м от фланца
  // =========================================================================
  const upperChainsawArm = new THREE.Group();
  upperChainsawArm.name = 'upperChainsawArm';
  upperChainsawArm.position.set(0, 0.16, 1.18);
  root.add(upperChainsawArm);

  // Параметры шины пилы (длина шины 2.15 м -> итог Z = 1.18 + 2.15 + зубья ≈ 3.4 м)
  const barLength = 1.88;
  const barRadius = 0.15; // Половина высоты шины (высота 0.30 м)

  // Несущая стальная направляющая шина (скруглённый прямоугольник)
  const barShape = new THREE.Shape();
  barShape.moveTo(0, -barRadius);
  barShape.lineTo(barLength, -barRadius);
  barShape.absarc(barLength, 0, barRadius, -Math.PI / 2, Math.PI / 2, false);
  barShape.lineTo(0, barRadius);
  barShape.absarc(0, 0, barRadius, Math.PI / 2, -Math.PI / 2, false);

  const barGeo = new THREE.ExtrudeGeometry(barShape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.006,
    bevelThickness: 0.006,
  });
  barGeo.rotateY(-Math.PI / 2);
  barGeo.translate(0.0225, 0, 0);

  const guideBar = new THREE.Mesh(barGeo, materials.hardenedSteel);
  guideBar.castShadow = true;
  guideBar.receiveShadow = true;
  upperChainsawArm.add(guideBar);

  // Внутренняя облегчающая выборка и направляющий паз на шине
  const barInlay = new THREE.Mesh(
    new THREE.BoxGeometry(0.064, 0.13, barLength - 0.15),
    materials.khakiDark
  );
  barInlay.position.set(0, 0, barLength * 0.5);
  upperChainsawArm.add(barInlay);

  // Ведущая и ведомая звёздочки на концах шины
  for (const zPos of [0.02, barLength]) {
    const sprocket = new THREE.Mesh(
      new THREE.CylinderGeometry(barRadius * 0.88, barRadius * 0.88, 0.072, 18),
      materials.wornEdgeSteel
    );
    sprocket.rotation.z = Math.PI / 2;
    sprocket.position.set(0, 0, zPos);
    upperChainsawArm.add(sprocket);

    const hubCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.095, 12),
      materials.hardenedSteel
    );
    hubCap.rotation.z = Math.PI / 2;
    hubCap.position.set(0, 0, zPos);
    upperChainsawArm.add(hubCap);
  }

  // Массивный бронекожух сверху шины (защита от падающих деревьев и осколков)
  const topGuard = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.08, barLength + 0.05),
    materials.khakiArmor
  );
  topGuard.position.set(0, barRadius + 0.085, barLength * 0.48);
  topGuard.castShadow = true;
  upperChainsawArm.add(topGuard);

  // Ребристые стойки крепления верхнего защитного кожуха (с левой стороны)
  for (let z = 0.1; z <= barLength - 0.1; z += 0.42) {
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.16, 0.09),
      materials.khakiDark
    );
    bracket.position.set(-0.085, barRadius + 0.03, z);
    upperChainsawArm.add(bracket);
    addBolt(-0.105, 0.16 + barRadius + 0.04, 1.18 + z, 0, 0, Math.PI / 2, 0.9);
  }

  // Узел натяжителя цепи и гидромотор привода пилы у основания шины
  const chainMotor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.14, 0.28, 18),
    materials.khakiDark
  );
  chainMotor.rotation.z = Math.PI / 2;
  chainMotor.position.set(-0.14, 0, 0.06);
  chainMotor.castShadow = true;
  upperChainsawArm.add(chainMotor);

  const tensionerHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.12, 0.32),
    materials.hardenedSteel
  );
  tensionerHousing.position.set(0.08, -0.05, 0.22);
  upperChainsawArm.add(tensionerHousing);

  // Регулировочный винт натяжителя цепи
  const tensionerBolt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8),
    materials.wornEdgeSteel
  );
  tensionerBolt.rotation.x = Math.PI / 2;
  tensionerBolt.position.set(0.11, -0.05, 0.39);
  upperChainsawArm.add(tensionerBolt);

  // --- Твердосплавные режущие зубья пилы по замкнутому контуру (InstancedMesh) ---
  // Создаём геометрию одного крупного режущего звена (основание + острый резец)
  const toothShape = new THREE.Shape();
  toothShape.moveTo(-0.032, 0);
  toothShape.lineTo(0.032, 0);
  toothShape.lineTo(0.024, 0.022);
  toothShape.lineTo(0.036, 0.056); // Острый агрессивный зуб вперёд по ходу цепи
  toothShape.lineTo(-0.012, 0.046);
  toothShape.lineTo(-0.026, 0.02);
  toothShape.closePath();

  const toothGeo = new THREE.ExtrudeGeometry(toothShape, {
    depth: 0.052,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.004,
    bevelThickness: 0.004,
  });
  // Центрируем по X, длина вдоль Z, режущая кромка вверх по +Y
  toothGeo.rotateY(-Math.PI / 2);
  toothGeo.translate(0.026, 0, 0);

  const numTeeth = 64;
  const chainInstancedMesh = new THREE.InstancedMesh(
    toothGeo,
    materials.wornEdgeSteel,
    numTeeth
  );
  chainInstancedMesh.castShadow = true;
  upperChainsawArm.add(chainInstancedMesh);

  // Параметризация замкнутого трека пильной цепи (2 прямых участка + 2 полуокружности)
  const straightLen = barLength;
  const arcLen = Math.PI * barRadius;
  const totalPerimeter = 2 * straightLen + 2 * arcLen;

  function updateChainInstances(phaseOffset) {
    for (let i = 0; i < numTeeth; i++) {
      let s = ((i / numTeeth) * totalPerimeter + phaseOffset) % totalPerimeter;
      if (s < 0) s += totalPerimeter;

      let z = 0;
      let y = 0;
      let angleX = 0; // Поворот вокруг X в плоскости YZ

      if (s < straightLen) {
        // Верхняя ветвь (движется вперёд к носку: +Z)
        z = s;
        y = barRadius;
        angleX = 0;
      } else if (s < straightLen + arcLen) {
        // Передняя полуокружность (носок шины)
        const theta = (s - straightLen) / barRadius; // от 0 до PI
        z = barLength + Math.sin(theta) * barRadius;
        y = Math.cos(theta) * barRadius;
        angleX = theta;
      } else if (s < 2 * straightLen + arcLen) {
        // Нижняя рабочая режущая ветвь (движется назад к корпусу: -Z)
        const d = s - (straightLen + arcLen);
        z = barLength - d;
        y = -barRadius;
        angleX = Math.PI;
      } else {
        // Задняя полуокружность (ведущая звёздочка)
        const theta = (s - (2 * straightLen + arcLen)) / barRadius; // от 0 до PI
        z = -Math.sin(theta) * barRadius;
        y = -Math.cos(theta) * barRadius;
        angleX = Math.PI + theta;
      }

      dummy.position.set(0, y, z);
      dummy.rotation.set(angleX, 0, 0);
      // Чередуем лёгкий наклон резцов влево/вправо как у настоящей разводки цепи
      const setAngle = i % 2 === 0 ? 0.08 : -0.08;
      dummy.rotateZ(setAngle);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      chainInstancedMesh.setMatrixAt(i, dummy.matrix);
    }
    chainInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  // Первичная расстановка зубьев
  updateChainInstances(0);

  // =========================================================================
  // 5. Единый InstancedMesh для всех шестигранных болтов конструкции
  // =========================================================================
  const boltGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.022, 6);
  const boltsInstancedMesh = new THREE.InstancedMesh(
    boltGeo,
    materials.hardenedSteel,
    boltTransforms.length
  );
  boltTransforms.forEach((mat, idx) => {
    boltsInstancedMesh.setMatrixAt(idx, mat);
  });
  boltsInstancedMesh.instanceMatrix.needsUpdate = true;
  root.add(boltsInstancedMesh);

  // =========================================================================
  // 6. Анимационный контроллер узлов (кинематика челюсти, штока и цепи)
  // =========================================================================
  let chainDistance = 0;
  const worldRodTarget = new THREE.Vector3();
  const localRodTarget = new THREE.Vector3();

  /**
   * Обновляет анимацию пильной цепи и кинематику гидропривода челюсти.
   * @param {number} dt Дельта времени в секундах
   * @param {number} jawClosureFactor Коэффициент сжатия от 0 (открыто) до 1 (сомкнуто)
   * @param {number} chainSpeed Скорость протяжки цепи в м/с
   */
  function updateAnimation(dt, jawClosureFactor = 0.5, chainSpeed = 2.6) {
    // 1. Вращение и сдвиг зубьев цепной пилы по контуру шины
    chainDistance = (chainDistance + dt * chainSpeed) % totalPerimeter;
    updateChainInstances(chainDistance);

    // 2. Поворот нижней челюсти вокруг оси X (открытие вниз +0.32 рад, сжатие вверх -0.22 рад)
    const openAngle = 0.34;
    const closedAngle = -0.22;
    lowerJaw.rotation.x = THREE.MathUtils.lerp(openAngle, closedAngle, jawClosureFactor);

    // 3. Кинематическая слежка гидроцилиндра за проушиной нижней челюсти
    root.updateMatrixWorld(true);
    jawRodAnchor.getWorldPosition(worldRodTarget);
    cylBasePivot.lookAt(worldRodTarget);

    // Подгоняем вылет хромированного штока под актуальное расстояние между шарнирами
    localRodTarget.copy(worldRodTarget);
    cylBasePivot.worldToLocal(localRodTarget);
    const dist = localRodTarget.length();
    chromeRodMesh.scale.y = Math.max(0.2, dist / 0.65);
    chromeRodMesh.position.z = dist * 0.5;
  }

  // Начальная синхронизация гидроцилиндра
  updateAnimation(0, 0.35, 0);

  root.userData = {
    mountFlange,
    powerDriveBlock,
    lowerJaw,
    upperChainsawArm,
    updateAnimation,
  };

  return root;
}

// ============================================================================
// ТЕСТОВАЯ СЦЕНА С ОСВЕЩЕНИЕМ, ПОЛОМ И АНИМАЦИЕЙ
// ============================================================================
export function initDemoScene(container = document.body) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1e1c);
  scene.fog = new THREE.FogExp2(0x1b1e1c, 0.065);

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(3.4, 1.8, 3.6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.9, 1.5);
  controls.enableDamping = true;
  controls.update();

  // Освещение (промышленный ангар / полигон)
  const hemiLight = new THREE.HemisphereLight(0xdce6df, 0x2c3029, 0.85);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xfff4e0, 2.4);
  dirLight.position.set(4, 7, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 20;
  const d = 4;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight(0x88aadd, 0.9);
  rimLight.position.set(-4, 3, -3);
  scene.add(rimLight);

  // Бетонный пол полигона и координатная сетка (1 клетка = 1 м)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x262927, roughness: 0.88, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(20, 20, 0x556050, 0x323830);
  grid.position.y = 0.002;
  scene.add(grid);

  // Инициализация ИМР-2 «Клык» на высоте монтажного кронштейна манипулятора (Y = 1.0 м)
  const weapon = createWeaponIMR2Klyk();
  weapon.position.set(0, 1.0, 0);
  scene.add(weapon);

  // Вспомогательная стойка-стенд под фланцем УСП (чтобы модуль не висел в воздухе на демо)
  const testStand = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 1.0, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x2d302e, roughness: 0.8, metalness: 0.4 })
  );
  testStand.position.set(0, 0.5, -0.12);
  testStand.castShadow = true;
  testStand.receiveShadow = true;
  scene.add(testStand);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // Плавный цикл сжатия и разжатия нижней челюсти (0..1)
    const jawClosure = 0.5 - 0.5 * Math.cos(elapsed * 1.4);

    // Обновляем движение зубьев пилы и гидроцилиндра челюсти
    weapon.userData.updateAnimation(dt, jawClosure, 2.8);

    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

// =========================================================================
// Адаптер под единый просмотрщик: createWeapon() + setExtension + setWireframe
// setExtension(closure 0..1) мгновенно ставит челюсть; протяжка цепи идёт
// покадрово из движка через userData.updateAnimation.
// =========================================================================
export function createWeapon() {
  const root = createWeaponIMR2Klyk();
  const ud = root.userData;

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  ud.setExtension = (closure) => {
    const c = Math.max(0, Math.min(1, closure));
    ud.updateAnimation(0, c, 0);
    return c;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
