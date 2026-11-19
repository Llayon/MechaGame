import * as THREE from 'three';

export const meta = {
  id: 'uley',
  code: '9К842-УМ',
  title: '«Улей-М»',
  subtitle: 'ТЯЖЁЛЫЙ СОТОВЫЙ КОМПЛЕКС РОЕВЫХ ДРОНОВ • 24 ЯЧЕЙКИ • СЛОТ HEAVY',
  description:
    'Тяжёлый сотовый комплекс роевых дронов: усиленный узел УСП с гидроприводом наклона, поворотный бронекожух с оливковой бронёй, трафаретом «УЛЕЙ-М» и противокумулятивной решёткой. Сотовая матрица 3×8 из 24 шестигранных ячеек с барражирующими боеприпасами и янтарными индикаторами готовности. Секторное сканирование привода наведения.',
  specs: [
    ['Ячейки', '24 (3×8, шестигранные)'],
    ['Наведение', 'Погон ±14° + гидропривод'],
    ['Зарядка', 'Индукционная, 48 В'],
    ['Слот', 'HEAVY'],
    ['Масса', '1480 кг'],
    ['Габариты', '1.45×0.9×2.35 м'],
  ],
  maxExtension: 1.0,
  unit: '%',
  tipOffset: 1.18,
  subgroups: [
    { key: 'mountFlange', label: '1. Усиленный узел УСП' },
    { key: 'hiveBody', label: '2. Сотовый бронекожух' },
    { key: 'hexCellsMatrix', label: '3. Матрица 24 ячеек' },
    { key: 'rearSlatGrille', label: '4. Противокумулятивная решётка' },
  ],
  cameras: {
    module: { pos: [2.35, 1.55, 2.75], target: [0, 0.45, 0.15] },
  },
  rangeMarkers: [],
  controls: 'sam',
};

/**
 * Создаёт процедурную 3D-модель тяжёлого сотового комплекса роевых дронов «Улей-М».
 * Система координат: 1 unit = 1 метр, пуск строго вдоль +Z, верх +Y, бок +X.
 * Точка привязки (0, 0, 0) — центр опорной плоскости нижнего фланца УСП.
 *
 * @returns {THREE.Group}
 */
