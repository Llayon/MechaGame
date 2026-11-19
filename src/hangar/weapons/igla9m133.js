import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'igla',
  code: '9М133',
  title: '9М133 «Игла-Т»',
  subtitle: 'СДВОЕННЫЙ РАКЕТНЫЙ МОДУЛЬ ПТУР • СЛОТ AUX • ЦИКЛ 5.2 С',
  description: 'Сдвоенный ракетный модуль ПТУР: фланец УСП, блок наведения с оптико-лазерным модулем и гидроприводом, две пусковые трубы ТПК с откидными крышками-мембранами. Пуск поочерёдно: левая → правая, крышки откидываются пружиной на 118°.',
  specs: [
    ['Ракеты', '2 × 9М133'],
    ['Наведение', 'Лазер + оптика'],
    ['Крышки', 'Пружинные, 118°'],
    ['Цикл', '5.2 с'],
    ['Слот', 'AUX'],
    ['Длина модуля', '~1.85 м'],
  ],
  maxExtension: 5.2,
  unit: 's',
  tipOffset: 0.925,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'guidanceUnit', label: '2. Блок наведения и привод' },
    { key: 'leftTube', label: '3. Левая пусковая труба' },
    { key: 'rightTube', label: '4. Правая пусковая труба' },
  ],
  cameras: {
    module: { pos: [1.25, 0.35, 1.75], target: [0, -0.22, 0.10] },
  },
  rangeMarkers: [],
  controls: 'atgm',
};

const ATGM_CYCLE = 5.2;
const ATGM_OPEN_ANGLE = -2.06;

/**
 * Создает процедурную текстуру предупреждающей черно-желтой разметки (УСП)
 */
function createHazardStripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Базовый промышленный желтый фон
  ctx.fillStyle = '#cfa019';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Диагональные черные полосы
  ctx.fillStyle = '#181a17';
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

  // Легкая потертость и технический износ краски
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = 1 + Math.random() * 2.5;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(60, 65, 55, 0.28)' : 'rgba(20, 20, 18, 0.25)';
    ctx.fillRect(x, y, size, size);
  }

  // Темная окантовка по краям
  ctx.strokeStyle = '#1d201b';
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Создает процедурную текстуру передней защитной мембраны с белым техническим кольцом и насечками разрыва
 */
function createCoverMembraneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const cx = 256;
  const cy = 256;

  // Основной цвет композитной мембраны
  ctx.fillStyle = '#363e32';
  ctx.fillRect(0, 0, 512, 512);

  // Радиальные линии ослабления (лепестки прорыва ракетой)
  ctx.strokeStyle = 'rgba(24, 28, 22, 0.75)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * 235, cy + Math.sin(angle) * 235);
    ctx.stroke();
  }

  // Внешнее белое техническое кольцо
  ctx.strokeStyle = '#e6e6de';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(cx, cy, 202, 0, Math.PI * 2);
  ctx.stroke();

  // Внутреннее тонкое белое маркерное кольцо
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 168, 0, Math.PI * 2);
  ctx.stroke();

  // Центральный технологический маркер
  ctx.fillStyle = '#e6e6de';
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Создает процедурную 3D-модель сдвоенного ракетного модуля 9М133 «Игла-Т» (слот AUX)
 * Единицы: 1 unit = 1 метр. Ось пуска: +Z, верх: +Y, бок: +X.
 * Точка привязки (0, 0, 0) — центр верхнего фланца УСП.
 *
 * @returns {THREE.Group}
 */
