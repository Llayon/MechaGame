import * as THREE from 'three';

export const meta = {
  id: 'tos3',
  code: 'ТОС-3',
  title: 'ТОС-3 «Солнцепёк-М»',
  subtitle: 'ТЯЖЁЛАЯ ОГНЕМЁТНАЯ СИСТЕМА • 15 ТРУБ 220 ММ • СЛОТ HEAVY • ЦИКЛ 6.8 С',
  description:
    'Тяжёлая огнемётная система: усиленный узел УСП с гидроприводом наклона, качающаяся люлька с бронекоробом, блоками ДЗ «Контакт-5», теплозащитным кожухом и откидными газоотводными дефлекторами. Матрица 3×5 труб 220 мм с термобарическими снарядами МО.1.01.04М. Залп 15 снарядов веером от центра за 2.4 с, перезарядка.',
  specs: [
    ['Калибр', '220 мм, 15 труб'],
    ['Снаряд', 'Термобарический МО.1.01.04М'],
    ['Темп залпа', '1 / 0.16 с'],
    ['Порядок', 'Веер от центра к краям'],
    ['Цикл', '6.8 с'],
    ['Слот', 'HEAVY'],
  ],
  maxExtension: 6.8,
  unit: 's',
  tipOffset: 1.35,
  mlrsCount: 15,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'tosArmoredBox', label: '2. Бронекороб и ДЗ' },
    { key: 'thermobaricTubes', label: '3. Матрица труб и снаряды' },
    { key: 'rearBlastDeflectors', label: '4. Газоотводные дефлекторы' },
  ],
  cameras: {
    module: { pos: [2.65, 1.55, 2.95], target: [0, 0.48, 0.15] },
  },
  rangeMarkers: [],
  controls: 'mlrs',
};

const TOS_CYCLE = 6.8;
const TOS_FIRE_START = 0.9;
const TOS_INTERVAL = 0.16;
const TOS_COUNT = 15;

/**
 * Процедурная 3D-модель тяжёлой огнемётной системы ТОС-3 «Солнцепёк-М» (слот HEAVY)
 * Система координат: 1 unit = 1 м, +Z — направление стрельбы, +Y — верх, +X — правый борт.
 * Точка привязки (0, 0, 0) — центр опорной плиты стыковочного узла УСП.
 *
 * @returns {THREE.Group}
 */
