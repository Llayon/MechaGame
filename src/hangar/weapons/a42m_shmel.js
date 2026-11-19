import * as THREE from 'three';

export const meta = {
  id: 'a42m',
  code: '2А42М',
  title: '2А42М «Шмель»',
  subtitle: 'ЛЁГКАЯ 30-ММ АВТОМАТИЧЕСКАЯ ПУШКА • СЛОТ AUX • 550 ВЫСТР/МИН',
  description: 'Лёгкая 30-мм автоматическая пушка: фланец УСП с гидрозамками, восьмигранная ствольная коробка с электроприводом перезарядки, быстросъёмный короб на 120 патронов с гофрированным рукавом ленты и откатной ствол с перфорированным кожухом и двухкамерным дульным тормозом.',
  specs: [
    ['Калибр', '30×165 мм'],
    ['Темп стрельбы', '550 выстр/мин'],
    ['Питание', 'Лента, короб 120 патр.'],
    ['Слот', 'AUX'],
    ['Откат ствола', '90 мм'],
    ['Дульный тормоз', '2-камерный, щелевой'],
  ],
  maxExtension: 0.09,
  unit: 'mm',
  tipOffset: 1.65,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный фланец УСП' },
    { key: 'receiverBody', label: '2. Ствольная коробка и привод' },
    { key: 'ammoBoxGroup', label: '3. Короб боепитания и рукав' },
    { key: 'barrelGroup', label: '4. Откатной ствол 30 мм' },
  ],
  cameras: {
    module: { pos: [1.9, 0.5, 2.6], target: [0, -0.2, 0.8] },
  },
  rangeMarkers: [],
  controls: 'cannon',
};

const MAX_RECOIL = 0.09;

/**
 * Создаёт процедурную 3D-модель лёгкой 30-мм автоматической пушки 2А42М «Шмель» (слот AUX).
 * Масштаб: 1 unit = 1 метр.
 * Ориентация: +Z — направление стрельбы, +Y — верх, +X — правый борт.
 * Точка привязки (0, 0, 0): геометрический центр верхнего стыковочного фланца (УСП).
 *
 * @returns {THREE.Group} Корневая группа модели с именованными подузлами:
 *   - mountFlange
 *   - receiverBody
 *   - ammoBoxGroup
 *   - barrelGroup (подвижная группа для анимации отката по оси -Z)
 */
