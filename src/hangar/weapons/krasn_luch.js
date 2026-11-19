import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'krasn',
  code: 'КРАСНОПОЛЬ-Л',
  title: '«Краснополь-Л»',
  subtitle: 'ВЫСОКОТОЧНАЯ СНАЙПЕРСКАЯ СИСТЕМА • СЛОТ MAIN • ВЫСТРЕЛ / 4.0 С',
  description: 'Высокоточная снайперская система: усиленный фланец УСП, гиростабилизированный казённый блок с ОЛС и блоком накопителей, длинный термостабилизированный ствол на ажурной ферме с датчиками геометрии. Слежение ОЛС + одиночные выстрелы с откатом 120 мм.',
  specs: [
    ['Длина модуля', '~4.9 м'],
    ['Откат ствола', '120 мм'],
    ['Темп', 'Выстрел / 4.0 с'],
    ['Наведение', 'ОЛС слежение'],
    ['Стабилизация', 'Ферма + экраны'],
    ['Слот', 'MAIN'],
  ],
  maxExtension: 0.12,
  unit: 'mm',
  tipOffset: 4.10,
  subgroups: [
    { key: 'mountFlange', label: '1. Усиленный фланец УСП' },
    { key: 'breechAndSensor', label: '2. Казённый блок и ОЛС' },
    { key: 'stabilizedBarrel', label: '3. Ствол и ферма' },
  ],
  cameras: {
    module: { pos: [3.4, 1.4, 5.2], target: [0, 0.44, 1.6] },
  },
  rangeMarkers: [],
  controls: 'volley',
  volley: {
    mode: 'single',
    shotPeriod: 4.0,
    recoilTime: 0.06,
    holdTime: 0,
    returnTime: 0.6,
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

const MAX_RECOIL = 0.12;
const RET_TIME = 0.06;
const RETURN_TIME = 0.60;

/**
 * Создаёт процедурную текстуру жёлто-чёрной инженерной разметки УСП
 * с трафаретными обозначениями в советско-российской космической эстетике.
 */
function createHazardStripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Базовый технический жёлтый фон
  ctx.fillStyle = '#e0a512';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Диагональные чёрные полосы
  ctx.fillStyle = '#15171a';
  const stripeWidth = 44;
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += stripeWidth * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeWidth, 0);
    ctx.lineTo(x + stripeWidth - canvas.height, canvas.height);
    ctx.lineTo(x - canvas.height, canvas.height);
    ctx.closePath();
    ctx.fill();
  }

  // Тёмная верхняя/нижняя окантовка с техническими трафаретами
  ctx.fillStyle = '#1d2024';
  ctx.fillRect(0, 0, canvas.width, 46);
  ctx.fillRect(0, canvas.height - 46, canvas.width, 46);

  ctx.fillStyle = '#e8ecf0';
  ctx.font = 'bold 22px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('УСП-Т // СТЫКОВОЧНЫЙ КОНТУР // ГИДРОЗАМОК 1-6', 24, 24);
  ctx.fillText('ИЗД. КРАСНОПОЛЬ-Л  |  ОСЬ +Z  |  НЕ ВСТАВАТЬ', 24, canvas.height - 22);

  // Лёгкая эксплуатационная потёртость
  ctx.fillStyle = 'rgba(30, 34, 38, 0.14)';
  for (let i = 0; i < 180; i++) {
    const rx = (i * 73) % canvas.width;
    const ry = (i * 41) % canvas.height;
    ctx.fillRect(rx, ry, 10 + (i % 18), 3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Создаёт процедурную карту рельефа и швов термозащитной плитки («Буран»).
 */
function createBuranTileBumpTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(0, 0, 512, 512);

  const cols = 8;
  const rows = 8;
  const cellW = 512 / cols;
  const cellH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offsetX = (r % 2) * (cellW * 0.5);
      const x = ((c * cellW + offsetX) % 512);
      const y = r * cellH;
      const shade = 210 + ((r * 17 + c * 31) % 24);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);
    }
  }

  // Тёмные термокомпенсационные швы между керамическими плитками
  ctx.strokeStyle = '#585c62';
  ctx.lineWidth = 3;
  for (let r = 0; r <= rows; r++) {
    const y = r * cellH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();

    const offsetX = (r % 2) * (cellW * 0.5);
    for (let c = 0; c <= cols; c++) {
      const x = (c * cellW + offsetX) % 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + cellH);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 8;
  return tex;
}

/**
 * Создаёт палитру PBR-материалов системы «Краснополь-Л».
 */
