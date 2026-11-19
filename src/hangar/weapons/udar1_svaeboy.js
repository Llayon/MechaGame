import * as THREE from 'three';

export const meta = {
  id: 'udar1',
  code: 'УДАР-1',
  title: 'УДАР-1 «Сваебой»',
  subtitle: 'НАРУЧНЫЙ ГИДРАВЛИЧЕСКИЙ ПНЕВМОТАРАН • УСП • ХОД 0.70 М • ДЛИНА 2.61 М',
  description: 'Наручный пневмотаран: стыковочная плита УСП, цилиндр-ресивер с двумя баллонами высокого давления, манометры МПа, открытая швеллерная рама с центральной возвратной пружиной и подвижный вольфрамовый боёк-таран. Выброс +0.70 м по +Z.',
  specs: [
    ['Длина модели', '2.61 м'],
    ['Ход бойка', '0.70 м'],
    ['Привод', 'Пневматика, 2 баллона ВД'],
    ['Контроль', '2 манометра МПа + вентили'],
    ['Боёк', 'Вольфрам, крестовина, пятак'],
    ['Возврат', 'Центральная пружина'],
  ],
  maxExtension: 0.7,
  unit: 'mm',
  tipOffset: 1.70,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочная плита (УСП)' },
    { key: 'pneumaticBody', label: '2. Ресивер, баллоны, манометры' },
    { key: 'guideFrame', label: '3. Силовая рама и пружина' },
    { key: 'rammerHead', label: '4. Подвижный боёк-таран' },
  ],
  cameras: {
    module: { pos: [2.3, 0.5, 3.2], target: [0, -0.4, 0.4] },
    striker: { pos: [1.2, 0.1, 3.1], target: [0, -0.44, 1.5] },
  },
  rangeMarkers: [],
  controls: 'ram',
};

export const MAX_STROKE = 0.7;
const SPRING_LEN = 0.78;

/**
 * Генерирует текстуру жёлто-чёрной полосы опасности с потёртостями
 */
function createHazardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d99b16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#181a1c';
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

  // Процедурные царапины и грязь
  for (let i = 0; i < 450; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(30, 32, 35, 0.35)' : 'rgba(220, 225, 230, 0.18)';
    ctx.fillRect(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      Math.random() * 14 + 2,
      Math.random() * 3 + 1
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Генерирует текстуру циферблата советского манометра
 */
function createGaugeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Корпус и циферблат
  ctx.fillStyle = '#e6e2d3';
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();

  // Красная зона высокого давления
  ctx.strokeStyle = '#b8251e';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(128, 128, 96, -Math.PI * 0.15, Math.PI * 0.25);
  ctx.stroke();

  // Деления шкалы
  ctx.strokeStyle = '#18191b';
  for (let i = 0; i <= 20; i++) {
    const angle = Math.PI * 0.75 + (i / 20) * Math.PI * 1.5;
    const isMajor = i % 5 === 0;
    const rIn = isMajor ? 82 : 92;
    const rOut = 106;
    ctx.lineWidth = isMajor ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(angle) * rIn, 128 + Math.sin(angle) * rIn);
    ctx.lineTo(128 + Math.cos(angle) * rOut, 128 + Math.sin(angle) * rOut);
    ctx.stroke();
  }

  // Надпись МПа
  ctx.fillStyle = '#18191b';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('МПа', 128, 178);

  // Стрелка в рабочей зоне
  ctx.save();
  ctx.translate(128, 128);
  ctx.rotate(Math.PI * 0.08);
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.moveTo(-6, 15);
  ctx.lineTo(0, -95);
  ctx.lineTo(6, 15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(128, 128, 12, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Генерирует карту шероховатости (roughnessMap) для потёртой окрашенной стали
 */
function createWornRoughnessTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#999999'; // ~0.6 roughness
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 600; i++) {
    const shade = Math.floor(70 + Math.random() * 140);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(
      Math.random() * 256,
      Math.random() * 256,
      Math.random() * 24 + 2,
      Math.random() * 6 + 1
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Создаёт procedural 3D-модель наручного гидравлического пневмотарана УДАР-1 «Сваебой»
 * @returns {THREE.Group} Корневая группа оружия с дочерними узлами и метаданными анимации
 */
export function createWeaponUDAR1Svaeboy() {
  const root = new THREE.Group();
  root.name = 'Weapon_UDAR1_Svaeboy';

  // --- PBR МАТЕРИАЛЫ ---
  const wornRoughness = createWornRoughnessTexture();
  const hazardTex = createHazardTexture();
  const gaugeTex = createGaugeTexture();

  const matOchreBody = new THREE.MeshStandardMaterial({
    color: 0xb5652a,
    metalness: 0.35,
    roughness: 0.6,
    roughnessMap: wornRoughness,
  });

  const matDarkSteel = new THREE.MeshStandardMaterial({
    color: 0x2c3035,
    metalness: 0.78,
    roughness: 0.45,
    roughnessMap: wornRoughness,
  });

  const matCastIron = new THREE.MeshStandardMaterial({
    color: 0x212428,
    metalness: 0.65,
    roughness: 0.72,
  });

  const matChrome = new THREE.MeshStandardMaterial({
    color: 0xd4dae0,
    metalness: 0.95,
    roughness: 0.15,
  });

  const matTungsten = new THREE.MeshStandardMaterial({
    color: 0x3a3d42,
    metalness: 0.88,
    roughness: 0.32,
    roughnessMap: wornRoughness,
  });

  const matRubber = new THREE.MeshStandardMaterial({
    color: 0x17181a,
    metalness: 0.08,
    roughness: 0.85,
  });

  const matBrass = new THREE.MeshStandardMaterial({
    color: 0xb88a32,
    metalness: 0.85,
    roughness: 0.3,
  });

  const matRedValve = new THREE.MeshStandardMaterial({
    color: 0x9e1f1b,
    metalness: 0.3,
    roughness: 0.5,
  });

  const matHazard = new THREE.MeshStandardMaterial({
    map: hazardTex,
    metalness: 0.3,
    roughness: 0.55,
  });

  const matGaugeFace = new THREE.MeshStandardMaterial({
    map: gaugeTex,
    roughness: 0.25,
    metalness: 0.1,
  });

  // Массив трансформаций для InstancedMesh всех болтов/заклёпок модели
  const boltMatrices = [];
  const dummy = new THREE.Object3D();
  const addBolt = (x, y, z, rx = 0, ry = 0, rz = 0, scale = 1) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    boltMatrices.push(dummy.matrix.clone());
  };

  // =========================================================================
  // 1. mountFlange — Стыковочная плита УСП в (0, 0, 0) (0.5 x 0.14 x 0.85 м)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Основная плита (верхняя плоскость в Y = +0.07 или центр в (0,0,0))
  const flangePlateGeo = new THREE.BoxGeometry(0.5, 0.1, 0.85);
  const flangePlate = new THREE.Mesh(flangePlateGeo, matDarkSteel);
  flangePlate.position.set(0, 0.02, 0);
  mountFlange.add(flangePlate);

  // Предупреждающие боковые планки УСП с жёлто-чёрной полосой
  const hazardStripGeo = new THREE.BoxGeometry(0.51, 0.045, 0.86);
  const hazardStrip = new THREE.Mesh(hazardStripGeo, matHazard);
  hazardStrip.position.set(0, -0.045, 0);
  mountFlange.add(hazardStrip);

  // Силовой переходник (пилон) от фланца вниз к цилиндру ресивера
  const pylonGeo = new THREE.BoxGeometry(0.36, 0.22, 0.72);
  const pylon = new THREE.Mesh(pylonGeo, matCastIron);
  pylon.position.set(0, -0.17, 0.02);
  mountFlange.add(pylon);

  // 4 силовых замка УСП по углам плиты
  const lockCoords = [
    [-0.22, 0.05, -0.34],
    [0.22, 0.05, -0.34],
    [-0.22, 0.05, 0.34],
    [0.22, 0.05, 0.34],
  ];
  const lockHousingGeo = new THREE.BoxGeometry(0.11, 0.08, 0.14);
  const lockPinGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.15, 12);
  lockPinGeo.rotateZ(Math.PI / 2);

  lockCoords.forEach(([lx, ly, lz]) => {
    const lockHousing = new THREE.Mesh(lockHousingGeo, matCastIron);
    lockHousing.position.set(lx, ly, lz);
    mountFlange.add(lockHousing);

    const lockPin = new THREE.Mesh(lockPinGeo, matChrome);
    lockPin.position.set(lx + Math.sign(lx) * 0.015, ly + 0.01, lz);
    mountFlange.add(lockPin);

    // Болты крепления замков
    addBolt(lx - 0.03, ly + 0.042, lz - 0.045, 0, 0, 0, 0.9);
    addBolt(lx + 0.03, ly + 0.042, lz + 0.045, 0, 0, 0, 0.9);
  });

  // =========================================================================
  // 2. pneumaticBody — Тяжёлый цилиндр-ресивер, баллоны, манометры, шланги
  // Ось ствола/цилиндра опущена на Y = -0.44 м под подвес мехи
  // =========================================================================
  const pneumaticBody = new THREE.Group();
  pneumaticBody.name = 'pneumaticBody';
  root.add(pneumaticBody);

  const axisY = -0.44;

  // Главный цилиндр-ресивер (Z: от -0.78 до +0.52, длина 1.30 м)
  const mainCylGeo = new THREE.CylinderGeometry(0.21, 0.21, 1.3, 24);
  mainCylGeo.rotateX(Math.PI / 2);
  const mainCyl = new THREE.Mesh(mainCylGeo, matOchreBody);
  mainCyl.position.set(0, axisY, -0.13);
  pneumaticBody.add(mainCyl);

  // Задняя массивная заглушка-казённик с буферным демпфером (Z = -0.84)
  const breechCapGeo = new THREE.CylinderGeometry(0.23, 0.19, 0.14, 24);
  breechCapGeo.rotateX(Math.PI / 2);
  const breechCap = new THREE.Mesh(breechCapGeo, matCastIron);
  breechCap.position.set(0, axisY, -0.84);
  pneumaticBody.add(breechCap);

  // Рёбра жёсткости (бандажные кольца) вокруг главного цилиндра
  const ribGeo = new THREE.CylinderGeometry(0.242, 0.242, 0.045, 24);
  ribGeo.rotateX(Math.PI / 2);
  const ribZPositions = [-0.72, -0.45, -0.18, 0.09, 0.36, 0.50];

  ribZPositions.forEach((rz) => {
    const rib = new THREE.Mesh(ribGeo, matDarkSteel);
    rib.position.set(0, axisY, rz);
    pneumaticBody.add(rib);

    // Болты по окружности каждого ребра жёсткости
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const bx = Math.cos(a) * 0.238;
      const by = axisY + Math.sin(a) * 0.238;
      addBolt(bx, by, rz + 0.025, Math.PI / 2, 0, 0, 0.85);
    }
  });

  // Боковые баллоны-аккумуляторы высокого давления (слева и справа)
  [-1, 1].forEach((side) => {
    const tankX = side * 0.30;
    const tankY = axisY + 0.02;

    // Тело баллона
    const tankGeo = new THREE.CylinderGeometry(0.088, 0.088, 0.86, 18);
    tankGeo.rotateX(Math.PI / 2);
    const tank = new THREE.Mesh(tankGeo, matOchreBody);
    tank.position.set(tankX, tankY, -0.18);
    pneumaticBody.add(tank);

    // Полусферические/конические торцы баллона
    const capFrontGeo = new THREE.CylinderGeometry(0.045, 0.088, 0.08, 18);
    capFrontGeo.rotateX(Math.PI / 2);
    const capFront = new THREE.Mesh(capFrontGeo, matDarkSteel);
    capFront.position.set(tankX, tankY, 0.29);
    pneumaticBody.add(capFront);

    const capRearGeo = new THREE.CylinderGeometry(0.088, 0.05, 0.08, 18);
    capRearGeo.rotateX(Math.PI / 2);
    const capRear = new THREE.Mesh(capRearGeo, matDarkSteel);
    capRear.position.set(tankX, tankY, -0.65);
    pneumaticBody.add(capRear);

    // Хомуты крепления баллонов к основному корпусу
    [-0.42, 0.06].forEach((clampZ) => {
      const clampGeo = new THREE.BoxGeometry(0.24, 0.06, 0.05);
      const clamp = new THREE.Mesh(clampGeo, matCastIron);
      clamp.position.set(side * 0.21, tankY, clampZ);
      pneumaticBody.add(clamp);

      addBolt(side * 0.27, tankY + 0.032, clampZ, 0, 0, 0, 0.8);
    });

    // Латунный тройник-коллектор и красный вентиль сброса давления
    const manifoldGeo = new THREE.BoxGeometry(0.06, 0.07, 0.07);
    const manifold = new THREE.Mesh(manifoldGeo, matBrass);
    manifold.position.set(tankX, tankY + 0.11, 0.18);
    pneumaticBody.add(manifold);

    const valveStemGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.05, 8);
    const valveStem = new THREE.Mesh(valveStemGeo, matChrome);
    valveStem.position.set(tankX + side * 0.03, tankY + 0.13, 0.18);
    valveStem.rotation.z = -side * 0.6;
    pneumaticBody.add(valveStem);

    const valveWheelGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.012, 12);
    const valveWheel = new THREE.Mesh(valveWheelGeo, matRedValve);
    valveWheel.position.set(tankX + side * 0.05, tankY + 0.15, 0.18);
    valveWheel.rotation.z = -side * 0.6;
    pneumaticBody.add(valveWheel);

    // Манометр (направлен вверх и чуть назад к оператору/борту)
    const gaugeBodyGeo = new THREE.CylinderGeometry(0.044, 0.044, 0.03, 18);
    const gaugeBody = new THREE.Mesh(gaugeBodyGeo, matBrass);
    gaugeBody.position.set(tankX, tankY + 0.16, 0.06);
    gaugeBody.rotation.x = -0.35;
    pneumaticBody.add(gaugeBody);

    const gaugeDialGeo = new THREE.CircleGeometry(0.039, 18);
    gaugeDialGeo.rotateX(-Math.PI / 2);
    const gaugeDial = new THREE.Mesh(gaugeDialGeo, matGaugeFace);
    gaugeDial.position.set(tankX, tankY + 0.175, 0.055);
    gaugeDial.rotation.x = -0.35;
    pneumaticBody.add(gaugeDial);

    // Толстые резиновые шланги высокого давления (TubeGeometry)
    const hoseCurve1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(tankX, tankY, 0.32),
      new THREE.Vector3(tankX + side * 0.06, tankY - 0.08, 0.44),
      new THREE.Vector3(side * 0.22, axisY - 0.14, 0.52),
      new THREE.Vector3(side * 0.14, axisY - 0.12, 0.46),
    ]);
    const hose1 = new THREE.Mesh(
      new THREE.TubeGeometry(hoseCurve1, 20, 0.024, 10, false),
      matRubber
    );
    pneumaticBody.add(hose1);

    const hoseCurve2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(tankX, tankY + 0.08, -0.58),
      new THREE.Vector3(tankX + side * 0.05, tankY + 0.18, -0.68),
      new THREE.Vector3(side * 0.15, axisY + 0.22, -0.62),
      new THREE.Vector3(side * 0.12, axisY + 0.18, -0.45),
    ]);
    const hose2 = new THREE.Mesh(
      new THREE.TubeGeometry(hoseCurve2, 20, 0.02, 10, false),
      matRubber
    );
    pneumaticBody.add(hose2);
  });

  // =========================================================================
  // 3. guideFrame — Открытая силовая рама из швеллеров + пружины отдачи
  // =========================================================================
  const guideFrame = new THREE.Group();
  guideFrame.name = 'guideFrame';
  root.add(guideFrame);

  // Профиль стального швеллера (U-образный через ExtrudeGeometry)
  const channelShape = new THREE.Shape();
  const cw = 0.065; // ширина полки
  const ch = 0.085; // высота стенки
  const ct = 0.014; // толщина металла
  channelShape.moveTo(-cw / 2, -ch / 2);
  channelShape.lineTo(cw / 2, -ch / 2);
  channelShape.lineTo(cw / 2, -ch / 2 + ct);
  channelShape.lineTo(-cw / 2 + ct, -ch / 2 + ct);
  channelShape.lineTo(-cw / 2 + ct, ch / 2 - ct);
  channelShape.lineTo(cw / 2, ch / 2 - ct);
  channelShape.lineTo(cw / 2, ch / 2);
  channelShape.lineTo(-cw / 2, ch / 2);
  channelShape.closePath();

  const beamLength = 0.92; // от Z = 0.50 до Z = 1.42
  const channelGeo = new THREE.ExtrudeGeometry(channelShape, {
    depth: beamLength,
    bevelEnabled: false,
  });

  // 4 продольных швеллера силовой рамы по углам
  const beamOffsets = [
    [-0.22, axisY + 0.19, 0],
    [0.22, axisY + 0.19, Math.PI],
    [-0.22, axisY - 0.19, 0],
    [0.22, axisY - 0.19, Math.PI],
  ];

  beamOffsets.forEach(([bx, by, rotZ]) => {
    const beam = new THREE.Mesh(channelGeo, matDarkSteel);
    beam.position.set(bx, by, 0.50);
    beam.rotation.z = rotZ;
    guideFrame.add(beam);
  });

  // Передняя массивная траверса-направляющая (Z = 1.38)
  const frontBulkheadGeo = new THREE.BoxGeometry(0.52, 0.46, 0.09);
  const frontBulkhead = new THREE.Mesh(frontBulkheadGeo, matCastIron);
  frontBulkhead.position.set(0, axisY, 1.38);
  guideFrame.add(frontBulkhead);

  // Промежуточная рама-стяжка с косынками (Z = 0.94)
  const midBraceGeo = new THREE.BoxGeometry(0.48, 0.42, 0.05);
  const midBrace = new THREE.Mesh(midBraceGeo, matDarkSteel);
  midBrace.position.set(0, axisY, 0.94);
  guideFrame.add(midBrace);

  // Бронзовая направляющая втулка-сальник для штока
  const bushingGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.14, 24);
  bushingGeo.rotateX(Math.PI / 2);
  const bushing = new THREE.Mesh(bushingGeo, matBrass);
  bushing.position.set(0, axisY, 1.39);
  guideFrame.add(bushing);

  // Болты крепления передней траверсы
  for (let x of [-0.21, 0.21]) {
    for (let y of [axisY - 0.18, axisY + 0.18]) {
      addBolt(x, y, 1.43, Math.PI / 2, 0, 0, 1.15);
    }
  }

  // Мощные винтовые пружины амортизаторов отдачи (вокруг центрального штока)
  // Используем витую спираль из TubeGeometry (4 параллельных демпфера в углах рамы + главная центральная)
  function createHelicalSpring(radius, wireRadius, length, turns) {
    const points = [];
    const steps = turns * 18;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * turns * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          t * length
        )
      );
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, steps, wireRadius, 8, false);
  }

  // Главная центральная возвратная пружина вокруг штока (внутри открытой рамы)
  const mainSpringGeo = createHelicalSpring(0.125, 0.015, 0.78, 11);
  const mainSpring = new THREE.Mesh(mainSpringGeo, matDarkSteel);
  mainSpring.position.set(0, axisY, 0.54);
  guideFrame.add(mainSpring);

  // =========================================================================
  // 4. rammerHead — Подвижная группа выброса бойка (выброс +0.7 м по +Z)
  // Общая длина модели в покое: от Z = -0.91 до Z = +1.70 (~2.61 м)
  // =========================================================================
  const rammerHead = new THREE.Group();
  rammerHead.name = 'rammerHead';
  root.add(rammerHead);

  // Толстый хромированный шток большого диаметра (R = 0.085 м)
  const rodGeo = new THREE.CylinderGeometry(0.085, 0.085, 1.15, 24);
  rodGeo.rotateX(Math.PI / 2);
  const rod = new THREE.Mesh(rodGeo, matChrome);
  rod.position.set(0, axisY, 0.96);
  rammerHead.add(rod);

  // Хвостовик-переходник ударной головки (Z = 1.50)
  const collarGeo = new THREE.CylinderGeometry(0.135, 0.11, 0.11, 20);
  collarGeo.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, matCastIron);
  collar.position.set(0, axisY, 1.50);
  rammerHead.add(collar);

  // Массивный вольфрамовый боёк-наковальня с фасками и крестообразным профилем (ExtrudeGeometry)
  const anvilShape = new THREE.Shape();
  const aOut = 0.175; // внешний радиус креста
  const aIn = 0.095;  // внутренний вырез
  const bvl = 0.025;  // срез угла

  // Восьмиугольно-крестообразный контур с мощными силовыми рёбрами
  anvilShape.moveTo(-aIn, aOut);
  anvilShape.lineTo(aIn, aOut);
  anvilShape.lineTo(aIn + bvl, aIn + bvl);
  anvilShape.lineTo(aOut, aIn);
  anvilShape.lineTo(aOut, -aIn);
  anvilShape.lineTo(aIn + bvl, -aIn - bvl);
  anvilShape.lineTo(aIn, -aOut);
  anvilShape.lineTo(-aIn, -aOut);
  anvilShape.lineTo(-aIn - bvl, -aIn - bvl);
  anvilShape.lineTo(-aOut, -aIn);
  anvilShape.lineTo(-aOut, aIn);
  anvilShape.lineTo(-aIn - bvl, aIn + bvl);
  anvilShape.closePath();

  const anvilGeo = new THREE.ExtrudeGeometry(anvilShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.016,
    bevelThickness: 0.018,
  });

  const anvilHead = new THREE.Mesh(anvilGeo, matTungsten);
  anvilHead.position.set(0, axisY, 1.54);
  rammerHead.add(anvilHead);

  // Центральный ударный пятак из закалённого карбида вольфрама (Z = 1.69)
  const strikerPadGeo = new THREE.CylinderGeometry(0.105, 0.125, 0.035, 8);
  strikerPadGeo.rotateX(Math.PI / 2);
  const strikerPad = new THREE.Mesh(strikerPadGeo, matChrome);
  strikerPad.position.set(0, axisY, 1.685);
  rammerHead.add(strikerPad);

  // =========================================================================
  // InstancedMesh для всех болтов конструкции
  // =========================================================================
  const boltGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.016, 6);
  const boltInstanced = new THREE.InstancedMesh(boltGeo, matChrome, boltMatrices.length);
  boltInstanced.name = 'hardwareBolts';
  boltMatrices.forEach((matrix, idx) => {
    boltInstanced.setMatrixAt(idx, matrix);
  });
  boltInstanced.instanceMatrix.needsUpdate = true;
  root.add(boltInstanced);

  // Включение теней для всех мешей
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  // Ссылки для удобного доступа к анимации выброса бойка и сжатия пружины
  root.userData = {
    mountFlange,
    pneumaticBody,
    guideFrame,
    rammerHead,
    mainSpring,
    maxStroke: 0.7, // максимальный ход выброса бойка +0.7 м вдоль +Z
  };

  return root;
}

// =========================================================================
// Адаптер под единый просмотрщик: createWeapon() + setExtension + setWireframe
// Ход бойка 0..0.7 м: rammerHead сдвигается по +Z, центральная пружина
// растягивается вслед за ним. Возвращает { ratio, pressure } для телеметрии.
// =========================================================================
export function createWeapon() {
  const root = createWeaponUDAR1Svaeboy();
  const ud = root.userData;
  const rammer = ud.rammerHead;
  const spring = ud.mainSpring;

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  ud.maxStroke = MAX_STROKE;
  ud.setExtension = (stroke, opts = {}) => {
    const s = Math.max(0, Math.min(MAX_STROKE, stroke));
    rammer.position.z = s;
    spring.scale.z = 1 + s / SPRING_LEN;
    const ratio = s / MAX_STROKE;
    const pressure = opts.pressure !== undefined ? opts.pressure : 3 + 9 * ratio;
    return { ratio, pressure };
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