export function createWeaponTOS3SolntsepekM() {
  const root = new THREE.Group();
  root.name = 'TOS3_SolntsepekM';

  // ============================================================================
  // 1. ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (CanvasTexture) И PBR-МАТЕРИАЛЫ
  // ============================================================================

  function createHazardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#e2a314';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#17191c';
    const stripeW = 48;
    for (let x = -128; x < canvas.width + 128; x += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW - 64, canvas.height);
      ctx.lineTo(x - 64, canvas.height);
      ctx.closePath();
      ctx.fill();
    }

    // Сколы краски и эксплуатационная потёртость
    for (let i = 0; i < 420; i++) {
      const rx = Math.random() * canvas.width;
      const ry = Math.random() * canvas.height;
      const rw = 2 + Math.random() * 10;
      const rh = 1 + Math.random() * 4;
      ctx.fillStyle = Math.random() > 0.4 ? 'rgba(34, 37, 41, 0.55)' : 'rgba(255, 230, 160, 0.25)';
      ctx.fillRect(rx, ry, rw, rh);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  function createArmorStencilTexture(side = 'left') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Базовый советский защитный хаки (#475041)
    ctx.fillStyle = '#475041';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Пятна фактуры катанной брони и потёки масла
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = 4 + Math.random() * 26;
      ctx.fillStyle =
        Math.random() > 0.5 ? 'rgba(56, 64, 51, 0.14)' : 'rgba(84, 94, 77, 0.12)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Копоть у переднего (+Z) и заднего (-Z) срезов
    const frontX = side === 'left' ? canvas.width : 0;
    const rearX = side === 'left' ? 0 : canvas.width;

    const frontSoot = ctx.createRadialGradient(frontX, 256, 30, frontX, 256, 360);
    frontSoot.addColorStop(0, 'rgba(18, 20, 22, 0.88)');
    frontSoot.addColorStop(0.55, 'rgba(28, 31, 33, 0.42)');
    frontSoot.addColorStop(1, 'rgba(71, 80, 65, 0)');
    ctx.fillStyle = frontSoot;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const rearSoot = ctx.createRadialGradient(rearX, 256, 20, rearX, 256, 320);
    rearSoot.addColorStop(0, 'rgba(15, 17, 19, 0.92)');
    rearSoot.addColorStop(0.5, 'rgba(26, 28, 30, 0.48)');
    rearSoot.addColorStop(1, 'rgba(71, 80, 65, 0)');
    ctx.fillStyle = rearSoot;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Сварные швы и техническая окантовка
    ctx.strokeStyle = 'rgba(24, 27, 23, 0.65)';
    ctx.lineWidth = 5;
    ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

    // Трафаретная маркировка «ТОС-3 / ОГНЕОПАСНО»
    ctx.save();
    ctx.fillStyle = 'rgba(232, 228, 212, 0.86)';
    ctx.textAlign = 'center';

    ctx.font = 'bold 74px "Arial Black", Impact, sans-serif';
    ctx.fillText('ТОС-3', canvas.width * 0.5, 185);

    // Предупреждающая рамка ОГНЕОПАСНО
    ctx.strokeStyle = 'rgba(226, 163, 20, 0.9)';
    ctx.lineWidth = 6;
    ctx.strokeRect(canvas.width * 0.5 - 235, 222, 470, 78);

    ctx.fillStyle = 'rgba(235, 185, 45, 0.92)';
    ctx.font = 'bold 44px Arial, sans-serif';
    ctx.fillText('ОГНЕОПАСНО', canvas.width * 0.5, 276);

    // Индекс изделия и знак термобарического заряда
    ctx.fillStyle = 'rgba(220, 218, 204, 0.72)';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('ИЗД. 634Б-М  //  КАЛИБР 220 ММ  //  15 НАПР.', canvas.width * 0.5, 355);
    ctx.restore();

    // Потёртости поверх трафарета
    for (let i = 0; i < 650; i++) {
      const sx = Math.random() * canvas.width;
      const sy = Math.random() * canvas.height;
      ctx.fillStyle = 'rgba(65, 73, 59, 0.45)';
      ctx.fillRect(sx, sy, 2 + Math.random() * 14, 1 + Math.random() * 3);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  function createSootMetalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#222529';
    ctx.fillRect(0, 0, 512, 512);

    // Продольные царапины и нагар
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const len = 15 + Math.random() * 90;
      ctx.strokeStyle =
        Math.random() > 0.35 ? 'rgba(14, 16, 18, 0.45)' : 'rgba(68, 74, 82, 0.25)';
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + (Math.random() - 0.5) * 4);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const hazardTex = createHazardTexture();
  const stencilLeftTex = createArmorStencilTexture('left');
  const stencilRightTex = createArmorStencilTexture('right');
  const sootMetalTex = createSootMetalTexture();

  const armorKhakiMat = new THREE.MeshStandardMaterial({
    color: 0x475041,
    metalness: 0.45,
    roughness: 0.65,
  });

  const armorSideLeftMat = new THREE.MeshStandardMaterial({
    map: stencilLeftTex,
    metalness: 0.45,
    roughness: 0.65,
  });

  const armorSideRightMat = new THREE.MeshStandardMaterial({
    map: stencilRightTex,
    metalness: 0.45,
    roughness: 0.65,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x222529,
    map: sootMetalTex,
    metalness: 0.85,
    roughness: 0.45,
  });

  const gunmetalHardwareMat = new THREE.MeshStandardMaterial({
    color: 0x1b1e22,
    metalness: 0.88,
    roughness: 0.38,
  });

  const chromeHydraulicMat = new THREE.MeshStandardMaterial({
    color: 0xd4dae0,
    metalness: 0.96,
    roughness: 0.14,
  });

  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    metalness: 0.35,
    roughness: 0.55,
  });

  const warheadMat = new THREE.MeshStandardMaterial({
    color: 0x3a4232,
    metalness: 0.6,
    roughness: 0.48,
  });

  const copperBandMat = new THREE.MeshStandardMaterial({
    color: 0x9c5a2b,
    metalness: 0.85,
    roughness: 0.32,
  });

  // ============================================================================
  // 2. УСИЛЕННЫЙ СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange)
  // ============================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Массивная опорная плита УСП: 0.75 x 0.18 x 1.15 м с центром в (0, 0, 0)
  const basePlateGeo = new THREE.BoxGeometry(0.75, 0.18, 1.15);
  const basePlate = new THREE.Mesh(basePlateGeo, darkSteelMat);
  basePlate.castShadow = true;
  basePlate.receiveShadow = true;
  mountFlange.add(basePlate);

  // Нижний стыковочный пояс с фасками и жёлто-чёрной разметкой УСП
  const hazardStripGeo = new THREE.BoxGeometry(0.764, 0.055, 1.164);
  const hazardStrip = new THREE.Mesh(hazardStripGeo, hazardMat);
  hazardStrip.position.y = -0.045;
  hazardStrip.castShadow = true;
  hazardStrip.receiveShadow = true;
  mountFlange.add(hazardStrip);

  // Продольные силовые рёбра жёсткости плиты
  const ribGeo = new THREE.BoxGeometry(0.06, 0.09, 1.08);
  for (const sx of [-0.28, 0, 0.28]) {
    const rib = new THREE.Mesh(ribGeo, armorKhakiMat);
    rib.position.set(sx, 0.11, 0);
    rib.castShadow = true;
    rib.receiveShadow = true;
    mountFlange.add(rib);
  }

  // Задние цапфы (опорные проушины) качающейся люльки в (0, 0.22, -0.34)
  const trunnionY = 0.22;
  const trunnionZ = -0.34;
  const trunnionEarGeo = new THREE.BoxGeometry(0.075, 0.22, 0.24);
  const trunnionPinGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.66, 16);
  trunnionPinGeo.rotateZ(Math.PI / 2);

  for (const sx of [-0.26, 0.26]) {
    const ear = new THREE.Mesh(trunnionEarGeo, darkSteelMat);
    ear.position.set(sx, 0.17, trunnionZ);
    ear.castShadow = true;
    ear.receiveShadow = true;
    mountFlange.add(ear);
  }

  const trunnionAxis = new THREE.Mesh(trunnionPinGeo, gunmetalHardwareMat);
  trunnionAxis.position.set(0, trunnionY, trunnionZ);
  trunnionAxis.castShadow = true;
  mountFlange.add(trunnionAxis);

  // 6 силовых замков УСП (через InstancedMesh)
  const lockShape = new THREE.Shape();
  lockShape.moveTo(-0.045, -0.05);
  lockShape.lineTo(0.045, -0.05);
  lockShape.lineTo(0.055, 0.03);
  lockShape.lineTo(0.02, 0.075);
  lockShape.lineTo(-0.03, 0.075);
  lockShape.lineTo(-0.045, 0.02);
  lockShape.closePath();

  const lockGeo = new THREE.ExtrudeGeometry(lockShape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  lockGeo.center();

  const locksInstanced = new THREE.InstancedMesh(lockGeo, gunmetalHardwareMat, 6);
  locksInstanced.name = 'uspLocksInstanced';
  locksInstanced.castShadow = true;
  locksInstanced.receiveShadow = true;

  const lockPositions = [
    [-0.39, 0.025, -0.38, 0],
    [-0.39, 0.025, 0.0, 0],
    [-0.39, 0.025, 0.38, 0],
    [0.39, 0.025, -0.38, Math.PI],
    [0.39, 0.025, 0.0, Math.PI],
    [0.39, 0.025, 0.38, Math.PI],
  ];

  const dummy = new THREE.Object3D();
  lockPositions.forEach(([lx, ly, lz, rotY], idx) => {
    dummy.position.set(lx, ly, lz);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    locksInstanced.setMatrixAt(idx, dummy.matrix);
  });
  locksInstanced.instanceMatrix.needsUpdate = true;
  mountFlange.add(locksInstanced);

  // Гидропривод наклона (двойной телескопический гидроцилиндр)
  const hydraulicGroup = new THREE.Group();
  hydraulicGroup.name = 'elevationHydraulic';
  mountFlange.add(hydraulicGroup);

  const hydBaseAnchor = new THREE.Vector3(0, 0.11, 0.38);
  const hydCylinderGroup = new THREE.Group();
  hydCylinderGroup.position.copy(hydBaseAnchor);
  hydraulicGroup.add(hydCylinderGroup);

  // Опорная проушина гидроцилиндра на плите
  const hydMountBracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.09, 0.14),
    darkSteelMat
  );
  hydMountBracket.position.copy(hydBaseAnchor).add(new THREE.Vector3(0, -0.02, 0));
  hydMountBracket.castShadow = true;
  hydraulicGroup.add(hydMountBracket);

  // Парные корпуса гидроцилиндров и хромированные штоки (ориентированы вдоль +Z группы)
  const barrelGeo = new THREE.CylinderGeometry(0.036, 0.04, 0.34, 16);
  barrelGeo.rotateX(Math.PI / 2);
  const rodGeo = new THREE.CylinderGeometry(0.021, 0.021, 0.36, 16);
  rodGeo.rotateX(Math.PI / 2);

  const hydRods = [];
  for (const sx of [-0.085, 0.085]) {
    const barrel = new THREE.Mesh(barrelGeo, armorKhakiMat);
    barrel.position.set(sx, 0, 0.17);
    barrel.castShadow = true;
    hydCylinderGroup.add(barrel);

    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.043, 0.043, 0.04, 16).rotateX(Math.PI / 2),
      darkSteelMat
    );
    collar.position.set(sx, 0, 0.34);
    hydCylinderGroup.add(collar);

    const rod = new THREE.Mesh(rodGeo, chromeHydraulicMat);
    rod.position.set(sx, 0, 0.32);
    rod.castShadow = true;
    hydCylinderGroup.add(rod);
    hydRods.push(rod);
  }

  // ============================================================================
  // 3. КАЧАЮЩАЯСЯ АРТИЛЛЕРИЙСКАЯ ЧАСТЬ: БРОНЕКОРОБ + 15 ТРУБ 220 ММ
  // ============================================================================
  const elevationCradle = new THREE.Group();
  elevationCradle.name = 'elevationCradle';
  elevationCradle.position.set(0, trunnionY, trunnionZ);
  root.add(elevationCradle);

  // Смещение центра пакета относительно оси цапф для соблюдения габаритов 1.35 x 0.95 x 2.7 м
  const podOffsetY = 0.29; // Центр пакета Y_world = 0.22 + 0.29 = 0.51 м (верх ~0.86 м, низ фланца -0.09 м -> высота 0.95 м)
  const podOffsetZ = 0.34; // Центр пакета Z_world = -0.34 + 0.34 = 0.00 м (длина 2.70 м: от -1.35 до +1.35 м)

  // --- ПОДГРУППА: Бронированный пакет с теплозащитой (tosArmoredBox) ---
  const tosArmoredBox = new THREE.Group();
  tosArmoredBox.name = 'tosArmoredBox';
  tosArmoredBox.position.set(0, podOffsetY, podOffsetZ);
  elevationCradle.add(tosArmoredBox);

  // Нижний силовой поддон с проушиной для гидропривода
  const lowerHull = new THREE.Mesh(
    new THREE.BoxGeometry(1.22, 0.11, 2.38),
    darkSteelMat
  );
  lowerHull.position.set(0, -0.32, 0.02);
  lowerHull.castShadow = true;
  lowerHull.receiveShadow = true;
  tosArmoredBox.add(lowerHull);

  // Верхняя бронеплита с теплозащитным экраном
  const upperHull = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.075, 2.36),
    armorKhakiMat
  );
  upperHull.position.set(0, 0.33, 0.02);
  upperHull.castShadow = true;
  upperHull.receiveShadow = true;
  tosArmoredBox.add(upperHull);

  // Ребристый теплозащитный кожух на крыше пакета
  const heatShieldPanelGeo = new THREE.BoxGeometry(1.12, 0.028, 0.48);
  for (let i = 0; i < 4; i++) {
    const panel = new THREE.Mesh(heatShieldPanelGeo, darkSteelMat);
    panel.position.set(0, 0.375, -0.78 + i * 0.54);
    panel.castShadow = true;
    panel.receiveShadow = true;
    tosArmoredBox.add(panel);
  }

  // Бортовые бронелисты с трафаретом «ТОС-3 / ОГНЕОПАСНО»
  const sidePlateGeo = new THREE.BoxGeometry(0.045, 0.62, 2.34);

  const leftArmorWall = new THREE.Mesh(sidePlateGeo, armorSideLeftMat);
  leftArmorWall.position.set(-0.615, 0.01, 0.02);
  leftArmorWall.castShadow = true;
  leftArmorWall.receiveShadow = true;
  tosArmoredBox.add(leftArmorWall);

  const rightArmorWall = new THREE.Mesh(sidePlateGeo, armorSideRightMat);
  rightArmorWall.position.set(0.615, 0.01, 0.02);
  rightArmorWall.castShadow = true;
  rightArmorWall.receiveShadow = true;
  tosArmoredBox.add(rightArmorWall);

  // Бортовые блоки динамической защиты («Контакт-5») — клиновидные секции по обеим сторонам
  // С учётом ДЗ общая ширина достигает ровно 1.35 м (±0.675 м)
  const eraWedgeShape = new THREE.Shape();
  eraWedgeShape.moveTo(0, -0.24);
  eraWedgeShape.lineTo(0.055, -0.17);
  eraWedgeShape.lineTo(0.062, 0.0);
  eraWedgeShape.lineTo(0.055, 0.17);
  eraWedgeShape.lineTo(0, 0.24);
  eraWedgeShape.closePath();

  const eraBlockGeo = new THREE.ExtrudeGeometry(eraWedgeShape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  eraBlockGeo.center();

  const eraDividerGeo = new THREE.BoxGeometry(0.05, 0.52, 0.032);

  for (const sideSign of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const bz = -0.76 + i * 0.39;
      const eraBlock = new THREE.Mesh(eraBlockGeo, armorKhakiMat);
      eraBlock.position.set(sideSign * 0.642, 0.01, bz);
      if (sideSign < 0) eraBlock.rotation.y = Math.PI;
      eraBlock.castShadow = true;
      eraBlock.receiveShadow = true;
      tosArmoredBox.add(eraBlock);

      if (i < 4) {
        const divider = new THREE.Mesh(eraDividerGeo, darkSteelMat);
        divider.position.set(sideSign * 0.64, 0.01, bz + 0.195);
        divider.castShadow = true;
        tosArmoredBox.add(divider);
      }
    }
  }

  // Косые лобовые бронещитки (верхний, нижний и боковые скуловые экраны вокруг дульного среза)
  const frontTopCowl = new THREE.Mesh(
    new THREE.BoxGeometry(1.32, 0.055, 0.24),
    armorKhakiMat
  );
  frontTopCowl.position.set(0, 0.355, 1.24);
  frontTopCowl.rotation.x = 0.26;
  frontTopCowl.castShadow = true;
  frontTopCowl.receiveShadow = true;
  tosArmoredBox.add(frontTopCowl);

  const frontBottomCowl = new THREE.Mesh(
    new THREE.BoxGeometry(1.32, 0.055, 0.24),
    armorKhakiMat
  );
  frontBottomCowl.position.set(0, -0.335, 1.24);
  frontBottomCowl.rotation.x = -0.24;
  frontBottomCowl.castShadow = true;
  frontBottomCowl.receiveShadow = true;
  tosArmoredBox.add(frontBottomCowl);

  for (const sideSign of [-1, 1]) {
    const cheekShield = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.66, 0.24),
      armorKhakiMat
    );
    cheekShield.position.set(sideSign * 0.645, 0.01, 1.23);
    cheekShield.rotation.y = -sideSign * 0.22;
    cheekShield.castShadow = true;
    cheekShield.receiveShadow = true;
    tosArmoredBox.add(cheekShield);
  }

  // Передняя и задняя трубные решётки (опорные бронеплиты с отверстиями)
  const frontFramePlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.68, 0.045),
    darkSteelMat
  );
  frontFramePlate.position.set(0, 0.01, 1.16);
  frontFramePlate.castShadow = true;
  frontFramePlate.receiveShadow = true;
  tosArmoredBox.add(frontFramePlate);

  const rearFramePlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.68, 0.045),
    darkSteelMat
  );
  rearFramePlate.position.set(0, 0.01, -1.12);
  rearFramePlate.castShadow = true;
  rearFramePlate.receiveShadow = true;
  tosArmoredBox.add(rearFramePlate);

  // Массивные откидные газоотводные дефлекторы сзади (-Z, до -1.35 м)
  const rearDeflectors = new THREE.Group();
  rearDeflectors.name = 'rearBlastDeflectors';
  rearDeflectors.position.set(0, 0.01, -1.14);
  tosArmoredBox.add(rearDeflectors);

  // Верхний откидной газоотводный щиток
  const upperFlapPivot = new THREE.Group();
  upperFlapPivot.position.set(0, 0.33, 0);
  upperFlapPivot.rotation.x = -0.48;
  rearDeflectors.add(upperFlapPivot);

  const upperFlapMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.28, 0.045, 0.26),
    darkSteelMat
  );
  upperFlapMesh.position.set(0, 0, -0.11);
  upperFlapMesh.castShadow = true;
  upperFlapMesh.receiveShadow = true;
  upperFlapPivot.add(upperFlapMesh);

  // Нижний откидной газоотводный щиток
  const lowerFlapPivot = new THREE.Group();
  lowerFlapPivot.position.set(0, -0.33, 0);
  lowerFlapPivot.rotation.x = 0.48;
  rearDeflectors.add(lowerFlapPivot);

  const lowerFlapMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.28, 0.045, 0.26),
    darkSteelMat
  );
  lowerFlapMesh.position.set(0, 0, -0.11);
  lowerFlapMesh.castShadow = true;
  lowerFlapMesh.receiveShadow = true;
  lowerFlapPivot.add(lowerFlapMesh);

  // Боковые щёки газоотвода и вертикальные рассекатели реактивной струи
  for (const sideSign of [-1, 1]) {
    const sideBlastPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.78, 0.24),
      darkSteelMat
    );
    sideBlastPlate.position.set(sideSign * 0.635, 0, -0.10);
    sideBlastPlate.rotation.y = sideSign * 0.16;
    sideBlastPlate.castShadow = true;
    rearDeflectors.add(sideBlastPlate);

    // Силовые петли откидных дефлекторов
    for (const hy of [-0.33, 0.33]) {
      const hinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.14, 12).rotateZ(Math.PI / 2),
        gunmetalHardwareMat
      );
      hinge.position.set(sideSign * 0.48, hy, 0.0);
      rearDeflectors.add(hinge);
    }
  }

  // Вертикальные газодинамические рассекатели внутри кормового раструба
  const vaneGeo = new THREE.BoxGeometry(0.018, 0.64, 0.18);
  for (const vx of [-0.37, -0.125, 0.125, 0.37]) {
    const vane = new THREE.Mesh(vaneGeo, darkSteelMat);
    vane.position.set(vx, 0, -0.09);
    vane.castShadow = true;
    rearDeflectors.add(vane);
  }

  // Заклёпки и силовые болты через THREE.InstancedMesh
  const rivetTransforms = [];

  // Заклёпки по периметру опорной плиты УСП
  for (let z = -0.52; z <= 0.52; z += 0.13) {
    rivetTransforms.push({ x: -0.34, y: 0.095, z, rx: 0, rz: 0, scale: 1.1 });
    rivetTransforms.push({ x: 0.34, y: 0.095, z, rx: 0, rz: 0, scale: 1.1 });
  }

  // Заклёпки по бортам бронекороба и блокам ДЗ «Контакт-5» (в координатах tosArmoredBox)
  const podRivetTransforms = [];
  for (const sideSign of [-1, 1]) {
    for (let z = -1.04; z <= 1.08; z += 0.16) {
      podRivetTransforms.push({
        x: sideSign * 0.638,
        y: 0.295,
        z,
        rx: 0,
        rz: -sideSign * (Math.PI / 2),
        scale: 0.95,
      });
      podRivetTransforms.push({
        x: sideSign * 0.638,
        y: -0.275,
        z,
        rx: 0,
        rz: -sideSign * (Math.PI / 2),
        scale: 0.95,
      });
    }
    // Болты крепления на каждой кассете ДЗ
    for (let i = 0; i < 5; i++) {
      const bz = -0.76 + i * 0.39;
      for (const by of [-0.14, 0.14]) {
        for (const dz of [-0.12, 0.12]) {
          podRivetTransforms.push({
            x: sideSign * 0.674,
            y: 0.01 + by,
            z: bz + dz,
            rx: 0,
            rz: -sideSign * (Math.PI / 2),
            scale: 0.85,
          });
        }
      }
    }
  }

  // Заклёпки на верхнем и нижнем лобовых щитках
  for (let x = -0.58; x <= 0.58; x += 0.145) {
    podRivetTransforms.push({ x, y: 0.37, z: 1.24, rx: 0.26, rz: 0, scale: 1.0 });
    podRivetTransforms.push({ x, y: -0.35, z: 1.24, rx: -0.24 + Math.PI, rz: 0, scale: 1.0 });
  }

  const rivetGeo = new THREE.CylinderGeometry(0.011, 0.013, 0.014, 6);
  const flangeRivetsInstanced = new THREE.InstancedMesh(
    rivetGeo,
    gunmetalHardwareMat,
    rivetTransforms.length
  );
  flangeRivetsInstanced.name = 'flangeRivetsInstanced';
  rivetTransforms.forEach((t, idx) => {
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(t.rx, 0, t.rz);
    dummy.scale.setScalar(t.scale);
    dummy.updateMatrix();
    flangeRivetsInstanced.setMatrixAt(idx, dummy.matrix);
  });
  flangeRivetsInstanced.instanceMatrix.needsUpdate = true;
  mountFlange.add(flangeRivetsInstanced);

  const armorRivetsInstanced = new THREE.InstancedMesh(
    rivetGeo,
    gunmetalHardwareMat,
    podRivetTransforms.length
  );
  armorRivetsInstanced.name = 'armorRivetsInstanced';
  podRivetTransforms.forEach((t, idx) => {
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(t.rx, 0, t.rz);
    dummy.scale.setScalar(t.scale);
    dummy.updateMatrix();
    armorRivetsInstanced.setMatrixAt(idx, dummy.matrix);
  });
  armorRivetsInstanced.instanceMatrix.needsUpdate = true;
  tosArmoredBox.add(armorRivetsInstanced);

  // --- ПОДГРУППА: Матрица 15 крупнокалиберных труб (thermobaricTubes) ---
  const thermobaricTubes = new THREE.Group();
  thermobaricTubes.name = 'thermobaricTubes';
  thermobaricTubes.position.set(0, podOffsetY + 0.01, podOffsetZ);
  elevationCradle.add(thermobaricTubes);

  // Толстостенная труба калибра 220 мм (внутренний R = 0.110 м, внешний R = 0.123 м, длина 2.48 м)
  const innerR = 0.110;
  const outerR = 0.123;
  const halfLen = 1.24;

  const tubeProfile = [
    new THREE.Vector2(innerR, -halfLen),
    new THREE.Vector2(outerR + 0.006, -halfLen), // Казённое утолщение
    new THREE.Vector2(outerR + 0.006, -halfLen + 0.06),
    new THREE.Vector2(outerR, -halfLen + 0.08),
    new THREE.Vector2(outerR, halfLen - 0.025),
    new THREE.Vector2(outerR + 0.004, halfLen - 0.015), // Дульный буртик
    new THREE.Vector2(outerR + 0.004, halfLen),
    new THREE.Vector2(innerR + 0.003, halfLen), // Фаска дульного среза
    new THREE.Vector2(innerR, halfLen - 0.015),
    new THREE.Vector2(innerR, -halfLen),
  ];

  const tubeGeo = new THREE.LatheGeometry(tubeProfile, 28);
  tubeGeo.rotateX(Math.PI / 2); // Ориентируем ствол вдоль +Z

  const tubeCount = 15; // 3 ряда по 5 труб
  const tubesInstanced = new THREE.InstancedMesh(tubeGeo, darkSteelMat, tubeCount);
  tubesInstanced.name = 'tubesInstancedMesh';
  tubesInstanced.castShadow = true;
  tubesInstanced.receiveShadow = true;

  // Координаты 3 рядов x 5 колонок
  const tubeCoords = [];
  const colSpacing = 0.246;
  const rowSpacing = 0.232;

  for (let row = 0; row < 3; row++) {
    const ty = (1 - row) * rowSpacing; // Сверху вниз: +0.232, 0, -0.232
    for (let col = 0; col < 5; col++) {
      const tx = (col - 2) * colSpacing; // Слева направо: -0.492 .. +0.492
      tubeCoords.push(new THREE.Vector3(tx, ty, 0.02));
    }
  }

  tubeCoords.forEach((pos, idx) => {
    dummy.position.copy(pos);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    tubesInstanced.setMatrixAt(idx, dummy.matrix);
  });
  tubesInstanced.instanceMatrix.needsUpdate = true;
  thermobaricTubes.add(tubesInstanced);

  // 15 термобарических неуправляемых реактивных снарядов (МО.1.01.04М) внутри труб
  const warheadRadius = 0.106; // 212 мм под 220 мм направляющую
  const warheadProfile = [
    new THREE.Vector2(0.0, -0.85),
    new THREE.Vector2(0.088, -0.85), // Сопловой блок
    new THREE.Vector2(warheadRadius, -0.78),
    new THREE.Vector2(warheadRadius, 0.62), // Цилиндрическая БЧ
    new THREE.Vector2(0.098, 0.72), // Затупленная оживальная головная часть
    new THREE.Vector2(0.072, 0.79),
    new THREE.Vector2(0.036, 0.825),
    new THREE.Vector2(0.016, 0.835), // Контактный взрыватель
    new THREE.Vector2(0.016, 0.865),
    new THREE.Vector2(0.0, 0.865),
  ];

  const warheadGeo = new THREE.LatheGeometry(warheadProfile, 24);
  warheadGeo.rotateX(Math.PI / 2);

  const warheadsInstanced = new THREE.InstancedMesh(warheadGeo, warheadMat, tubeCount);
  warheadsInstanced.name = 'thermobaricWarheadsInstanced';
  warheadsInstanced.castShadow = true;

  // Обтюрирующие медные пояски на головных частях (видны в глубине стволов)
  const bandGeo = new THREE.CylinderGeometry(
    warheadRadius + 0.0015,
    warheadRadius + 0.0015,
    0.045,
    24
  );
  bandGeo.rotateX(Math.PI / 2);
  const bandsInstanced = new THREE.InstancedMesh(bandGeo, copperBandMat, tubeCount);
  bandsInstanced.name = 'warheadCopperBandsInstanced';

  const loadedZOffset = 0.34; // Нос снаряда на z = 0.34 + 0.865 = 1.205 м (утоплен на ~5.5 см от дульного среза 1.26 м)

  tubeCoords.forEach((pos, idx) => {
    dummy.position.set(pos.x, pos.y, loadedZOffset);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    warheadsInstanced.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(pos.x, pos.y, loadedZOffset + 0.56);
    dummy.updateMatrix();
    bandsInstanced.setMatrixAt(idx, dummy.matrix);
  });
  warheadsInstanced.instanceMatrix.needsUpdate = true;
  bandsInstanced.instanceMatrix.needsUpdate = true;

  thermobaricTubes.add(warheadsInstanced);
  thermobaricTubes.add(bandsInstanced);

  // ============================================================================
  // 4. ЭФФЕКТЫ ЗАЛПОВОГО ПУСКА (детерминированные, без Math.random)
  // ============================================================================
  const fxGroup = new THREE.Group();
  fxGroup.name = 'salvoEffects';
  thermobaricTubes.add(fxGroup);

  const muzzleFlashGeo = new THREE.ConeGeometry(0.24, 1.15, 16, 1, true);
  muzzleFlashGeo.rotateX(Math.PI / 2);
  muzzleFlashGeo.translate(0, 0, 0.58);

  const exhaustPlumeGeo = new THREE.ConeGeometry(0.11, 1.45, 14, 1, true);
  exhaustPlumeGeo.rotateX(-Math.PI / 2);
  exhaustPlumeGeo.translate(0, 0, -1.55);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const muzzleFlashes = [];
  const backblastFlashes = [];
  const rocketPlumes = [];

  for (let i = 0; i < tubeCount; i++) {
    const mFlash = new THREE.Mesh(muzzleFlashGeo, flashMat.clone());
    mFlash.visible = false;
    mFlash.position.set(tubeCoords[i].x, tubeCoords[i].y, 1.26);
    fxGroup.add(mFlash);
    muzzleFlashes.push(mFlash);

    const bFlash = new THREE.Mesh(muzzleFlashGeo, flashMat.clone());
    bFlash.visible = false;
    bFlash.rotation.y = Math.PI;
    bFlash.scale.set(1.2, 1.2, 1.35);
    bFlash.position.set(tubeCoords[i].x, tubeCoords[i].y, -1.24);
    fxGroup.add(bFlash);
    backblastFlashes.push(bFlash);

    const plume = new THREE.Mesh(exhaustPlumeGeo, flashMat.clone());
    plume.visible = false;
    fxGroup.add(plume);
    rocketPlumes.push(plume);
  }

  // Динамическая подсветка вспышек выстрелов
  const muzzleLight = new THREE.PointLight(0xff8c24, 0, 9.0, 1.6);
  muzzleLight.position.set(0, 0.1, 1.65);
  fxGroup.add(muzzleLight);

  const backblastLight = new THREE.PointLight(0xff6b1a, 0, 7.5, 1.8);
  backblastLight.position.set(0, 0.1, -1.55);
  fxGroup.add(backblastLight);

  // Порядок залпового пуска (симметричный веер от центра к краям)
  const salvoOrder = [7, 6, 8, 2, 12, 5, 9, 1, 13, 0, 14, 3, 11, 4, 10];
  const fireTimeOf = (k) => TOS_FIRE_START + k * TOS_INTERVAL;

  // Кинематическая синхронизация гидропривода с углом возвышения люльки
  const upperHydLocal = new THREE.Vector3(0, -0.31, 0.66);
  const upperHydInMount = new THREE.Vector3();

  function updateHydraulics() {
    elevationCradle.updateMatrix();
    tosArmoredBox.updateMatrix();

    upperHydInMount
      .copy(upperHydLocal)
      .applyMatrix4(tosArmoredBox.matrix)
      .applyMatrix4(elevationCradle.matrix);

    hydCylinderGroup.lookAt(
      root.localToWorld(upperHydInMount.clone())
    );
    const dist = hydBaseAnchor.distanceTo(upperHydInMount);
    const rodExtension = Math.max(0.18, dist - 0.19);
    for (const rod of hydRods) {
      rod.position.z = rodExtension;
    }
  }

  // ============================================================================
  // 5. ДЕТЕРМИНИРОВАННАЯ ПОЗА ЦИКЛА ДЛЯ ПРОСМОТРЩИКА (абсолютное время t)
  // applyMlrsAbsolute(t): наведение, залп 15 снарядов, вспышки, отдача, свет.
  // Возвращает { fired, flash } для телеметрии.
  // ============================================================================
  function applyMlrsAbsolute(t) {
    const ct = Math.max(0, Math.min(TOS_CYCLE, t));

    // Наведение по углу возвышения: быстрый выход на -0.24, возврат после 4.8 с
    let pitch;
    if (ct < 4.8) {
      pitch = -0.24 * (1 - Math.exp(-5 * ct));
    } else {
      pitch = -0.24 * Math.exp(-5 * (ct - 4.8));
    }

    // Отдача пакета: сумма затухающих импульсов -0.028 от каждого выстрела
    let recoil = 0;
    let fired = 0;
    let maxFlash = 0;
    let lastFireT = -1;
    for (let k = 0; k < TOS_COUNT; k++) {
      const tFire = fireTimeOf(k);
      if (ct >= tFire) {
        fired++;
        lastFireT = tFire;
        recoil += -0.028 * Math.exp(-14 * (ct - tFire));
        maxFlash = Math.max(maxFlash, Math.max(0, 1 - (ct - tFire) / 0.14));
      }
    }

    elevationCradle.rotation.x = pitch + recoil * 0.18;
    tosArmoredBox.position.z = podOffsetZ + recoil;
    thermobaricTubes.position.z = podOffsetZ + recoil;

    // Вибрация кормовых газоотводных дефлекторов при выхлопе
    const flapKick = Math.abs(recoil) * 4.5;
    upperFlapPivot.rotation.x = -0.48 - flapKick;
    lowerFlapPivot.rotation.x = 0.48 + flapKick;

    updateHydraulics();

    // Снаряды, вспышки и факелы
    for (let i = 0; i < TOS_COUNT; i++) {
      const k = salvoOrder.indexOf(i);
      const tFire = fireTimeOf(k);
      const tc = tubeCoords[i];

      if (ct < tFire) {
        dummy.position.set(tc.x, tc.y, loadedZOffset);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        warheadsInstanced.setMatrixAt(i, dummy.matrix);

        dummy.position.set(tc.x, tc.y, loadedZOffset + 0.56);
        dummy.updateMatrix();
        bandsInstanced.setMatrixAt(i, dummy.matrix);

        muzzleFlashes[i].visible = false;
        backblastFlashes[i].visible = false;
        rocketPlumes[i].visible = false;
      } else {
        const ft = ct - tFire;
        const z = loadedZOffset + 14.0 * ft + 23.0 * ft * ft;
        const spin = 18.0 * ft;
        const inRange = z < 26.0;

        dummy.position.set(tc.x, tc.y, z);
        dummy.rotation.set(0, 0, spin);
        dummy.scale.setScalar(inRange ? 1 : 0);
        dummy.updateMatrix();
        warheadsInstanced.setMatrixAt(i, dummy.matrix);

        dummy.position.set(tc.x, tc.y, z + 0.56);
        dummy.updateMatrix();
        bandsInstanced.setMatrixAt(i, dummy.matrix);

        const plume = rocketPlumes[i];
        plume.visible = inRange;
        if (inRange) {
          plume.position.set(tc.x, tc.y, z);
          const f1 = 0.85 + 0.35 * (0.5 + 0.5 * Math.sin(ct * 91.0 + i * 1.93));
          const f2 = 0.9 + 0.4 * (0.5 + 0.5 * Math.sin(ct * 77.0 + i * 3.1));
          plume.scale.set(f1, f1, f2);
        }

        const ratio = Math.max(0, 1 - ft / 0.14);
        const mFlash = muzzleFlashes[i];
        mFlash.visible = ratio > 0;
        if (mFlash.visible) {
          mFlash.scale.set(0.7 + ratio * 0.6, 0.7 + ratio * 0.6, 0.5 + ratio * 0.9);
          mFlash.material.opacity = ratio * 0.95;
        }
        const bFlash = backblastFlashes[i];
        bFlash.visible = ratio > 0;
        if (bFlash.visible) {
          bFlash.scale.set(
            1.2 * (0.8 + ratio * 0.7),
            1.2 * (0.8 + ratio * 0.7),
            1.35 * (0.7 + ratio * 1.1)
          );
          bFlash.material.opacity = ratio * 0.9;
        }
      }
    }
    warheadsInstanced.instanceMatrix.needsUpdate = true;
    bandsInstanced.instanceMatrix.needsUpdate = true;

    // Затухание освещения от вспышек
    if (lastFireT >= 0) {
      const dtLast = ct - lastFireT;
      muzzleLight.intensity = 18.0 * Math.exp(-18 * dtLast);
      backblastLight.intensity = 14.0 * Math.exp(-18 * dtLast);
    } else {
      muzzleLight.intensity = 0;
      backblastLight.intensity = 0;
    }

    return { fired, flash: maxFlash };
  }

  root.userData = {
    applyMlrsAbsolute,
    triggerSalvo: () => applyMlrsAbsolute(TOS_FIRE_START),
    parts: {
      mountFlange,
      elevationCradle,
      tosArmoredBox,
      thermobaricTubes,
    },
  };

  return root;
}

// ============================================================================
// Адаптер под единый просмотрщик: залп 15 снарядов веером от центра.
// applyMlrs(t): абсолютное время цикла — наведение, вспышки, отдача, свет.
// Возвращает { fired, flash } для телеметрии.
// ============================================================================
export function createWeapon() {
  const root = createWeaponTOS3SolntsepekM();
  const ud = root.userData;

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  ud.applyMlrs = (t) => ud.applyMlrsAbsolute(Math.max(0, Math.min(TOS_CYCLE, t)));

  ud.setExtension = (t) => {
    const info = ud.applyMlrs(t);
    return info;
  };
  ud.setFlash = (k) => {
    const c = Math.max(0, Math.min(1, k));
    const muzzleLight = root.getObjectByName('salvoEffects');
    if (muzzleLight) {
      muzzleLight.children.forEach((ch) => {
        if (ch.isPointLight) ch.intensity = 8.0 * c;
      });
    }
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