export function createWeaponUleyM() {
  const root = new THREE.Group();
  root.name = 'Weapon_Uley_M';

  // --- ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (CanvasTexture) ---

  function createNoiseTexture(size = 256, contrast = 32) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < data.length; i += 4) {
      const base = 128 + (rand() - 0.5) * contrast;
      data[i] = base;
      data[i + 1] = base;
      data[i + 2] = base;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    // Лёгкие продольные риски проката стали
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const y = rand() * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + (rand() - 0.5) * 3);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  function createHazardStripeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Жёлтый промышленный фон
    ctx.fillStyle = '#d99e16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Чёрные диагональные полосы
    ctx.fillStyle = '#181a1c';
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

    // Потёртости и индустриальный износ по краям
    ctx.fillStyle = 'rgba(30, 32, 35, 0.28)';
    ctx.fillRect(0, 0, canvas.width, 8);
    ctx.fillRect(0, canvas.height - 8, canvas.width, 8);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function createStencilTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рамка тактического трафарета
    ctx.strokeStyle = 'rgba(232, 228, 214, 0.78)';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

    // Верхний индекс изделия
    ctx.fillStyle = 'rgba(232, 228, 214, 0.82)';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillText('ИНД. 9К842-УМ // БЛОК СПЕЦВООРУЖЕНИЯ', 52, 68);

    // Главная трафаретная надпись «УЛЕЙ-М»
    ctx.fillStyle = 'rgba(242, 239, 228, 0.92)';
    ctx.font = '900 112px "Arial Black", "Impact", sans-serif';
    ctx.fillText('УЛЕЙ-М', 48, 184);

    // Предупреждающая плашка «ОПАСНО: ЗОНА РОЯ»
    ctx.fillStyle = '#d99e16';
    ctx.fillRect(52, 216, 920, 62);

    ctx.fillStyle = '#141618';
    ctx.font = '900 40px "Arial Black", sans-serif';
    ctx.fillText('▲ ОПАСНО: ЗОНА РОЯ', 74, 261);

    // Нижняя техническая маркировка
    ctx.fillStyle = 'rgba(232, 228, 214, 0.75)';
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.fillText('24 × БПЛА-К  |  ИНДУКЦ. ЗАРЯД 48В  |  МАССА 1480 КГ', 52, 326);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  const steelGrainTex = createNoiseTexture(256, 36);
  const hazardTex = createHazardStripeTexture();
  const stencilTex = createStencilTexture();

  // --- PBR МАТЕРИАЛЫ ---

  const matHullSteel = new THREE.MeshStandardMaterial({
    color: 0x62686e,
    metalness: 0.50,
    roughness: 0.60,
    roughnessMap: steelGrainTex,
    bumpMap: steelGrainTex,
    bumpScale: 0.0025
  });

  const matOliveArmor = new THREE.MeshStandardMaterial({
    color: 0x4a5344,
    metalness: 0.38,
    roughness: 0.58,
    roughnessMap: steelGrainTex,
    bumpMap: steelGrainTex,
    bumpScale: 0.002
  });

  const matGraphite = new THREE.MeshStandardMaterial({
    color: 0x24272b,
    metalness: 0.85,
    roughness: 0.38
  });

  const matChromeRod = new THREE.MeshStandardMaterial({
    color: 0xd4dce3,
    metalness: 0.92,
    roughness: 0.18
  });

  const matCopperCoil = new THREE.MeshStandardMaterial({
    color: 0x9c613b,
    metalness: 0.82,
    roughness: 0.32
  });

  const matDarkRubber = new THREE.MeshStandardMaterial({
    color: 0x181a1d,
    metalness: 0.15,
    roughness: 0.82
  });

  const matHazard = new THREE.MeshStandardMaterial({
    map: hazardTex,
    metalness: 0.35,
    roughness: 0.55
  });

  const matStencil = new THREE.MeshStandardMaterial({
    map: stencilTex,
    transparent: true,
    roughness: 0.65,
    metalness: 0.25,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });

  const matAmberLED = new THREE.MeshStandardMaterial({
    color: 0xffa640,
    emissive: 0xd97b1e,
    emissiveIntensity: 2.2,
    roughness: 0.25,
    metalness: 0.1
  });

  const matSeekerOptic = new THREE.MeshStandardMaterial({
    color: 0x101820,
    emissive: 0x1b3a4b,
    emissiveIntensity: 0.45,
    metalness: 0.3,
    roughness: 0.12
  });

  // =========================================================================
  // 1. УСИЛЕННЫЙ СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Нижняя опорная плита УСП: 0.75 x 0.18 x 1.10 м (нижняя плоскость строго на Y = 0)
  const basePlateGeo = new THREE.BoxGeometry(0.75, 0.065, 1.10);
  const basePlate = new THREE.Mesh(basePlateGeo, matHullSteel);
  basePlate.position.set(0, 0.0325, 0);
  basePlate.castShadow = true;
  basePlate.receiveShadow = true;
  mountFlange.add(basePlate);

  // Средний пояс с предупреждающей жёлто-чёрной полосой (Y: 0.065 -> 0.13)
  const hazardCollarGeo = new THREE.BoxGeometry(0.69, 0.065, 1.03);
  const hazardCollar = new THREE.Mesh(hazardCollarGeo, matHazard);
  hazardCollar.position.set(0, 0.0975, 0);
  hazardCollar.castShadow = true;
  hazardCollar.receiveShadow = true;
  mountFlange.add(hazardCollar);

  // Верхняя опорная плита УСП и поворотный погон (Y: 0.13 -> 0.18)
  const upperDeckGeo = new THREE.BoxGeometry(0.66, 0.05, 0.98);
  const upperDeck = new THREE.Mesh(upperDeckGeo, matGraphite);
  upperDeck.position.set(0, 0.155, 0);
  upperDeck.castShadow = true;
  upperDeck.receiveShadow = true;
  mountFlange.add(upperDeck);

  // Поворотный круг (погон) на верхней плите
  const turretRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.33, 0.045, 24),
    matHullSteel
  );
  turretRing.position.set(0, 0.195, -0.04);
  turretRing.castShadow = true;
  mountFlange.add(turretRing);

  // 6 силовых замков стыковки УСП (по 3 на каждый борт)
  const lockPositionsZ = [-0.38, 0.0, 0.38];
  const lockHousingGeo = new THREE.BoxGeometry(0.065, 0.11, 0.13);
  const lockClampGeo = new THREE.BoxGeometry(0.08, 0.045, 0.08);
  const lockPinGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.145, 10);

  [-1, 1].forEach((side) => {
    lockPositionsZ.forEach((zPos) => {
      const lockGroup = new THREE.Group();
      lockGroup.position.set(side * 0.365, 0.075, zPos);

      const housing = new THREE.Mesh(lockHousingGeo, matGraphite);
      housing.castShadow = true;
      lockGroup.add(housing);

      const clamp = new THREE.Mesh(lockClampGeo, matOliveArmor);
      clamp.position.set(side * 0.012, 0.032, 0);
      lockGroup.add(clamp);

      const pin = new THREE.Mesh(lockPinGeo, matChromeRod);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(side * 0.018, 0.01, 0);
      lockGroup.add(pin);

      mountFlange.add(lockGroup);
    });
  });

  // Цапфы оси наклона (Y = 0.24, Z = -0.05)
  const trunnionY = 0.24;
  const trunnionZ = -0.05;
  [-1, 1].forEach((side) => {
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.12, 0.18),
      matHullSteel
    );
    bracket.position.set(side * 0.31, 0.21, trunnionZ);
    bracket.castShadow = true;
    mountFlange.add(bracket);

    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.11, 16),
      matGraphite
    );
    axle.rotation.z = Math.PI / 2;
    axle.position.set(side * 0.31, trunnionY, trunnionZ);
    mountFlange.add(axle);
  });

  // Силовой привод наклона (спаренные гидроцилиндры + электрогидравлический насос)
  const actuatorPump = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.09, 0.24),
    matGraphite
  );
  actuatorPump.position.set(0, 0.215, 0.23);
  actuatorPump.castShadow = true;
  mountFlange.add(actuatorPump);

  const actuators = [];
  [-1, 1].forEach((side) => {
    const lowerAnchor = new THREE.Vector3(side * 0.17, 0.20, 0.20);

    const clevisBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.06),
      matGraphite
    );
    clevisBase.position.copy(lowerAnchor);
    mountFlange.add(clevisBase);

    const barrelGroup = new THREE.Group();
    barrelGroup.position.copy(lowerAnchor);
    const barrelMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.032, 0.18, 14),
      matOliveArmor
    );
    barrelMesh.rotation.x = Math.PI / 2;
    barrelMesh.position.z = 0.09;
    barrelMesh.castShadow = true;
    barrelGroup.add(barrelMesh);
    mountFlange.add(barrelGroup);

    const rodGroup = new THREE.Group();
    const rodMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.017, 0.19, 14),
      matChromeRod
    );
    rodMesh.rotation.x = Math.PI / 2;
    rodMesh.position.z = -0.095;
    rodGroup.add(rodMesh);
    mountFlange.add(rodGroup);

    actuators.push({
      side,
      lowerAnchor,
      barrelGroup,
      rodGroup,
      localUpperOffset: new THREE.Vector3(side * 0.17, 0.06, 0.42)
    });
  });

  // =========================================================================
  // 2. ШИРОКИЙ СОТОВЫЙ КОРПУС С СИСТЕМОЙ ПОДЗАРЯДКИ (hiveBody)
  // =========================================================================
  // Поворотный узел качающейся части вокруг цапфы (0, 0.24, -0.05)
  const elevationAssembly = new THREE.Group();
  elevationAssembly.name = 'elevationAssembly';
  elevationAssembly.position.set(0, trunnionY, trunnionZ);
  root.add(elevationAssembly);

  const hiveBody = new THREE.Group();
  hiveBody.name = 'hiveBody';
  elevationAssembly.add(hiveBody);

  // Вспомогательная функция перевода мировых координат покоя в локальные координаты hiveBody
  const toLocalY = (worldY) => worldY - trunnionY;
  const toLocalZ = (worldZ) => worldZ - trunnionZ;

  // Основной несущий бронекожух со скошенными гранями (сечение в плоскости XY, выдавливание по Z)
  const bodyHalfW = 0.65;
  const bodyBotY = toLocalY(0.20);
  const bodyTopY = toLocalY(0.86);
  const chamferX = 0.14;
  const chamferY = 0.13;

  const hullShape = new THREE.Shape();
  hullShape.moveTo(-bodyHalfW + chamferX, bodyBotY);
  hullShape.lineTo(bodyHalfW - chamferX, bodyBotY);
  hullShape.lineTo(bodyHalfW, bodyBotY + chamferY);
  hullShape.lineTo(bodyHalfW, bodyTopY - chamferY);
  hullShape.lineTo(bodyHalfW - chamferX, bodyTopY);
  hullShape.lineTo(-bodyHalfW + chamferX, bodyTopY);
  hullShape.lineTo(-bodyHalfW, bodyTopY - chamferY);
  hullShape.lineTo(-bodyHalfW, bodyBotY + chamferY);
  hullShape.closePath();

  // Основная задняя/средняя секция корпуса (Z: -1.06 -> +0.80)
  const mainHullLength = 1.86;
  const mainHullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: mainHullLength,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 2
  });
  const mainHull = new THREE.Mesh(mainHullGeo, matHullSteel);
  mainHull.position.set(0, 0, toLocalZ(-1.06));
  mainHull.castShadow = true;
  mainHull.receiveShadow = true;
  hiveBody.add(mainHull);

  // Передний бронекожух-бленда вокруг ниши сот (Z: +0.80 -> +1.175) с вырезом под матрицу ячеек
  const shroudHole = new THREE.Path();
  const bayHalfW = 0.635;
  const bayBotY = toLocalY(0.305);
  const bayTopY = toLocalY(0.755);
  shroudHole.moveTo(-bayHalfW, bayBotY);
  shroudHole.lineTo(bayHalfW, bayBotY);
  shroudHole.lineTo(bayHalfW, bayTopY);
  shroudHole.lineTo(-bayHalfW, bayTopY);
  shroudHole.closePath();

  const shroudShape = hullShape.clone();
  shroudShape.holes.push(shroudHole);

  const shroudGeo = new THREE.ExtrudeGeometry(shroudShape, {
    depth: 0.375,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2
  });
  const frontShroud = new THREE.Mesh(shroudGeo, matHullSteel);
  frontShroud.position.set(0, 0, toLocalZ(0.80));
  frontShroud.castShadow = true;
  frontShroud.receiveShadow = true;
  hiveBody.add(frontShroud);

  // Задняя переборка ниши ячеек (Z = 0.79)
  const bayBackplate = new THREE.Mesh(
    new THREE.BoxGeometry(1.28, 0.48, 0.03),
    matGraphite
  );
  bayBackplate.position.set(0, toLocalY(0.53), toLocalZ(0.79));
  hiveBody.add(bayBackplate);

  // Бортовые накладные оливковые бронеплиты (#4a5344) со скосами и трафаретом «УЛЕЙ-М / ОПАСНО: ЗОНА РОЯ»
  [-1, 1].forEach((side) => {
    const armorGroup = new THREE.Group();
    armorGroup.position.set(side * 0.685, toLocalY(0.53), toLocalZ(0.04));

    // Центральная вертикальная бронеплита (доводит общую ширину блока до ~1.45 м)
    const centerPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.40, 1.98),
      matOliveArmor
    );
    centerPlate.castShadow = true;
    centerPlate.receiveShadow = true;
    armorGroup.add(centerPlate);

    // Верхний скошенный бронелист
    const upperBevel = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.17, 1.92),
      matOliveArmor
    );
    upperBevel.position.set(-side * 0.055, 0.255, 0);
    upperBevel.rotation.z = side * 0.68;
    upperBevel.castShadow = true;
    armorGroup.add(upperBevel);

    // Нижний скошенный бронелист
    const lowerBevel = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.17, 1.92),
      matOliveArmor
    );
    lowerBevel.position.set(-side * 0.055, -0.255, 0);
    lowerBevel.rotation.z = -side * 0.68;
    lowerBevel.castShadow = true;
    armorGroup.add(lowerBevel);

    // Накладная панель с трафаретом «УЛЕЙ-М / ОПАСНО: ЗОНА РОЯ»
    const stencilPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.06, 0.36),
      matStencil
    );
    stencilPlane.position.set(side * 0.039, 0.0, 0.05);
    stencilPlane.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    armorGroup.add(stencilPlane);

    // Ряд крепёжных болтов вдоль бронеплиты
    const boltGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.015, 6);
    boltGeo.rotateZ(Math.PI / 2);
    const boltInst = new THREE.InstancedMesh(boltGeo, matGraphite, 16);
    const dummy = new THREE.Object3D();
    let idx = 0;
    [-0.165, 0.165].forEach((by) => {
      for (let i = 0; i < 8; i++) {
        dummy.position.set(side * 0.041, by, -0.85 + i * 0.242);
        dummy.updateMatrix();
        boltInst.setMatrixAt(idx++, dummy.matrix);
      }
    });
    armorGroup.add(boltInst);

    hiveBody.add(armorGroup);
  });

  // Верхняя оливковая бронекрышка и такелажные рым-петли
  const roofArmor = new THREE.Mesh(
    new THREE.BoxGeometry(0.98, 0.03, 2.04),
    matOliveArmor
  );
  roofArmor.position.set(0, toLocalY(0.875), toLocalZ(0.05));
  roofArmor.castShadow = true;
  roofArmor.receiveShadow = true;
  hiveBody.add(roofArmor);

  [
    [-0.54, -0.82],
    [0.54, -0.82],
    [-0.54, 0.92],
    [0.54, 0.92]
  ].forEach(([lx, lz]) => {
    const lug = new THREE.Mesh(
      new THREE.TorusGeometry(0.032, 0.011, 8, 16),
      matGraphite
    );
    lug.position.set(lx, toLocalY(0.885), toLocalZ(lz));
    lug.rotation.y = Math.PI / 2;
    hiveBody.add(lug);
  });

  // Противокумулятивная решётка сзади (-Z, от Z = -1.06 до Z = -1.175)
  const rearGrilleGroup = new THREE.Group();
  rearGrilleGroup.name = 'rearSlatGrille';
  rearGrilleGroup.position.set(0, toLocalY(0.53), toLocalZ(-1.12));
  hiveBody.add(rearGrilleGroup);

  // Силовая рама решётки
  const grilleW = 1.24;
  const grilleH = 0.56;
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(grilleW, 0.025, 0.07), matGraphite);
  topBar.position.y = grilleH / 2;
  rearGrilleGroup.add(topBar);

  const botBar = new THREE.Mesh(new THREE.BoxGeometry(grilleW, 0.025, 0.07), matGraphite);
  botBar.position.y = -grilleH / 2;
  rearGrilleGroup.add(botBar);

  // 19 вертикальных стальных пластин противокумулятивной решётки
  const slatCount = 19;
  const vSlatGeo = new THREE.BoxGeometry(0.009, grilleH, 0.068);
  const vSlatInst = new THREE.InstancedMesh(vSlatGeo, matGraphite, slatCount);
  vSlatInst.castShadow = true;
  const slatDummy = new THREE.Object3D();
  for (let i = 0; i < slatCount; i++) {
    const x = -grilleW / 2 + (i / (slatCount - 1)) * grilleW;
    slatDummy.position.set(x, 0, 0);
    slatDummy.updateMatrix();
    vSlatInst.setMatrixAt(i, slatDummy.matrix);
  }
  rearGrilleGroup.add(vSlatInst);

  // 3 горизонтальные связующие перемычки решётки
  [-0.15, 0, 0.15].forEach((hy) => {
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(grilleW, 0.012, 0.045), matGraphite);
    hBar.position.set(0, hy, -0.01);
    rearGrilleGroup.add(hBar);
  });

  // 6 кронштейнов крепления решётки к кормовому бронелисту
  [-0.56, 0, 0.56].forEach((sx) => {
    [-0.22, 0.22].forEach((sy) => {
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.08, 8),
        matHullSteel
      );
      strut.rotation.x = Math.PI / 2;
      strut.position.set(sx, sy, 0.04);
      rearGrilleGroup.add(strut);
    });
  });

  // Кормовые жалюзи системы охлаждения и габаритные огни за решёткой
  [-0.32, 0.32].forEach((vx) => {
    const ventBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.28, 0.025),
      matGraphite
    );
    ventBox.position.set(vx, 0, 0.055);
    rearGrilleGroup.add(ventBox);
  });

  // Крупные ребристые индукционные преобразователи сверху (для быстрой зарядки дронов)
  [-1, 1].forEach((side) => {
    const chargerGroup = new THREE.Group();
    chargerGroup.position.set(side * 0.27, toLocalY(0.89), toLocalZ(0.08));

    // Основание преобразователя
    const baseBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.035, 1.12),
      matHullSteel
    );
    baseBlock.position.y = 0.0175;
    baseBlock.castShadow = true;
    chargerGroup.add(baseBlock);

    // 24 поперечных радиаторных ребра охлаждения
    const finCount = 24;
    const finGeo = new THREE.BoxGeometry(0.36, 0.052, 0.014);
    const finInst = new THREE.InstancedMesh(finGeo, matGraphite, finCount);
    finInst.castShadow = true;
    const finDummy = new THREE.Object3D();
    for (let i = 0; i < finCount; i++) {
      finDummy.position.set(0, 0.052, -0.50 + i * 0.0435);
      finDummy.updateMatrix();
      finInst.setMatrixAt(i, finDummy.matrix);
    }
    chargerGroup.add(finInst);

    // Медные индукционные шины и верхний кожух катушек
    const busbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.04, 12),
      matCopperCoil
    );
    busbar.rotation.x = Math.PI / 2;
    busbar.position.set(0, 0.068, 0);
    chargerGroup.add(busbar);

    // Силовые высоковольтные кабели, уходящие в крышу к сотовому отсеку
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.045, 0.56),
      new THREE.Vector3(0, 0.065, 0.66),
      new THREE.Vector3(side * 0.04, 0.01, 0.74)
    ]);
    const cableMesh = new THREE.Mesh(
      new THREE.TubeGeometry(cableCurve, 12, 0.016, 8, false),
      matDarkRubber
    );
    chargerGroup.add(cableMesh);

    // Индикатор зарядного контура
    const chargeLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.012, 0.025),
      matAmberLED
    );
    chargeLed.position.set(0, 0.082, 0.48);
    chargerGroup.add(chargeLed);

    hiveBody.add(chargerGroup);
  });

  // Две раздвижные штыревые антенны связи на кормовых углах крыши
  [-1, 1].forEach((side) => {
    const antGroup = new THREE.Group();
    antGroup.position.set(side * 0.54, toLocalY(0.875), toLocalZ(-0.88));
    // Лёгкий тактический наклон назад и в сторону
    antGroup.rotation.x = -0.09;
    antGroup.rotation.z = -side * 0.05;

    // Бронестакан и изолятор
    const baseMount = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.044, 0.07, 14),
      matHullSteel
    );
    baseMount.position.y = 0.035;
    antGroup.add(baseMount);

    // Демпферная пружина
    const springBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.026, 0.09, 12),
      matGraphite
    );
    springBase.position.y = 0.11;
    antGroup.add(springBase);

    // 3 телескопических колена штыревой антенны
    const seg1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.017, 0.42, 10),
      matOliveArmor
    );
    seg1.position.y = 0.36;
    antGroup.add(seg1);

    const seg2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.012, 0.42, 10),
      matGraphite
    );
    seg2.position.y = 0.77;
    antGroup.add(seg2);

    const seg3 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.007, 0.38, 8),
      matChromeRod
    );
    seg3.position.y = 1.16;
    antGroup.add(seg3);

    // Защитный наконечник
    const tipBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 10, 10),
      matAmberLED
    );
    tipBall.position.y = 1.35;
    antGroup.add(tipBall);

    hiveBody.add(antGroup);
  });

  // =========================================================================
  // 3. МАТРИЦА 24 ШЕСТИГРАННЫХ ЯЧЕЕК (hexCellsMatrix)
  // =========================================================================
  const hexCellsMatrix = new THREE.Group();
  hexCellsMatrix.name = 'hexCellsMatrix';
  elevationAssembly.add(hexCellsMatrix);

  const cellCount = 24;
  const cols = 8;
  const rows = 3;

  // Геометрия плотной сотовой упаковки (3 ряда × 8 ячеек = 24 шестигранника)
  const hexOuterR = 0.083;
  const hexInnerR = 0.075;
  const cellDepth = 0.35;
  const frontZ = toLocalZ(1.15); // Передний срез матрицы строго на z = 1.15 в системе координат комплекса
  const centerZ = frontZ - cellDepth / 2;
  const centerY = toLocalY(0.53);

  const dx = Math.sqrt(3) * hexOuterR;
  const dy = 1.5 * hexOuterR;

  // Вычисляем координаты центров всех 24 ячеек
  const cellCoords = [];
  for (let r = 0; r < rows; r++) {
    const rowOffsetX = (r % 2 === 1) ? dx * 0.5 : 0;
    const xStart = -((cols - 1) * dx + dx * 0.5) * 0.5 + rowOffsetX;
    const y = centerY + (r - (rows - 1) * 0.5) * dy;

    for (let c = 0; c < cols; c++) {
      const x = xStart + c * dx;
      cellCoords.push(new THREE.Vector3(x, y, centerZ));
    }
  }

  // Наружные стенки шестигранных пусковых труб (CylinderGeometry с 6 сегментами через InstancedMesh)
  const hexOuterGeo = new THREE.CylinderGeometry(hexOuterR, hexOuterR, cellDepth, 6, 1, true);
  hexOuterGeo.rotateX(Math.PI / 2);
  const hexOuterInst = new THREE.InstancedMesh(hexOuterGeo, matGraphite, cellCount);
  hexOuterInst.castShadow = true;
  hexOuterInst.receiveShadow = true;

  // Внутренние стенки каналов (BackSide для объёмной толщины стенок сот)
  const matGraphiteInner = matGraphite.clone();
  matGraphiteInner.side = THREE.BackSide;
  const hexInnerGeo = new THREE.CylinderGeometry(hexInnerR, hexInnerR, cellDepth, 6, 1, true);
  hexInnerGeo.rotateX(Math.PI / 2);
  const hexInnerInst = new THREE.InstancedMesh(hexInnerGeo, matGraphiteInner, cellCount);

  // Передние шестигранные торцевые фаски ячеек (на z = 1.15)
  const hexLipGeo = new THREE.RingGeometry(hexInnerR, hexOuterR, 6);
  hexLipGeo.rotateZ(Math.PI / 6);
  const hexLipInst = new THREE.InstancedMesh(hexLipGeo, matGraphite, cellCount);

  // Головные части барражирующих боеприпасов в глубине ячеек (InstancedMesh)
  const warheadBodyGeo = new THREE.CylinderGeometry(0.036, 0.052, 0.14, 12);
  warheadBodyGeo.rotateX(Math.PI / 2);
  const warheadBodyInst = new THREE.InstancedMesh(warheadBodyGeo, matOliveArmor, cellCount);

  // Оптические ГСН (головки самонаведения) дронов-камикадзе
  const seekerDomeGeo = new THREE.SphereGeometry(0.035, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  seekerDomeGeo.rotateX(Math.PI / 2);
  const seekerDomeInst = new THREE.InstancedMesh(seekerDomeGeo, matSeekerOptic, cellCount);

  // Световые янтарные индикаторы готовности ячеек (#d97b1e)
  const indicatorGeo = new THREE.BoxGeometry(0.022, 0.008, 0.012);
  const indicatorInst = new THREE.InstancedMesh(indicatorGeo, matAmberLED, cellCount);

  const dummy = new THREE.Object3D();
  cellCoords.forEach((pos, i) => {
    // Шестигранная ячейка
    dummy.position.copy(pos);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    hexOuterInst.setMatrixAt(i, dummy.matrix);
    hexInnerInst.setMatrixAt(i, dummy.matrix);

    // Торцевая фаска ячейки на z = 1.15
    dummy.position.set(pos.x, pos.y, frontZ);
    dummy.updateMatrix();
    hexLipInst.setMatrixAt(i, dummy.matrix);

    // Корпус БЧ барражирующего боеприпаса в глубине канала
    dummy.position.set(pos.x, pos.y, frontZ - 0.14);
    dummy.updateMatrix();
    warheadBodyInst.setMatrixAt(i, dummy.matrix);

    // Оптический обтекатель ГСН
    dummy.position.set(pos.x, pos.y, frontZ - 0.072);
    dummy.updateMatrix();
    seekerDomeInst.setMatrixAt(i, dummy.matrix);

    // Янтарный индикатор готовности у верхней грани соты
    dummy.position.set(pos.x, pos.y + hexInnerR - 0.009, frontZ - 0.012);
    dummy.updateMatrix();
    indicatorInst.setMatrixAt(i, dummy.matrix);
  });

  hexCellsMatrix.add(
    hexOuterInst,
    hexInnerInst,
    hexLipInst,
    warheadBodyInst,
    seekerDomeInst,
    indicatorInst
  );

  // Метод обновления кинематики гидроцилиндров при наклоне блока
  root.userData.updateActuators = () => {
    elevationAssembly.updateMatrix();
    const worldTarget = new THREE.Vector3();
    for (const act of actuators) {
      worldTarget.copy(act.localUpperOffset).applyMatrix4(elevationAssembly.matrix);
      act.barrelGroup.lookAt(worldTarget);
      act.rodGroup.position.copy(worldTarget);
      act.rodGroup.lookAt(act.lowerAnchor);
    }
  };
  root.userData.updateActuators();

  return root;
}

// ============================================================================
// Адаптер под единый просмотрщик: секторное сканирование привода наведения.
// applySam(t): рыскание на погоне + кивок по углу места + гидропривод.
// Возвращает { az, el, speed } для телеметрии.
// ============================================================================
export function createWeapon() {
  const root = createWeaponUleyM();
  const ud = root.userData;
  const elev = root.getObjectByName('elevationAssembly');

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  ud.scanSpeed = 1;
  ud.applySam = (t) => {
    const s = ud.scanSpeed;
    // Плавное сканирование по азимуту (рыскание на поворотном погоне)
    const az = Math.sin(t * 0.55) * 0.24 * s;
    // Плавное сканирующее качание по углу места на силовом гидроприводе
    const el = -0.04 * s + Math.sin(t * 1.15) * 0.065 * s;
    root.rotation.y = az;
    if (elev) elev.rotation.x = el;
    if (ud.updateActuators) ud.updateActuators();
    return { az: az * 180 / Math.PI, el: el * 180 / Math.PI, speed: s };
  };
  ud.setExtension = (v) => {
    ud.scanSpeed = Math.max(0, Math.min(1, v));
    return ud.scanSpeed;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