function createKrasnopolMaterials() {
  const tileBump = createBuranTileBumpTexture();
  const hazardTex = createHazardStripeTexture();

  return {
    // Белая термоплитка («Буран»)
    buranTile: new THREE.MeshStandardMaterial({
      color: 0xd4d8dc,
      metalness: 0.25,
      roughness: 0.55,
      bumpMap: tileBump,
      bumpScale: 0.004,
    }),
    // Гладкие белые термоэкраны без крупной сетки
    buranSmooth: new THREE.MeshStandardMaterial({
      color: 0xd4d8dc,
      metalness: 0.25,
      roughness: 0.55,
    }),
    // Защитный хаки (советско-российская космическая/военная окраска)
    khaki: new THREE.MeshStandardMaterial({
      color: 0x4b5346,
      metalness: 0.32,
      roughness: 0.58,
    }),
    // Тёмная воронёная сталь (ствол, трубчатая ферма, силовые узлы)
    bluedSteel: new THREE.MeshStandardMaterial({
      color: 0x25282c,
      metalness: 0.85,
      roughness: 0.35,
    }),
    // Конструкционная серая сталь (плита УСП, силовые кронштейны)
    gunmetalSteel: new THREE.MeshStandardMaterial({
      color: 0x3b4046,
      metalness: 0.78,
      roughness: 0.42,
    }),
    // Хромированные штоки гидрозамков и амортизаторов
    chrome: new THREE.MeshStandardMaterial({
      color: 0xd0d6dc,
      metalness: 0.94,
      roughness: 0.16,
    }),
    // Медные шины и катушки накопителей энергии
    copper: new THREE.MeshStandardMaterial({
      color: 0xb86b35,
      metalness: 0.88,
      roughness: 0.28,
    }),
    // Тёмное сапфировое стекло (оптический шар ОЛС и датчики контроля геометрии)
    sapphireGlass: new THREE.MeshPhysicalMaterial({
      color: 0x182c42,
      metalness: 0.15,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.95,
    }),
    // Жёлто-чёрная предупреждающая разметка УСП
    hazardStripe: new THREE.MeshStandardMaterial({
      map: hazardTex,
      metalness: 0.3,
      roughness: 0.5,
    }),
    // Внутренний канал ствола / глубокие полости
    boreDark: new THREE.MeshStandardMaterial({
      color: 0x0d0f12,
      metalness: 0.6,
      roughness: 0.7,
    }),
    // Индикаторные элементы / световоды
    sensorGlow: new THREE.MeshStandardMaterial({
      color: 0x1e6ea8,
      emissive: 0x0d3b66,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    }),
  };
}

/**
 * Вспомогательная функция: заполняет InstancedMesh стержнями между парами точек [p1, p2].
 */
function buildInstancedStruts(pairs, radius, material, radialSegments = 8) {
  const geom = new THREE.CylinderGeometry(1, 1, 1, radialSegments, 1, false);
  const instanced = new THREE.InstancedMesh(geom, material, pairs.length);
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();

  pairs.forEach(([p1, p2], idx) => {
    dir.subVectors(p2, p1);
    const len = dir.length();
    dir.normalize();
    quat.setFromUnitVectors(up, dir);
    mid.addVectors(p1, p2).multiplyScalar(0.5);
    scale.set(radius, len, radius);
    matrix.compose(mid, quat, scale);
    instanced.setMatrixAt(idx, matrix);
  });

  instanced.instanceMatrix.needsUpdate = true;
  instanced.castShadow = true;
  instanced.receiveShadow = true;
  return instanced;
}

/**
 * 1. Усиленный стыковочный узел УСП (mountFlange)
 * Центр (0, 0, 0) — геометрический центр плиты 0.66 x 0.16 x 1.15 м.
 */
