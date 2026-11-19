import * as THREE from 'three';

export const meta = {
  id: 'ks23m',
  code: 'КС-23М',
  title: 'КС-23М «Дрозд»',
  subtitle: 'КРУПНОКАЛИБЕРНАЯ ШТУРМОВАЯ КАРТЕЧНАЯ ПУШКА • СЛОТ MAIN • ВЫСТРЕЛ / 2.1 С',
  description:
    'Крупнокалиберная штурмовая картечная пушка: плита УСП с полосами опасности, фрезерованная ствольная коробка с окном выброса и патроном 23×75Р, наклонный коробчатый магазин «КС-23М / КАРТЕЧЬ» на 8 патронов, откатной толстостенный ствол с рёбрами, демпфером и раструбом-компенсатором.',
  specs: [
    ['Калибр', '23×75Р, картечь'],
    ['Откат ствола', '145 мм'],
    ['Темп', 'Выстрел / 2.1 с'],
    ['Магазин', 'Коробчатый, 8 патр.'],
    ['Длина модуля', '2.45 м'],
    ['Слот', 'MAIN'],
  ],
  maxExtension: 0.145,
  unit: 'mm',
  tipOffset: 1.85,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'receiverAndMag', label: '2. Ствольная коробка и магазин' },
    { key: 'boxMagazineAssembly', label: '3. Магазин «КС-23М / КАРТЕЧЬ»' },
    { key: 'shotgunBarrelGroup', label: '4. Откатной ствол и ДТК' },
    { key: 'muzzleCompensator', label: '5. Раструб-компенсатор' },
  ],
  cameras: {
    module: { pos: [2.35, 0.55, 2.6], target: [0, -0.35, 0.6] },
  },
  rangeMarkers: [],
  controls: 'volley',
  volley: {
    mode: 'single',
    shotPeriod: 2.1,
    recoilTime: 0.055,
    holdTime: 0.02,
    returnTime: 0.6,
    heatPerShot: 0.06,
    coolRate: 0.08,
  },
  drive: {
    title: 'Помпа и накат',
    caption: 'ОТКАТ СТВОЛА',
    fire: 'ВЫСТРЕЛ',
  },
};

const MAX_RECOIL = 0.145;
const RET_TIME = 0.055;
const HOLD_TIME = 0.02;
const RETURN_TIME = 0.6;

/**
 * Создаёт процедурную 3D-модель крупнокалиберной штурмовой картечной пушки КС-23М «Дрозд» (слот MAIN).
 * Система координат: 1 unit = 1 метр, ствол направлен вдоль +Z, верх +Y, бок +X.
 * Точка привязки (0, 0, 0) — центр верхнего фланца УСП.
 * Общая длина модуля: 2.45 м (от z = -0.60 м до z = +1.85 м).
 *
 * @returns {THREE.Group} Корневая группа модуля вооружения
 */