export function createWeapon9M133IglaT() {
  const root = new THREE.Group();
  root.name = 'Weapon_9M133_IglaT';

  // --- PBR МАТЕРИАЛЫ ---
  const khakiMat = new THREE.MeshStandardMaterial({
    color: 0x4a5344,
    metalness: 0.40,
    roughness: 0.65,
  });

  const tubeCompositeMat = new THREE.MeshStandardMaterial({
    color: 0x3b4437,
    metalness: 0.30,
    roughness: 0.70,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x262925,
    metalness: 0.78,
    roughness: 0.38,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xdce2e6,
    metalness: 0.94,
    roughness: 0.14,
  });

  const rubberCableMat = new THREE.MeshStandardMaterial({
    color: 0x171817,
    metalness: 0.05,
    roughness: 0.85,
  });

  const laserRubyMat = new THREE.MeshPhysicalMaterial({
    color: 0x6e1414,
    emissive: 0x240303,
    emissiveIntensity: 0.35,
    metalness: 0.10,
    roughness: 0.10,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 0.9,
  });

  const mainOpticMat = new THREE.MeshPhysicalMaterial({
    color: 0x13383d,
    emissive: 0x05181c,
    emissiveIntensity: 0.25,
    metalness: 0.15,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });

  const hazardMat = new THREE.MeshStandardMaterial({
    map: createHazardStripeTexture(),
    metalness: 0.25,
    roughness: 0.55,
  });

  const coverMembraneMat = new THREE.MeshStandardMaterial({
    map: createCoverMembraneTexture(),
    metalness: 0.20,
    roughness: 0.62,
  });

  const whiteRingMat = new THREE.MeshStandardMaterial({
    color: 0xe6e6de,
    metalness: 0.10,
    roughness: 0.50,
  });

  // Вспомогательная функция для теней
  const applyShadows = (obj) => {
    obj.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  };

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange)
  // Верхняя плоскость на y = 0, габарит плиты: 0.40 x 0.10 x 0.60 м
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Основная плита УСП
  const flangePlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.40, 0.10, 0.60),
    khakiMat
  );
  flangePlate.position.set(0, -0.05, 0);
  mountFlange.add(flangePlate);

  // Верхняя направляющая планка стыковки (y = 0)
  const topGuideRail = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.012, 0.54),
    darkSteelMat
  );
  topGuideRail.position.set(0, -0.004, 0);
  mountFlange.add(topGuideRail);

  // Боковые предупреждающие полосы с CanvasTexture
  const stripeGeo = new THREE.BoxGeometry(0.012, 0.044, 0.56);
  const leftStripe = new THREE.Mesh(stripeGeo, hazardMat);
  leftStripe.position.set(-0.202, -0.05, 0);
  mountFlange.add(leftStripe);

  const rightStripe = new THREE.Mesh(stripeGeo, hazardMat);
  rightStripe.position.set(0.202, -0.05, 0);
  mountFlange.add(rightStripe);

  // Замки УСП и силовые проушины (4 узла по углам)
  const lockPositions = [
    [-0.215, -0.055, -0.19],
    [-0.215, -0.055, 0.19],
    [0.215, -0.055, -0.19],
    [0.215, -0.055, 0.19],
  ];
  const lockBodyGeo = new THREE.BoxGeometry(0.032, 0.056, 0.075);
  const lockPinGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.046, 12);
  lockPinGeo.rotateZ(Math.PI / 2);

  for (const [lx, ly, lz] of lockPositions) {
    const lockBody = new THREE.Mesh(lockBodyGeo, darkSteelMat);
    lockBody.position.set(lx, ly, lz);
    mountFlange.add(lockBody);

    const lockPin = new THREE.Mesh(lockPinGeo, chromeMat);
    lockPin.position.set(lx + Math.sign(lx) * 0.008, ly, lz);
    mountFlange.add(lockPin);
  }

  // Силовые болты крепления по периметру фланца
  const boltGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.018, 6);
  for (const bx of [-0.16, 0.16]) {
    for (const bz of [-0.25, -0.08, 0.08, 0.25]) {
      const bolt = new THREE.Mesh(boltGeo, darkSteelMat);
      bolt.position.set(bx, -0.104, bz);
      mountFlange.add(bolt);
    }
  }

  // Опорный погон поворотного основания под плитой УСП
  const azimuthRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.125, 0.026, 24),
    darkSteelMat
  );
  azimuthRing.position.set(0, -0.113, 0.02);
  mountFlange.add(azimuthRing);

  // =========================================================================
  // 2. БЛОК НАВЕДЕНИЯ И ПОВОРОТНЫЙ КРОНШТЕЙН (guidanceUnit)
  // =========================================================================
  const guidanceUnit = new THREE.Group();
  guidanceUnit.name = 'guidanceUnit';
  root.add(guidanceUnit);

  // Верхняя вилка шарнира вертикального наведения
  const upperYokeBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.03, 0.16),
    khakiMat
  );
  upperYokeBase.position.set(0, -0.138, 0.02);
  guidanceUnit.add(upperYokeBase);

  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.115, 0.09),
      khakiMat
    );
    cheek.position.set(side * 0.064, -0.195, 0.04);
    guidanceUnit.add(cheek);
  }

  // Горизонтальная ось шарнира (цапфа)
  const trunnionPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.18, 16),
    darkSteelMat
  );
  trunnionPin.rotation.z = Math.PI / 2;
  trunnionPin.position.set(0, -0.235, 0.04);
  guidanceUnit.add(trunnionPin);

  // Гидроцилиндр привода вертикального наведения (в задней части кронштейна)
  const hydroGroup = new THREE.Group();
  const hydroStart = new THREE.Vector3(0, -0.145, -0.06);
  const hydroEnd = new THREE.Vector3(0, -0.275, 0.01);
  const hydroDir = new THREE.Vector3().subVectors(hydroEnd, hydroStart);
  const hydroLen = hydroDir.length();

  const hydroCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.021, hydroLen * 0.62, 16),
    khakiMat
  );
  hydroCylinder.position.set(0, -hydroLen * 0.31, 0);
  hydroGroup.add(hydroCylinder);

  const hydroPiston = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, hydroLen * 0.55, 16),
    chromeMat
  );
  hydroPiston.position.set(0, -hydroLen * 0.72, 0);
  hydroGroup.add(hydroPiston);

  // Нижняя проушина штока гидроцилиндра
  const hydroClevis = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.032, 0.036),
    darkSteelMat
  );
  hydroClevis.position.set(0, -hydroLen, 0);
  hydroGroup.add(hydroClevis);

  hydroGroup.position.copy(hydroStart);
  hydroGroup.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, -1, 0),
    hydroDir.clone().normalize()
  );
  guidanceUnit.add(hydroGroup);

  // Поперечная несущая траверса, связывающая блок наведения с ТПК (x = ±0.22)
  const cradleBeam = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.062, 0.18),
    khakiMat
  );
  cradleBeam.position.set(0, -0.255, 0.04);
  guidanceUnit.add(cradleBeam);

  // Усиливающие ребра траверсы
  for (const bz of [-0.04, 0.12]) {
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.076, 0.022),
      darkSteelMat
    );
    rib.position.set(0, -0.255, bz);
    guidanceUnit.add(rib);
  }

  // Центральный оптико-лазерный модуль наведения
  const opticModule = new THREE.Group();
  opticModule.name = 'opticalLaserModule';
  opticModule.position.set(0, -0.255, 0.11);
  guidanceUnit.add(opticModule);

  // Бронекорпус прицельно-лазерного блока
  const opticBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.155, 0.165, 0.34),
    khakiMat
  );
  opticModule.add(opticBody);

  // Скошенная передняя бронемаска
  const frontMask = new THREE.Mesh(
    new THREE.BoxGeometry(0.145, 0.152, 0.04),
    darkSteelMat
  );
  frontMask.position.set(0, 0, 0.175);
  opticModule.add(frontMask);

  // Защитный противобликовый козырек сверху прицела
  const visorTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.165, 0.014, 0.11),
    khakiMat
  );
  visorTop.position.set(0, 0.088, 0.195);
  visorTop.rotation.x = 0.08;
  opticModule.add(visorTop);

  for (const side of [-1, 1]) {
    const visorSide = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.075, 0.085),
      khakiMat
    );
    visorSide.position.set(side * 0.076, 0.052, 0.185);
    opticModule.add(visorSide);
  }

  // Основной оптический прицельный канал (верхний-левый тубус)
  const mainSightHood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.040, 0.055, 24),
    darkSteelMat
  );
  mainSightHood.rotation.x = Math.PI / 2;
  mainSightHood.position.set(-0.028, 0.028, 0.195);
  opticModule.add(mainSightHood);

  const mainSightLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.031, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.38),
    mainOpticMat
  );
  mainSightLens.rotation.x = Math.PI / 2;
  mainSightLens.scale.set(1, 0.35, 1);
  mainSightLens.position.set(-0.028, 0.028, 0.205);
  opticModule.add(mainSightLens);

  // Лазерный канал наведения с тёмно-рубиновым светофильтром (#6e1414)
  const laserBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.030, 0.034, 0.065, 24),
    darkSteelMat
  );
  laserBarrel.rotation.x = Math.PI / 2;
  laserBarrel.position.set(0.030, -0.028, 0.20);
  opticModule.add(laserBarrel);

  const laserRubyLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.38),
    laserRubyMat
  );
  laserRubyLens.rotation.x = Math.PI / 2;
  laserRubyLens.scale.set(1, 0.35, 1);
  laserRubyLens.position.set(0.030, -0.028, 0.218);
  opticModule.add(laserRubyLens);

  // Маховички выверки (юстировочные барабанчики) и задний разъем питания
  const turretCapTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.020, 0.024, 16),
    darkSteelMat
  );
  turretCapTop.position.set(-0.035, 0.092, 0.05);
  opticModule.add(turretCapTop);

  const rearConnector = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.026, 0.045, 16),
    darkSteelMat
  );
  rearConnector.rotation.x = Math.PI / 2;
  rearConnector.position.set(0, -0.02, -0.185);
  opticModule.add(rearConnector);

  // =========================================================================
  // 3. ТРАНСПОРТНО-ПУСКОВЫЕ КОНТЕЙНЕРЫ (leftTube, rightTube)
  // Длина модуля: ~1.85 м, координата по бокам: x = ±0.22
  // =========================================================================
  function createLaunchTube(sideSign, name) {
    const tubeGroup = new THREE.Group();
    tubeGroup.name = name;
    tubeGroup.position.set(sideSign * 0.22, -0.255, 0.05);

    // Профиль ребристого ТПК с передним и задним раструбами (LatheGeometry вдоль +Z)
    // Общая длина корпуса: от z = -0.925 до z = +0.925 (1.85 м)
    const profilePoints = [
      // Задний торец и сопловой раструб (-0.925 .. -0.76)
      new THREE.Vector2(0.072, -0.925),
      new THREE.Vector2(0.094, -0.925),
      new THREE.Vector2(0.094, -0.895),
      new THREE.Vector2(0.086, -0.870),
      new THREE.Vector2(0.086, -0.790),
      new THREE.Vector2(0.093, -0.785),
      new THREE.Vector2(0.093, -0.765),
      new THREE.Vector2(0.077, -0.750),
    ];

    // Ребристая средняя секция от z = -0.75 до z = +0.76
    const ribStart = -0.70;
    const ribEnd = 0.72;
    const ribCount = 15;
    const step = (ribEnd - ribStart) / ribCount;

    for (let i = 0; i < ribCount; i++) {
      const z0 = ribStart + i * step;
      const z1 = z0 + step * 0.35;
      const z2 = z0 + step * 0.55;
      const z3 = z0 + step * 0.85;
      profilePoints.push(
        new THREE.Vector2(0.077, z0),
        new THREE.Vector2(0.081, z1),
        new THREE.Vector2(0.081, z2),
        new THREE.Vector2(0.077, z3)
      );
    }

    // Передний утолщенный раструб / дульный срез (+0.76 .. +0.925)
    profilePoints.push(
      new THREE.Vector2(0.077, 0.765),
      new THREE.Vector2(0.094, 0.780),
      new THREE.Vector2(0.094, 0.805),
      new THREE.Vector2(0.088, 0.815),
      new THREE.Vector2(0.088, 0.890),
      new THREE.Vector2(0.097, 0.898),
      new THREE.Vector2(0.097, 0.925),
      new THREE.Vector2(0.082, 0.925)
    );

    const tubeGeo = new THREE.LatheGeometry(profilePoints, 32);
    tubeGeo.rotateX(Math.PI / 2); // Поворачиваем ось Y в +Z
    const tubeBody = new THREE.Mesh(tubeGeo, tubeCompositeMat);
    tubeGroup.add(tubeBody);

    // Внутренний канал ствола (глубокая темная полость за крышкой)
    const innerBore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.081, 0.081, 1.82, 24, 1, true),
      darkSteelMat
    );
    innerBore.material = darkSteelMat.clone();
    innerBore.material.side = THREE.BackSide;
    innerBore.rotation.x = Math.PI / 2;
    tubeGroup.add(innerBore);

    // Задняя заглушка-сопло (вышибной поддон)
    const rearCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.073, 0.068, 0.025, 24),
      darkSteelMat
    );
    rearCap.rotation.x = Math.PI / 2;
    rearCap.position.set(0, 0, -0.915);
    tubeGroup.add(rearCap);

    // Два силовых хомута крепления ТПК к поперечной траверсе
    for (const cz of [-0.07, 0.05]) {
      const clampRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.086, 0.086, 0.036, 28),
        darkSteelMat
      );
      clampRing.rotation.x = Math.PI / 2;
      clampRing.position.set(0, 0, cz);
      tubeGroup.add(clampRing);

      // Стяжной замок хомута с внешней стороны
      const clampLug = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.042, 0.038),
        khakiMat
      );
      clampLug.position.set(sideSign * 0.092, 0, cz);
      tubeGroup.add(clampLug);

      // Кронштейн-переходник к центральной траверсе
      const bridgeLug = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 0.054, 0.038),
        khakiMat
      );
      bridgeLug.position.set(-sideSign * 0.085, 0, cz);
      tubeGroup.add(bridgeLug);
    }

    // Контактная коробка электроспуска на внутренней стороне ТПК
    const firingBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.034, 0.048, 0.13),
      darkSteelMat
    );
    firingBox.position.set(-sideSign * 0.082, -0.025, 0.16);
    tubeGroup.add(firingBox);

    // Гибкий кабель электроспуска от блока наведения к контактной коробке ТПК
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-sideSign * 0.165, -0.015, -0.10),
      new THREE.Vector3(-sideSign * 0.145, -0.055, 0.02),
      new THREE.Vector3(-sideSign * 0.115, -0.048, 0.11),
      new THREE.Vector3(-sideSign * 0.088, -0.025, 0.15),
    ]);
    const cableMesh = new THREE.Mesh(
      new THREE.TubeGeometry(cableCurve, 20, 0.0065, 8, false),
      rubberCableMat
    );
    tubeGroup.add(cableMesh);

    // --- ПЕРЕДНЯЯ ВЫПУКЛАЯ КРЫШКА-МЕМБРАНА С БЕЛЫМ ТЕХНИЧЕСКИМ КОЛЬЦОМ ---
    // Шарнирный узел (pivot в верхней точке среза для анимации откидывания при пуске)
    const coverPivot = new THREE.Group();
    coverPivot.name = 'frontCoverPivot';
    coverPivot.position.set(0, 0.095, 0.925);
    tubeGroup.add(coverPivot);

    const frontCover = new THREE.Group();
    frontCover.name = 'frontCover';
    frontCover.position.set(0, -0.095, 0);
    coverPivot.add(frontCover);

    // Наружный обод крышки
    const coverRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.096, 0.096, 0.016, 32),
      tubeCompositeMat
    );
    coverRim.rotation.x = Math.PI / 2;
    coverRim.position.set(0, 0, 0.008);
    frontCover.add(coverRim);

    // Выпуклая сферическая мембрана с текстурой разметки
    const domeGeo = new THREE.SphereGeometry(
      0.092,
      32,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.34
    );
    domeGeo.rotateX(Math.PI / 2);
    domeGeo.scale(1, 1, 0.36);
    const domeMesh = new THREE.Mesh(domeGeo, coverMembraneMat);
    domeMesh.position.set(0, 0, -0.014);
    frontCover.add(domeMesh);

    // Объемное белое техническое кольцо на переднем торце крышки
    const whiteRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.0045, 12, 36),
      whiteRingMat
    );
    whiteRing.position.set(0, 0, 0.017);
    frontCover.add(whiteRing);

    // Петля шарнира крышки (сверху) и нижняя защелка
    const hingeKnuckle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.036, 12),
      darkSteelMat
    );
    hingeKnuckle.rotation.z = Math.PI / 2;
    hingeKnuckle.position.set(0, 0.095, 0.006);
    frontCover.add(hingeKnuckle);

    const bottomLatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.016, 0.022),
      darkSteelMat
    );
    bottomLatch.position.set(0, -0.096, 0.008);
    frontCover.add(bottomLatch);

    tubeGroup.userData.coverPivot = coverPivot;
    return tubeGroup;
  }

  const leftTube = createLaunchTube(-1, 'leftTube');
  const rightTube = createLaunchTube(1, 'rightTube');
  root.add(leftTube);
  root.add(rightTube);

  applyShadows(root);

  // Сохраняем удобные ссылки для управления и анимации пуска в userData
  root.userData = {
    mountFlange,
    guidanceUnit,
    leftTube,
    rightTube,
    leftCoverPivot: leftTube.userData.coverPivot,
    rightCoverPivot: rightTube.userData.coverPivot,
  };

  return root;
}