function buildMountFlange(mats) {
  const group = new THREE.Group();
  group.name = 'mountFlange';

  const width = 0.66;
  const height = 0.16;
  const length = 1.15;

  // Основной силовой массив плиты УСП (0.66 x 0.16 x 1.15 м)
  const corePlate = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.012, height - 0.016, length - 0.012),
    mats.gunmetalSteel
  );
  corePlate.castShadow = true;
  corePlate.receiveShadow = true;
  group.add(corePlate);

  // Верхняя и нижняя броневые накладки для точного внешнего габарита 0.66 x 0.16 x 1.15
  const topCap = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.008, length),
    mats.khaki
  );
  topCap.position.y = height * 0.5 - 0.004;
  topCap.castShadow = true;
  topCap.receiveShadow = true;
  group.add(topCap);

  const bottomCap = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.008, length),
    mats.bluedSteel
  );
  bottomCap.position.y = -height * 0.5 + 0.004;
  group.add(bottomCap);

  // Боковые и торцевые полосы жёлто-чёрной разметки (CanvasTexture)
  const sideBandGeom = new THREE.BoxGeometry(0.006, 0.088, length - 0.03);
  [-1, 1].forEach((side) => {
    const band = new THREE.Mesh(sideBandGeom, mats.hazardStripe);
    band.position.set(side * (width * 0.5 - 0.001), 0, 0);
    group.add(band);
  });

  const endBandGeom = new THREE.BoxGeometry(width - 0.03, 0.088, 0.006);
  [-1, 1].forEach((end) => {
    const band = new THREE.Mesh(endBandGeom, mats.hazardStripe);
    band.position.set(0, 0, end * (length * 0.5 - 0.001));
    group.add(band);
  });

  // Нижние стыковочные ловители / направляющие штифты УСП
  const pinGeom = new THREE.CylinderGeometry(0.022, 0.016, 0.036, 12);
  [
    [-0.22, -0.44],
    [0.22, -0.44],
    [-0.22, 0.44],
    [0.22, 0.44],
  ].forEach(([px, pz]) => {
    const pin = new THREE.Mesh(pinGeom, mats.chrome);
    pin.position.set(px, -height * 0.5 - 0.016, pz);
    group.add(pin);
  });

  // 6 гидрозамков (по 3 на левом и правом борту плиты УСП)
  const lockZPositions = [-0.38, 0.0, 0.38];
  const lockHousingGeom = new THREE.BoxGeometry(0.075, 0.135, 0.13);
  const actuatorCylGeom = new THREE.CylinderGeometry(0.026, 0.026, 0.11, 14);
  const pistonGeom = new THREE.CylinderGeometry(0.014, 0.014, 0.06, 12);
  const clawGeom = new THREE.BoxGeometry(0.055, 0.042, 0.085);

  [-1, 1].forEach((side) => {
    lockZPositions.forEach((lz) => {
      const lockUnit = new THREE.Group();
      lockUnit.position.set(side * (width * 0.5 - 0.01), 0.005, lz);

      // Силовой корпус гидрозамка
      const housing = new THREE.Mesh(lockHousingGeom, mats.bluedSteel);
      housing.castShadow = true;
      housing.receiveShadow = true;
      lockUnit.add(housing);

      // Вертикальный гидроцилиндр привода
      const cyl = new THREE.Mesh(actuatorCylGeom, mats.khaki);
      cyl.position.set(side * 0.012, 0.032, 0);
      cyl.castShadow = true;
      lockUnit.add(cyl);

      // Хромированный шток и верхняя крышка датчика закрытия
      const piston = new THREE.Mesh(pistonGeom, mats.chrome);
      piston.position.set(side * 0.012, 0.088, 0);
      lockUnit.add(piston);

      // Захватный кулачок замка
      const claw = new THREE.Mesh(clawGeom, mats.gunmetalSteel);
      claw.position.set(side * 0.028, -0.045, 0);
      lockUnit.add(claw);

      group.add(lockUnit);
    });

    // Продольная гидромагистраль высокого давления вдоль ряда замков
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.86, 10),
      mats.chrome
    );
    pipe.rotation.x = Math.PI * 0.5;
    pipe.position.set(side * (width * 0.5 - 0.048), height * 0.5 + 0.012, 0);
    group.add(pipe);
  });

  // Верхние продольные направляющие полозья стыковки с казённым блоком
  [-0.17, 0.17].forEach((rx) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.035, 1.02),
      mats.bluedSteel
    );
    rail.position.set(rx, height * 0.5 + 0.017, 0);
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);
  });

  return group;
}

/**
 * 2. Гиростабилизированный казённый блок и ОЛС (breechAndSensor)
 */
