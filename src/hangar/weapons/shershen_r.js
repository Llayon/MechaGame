import * as THREE from 'three';

export const meta = {
  id: 'shershen',
  code: 'ШЕРШЕНЬ-Р',
  title: '«Шершень-Р»',
  subtitle: 'ПУСКОВАЯ КАССЕТА БАРРАЖИРУЮЩИХ МИНИ-ДРОНОВ • 8 ТРУБ • СЛОТ MAIN • ЦИКЛ 7.0 С',
  description:
    'Пусковая кассета барражирующих мини-дронов: фланец УСП, бронекороб с трафаретом «ШЕРШЕНЬ-Р / БПЛА-РОЙ», баллоны пневмовыброса, антенна сопровождения роя. Блок 2×4 тубусов со складными крыльями-дронами внутри. Залп 8 дронов: пневмовыброс, раскрытие крыльев, выход на барражирование.',
  specs: [
    ['Трубы', '8 (2×4)'],
    ['Дрон', 'К-82, складные крылья'],
    ['Пуск', 'Пневматический, 25 МПа'],
    ['Темп залпа', '1 / 0.5 с'],
    ['Цикл', '7.0 с'],
    ['Слот', 'MAIN'],
  ],
  maxExtension: 7.0,
  unit: 's',
  tipOffset: 1.0,
  salvoCount: 8,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'cassetteBody', label: '2. Контейнер и станция управления' },
    { key: 'launchTubesGroup', label: '3. Блок пусковых тубусов' },
    { key: 'droneSwarm', label: '4. Рой мини-дронов' },
  ],
  cameras: {
    module: { pos: [1.65, 0.35, 2.05], target: [0, -0.25, 0.45] },
  },
  rangeMarkers: [],
  controls: 'salvo',
};

const SHERSHEN_CYCLE = 7.0;
const SHERSHEN_COUNT = 8;
const SHERSHEN_FIRST = 0.8;
const SHERSHEN_INTERVAL = 0.5;
const SHERSHEN_ORDER = [3, 4, 2, 5, 1, 6, 0, 7];

/**
 * Процедурная текстура жёлто-чёрной предупреждающей разметки для плиты УСП
 */
function createUspHazardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Базовый тёмно-серый металл
  ctx.fillStyle = '#25282c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Верхняя и нижняя полосы диагональной жёлто-чёрной разметки
  const stripeH = 54;
  const drawHazardBand = (yOffset) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, yOffset, canvas.width, stripeH);
    ctx.clip();

    ctx.fillStyle = '#e2a814';
    ctx.fillRect(0, yOffset, canvas.width, stripeH);

    ctx.fillStyle = '#141517';
    const step = 48;
    for (let x = -stripeH * 2; x < canvas.width + stripeH * 2; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, yOffset);
      ctx.lineTo(x + step * 0.5, yOffset);
      ctx.lineTo(x + step * 0.5 - stripeH, yOffset + stripeH);
      ctx.lineTo(x - stripeH, yOffset + stripeH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  drawHazardBand(0);
  drawHazardBand(canvas.height - stripeH);

  // Разделительные канты
  ctx.fillStyle = '#111214';
  ctx.fillRect(0, stripeH, canvas.width, 4);
  ctx.fillRect(0, canvas.height - stripeH - 4, canvas.width, 4);

  // Техническая маркировка УСП
  ctx.fillStyle = '#d8d5c8';
  ctx.font = 'bold 34px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('УСП-М  //  СЛОТ MAIN  //  УСИЛИЕ ЗАМКОВ 4×18 кН', canvas.width * 0.5, canvas.height * 0.5);

  // Лёгкие потёртости и царапины
  ctx.fillStyle = 'rgba(20, 22, 24, 0.25)';
  for (let i = 0; i < 180; i++) {
    const sx = (i * 73) % canvas.width;
    const sy = (i * 41) % canvas.height;
    ctx.fillRect(sx, sy, 12 + (i % 24), 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Процедурный военный трафарет «ШЕРШЕНЬ-Р / БПЛА-РОЙ» на борт контейнера
 */
function createStencilDecalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Тактическая эмблема (стилизованный силуэт шершня / ромб)
  ctx.save();
  ctx.translate(120, 128);
  ctx.strokeStyle = 'rgba(226, 178, 42, 0.92)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, -68);
  ctx.lineTo(68, 0);
  ctx.lineTo(0, 68);
  ctx.lineTo(-68, 0);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = 'rgba(226, 178, 42, 0.92)';
  ctx.beginPath();
  ctx.moveTo(0, -42);
  ctx.lineTo(36, 16);
  ctx.lineTo(0, 4);
  ctx.lineTo(-36, 16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Основной трафарет «ШЕРШЕНЬ-Р»
  ctx.fillStyle = 'rgba(232, 230, 218, 0.92)';
  ctx.font = '900 76px "Impact", "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ШЕРШЕНЬ-Р', 225, 118);

  // Подзаголовок «БПЛА-РОЙ»
  ctx.fillStyle = 'rgba(226, 178, 42, 0.94)';
  ctx.font = 'bold 42px "Courier New", monospace';
  ctx.fillText('БПЛА-РОЙ // ПНЕВМОПУСК', 228, 174);

  // Индекс изделия справа
  ctx.fillStyle = 'rgba(232, 230, 218, 0.78)';
  ctx.font = 'bold 26px "Courier New", monospace';
  ctx.fillText('ИЗД. 9М-ШР  |  8×К-82  |  Рраб 25 МПа', 228, 214);

  // Имитация трафаретных перемычек и облупившейся краски
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  for (let x = 220; x < 920; x += 64) {
    ctx.fillRect(x, 45, 3, 180);
  }
  for (let i = 0; i < 240; i++) {
    const rx = (i * 97) % canvas.width;
    const ry = (i * 53) % canvas.height;
    ctx.fillRect(rx, ry, 4 + (i % 9), 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Процедурная карта шероховатости / фактуры катаной брони
 */
function createArmorRoughnessTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#a6a6a6';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 2500; i++) {
    const v = 135 + ((i * 37) % 65);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect((i * 71) % 512, (i * 29) % 512, 3 + (i % 8), 2);
  }

  // Сварные швы и линии стыка листов
  ctx.strokeStyle = '#787878';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, 488, 488);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

/**
 * Геометрия пускового тубуса с внутренними прорезями под складные крылья дрона
 */
function createSlottedTubeGeometry(outerRadius, innerRadius, slotRadius, slotHalfHeight, length) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);

  const alpha = Math.asin(slotHalfHeight / innerRadius);
  const cosA = Math.cos(alpha);

  // Внутренний канал по часовой стрелке (отверстие с двумя боковыми пазами)
  const hole = new THREE.Path();
  hole.moveTo(innerRadius * cosA, slotHalfHeight);
  hole.lineTo(slotRadius, slotHalfHeight);
  hole.lineTo(slotRadius, -slotHalfHeight);
  hole.lineTo(innerRadius * cosA, -slotHalfHeight);
  hole.absarc(0, 0, innerRadius, -alpha, -(Math.PI - alpha), true);
  hole.lineTo(-slotRadius, -slotHalfHeight);
  hole.lineTo(-slotRadius, slotHalfHeight);
  hole.lineTo(-innerRadius * cosA, slotHalfHeight);
  hole.absarc(0, 0, innerRadius, Math.PI - alpha, alpha, true);
  hole.closePath();

  shape.holes.push(hole);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.002,
    bevelSegments: 2,
    curveSegments: 32,
  });

  // Центрируем экструзию по оси Z
  geom.translate(0, 0, -length * 0.5);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Создаёт процедурную 3D-модель пусковой кассеты барражирующих мини-дронов «Шершень-Р»
 * Габариты: ~0.68 x 0.58 x 1.95 м. Ось пуска: +Z, верх: +Y, бок: +X.
 * Точка привязки (0, 0, 0): центр верхней плоскости стыковочного фланца УСП.
 *
 * @returns {THREE.Group}
 */
