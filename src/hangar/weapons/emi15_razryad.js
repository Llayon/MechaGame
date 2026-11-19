import * as THREE from 'three';

export const meta = {
  id: 'emi15',
  code: 'ЭМИ-15',
  title: 'ЭМИ-15 «Разряд»',
  subtitle: 'ДУГОВОЙ ЭЛЕКТРОИМПУЛЬСНЫЙ ИЗЛУЧАТЕЛЬ • СЛОТ MAIN • 50 кВ / 160 мкФ',
  description:
    'Дуговой электроимпульсный излучатель: фланец УСП с табличками высокого напряжения, бронированный конденсаторный накопитель 50 кВ / 160 мкФ с 4 выносными банками, медными шинами и фарфоровыми изоляторами, шток с 7 тарельчатыми изоляторами, тремя медными штангами и сферическо-кольцевым искровым разрядником. Цикл 6.4 с: накопление → готовность → серия пробоев → остывание.',
  specs: [
    ['Напряжение', 'Uраб = 50 кВ'],
    ['Ёмкость', 'С = 160 мкФ'],
    ['Слот', 'MAIN'],
    ['Цикл', '6.4 с'],
    ['Изоляторы', '7 тарельчатых'],
    ['Длина модуля', '2.75 м'],
  ],
  maxExtension: 6.4,
  unit: 's',
  tipOffset: 2.05,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'capacitorCore', label: '2. Конденсаторный накопитель' },
    { key: 'arcEmitterHead', label: '3. Излучатель и разрядник' },
    { key: 'sparkArc', label: '4. Искровой пробой' },
  ],
  cameras: {
    module: { pos: [2.35, 0.72, 2.55], target: [0, -0.36, 0.75] },
  },
  rangeMarkers: [],
  controls: 'railgun',
};

const EMI_CYCLE = 6.4;
const EMI_CHARGE_END = 4.2;
const EMI_FIRE_START = 5.05;
const EMI_FIRE_END = 5.5;

/**
 * Создаёт процедурную 3D-модель дугового электроимпульсного излучателя ЭМИ-15 «Разряд» (слот MAIN).
 * Система координат:
 * - 1 unit = 1 метр
 * - Общая длина: 2.75 м (от z = -0.70 до z = +2.05)
 * - Направление ствола/разрядника: +Z, верх: +Y, бок: +X
 * - Точка привязки (0, 0, 0): центр верхней плоскости стыковочного фланца УСП
 *
 * @returns {THREE.Group}
 */