// ===========================================================================
// ТЕСТОВАЯ СЦЕНА (автономный стенд; во вьювере не вызывается —
// движок index.html сам ставит свет, пол и анимацию пуска).
// ===========================================================================
function initTestScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16191d);
  scene.fog = new THREE.FogExp2(0x16191d, 0.08);

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.05,
    50
  );
  camera.position.set(1.25, 0.35, 1.75);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, -0.22, 0.10);
  controls.minDistance = 0.5;
  controls.maxDistance = 6.0;

  // Студийно-ангарное освещение
  const hemiLight = new THREE.HemisphereLight(0xc8d6e5, 0x2c302b, 0.85);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.2);
  keyLight.position.set(2.2, 3.0, 2.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 10;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x7fa8c9, 1.1);
  rimLight.position.set(-2.5, 1.2, -2.0);
  scene.add(rimLight);

  // Опорная сетка ангара и пилон-подвес для визуализации точки привязки (0, 0, 0)
  const grid = new THREE.GridHelper(6, 24, 0x3b4248, 0x25292d);
  grid.position.y = -0.85;
  scene.add(grid);

  const pylonStub = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.35, 0.68),
    new THREE.MeshStandardMaterial({
      color: 0x2b3035,
      metalness: 0.6,
      roughness: 0.5,
      transparent: true,
      opacity: 0.45,
    })
  );
  pylonStub.position.set(0, 0.175, 0);
  scene.add(pylonStub);

  // Создание экземпляра ракетного модуля 9М133 «Игла-Т»
  const iglaT = createWeapon9M133IglaT();
  scene.add(iglaT);

  // Вспышки стартового заряда при отстреле крышек
  const leftFlash = new THREE.PointLight(0xff8833, 0, 2.5);
  leftFlash.position.set(-0.22, -0.255, 1.05);
  scene.add(leftFlash);

  const rightFlash = new THREE.PointLight(0xff8833, 0, 2.5);
  rightFlash.position.set(0.22, -0.255, 1.05);
  scene.add(rightFlash);

  // Параметры циклической демонстрации пуска (левый -> правый -> сброс)
  const state = {
    timer: 0,
    leftAngle: 0,
    leftVel: 0,
    leftOpen: false,
    leftRecoil: 0,
    rightAngle: 0,
    rightVel: 0,
    rightOpen: false,
    rightRecoil: 0,
  };

  const triggerLaunch = (side) => {
    if (side === 'left' && !state.leftOpen) {
      state.leftOpen = true;
      state.leftVel = -16.5;
      state.leftRecoil = -0.028;
      leftFlash.intensity = 5.0;
    } else if (side === 'right' && !state.rightOpen) {
      state.rightOpen = true;
      state.rightVel = -16.5;
      state.rightRecoil = -0.028;
      rightFlash.intensity = 5.0;
    }
  };

  const resetCovers = () => {
    state.leftOpen = false;
    state.rightOpen = false;
    state.leftVel = 0;
    state.rightVel = 0;
  };

  // Ручной запуск по нажатию пробела
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      if (!state.leftOpen) triggerLaunch('left');
      else if (!state.rightOpen) triggerLaunch('right');
      else {
        resetCovers();
        state.timer = 0;
      }
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
    const dt = Math.min(clock.getDelta(), 0.05);
    state.timer += dt;

    // Автоматический демонстрационный цикл каждые 5.2 секунды
    if (state.timer > 1.0 && !state.leftOpen) {
      triggerLaunch('left');
    }
    if (state.timer > 2.2 && !state.rightOpen) {
      triggerLaunch('right');
    }
    if (state.timer > 4.4 && (state.leftOpen || state.rightOpen)) {
      resetCovers();
    }
    if (state.timer > 5.2) {
      state.timer = 0;
    }

    // Пружинно-демпферная физика откидывания передних крышек (-118 град при пуске)
    const targetLeft = state.leftOpen ? -2.06 : 0;
    const targetRight = state.rightOpen ? -2.06 : 0;
    const stiffness = state.leftOpen ? 140 : 45;
    const damping = state.leftOpen ? 13 : 10;

    state.leftVel += ((targetLeft - state.leftAngle) * stiffness - state.leftVel * damping) * dt;
    state.leftAngle += state.leftVel * dt;
    if (state.leftAngle > 0) {
      state.leftAngle = 0;
      state.leftVel = 0;
    }

    state.rightVel += ((targetRight - state.rightAngle) * stiffness - state.rightVel * damping) * dt;
    state.rightAngle += state.rightVel * dt;
    if (state.rightAngle > 0) {
      state.rightAngle = 0;
      state.rightVel = 0;
    }

    // Применение углов поворота крышек и микроотдачи ТПК
    iglaT.userData.leftCoverPivot.rotation.x = state.leftAngle;
    iglaT.userData.rightCoverPivot.rotation.x = state.rightAngle;

    state.leftRecoil = THREE.MathUtils.lerp(state.leftRecoil, 0, dt * 12);
    state.rightRecoil = THREE.MathUtils.lerp(state.rightRecoil, 0, dt * 12);
    iglaT.userData.leftTube.position.z = 0.05 + state.leftRecoil;
    iglaT.userData.rightTube.position.z = 0.05 + state.rightRecoil;

    leftFlash.intensity = THREE.MathUtils.lerp(leftFlash.intensity, 0, dt * 18);
    rightFlash.intensity = THREE.MathUtils.lerp(rightFlash.intensity, 0, dt * 18);

    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