export function createWeaponShershenR() {
  const root = new THREE.Group();
  root.name = 'WeaponShershenR';

  // --- Общие PBR-материалы ---
  const armorRoughnessMap = createArmorRoughnessTexture();

  const khakiArmorMat = new THREE.MeshStandardMaterial({
    color: 0x4b5346,
    metalness: 0.45,
    roughness: 0.65,
    roughnessMap: armorRoughnessMap,
    bumpMap: armorRoughnessMap,
    bumpScale: 0.002,
  });

  const darkKhakiMat = new THREE.MeshStandardMaterial({
    color: 0x394035,
    metalness: 0.52,
    roughness: 0.58,
  });

  const gunmetalMat = new THREE.MeshStandardMaterial({
    color: 0x25282c,
    metalness: 0.85,
    roughness: 0.35,
  });

  const machinedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x4a5058,
    metalness: 0.82,
    roughness: 0.32,
  });

  const hazardMat = new THREE.MeshStandardMaterial({
    map: createUspHazardTexture(),
    metalness: 0.55,
    roughness: 0.48,
  });

  const radomeMat = new THREE.MeshStandardMaterial({
    color: 0x62695c,
    metalness: 0.25,
    roughness: 0.42,
  });

  const droneBodyMat = new THREE.MeshStandardMaterial({
    color: 0x8b9299,
    metalness: 0.18,
    roughness: 0.50,
  });

  const droneWingMat = new THREE.MeshStandardMaterial({
    color: 0x737a82,
    metalness: 0.22,
    roughness: 0.46,
  });

  const orangeBandMat = new THREE.MeshStandardMaterial({
    color: 0xe85a19,
    metalness: 0.12,
    roughness: 0.45,
  });

  const opticalLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x071a26,
    emissive: 0x082e42,
    emissiveIntensity: 0.65,
    metalness: 0.1,
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ УСП (mountFlange)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Основная стальная плита УСП: 0.50 x 0.14 x 0.85 м, верхняя грань строго на y = 0
  const plateW = 0.50;
  const plateH = 0.14;
  const plateL = 0.85;

  const mainPlate = new THREE.Mesh(
    new THREE.BoxGeometry(plateW, plateH * 0.68, plateL),
    gunmetalMat
  );
  mainPlate.position.set(0, -plateH * 0.34, 0);
  mainPlate.castShadow = true;
  mainPlate.receiveShadow = true;
  mountFlange.add(mainPlate);

  // Нижний силовой переходник фланца к бронекоробу
  const lowerSkirt = new THREE.Mesh(
    new THREE.BoxGeometry(plateW * 0.88, plateH * 0.36, plateL * 0.92),
    machinedSteelMat
  );
  lowerSkirt.position.set(0, -plateH * 0.82, 0);
  lowerSkirt.castShadow = true;
  lowerSkirt.receiveShadow = true;
  mountFlange.add(lowerSkirt);

  // Боковые полосы с жёлто-чёрной предупреждающей разметкой (CanvasTexture)
  const hazardStripGeo = new THREE.PlaneGeometry(plateL * 0.94, plateH * 0.62);
  const hazardRight = new THREE.Mesh(hazardStripGeo, hazardMat);
  hazardRight.position.set(plateW * 0.5 + 0.001, -plateH * 0.34, 0);
  hazardRight.rotation.y = Math.PI * 0.5;
  mountFlange.add(hazardRight);

  const hazardLeft = new THREE.Mesh(hazardStripGeo, hazardMat);
  hazardLeft.position.set(-plateW * 0.5 - 0.001, -plateH * 0.34, 0);
  hazardLeft.rotation.y = -Math.PI * 0.5;
  mountFlange.add(hazardLeft);

  // Верхние направляющие штифты и разъём электропитания/шины данных на плоскости y = 0
  const pinGeo = new THREE.CylinderGeometry(0.012, 0.014, 0.018, 16);
  [-0.32, 0.32].forEach((pz) => {
    [-0.16, 0.16].forEach((px) => {
      const pin = new THREE.Mesh(pinGeo, machinedSteelMat);
      pin.position.set(px, 0.006, pz);
      mountFlange.add(pin);
    });
  });

  const umbilicalPlug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.035, 0.016, 20),
    gunmetalMat
  );
  umbilicalPlug.position.set(0, 0.005, 0.14);
  mountFlange.add(umbilicalPlug);

  // 4 силовых стыковочных замка по углам плиты УСП
  const lockPositions = [
    [-0.245, -0.055, -0.27],
    [0.245, -0.055, -0.27],
    [-0.245, -0.055, 0.27],
    [0.245, -0.055, 0.27],
  ];

  const lockBodyGeo = new THREE.BoxGeometry(0.055, 0.075, 0.11);
  const lockPinGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.09, 16);
  lockPinGeo.rotateZ(Math.PI * 0.5);
  const lockLeverGeo = new THREE.BoxGeometry(0.018, 0.024, 0.075);

  lockPositions.forEach(([lx, ly, lz]) => {
    const sideSign = Math.sign(lx);
    const lockGroup = new THREE.Group();
    lockGroup.position.set(lx, ly, lz);

    const housing = new THREE.Mesh(lockBodyGeo, machinedSteelMat);
    housing.position.x = sideSign * 0.012;
    housing.castShadow = true;
    lockGroup.add(housing);

    const boltPin = new THREE.Mesh(lockPinGeo, gunmetalMat);
    boltPin.position.set(sideSign * 0.018, 0.01, 0);
    lockGroup.add(boltPin);

    const lever = new THREE.Mesh(lockLeverGeo, orangeBandMat);
    lever.position.set(sideSign * 0.042, -0.012, 0.015);
    lever.rotation.x = 0.22;
    lockGroup.add(lever);

    mountFlange.add(lockGroup);
  });

  // =========================================================================
  // 2. КОНТЕЙНЕР ПНЕВМОВЫБРОСА И СТАНЦИЯ УПРАВЛЕНИЯ (cassetteBody)
  // =========================================================================
  const cassetteBody = new THREE.Group();
  cassetteBody.name = 'cassetteBody';
  root.add(cassetteBody);

  // Гранёный бронекороб в защитном хаки (#4b5346)
  // Сечение: ширина 0.54 м (-0.27..+0.27), высота 0.34 м (-0.12..-0.46), длина 1.76 м (-0.84..+0.92)
  const hullW = 0.54;
  const hullH = 0.34;
  const chamfer = 0.048;
  const hullShape = new THREE.Shape();
  const hw = hullW * 0.5;
  const hh = hullH * 0.5;

  hullShape.moveTo(-hw + chamfer, hh);
  hullShape.lineTo(hw - chamfer, hh);
  hullShape.lineTo(hw, hh - chamfer);
  hullShape.lineTo(hw, -hh + chamfer);
  hullShape.lineTo(hw - chamfer, -hh);
  hullShape.lineTo(-hw + chamfer, -hh);
  hullShape.lineTo(-hw, -hh + chamfer);
  hullShape.lineTo(-hw, hh - chamfer);
  hullShape.closePath();

  const hullLen = 1.76;
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: hullLen,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  hullGeo.translate(0, 0, -hullLen * 0.5);

  const mainHull = new THREE.Mesh(hullGeo, khakiArmorMat);
  mainHull.position.set(0, -0.29, 0.04);
  mainHull.castShadow = true;
  mainHull.receiveShadow = true;
  cassetteBody.add(mainHull);

  // Внешние силовые рёбра жёсткости (шпангоуты) вокруг бронекороба
  const ribZPositions = [-0.66, -0.22, 0.22, 0.66];
  const ribGeo = new THREE.BoxGeometry(hullW + 0.024, hullH + 0.016, 0.036);
  ribZPositions.forEach((rz) => {
    const rib = new THREE.Mesh(ribGeo, darkKhakiMat);
    rib.position.set(0, -0.29, rz);
    rib.castShadow = true;
    rib.receiveShadow = true;
    cassetteBody.add(rib);
  });

  // Задний бронеколпак пневмораспределителя и станции управления (z = -0.84 .. -0.95)
  const rearCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.28, 0.12),
    darkKhakiMat
  );
  rearCap.position.set(0, -0.29, -0.89);
  rearCap.castShadow = true;
  cassetteBody.add(rearCap);

  // Решётки охлаждения электроники и манометр на корме
  const louverGeo = new THREE.BoxGeometry(0.14, 0.012, 0.015);
  for (let i = 0; i < 6; i++) {
    const louver = new THREE.Mesh(louverGeo, gunmetalMat);
    louver.position.set(-0.11, -0.21 - i * 0.026, -0.952);
    louver.rotation.x = 0.35;
    cassetteBody.add(louver);
  }

  const gaugeBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 0.022, 20),
    machinedSteelMat
  );
  gaugeBody.rotation.x = Math.PI * 0.5;
  gaugeBody.position.set(0.12, -0.25, -0.952);
  cassetteBody.add(gaugeBody);

  // Трафареты «ШЕРШЕНЬ-Р / БПЛА-РОЙ» на правом и левом бортах бронекороба
  const stencilMat = new THREE.MeshStandardMaterial({
    map: createStencilDecalTexture(),
    transparent: true,
    roughness: 0.72,
    metalness: 0.2,
    depthWrite: false,
  });

  const decalGeo = new THREE.PlaneGeometry(0.96, 0.22);
  const decalRight = new THREE.Mesh(decalGeo, stencilMat);
  decalRight.position.set(hw + 0.009, -0.29, -0.24);
  decalRight.rotation.y = Math.PI * 0.5;
  cassetteBody.add(decalRight);

  const decalLeft = new THREE.Mesh(decalGeo, stencilMat);
  decalLeft.position.set(-hw - 0.009, -0.29, -0.02);
  decalLeft.rotation.y = -Math.PI * 0.5;
  cassetteBody.add(decalLeft);

  // Левая защитная кабельная магистраль / броненакладка (-X, до x = -0.30)
  const leftConduit = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.075, 1.48),
    darkKhakiMat
  );
  leftConduit.position.set(-hw - 0.015, -0.34, 0.04);
  leftConduit.castShadow = true;
  cassetteBody.add(leftConduit);

  // Два цилиндрических баллона сжатого воздуха снизу (для бесшумного пневматического отстрела)
  const tankRadius = 0.056;
  const tankCylLen = 1.32;
  const tankOffsetsX = [-0.135, 0.135];
  const tankY = -0.518; // Нижняя точка ~ -0.58 м

  const tankBodyGeo = new THREE.CylinderGeometry(tankRadius, tankRadius, tankCylLen, 24);
  tankBodyGeo.rotateX(Math.PI * 0.5);
  const tankDomeGeo = new THREE.SphereGeometry(tankRadius, 24, 14);
  const strapGeo = new THREE.CylinderGeometry(tankRadius + 0.006, tankRadius + 0.006, 0.032, 24);
  strapGeo.rotateX(Math.PI * 0.5);

  tankOffsetsX.forEach((tx) => {
    const tankGroup = new THREE.Group();
    tankGroup.position.set(tx, tankY, 0.02);

    const cyl = new THREE.Mesh(tankBodyGeo, gunmetalMat);
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    tankGroup.add(cyl);

    const frontDome = new THREE.Mesh(tankDomeGeo, gunmetalMat);
    frontDome.position.z = tankCylLen * 0.5;
    frontDome.scale.set(1, 1, 0.85);
    tankGroup.add(frontDome);

    const rearDome = new THREE.Mesh(tankDomeGeo, gunmetalMat);
    rearDome.position.z = -tankCylLen * 0.5;
    rearDome.scale.set(1, 1, 0.85);
    tankGroup.add(rearDome);

    // Хомуты крепления баллонов к днищу бронекороба
    [-0.48, 0.0, 0.48].forEach((sz) => {
      const strap = new THREE.Mesh(strapGeo, machinedSteelMat);
      strap.position.z = sz;
      tankGroup.add(strap);

      const pylon = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.05, 0.032),
        darkKhakiMat
      );
      pylon.position.set(0, tankRadius + 0.015, sz);
      tankGroup.add(pylon);
    });

    // Пневмомагистраль высокого давления от баллона к ресиверу пускового блока
    const pipeRun = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.28, 12),
      machinedSteelMat
    );
    pipeRun.rotation.x = Math.PI * 0.5;
    pipeRun.position.set(0, 0.02, tankCylLen * 0.5 + 0.12);
    tankGroup.add(pipeRun);

    const valveBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.048, 0.065),
      gunmetalMat
    );
    valveBlock.position.set(0, 0.035, tankCylLen * 0.5 + 0.24);
    tankGroup.add(valveBlock);

    cassetteBody.add(tankGroup);
  });

  // Боковой блок направленной параболической / щелевой антенны сопровождения роя (+X, до x = +0.38)
  const antennaPod = new THREE.Group();
  antennaPod.name = 'trackingAntennaPod';
  antennaPod.position.set(hw + 0.005, -0.255, 0.46);
  cassetteBody.add(antennaPod);

  // Силовой кронштейн и поворотный привод
  const antBracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.16, 0.34),
    darkKhakiMat
  );
  antBracket.position.set(0.02, 0, 0);
  antBracket.castShadow = true;
  antennaPod.add(antBracket);

  const hingeDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.17, 16),
    gunmetalMat
  );
  hingeDrum.position.set(0.045, 0, -0.14);
  antennaPod.add(hingeDrum);

  // Поворотный корпус антенны (развёрнут слегка вперёд к сектору пуска +Z)
  const antHead = new THREE.Group();
  antHead.position.set(0.055, 0, 0.02);
  antHead.rotation.y = 0.24;
  antennaPod.add(antHead);

  // Щелевая волноводная решётка (верхняя секция)
  const slottedPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.075, 0.24),
    radomeMat
  );
  slottedPanel.position.set(0.015, 0.046, 0);
  slottedPanel.castShadow = true;
  antHead.add(slottedPanel);

  // Волноводные щели на передней грани
  for (let s = 0; s < 5; s++) {
    const slotBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.048, 0.012),
      gunmetalMat
    );
    slotBar.position.set(0.036, 0.046, -0.08 + s * 0.04);
    antHead.add(slotBar);
  }

  // Направленная параболическая тарелка сопровождения (нижняя/передняя секция)
  const dishShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.068, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.42),
    radomeMat
  );
  dishShell.rotation.z = -Math.PI * 0.5;
  dishShell.rotation.y = Math.PI * 0.36;
  dishShell.position.set(0.012, -0.036, 0.03);
  antHead.add(dishShell);

  const feedHorn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.013, 0.052, 12),
    machinedSteelMat
  );
  feedHorn.rotation.z = -Math.PI * 0.5;
  feedHorn.rotation.y = Math.PI * 0.36;
  feedHorn.position.set(0.036, -0.036, 0.052);
  antHead.add(feedHorn);

  // Защитная дуга антенны
  const guardRail = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.012, 0.26),
    gunmetalMat
  );
  guardRail.position.set(0.022, 0.092, 0);
  antHead.add(guardRail);

  // =========================================================================
  // 3. БЛОК ПУСКОВЫХ ТУБУСОВ 2x4 (launchTubesGroup) И РОЙ ДРОНОВ (droneSwarm)
  // =========================================================================
  const launchTubesGroup = new THREE.Group();
  launchTubesGroup.name = 'launchTubesGroup';
  root.add(launchTubesGroup);

  // Передний бронепояс / надульный кожух вокруг блока шахт (z = 0.90 .. 0.98)
  const bezelFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.556, 0.352, 0.09),
    darkKhakiMat
  );
  bezelFrame.position.set(0, -0.29, 0.925);
  bezelFrame.castShadow = true;
  bezelFrame.receiveShadow = true;
  launchTubesGroup.add(bezelFrame);

  // Сетка 2 x 4 пусковых шахт (2 ряда по Y, 4 колонки по X)
  const colsX = [-0.177, -0.059, 0.059, 0.177];
  const rowsY = [-0.222, -0.352];
  const tubeMuzzleZ = 0.95;
  const tubeLength = 0.26;

  const tubePositions = [];
  rowsY.forEach((ry) => {
    colsX.forEach((cx) => {
      tubePositions.push(new THREE.Vector3(cx, ry, tubeMuzzleZ - tubeLength * 0.5 + 0.045));
    });
  });

  // 8 круглых пусковых тубусов с внутренними прорезями под складные крылья через InstancedMesh
  const slottedTubeGeo = createSlottedTubeGeometry(0.0475, 0.0395, 0.0448, 0.0068, tubeLength);
  const tubesInstanced = new THREE.InstancedMesh(slottedTubeGeo, gunmetalMat, tubePositions.length);
  tubesInstanced.name = 'launchTubesInstanced';
  tubesInstanced.castShadow = true;
  tubesInstanced.receiveShadow = true;

  // Усиливающие дульные кольца на срезе шахт (z = 0.95)
  const collarGeo = new THREE.TorusGeometry(0.047, 0.0045, 10, 28);
  const collarsInstanced = new THREE.InstancedMesh(collarGeo, machinedSteelMat, tubePositions.length);

  // Герметичные вышибные мембраны-заглушки (по одной на шахту, снимаются при пуске)
  const capGeo = new THREE.CylinderGeometry(0.0385, 0.0385, 0.008, 24);
  capGeo.rotateX(Math.PI / 2);
  const closedCapsInstanced = new THREE.InstancedMesh(capGeo, radomeMat, tubePositions.length);
  closedCapsInstanced.name = 'tubeCapsInstanced';

  const dummy = new THREE.Object3D();

  tubePositions.forEach((pos, idx) => {
    dummy.position.copy(pos);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    tubesInstanced.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(pos.x, pos.y, tubeMuzzleZ + 0.042);
    dummy.updateMatrix();
    collarsInstanced.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(pos.x, pos.y, tubeMuzzleZ + 0.036);
    dummy.updateMatrix();
    closedCapsInstanced.setMatrixAt(idx, dummy.matrix);
  });

  tubesInstanced.instanceMatrix.needsUpdate = true;
  collarsInstanced.instanceMatrix.needsUpdate = true;
  closedCapsInstanced.instanceMatrix.needsUpdate = true;

  launchTubesGroup.add(tubesInstanced);
  launchTubesGroup.add(collarsInstanced);
  launchTubesGroup.add(closedCapsInstanced);

  // --- Рой из 8 микро-дронов «Шершень-Р» (droneSwarm): по одному на шахту ---
  const droneSwarm = new THREE.Group();
  droneSwarm.name = 'droneSwarm';
  root.add(droneSwarm);

  const droneRadius = 0.033;
  const droneBodyLen = 0.36;

  const droneFuselageGeo = new THREE.CylinderGeometry(droneRadius * 0.94, droneRadius, droneBodyLen, 24);
  droneFuselageGeo.rotateX(Math.PI / 2);
  const tailConeGeo = new THREE.CylinderGeometry(droneRadius * 0.62, droneRadius, 0.075, 24);
  tailConeGeo.rotateX(Math.PI / 2);
  const tailBandGeo = new THREE.CylinderGeometry(droneRadius * 1.008, droneRadius * 1.008, 0.052, 24);
  tailBandGeo.rotateX(Math.PI / 2);
  const noseBezelGeo = new THREE.CylinderGeometry(droneRadius * 0.76, droneRadius * 0.94, 0.036, 24);
  noseBezelGeo.rotateX(Math.PI / 2);
  const wingSpanSingle = 0.255;
  const wingChord = 0.068;
  const wingThick = 0.0065;

  function buildScoutDrone() {
    const drone = new THREE.Group();

    // Цилиндрический композитный фюзеляж (#8b9299, roughness: 0.50)
    const droneFuselage = new THREE.Mesh(droneFuselageGeo, droneBodyMat);
    droneFuselage.castShadow = true;
    drone.add(droneFuselage);

    // Хвостовой конус с оранжевой сигнальной полосой
    const tailCone = new THREE.Mesh(tailConeGeo, droneBodyMat);
    tailCone.position.z = -droneBodyLen * 0.5 - 0.0375;
    drone.add(tailCone);

    const orangeTailBand = new THREE.Mesh(tailBandGeo, orangeBandMat);
    orangeTailBand.position.z = -droneBodyLen * 0.5 + 0.038;
    drone.add(orangeTailBand);

    // Верхний обтекатель модуля связи / ГЛОНАСС
    const dorsalSpine = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.014, 0.18),
      droneWingMat
    );
    dorsalSpine.position.set(0, droneRadius + 0.004, -0.02);
    drone.add(dorsalSpine);

    // Носовой обтекатель и оптический глазок в носу (+Z)
    const noseBezel = new THREE.Mesh(noseBezelGeo, gunmetalMat);
    noseBezel.position.z = droneBodyLen * 0.5 + 0.018;
    drone.add(noseBezel);

    const opticalEye = new THREE.Mesh(
      new THREE.SphereGeometry(droneRadius * 0.72, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      opticalLensMat
    );
    opticalEye.rotation.x = Math.PI * 0.5;
    opticalEye.position.z = droneBodyLen * 0.5 + 0.028;
    drone.add(opticalEye);

    // Складные прямые крылья на шарнирах (leftWingPivot, rightWingPivot)
    const buildWing = (sideSign) => {
      const pivot = new THREE.Group();
      pivot.position.set(sideSign * (droneRadius - 0.003), 0.008, 0.035);

      // При rotation.y = 0 крыло раскрыто перпендикулярно фюзеляжу;
      // при rotation.y = -sideSign * (Math.PI * 0.5) сложено назад вдоль корпуса
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(wingSpanSingle, wingThick, wingChord),
        droneWingMat
      );
      panel.position.set(sideSign * (wingSpanSingle * 0.5 + 0.004), 0, 0);
      panel.castShadow = true;
      pivot.add(panel);

      const tip = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, wingThick * 0.9, wingChord * 0.86),
        orangeBandMat
      );
      tip.position.set(sideSign * (wingSpanSingle + 0.014), 0, -0.003);
      pivot.add(tip);

      return pivot;
    };

    const leftWingPivot = buildWing(-1);
    const rightWingPivot = buildWing(1);
    drone.add(leftWingPivot);
    drone.add(rightWingPivot);

    // Хвостовое оперение (складные V-стабилизаторы + нижний киль)
    const tailFins = [];
    const finAngles = [Math.PI * 0.22, -Math.PI * 0.22, Math.PI];
    finAngles.forEach((angle) => {
      const finPivot = new THREE.Group();
      finPivot.position.set(0, 0, -droneBodyLen * 0.5 - 0.025);
      finPivot.rotation.z = angle;

      const finBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.005, 0.072, 0.048),
        orangeBandMat
      );
      finBlade.position.set(0, droneRadius * 0.72 + 0.032, -0.01);
      finPivot.add(finBlade);

      drone.add(finPivot);
      tailFins.push(finPivot);
    });

    // Толкающий складной винт в корме
    const propellerPivot = new THREE.Group();
    propellerPivot.position.set(0, 0, -droneBodyLen * 0.5 - 0.08);
    drone.add(propellerPivot);

    const spinner = new THREE.Mesh(
      new THREE.ConeGeometry(0.015, 0.028, 16),
      gunmetalMat
    );
    spinner.rotation.x = -Math.PI * 0.5;
    propellerPivot.add(spinner);

    const bladeGeo = new THREE.BoxGeometry(0.115, 0.012, 0.003);
    const bladeA = new THREE.Mesh(bladeGeo, gunmetalMat);
    bladeA.rotation.x = 0.28;
    propellerPivot.add(bladeA);

    drone.userData.wings = { leftWingPivot, rightWingPivot, tailFins, propellerPivot };
    return drone;
  }

  const scoutDrones = [];
  tubePositions.forEach((pos) => {
    const drone = buildScoutDrone();
    drone.position.set(pos.x, pos.y, 0.78);
    drone.userData.wings.leftWingPivot.rotation.y = Math.PI * 0.49;
    drone.userData.wings.rightWingPivot.rotation.y = -Math.PI * 0.49;
    drone.userData.wings.tailFins.forEach((fin) => { fin.scale.y = 0.28; });
    droneSwarm.add(drone);
    scoutDrones.push(drone);
  });

  // Сохраняем ссылки на подвижные узлы для анимации вылета и раскрытия крыльев
  root.userData = {
    mountFlange,
    cassetteBody,
    launchTubesGroup,
    droneSwarm,
    scoutDrones,
    tubePositions,
    capsInstanced: closedCapsInstanced,
    setWingDeploy(droneIdx, deployFactor) {
      const clamped = THREE.MathUtils.clamp(deployFactor, 0, 1);
      const foldAngle = (1 - clamped) * (Math.PI * 0.49);
      const wings = scoutDrones[droneIdx].userData.wings;
      wings.leftWingPivot.rotation.y = foldAngle;
      wings.rightWingPivot.rotation.y = -foldAngle;
      wings.tailFins.forEach((fin) => {
        fin.scale.y = 0.28 + 0.72 * clamped;
      });
    },
  };

  return root;
}