export function createWeaponKS23MDrozd() {
  const root = new THREE.Group();
  root.name = 'Weapon_KS23M_Drozd';

  // ============================================================================
  // 1. ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (CanvasTexture — без внешних ассетов)
  // ============================================================================

  // Текстура потёртостей и микрорельефа для грунта и воронёной стали
  function createMetalWearTexture({ baseHex = '#808080', contrast = 42, scratches = 260, size = 512 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);

    // Зернистость краски / фрезеровки
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < data.length; i += 4) {
      const n = (rand() - 0.5) * contrast;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Металлические потёртости и царапины
    for (let i = 0; i < scratches; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const len = 8 + rand() * 55;
      const ang = (rand() - 0.5) * 0.45;
      ctx.strokeStyle = rand() > 0.45 ? 'rgba(235, 240, 245, 0.22)' : 'rgba(20, 22, 25, 0.28)';
      ctx.lineWidth = 0.6 + rand() * 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  // Текстура жёлто-чёрной полосы опасности для плиты УСП
  function createHazardStripeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#e2a308';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#181a1d';
    const stripeW = 48;
    for (let x = -canvas.height; x < canvas.width + canvas.height; x += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW - canvas.height, canvas.height);
      ctx.lineTo(x - canvas.height, canvas.height);
      ctx.closePath();
      ctx.fill();
    }

    // Тёмная металлическая окантовка и потёртости
    ctx.strokeStyle = '#141618';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(40, 44, 48, 0.18)';
    for (let i = 0; i < 180; i++) {
      ctx.fillRect((i * 73) % canvas.width, (i * 29) % canvas.height, 6 + (i % 14), 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // Трафарет «КС-23М / КАРТЕЧЬ» для коробчатого магазина
  function createMagStencilTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Фон под основной грунт магазина (#565c62)
    ctx.fillStyle = '#565c62';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Потёртости краски на трафаретной пластине
    ctx.fillStyle = 'rgba(30, 33, 37, 0.16)';
    for (let i = 0; i < 240; i++) {
      ctx.fillRect((i * 97) % 512, (i * 53) % 512, 4 + (i % 16), 2 + (i % 4));
    }

    // Рамка тактической маркировки
    ctx.strokeStyle = 'rgba(232, 234, 224, 0.78)';
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 28, 464, 456);

    // Верхняя тех. полоса
    ctx.fillStyle = 'rgba(218, 165, 32, 0.85)';
    ctx.fillRect(36, 42, 440, 18);

    // Основной трафарет «КС-23М / КАРТЕЧЬ»
    ctx.fillStyle = 'rgba(236, 238, 228, 0.88)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '900 84px "Arial Black", Impact, sans-serif';
    ctx.fillText('КС-23М', 256, 155);

    // Разделитель
    ctx.fillRect(58, 222, 396, 6);

    ctx.font = '900 72px "Arial Black", Impact, sans-serif';
    ctx.fillText('КАРТЕЧЬ', 256, 305);

    ctx.font = '700 34px monospace';
    ctx.fillStyle = 'rgba(225, 228, 218, 0.72)';
    ctx.fillText('23×75Р // СЛ-М', 256, 395);
    ctx.fillText('8 ПАТР.  СБ. №04', 256, 442);

    // Имитация облупившейся краски поверх текста
    ctx.fillStyle = '#565c62';
    for (let i = 0; i < 65; i++) {
      const rx = 40 + ((i * 89) % 430);
      const ry = 70 + ((i * 67) % 390);
      ctx.fillRect(rx, ry, 5 + (i % 12), 2 + (i % 3));
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // ============================================================================
  // 2. PBR-МАТЕРИАЛЫ
  // ============================================================================
  const wearRoughnessTex = createMetalWearTexture({ baseHex: '#9a9a9a', contrast: 55, scratches: 320 });
  const fineBrushTex = createMetalWearTexture({ baseHex: '#888888', contrast: 30, scratches: 180 });
  const hazardTex = createHazardStripeTexture();
  const magStencilTex = createMagStencilTexture();

  // Ствольная коробка и магазин: серо-стальной грунт с потёртостями (#565c62)
  const receiverAndMagMat = new THREE.MeshStandardMaterial({
    color: 0x565c62,
    metalness: 0.55,
    roughness: 0.60,
    roughnessMap: wearRoughnessTex,
    bumpMap: wearRoughnessTex,
    bumpScale: 0.0025
  });

  // Ствол и компенсатор: тёмная воронёная сталь (#23262a)
  const bluedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x23262a,
    metalness: 0.88,
    roughness: 0.34,
    roughnessMap: fineBrushTex,
    bumpMap: fineBrushTex,
    bumpScale: 0.0012
  });

  // Плита УСП и силовые кронштейны
  const uspSteelMat = new THREE.MeshStandardMaterial({
    color: 0x3b4046,
    metalness: 0.72,
    roughness: 0.46,
    roughnessMap: wearRoughnessTex,
    bumpMap: wearRoughnessTex,
    bumpScale: 0.002
  });

  // Жёлто-чёрная полоса опасности УСП
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    metalness: 0.35,
    roughness: 0.52
  });

  // Трафаретная панель магазина
  const magStencilMat = new THREE.MeshStandardMaterial({
    map: magStencilTex,
    metalness: 0.52,
    roughness: 0.62,
    bumpMap: wearRoughnessTex,
    bumpScale: 0.0015
  });

  // Фрезерованный светлый металл (затвор, направляющая пружины, штифты замков)
  const machinedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x9aa2ab,
    metalness: 0.90,
    roughness: 0.24
  });

  // Глубокий тёмный канал ствола и прорези газосброса
  const darkCavityMat = new THREE.MeshStandardMaterial({
    color: 0x0b0c0e,
    metalness: 0.4,
    roughness: 0.85
  });

  // Гильза 23 мм в окне выброса (латунный донец + красная гильза)
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc2953e,
    metalness: 0.88,
    roughness: 0.26
  });
  const shellHullMat = new THREE.MeshStandardMaterial({
    color: 0x8f241e,
    metalness: 0.12,
    roughness: 0.48
  });

  // ============================================================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ГЕОМЕТРИИ И КРЕПЕЖА
  // ============================================================================
  const receiverRivets = [];
  const receiverBolts = [];
  const barrelBolts = [];

  function registerFastener(list, x, y, z, rx = 0, ry = 0, rz = 0, scale = 1) {
    const dummy = new THREE.Object3D();
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    list.push(dummy.matrix.clone());
  }

  function buildInstancedFasteners(matrices, geometry, material, name) {
    const inst = new THREE.InstancedMesh(geometry, material, matrices.length);
    inst.name = name;
    matrices.forEach((mat, i) => inst.setMatrixAt(i, mat));
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    inst.receiveShadow = true;
    return inst;
  }

  // ============================================================================
  // УЗЕЛ 1: СТЫКОВОЧНЫЙ УЗЕЛ УСП (mountFlange)
  // ============================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';

  // Основная стальная плита УСП: 0.50 (X) x 0.14 (Y) x 0.80 (Z), верхняя плоскость строго на Y = 0
  const flangePlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.14, 0.80),
    uspSteelMat
  );
  flangePlate.position.set(0, -0.07, 0);
  flangePlate.castShadow = true;
  flangePlate.receiveShadow = true;
  mountFlange.add(flangePlate);

  // Верхняя центрирующая направляющая планка УСП
  const topGuideBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.012, 0.72),
    machinedSteelMat
  );
  topGuideBar.position.set(0, 0.004, 0);
  mountFlange.add(topGuideBar);

  // Боковые накладки с жёлто-чёрной полосой опасности (CanvasTexture)
  const sideHazardGeo = new THREE.BoxGeometry(0.008, 0.068, 0.76);
  [-1, 1].forEach((side) => {
    const strip = new THREE.Mesh(sideHazardGeo, hazardMat);
    strip.position.set(side * 0.252, -0.07, 0);
    mountFlange.add(strip);

    // Боковые силовые рёбра поверх плиты
    for (const zOff of [-0.34, 0, 0.34]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.136, 0.045), uspSteelMat);
      rib.position.set(side * 0.254, -0.07, zOff);
      mountFlange.add(rib);
    }
  });

  // Торцевые полосы опасности (передний и задний скос плиты)
  const endHazardGeo = new THREE.BoxGeometry(0.46, 0.056, 0.008);
  [-1, 1].forEach((end) => {
    const endStrip = new THREE.Mesh(endHazardGeo, hazardMat);
    endStrip.position.set(0, -0.07, end * 0.402);
    mountFlange.add(endStrip);
  });

  // 4 силовых замка УСП по углам плиты
  const lockPositions = [
    [-0.205, -0.07, -0.27],
    [0.205, -0.07, -0.27],
    [-0.205, -0.07, 0.27],
    [0.205, -0.07, 0.27]
  ];

  lockPositions.forEach(([lx, ly, lz]) => {
    const lockGroup = new THREE.Group();
    lockGroup.position.set(lx, ly, lz);

    // Корпус замка
    const lockHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.146, 0.11),
      bluedSteelMat
    );
    lockGroup.add(lockHousing);

    // Вертикальный стыковочный штифт, выступающий над плоскостью УСП
    const lockPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.020, 0.022, 0.168, 16),
      machinedSteelMat
    );
    lockPin.position.y = 0.008;
    lockGroup.add(lockPin);

    // Боковой эксцентриковый рычаг-фиксатор
    const sideSign = Math.sign(lx);
    const latchLever = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.036, 0.082),
      machinedSteelMat
    );
    latchLever.position.set(sideSign * 0.052, -0.005, 0);
    lockGroup.add(latchLever);

    // Болты крепления замка
    registerFastener(receiverBolts, lx - 0.028, 0.002, lz - 0.038, 0, 0, 0, 1.0);
    registerFastener(receiverBolts, lx + 0.028, 0.002, lz + 0.038, 0, 0, 0, 1.0);

    mountFlange.add(lockGroup);
  });

  // Переходной силовой пилон-амортизатор от плиты УСП (-0.14) к ствольной коробке (-0.21)
  const neckBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.075, 0.68),
    uspSteelMat
  );
  neckBlock.position.set(0, -0.175, -0.02);
  neckBlock.castShadow = true;
  mountFlange.add(neckBlock);

  for (let z = -0.30; z <= 0.26; z += 0.14) {
    const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.068, 0.032), uspSteelMat);
    gusset.position.set(0, -0.174, z);
    mountFlange.add(gusset);
    registerFastener(receiverBolts, -0.176, -0.174, z, 0, 0, Math.PI / 2, 1.1);
    registerFastener(receiverBolts, 0.176, -0.174, z, 0, 0, -Math.PI / 2, 1.1);
  }

  root.add(mountFlange);

  // ============================================================================
  // УЗЕЛ 2: МАССИВНАЯ СТВОЛЬНАЯ КОРОБКА И МАГАЗИН (receiverAndMag)
  // ============================================================================
  const receiverAndMag = new THREE.Group();
  receiverAndMag.name = 'receiverAndMag';

  // Профиль фрезерованной ствольной коробки (короткая, высокая, широкая со скошенными гранями)
  const rxW = 0.175; // полуширина -> общая ширина 0.35 м
  const rxTop = -0.20;
  const rxBot = -0.58; // высота 0.38 м
  const cham = 0.038;

  const receiverShape = new THREE.Shape();
  receiverShape.moveTo(-rxW + cham, rxTop);
  receiverShape.lineTo(rxW - cham, rxTop);
  receiverShape.lineTo(rxW, rxTop - cham);
  receiverShape.lineTo(rxW, rxBot + cham);
  receiverShape.lineTo(rxW - cham, rxBot);
  receiverShape.lineTo(-rxW + cham, rxBot);
  receiverShape.lineTo(-rxW, rxBot + cham);
  receiverShape.lineTo(-rxW, rxTop - cham);
  receiverShape.closePath();

  const receiverLength = 1.06; // от z = -0.54 до z = +0.52
  const receiverGeo = new THREE.ExtrudeGeometry(receiverShape, {
    depth: receiverLength,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.008,
    bevelSegments: 2
  });
  receiverGeo.translate(0, 0, -0.54);

  const receiverBody = new THREE.Mesh(receiverGeo, receiverAndMagMat);
  receiverBody.castShadow = true;
  receiverBody.receiveShadow = true;
  receiverAndMag.add(receiverBody);

  // Задний бронеколпак / буфер отдачи (доходит ровно до z = -0.60 м)
  const rearCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.31, 0.32, 0.06),
    bluedSteelMat
  );
  rearCap.position.set(0, -0.39, -0.57);
  rearCap.castShadow = true;
  receiverAndMag.add(rearCap);

  const rearBufferCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.075, 0.045, 20),
    uspSteelMat
  );
  rearBufferCylinder.rotation.x = Math.PI / 2;
  rearBufferCylinder.position.set(0, -0.34, -0.595);
  receiverAndMag.add(rearBufferCylinder);

  // Передний массивный вкладыш-муфта ствола (ствольная муфта с рёбрами)
  const frontTrunnion = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.34, 0.11),
    uspSteelMat
  );
  frontTrunnion.position.set(0, -0.39, 0.53);
  frontTrunnion.castShadow = true;
  receiverAndMag.add(frontTrunnion);

  const trunnionCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.102, 0.09, 24),
    bluedSteelMat
  );
  trunnionCollar.rotation.x = Math.PI / 2;
  trunnionCollar.position.set(0, -0.34, 0.59);
  receiverAndMag.add(trunnionCollar);

  // Боковые выштампованные рёбра жёсткости на левой (-X) и правой (+X) стенках коробки
  for (let i = 0; i < 3; i++) {
    const yRib = -0.28 - i * 0.095;
    const leftRib = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.026, 0.88),
      receiverAndMagMat
    );
    leftRib.position.set(-rxW - 0.008, yRib, -0.02);
    receiverAndMag.add(leftRib);
  }

  // Крупное окно выброса гильз на правой стороне (+X)
  const portGroup = new THREE.Group();
  portGroup.position.set(rxW + 0.004, -0.335, 0.18);

  // Фрезерованный отражатель/рамка окна выброса
  const portFrameTop = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.34), uspSteelMat);
  portFrameTop.position.set(0.004, 0.068, 0);
  const portFrameBot = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.34), uspSteelMat);
  portFrameBot.position.set(0.004, -0.068, 0);
  const portDeflector = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.14, 0.028), uspSteelMat);
  portDeflector.position.set(0.012, 0, -0.175);
  portDeflector.rotation.y = 0.28;
  portGroup.add(portFrameTop, portFrameBot, portDeflector);

  // Тёмная ниша окна выброса
  const portRecess = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.118, 0.31),
    darkCavityMat
  );
  portRecess.position.set(0.002, 0, 0);
  portGroup.add(portRecess);

  // Видимый остов затвора и крупный патрон 23×75 мм внутри окна выброса
  const boltFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.105, 0.13),
    machinedSteelMat
  );
  boltFace.position.set(-0.002, 0, -0.085);
  portGroup.add(boltFace);

  const chamberedShellGroup = new THREE.Group();
  chamberedShellGroup.position.set(0.001, -0.008, 0.065);
  chamberedShellGroup.rotation.x = Math.PI / 2;

  const shellCase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.115, 16),
    shellHullMat
  );
  shellCase.position.y = 0.015;
  const shellBrass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0172, 0.0175, 0.038, 16),
    brassMat
  );
  shellBrass.position.y = -0.055;
  chamberedShellGroup.add(shellCase, shellBrass);
  portGroup.add(chamberedShellGroup);

  receiverAndMag.add(portGroup);

  // Массивная рукоятка перезарядки на правой стороне (+X)
  const chargingSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.026, 0.44),
    darkCavityMat
  );
  chargingSlot.position.set(rxW + 0.004, -0.355, -0.18);
  receiverAndMag.add(chargingSlot);

  const chargingHandleGroup = new THREE.Group();
  chargingHandleGroup.name = 'chargingHandle';
  chargingHandleGroup.position.set(rxW + 0.01, -0.355, -0.04);

  const handleStem = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.026, 0.032),
    bluedSteelMat
  );
  handleStem.position.x = 0.028;

  const handleKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.020, 0.068, 18),
    machinedSteelMat
  );
  handleKnob.rotation.z = Math.PI / 2;
  handleKnob.position.x = 0.072;

  const handleEndCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.012, 18),
    bluedSteelMat
  );
  handleEndCap.rotation.z = Math.PI / 2;
  handleEndCap.position.x = 0.108;

  chargingHandleGroup.add(handleStem, handleKnob, handleEndCap);
  receiverAndMag.add(chargingHandleGroup);

  // Подствольный электромеханический привод спуска (соленоид турели/носителя)
  const solenoidHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.10, 0.34),
    uspSteelMat
  );
  solenoidHousing.position.set(0.04, -0.62, -0.28);
  solenoidHousing.castShadow = true;
  receiverAndMag.add(solenoidHousing);

  // ----------------------------------------------------------------------------
  // ПРИСТЁГНУТЫЙ СНИЗУ-СБОКУ КРУПНЫЙ КОРОБЧАТЫЙ МАГАЗИН («КС-23М / КАРТЕЧЬ»)
  // ----------------------------------------------------------------------------
  const magAssembly = new THREE.Group();
  magAssembly.name = 'boxMagazineAssembly';
  // Крепится снизу-слева (-X, -Y) под углом 34°, чтобы не перекрывать подствольный демпфер
  magAssembly.position.set(-0.115, -0.535, 0.17);
  magAssembly.rotation.z = -0.58; // ~33.2 градуса влево-вниз

  // Приёмная шахта магазина (горловина с рёбрами и защёлкой)
  const magWell = new THREE.Mesh(
    new THREE.BoxGeometry(0.175, 0.13, 0.305),
    uspSteelMat
  );
  magWell.position.set(0, -0.04, 0);
  magWell.castShadow = true;
  magAssembly.add(magWell);

  // Рычаг защёлки магазина
  const magCatch = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.055, 0.036),
    machinedSteelMat
  );
  magCatch.position.set(0, -0.095, -0.165);
  magAssembly.add(magCatch);

  // Основной корпус коробчатого магазина
  const magWidthX = 0.132;
  const magLengthY = 0.56;
  const magDepthZ = 0.265;

  const magBody = new THREE.Mesh(
    new THREE.BoxGeometry(magWidthX, magLengthY, magDepthZ),
    receiverAndMagMat
  );
  magBody.position.set(0, -0.34, 0);
  magBody.castShadow = true;
  magBody.receiveShadow = true;
  magAssembly.add(magBody);

  // Переднее и заднее продольные рёбра жёсткости магазина
  [-1, 1].forEach((zDir) => {
    const edgeSpine = new THREE.Mesh(
      new THREE.BoxGeometry(magWidthX + 0.014, magLengthY - 0.02, 0.028),
      bluedSteelMat
    );
    edgeSpine.position.set(0, -0.34, zDir * (magDepthZ * 0.5 - 0.01));
    magAssembly.add(edgeSpine);
  });

  // Выштампованные вертикальные рёбра жёсткости на обеих широких стенках магазина
  for (const zRib of [-0.075, 0.0, 0.075]) {
    const ribMesh = new THREE.Mesh(
      new THREE.BoxGeometry(magWidthX + 0.022, magLengthY - 0.09, 0.020),
      receiverAndMagMat
    );
    ribMesh.position.set(0, -0.34, zRib);
    magAssembly.add(ribMesh);

    // Заклёпки вдоль рёбер магазина
    for (let yRiv = -0.15; yRiv >= -0.53; yRiv -= 0.125) {
      const localLeft = new THREE.Vector3(-(magWidthX * 0.5 + 0.011), yRiv, zRib);
      const localRight = new THREE.Vector3(magWidthX * 0.5 + 0.011, yRiv, zRib);
      magAssembly.updateMatrixWorld(true);
      localLeft.applyMatrix4(magAssembly.matrix);
      localRight.applyMatrix4(magAssembly.matrix);
      registerFastener(receiverRivets, localLeft.x, localLeft.y, localLeft.z, 0, 0, Math.PI / 2 - 0.58, 0.85);
      registerFastener(receiverRivets, localRight.x, localRight.y, localRight.z, 0, 0, -Math.PI / 2 - 0.58, 0.85);
    }
  }

  // Трафаретные панели «КС-23М / КАРТЕЧЬ» на обеих боковых гранях магазина
  const stencilGeo = new THREE.PlaneGeometry(0.215, 0.235);

  // Левая внешняя грань магазина (-X в локальных координатах магазина)
  const leftStencil = new THREE.Mesh(stencilGeo, magStencilMat);
  leftStencil.position.set(-(magWidthX * 0.5 + 0.0125), -0.34, 0);
  leftStencil.rotation.y = -Math.PI / 2;
  magAssembly.add(leftStencil);

  // Правая внутренняя грань магазина (+X в локальных координатах магазина)
  const rightStencil = new THREE.Mesh(stencilGeo, magStencilMat);
  rightStencil.position.set(magWidthX * 0.5 + 0.0125, -0.34, 0);
  rightStencil.rotation.y = Math.PI / 2;
  magAssembly.add(rightStencil);

  // Массивная штампованная пятка магазина (нижняя крышка)
  const magFloorPlate = new THREE.Mesh(
    new THREE.BoxGeometry(magWidthX + 0.028, 0.032, magDepthZ + 0.026),
    bluedSteelMat
  );
  magFloorPlate.position.set(0, -0.625, 0);
  magFloorPlate.castShadow = true;
  magAssembly.add(magFloorPlate);

  receiverAndMag.add(magAssembly);

  // Размещение заклёпок по периметру ствольной коробки и задней плиты
  for (let z = -0.50; z <= 0.48; z += 0.14) {
    registerFastener(receiverRivets, -rxW - 0.008, -0.235, z, 0, 0, Math.PI / 2, 1.0);
    registerFastener(receiverRivets, -rxW - 0.008, -0.545, z, 0, 0, Math.PI / 2, 1.0);
    registerFastener(receiverRivets, rxW + 0.008, -0.235, z, 0, 0, -Math.PI / 2, 1.0);
    registerFastener(receiverRivets, rxW + 0.008, -0.545, z, 0, 0, -Math.PI / 2, 1.0);
  }
  for (const bx of [-0.11, 0.11]) {
    for (const by of [-0.27, -0.49]) {
      registerFastener(receiverBolts, bx, by, -0.602, -Math.PI / 2, 0, 0, 1.15);
    }
  }

  root.add(receiverAndMag);

  // ============================================================================
  // УЗЕЛ 3: ТОЛСТОСТЕННЫЙ СТВОЛ С ДЕМПФЕРОМ (shotgunBarrelGroup — откат по -Z)
  // ============================================================================
  const shotgunBarrelGroup = new THREE.Group();
  shotgunBarrelGroup.name = 'shotgunBarrelGroup';

  const barrelY = -0.34;
  const damperY = -0.495;

  // 1) Казённая утолщённая часть ствола (уходит внутрь коробки до z = 0.30, чтобы не обнажаться при откате)
  const breechBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.080, 0.082, 0.56, 28),
    bluedSteelMat
  );
  breechBarrel.rotation.x = Math.PI / 2;
  breechBarrel.position.set(0, barrelY, 0.58);
  breechBarrel.castShadow = true;
  shotgunBarrelGroup.add(breechBarrel);

  // Ступенчатый силовой переходник ствола
  const barrelStepRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.080, 0.05, 28),
    uspSteelMat
  );
  barrelStepRing.rotation.x = Math.PI / 2;
  barrelStepRing.position.set(0, barrelY, 0.88);
  shotgunBarrelGroup.add(barrelStepRing);

  // 2) Основной толстостенный ствол большого калибра (от z = 0.88 до z = 1.56)
  const mainBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.066, 0.068, 0.68, 32),
    bluedSteelMat
  );
  mainBarrel.rotation.x = Math.PI / 2;
  mainBarrel.position.set(0, barrelY, 1.22);
  mainBarrel.castShadow = true;
  shotgunBarrelGroup.add(mainBarrel);

  // 8 продольных рёбер жёсткости по окружности толстостенного ствола
  const ribCount = 8;
  const barrelRibGeo = new THREE.BoxGeometry(0.014, 0.022, 0.64);
  for (let i = 0; i < ribCount; i++) {
    const angle = (i / ribCount) * Math.PI * 2 + Math.PI / 8;
    const rib = new THREE.Mesh(barrelRibGeo, bluedSteelMat);
    const rDist = 0.069;
    rib.position.set(
      Math.cos(angle) * rDist,
      barrelY + Math.sin(angle) * rDist,
      1.21
    );
    rib.rotation.z = angle - Math.PI / 2;
    rib.castShadow = true;
    shotgunBarrelGroup.add(rib);
  }

  // 3) Подствольная трубчатая направляющая возвратной пружины и демпфер
  // Внутренний полированный шток направляющей
  const guideRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.020, 0.020, 1.12, 18),
    machinedSteelMat
  );
  guideRod.rotation.x = Math.PI / 2;
  guideRod.position.set(0, damperY, 0.90);
  shotgunBarrelGroup.add(guideRod);

  // Задний цилиндр гидродемпфера (выходит из переднего вкладыша коробки)
  const damperCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.040, 0.44, 22),
    uspSteelMat
  );
  damperCylinder.rotation.x = Math.PI / 2;
  damperCylinder.position.set(0, damperY, 0.62);
  damperCylinder.castShadow = true;
  shotgunBarrelGroup.add(damperCylinder);

  // Витая силовая возвратная пружина вокруг направляющей (z = 0.85 .. 1.44)
  class RecoilSpringCurve extends THREE.Curve {
    constructor(radius, length, turns) {
      super();
      this.radius = radius;
      this.length = length;
      this.turns = turns;
    }
    getPoint(t) {
      const ang = t * Math.PI * 2 * this.turns;
      return new THREE.Vector3(
        Math.cos(ang) * this.radius,
        Math.sin(ang) * this.radius,
        t * this.length
      );
    }
  }

  const springCurve = new RecoilSpringCurve(0.031, 0.58, 17);
  const springGeo = new THREE.TubeGeometry(springCurve, 220, 0.0055, 8, false);
  const recoilSpring = new THREE.Mesh(springGeo, machinedSteelMat);
  recoilSpring.position.set(0, damperY, 0.85);
  shotgunBarrelGroup.add(recoilSpring);

  // Перфорированный полукожух возвратной пружины (защитная трубка с окнами)
  const shroudArc = new THREE.CylinderGeometry(
    0.041,
    0.041,
    0.56,
    24,
    1,
    true,
    Math.PI * 0.62,
    Math.PI * 0.76
  );
  const bottomShroud = new THREE.Mesh(shroudArc, bluedSteelMat);
  bottomShroud.rotation.x = Math.PI / 2;
  bottomShroud.position.set(0, damperY, 1.14);
  shotgunBarrelGroup.add(bottomShroud);

  // Передняя заглушка-гайка направляющей возвратной пружины
  const damperFrontCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.055, 20),
    bluedSteelMat
  );
  damperFrontCap.rotation.x = Math.PI / 2;
  damperFrontCap.position.set(0, damperY, 1.46);
  shotgunBarrelGroup.add(damperFrontCap);

  // Два массивных хомута-восьмёрки, связывающих ствол и трубчатую направляющую
  for (const zClamp of [0.86, 1.42]) {
    const clampBridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.17, 0.042),
      uspSteelMat
    );
    clampBridge.position.set(0, (barrelY + damperY) * 0.5, zClamp);
    clampBridge.castShadow = true;
    shotgunBarrelGroup.add(clampBridge);

    const upperRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.078, 0.044, 24),
      uspSteelMat
    );
    upperRing.rotation.x = Math.PI / 2;
    upperRing.position.set(0, barrelY, zClamp);
    shotgunBarrelGroup.add(upperRing);

    const lowerRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.046, 0.044, 20),
      uspSteelMat
    );
    lowerRing.rotation.x = Math.PI / 2;
    lowerRing.position.set(0, damperY, zClamp);
    shotgunBarrelGroup.add(lowerRing);

    // Стяжные болты хомутов (двигаются вместе с shotgunBarrelGroup)
    registerFastener(barrelBolts, -0.052, (barrelY + damperY) * 0.5, zClamp, 0, 0, Math.PI / 2, 1.0);
    registerFastener(barrelBolts, 0.052, (barrelY + damperY) * 0.5, zClamp, 0, 0, -Math.PI / 2, 1.0);
  }

  // 4) Массивный раструб-компенсатор с боковыми прорезями на дульном срезе (z = 1.54 .. 1.85 м)
  const muzzleGroup = new THREE.Group();
  muzzleGroup.name = 'muzzleCompensator';
  muzzleGroup.position.set(0, barrelY, 1.55);

  // Резьбовая муфта фиксации ДТК
  const muzzleCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.076, 0.055, 24),
    uspSteelMat
  );
  muzzleCollar.rotation.x = Math.PI / 2;
  muzzleCollar.position.z = 0.025;
  muzzleGroup.add(muzzleCollar);

  // Основной корпус раструба-компенсатора (от z = 0.05 до z = 0.30 -> абсолютный Z = 1.85 м)
  const brakeLength = 0.25;
  const brakeBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.104, 0.078, brakeLength, 8),
    bluedSteelMat
  );
  brakeBody.rotation.x = Math.PI / 2;
  brakeBody.rotation.y = Math.PI / 8;
  brakeBody.position.z = 0.05 + brakeLength * 0.5;
  brakeBody.castShadow = true;
  muzzleGroup.add(brakeBody);

  // Усиленный дульный обод на самом срезе (z_abs = 1.85 м)
  const muzzleCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.108, 0.105, 0.032, 8),
    bluedSteelMat
  );
  muzzleCrown.rotation.x = Math.PI / 2;
  muzzleCrown.rotation.y = Math.PI / 8;
  muzzleCrown.position.z = 0.284;
  muzzleGroup.add(muzzleCrown);

  // Глубокий дульный канал 23-мм ствола
  const boreHole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.026, 0.08, 24),
    darkCavityMat
  );
  boreHole.rotation.x = Math.PI / 2;
  boreHole.position.z = 0.262;
  muzzleGroup.add(boreHole);

  // 3 пары боковых прорезей (жаберных окон) компенсатора с обеих сторон (±X)
  for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
    const zSlot = 0.095 + slotIdx * 0.062;
    const slotH = 0.078 + slotIdx * 0.008;
    const slotW = 0.175 + slotIdx * 0.016;

    // Сквозная тёмная камера газосброса
    const gasChamber = new THREE.Mesh(
      new THREE.BoxGeometry(slotW, slotH, 0.034),
      darkCavityMat
    );
    gasChamber.position.set(0, 0, zSlot);
    gasChamber.rotation.y = 0.16; // лёгкий наклон жаберных щелей назад
    muzzleGroup.add(gasChamber);

    // Верхние и нижние стальные перемычки-дефлекторы прорезей
    [-1, 1].forEach((side) => {
      const gillRim = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, slotH + 0.014, 0.042),
        uspSteelMat
      );
      gillRim.position.set(side * (slotW * 0.49), 0, zSlot);
      muzzleGroup.add(gillRim);
    });
  }

  // Болты крепления муфты ДТК
  registerFastener(barrelBolts, -0.078, 0, 1.575, 0, 0, Math.PI / 2, 0.95);
  registerFastener(barrelBolts, 0.078, 0, 1.575, 0, 0, -Math.PI / 2, 0.95);

  shotgunBarrelGroup.add(muzzleGroup);
  root.add(shotgunBarrelGroup);

  // ============================================================================
  // 4. КРЕПЁЖ ЧЕРЕЗ THREE.InstancedMesh (ЗАКЛЁПКИ И ВИНТЫ)
  // ============================================================================
  const rivetGeo = new THREE.SphereGeometry(0.0065, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const boltGeo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.007, 6);

  const instancedRivets = buildInstancedFasteners(
    receiverRivets,
    rivetGeo,
    machinedSteelMat,
    'instancedRivets'
  );
  const instancedReceiverBolts = buildInstancedFasteners(
    receiverBolts,
    boltGeo,
    machinedSteelMat,
    'instancedReceiverBolts'
  );
  const instancedBarrelBolts = buildInstancedFasteners(
    barrelBolts,
    boltGeo,
    machinedSteelMat,
    'instancedBarrelBolts'
  );

  receiverAndMag.add(instancedRivets);
  receiverAndMag.add(instancedReceiverBolts);
  shotgunBarrelGroup.add(instancedBarrelBolts);

  return root;
}