export function createWeaponEMI15Razryad() {
  const root = new THREE.Group();
  root.name = 'EMI15_Razryad';

  // --- ПРОЦЕДУРНЫЕ PBR-ТЕКСТУРЫ И МАТЕРИАЛЫ ---
  const createSteelRoughnessMap = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#999999';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 4500; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const v = 135 + Math.floor((Math.random() - 0.5) * 45);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  };

  const createDangerSignTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    // Жёлтый промышленный фон ГОСТ
    ctx.fillStyle = '#d9a71c';
    ctx.fillRect(0, 0, 512, 160);

    // Чёрно-жёлтая предупреждающая рамка
    ctx.fillStyle = '#18191b';
    ctx.fillRect(0, 0, 512, 16);
    ctx.fillRect(0, 144, 512, 16);
    ctx.fillRect(0, 0, 16, 160);
    ctx.fillRect(496, 0, 16, 160);

    ctx.fillStyle = '#d9a71c';
    for (let x = -20; x < 530; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 16, 0);
      ctx.lineTo(x + 6, 16);
      ctx.lineTo(x - 10, 16);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x, 144);
      ctx.lineTo(x + 16, 144);
      ctx.lineTo(x + 6, 160);
      ctx.lineTo(x - 10, 160);
      ctx.closePath();
      ctx.fill();
    }

    // Знак молнии в треугольнике
    ctx.strokeStyle = '#18191b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(68, 30);
    ctx.lineTo(110, 128);
    ctx.lineTo(26, 128);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#18191b';
    ctx.beginPath();
    ctx.moveTo(71, 52);
    ctx.lineTo(56, 86);
    ctx.lineTo(70, 86);
    ctx.lineTo(61, 118);
    ctx.lineTo(83, 80);
    ctx.lineTo(68, 80);
    ctx.closePath();
    ctx.fill();

    // Текст предупреждения
    ctx.fillStyle = '#18191b';
    ctx.font = 'bold 34px "Arial Narrow", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ОПАСНО:', 305, 58);
    ctx.font = 'bold 27px "Arial Narrow", Arial, sans-serif';
    ctx.fillText('ВЫСОКОЕ НАПРЯЖЕНИЕ', 305, 104);

    // Потёртости и заклёпки
    ctx.fillStyle = 'rgba(40, 35, 25, 0.16)';
    for (let i = 0; i < 600; i++) {
      ctx.fillRect(Math.random() * 512, Math.random() * 160, 2, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };

  const createStencilTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 256);

    // Трафаретная маркировка белой/светло-серой краской
    ctx.fillStyle = 'rgba(225, 228, 222, 0.84)';
    ctx.font = 'bold 76px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('ЭМИ-15', 28, 76);

    // Перемычки трафарета
    ctx.clearRect(62, 34, 4, 84);
    ctx.clearRect(142, 34, 4, 84);
    ctx.clearRect(272, 34, 4, 84);

    ctx.fillRect(28, 124, 456, 4);

    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillText('ИЗЛУЧАТЕЛЬ «РАЗРЯД»', 28, 162);

    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.fillStyle = 'rgba(215, 185, 95, 0.85)';
    ctx.fillText('Uраб = 50 кВ   С = 160 мкФ', 28, 206);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };

  const steelRoughMap = createSteelRoughnessMap();

  // Основные материалы по ТЗ
  const bodySteelMat = new THREE.MeshStandardMaterial({
    color: 0x5a6066,
    metalness: 0.50,
    roughness: 0.60,
    roughnessMap: steelRoughMap,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x2c3035,
    metalness: 0.72,
    roughness: 0.48,
    roughnessMap: steelRoughMap,
  });

  const capacitorBodyMat = new THREE.MeshStandardMaterial({
    color: 0x4b555c,
    metalness: 0.58,
    roughness: 0.44,
    roughnessMap: steelRoughMap,
  });

  const porcelainMat = new THREE.MeshStandardMaterial({
    color: 0xd6cfc2,
    metalness: 0.05,
    roughness: 0.20,
  });

  const copperMat = new THREE.MeshStandardMaterial({
    color: 0xa66e38,
    metalness: 0.90,
    roughness: 0.28,
    emissive: 0xff7a1a,
    emissiveIntensity: 0,
  });

  const dangerSignMat = new THREE.MeshStandardMaterial({
    map: createDangerSignTexture(),
    metalness: 0.25,
    roughness: 0.55,
  });

  const stencilMat = new THREE.MeshStandardMaterial({
    map: createStencilTexture(),
    transparent: true,
    metalness: 0.2,
    roughness: 0.75,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Стальная плита УСП 0.52 x 0.14 x 0.85 м (верхняя плоскость строго на y = 0)
  const plateGeo = new THREE.BoxGeometry(0.52, 0.14, 0.85);
  const plateMesh = new THREE.Mesh(plateGeo, bodySteelMat);
  plateMesh.position.set(0, -0.07, 0);
  plateMesh.castShadow = true;
  plateMesh.receiveShadow = true;
  mountFlange.add(plateMesh);

  // Продольные направляющие шпонки УСП на верхней поверхности
  const railGeo = new THREE.BoxGeometry(0.036, 0.008, 0.81);
  for (const sx of [-0.18, 0.18]) {
    const rail = new THREE.Mesh(railGeo, darkSteelMat);
    rail.position.set(sx, 0.004, 0);
    mountFlange.add(rail);
  }

  // Координатная сетка крепежных отверстий УСП на верхнем фланце (InstancedMesh)
  const holeGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.004, 14);
  const holePositions = [];
  for (let ix = -2; ix <= 2; ix++) {
    for (let iz = -4; iz <= 4; iz++) {
      if (Math.abs(ix) === 2 && Math.abs(iz) % 2 === 1) continue;
      holePositions.push(new THREE.Vector3(ix * 0.09, 0.001, iz * 0.09));
    }
  }
  const holesInstanced = new THREE.InstancedMesh(holeGeo, darkSteelMat, holePositions.length);
  const dummy = new THREE.Object3D();
  holePositions.forEach((pos, idx) => {
    dummy.position.copy(pos);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    holesInstanced.setMatrixAt(idx, dummy.matrix);
  });
  holesInstanced.instanceMatrix.needsUpdate = true;
  holesInstanced.computeBoundingSphere();
  mountFlange.add(holesInstanced);

  // 4 силовых эксцентриковых замка УСП по краям плиты
  const lockCoords = [
    [-0.275, -0.29],
    [0.275, -0.29],
    [-0.275, 0.29],
    [0.275, 0.29],
  ];
  const lockHousingGeo = new THREE.BoxGeometry(0.055, 0.11, 0.12);
  const lockPinGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.15, 16);
  const lockLeverGeo = new THREE.BoxGeometry(0.024, 0.024, 0.095);

  lockCoords.forEach(([lx, lz]) => {
    const lockGroup = new THREE.Group();
    lockGroup.position.set(lx, -0.07, lz);

    const housing = new THREE.Mesh(lockHousingGeo, darkSteelMat);
    housing.castShadow = true;
    lockGroup.add(housing);

    const pin = new THREE.Mesh(lockPinGeo, bodySteelMat);
    pin.position.set(Math.sign(lx) * 0.012, 0.005, 0);
    lockGroup.add(pin);

    const lever = new THREE.Mesh(lockLeverGeo, copperMat);
    lever.position.set(Math.sign(lx) * 0.028, -0.02, Math.sign(lz) * 0.02);
    lever.rotation.x = Math.sign(lz) * 0.25;
    lockGroup.add(lever);

    mountFlange.add(lockGroup);
  });

  // Таблички «ОПАСНО: ВЫСОКОЕ НАПРЯЖЕНИЕ» на боковых гранях фланца УСП
  const signGeo = new THREE.PlaneGeometry(0.34, 0.105);
  for (const side of [-1, 1]) {
    const signBack = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.112, 0.348), darkSteelMat);
    signBack.position.set(side * 0.264, -0.07, 0);
    mountFlange.add(signBack);

    const signMesh = new THREE.Mesh(signGeo, dangerSignMat);
    signMesh.position.set(side * 0.269, -0.07, 0);
    signMesh.rotation.y = side * (Math.PI / 2);
    mountFlange.add(signMesh);
  }

  // =========================================================================
  // 2. КОНДЕНСАТОРНЫЙ БЛОК-НАКОПИТЕЛЬ (capacitorCore)
  // =========================================================================
  const capacitorCore = new THREE.Group();
  capacitorCore.name = 'capacitorCore';
  root.add(capacitorCore);

  // Основной бронированный кожух накопителя (z от -0.70 до +0.58)
  const hullMainGeo = new THREE.BoxGeometry(0.54, 0.52, 1.24);
  const hullMain = new THREE.Mesh(hullMainGeo, bodySteelMat);
  hullMain.position.set(0, -0.40, -0.06);
  hullMain.castShadow = true;
  hullMain.receiveShadow = true;
  capacitorCore.add(hullMain);

  // Нижний скошенный поддон-бронеплита
  const bellyGeo = new THREE.BoxGeometry(0.46, 0.06, 1.18);
  const belly = new THREE.Mesh(bellyGeo, darkSteelMat);
  belly.position.set(0, -0.68, -0.06);
  belly.castShadow = true;
  capacitorCore.add(belly);

  // Задняя торцевая бронекрышка (z = -0.70)
  const rearCapGeo = new THREE.BoxGeometry(0.56, 0.54, 0.04);
  const rearCap = new THREE.Mesh(rearCapGeo, darkSteelMat);
  rearCap.position.set(0, -0.40, -0.68);
  rearCap.castShadow = true;
  capacitorCore.add(rearCap);

  // Силовые шпангоуты (рёбра жёсткости) вокруг кожуха
  const ribGeo = new THREE.BoxGeometry(0.57, 0.55, 0.036);
  for (const rz of [-0.56, -0.22, 0.12, 0.46]) {
    const rib = new THREE.Mesh(ribGeo, darkSteelMat);
    rib.position.set(0, -0.40, rz);
    rib.castShadow = true;
    capacitorCore.add(rib);
  }

  // Передний коллекторный переходной блок (z = 0.56..0.64)
  const frontBulkhead = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.48, 0.08), darkSteelMat);
  frontBulkhead.position.set(0, -0.41, 0.60);
  frontBulkhead.castShadow = true;
  capacitorCore.add(frontBulkhead);

  // Трафарет «ЭМИ-15» на боковых бронепанелях
  const stencilPlaneGeo = new THREE.PlaneGeometry(0.46, 0.23);
  for (const side of [-1, 1]) {
    const stencilMesh = new THREE.Mesh(stencilPlaneGeo, stencilMat);
    stencilMesh.position.set(side * 0.272, -0.34, -0.05);
    stencilMesh.rotation.y = side * (Math.PI / 2);
    capacitorCore.add(stencilMesh);
  }

  // Решётки вентиляции (задняя и нижние боковые)
  const buildLouverGrille = (width, height, slatCount) => {
    const grille = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.016), darkSteelMat);
    grille.add(frame);

    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(width - 0.02, height - 0.02),
      new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.9 })
    );
    backing.position.z = 0.009;
    grille.add(backing);

    const slatGeo = new THREE.BoxGeometry(width - 0.024, 0.005, 0.018);
    const step = (height - 0.03) / slatCount;
    for (let i = 0; i < slatCount; i++) {
      const slat = new THREE.Mesh(slatGeo, bodySteelMat);
      slat.position.set(0, -height / 2 + 0.018 + i * step, 0.011);
      slat.rotation.x = 0.48;
      grille.add(slat);
    }
    return grille;
  };

  // Задняя вентиляционная решётка (смотрит в -Z)
  const rearVent = buildLouverGrille(0.36, 0.28, 12);
  rearVent.position.set(0, -0.40, -0.70);
  rearVent.rotation.y = Math.PI;
  capacitorCore.add(rearVent);

  // Боковые вентиляционные решётки в нижней части корпуса
  for (const side of [-1, 1]) {
    for (const vz of [-0.39, 0.29]) {
      const sideVent = buildLouverGrille(0.24, 0.14, 7);
      sideVent.position.set(side * 0.271, -0.57, vz);
      sideVent.rotation.y = side * (Math.PI / 2);
      capacitorCore.add(sideVent);
    }
  }

  // 4 массивных цилиндрических импульсных конденсатора по бокам (2 слева, 2 справа)
  const capRadius = 0.112;
  const capHeight = 0.45;
  const capCylinderGeo = new THREE.CylinderGeometry(capRadius, capRadius, capHeight, 28);
  const capRimGeo = new THREE.CylinderGeometry(capRadius + 0.005, capRadius + 0.005, 0.018, 28);
  const capStrapGeo = new THREE.BoxGeometry(0.16, 0.028, 0.25);
  const capBushingGeo = new THREE.CylinderGeometry(0.016, 0.022, 0.055, 16);
  const capTerminalStudGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.032, 12);

  const capZPositions = [-0.34, 0.18];
  for (const side of [-1, 1]) {
    const cx = side * 0.355;
    const cy = -0.42;

    capZPositions.forEach((cz) => {
      const capUnit = new THREE.Group();
      capUnit.position.set(cx, cy, cz);

      const body = new THREE.Mesh(capCylinderGeo, capacitorBodyMat);
      body.castShadow = true;
      body.receiveShadow = true;
      capUnit.add(body);

      // Закатные бортики цилиндра сверху и снизу
      for (const ry of [-capHeight / 2 + 0.01, capHeight / 2 - 0.01]) {
        const rim = new THREE.Mesh(capRimGeo, darkSteelMat);
        rim.position.y = ry;
        capUnit.add(rim);
      }

      // Два силовых хомута крепления к бронекорпусу
      for (const sy of [-0.13, 0.13]) {
        const strap = new THREE.Mesh(capStrapGeo, darkSteelMat);
        strap.position.set(-side * 0.05, sy, 0);
        strap.castShadow = true;
        capUnit.add(strap);
      }

      // Два фарфоровых проходных изолятора и медные клеммы на крышке каждого конденсатора
      for (const tz of [-0.042, 0.042]) {
        const bushing = new THREE.Mesh(capBushingGeo, porcelainMat);
        bushing.position.set(0, capHeight / 2 + 0.027, tz);
        capUnit.add(bushing);

        const stud = new THREE.Mesh(capTerminalStudGeo, copperMat);
        stud.position.set(0, capHeight / 2 + 0.065, tz);
        capUnit.add(stud);
      }

      capacitorCore.add(capUnit);
    });

    // Открытые медные токоведущие шины, объединяющие конденсаторы и уходящие в передний коллектор
    const busY = cy + capHeight / 2 + 0.072; // y = -0.123
    const mainBusBar = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.010, 0.94), copperMat);
    mainBusBar.position.set(cx, busY, 0.11);
    mainBusBar.castShadow = true;
    capacitorCore.add(mainBusBar);

    // Поперечные перемычки к клеммам каждого конденсатора
    for (const cz of capZPositions) {
      for (const tz of [-0.042, 0.042]) {
        const jumper = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.008, 0.022), copperMat);
        jumper.position.set(cx, busY - 0.006, cz + tz);
        capacitorCore.add(jumper);
      }
    }

    // Опорный изолятор шины
    const busStand = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.05, 14), porcelainMat);
    busStand.position.set(cx - side * 0.05, busY - 0.03, 0.44);
    capacitorCore.add(busStand);

    // Ввод медной шины внутрь переднего высоковольтного коллектора (z = 0.58)
    const feedInBar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.036), copperMat);
    feedInBar.position.set(cx - side * 0.07, busY, 0.57);
    capacitorCore.add(feedInBar);

    const dropBar = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.24, 0.036), copperMat);
    dropBar.position.set(cx - side * 0.145, busY - 0.115, 0.57);
    capacitorCore.add(dropBar);
  }

  // =========================================================================
  // 3. ИЗОЛЯТОРНЫЙ ШТОК И ИСКРОВОЙ РАЗРЯДНИК (arcEmitterHead)
  // =========================================================================
  const arcEmitterHead = new THREE.Group();
  arcEmitterHead.name = 'arcEmitterHead';
  root.add(arcEmitterHead);

  const axisY = -0.42;

  // Основание крепления излучателя на переднем торце (z = 0.64..0.72)
  const collarBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.24, 0.08, 24),
    darkSteelMat
  );
  collarBase.rotation.x = Math.PI / 2;
  collarBase.position.set(0, axisY, 0.68);
  collarBase.castShadow = true;
  arcEmitterHead.add(collarBase);

  // Толстый центральный стержень-изолятор, вытянутый вперёд до z = 1.85 (далее электроды до z = 2.05)
  const centralRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.054, 1.22, 24),
    darkSteelMat
  );
  centralRod.rotation.x = Math.PI / 2;
  centralRod.position.set(0, axisY, 1.25);
  centralRod.castShadow = true;
  arcEmitterHead.add(centralRod);

  // Профиль крупного ребристого тарельчатого высоковольтного изолятора (LatheGeometry)
  const buildShedInsulatorGeometry = () => {
    // Профиль вдоль оси Y от -0.062 до +0.062 (после поворота по X станет вдоль Z)
    const pts = [
      new THREE.Vector2(0.052, -0.062),
      new THREE.Vector2(0.085, -0.062),
      new THREE.Vector2(0.095, -0.045),
      new THREE.Vector2(0.168, -0.025), // Нижняя крупная тарелка
      new THREE.Vector2(0.175, -0.015),
      new THREE.Vector2(0.165, -0.006),
      new THREE.Vector2(0.110, -0.002), // Глубокое ребро-канавка
      new THREE.Vector2(0.156, 0.012),  // Вторая тарелка
      new THREE.Vector2(0.160, 0.021),
      new THREE.Vector2(0.105, 0.028),
      new THREE.Vector2(0.132, 0.042),  // Верхний козырёк
      new THREE.Vector2(0.128, 0.050),
      new THREE.Vector2(0.082, 0.062),
      new THREE.Vector2(0.052, 0.062),
    ];
    const geo = new THREE.LatheGeometry(pts, 36);
    geo.rotateX(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  };

  // 7 крупных ребристых тарельчатых высоковольтных изоляторов через InstancedMesh
  const insulatorCount = 7;
  const shedGeo = buildShedInsulatorGeometry();
  const insulatorsInstanced = new THREE.InstancedMesh(shedGeo, porcelainMat, insulatorCount);
  insulatorsInstanced.castShadow = true;
  insulatorsInstanced.receiveShadow = true;

  const startZ = 0.79;
  const stepZ = 0.148; // 0.79 .. 1.678
  for (let i = 0; i < insulatorCount; i++) {
    dummy.position.set(0, axisY, startZ + i * stepZ);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    insulatorsInstanced.setMatrixAt(i, dummy.matrix);
  }
  insulatorsInstanced.instanceMatrix.needsUpdate = true;
  insulatorsInstanced.computeBoundingSphere();
  arcEmitterHead.add(insulatorsInstanced);

  // Диэлектрические/стальные опорные пауки-фиксаторы для трёх токоведущих штанг
  const rodAngles = [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6]; // 90°, 210°, 330°
  const rodOrbitR = 0.228;

  for (const spiderZ of [1.01, 1.46]) {
    const spiderRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.088, 0.012, 12, 24),
      darkSteelMat
    );
    spiderRing.position.set(0, axisY, spiderZ);
    arcEmitterHead.add(spiderRing);

    for (const ang of rodAngles) {
      const strutLen = rodOrbitR - 0.085;
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.009, 0.011, strutLen, 12),
        porcelainMat
      );
      const midR = 0.085 + strutLen / 2;
      strut.position.set(Math.cos(ang) * midR, axisY + Math.sin(ang) * midR, spiderZ);
      strut.rotation.z = ang - Math.PI / 2;
      arcEmitterHead.add(strut);
    }
  }

  // Три медных токоведущих штанги, сходящиеся на конце к сферическо-кольцевому разряднику
  const ringZ = 1.89;
  const ringMajorR = 0.142;

  rodAngles.forEach((ang) => {
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cosA * rodOrbitR, axisY + sinA * rodOrbitR, 0.65),
      new THREE.Vector3(cosA * rodOrbitR, axisY + sinA * rodOrbitR, 1.20),
      new THREE.Vector3(cosA * rodOrbitR, axisY + sinA * rodOrbitR, 1.66),
      new THREE.Vector3(cosA * (rodOrbitR * 0.84), axisY + sinA * (rodOrbitR * 0.84), 1.79),
      new THREE.Vector3(cosA * ringMajorR, axisY + sinA * ringMajorR, ringZ),
    ]);

    const rodGeo = new THREE.TubeGeometry(curve, 36, 0.015, 14, false);
    const rodMesh = new THREE.Mesh(rodGeo, copperMat);
    rodMesh.castShadow = true;
    arcEmitterHead.add(rodMesh);

    // Медный зажимной наконечник в месте стыка с кольцом разрядника
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), copperMat);
    joint.position.set(cosA * ringMajorR, axisY + sinA * ringMajorR, ringZ);
    arcEmitterHead.add(joint);
  });

  // Массивный сферическо-кольцевой искровой разрядник на конце (z = 1.83..2.05)
  // 1) Внешнее массивное медное эквипотенциальное кольцо
  const guardRing = new THREE.Mesh(
    new THREE.TorusGeometry(ringMajorR, 0.022, 20, 40),
    copperMat
  );
  guardRing.position.set(0, axisY, ringZ);
  guardRing.castShadow = true;
  arcEmitterHead.add(guardRing);

  // 2) Внутренний высоковольтный сферический электрод (z = 1.855)
  const hvCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.048, 0.07, 20),
    copperMat
  );
  hvCone.rotation.x = Math.PI / 2;
  hvCone.position.set(0, axisY, 1.82);
  arcEmitterHead.add(hvCone);

  const hvSphere = new THREE.Mesh(new THREE.SphereGeometry(0.042, 24, 20), copperMat);
  hvSphere.position.set(0, axisY, 1.855);
  hvSphere.castShadow = true;
  arcEmitterHead.add(hvSphere);
  // Задняя полусфера кончается на z = 1.855 + 0.042 = 1.897

  // 3) Передний ответный сферический электрод (z = 2.012, передний край ровно на z = 2.050)
  const groundSphereRadius = 0.038;
  const groundSphereZ = 2.050 - groundSphereRadius; // 2.012 -> срез зазора на z = 1.974
  const groundSphere = new THREE.Mesh(
    new THREE.SphereGeometry(groundSphereRadius, 24, 20),
    copperMat
  );
  groundSphere.position.set(0, axisY, groundSphereZ);
  groundSphere.castShadow = true;
  arcEmitterHead.add(groundSphere);

  // Несущий передний кольцевой кронштейн ответного электрода (повернут на 60° относительно медных штанг)
  const frontSupportRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.011, 14, 32),
    darkSteelMat
  );
  frontSupportRing.position.set(0, axisY, groundSphereZ);
  arcEmitterHead.add(frontSupportRing);

  const returnAngles = [Math.PI / 6, (5 * Math.PI) / 6, (3 * Math.PI) / 2]; // 30°, 150°, 270°
  returnAngles.forEach((ang) => {
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);

    // Радиальная спица к передней сфере
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.010, 0.082, 12),
      copperMat
    );
    spoke.position.set(cosA * 0.075, axisY + sinA * 0.075, groundSphereZ);
    spoke.rotation.z = ang - Math.PI / 2;
    arcEmitterHead.add(spoke);

    // Продольная возвратная тяга от основания головки (z = 0.68) к переднему кольцу разрядника
    const returnCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cosA * 0.21, axisY + sinA * 0.21, 0.68),
      new THREE.Vector3(cosA * 0.26, axisY + sinA * 0.26, 1.35),
      new THREE.Vector3(cosA * 0.22, axisY + sinA * 0.22, 1.82),
      new THREE.Vector3(cosA * 0.115, axisY + sinA * 0.115, groundSphereZ),
    ]);
    const returnStrut = new THREE.Mesh(
      new THREE.TubeGeometry(returnCurve, 32, 0.009, 10, false),
      darkSteelMat
    );
    returnStrut.castShadow = true;
    arcEmitterHead.add(returnStrut);
  });

  // =========================================================================
  // 4. ЭЛЕКТРИЧЕСКИЙ ПРОБОЙ В ЗАЗОРЕ РАЗРЯДНИКА (z = 1.897 .. 1.974)
  // =========================================================================
  const gapStartZ = 1.897;
  const gapEndZ = 1.974;
  const gapCenterZ = (gapStartZ + gapEndZ) / 2;

  const arcGroup = new THREE.Group();
  arcGroup.name = 'sparkArc';
  arcEmitterHead.add(arcGroup);

  const arcCoreMat = new THREE.MeshStandardMaterial({
    color: 0xdff6ff,
    emissive: 0x5ce1ff,
    emissiveIntensity: 0,
    roughness: 0.1,
    metalness: 0.0,
    toneMapped: false,
  });

  const arcBranchMat = new THREE.MeshStandardMaterial({
    color: 0xb8d8ff,
    emissive: 0x3b82f6,
    emissiveIntensity: 0,
    roughness: 0.2,
    metalness: 0.0,
    toneMapped: false,
  });

  // Создаём 3 разрядных канала (1 основной плазменный шнур + 2 побочные ветви)
  const arcSegments = 10;
  const buildArcBoltMesh = (radius, mat) => {
    const pts = [];
    for (let i = 0; i <= arcSegments; i++) {
      const t = i / arcSegments;
      pts.push(new THREE.Vector3(0, axisY, THREE.MathUtils.lerp(gapStartZ, gapEndZ, t)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, arcSegments * 2, radius, 6, false);
    const mesh = new THREE.Mesh(geo, mat);
    return { mesh, radius };
  };

  const bolts = [
    buildArcBoltMesh(0.0045, arcCoreMat),
    buildArcBoltMesh(0.0024, arcBranchMat),
    buildArcBoltMesh(0.0020, arcBranchMat),
  ];
  bolts.forEach((b) => arcGroup.add(b.mesh));

  // Сфера короны в центре пробоя
  const coronaGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  coronaGlow.position.set(0, axisY, gapCenterZ);
  arcGroup.add(coronaGlow);

  // Динамический источник света от вспышки дуги
  const arcLight = new THREE.PointLight(0x66ccff, 0, 4.0, 1.8);
  arcLight.position.set(0, axisY, gapCenterZ);
  arcGroup.add(arcLight);

  // Ссылки для адаптера просмотрщика (детерминированный цикл заряда/разряда)
  root.userData.arcFX = {
    group: arcGroup,
    bolts,
    segments: arcSegments,
    coreMat: arcCoreMat,
    branchMat: arcBranchMat,
    corona: coronaGlow,
    light: arcLight,
    copperMat,
    axisY,
    gapStartZ,
    gapEndZ,
    gapCenterZ,
  };

  return root;
}

// Детерминированный псевдо-рандом для дрожания молнии (стабилен при скрабе слайдером)
const hash01 = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// ============================================================================
// Адаптер под единый просмотрщик: цикл заряда/разряда 6.4 с.
// applyCharge(t, elapsed): накал ВВ-цепи, предпробойная корона, серия пробоев,
// остывание. Возвращает { heat, firing } для телеметрии.
// ============================================================================
export function createWeapon() {
  const root = createWeaponEMI15Razryad();
  const ud = root.userData;
  const fx = ud.arcFX;

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  let lastTick = -1;

  const rebuildBolts = (tick) => {
    fx.bolts.forEach((bolt, bIdx) => {
      const spread = bIdx === 0 ? 0.016 : 0.032;
      const pts = [];
      for (let i = 0; i <= fx.segments; i++) {
        const t = i / fx.segments;
        const envelope = Math.sin(t * Math.PI); // 0 на электродах, максимум в центре зазора
        const jx = (hash01(tick * 91.7 + bIdx * 17.3 + i * 3.1) - 0.5) * 2 * spread * envelope;
        const jy = (hash01(tick * 47.3 + bIdx * 29.7 + i * 7.7) - 0.5) * 2 * spread * envelope;
        pts.push(new THREE.Vector3(jx, fx.axisY + jy, THREE.MathUtils.lerp(fx.gapStartZ, fx.gapEndZ, t)));
      }
      bolt.mesh.geometry.dispose();
      bolt.mesh.geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts), fx.segments * 2, bolt.radius, 6, false
      );
    });
  };

  const setArcLevel = (core, branch, corona, light) => {
    fx.coreMat.emissiveIntensity = core;
    fx.branchMat.emissiveIntensity = branch;
    fx.corona.material.opacity = corona;
    fx.light.intensity = light;
  };

  ud.applyCharge = (t, elapsed) => {
    let heat = 0;
    let firing = false;

    if (t < EMI_CHARGE_END) {
      // Накопление 0..4.2 с: разогрев ВВ-цепи, слабая корона у пика заряда
      heat = t / EMI_CHARGE_END;
      const pre = t > 3.8 ? (t - 3.8) / 0.4 : 0;
      fx.group.visible = pre > 0;
      setArcLevel(1.2 * pre, 0, 0.14 * pre, 0.35 * pre);
      fx.copperMat.emissiveIntensity = heat * 0.55;
      root.position.z = 0;
    } else if (t < EMI_FIRE_START) {
      // Готовность 4.2..5.05 с: полный заряд, нарастающая предпробойная корона
      heat = 1;
      const pre = 0.5 + 0.5 * ((t - EMI_CHARGE_END) / (EMI_FIRE_START - EMI_CHARGE_END));
      fx.group.visible = true;
      setArcLevel(1.2 * pre, 0, 0.14 * pre, 0.35 * pre);
      fx.copperMat.emissiveIntensity = 0.55;
      root.position.z = 0;
    } else if (t < EMI_FIRE_END) {
      // Серия пробоев 5.05..5.50 с: два окна разряда с паузой
      const inFirst = t < 5.28;
      const inSecond = t >= 5.32;
      firing = inFirst || inSecond;
      heat = 1;
      if (firing) {
        const flicker = 0.65 + 0.35 * Math.sin(elapsed * 190.0) * Math.cos(elapsed * 310.0);
        fx.group.visible = true;
        setArcLevel(14.0 * flicker, 9.5 * flicker, 0.55 * flicker, 6.5 * flicker);
        const tick = Math.floor(t / 0.025);
        if (tick !== lastTick) {
          lastTick = tick;
          rebuildBolts(tick);
        }
        const dt01 = (t - EMI_FIRE_START) / (EMI_FIRE_END - EMI_FIRE_START);
        root.position.z = -0.03 * Math.sin(dt01 * Math.PI);
      } else {
        fx.group.visible = true;
        setArcLevel(0.8, 0, 0.1, 0.25);
        root.position.z = 0;
      }
      fx.copperMat.emissiveIntensity = 0.55;
    } else {
      // Остывание 5.50..6.40 с: спад накала цепи
      const k = (t - EMI_FIRE_END) / (EMI_CYCLE - EMI_FIRE_END);
      heat = Math.max(0.12, 1 - k);
      fx.group.visible = false;
      setArcLevel(0, 0, 0, 0);
      fx.copperMat.emissiveIntensity = heat * 0.55;
      root.position.z = 0;
    }

    return { heat: Math.min(1, heat), firing };
  };

  ud.setExtension = (charge01) => {
    const c = Math.max(0, Math.min(1, charge01));
    lastTick = -1;
    fx.group.visible = c > 0.9;
    setArcLevel(c > 0.9 ? 1.2 : 0, 0, c > 0.9 ? 0.14 : 0, c > 0.9 ? 0.35 : 0);
    fx.copperMat.emissiveIntensity = c * 0.55;
    root.position.z = 0;
    return c;
  };

  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  // Совместимость со standalone-логикой builder.update
  ud.update = (elapsedTime) => {
    ud.applyCharge(elapsedTime % EMI_CYCLE, elapsedTime);
  };

  return root;
}