// ============================================================================
// Адаптер под единый просмотрщик: залп 8 дронов по расписанию.
// applySalvo(t, elapsed): абсолютное время цикла — пуск, полёт, вспышки.
// Возвращает { fired, flying } для телеметрии.
// ============================================================================
export function createWeapon() {
  const root = createWeaponShershenR();
  const ud = root.userData;
  const drones = ud.scoutDrones;
  const tubes = ud.tubePositions;
  const caps = ud.capsInstanced;

  // Дульные вспышки пневмовыброса: по одной на шахту
  const flashGeo = new THREE.ConeGeometry(0.055, 0.22, 12, 1, true);
  flashGeo.rotateX(Math.PI / 2);
  flashGeo.translate(0, 0, 0.11);
  const tubeFlashes = [];
  for (let i = 0; i < SHERSHEN_COUNT; i++) {
    const m = new THREE.MeshBasicMaterial({
      color: 0xd8e4ea,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const f = new THREE.Mesh(flashGeo, m);
    f.position.set(tubes[i].x, tubes[i].y, 0.99);
    f.visible = false;
    root.add(f);
    tubeFlashes.push(f);
  }

  const launchLight = new THREE.PointLight(0xbfd9ff, 0, 3.0, 1.8);
  launchLight.position.set(0, -0.29, 1.1);
  root.add(launchLight);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  const dummyL = new THREE.Object3D();
  const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);

  const setCap = (i, hidden) => {
    if (hidden) {
      caps.setMatrixAt(i, zeroM);
    } else {
      dummyL.position.set(tubes[i].x, tubes[i].y, 0.95 + 0.036);
      dummyL.rotation.set(0, 0, 0);
      dummyL.scale.set(1, 1, 1);
      dummyL.updateMatrix();
      caps.setMatrixAt(i, dummyL.matrix);
    }
    caps.instanceMatrix.needsUpdate = true;
  };

  ud.applySalvo = (t, elapsed) => {
    let fired = 0;
    let flying = 0;
    let lightLevel = 0;
    let recoil = 0;

    for (let k = 0; k < SHERSHEN_COUNT; k++) {
      const i = SHERSHEN_ORDER[k];
      const tFire = SHERSHEN_FIRST + k * SHERSHEN_INTERVAL;
      const drone = drones[i];
      const wings = drone.userData.wings;

      if (t < tFire) {
        // Дрон в шахте со сложенными крыльями
        drone.position.set(tubes[i].x, tubes[i].y, 0.78);
        drone.rotation.set(0, 0, 0);
        ud.setWingDeploy(i, 0);
        wings.propellerPivot.rotation.z = 0;
        setCap(i, false);
        tubeFlashes[i].visible = false;
      } else {
        fired++;
        const dt = t - tFire;
        const p = Math.min(1, dt / 0.7);
        const easeOut = 1 - Math.pow(1 - p, 2.6);

        let z = 0.78 + (1.35 - 0.78) * easeOut;
        let deploy = p > 0.55 ? ((p - 0.55) / 0.45) * 0.25 : 0;
        let yOff = 0, roll = 0, pitch = 0, prop = p * 22;

        if (dt > 0.7) {
          const q = Math.min(1, (dt - 0.7) / 0.8);
          const spring = 1 - Math.pow(1 - q, 3) * Math.cos(q * Math.PI * 1.5);
          z += Math.sin(q * Math.PI) * 0.03 + (dt - 0.7) * 1.1;
          deploy = 0.25 + 0.75 * Math.max(0, Math.min(1, spring));
          prop = 22 + q * 18;
          yOff = Math.sin(elapsed * 3.2 + i) * 0.008 * q;
          roll = Math.sin(elapsed * 2.4 + i * 1.3) * 0.06 * q;
        }
        if (dt > 1.5) {
          z += Math.sin(elapsed * 2.1 + i * 2.1) * 0.015;
          yOff = Math.sin(elapsed * 3.2 + i) * 0.011;
          roll = Math.sin(elapsed * 2.4 + i * 1.3) * 0.065;
          pitch = Math.cos(elapsed * 2.8 + i) * 0.025;
          deploy = 1;
          prop = 42;
        }

        const inRange = z < 9.0;
        if (inRange) flying++;
        drone.visible = inRange;
        drone.position.set(tubes[i].x, tubes[i].y + yOff, z);
        drone.rotation.set(pitch, 0, roll);
        ud.setWingDeploy(i, deploy);
        wings.propellerPivot.rotation.z = dt * prop;
        setCap(i, true);

        // Вспышка пневмовыброса
        const fl = Math.max(0, 1 - dt / 0.25);
        tubeFlashes[i].visible = fl > 0.01;
        tubeFlashes[i].material.opacity = fl * 0.5;
        const fs = 0.6 + (1 - fl) * 1.6;
        tubeFlashes[i].scale.set(fs, fs, 1 + (1 - fl));
        lightLevel = Math.max(lightLevel, fl);

        // Отдача кассеты
        if (dt < 0.7) recoil += -0.014 * Math.sin(Math.min(1, dt / 0.7) * Math.PI);
      }
    }

    root.position.z = recoil;
    launchLight.intensity = lightLevel * 5.0;
    return { fired, flying };
  };

  ud.setExtension = (t) => {
    const info = ud.applySalvo(Math.max(0, Math.min(SHERSHEN_CYCLE, t)), 0);
    return info;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
