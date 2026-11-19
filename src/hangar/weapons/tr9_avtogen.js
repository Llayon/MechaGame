import * as THREE from 'three';

export const meta = {
  id: 'tr9',
  code: 'ТР-9',
  title: 'ТР-9 «Автоген»',
  subtitle: 'НАРУЧНЫЙ ПЛАЗМЕННО-ТЕРМИЧЕСКИЙ РЕЗАК • СЛОТ MAIN • ШТАНГА 0.40 М',
  description:
    'Наручный плазменно-термический резак: фланец УСП, генераторный моноблок с баллонами кислорода и топлива, латунными редукторами и манометрами, защитными дугами и радиаторами. Телескопическая штанга выдвигается на 0.40 м; керамический изолятор, медные кольца фокусировки, искровой щиток и коническое сопло с побежалостью. Плазменный факел: дежурный режим в сложенном виде, форсаж в рабочем.',
  specs: [
    ['Ход штанги', '0.40 м'],
    ['Сопло', 'Медное, срез z = 1.95 м'],
    ['Реагенты', 'O₂ + топливо, 2 баллона'],
    ['Факел', 'Ядро + корона, форсаж'],
    ['Длина сложенным', '2.60 м'],
    ['Слот', 'MAIN'],
  ],
  maxExtension: 0.4,
  unit: 'm',
  tipOffset: 2.35,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'cutterChassis', label: '2. Корпус и баллоны реагента' },
    { key: 'reagentCylinders', label: '3. Баллоны O₂ и топлива' },
    { key: 'lanceNozzleGroup', label: '4. Телескопическая штанга' },
    { key: 'plasmaTorch', label: '5. Плазменный факел' },
  ],
  cameras: {
    module: { pos: [2.35, 0.85, 2.55], target: [0.05, -0.35, 0.65] },
  },
  rangeMarkers: [],
  controls: 'blade',
};

const LANCE_STROKE = 0.4;

/**
 * Процедурная генерация текстуры жёлто-чёрной полосы опасности с индустриальным износом
 */
function createHazardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d4941a';
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

  // Потёртости и сколы краски
  for (let i = 0; i < 450; i++) {
    const sx = Math.random() * canvas.width;
    const sy = Math.random() * canvas.height;
    const r = 1 + Math.random() * 3.5;
    ctx.fillStyle = Math.random() > 0.4 ? 'rgba(65, 70, 75, 0.35)' : 'rgba(255, 230, 180, 0.15)';
    ctx.fillRect(sx, sy, r * 2, r * 0.7);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Процедурная текстура трафаретной маркировки в советском инженерно-спасательном стиле
 */
function createStencilTexture(bgHex, titleText, subText, warnText = '') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Лёгкая фактура краски и потёртости
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(Math.random() * 512, Math.random() * 256, 4, 2);
  }

  // Рамка трафарета
  ctx.strokeStyle = 'rgba(235, 230, 215, 0.72)';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, 480, 224);

  // Заголовок
  ctx.fillStyle = 'rgba(240, 236, 222, 0.88)';
  ctx.font = 'bold 44px "Courier New", monospace';
  ctx.fillText(titleText, 34, 78);

  // Подзаголовок
  ctx.font = 'bold 24px "Courier New", monospace';
  ctx.fillStyle = 'rgba(225, 220, 205, 0.78)';
  ctx.fillText(subText, 34, 122);

  if (warnText) {
    ctx.fillStyle = '#e2a322';
    ctx.fillRect(34, 152, 444, 54);
    ctx.fillStyle = '#16181a';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillText(warnText, 48, 188);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Процедурная текстура циферблата манометра
 */
function createGaugeDialTexture(accentColor = '#b52b22') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#e6e1d3';
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#222528';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Шкала
  for (let i = 0; i <= 20; i++) {
    const angle = Math.PI * 0.75 + (i / 20) * Math.PI * 1.5;
    const isMajor = i % 5 === 0;
    const r1 = isMajor ? 84 : 94;
    const r2 = 108;
    ctx.strokeStyle = i >= 16 ? accentColor : '#1c1f22';
    ctx.lineWidth = isMajor ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(angle) * r1, 128 + Math.sin(angle) * r1);
    ctx.lineTo(128 + Math.cos(angle) * r2, 128 + Math.sin(angle) * r2);
    ctx.stroke();
  }

  // Стрелка
  ctx.strokeStyle = '#151719';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 + Math.cos(-0.45) * 86, 128 + Math.sin(-0.45) * 86);
  ctx.stroke();

  ctx.fillStyle = '#2b2e33';
  ctx.beginPath();
  ctx.arc(128, 128, 12, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Процедурная текстура побежалости металла на коническом сопле
 */
function createHeatTemperTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Градиент от основания сопла (v=0, низ текстуры) к кончику (v=1, верх текстуры)
  const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
  grad.addColorStop(0.0, '#282b30'); // Тёмная оружейная сталь
  grad.addColorStop(0.45, '#2d3138');
  grad.addColorStop(0.62, '#6b4d2b'); // Соломенно-бронзовый отпуск
  grad.addColorStop(0.76, '#4d2c6b'); // Фиолетовый термооттенок
  grad.addColorStop(0.90, '#1e427d'); // Синяя побежалость
  grad.addColorStop(1.0, '#172b52'); // Тёмно-синий перекал на срезе сопла

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Создаёт процедурную 3D-модель наручного плазменно-термического резака ТР-9 «Автоген»
 * Система координат:
 * - 1 unit = 1 метр, общая длина в сложенном состоянии ~2.60 м (z: -0.65 .. +1.95)
 * - Сопло направлено вдоль +Z, верх +Y, правый борт +X
 * - (0, 0, 0) — центр верхней плоскости стыковочного фланца УСП
 *
 * @returns {THREE.Group}
 */
export function createWeaponTR9Avtogen() {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'TR9_Avtogen';

  // ==================== ОБЩИЕ PBR-МАТЕРИАЛЫ ====================
  const matChassisGrey = new THREE.MeshStandardMaterial({
    color: 0x5c6268,
    metalness: 0.50,
    roughness: 0.60,
  });

  const matDarkSteel = new THREE.MeshStandardMaterial({
    color: 0x2c3035,
    metalness: 0.78,
    roughness: 0.38,
  });

  const matMachinedSteel = new THREE.MeshStandardMaterial({
    color: 0x8c939b,
    metalness: 0.85,
    roughness: 0.28,
  });

  const matOrangeArmor = new THREE.MeshStandardMaterial({
    color: 0xb55d24,
    metalness: 0.35,
    roughness: 0.52,
  });

  const matOxygenBlue = new THREE.MeshStandardMaterial({
    color: 0x365573,
    metalness: 0.42,
    roughness: 0.48,
  });

  const matFuelRed = new THREE.MeshStandardMaterial({
    color: 0x8f3229,
    metalness: 0.42,
    roughness: 0.48,
  });

  const matBrass = new THREE.MeshStandardMaterial({
    color: 0xb08642,
    metalness: 0.85,
    roughness: 0.28,
  });

  const matCopper = new THREE.MeshStandardMaterial({
    color: 0xb86634,
    metalness: 0.88,
    roughness: 0.24,
  });

  const matCeramic = new THREE.MeshStandardMaterial({
    color: 0xd9d2c4,
    metalness: 0.05,
    roughness: 0.35,
  });

  const matRubberHose = new THREE.MeshStandardMaterial({
    color: 0x1a1c1f,
    metalness: 0.10,
    roughness: 0.82,
  });

  const matHazard = new THREE.MeshStandardMaterial({
    map: createHazardTexture(),
    metalness: 0.35,
    roughness: 0.55,
  });

  const matNozzleTemper = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createHeatTemperTexture(),
    metalness: 0.90,
    roughness: 0.25,
  });

  // Вспомогательная функция добавления заклёпок/болтов
  const boltGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6);
  function addBolts(parent, positions, rotationAxis = 'z', angle = Math.PI / 2) {
    positions.forEach(([bx, by, bz]) => {
      const bolt = new THREE.Mesh(boltGeo, matMachinedSteel);
      bolt.position.set(bx, by, bz);
      if (rotationAxis === 'x') bolt.rotation.x = angle;
      if (rotationAxis === 'z') bolt.rotation.z = angle;
      bolt.castShadow = true;
      parent.add(bolt);
    });
  }

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  rootGroup.add(mountFlange);

  // Основная стальная плита УСП 0.50 x 0.14 x 0.85 м (верхняя грань строго на Y = 0)
  const plateW = 0.50;
  const plateH = 0.14;
  const plateD = 0.85;
  const basePlate = new THREE.Mesh(new THREE.BoxGeometry(plateW, plateH, plateD), matDarkSteel);
  basePlate.position.set(0, -plateH / 2, 0);
  basePlate.castShadow = true;
  basePlate.receiveShadow = true;
  mountFlange.add(basePlate);

  // Верхняя привалочная плоскость с направляющими шпонками УСП (Y = 0)
  const topGuideRailGeo = new THREE.BoxGeometry(0.06, 0.014, 0.78);
  [-0.14, 0.14].forEach((rx) => {
    const rail = new THREE.Mesh(topGuideRailGeo, matMachinedSteel);
    rail.position.set(rx, -0.003, 0);
    rail.castShadow = true;
    mountFlange.add(rail);
  });

  // Центральный стыковочный разъём питания на верхней плите
  const powerSocket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.052, 0.02, 16),
    matBrass
  );
  powerSocket.position.set(0, -0.005, -0.18);
  mountFlange.add(powerSocket);

  // Боковые полосы безопасности (CanvasTexture жёлто-чёрной полосы опасности)
  const hazardStripGeo = new THREE.BoxGeometry(0.012, 0.048, plateD - 0.04);
  [-plateW / 2 - 0.004, plateW / 2 + 0.004].forEach((hx) => {
    const strip = new THREE.Mesh(hazardStripGeo, matHazard);
    strip.position.set(hx, -0.042, 0);
    mountFlange.add(strip);
  });

  // 4 силовых замка УСП по углам плиты
  const lockPositions = [
    [-0.255, -0.075, -0.29],
    [0.255, -0.075, -0.29],
    [-0.255, -0.075, 0.29],
    [0.255, -0.075, 0.29],
  ];

  lockPositions.forEach(([lx, ly, lz]) => {
    const lockUnit = new THREE.Group();
    lockUnit.position.set(lx, ly, lz);
    const sideSign = Math.sign(lx);

    // Корпус замка
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.095, 0.13), matChassisGrey);
    housing.castShadow = true;
    lockUnit.add(housing);

    // Прижимной эксцентриковый кулачок
    const camLever = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.07, 14),
      matOrangeArmor
    );
    camLever.rotation.x = Math.PI / 2;
    camLever.position.set(sideSign * 0.024, 0.015, 0);
    lockUnit.add(camLever);

    // Стопорный штифт
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.085, 12),
      matMachinedSteel
    );
    pin.position.set(sideSign * 0.018, 0.032, 0.035);
    lockUnit.add(pin);

    mountFlange.add(lockUnit);
  });

  // =========================================================================
  // 2. СИЛОВОЙ КОРПУС И БАЛЛОНЫ РЕАГЕНТА (cutterChassis)
  // =========================================================================
  const cutterChassis = new THREE.Group();
  cutterChassis.name = 'cutterChassis';
  rootGroup.add(cutterChassis);

  // Силовая рама-переходник под фланцем (Y: -0.14 .. -0.20)
  const neckAdapter = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.78), matDarkSteel);
  neckAdapter.position.set(0, -0.17, 0.02);
  neckAdapter.castShadow = true;
  cutterChassis.add(neckAdapter);

  // Основной сварочно-генераторный моноблок (Z: -0.65 .. +0.66, Y: -0.20 .. -0.66)
  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.46, 1.31), matChassisGrey);
  mainBody.position.set(-0.02, -0.43, 0.005);
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  cutterChassis.add(mainBody);

  // Скошенная верхняя носовая бронеплита генератора (Z: +0.42 .. +0.70)
  const frontUpperHood = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.28), matChassisGrey);
  frontUpperHood.position.set(-0.02, -0.31, 0.58);
  frontUpperHood.rotation.x = 0.24;
  frontUpperHood.castShadow = true;
  cutterChassis.add(frontUpperHood);

  // Оранжевые защитные бронепанели (#b55d24)
  // Левая бортовая панель с трафаретом ТР-9 «АВТОГЕН»
  const leftStencilTex = createStencilTexture(
    '#b55d24',
    'ТР-9 «АВТОГЕН»',
    'РЕЗАК ПЛАЗМЕННО-ТЕРМИЧЕСКИЙ',
    'ОПАСНО • ВЫСОКАЯ ТЕМПЕРАТУРА'
  );
  const matLeftStencil = new THREE.MeshStandardMaterial({
    map: leftStencilTex,
    metalness: 0.35,
    roughness: 0.52,
  });

  const leftArmorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.26, 0.76), matLeftStencil);
  leftArmorPanel.position.set(-0.27, -0.44, 0.08);
  leftArmorPanel.castShadow = true;
  cutterChassis.add(leftArmorPanel);

  addBolts(
    cutterChassis,
    [
      [-0.285, -0.33, -0.26],
      [-0.285, -0.33, 0.42],
      [-0.285, -0.55, -0.26],
      [-0.285, -0.55, 0.42],
    ],
    'z',
    Math.PI / 2
  );

  // Передний оранжевый кожух выходного узла штанги
  const frontCollarHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.28, 0.14),
    matOrangeArmor
  );
  frontCollarHousing.position.set(0, -0.43, 0.68);
  frontCollarHousing.castShadow = true;
  cutterChassis.add(frontCollarHousing);

  // Нижний защитный поддон корпуса
  const bellySkidPlate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.035, 1.24), matOrangeArmor);
  bellySkidPlate.position.set(-0.02, -0.675, 0.01);
  bellySkidPlate.castShadow = true;
  cutterChassis.add(bellySkidPlate);

  // Ребристые радиаторы охлаждения (левый борт и корма)
  const radiatorGroup = new THREE.Group();
  radiatorGroup.name = 'coolingRadiators';
  cutterChassis.add(radiatorGroup);

  const finGeo = new THREE.BoxGeometry(0.045, 0.24, 0.012);
  for (let i = 0; i < 14; i++) {
    const fin = new THREE.Mesh(finGeo, matDarkSteel);
    fin.position.set(-0.275, -0.43, -0.60 + i * 0.022);
    fin.castShadow = true;
    radiatorGroup.add(fin);
  }

  // Задний блок вентиляционных жалюзи и клеммной коробки (Z = -0.65)
  const rearHousing = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.40, 0.06), matDarkSteel);
  rearHousing.position.set(-0.02, -0.43, -0.66);
  rearHousing.castShadow = true;
  radiatorGroup.add(rearHousing);

  const rearFinGeo = new THREE.BoxGeometry(0.36, 0.014, 0.035);
  for (let r = 0; r < 8; r++) {
    const rFin = new THREE.Mesh(rearFinGeo, matMachinedSteel);
    rFin.position.set(-0.02, -0.28 - r * 0.038, -0.685);
    rFin.rotation.x = 0.35;
    radiatorGroup.add(rFin);
  }

  // Массивная направляющая муфта телескопической штанги (выход по оси +Z, Y = -0.42)
  const guideSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.105, 0.24, 24),
    matDarkSteel
  );
  guideSleeve.rotation.x = Math.PI / 2;
  guideSleeve.position.set(0, -0.42, 0.76);
  guideSleeve.castShadow = true;
  cutterChassis.add(guideSleeve);

  const guideBrassRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.096, 0.011, 12, 24),
    matBrass
  );
  guideBrassRing.position.set(0, -0.42, 0.87);
  cutterChassis.add(guideBrassRing);

  // ---------------- БАЛЛОНЫ РЕАГЕНТА НА ПРАВОМ БОРТУ (+X) ----------------
  const tanksGroup = new THREE.Group();
  tanksGroup.name = 'reagentCylinders';
  cutterChassis.add(tanksGroup);

  const dialTexO2 = createGaugeDialTexture('#2266aa');
  const dialTexFuel = createGaugeDialTexture('#b52b22');

  /**
   * Вспомогательная сборка баллона с латунным редуктором, манометром и шлангом
   */
  function buildGasCylinder({
    name,
    zPos,
    radius,
    bodyHeight,
    tankMaterial,
    dialTexture,
    hoseTargetZ,
  }) {
    const unit = new THREE.Group();
    unit.name = name;
    const xPos = 0.355;
    const baseY = -0.64;
    unit.position.set(xPos, baseY, zPos);

    // Цилиндрическая обечайка баллона
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, bodyHeight, 28),
      tankMaterial
    );
    body.position.y = bodyHeight / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    unit.add(body);

    // Сферический купол и башмак баллона
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      tankMaterial
    );
    dome.position.y = bodyHeight;
    dome.castShadow = true;
    unit.add(dome);

    const footRing = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.02, radius * 1.04, 0.04, 24),
      matDarkSteel
    );
    footRing.position.y = 0.02;
    unit.add(footRing);

    // Стальные хомуты крепления баллона к корпусу
    [bodyHeight * 0.25, bodyHeight * 0.78].forEach((strapY) => {
      const strap = new THREE.Mesh(
        new THREE.CylinderGeometry(radius + 0.008, radius + 0.008, 0.028, 28),
        matDarkSteel
      );
      strap.position.y = strapY;
      unit.add(strap);

      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.06), matDarkSteel);
      bracket.position.set(-0.07, strapY, 0);
      unit.add(bracket);
    });

    // Латунный запорный вентиль и редуктор на горловине
    const neckY = bodyHeight + radius * 0.92;
    const valveBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.028, 0.085, 16),
      matBrass
    );
    valveBody.position.y = neckY + 0.035;
    valveBody.castShadow = true;
    unit.add(valveBody);

    // Маховик вентиля (барашек)
    const handWheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.034, 0.006, 10, 18),
      matDarkSteel
    );
    handWheel.rotation.x = Math.PI / 2;
    handWheel.position.y = neckY + 0.082;
    unit.add(handWheel);

    // Корпус редуктора сбоку
    const regulator = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.045, 18),
      matBrass
    );
    regulator.rotation.z = Math.PI / 2;
    regulator.position.set(-0.035, neckY + 0.04, 0.025);
    unit.add(regulator);

    // Манометр с циферблатом
    const gaugeCase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.022, 20),
      matBrass
    );
    gaugeCase.rotation.x = Math.PI / 2;
    gaugeCase.position.set(0.02, neckY + 0.055, 0.038);
    unit.add(gaugeCase);

    const gaugeFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.023, 20),
      new THREE.MeshBasicMaterial({ map: dialTexture })
    );
    gaugeFace.position.set(0.02, neckY + 0.055, 0.050);
    unit.add(gaugeFace);

    // Гибкий рукав высокого давления в коллектор корпуса
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.045, neckY + 0.038, 0.025),
      new THREE.Vector3(-0.10, neckY + 0.075, (zPos + hoseTargetZ) * 0.25 - zPos),
      new THREE.Vector3(-0.145, neckY - 0.01, hoseTargetZ - zPos),
    ]);
    const hoseGeo = new THREE.TubeGeometry(hoseCurve, 20, 0.011, 10, false);
    const hose = new THREE.Mesh(hoseGeo, matRubberHose);
    hose.castShadow = true;
    unit.add(hose);

    // Латунный штуцер входа в корпус
    const fitting = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.03, 6),
      matBrass
    );
    fitting.rotation.z = Math.PI / 2;
    fitting.position.set(-0.145, neckY - 0.01, hoseTargetZ - zPos);
    unit.add(fitting);

    return unit;
  }

  // Кислородный баллон (синий #365573) — задний на правом борту
  const oxygenTank = buildGasCylinder({
    name: 'oxygenCylinder',
    zPos: -0.23,
    radius: 0.102,
    bodyHeight: 0.37,
    tankMaterial: matOxygenBlue,
    dialTexture: dialTexO2,
    hoseTargetZ: -0.10,
  });
  tanksGroup.add(oxygenTank);

  // Топливный баллон (красный #8f3229) — передний на правом борту
  const fuelTank = buildGasCylinder({
    name: 'fuelCylinder',
    zPos: 0.23,
    radius: 0.112,
    bodyHeight: 0.34,
    tankMaterial: matFuelRed,
    dialTexture: dialTexFuel,
    hoseTargetZ: 0.12,
  });
  tanksGroup.add(fuelTank);

  // ---------------- ЗАЩИТНЫЕ ДУГИ БЕЗОПАСНОСТИ (ROLL-BARS) ----------------
  const rollBarsGroup = new THREE.Group();
  rollBarsGroup.name = 'safetyRollBars';
  cutterChassis.add(rollBarsGroup);

  function createTubeBar(points, radius = 0.016, material = matDarkSteel) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.18);
    const geo = new THREE.TubeGeometry(curve, 36, radius, 12, false);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    return mesh;
  }

  // Внешняя силовая дуга ограждения баллонов (+X)
  rollBarsGroup.add(
    createTubeBar([
      new THREE.Vector3(0.22, -0.22, -0.46),
      new THREE.Vector3(0.49, -0.22, -0.42),
      new THREE.Vector3(0.50, -0.63, -0.40),
      new THREE.Vector3(0.50, -0.63, 0.42),
      new THREE.Vector3(0.49, -0.22, 0.44),
      new THREE.Vector3(0.22, -0.22, 0.48),
    ])
  );

  // Средняя поперечина защитной клетки баллонов
  rollBarsGroup.add(
    createTubeBar([
      new THREE.Vector3(0.22, -0.43, 0.0),
      new THREE.Vector3(0.50, -0.43, 0.0),
    ])
  );

  // Левая нижняя защитная дуга-полоз (-X)
  rollBarsGroup.add(
    createTubeBar([
      new THREE.Vector3(-0.24, -0.24, -0.58),
      new THREE.Vector3(-0.32, -0.30, -0.54),
      new THREE.Vector3(-0.32, -0.66, -0.50),
      new THREE.Vector3(-0.32, -0.66, 0.52),
      new THREE.Vector3(-0.32, -0.30, 0.56),
      new THREE.Vector3(-0.24, -0.24, 0.60),
    ])
  );

  // =========================================================================
  // 3. ТЕЛЕСКОПИЧЕСКАЯ ШТАНГА-РЕЗАК (lanceNozzleGroup)
  // Выдвигается вперёд по +Z на 0.40 м (в сложенном состоянии срез сопла на z = 1.95)
  // =========================================================================
  const lanceNozzleGroup = new THREE.Group();
  lanceNozzleGroup.name = 'lanceNozzleGroup';
  lanceNozzleGroup.position.set(0, -0.42, 0);
  rootGroup.add(lanceNozzleGroup);

  // Выдвижная толстостенная труба штанги (Z: 0.25 .. 1.24)
  const lanceTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.068, 0.99, 28),
    matMachinedSteel
  );
  lanceTube.rotation.x = Math.PI / 2;
  lanceTube.position.set(0, 0, 0.745);
  lanceTube.castShadow = true;
  lanceTube.receiveShadow = true;
  lanceNozzleGroup.add(lanceTube);

  // Внешние направляющие штанги и силовые шины подвода тока
  [-0.082, 0.082].forEach((rodX) => {
    const guideRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.86, 12),
      matDarkSteel
    );
    guideRod.rotation.x = Math.PI / 2;
    guideRod.position.set(rodX, 0, 0.82);
    guideRod.castShadow = true;
    lanceNozzleGroup.add(guideRod);
  });

  // Нижняя медная токоведущая шина
  const copperBusbar = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.018, 0.88), matCopper);
  copperBusbar.position.set(0, -0.078, 0.84);
  copperBusbar.castShadow = true;
  lanceNozzleGroup.add(copperBusbar);

  // Переходная муфта перед керамическим изолятором (Z = 1.22)
  const insulatorCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.084, 0.076, 0.06, 24),
    matDarkSteel
  );
  insulatorCollar.rotation.x = Math.PI / 2;
  insulatorCollar.position.set(0, 0, 1.22);
  insulatorCollar.castShadow = true;
  lanceNozzleGroup.add(insulatorCollar);

  // Ребристый керамический термоизолятор (Z: 1.25 .. 1.51)
  const ceramicCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.068, 0.26, 28),
    matCeramic
  );
  ceramicCore.rotation.x = Math.PI / 2;
  ceramicCore.position.set(0, 0, 1.38);
  ceramicCore.castShadow = true;
  lanceNozzleGroup.add(ceramicCore);

  const ceramicRibGeo = new THREE.TorusGeometry(0.074, 0.010, 12, 28);
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(ceramicRibGeo, matCeramic);
    rib.position.set(0, 0, 1.275 + i * 0.042);
    rib.castShadow = true;
    lanceNozzleGroup.add(rib);
  }

  // Медные кольца фокусировки дуги (3 массивных кольца поверх изолятора)
  const copperRingGeo = new THREE.TorusGeometry(0.082, 0.012, 14, 32);
  [1.295, 1.38, 1.465].forEach((rz) => {
    const ring = new THREE.Mesh(copperRingGeo, matCopper);
    ring.position.set(0, 0, rz);
    ring.castShadow = true;
    lanceNozzleGroup.add(ring);
  });

  // Защитный искровой щиток (Z = 1.53)
  const shieldGroup = new THREE.Group();
  shieldGroup.name = 'sparkShield';
  shieldGroup.position.set(0, 0, 1.53);
  lanceNozzleGroup.add(shieldGroup);

  // Конический стальной дефлектор брызг расплавленного металла
  const shieldCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.155, 0.032, 8),
    matDarkSteel
  );
  shieldCone.rotation.x = Math.PI / 2;
  shieldCone.rotation.y = Math.PI / 8;
  shieldCone.castShadow = true;
  shieldGroup.add(shieldCone);

  // Оранжевая окантовка искрового щитка
  const shieldRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.152, 0.008, 8, 8),
    matOrangeArmor
  );
  shieldRim.rotation.z = Math.PI / 8;
  shieldRim.position.z = -0.014;
  shieldGroup.add(shieldRim);

  // 4 силовые косынки крепления щитка
  for (let k = 0; k < 4; k++) {
    const angle = (k * Math.PI) / 2 + Math.PI / 4;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.065, 0.045), matMachinedSteel);
    strut.position.set(Math.cos(angle) * 0.095, Math.sin(angle) * 0.095, -0.025);
    strut.rotation.z = angle - Math.PI / 2;
    shieldGroup.add(strut);
  }

  // Казённая часть сопла (Z: 1.55 .. 1.66)
  const nozzleBreech = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.064, 0.11, 24),
    matDarkSteel
  );
  nozzleBreech.rotation.x = Math.PI / 2;
  nozzleBreech.position.set(0, 0, 1.605);
  nozzleBreech.castShadow = true;
  lanceNozzleGroup.add(nozzleBreech);

  // Узкое коническое сопло с эффектом побежалости металла (срез строго на z = 1.95)
  const coneLength = 0.29;
  const nozzleConeGeo = new THREE.CylinderGeometry(0.016, 0.050, coneLength, 32, 1, false);
  // Поворачиваем геометрию так, чтобы ось шла вдоль +Z (верх цилиндра V=1 оказался на +Z)
  nozzleConeGeo.rotateX(Math.PI / 2);

  const nozzleCone = new THREE.Mesh(nozzleConeGeo, matNozzleTemper);
  nozzleCone.position.set(0, 0, 1.95 - coneLength / 2); // 1.66 .. 1.95
  nozzleCone.castShadow = true;
  lanceNozzleGroup.add(nozzleCone);

  // Внутренний раскалённый канал сопла на срезе z = 1.95
  const nozzleAperture = new THREE.Mesh(
    new THREE.CircleGeometry(0.013, 20),
    new THREE.MeshBasicMaterial({ color: 0x9be8ff })
  );
  nozzleAperture.position.set(0, 0, 1.951);
  lanceNozzleGroup.add(nozzleAperture);

  // ---------------- ПЛАЗМЕННЫЙ ФАКЕЛ НА СОПЛЕ (Z = 1.95+) ----------------
  const plasmaTorchGroup = new THREE.Group();
  plasmaTorchGroup.name = 'plasmaTorch';
  plasmaTorchGroup.position.set(0, 0, 1.95);
  lanceNozzleGroup.add(plasmaTorchGroup);

  // Внутреннее бело-голубое ядро плазменной дуги
  const coreGeo = new THREE.ConeGeometry(0.012, 0.26, 20, 1, true);
  coreGeo.rotateX(Math.PI / 2);
  coreGeo.translate(0, 0, 0.13);
  const plasmaCoreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plasmaCore = new THREE.Mesh(coreGeo, plasmaCoreMat);
  plasmaTorchGroup.add(plasmaCore);

  // Средний высокотемпературный плазменный факел
  const midGeo = new THREE.ConeGeometry(0.026, 0.42, 24, 1, true);
  midGeo.rotateX(Math.PI / 2);
  midGeo.translate(0, 0, 0.21);
  const plasmaMidMat = new THREE.MeshBasicMaterial({
    color: 0x35b8ff,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plasmaMid = new THREE.Mesh(midGeo, plasmaMidMat);
  plasmaTorchGroup.add(plasmaMid);

  // Внешняя ионизированная корона (сине-фиолетовое свечение)
  const outerGeo = new THREE.ConeGeometry(0.044, 0.56, 24, 1, true);
  outerGeo.rotateX(Math.PI / 2);
  outerGeo.translate(0, 0, 0.28);
  const plasmaOuterMat = new THREE.MeshBasicMaterial({
    color: 0x5c54ff,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plasmaOuter = new THREE.Mesh(outerGeo, plasmaOuterMat);
  plasmaTorchGroup.add(plasmaOuter);

  // Точечный источник света плазменной дуги
  const plasmaLight = new THREE.PointLight(0x4fc3ff, 3.5, 4.5, 1.6);
  plasmaLight.position.set(0, 0, 0.12);
  plasmaTorchGroup.add(plasmaLight);

  // Сохраняем ссылки для быстрой анимации без поиска по дереву
  rootGroup.userData = {
    mountFlange,
    cutterChassis,
    lanceNozzleGroup,
    plasmaTorch: {
      group: plasmaTorchGroup,
      core: plasmaCore,
      mid: plasmaMid,
      outer: plasmaOuter,
      light: plasmaLight,
    },
  };

  return rootGroup;
}

// ============================================================================
// Адаптер под единый просмотрщик: ход штанги 0..0.40 м.
// setExtension(stroke) ставит базу; пульсация плазмы и микровибрация
// накладываются движком каждый кадр через ud.poseBlade.
// ============================================================================
export function createWeapon() {
  const root = createWeaponTR9Avtogen();
  const ud = root.userData;
  const lance = ud.lanceNozzleGroup;
  const torch = ud.plasmaTorch;

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  ud.setExtension = (stroke) => {
    const s = Math.max(0, Math.min(LANCE_STROKE, stroke));
    lance.position.z = s;
    return s / LANCE_STROKE;
  };

  ud.poseBlade = (stroke, t) => {
    const s = Math.max(0, Math.min(LANCE_STROKE, stroke));
    const deployFactor = s / LANCE_STROKE;
    const vibroActive = Math.max(0, (deployFactor - 0.85) / 0.15);

    // Выдвижение + лёгкая высокочастотная вибрация под нагрузкой дуги
    lance.position.z = s + (deployFactor > 0.8 ? Math.sin(t * 85.0) * 0.0025 : 0);

    // Пульсация факела: дежурный режим при втянутой штанге, форсаж при выдвижении
    const powerBoost = 0.45 + 0.55 * deployFactor;
    const pulseFast = Math.sin(t * 62.0) * 0.12 + Math.cos(t * 97.0) * 0.08;
    const pulseSlow = Math.sin(t * 14.0) * 0.06;
    const flameIntensity = Math.max(0.2, powerBoost + pulseFast + pulseSlow);

    torch.core.scale.set(
      1.0 + pulseFast * 0.4,
      1.0 + pulseFast * 0.4,
      flameIntensity * 1.15
    );
    torch.mid.scale.set(
      1.0 + pulseSlow * 0.6,
      1.0 + pulseSlow * 0.6,
      flameIntensity * 1.25
    );
    torch.outer.scale.set(
      1.0 - pulseFast * 0.35,
      1.0 - pulseFast * 0.35,
      flameIntensity * 1.35
    );

    torch.mid.material.opacity = 0.45 + 0.30 * flameIntensity;
    torch.outer.material.opacity = 0.20 + 0.22 * flameIntensity;
    torch.light.intensity = 1.8 + 3.4 * flameIntensity;

    return vibroActive;
  };

  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