function buildBreechAndSensor(mats, barrelY) {
  const group = new THREE.Group();
  group.name = 'breechAndSensor';

  // --- А. Лафет гиростабилизации (связь между плитой УСП y=0.08 и казёнником) ---
  [-0.17, 0.17].forEach((tx) => {
    // Передняя и задняя силовые стойки цапф
    const rearPedestal = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.24, 0.26),
      mats.gunmetalSteel
    );
    rearPedestal.position.set(tx, 0.21, -0.34);
    rearPedestal.castShadow = true;
    rearPedestal.receiveShadow = true;
    group.add(rearPedestal);

    const frontPedestal = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.26, 0.28),
      mats.gunmetalSteel
    );
    frontPedestal.position.set(tx, 0.22, 0.34);
    frontPedestal.castShadow = true;
    frontPedestal.receiveShadow = true;
    group.add(frontPedestal);

    // Диагональный силовой раскос лафета
    const brace = buildInstancedStruts(
      [[new THREE.Vector3(tx, 0.13, -0.22), new THREE.Vector3(tx, 0.32, 0.22)]],
      0.018,
      mats.bluedSteel
    );
    group.add(brace);
  });

  // Гиростабилизационные гидроприводы вертикального наведения
  [-0.11, 0.11].forEach((gx) => {
    const actuator = buildInstancedStruts(
      [[new THREE.Vector3(gx, 0.12, -0.08), new THREE.Vector3(gx, 0.30, 0.24)]],
      0.022,
      mats.chrome
    );
    group.add(actuator);
  });

  // --- Б. Тяжёлый бронированный казённик (z = -0.80 .. +0.74) ---
  // Внутренний силовой корпус из серой стали
  const coreReceiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.36, 1.24),
    mats.gunmetalSteel
  );
  coreReceiver.position.set(0, barrelY, -0.02);
  coreReceiver.castShadow = true;
  coreReceiver.receiveShadow = true;
  group.add(coreReceiver);

  // Белые термозащитные панели («Буран») по бортам и скосам казённика
  // Правый борт (+X) — сплошной бронекожух с термоплиткой
  const rightArmor = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.33, 1.18),
    mats.buranTile
  );
  rightArmor.position.set(0.225, barrelY, 0.0);
  rightArmor.castShadow = true;
  rightArmor.receiveShadow = true;
  group.add(rightArmor);

  // Левый борт (-X) — передняя и задняя секции термоплитки вокруг открытого отсека накопителей
  const leftFrontArmor = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.33, 0.34),
    mats.buranTile
  );
  leftFrontArmor.position.set(-0.225, barrelY, 0.42);
  leftFrontArmor.castShadow = true;
  leftFrontArmor.receiveShadow = true;
  group.add(leftFrontArmor);

  const leftRearArmor = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.33, 0.18),
    mats.buranTile
  );
  leftRearArmor.position.set(-0.225, barrelY, -0.52);
  leftRearArmor.castShadow = true;
  leftRearArmor.receiveShadow = true;
  group.add(leftRearArmor);

  // Верхние скошенные плиты термозащиты «Буран»
  [-1, 1].forEach((side) => {
    const bevelPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.036, 1.18),
      mats.buranTile
    );
    bevelPanel.position.set(side * 0.185, barrelY + 0.185, 0.0);
    bevelPanel.rotation.z = -side * 0.48;
    bevelPanel.castShadow = true;
    bevelPanel.receiveShadow = true;
    group.add(bevelPanel);
  });

  // Задний казённый затвор и два гидропневматических накатника (до z = -0.80)
  const breechBlockRear = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.30, 0.14),
    mats.khaki
  );
  breechBlockRear.position.set(0, barrelY, -0.66);
  breechBlockRear.castShadow = true;
  group.add(breechBlockRear);

  [-0.095, 0.095].forEach((rx) => {
    const recoilCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.046, 0.24, 16),
      mats.bluedSteel
    );
    recoilCyl.rotation.x = Math.PI * 0.5;
    recoilCyl.position.set(rx, barrelY + 0.03, -0.68);
    recoilCyl.castShadow = true;
    group.add(recoilCyl);

    const recoilCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.044, 0.04, 16),
      mats.chrome
    );
    recoilCap.rotation.x = Math.PI * 0.5;
    recoilCap.position.set(rx, barrelY + 0.03, -0.78); // Задний габарит системы z = -0.80
    group.add(recoilCap);
  });

  // Передняя бронемаска и цанговый узел крепления ствола (z = +0.58 .. +0.74)
  const frontCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.185, 0.16, 16),
    mats.khaki
  );
  frontCollar.rotation.x = Math.PI / 2;
  frontCollar.position.set(0, barrelY, 0.66);
  frontCollar.castShadow = true;
  group.add(frontCollar);

  // --- В. Открытый блок накопителей энергии (-X борт, z = -0.40 .. +0.23) ---
  const capBay = new THREE.Group();
  capBay.name = 'energyStorageBank';
  capBay.position.set(-0.26, barrelY - 0.01, -0.085);

  // Ниша и силовая рама открытого отсека
  const bayBackplate = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.28, 0.60),
    mats.bluedSteel
  );
  bayBackplate.position.x = 0.035;
  capBay.add(bayBackplate);

  // 2 ряда по 5 цилиндрических импульсных суперконденсаторов
  const capCylGeom = new THREE.CylinderGeometry(0.024, 0.024, 0.115, 14);
  const insulatorGeom = new THREE.CylinderGeometry(0.014, 0.018, 0.018, 12);
  for (let row = 0; row < 2; row++) {
    const cy = row === 0 ? 0.068 : -0.068;
    for (let i = 0; i < 5; i++) {
      const cz = -0.22 + i * 0.11;
      const cap = new THREE.Mesh(capCylGeom, mats.khaki);
      cap.position.set(-0.015, cy, cz);
      cap.castShadow = true;
      capBay.add(cap);

      const ins = new THREE.Mesh(insulatorGeom, mats.buranSmooth);
      ins.position.set(-0.015, cy + 0.064, cz);
      capBay.add(ins);
    }
    // Медная силовая шина питания ряда конденсаторов
    const busbar = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.012, 0.52),
      mats.copper
    );
    busbar.position.set(-0.015, cy + 0.076, 0);
    capBay.add(busbar);
  }

  // Защитная трубчатая дуга открытого отсека
  const cageBars = buildInstancedStruts(
    [
      [new THREE.Vector3(-0.055, 0.135, -0.30), new THREE.Vector3(-0.055, 0.135, 0.30)],
      [new THREE.Vector3(-0.055, -0.135, -0.30), new THREE.Vector3(-0.055, -0.135, 0.30)],
      [new THREE.Vector3(-0.055, -0.135, -0.30), new THREE.Vector3(-0.055, 0.135, -0.30)],
      [new THREE.Vector3(-0.055, -0.135, 0.30), new THREE.Vector3(-0.055, 0.135, 0.30)],
      [new THREE.Vector3(0.03, 0.135, -0.30), new THREE.Vector3(-0.055, 0.135, -0.30)],
      [new THREE.Vector3(0.03, 0.135, 0.30), new THREE.Vector3(-0.055, 0.135, 0.30)],
      [new THREE.Vector3(0.03, -0.135, -0.30), new THREE.Vector3(-0.055, -0.135, -0.30)],
      [new THREE.Vector3(0.03, -0.135, 0.30), new THREE.Vector3(-0.055, -0.135, 0.30)],
    ],
    0.008,
    mats.bluedSteel
  );
  capBay.add(cageBars);
  group.add(capBay);

  // --- Г. Радиаторы сброса тепла (верхний блок и бортовой теплообменник) ---
  const radiatorGroup = new THREE.Group();
  radiatorGroup.name = 'heatRadiators';

  // Верхний радиаторный блок сброса тепла (z = -0.44 .. +0.48)
  const radBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.025, 0.92),
    mats.gunmetalSteel
  );
  radBase.position.set(0, barrelY + 0.19, 0.02);
  radiatorGroup.add(radBase);

  // 38 пластин радиатора через InstancedMesh
  const finCount = 38;
  const finGeom = new THREE.BoxGeometry(0.25, 0.052, 0.006);
  const dorsalFins = new THREE.InstancedMesh(finGeom, mats.bluedSteel, finCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < finCount; i++) {
    dummy.position.set(0, barrelY + 0.225, -0.42 + i * 0.0238);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    dorsalFins.setMatrixAt(i, dummy.matrix);
  }
  dorsalFins.instanceMatrix.needsUpdate = true;
  dorsalFins.castShadow = true;
  radiatorGroup.add(dorsalFins);

  // Трубки теплоносителя вдоль радиатора
  [-0.085, 0.085].forEach((px) => {
    const coolantPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.96, 10),
      mats.khaki
    );
    coolantPipe.rotation.x = Math.PI / 2;
    coolantPipe.position.set(px, barrelY + 0.248, 0.02);
    radiatorGroup.add(coolantPipe);
  });

  // Бортовой радиатор на правом борту (+X) позади ОЛС
  const sideFinCount = 18;
  const sideFinGeom = new THREE.BoxGeometry(0.032, 0.16, 0.007);
  const sideFins = new THREE.InstancedMesh(sideFinGeom, mats.bluedSteel, sideFinCount);
  for (let i = 0; i < sideFinCount; i++) {
    dummy.position.set(0.255, barrelY + 0.01, -0.42 + i * 0.026);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    sideFins.setMatrixAt(i, dummy.matrix);
  }
  sideFins.instanceMatrix.needsUpdate = true;
  radiatorGroup.add(sideFins);
  group.add(radiatorGroup);

  // --- Д. Крупный шарообразный оптико-локационный модуль ОЛС (+X спереди) ---
  const olsMountGroup = new THREE.Group();
  olsMountGroup.name = 'olsModule';

  // Консольный бронированный пилон ОЛС на правом переднем борту казённика
  const pylonBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.16, 0.28),
    mats.khaki
  );
  pylonBody.position.set(0.32, barrelY - 0.01, 0.52);
  pylonBody.castShadow = true;
  pylonBody.receiveShadow = true;
  olsMountGroup.add(pylonBody);

  const pylonWhiteShield = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.03, 0.29),
    mats.buranTile
  );
  pylonWhiteShield.position.set(0.32, barrelY + 0.08, 0.52);
  olsMountGroup.add(pylonWhiteShield);

  // Узел азимутального вращения ОЛС
  const olsAzimuth = new THREE.Group();
  olsAzimuth.name = 'olsAzimuth';
  olsAzimuth.position.set(0.45, barrelY, 0.56);

  // Силовая вилка (карданный подвес) ОЛС
  const yokeBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.11, 0.04, 20),
    mats.bluedSteel
  );
  yokeBase.position.y = -0.155;
  olsAzimuth.add(yokeBase);

  const yokeArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.178, 0.022, 12, 28, Math.PI * 1.15),
    mats.gunmetalSteel
  );
  yokeArc.rotation.z = -Math.PI * 0.075;
  yokeArc.castShadow = true;
  olsAzimuth.add(yokeArc);

  // Подвижный оптический шар ОЛС (угломестное наведение)
  const olsBall = new THREE.Group();
  olsBall.name = 'olsBall';

  const sphereRadius = 0.155;
  // Защитная сферическая оболочка из белой термоплитки («Буран»)
  const outerShell = new THREE.Mesh(
    new THREE.SphereGeometry(sphereRadius, 32, 24),
    mats.buranSmooth
  );
  outerShell.castShadow = true;
  outerShell.receiveShadow = true;
  olsBall.add(outerShell);

  // Экваториальный пояс жёсткости в защитном хаки
  const equatorRing = new THREE.Mesh(
    new THREE.CylinderGeometry(sphereRadius + 0.004, sphereRadius + 0.004, 0.042, 32),
    mats.khaki
  );
  equatorRing.rotation.z = Math.PI * 0.5;
  olsBall.add(equatorRing);

  // Броневая бленда главного объектива (направлена вдоль +Z)
  const hoodBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.098, 0.112, 0.065, 28, 1, true),
    mats.bluedSteel
  );
  hoodBarrel.rotation.x = Math.PI / 2;
  hoodBarrel.position.z = sphereRadius - 0.008;
  olsBall.add(hoodBarrel);

  // Внутренняя оптическая шахта за сапфировым стеклом
  const innerOpticTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.086, 0.065, 0.05, 24),
    mats.boreDark
  );
  innerOpticTube.rotation.x = Math.PI / 2;
  innerOpticTube.position.z = sphereRadius - 0.025;
  olsBall.add(innerOpticTube);

  // Крупная выпуклая линза из тёмного сапфирового стекла (#182c42, roughness: 0.08)
  const mainSapphireLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.092, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.42),
    mats.sapphireGlass
  );
  mainSapphireLens.rotation.x = Math.PI / 2;
  mainSapphireLens.position.z = sphereRadius - 0.032;
  olsBall.add(mainSapphireLens);

  // Вторичный канал лазерного дальномера-целеуказателя (ниже главного объектива)
  const laserBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.032, 0.03, 18),
    mats.bluedSteel
  );
  laserBezel.rotation.x = Math.PI / 2;
  laserBezel.position.set(0, -0.092, sphereRadius - 0.025);
  olsBall.add(laserBezel);

  const laserSapphireLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
    mats.sapphireGlass
  );
  laserSapphireLens.rotation.x = Math.PI / 2;
  laserSapphireLens.position.set(0, -0.092, sphereRadius - 0.022);
  olsBall.add(laserSapphireLens);

  olsAzimuth.add(olsBall);
  olsMountGroup.add(olsAzimuth);
  group.add(olsMountGroup);

  // Сохраняем ссылки на подвижные узлы ОЛС в userData
  group.userData.olsAzimuth = olsAzimuth;
  group.userData.olsBall = olsBall;

  return group;
}