export function createWeapon2A42MShmel() {
  const root = new THREE.Group();
  root.name = 'Weapon2A42MShmel';

  // ============================================================================
  // 1. ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (CanvasTexture)
  // ============================================================================

  // Текстура микрорельефа катанной бронестали (bump/roughness)
  function createArmorGrainTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);

    const imgData = ctx.getImageData(0, 0, 256, 256);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 26;
      const v = Math.max(0, Math.min(255, 128 + noise));
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    // Лёгкие технологические царапины
    ctx.strokeStyle = 'rgba(210, 210, 210, 0.14)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 45; i++) {
      ctx.beginPath();
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 14);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  // Текстура жёлто-чёрной полосы опасности для стыковочного фланца УСП
  function createHazardStripeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#d99b16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#181a1b';
    const stripeWidth = 32;
    for (let x = -64; x < canvas.width + 64; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth - 36, canvas.height);
      ctx.lineTo(x - 36, canvas.height);
      ctx.closePath();
      ctx.fill();
    }

    // Потёртости краски по кромкам
    ctx.fillStyle = 'rgba(40, 44, 42, 0.35)';
    for (let i = 0; i < 160; i++) {
      ctx.fillRect(Math.random() * 512, Math.random() * 64, Math.random() * 8, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  // Текстура трафаретной маркировки «2А42М»
  function createStencilTexture(mainText, subText) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рамка технического клейма
    ctx.strokeStyle = 'rgba(232, 235, 226, 0.85)';
    ctx.lineWidth = 5;
    ctx.strokeRect(18, 24, 476, 208);

    // Основной индекс «2А42М»
    ctx.fillStyle = 'rgba(235, 238, 230, 0.92)';
    ctx.font = 'bold 104px "Courier New", Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(mainText, 38, 108);

    // Трафаретные перемычки (эффект распыления через трафарет)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fillRect(128, 45, 5, 120);
    ctx.fillRect(268, 45, 5, 120);
    ctx.fillRect(365, 45, 5, 120);

    // Подпись калибра и изделия
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(225, 228, 218, 0.85)';
    ctx.font = 'bold 28px "Courier New", Consolas, monospace';
    ctx.fillText(subText, 40, 186);

    // Имитация сколов краски
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 240; i++) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.25 + Math.random() * 0.55})`;
      ctx.fillRect(
        18 + Math.random() * 476,
        24 + Math.random() * 208,
        1 + Math.random() * 6,
        1 + Math.random() * 3
      );
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ============================================================================
  // 2. PBR-МАТЕРИАЛЫ
  // ============================================================================

  const grainTex = createArmorGrainTexture();
  const hazardTex = createHazardStripeTexture();
  const receiverStencilTex = createStencilTexture('2А42М', '30 ММ // ИЗД. «ШМЕЛЬ»');
  const ammoStencilTex = createStencilTexture('30×165', 'БТ / ОФЗ // 120 ПАТР.');

  // Основная серо-оливковая бронесталь
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x4b5346,
    metalness: 0.45,
    roughness: 0.65,
    bumpMap: grainTex,
    bumpScale: 0.0025,
  });

  // Тёмная воронёная сталь (ствол, дульный тормоз, звенья ленты)
  const bluedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x25282c,
    metalness: 0.85,
    roughness: 0.35,
    bumpMap: grainTex,
    bumpScale: 0.0012,
  });

  // Полированная сталь штоков гидрозамков и направляющих
  const chromeSteelMat = new THREE.MeshStandardMaterial({
    color: 0x9aa1a8,
    metalness: 0.92,
    roughness: 0.22,
  });

  // Тёмный резинополимер (гофра рукава, внутренности вентиляционных окон)
  const darkRubberMat = new THREE.MeshStandardMaterial({
    color: 0x181a1c,
    metalness: 0.15,
    roughness: 0.85,
  });

  // Материал предупреждающей разметки
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    metalness: 0.35,
    roughness: 0.55,
  });

  // Декали трафаретной маркировки
  const receiverDecalMat = new THREE.MeshStandardMaterial({
    map: receiverStencilTex,
    transparent: true,
    roughness: 0.7,
    metalness: 0.2,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  const ammoDecalMat = new THREE.MeshStandardMaterial({
    map: ammoStencilTex,
    transparent: true,
    roughness: 0.7,
    metalness: 0.2,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  // Вспомогательная функция включения теней
  function enableShadows(obj) {
    obj.traverse((child) => {
      if (child.isMesh || child.isInstancedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  // Массив трансформов для статичных заклёпок и болтов (InstancedMesh)
  const staticBoltTransforms = [];
  const dummy = new THREE.Object3D();

  function addBolt(x, y, z, rx = 0, ry = 0, rz = 0, scale = 1) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    staticBoltTransforms.push(dummy.matrix.clone());
  }

  // ============================================================================
  // 3. УЗЕЛ 1: СТЫКОВОЧНЫЙ ФЛАНЕЦ УСП (mountFlange)
  // ============================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Нижняя опорная плита 0.36 x 0.055 x 0.60 м
  const flangeBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.055, 0.60),
    armorMat
  );
  flangeBase.position.set(0, -0.0225, 0);
  mountFlange.add(flangeBase);

  // Верхняя скошенная сопрягаемая плита (фаски по периметру через ExtrudeGeometry)
  const topPlateW = 0.32;
  const topPlateL = 0.56;
  const flangeTopShape = new THREE.Shape();
  flangeTopShape.moveTo(-topPlateW / 2, -topPlateL / 2);
  flangeTopShape.lineTo(topPlateW / 2, -topPlateL / 2);
  flangeTopShape.lineTo(topPlateW / 2, topPlateL / 2);
  flangeTopShape.lineTo(-topPlateW / 2, topPlateL / 2);
  flangeTopShape.closePath();

  const flangeTopGeo = new THREE.ExtrudeGeometry(flangeTopShape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.015,
    bevelThickness: 0.015,
  });
  flangeTopGeo.rotateX(Math.PI / 2);
  const flangeTop = new THREE.Mesh(flangeTopGeo, armorMat);
  flangeTop.position.set(0, 0.035, 0);
  mountFlange.add(flangeTop);

  // Центральный силовой разъём энергопитания и шины данных СУО на верхней плоскости
  const connectorBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.056, 0.022, 16),
    bluedSteelMat
  );
  connectorBase.position.set(0, 0.056, 0.06);
  mountFlange.add(connectorBase);

  const connectorCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.034, 0.028, 16),
    chromeSteelMat
  );
  connectorCore.position.set(0, 0.062, 0.06);
  mountFlange.add(connectorCore);

  // Боковые полосы опасности (жёлто-чёрный паттерн) вдоль бортов фланца
  const hazardStripGeo = new THREE.BoxGeometry(0.004, 0.038, 0.50);
  const hazardLeft = new THREE.Mesh(hazardStripGeo, hazardMat);
  hazardLeft.position.set(-0.181, -0.022, 0);
  mountFlange.add(hazardLeft);

  const hazardRight = new THREE.Mesh(hazardStripGeo, hazardMat);
  hazardRight.position.set(0.181, -0.022, 0);
  mountFlange.add(hazardRight);

  // 4 угловых гидрозамка УСП
  const lockPositions = [
    [-0.145, 0, -0.245],
    [0.145, 0, -0.245],
    [-0.145, 0, 0.245],
    [0.145, 0, 0.245],
  ];

  lockPositions.forEach(([lx, ly, lz], idx) => {
    const lockGroup = new THREE.Group();
    lockGroup.name = `hydroLock_${idx + 1}`;
    lockGroup.position.set(lx, ly, lz);

    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.028, 0.105, 16),
      bluedSteelMat
    );
    lockGroup.add(housing);

    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.024, 8),
      armorMat
    );
    collar.position.y = -0.038;
    lockGroup.add(collar);

    const pistonPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.032, 16),
      chromeSteelMat
    );
    pistonPin.position.y = 0.062;
    lockGroup.add(pistonPin);

    mountFlange.add(lockGroup);
  });

  // Болты крепления верхней плиты фланца
  for (let z = -0.18; z <= 0.18; z += 0.09) {
    addBolt(-0.135, 0.051, z, 0, 0, 0, 1.0);
    addBolt(0.135, 0.051, z, 0, 0, 0, 1.0);
  }

  // Силовой пилон-переходник между фланцем (y = -0.05) и ствольной коробкой (y = -0.11)
  const neckPylon = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.075, 0.42),
    armorMat
  );
  neckPylon.position.set(0, -0.082, -0.12);
  mountFlange.add(neckPylon);

  // ============================================================================
  // 4. УЗЕЛ 2: СТВОЛЬНАЯ КОРОБКА И ПРИВОД (receiverBody)
  // ============================================================================
  const receiverBody = new THREE.Group();
  receiverBody.name = 'receiverBody';
  // Центр позиционирования по ТЗ: y = -0.22, z = -0.15
  receiverBody.position.set(0, -0.22, -0.15);
  root.add(receiverBody);

  // Угловатый восьмигранный бронекожух ствольной коробки (длина 0.60 м: от z_local=-0.30 до +0.30)
  // В мировых координатах: от z = -0.45 до z = +0.15
  const rxW = 0.145; // полуширина
  const rxH = 0.118; // полувысота
  const bevel = 0.036;

  const hullShape = new THREE.Shape();
  hullShape.moveTo(-rxW + bevel, -rxH);
  hullShape.lineTo(rxW - bevel, -rxH);
  hullShape.lineTo(rxW, -rxH + bevel);
  hullShape.lineTo(rxW, rxH - bevel);
  hullShape.lineTo(rxW - bevel, rxH);
  hullShape.lineTo(-rxW + bevel, rxH);
  hullShape.lineTo(-rxW, rxH - bevel);
  hullShape.lineTo(-rxW, -rxH + bevel);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.58,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.01,
    bevelThickness: 0.01,
  });
  hullGeo.translate(0, 0, -0.29);

  const receiverArmor = new THREE.Mesh(hullGeo, armorMat);
  receiverBody.add(receiverArmor);

  // Задний бронеколпак буфера отката (задний габарит модуля: z_world = -0.45)
  const rearCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.095, 0.05, 16),
    bluedSteelMat
  );
  rearCap.rotation.x = Math.PI / 2;
  rearCap.position.set(0, 0.005, -0.295);
  receiverBody.add(rearCap);

  // Передняя цапфа / люлька направления ствола (z_local = +0.30 ... +0.44)
  const frontTrunnion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.105, 0.14, 12),
    armorMat
  );
  frontTrunnion.rotation.x = Math.PI / 2;
  frontTrunnion.position.set(0, 0.01, 0.36);
  receiverBody.add(frontTrunnion);

  const trunnionCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.082, 0.03, 16),
    bluedSteelMat
  );
  trunnionCollar.rotation.x = Math.PI / 2;
  trunnionCollar.position.set(0, 0.01, 0.435);
  receiverBody.add(trunnionCollar);

  // Ребристые вентиляционные окна по обоим бортам (верхние скосы бронекорпуса)
  [-1, 1].forEach((side) => {
    const ventGroup = new THREE.Group();
    ventGroup.position.set(side * 0.132, 0.092, -0.06);
    ventGroup.rotation.z = -side * (Math.PI / 4);

    const ventCavity = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.012, 0.24),
      darkRubberMat
    );
    ventGroup.add(ventCavity);

    // 9 наклонных жалюзи внутри окна
    for (let i = -4; i <= 4; i++) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.005, 0.014),
        bluedSteelMat
      );
      slat.position.set(0, 0.003, i * 0.025);
      slat.rotation.x = 0.42;
      ventGroup.add(slat);
    }

    receiverBody.add(ventGroup);
  });

  // Люк доступа к затвору (правый борт +X)
  const breechHatch = new THREE.Group();
  breechHatch.name = 'breechAccessHatch';
  breechHatch.position.set(0.156, 0.005, -0.04);

  const hatchPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.125, 0.23),
    armorMat
  );
  breechHatch.add(hatchPlate);

  // Петли люка сверху
  [-0.07, 0.07].forEach((hz) => {
    const hinge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.032, 10),
      bluedSteelMat
    );
    hinge.rotation.x = Math.PI / 2;
    hinge.position.set(0.006, 0.064, hz);
    breechHatch.add(hinge);
  });

  // Защёлка-фиксатор люка снизу
  const hatchLatch = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.022, 0.036),
    bluedSteelMat
  );
  hatchLatch.position.set(0.006, -0.056, 0);
  breechHatch.add(hatchLatch);

  receiverBody.add(breechHatch);

  // Электромеханический привод перезарядки и досылания (правый нижний борт +X)
  const driveMotorGroup = new THREE.Group();
  driveMotorGroup.name = 'driveMotor';
  driveMotorGroup.position.set(0.165, -0.068, 0.12);

  const motorBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.22, 16),
    bluedSteelMat
  );
  motorBody.rotation.x = Math.PI / 2;
  driveMotorGroup.add(motorBody);

  // Оребрение охлаждения электропривода
  for (let z = -0.07; z <= 0.07; z += 0.02) {
    const fin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.047, 0.047, 0.006, 16),
      armorMat
    );
    fin.rotation.x = Math.PI / 2;
    fin.position.z = z;
    driveMotorGroup.add(fin);
  }
  receiverBody.add(driveMotorGroup);

  // Окно выброса стреляных гильз (нижний правый скос)
  const ejectionPort = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.045, 0.14),
    darkRubberMat
  );
  ejectionPort.position.set(0.132, -0.088, 0.14);
  ejectionPort.rotation.z = Math.PI / 4;
  receiverBody.add(ejectionPort);

  // Трафаретная маркировка «2А42М» на бортах ствольной коробки
  const stencilRight = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.12),
    receiverDecalMat
  );
  stencilRight.position.set(0.156, 0.015, 0.175);
  stencilRight.rotation.y = Math.PI / 2;
  receiverBody.add(stencilRight);

  const stencilLeft = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.12),
    receiverDecalMat
  );
  stencilLeft.position.set(-0.156, 0.015, -0.14);
  stencilLeft.rotation.y = -Math.PI / 2;
  receiverBody.add(stencilLeft);

  // Заклёпки на бронекожухе ствольной коробки (в мировых координатах относительно root)
  for (let z = -0.38; z <= 0.10; z += 0.08) {
    addBolt(0.154, -0.155, z, 0, 0, -Math.PI / 2, 0.85);
    addBolt(0.154, -0.285, z, 0, 0, -Math.PI / 2, 0.85);
    addBolt(-0.154, -0.155, z, 0, 0, Math.PI / 2, 0.85);
    addBolt(-0.154, -0.285, z, 0, 0, Math.PI / 2, 0.85);
  }

  // ============================================================================
  // 5. УЗЕЛ 3: КОРОБ БОЕПИТАНИЯ И ГИБКИЙ РУКАВ ЛЕНТЫ (ammoBoxGroup)
  // ============================================================================
  const ammoBoxGroup = new THREE.Group();
  ammoBoxGroup.name = 'ammoBoxGroup';
  root.add(ammoBoxGroup);

  // Кронштейн быстросъёмного крепления короба к левому борту (-X)
  const mountBracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, 0.14, 0.26),
    bluedSteelMat
  );
  mountBracket.position.set(-0.185, -0.23, -0.15);
  ammoBoxGroup.add(mountBracket);

  // Корпус металлического патронного ящика (слева по -X)
  const boxCenter = new THREE.Vector3(-0.335, -0.245, -0.15);
  const boxW = 0.22;
  const boxH = 0.27;
  const boxL = 0.36;

  const ammoBoxMesh = new THREE.Mesh(
    new THREE.BoxGeometry(boxW, boxH, boxL),
    armorMat
  );
  ammoBoxMesh.position.copy(boxCenter);
  ammoBoxGroup.add(ammoBoxMesh);

  // Откидная крышка патронного короба
  const ammoLid = new THREE.Mesh(
    new THREE.BoxGeometry(boxW + 0.014, 0.026, boxL + 0.014),
    armorMat
  );
  ammoLid.position.set(boxCenter.x, boxCenter.y + boxH / 2 + 0.01, boxCenter.z);
  ammoBoxGroup.add(ammoLid);

  // Выштамповка рёбер жёсткости на внешней стенке (-X) и торцах
  for (let i = -1; i <= 1; i++) {
    const sideRib = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.18, 0.026),
      armorMat
    );
    sideRib.position.set(
      boxCenter.x - boxW / 2 - 0.004,
      boxCenter.y - 0.005,
      boxCenter.z + i * 0.105
    );
    ammoBoxGroup.add(sideRib);
  }

  [-1, 1].forEach((endDir) => {
    const endRib = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.024, 0.01),
      armorMat
    );
    endRib.position.set(
      boxCenter.x,
      boxCenter.y + 0.03,
      boxCenter.z + endDir * (boxL / 2 + 0.004)
    );
    ammoBoxGroup.add(endRib);

    // Защёлка крышки на торце
    const clasp = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.046, 0.018),
      bluedSteelMat
    );
    clasp.position.set(
      boxCenter.x,
      boxCenter.y + boxH / 2 - 0.01,
      boxCenter.z + endDir * (boxL / 2 + 0.008)
    );
    ammoBoxGroup.add(clasp);
  });

  // Ручка для переноски на верхней крышке короба
  const handleGroup = new THREE.Group();
  handleGroup.position.set(boxCenter.x - 0.01, boxCenter.y + boxH / 2 + 0.024, boxCenter.z);

  const handleGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.15, 12),
    bluedSteelMat
  );
  handleGrip.rotation.x = Math.PI / 2;
  handleGroup.add(handleGrip);

  [-0.072, 0.072].forEach((hz) => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.036, 8),
      bluedSteelMat
    );
    leg.position.set(0, 0.017, hz);
    handleGroup.add(leg);
  });
  ammoBoxGroup.add(handleGroup);

  // Трафарет на внешней стенке короба
  const ammoDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.12),
    ammoDecalMat
  );
  ammoDecal.position.set(boxCenter.x - boxW / 2 - 0.011, boxCenter.y + 0.04, boxCenter.z);
  ammoDecal.rotation.y = -Math.PI / 2;
  ammoBoxGroup.add(ammoDecal);

  // Заклёпки по периметру короба
  for (let z = boxCenter.z - 0.14; z <= boxCenter.z + 0.14; z += 0.07) {
    addBolt(boxCenter.x - boxW / 2 - 0.003, boxCenter.y + 0.11, z, 0, 0, Math.PI / 2, 0.8);
    addBolt(boxCenter.x - boxW / 2 - 0.003, boxCenter.y - 0.11, z, 0, 0, Math.PI / 2, 0.8);
  }

  // Приёмная горловина лентопротяжного механизма на левом борту ствольной коробки
  const feedPort = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.075, 0.13),
    bluedSteelMat
  );
  feedPort.position.set(-0.155, -0.185, 0.03);
  ammoBoxGroup.add(feedPort);

  // Гибкий гофрированный рукав подачи ленты (TubeGeometry + InstancedMesh металлических звеньев)
  const chuteCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.275, -0.095, -0.03),
    new THREE.Vector3(-0.255, -0.055, 0.00),
    new THREE.Vector3(-0.205, -0.095, 0.025),
    new THREE.Vector3(-0.165, -0.185, 0.03),
  ]);

  // Внутренний гибкий гофрированный канал
  const chuteTubeGeo = new THREE.TubeGeometry(chuteCurve, 36, 0.028, 12, false);
  const chuteTube = new THREE.Mesh(chuteTubeGeo, darkRubberMat);
  ammoBoxGroup.add(chuteTube);

  // Внешние шарнирные металлические звенья рукава через InstancedMesh
  const linkCount = 22;
  const linkGeo = new THREE.BoxGeometry(0.074, 0.115, 0.016);
  const linksInstanced = new THREE.InstancedMesh(linkGeo, bluedSteelMat, linkCount);
  linksInstanced.name = 'ammoBeltLinks';

  const frenetFrames = chuteCurve.computeFrenetFrames(linkCount, false);
  const upVec = new THREE.Vector3(0, 1, 0);
  const rotMat = new THREE.Matrix4();

  for (let i = 0; i < linkCount; i++) {
    const t = i / (linkCount - 1);
    const pt = chuteCurve.getPointAt(t);
    const tangent = frenetFrames.tangents[i].clone().normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, upVec).normalize();
    const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    rotMat.makeBasis(normal, binormal, tangent);
    dummy.position.copy(pt);
    dummy.quaternion.setFromRotationMatrix(rotMat);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    linksInstanced.setMatrixAt(i, dummy.matrix);
  }
  linksInstanced.instanceMatrix.needsUpdate = true;
  ammoBoxGroup.add(linksInstanced);

  // ============================================================================
  // 6. УЗЕЛ 4: ОТКАТНОЙ СТВОЛ (barrelGroup — анимация отдачи по оси -Z)
  // ============================================================================
  const barrelGroup = new THREE.Group();
  barrelGroup.name = 'barrelGroup';
  // Ось ствола проходит на высоте y = -0.21
  barrelGroup.position.set(0, -0.21, 0);
  root.add(barrelGroup);

  // 6.1. Основной 30-мм ствол (от z = 0.14 до z = 1.45)
  // Казённая утолщённая часть ствола
  const barrelRear = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.46, 20),
    bluedSteelMat
  );
  barrelRear.rotation.x = Math.PI / 2;
  barrelRear.position.set(0, 0, 0.37);
  barrelGroup.add(barrelRear);

  // Средняя ступень ствола
  const barrelMid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.038, 0.45, 20),
    bluedSteelMat
  );
  barrelMid.rotation.x = Math.PI / 2;
  barrelMid.position.set(0, 0, 0.82);
  barrelGroup.add(barrelMid);

  // Передняя открытая часть ствола с продольными рёбрами жёсткости (долами)
  const barrelFront = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.030, 0.41, 20),
    bluedSteelMat
  );
  barrelFront.rotation.x = Math.PI / 2;
  barrelFront.position.set(0, 0, 1.245);
  barrelGroup.add(barrelFront);

  // Продольные долы на открытой передней части ствола
  for (let a = 0; a < 8; a++) {
    const angle = (a / 8) * Math.PI * 2;
    const flute = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, 0.006, 0.34),
      armorMat
    );
    flute.position.set(Math.cos(angle) * 0.027, Math.sin(angle) * 0.027, 1.23);
    flute.rotation.z = angle;
    barrelGroup.add(flute);
  }

  // 6.2. Газоотводная трубка сверху ствола (y_local = +0.062)
  const gasTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.86, 14),
    bluedSteelMat
  );
  gasTube.rotation.x = Math.PI / 2;
  gasTube.position.set(0, 0.062, 0.65);
  barrelGroup.add(gasTube);

  // Передняя газовая камера с регулятором (z = 1.06)
  const gasBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.044, 0.095, 0.065),
    bluedSteelMat
  );
  gasBlock.position.set(0, 0.032, 1.06);
  barrelGroup.add(gasBlock);

  const gasRegulatorCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.024, 6),
    chromeSteelMat
  );
  gasRegulatorCap.rotation.x = Math.PI / 2;
  gasRegulatorCap.position.set(0, 0.062, 1.10);
  barrelGroup.add(gasRegulatorCap);

  // 6.3. Массивный перфорированный кожух охлаждения (z = 0.24 ... 0.94)
  const shroudStartZ = 0.24;
  const shroudLength = 0.70;
  const shroudRadius = 0.068;

  const shroudBody = new THREE.Mesh(
    new THREE.CylinderGeometry(shroudRadius, shroudRadius, shroudLength, 24, 1, true),
    armorMat
  );
  shroudBody.rotation.x = Math.PI / 2;
  shroudBody.position.set(0, 0, shroudStartZ + shroudLength / 2);
  // DoubleSide чтобы внутренние стенки перфорированного кожуха корректно читались
  const shroudMat = armorMat.clone();
  shroudMat.side = THREE.DoubleSide;
  shroudBody.material = shroudMat;
  barrelGroup.add(shroudBody);

  // Передний и задний торцевые фланцы кожуха охлаждения
  [shroudStartZ, shroudStartZ + shroudLength].forEach((fz) => {
    const endCap = new THREE.Mesh(
      new THREE.CylinderGeometry(shroudRadius + 0.004, shroudRadius + 0.004, 0.022, 24),
      bluedSteelMat
    );
    endCap.rotation.x = Math.PI / 2;
    endCap.position.set(0, 0, fz);
    barrelGroup.add(endCap);
  });

  // Кольца жёсткости кожуха охлаждения через InstancedMesh
  const ringCount = 13;
  const ringGeo = new THREE.TorusGeometry(shroudRadius + 0.002, 0.0045, 8, 28);
  const shroudRingsInstanced = new THREE.InstancedMesh(ringGeo, bluedSteelMat, ringCount);
  shroudRingsInstanced.name = 'coolingShroudRings';

  for (let i = 0; i < ringCount; i++) {
    const rz = shroudStartZ + 0.04 + (i / (ringCount - 1)) * (shroudLength - 0.08);
    dummy.position.set(0, 0, rz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    shroudRingsInstanced.setMatrixAt(i, dummy.matrix);
  }
  shroudRingsInstanced.instanceMatrix.needsUpdate = true;
  barrelGroup.add(shroudRingsInstanced);

  // Перфорированные вентиляционные отверстия кожуха через InstancedMesh
  const holeCols = 14;
  const holeAngles = [-2.55, -2.05, -1.55, -1.05, -0.55, -0.05, 0.55, 1.05, 2.05, 2.55];
  const totalHoles = holeCols * holeAngles.length;

  const holePortGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.008, 12);
  const holesInstanced = new THREE.InstancedMesh(holePortGeo, darkRubberMat, totalHoles);
  holesInstanced.name = 'coolingShroudHoles';

  let holeIdx = 0;
  const radialDir = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  for (let c = 0; c < holeCols; c++) {
    const hz = shroudStartZ + 0.055 + (c / (holeCols - 1)) * (shroudLength - 0.11);
    const stagger = (c % 2) * 0.18;
    for (let a = 0; a < holeAngles.length; a++) {
      const theta = holeAngles[a] + stagger;
      const nx = Math.cos(theta);
      const ny = Math.sin(theta);
      radialDir.set(nx, ny, 0).normalize();

      dummy.position.set(nx * (shroudRadius - 0.001), ny * (shroudRadius - 0.001), hz);
      dummy.quaternion.setFromUnitVectors(yAxis, radialDir);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      holesInstanced.setMatrixAt(holeIdx++, dummy.matrix);
    }
  }
  holesInstanced.instanceMatrix.needsUpdate = true;
  barrelGroup.add(holesInstanced);

  // 6.4. Двухкамерный щелевой дульный тормоз (z = 1.43 ... 1.65, срез строго на z = 1.65)
  const muzzleBrake = new THREE.Group();
  muzzleBrake.name = 'muzzleBrake';
  barrelGroup.add(muzzleBrake);

  // Резьбовая муфта основания дульного тормоза
  const brakeCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.034, 0.035, 16),
    bluedSteelMat
  );
  brakeCollar.rotation.x = Math.PI / 2;
  brakeCollar.position.set(0, 0, 1.445);
  muzzleBrake.add(brakeCollar);

  // Верхняя и нижняя силовые пластины дульного тормоза (формируют щелевые окна по бокам)
  const brakeW = 0.112;
  const brakeH = 0.074;
  const plateThickness = 0.014;
  const brakeStartZ = 1.455;
  const brakeEndZ = 1.65; // Точный габарит 1.65 м по +Z
  const brakeLen = brakeEndZ - brakeStartZ;

  [-1, 1].forEach((dirY) => {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(brakeW, plateThickness, brakeLen),
      bluedSteelMat
    );
    plate.position.set(0, dirY * (brakeH / 2 - plateThickness / 2), brakeStartZ + brakeLen / 2);
    muzzleBrake.add(plate);
  });

  // 3 поперечные перегородки (формируют 2 реактивные камеры сброса газов)
  const baffleZPositions = [1.468, 1.548, 1.636];
  baffleZPositions.forEach((bz, idx) => {
    const baffleThickness = idx === 2 ? 0.028 : 0.022;
    // Левая и правая половины перегородки оставляют центральный канал 30 мм свободным
    [-1, 1].forEach((sideX) => {
      const baffleHalf = new THREE.Mesh(
        new THREE.BoxGeometry(0.038, brakeH - plateThickness * 1.6, baffleThickness),
        bluedSteelMat
      );
      baffleHalf.position.set(sideX * 0.036, 0, bz);
      // Лёгкий скос реактивных перегородок назад для отвода пороховых газов
      baffleHalf.rotation.y = sideX * 0.16;
      muzzleBrake.add(baffleHalf);
    });
  });

  // Центральный дульный срез с нарезами внутри тормоза
  const innerMuzzleRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.017, 0.004, 8, 20),
    chromeSteelMat
  );
  innerMuzzleRing.position.set(0, 0, 1.648);
  muzzleBrake.add(innerMuzzleRing);

  // ============================================================================
  // 7. ИНСТАНСИНГ ЗАКЛЁПОК И БОЛТОВ (THREE.InstancedMesh)
  // ============================================================================
  const boltGeo = new THREE.CylinderGeometry(0.0055, 0.0065, 0.006, 6);
  const boltsInstanced = new THREE.InstancedMesh(
    boltGeo,
    bluedSteelMat,
    staticBoltTransforms.length
  );
  boltsInstanced.name = 'armorRivetsAndBolts';

  staticBoltTransforms.forEach((mat, i) => {
    boltsInstanced.setMatrixAt(i, mat);
  });
  boltsInstanced.instanceMatrix.needsUpdate = true;
  root.add(boltsInstanced);

  // Включаем тени для всех элементов модели
  enableShadows(root);

  return root;
}

// =========================================================================
// Адаптер под единый просмотрщик: откат ствола 0..0.09 м.
// setExtension(recoil) сдвигает barrelGroup по -Z. Возвращает долю хода.
// =========================================================================
export function createWeapon() {
  const root = createWeapon2A42MShmel();
  const ud = root.userData;
  const barrel = root.getObjectByName('barrelGroup');

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  ud.barrel = barrel;
  ud.setExtension = (recoil) => {
    const r = Math.max(0, Math.min(MAX_RECOIL, recoil));
    barrel.position.z = -r;
    return r / MAX_RECOIL;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