// ============================================================================
// Адаптер под единый просмотрщик: одиночный выстрел 23 мм, откат 0..0.145 м.
// applyVolley(t): резкий откат → удержание → накат, вспышка. Возвращает { recoil, flash }.
// ============================================================================
export function createWeapon() {
  const root = createWeaponKS23MDrozd();
  const ud = root.userData;
  const barrel = root.getObjectByName('shotgunBarrelGroup');
  const chargingHandle = root.getObjectByName('chargingHandle');
  const baseBarrelZ = barrel ? barrel.position.z : 0;
  const baseHandleZ = chargingHandle ? chargingHandle.position.z : -0.04;

  // Дульная вспышка: свет + видимый конус (вершина вперёд от среза z = 1.85)
  const flashLight = new THREE.PointLight(0xff8c24, 0, 4.5, 1.8);
  flashLight.position.set(0, -0.34, 1.94);
  root.add(flashLight);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffb347,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const flashCone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 16, 1, true), flashMat);
  flashCone.rotation.x = Math.PI / 2;
  flashCone.position.set(0, -0.34, 2.04);
  root.add(flashCone);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  // Детерминированная поза выстрела по времени t (с) — тот же профиль, что в index (single):
  // резкий откат (кубика) → короткое удержание → плавный накат (smoothstep).
  const pose = (t) => {
    let off = 0;
    let fl = 0;
    if (t < RET_TIME) {
      const p = t / RET_TIME;
      off = MAX_RECOIL * (1 - Math.pow(1 - p, 3));
      fl = Math.max(0, 1 - t / 0.09);
    } else if (t < RET_TIME + HOLD_TIME) {
      off = MAX_RECOIL;
      fl = Math.max(0, 1 - t / 0.09);
    } else if (t < RET_TIME + HOLD_TIME + RETURN_TIME) {
      const u = (t - RET_TIME - HOLD_TIME) / RETURN_TIME;
      off = MAX_RECOIL * (1 - (3 * u * u - 2 * u * u * u));
    }
    if (barrel) barrel.position.z = baseBarrelZ - off;
    if (chargingHandle) chargingHandle.position.z = baseHandleZ - off * 0.85;
    root.rotation.x = -0.006 * Math.max(0, fl);
    flashLight.intensity = 18 * fl;
    flashMat.opacity = 0.9 * fl;
    flashCone.scale.setScalar(0.8 + 0.5 * fl);
    return { recoil: off, flash: fl };
  };

  const resetPose = () => {
    if (barrel) barrel.position.z = baseBarrelZ;
    if (chargingHandle) chargingHandle.position.z = baseHandleZ;
    root.rotation.x = 0;
    flashLight.intensity = 0;
    flashMat.opacity = 0;
    flashCone.scale.setScalar(0.8);
    return { recoil: 0, flash: 0 };
  };

  ud.applyVolley = (t) => {
    if (t === null || t === undefined || t > 10) return resetPose();
    return pose(Math.max(0, t));
  };
  ud.setExtension = (recoil) => {
    const r = Math.max(0, Math.min(MAX_RECOIL, recoil));
    if (barrel) barrel.position.z = baseBarrelZ - r;
    if (chargingHandle) chargingHandle.position.z = baseHandleZ - r * 0.85;
    return r / MAX_RECOIL;
  };
  ud.setFlash = (k) => {
    const c = Math.max(0, Math.min(1, k));
    flashLight.intensity = 18.0 * c;
    flashMat.opacity = 0.9 * c;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