/**
 * 3. Длинный ствол в термостабилизирующем кожухе (stabilizedBarrel)
 */
function buildStabilizedBarrel(mats, barrelY) {
  const group = new THREE.Group();
  group.name = 'stabilizedBarrel';

  // --- А. Высокоточный ствол из тёмной воронёной стали (z = 0.72 .. 3.85) ---
  // Казённая муфта ствола
  const barrelBreechSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.058, 0.34, 20),
    mats.bluedSteel
  );
  barrelBreechSleeve.rotation.x = Math.PI / 2;
  barrelBreechSleeve.position.set(0, barrelY, 0.89);
  barrelBreechSleeve.castShadow = true;
  group.add(barrelBreechSleeve);

  // Основная длинная коническая часть ствола (z = 1.06 .. 3.85)
  const mainBarrelLen = 2.79;
  const mainBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.042, mainBarrelLen, 20),
    mats.bluedSteel
  );
  mainBarrel.rotation.x = Math.PI / 2;
  mainBarrel.position.set(0, barrelY, 1.06 + mainBarrelLen * 0.5);
  mainBarrel.castShadow = true;
  group.add(mainBarrel);

  // Продольные рёбра жёсткости ствола (6 радиальных рёбер через InstancedMesh)
  const ribPairs = [];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const p1 = new THREE.Vector3(Math.cos(ang) * 0.041, barrelY + Math.sin(ang) * 0.041, 1.08);
    const p2 = new THREE.Vector3(Math.cos(ang) * 0.027, barrelY + Math.sin(ang) * 0.027, 3.76);
    ribPairs.push([p1, p2]);
  }
  group.add(buildInstancedStruts(ribPairs, 0.0045, mats.bluedSteel, 6));

  // --- Б. Компактный щелевой дульный компенсатор (z = 3.85 .. 4.10) ---
  const brakeGroup = new THREE.Group();
  brakeGroup.name = 'muzzleBrake';

  const brakeLen = 0.25;
  const brakeStartZ = 3.85;
  // Компактный цилиндрический корпус без лишнего габарита (радиус 0.033 м)
  const brakeBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.034, brakeLen, 20),
    mats.bluedSteel
  );
  brakeBody.rotation.x = Math.PI / 2;
  brakeBody.position.set(0, barrelY, brakeStartZ + brakeLen * 0.5);
  brakeBody.castShadow = true;
  brakeGroup.add(brakeBody);

  // Внутренний канал дульного среза (z = 4.10)
  const muzzleBore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.017, 0.03, 16),
    mats.boreDark
  );
  muzzleBore.rotation.x = Math.PI / 2;
  muzzleBore.position.set(0, barrelY, 4.086);
  brakeGroup.add(muzzleBore);

  // Щелевые газосбросные окна компенсатора (4 секции x 4 щели через InstancedMesh)
  const slotGeom = new THREE.BoxGeometry(0.068, 0.014, 0.026);
  const slotCount = 8;
  const slotsInstanced = new THREE.InstancedMesh(slotGeom, mats.boreDark, slotCount);
  const dummy = new THREE.Object3D();
  for (let s = 0; s < 4; s++) {
    const sz = brakeStartZ + 0.045 + s * 0.045;
    // Горизонтальная и вертикальная сквозные щели
    dummy.position.set(0, barrelY, sz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    slotsInstanced.setMatrixAt(s * 2, dummy.matrix);

    dummy.rotation.set(0, 0, Math.PI * 0.5);
    dummy.updateMatrix();
    slotsInstanced.setMatrixAt(s * 2 + 1, dummy.matrix);
  }
  slotsInstanced.instanceMatrix.needsUpdate = true;
  brakeGroup.add(slotsInstanced);
  group.add(brakeGroup);

  // --- В. Ажурная трубчатая ферма термостабилизации (z = 0.76 .. 3.78) ---
  const trussStations = 9;
  const zStart = 0.76;
  const zEnd = 3.78;
  const rStart = 0.132;
  const rEnd = 0.088;

  // Узлы ромбовидной 4-стрингерной космической фермы на каждой станции
  const rings = [];
  for (let s = 0; s < trussStations; s++) {
    const t = s / (trussStations - 1);
    const z = THREE.MathUtils.lerp(zStart, zEnd, t);
    const r = THREE.MathUtils.lerp(rStart, rEnd, t);
    rings.push([
      new THREE.Vector3(0, barrelY + r, z), // 0: верх
      new THREE.Vector3(r, barrelY, z),     // 1: право (+X)
      new THREE.Vector3(0, barrelY - r, z), // 2: низ
      new THREE.Vector3(-r, barrelY, z),    // 3: лево (-X)
    ]);
  }

  const trussPairs = [];
  for (let s = 0; s < trussStations; s++) {
    const ring = rings[s];
    // Поперечные шпангоуты фермы
    for (let c = 0; c < 4; c++) {
      trussPairs.push([ring[c], ring[(c + 1) % 4]]);
    }
    // Продольные лонжероны и диагональные раскосы к следующей станции
    if (s < trussStations - 1) {
      const nextRing = rings[s + 1];
      for (let c = 0; c < 4; c++) {
        const cNext = (c + 1) % 4;
        // Продольный стержень
        trussPairs.push([ring[c], nextRing[c]]);
        // Диагональный раскос фермы Уоррена
        if ((s + c) % 2 === 0) {
          trussPairs.push([ring[c], nextRing[cNext]]);
        } else {
          trussPairs.push([ring[cNext], nextRing[c]]);
        }
      }
    }
  }

  const trussMesh = buildInstancedStruts(trussPairs, 0.0085, mats.bluedSteel, 8);
  trussMesh.name = 'tubularTruss';
  group.add(trussMesh);

  // --- Г. Сегментированные термозащитные экраны на ферме ---
  // Оставляем боковые проёмы открытыми, чтобы просматривалась ажурная ферма и ствол
  for (let s = 0; s < trussStations - 1; s++) {
    const t1 = s / (trussStations - 1);
    const t2 = (s + 1) / (trussStations - 1);
    const z1 = THREE.MathUtils.lerp(zStart, zEnd, t1) + 0.025;
    const z2 = THREE.MathUtils.lerp(zStart, zEnd, t2) - 0.025;
    const segLen = z2 - z1;
    const zMid = (z1 + z2) * 0.5;
    const r1 = THREE.MathUtils.lerp(rStart, rEnd, t1) + 0.008;
    const r2 = THREE.MathUtils.lerp(rStart, rEnd, t2) + 0.008;

    // Верхний V-образный термоэкран из белой термоплитки («Буран»)
    const topShield = new THREE.Mesh(
      new THREE.CylinderGeometry(r2, r1, segLen, 4, 1, true, Math.PI * 0.72, Math.PI * 0.56),
      mats.buranTile
    );
    topShield.rotation.x = Math.PI * 0.5;
    topShield.rotation.y = Math.PI * 0.25;
    topShield.position.set(0, barrelY + 0.006, zMid);
    topShield.castShadow = true;
    topShield.receiveShadow = true;
    group.add(topShield);

    // Нижний термоэкран в защитном хаки (на чередующихся секциях для технологичного ритма)
    if (s % 2 === 0 || s < 3) {
      const bottomShield = new THREE.Mesh(
        new THREE.CylinderGeometry(r2, r1, segLen, 4, 1, true, -Math.PI * 0.24, Math.PI * 0.48),
        mats.khaki
      );
      bottomShield.rotation.x = Math.PI * 0.5;
      bottomShield.rotation.y = Math.PI * 0.25;
      bottomShield.position.set(0, barrelY - 0.006, zMid);
      bottomShield.castShadow = true;
      group.add(bottomShield);
    }
  }

  // --- Д. Оптические датчики контроля геометрии ствола (InstancedMesh) ---
  const sensorStations = trussStations - 1; // 8 измерительных поясов
  const sensorsPerStation = 3; // верхний, левый, правый каналы на пояс
  const totalSensors = sensorStations * sensorsPerStation;

  const sensorHousingGeom = new THREE.BoxGeometry(0.022, 0.022, 0.032);
  const sensorLensGeom = new THREE.SphereGeometry(0.008, 12, 8);
  const targetMirrorGeom = new THREE.BoxGeometry(0.012, 0.012, 0.018);

  const sensorHousings = new THREE.InstancedMesh(
    sensorHousingGeom,
    mats.gunmetalSteel,
    totalSensors
  );
  sensorHousings.name = 'geometryOpticalSensors';

  const sensorLenses = new THREE.InstancedMesh(
    sensorLensGeom,
    mats.sapphireGlass,
    totalSensors
  );
  sensorLenses.name = 'geometrySensorLenses';

  const barrelMirrors = new THREE.InstancedMesh(
    targetMirrorGeom,
    mats.chrome,
    totalSensors
  );
  barrelMirrors.name = 'barrelCalibrationMirrors';

  const dummyObj = new THREE.Object3D();
  const radialAngles = [Math.PI * 0.5, 0, Math.PI]; // верх, +X, -X
  let instIdx = 0;

  for (let s = 1; s < trussStations; s++) {
    const t = s / (trussStations - 1);
    const z = THREE.MathUtils.lerp(zStart, zEnd, t);
    const trussR = THREE.MathUtils.lerp(rStart, rEnd, t);
    const barrelR = THREE.MathUtils.lerp(0.042, 0.027, t);

    for (let k = 0; k < sensorsPerStation; k++) {
      const ang = radialAngles[k];
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);

      // Корпус оптического датчика на шпангоуте фермы
      const sensorR = trussR - 0.014;
      dummyObj.position.set(cosA * sensorR, barrelY + sinA * sensorR, z);
      dummyObj.rotation.set(0, 0, ang);
      dummyObj.updateMatrix();
      sensorHousings.setMatrixAt(instIdx, dummyObj.matrix);

      // Сапфировый объектив датчика, направленный к оси ствола
      const lensR = sensorR - 0.011;
      dummyObj.position.set(cosA * lensR, barrelY + sinA * lensR, z);
      dummyObj.updateMatrix();
      sensorLenses.setMatrixAt(instIdx, dummyObj.matrix);

      // Ответная калибровочная призма на поверхности ствола
      const mirrorR = barrelR + 0.004;
      dummyObj.position.set(cosA * mirrorR, barrelY + sinA * mirrorR, z);
      dummyObj.updateMatrix();
      barrelMirrors.setMatrixAt(instIdx, dummyObj.matrix);

      instIdx++;
    }
  }

  sensorHousings.instanceMatrix.needsUpdate = true;
  sensorLenses.instanceMatrix.needsUpdate = true;
  barrelMirrors.instanceMatrix.needsUpdate = true;

  group.add(sensorHousings);
  group.add(sensorLenses);
  group.add(barrelMirrors);

  return group;
}