// initTestScene(); // Автономный стенд: раскомментировать только вне просмотрщика.

// =========================================================================
// Адаптер под единый просмотрщик: цикл пуска 5.2 с, крышки на пружинах.
// applyAtgm(t): детерминированный прогон физики от 0 до t — скраб и цикл.
// Возвращает { left, right, flash } для телеметрии.
// =========================================================================
export function createWeapon() {
  const root = createWeapon9M133IglaT();
  const ud = root.userData;
  const leftPivot = ud.leftCoverPivot;
  const rightPivot = ud.rightCoverPivot;
  const leftTubeG = ud.leftTube;
  const rightTubeG = ud.rightTube;

  const leftFlash = new THREE.PointLight(0xff8833, 0, 2.5);
  leftFlash.position.set(-0.22, -0.255, 1.05);
  root.add(leftFlash);

  const rightFlash = new THREE.PointLight(0xff8833, 0, 2.5);
  rightFlash.position.set(0.22, -0.255, 1.05);
  root.add(rightFlash);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  // Детерминированный прогон пружинно-демпферной физики от 0 до t.
  // Совпадает с логикой демо-сцены: пуск левой в 1.0 с, правой в 2.2 с, сброс в 4.4 с.
  const poseAt = (t) => {
    let la = 0, lv = 0, lo = false, lr = 0, lf = 0;
    let ra = 0, rv = 0, ro = false, rr = 0, rf = 0;
    let firedL = false, firedR = false, resetDone = false;
    const dt = 1 / 60;
    for (let tt = 0; tt < t; tt += dt) {
      if (!firedL && tt >= 1.0) { lo = true; lv = -16.5; lr = -0.028; lf = 5.0; firedL = true; }
      if (!firedR && tt >= 2.2) { ro = true; rv = -16.5; rr = -0.028; rf = 5.0; firedR = true; }
      if (!resetDone && tt >= 4.4) { lo = false; ro = false; lv = 0; rv = 0; resetDone = true; }
      const sL = lo ? 140 : 45, dL = lo ? 13 : 10;
      lv += (((lo ? ATGM_OPEN_ANGLE : 0) - la) * sL - lv * dL) * dt;
      la += lv * dt;
      if (la > 0) { la = 0; lv = 0; }
      const sR = ro ? 140 : 45, dR = ro ? 13 : 10;
      rv += (((ro ? ATGM_OPEN_ANGLE : 0) - ra) * sR - rv * dR) * dt;
      ra += rv * dt;
      if (ra > 0) { ra = 0; rv = 0; }
      lr += (0 - lr) * Math.min(1, dt * 12);
      rr += (0 - rr) * Math.min(1, dt * 12);
      lf += (0 - lf) * Math.min(1, dt * 18);
      rf += (0 - rf) * Math.min(1, dt * 18);
    }
    leftPivot.rotation.x = la;
    rightPivot.rotation.x = ra;
    leftTubeG.position.z = 0.05 + lr;
    rightTubeG.position.z = 0.05 + rr;
    leftFlash.intensity = lf;
    rightFlash.intensity = rf;
    return { left: lo, right: ro, flash: Math.max(lf, rf) };
  };

  ud.applyAtgm = (t) => poseAt(Math.max(0, Math.min(ATGM_CYCLE, t)));
  ud.setExtension = (t) => {
    poseAt(Math.max(0, Math.min(ATGM_CYCLE, t)));
    return t / ATGM_CYCLE;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