/**
 * Главная фабричная функция тяжёлой высокоточной снайперской системы «Краснополь-Л».
 * @returns {THREE.Group} Группа с центром привязки (0, 0, 0) в центре плиты УСП, ствол вдоль +Z.
 */
export function createWeaponKrasnopolL() {
  const root = new THREE.Group();
  root.name = 'Weapon_Krasnopol_L';

  const mats = createKrasnopolMaterials();
  const BARREL_CENTER_Y = 0.44;

  // 1. Усиленный стыковочный узел УСП (центр в 0, 0, 0)
  const mountFlange = buildMountFlange(mats);
  root.add(mountFlange);

  // 2. Гиростабилизированный казённый блок и модуль ОЛС
  const breechAndSensor = buildBreechAndSensor(mats, BARREL_CENTER_Y);
  root.add(breechAndSensor);

  // 3. Длинный ствол в термостабилизирующем кожухе
  const stabilizedBarrel = buildStabilizedBarrel(mats, BARREL_CENTER_Y);
  root.add(stabilizedBarrel);

  // Пробрасываем ссылки для анимации следящего ОЛС на уровень корневой группы
  root.userData.olsAzimuth = breechAndSensor.userData.olsAzimuth;
  root.userData.olsBall = breechAndSensor.userData.olsBall;

  return root;
}

// =========================================================================
// Адаптер под единый просмотрщик: одиночный выстрел, откат 0..0.12 м + слежение ОЛС.
// applyVolley(t): резкий откат → накат, вспышка, доводка ОЛС. Возвращает { recoil, flash }.
// =========================================================================
export function createWeapon() {
  const root = createWeaponKrasnopolL();
  const ud = root.userData;
  const barrel = root.getObjectByName('stabilizedBarrel');
  const basePos = barrel ? barrel.position.clone() : new THREE.Vector3();

  const flashLight = new THREE.PointLight(0xff9d3b, 0, 7.5, 1.6);
  flashLight.position.set(0, 0.44, 4.2);
  root.add(flashLight);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffc86b,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const flashCone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 12), flashMat);
  flashCone.rotation.x = Math.PI / 2;
  flashCone.position.set(0, 0.44, 4.32);
  root.add(flashCone);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  const olsAz = root.getObjectByName('olsAzimuth');
  const olsBall = root.getObjectByName('olsBall');

  ud.applyVolley = (t) => {
    let off = 0;
    let fl = 0;
    if (t < 0.06) {
      const u = t / 0.06;
      off = MAX_RECOIL * (1 - Math.pow(1 - u, 3));
      fl = Math.max(0, 1 - t / 0.07);
    } else if (t < 0.06 + 0.6) {
      const u = (t - 0.06) / 0.6;
      off = MAX_RECOIL * Math.pow(1 - u, 2.2);
    }
    if (barrel) barrel.position.z = basePos.z - off;
    if (olsAz) olsAz.rotation.y = Math.sin(t * 0.9) * 0.12;
    if (olsBall) olsBall.rotation.x = Math.sin(t * 0.7 + 0.6) * 0.05;
    flashLight.intensity = 18 * fl;
    flashMat.opacity = 0.92 * fl;
    flashCone.scale.setScalar(0.8 + 0.5 * fl);
    return { recoil: off, flash: fl };
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
