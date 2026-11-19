import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'a88m',
  code: '2А88',
  title: '2А88 «Кувалда»',
  subtitle: 'ТЯЖЁЛАЯ СПАРЕННАЯ 152-ММ АВТОПУШКА • СЛОТ HEAVY • ЗАЛП / 1.45 С',
  description: 'Тяжёлая спаренная 152-мм автопушка: усиленный фланец УСП, силовая рама с накатниками и пружинами, магазин-барабан на 152-мм выстрелы и откатный блок из двух стволов с многокамерными дульными тормозами. Цикл залпа 1.45 с: резкий откат 0.36 м, гидравлика наката, дульная вспышка.',
  specs: [
    ['Калибр', '2×152 мм'],
    ['Слот', 'HEAVY'],
    ['Откат блока', '0.36 м'],
    ['Темп', 'Залп / 1.45 с'],
    ['Длина модуля', '~4.1 м'],
    ['Питание', 'Барабан БПС/ОФС'],
  ],
  maxExtension: 0.36,
  unit: 'mm',
  tipOffset: 3.24,
  subgroups: [
    { key: 'mountFlange', label: '1. Усиленный фланец УСП' },
    { key: 'heavyCradle', label: '2. Силовая рама и накатники' },
    { key: 'twinHeavyBarrels', label: '3. Блок спаренных стволов' },
  ],
  cameras: {
    module: { pos: [2.85, 1.15, 3.35], target: [0.05, -0.38, 1.05] },
  },
  rangeMarkers: [],
  controls: 'volley',
  volley: {
    mode: 'single',
    shotPeriod: 1.45,
    recoilTime: 0.065,
    holdTime: 0,
    returnTime: 0.615,
    heatPerShot: 0.12,
    coolRate: 0.06,
  },
};

const MAX_RECOIL = 0.36;

/**
 * Создаёт процедурную 3D-модель тяжёлой спаренной 152-мм автопушки 2А88 «Кувалда» (слот HEAVY).
 * Масштаб: 1 unit = 1 метр. Общая длина: ~4.1 м.
 * Ориентация: стволы по +Z, верх по +Y, бок по +X.
 * Точка привязки (0, 0, 0): центр усиленного фланца УСП.
 *
 * @returns {THREE.Group}
 */
export function createWeapon2A88Kuvalda() {
  const root = new THREE.Group();
  root.name = 'Weapon_2A88_Kuvalda';

  // --- ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (CanvasTexture) ---

  // 1. Жёлто-чёрная предупреждающая разметка УСП
  function createHazardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#d99e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#181a1d';
    const stripeWidth = 44;
    for (let x = -128; x < canvas.width + 128; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth - 64, canvas.height);
      ctx.lineTo(x - 64, canvas.height);
      ctx.closePath();
      ctx.fill();
    }

    // Лёгкие потёртости и сколы краски
    for (let i = 0; i < 450; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(108, 114, 120, 0.35)' : 'rgba(20, 22, 25, 0.25)';
      ctx.fillRect(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        2 + Math.random() * 6,
        1 + Math.random() * 3
      );
    }

    // Тёмная окантовка
    ctx.strokeStyle = '#181a1d';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    return tex;
  }

  // 2. Трафаретная маркировка «2А88» для бронебарабана
  function createDrumStencilTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Базовый цвет бронегрунта
    ctx.fillStyle = '#6c7278';
    ctx.fillRect(0, 0, 512, 512);

    // Радиальная фактура и потёртости
    ctx.strokeStyle = 'rgba(42, 46, 50, 0.45)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(256, 256, 232, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(145, 152, 160, 0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(256, 256, 222, 0, Math.PI * 2);
    ctx.stroke();

    // Тактическая полоса
    ctx.fillStyle = 'rgba(218, 162, 32, 0.85)';
    ctx.fillRect(68, 158, 376, 14);
    ctx.fillRect(68, 344, 376, 8);

    // Трафаретный номер «2А88»
    ctx.fillStyle = '#e6e8ea';
    ctx.font = '900 118px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('2А88', 256, 248);

    // Имитация трафаретных перемычек
    ctx.fillStyle = '#6c7278';
    ctx.fillRect(251, 185, 10, 125);
    ctx.fillRect(150, 244, 215, 6);

    // Дополнительная техническая надпись
    ctx.fillStyle = 'rgba(230, 232, 234, 0.85)';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('152 ММ • КУВАЛДА', 256, 316);
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = 'rgba(30, 32, 35, 0.85)';
    ctx.fillText('БОЕКОМПЛЕКТ БПС / ОФС', 256, 374);

    // Следы эксплуатации и царапины
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = i % 3 === 0 ? 'rgba(35, 38, 42, 0.22)' : 'rgba(165, 172, 180, 0.16)';
      ctx.fillRect(
        Math.random() * 512,
        Math.random() * 512,
        1 + Math.random() * 8,
        1 + Math.random() * 3
      );
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // 3. Процедурная карта шероховатости / рельефа катаной брони
  function createArmorBumpTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 2500; i++) {
      const v = 110 + Math.floor(Math.random() * 36);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  const hazardTexture = createHazardTexture();
  const drumStencilTexture = createDrumStencilTexture();
  const armorBumpTexture = createArmorBumpTexture();

  // --- PBR МАТЕРИАЛЫ ---
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x6c7278,
    metalness: 0.45,
    roughness: 0.65,
    bumpMap: armorBumpTexture,
    bumpScale: 0.004,
  });

  const frameDarkMat = new THREE.MeshStandardMaterial({
    color: 0x4b5056,
    metalness: 0.55,
    roughness: 0.58,
    bumpMap: armorBumpTexture,
    bumpScale: 0.003,
  });

  const barrelSteelMat = new THREE.MeshStandardMaterial({
    color: 0x24272b,
    metalness: 0.85,
    roughness: 0.38,
  });

  const sootMat = new THREE.MeshStandardMaterial({
    color: 0x131517,
    metalness: 0.72,
    roughness: 0.62,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xcfd4da,
    metalness: 0.95,
    roughness: 0.15,
  });

  const hoseMat = new THREE.MeshStandardMaterial({
    color: 0x1b1d20,
    metalness: 0.08,
    roughness: 0.85,
  });

  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTexture,
    metalness: 0.35,
    roughness: 0.6,
  });

  const drumFaceMat = new THREE.MeshStandardMaterial({
    map: drumStencilTexture,
    metalness: 0.45,
    roughness: 0.65,
    bumpMap: armorBumpTexture,
    bumpScale: 0.003,
  });

  // Вспомогательная функция для создания фасонных бронеплит со скосами
  function createChamferedBox(w, h, d, bevel = 0.015) {
    const shape = new THREE.Shape();
    const hw = w / 2 - bevel;
    const hh = h / 2 - bevel;
    shape.moveTo(-hw, -hh - bevel);
    shape.lineTo(hw, -hh - bevel);
    shape.lineTo(hw + bevel, -hh);
    shape.lineTo(hw + bevel, hh);
    shape.lineTo(hw, hh + bevel);
    shape.lineTo(-hw, hh + bevel);
    shape.lineTo(-hw - bevel, hh);
    shape.lineTo(-hw - bevel, -hh);
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: d - bevel * 2,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
    });
    geom.center();
    return geom;
  }

  // Вспомогательная функция для витой пружины (TubeGeometry по спирали)
  function createHelicalSpring(radius, length, turns, wireRadius, material) {
    const points = [];
    const totalSamples = Math.max(48, turns * 20);
    for (let i = 0; i <= totalSamples; i++) {
      const t = i / totalSamples;
      const angle = t * turns * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const z = (t - 0.5) * length;
      points.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geom = new THREE.TubeGeometry(curve, totalSamples, wireRadius, 8, false);
    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // ============================================================================
  // 1. УСИЛЕННЫЙ СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange)
  // ============================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Основная плита УСП: 0.70 x 0.16 x 1.15 м с центром в (0, 0, 0)
  const uspMainPlate = new THREE.Mesh(
    createChamferedBox(0.70, 0.16, 1.15, 0.014),
    armorMat
  );
  uspMainPlate.castShadow = true;
  uspMainPlate.receiveShadow = true;
  mountFlange.add(uspMainPlate);

  // Верхний стыковочный гребень / направляющая пилона УСП
  const topGuideRail = new THREE.Mesh(
    createChamferedBox(0.42, 0.045, 0.98, 0.008),
    frameDarkMat
  );
  topGuideRail.position.set(0, 0.095, 0);
  topGuideRail.castShadow = true;
  mountFlange.add(topGuideRail);

  // Силовые поперечные рёбра жёсткости сверху плиты
  for (const zPos of [-0.42, -0.14, 0.14, 0.42]) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.03, 0.045), frameDarkMat);
    rib.position.set(0, 0.088, zPos);
    rib.castShadow = true;
    mountFlange.add(rib);
  }

  // Полосы жёлто-чёрной маркировки вдоль боковых граней УСП
  const sideHazardGeom = new THREE.BoxGeometry(0.008, 0.075, 1.06);
  for (const side of [-1, 1]) {
    const hazardStrip = new THREE.Mesh(sideHazardGeom, hazardMat);
    hazardStrip.position.set(side * 0.351, 0.015, 0);
    mountFlange.add(hazardStrip);
  }

  // Передняя и задняя торцевые полосы разметки УСП
  const endHazardGeom = new THREE.BoxGeometry(0.62, 0.065, 0.008);
  for (const end of [-1, 1]) {
    const endStrip = new THREE.Mesh(endHazardGeom, hazardMat);
    endStrip.position.set(0, 0.01, end * 0.576);
    mountFlange.add(endStrip);
  }

  // 6 гидрозамков (по 3 с каждого борта плиты УСП)
  const lockZPositions = [-0.36, 0.0, 0.36];
  for (const side of [-1, 1]) {
    for (const zPos of lockZPositions) {
      const lockGroup = new THREE.Group();
      lockGroup.position.set(side * 0.35, -0.025, zPos);

      // Бронекорпус гидрозамка
      const housing = new THREE.Mesh(
        createChamferedBox(0.095, 0.11, 0.14, 0.008),
        frameDarkMat
      );
      housing.position.x = side * 0.025;
      housing.castShadow = true;
      lockGroup.add(housing);

      // Силовой цилиндр привода замка
      const actuator = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.12, 14),
        barrelSteelMat
      );
      actuator.rotation.x = Math.PI / 2;
      actuator.position.set(side * 0.055, -0.015, 0);
      lockGroup.add(actuator);

      // Хромированный запорный шток/ригель
      const lockPin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.07, 12),
        chromeMat
      );
      lockPin.position.set(side * 0.035, 0.068, 0);
      lockGroup.add(lockPin);

      // Защитная скоба
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.018, 0.15),
        armorMat
      );
      guard.position.set(side * 0.03, -0.055, 0);
      lockGroup.add(guard);

      mountFlange.add(lockGroup);
    }
  }

  // ============================================================================
  // 2. СИЛОВАЯ РАМА И ПРОТИВООТКАТНЫЙ БЛОК (heavyCradle)
  // ============================================================================
  const heavyCradle = new THREE.Group();
  heavyCradle.name = 'heavyCradle';
  root.add(heavyCradle);

  // Ось стволов проходит на высоте y = -0.46 м
  const BORE_Y = -0.46;

  // Переходная силовая горловина под фланцем УСП (y: -0.08 .. -0.22)
  const neckMount = new THREE.Mesh(
    createChamferedBox(0.58, 0.15, 0.96, 0.012),
    frameDarkMat
  );
  neckMount.position.set(0, -0.145, -0.05);
  neckMount.castShadow = true;
  neckMount.receiveShadow = true;
  heavyCradle.add(neckMount);

  // Массивный задний бронеблок казённика и автоматики (z: -0.85 .. +0.35)
  const mainBreechBlock = new THREE.Mesh(
    createChamferedBox(0.64, 0.56, 1.20, 0.024),
    armorMat
  );
  mainBreechBlock.position.set(0, -0.46, -0.25);
  mainBreechBlock.castShadow = true;
  mainBreechBlock.receiveShadow = true;
  heavyCradle.add(mainBreechBlock);

  // Задний бронеколпак затыльника с рёбрами (доводит задний габарит до z = -0.85)
  const rearCap = new THREE.Mesh(
    createChamferedBox(0.54, 0.44, 0.16, 0.018),
    frameDarkMat
  );
  rearCap.position.set(0, -0.45, -0.82);
  rearCap.castShadow = true;
  heavyCradle.add(rearCap);

  // Верхний бронекожух над казённой частью
  const topArmorHood = new THREE.Mesh(
    createChamferedBox(0.56, 0.12, 1.05, 0.016),
    armorMat
  );
  topArmorHood.position.set(0, -0.19, -0.20);
  topArmorHood.castShadow = true;
  heavyCradle.add(topArmorHood);

  // Боковые накладные бронеплиты с болтовыми соединениями
  for (const side of [-1, 1]) {
    const sidePlate = new THREE.Mesh(
      createChamferedBox(0.05, 0.42, 0.92, 0.01),
      armorMat
    );
    sidePlate.position.set(side * 0.335, -0.46, -0.22);
    sidePlate.castShadow = true;
    sidePlate.receiveShadow = true;
    heavyCradle.add(sidePlate);

    // Окно экстракции гильз / сервисный люк
    const hatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.16, 0.34),
      frameDarkMat
    );
    hatch.position.set(side * 0.358, -0.42, -0.15);
    heavyCradle.add(hatch);
  }

  // Открытые силовые балки люльки (z: +0.32 .. +1.36)
  const beamLength = 1.06;
  const beamZCenter = 0.84;

  // Верхние и нижние продольные двутавровые/коробчатые балки рамы
  const girderOffsets = [
    { x: -0.29, y: -0.22 },
    { x: 0.29, y: -0.22 },
    { x: -0.29, y: -0.70 },
    { x: 0.29, y: -0.70 },
  ];

  for (const pos of girderOffsets) {
    const girder = new THREE.Mesh(
      createChamferedBox(0.075, 0.085, beamLength, 0.008),
      frameDarkMat
    );
    girder.position.set(pos.x, pos.y, beamZCenter);
    girder.castShadow = true;
    girder.receiveShadow = true;
    heavyCradle.add(girder);
  }

  // Диагональные и вертикальные раскосы открытой силовой рамы
  for (const side of [-1, 1]) {
    for (const zBrace of [0.52, 0.92, 1.28]) {
      const verticalStrut = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.48, 0.07),
        armorMat
      );
      verticalStrut.position.set(side * 0.29, -0.46, zBrace);
      verticalStrut.castShadow = true;
      heavyCradle.add(verticalStrut);
    }

    // Диагональная силовая ферма
    const diagStrut = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.065, 0.56),
      frameDarkMat
    );
    diagStrut.position.set(side * 0.285, -0.46, 0.72);
    diagStrut.rotation.x = 0.72;
    diagStrut.castShadow = true;
    heavyCradle.add(diagStrut);
  }

  // Передний силовой траверс-бугель люльки (z = 1.32)
  const frontYoke = new THREE.Mesh(
    createChamferedBox(0.68, 0.56, 0.13, 0.015),
    armorMat
  );
  frontYoke.position.set(0, -0.46, 1.32);
  frontYoke.castShadow = true;
  frontYoke.receiveShadow = true;
  heavyCradle.add(frontYoke);

  // Нижняя силовая плита рамы
  const bottomSkidPlate = new THREE.Mesh(
    createChamferedBox(0.54, 0.05, 1.02, 0.008),
    frameDarkMat
  );
  bottomSkidPlate.position.set(0, -0.725, 0.82);
  bottomSkidPlate.castShadow = true;
  heavyCradle.add(bottomSkidPlate);

  // 4 мощных гидроцилиндра накатников (вокруг ствольного блока)
  const cylinderCoords = [
    { x: -0.22, y: -0.28 },
    { x: 0.22, y: -0.28 },
    { x: -0.22, y: -0.64 },
    { x: 0.22, y: -0.64 },
  ];

  for (const c of cylinderCoords) {
    const cylGroup = new THREE.Group();
    cylGroup.position.set(c.x, c.y, 0.56);

    // Внешний толстостенный корпус гидроцилиндра
    const outerBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056, 0.056, 0.84, 18),
      barrelSteelMat
    );
    outerBody.rotation.x = Math.PI / 2;
    outerBody.castShadow = true;
    cylGroup.add(outerBody);

    // Передний и задний фланцы цилиндра
    for (const zCap of [-0.41, 0.41]) {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.068, 0.055, 18),
        armorMat
      );
      cap.rotation.x = Math.PI / 2;
      cap.position.z = zCap;
      cylGroup.add(cap);
    }

    // Хромированный шток накатника, уходящий к передней траверсе
    const pistonRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.72, 16),
      chromeMat
    );
    pistonRod.rotation.x = Math.PI / 2;
    pistonRod.position.z = 0.56;
    pistonRod.castShadow = true;
    cylGroup.add(pistonRod);

    heavyCradle.add(cylGroup);
  }

  // Внешние витые пружины амортизации по бокам люльки
  for (const side of [-1, 1]) {
    const springX = side * 0.365;
    const springY = -0.46;
    const springZ = 0.74;

    // Внутренний направляющий стержень пружины
    const guideRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.76, 12),
      chromeMat
    );
    guideRod.rotation.x = Math.PI / 2;
    guideRod.position.set(springX, springY, springZ);
    heavyCradle.add(guideRod);

    // Опорные чашки пружины
    for (const zCup of [springZ - 0.36, springZ + 0.36]) {
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.062, 0.062, 0.032, 16),
        frameDarkMat
      );
      cup.rotation.x = Math.PI / 2;
      cup.position.set(springX, springY, zCup);
      heavyCradle.add(cup);
    }

    // Сама витая пружина (TubeGeometry)
    const coilSpring = createHelicalSpring(0.048, 0.68, 11, 0.011, barrelSteelMat);
    coilSpring.position.set(springX, springY, springZ);
    heavyCradle.add(coilSpring);
  }

  // Толстые провисающие гидравлические шланги снизу (TubeGeometry)
  const hoseRoutes = [
    [
      new THREE.Vector3(-0.18, -0.72, -0.58),
      new THREE.Vector3(-0.22, -0.89, -0.15),
      new THREE.Vector3(-0.20, -0.92, 0.42),
      new THREE.Vector3(-0.18, -0.73, 0.96),
    ],
    [
      new THREE.Vector3(-0.08, -0.73, -0.64),
      new THREE.Vector3(-0.10, -0.94, -0.05),
      new THREE.Vector3(-0.09, -0.91, 0.55),
      new THREE.Vector3(-0.11, -0.72, 1.15),
    ],
    [
      new THREE.Vector3(0.08, -0.73, -0.64),
      new THREE.Vector3(0.11, -0.95, -0.02),
      new THREE.Vector3(0.09, -0.90, 0.58),
      new THREE.Vector3(0.12, -0.72, 1.15),
    ],
    [
      new THREE.Vector3(0.18, -0.72, -0.58),
      new THREE.Vector3(0.24, -0.88, -0.12),
      new THREE.Vector3(0.21, -0.91, 0.44),
      new THREE.Vector3(0.18, -0.73, 0.96),
    ],
    // Боковой питающий шланг высокого давления к правому узлу
    [
      new THREE.Vector3(0.26, -0.66, -0.45),
      new THREE.Vector3(0.39, -0.82, -0.08),
      new THREE.Vector3(0.34, -0.76, 0.35),
      new THREE.Vector3(0.24, -0.66, 0.62),
    ],
  ];

  for (const pts of hoseRoutes) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const hoseGeom = new THREE.TubeGeometry(curve, 36, 0.024, 10, false);
    const hoseMesh = new THREE.Mesh(hoseGeom, hoseMat);
    hoseMesh.castShadow = true;
    heavyCradle.add(hoseMesh);

    // Металлические обжимные фитинги на концах шланга
    for (const endPt of [pts[0], pts[pts.length - 1]]) {
      const fitting = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.06, 12),
        chromeMat
      );
      fitting.position.copy(endPt);
      heavyCradle.add(fitting);
    }
  }

  // Сбоку (+X) — крупный бронированный магазин-барабан с трафаретным номером «2А88»
  const drumGroup = new THREE.Group();
  drumGroup.name = 'armoredDrumMagazine';
  drumGroup.position.set(0.56, -0.45, -0.24);
  heavyCradle.add(drumGroup);

  const drumRadius = 0.35;
  const drumWidth = 0.34;

  // Основной бронецилиндр барабана (ось по X)
  const drumBody = new THREE.Mesh(
    new THREE.CylinderGeometry(drumRadius, drumRadius, drumWidth, 32),
    armorMat
  );
  drumBody.rotation.z = Math.PI / 2;
  drumBody.castShadow = true;
  drumBody.receiveShadow = true;
  drumGroup.add(drumBody);

  // Силовые обода по краям барабана
  for (const xRim of [-drumWidth / 2 + 0.025, drumWidth / 2 - 0.025]) {
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(drumRadius + 0.018, drumRadius + 0.018, 0.045, 32),
      frameDarkMat
    );
    rim.rotation.z = Math.PI / 2;
    rim.position.x = xRim;
    rim.castShadow = true;
    drumGroup.add(rim);
  }

  // Внешняя торцевая бронекрышка с трафаретом «2А88»
  const drumCapDisc = new THREE.Mesh(
    new THREE.CircleGeometry(drumRadius - 0.01, 32),
    drumFaceMat
  );
  drumCapDisc.rotation.y = Math.PI / 2;
  drumCapDisc.position.x = drumWidth / 2 + 0.002;
  drumGroup.add(drumCapDisc);

  // Центральная ступица-замок барабана
  const drumHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.075, 0.035, 16),
    frameDarkMat
  );
  drumHub.rotation.z = Math.PI / 2;
  drumHub.position.x = drumWidth / 2 + 0.015;
  drumGroup.add(drumHub);

  // Бронированный рукав подачи снарядов от барабана к приёмнику пушки
  const feedChute = new THREE.Mesh(
    createChamferedBox(0.28, 0.24, 0.36, 0.014),
    frameDarkMat
  );
  feedChute.position.set(-0.18, 0.06, 0.02);
  feedChute.rotation.z = -0.22;
  feedChute.castShadow = true;
  drumGroup.add(feedChute);

  // Противоположный борт (-X): гидроаккумулятор и радиатор охлаждения привода
  const leftModule = new THREE.Mesh(
    createChamferedBox(0.14, 0.34, 0.56, 0.014),
    frameDarkMat
  );
  leftModule.position.set(-0.40, -0.45, -0.26);
  leftModule.castShadow = true;
  heavyCradle.add(leftModule);

  // ============================================================================
  // 3. БЛОК СПАРЕННЫХ ОРУДИЙ (twinHeavyBarrels — группа для отката по -Z)
  // ============================================================================
  const twinHeavyBarrels = new THREE.Group();
  twinHeavyBarrels.name = 'twinHeavyBarrels';
  root.add(twinHeavyBarrels);

  // Разнос стволов по X на 0.28 м (-0.14 и +0.14)
  const BARREL_OFFSET_X = 0.14;

  // Откатная салазка-траверса в задней части блока стволов (ходит внутри люльки)
  const recoilSled = new THREE.Mesh(
    createChamferedBox(0.46, 0.34, 0.36, 0.012),
    frameDarkMat
  );
  recoilSled.position.set(0, BORE_Y, 0.36);
  recoilSled.castShadow = true;
  twinHeavyBarrels.add(recoilSled);

  // Массивная стальная обойма посередине стволов (z = 1.62)
  const midClampGroup = new THREE.Group();
  midClampGroup.name = 'midBarrelClamp';
  midClampGroup.position.set(0, BORE_Y, 1.62);
  twinHeavyBarrels.add(midClampGroup);

  // Центральная силовая перемычка обоймы
  const clampBridge = new THREE.Mesh(
    createChamferedBox(0.50, 0.25, 0.22, 0.012),
    frameDarkMat
  );
  clampBridge.castShadow = true;
  clampBridge.receiveShadow = true;
  midClampGroup.add(clampBridge);

  // Усиленные кольца обоймы вокруг каждого ствола + стяжные болты
  for (const side of [-1, 1]) {
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.132, 0.132, 0.24, 24),
      armorMat
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.x = side * BARREL_OFFSET_X;
    collar.castShadow = true;
    midClampGroup.add(collar);

    // Стяжные болты обоймы сверху и снизу
    for (const yBolt of [-0.135, 0.135]) {
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.04, 6),
        chromeMat
      );
      bolt.position.set(side * BARREL_OFFSET_X, yBolt, 0);
      midClampGroup.add(bolt);
    }
  }

  // Построение каждого из двух 152-мм стволов с многокамерным дульным тормозом
  for (const side of [-1, 1]) {
    const barrelAssembly = new THREE.Group();
    barrelAssembly.position.set(side * BARREL_OFFSET_X, BORE_Y, 0);
    twinHeavyBarrels.add(barrelAssembly);

    // Профиль ствола (LatheGeometry вдоль Y, затем поворот по X на +90°)
    // Координаты Y в профиле соответствуют координате Z в локальной системе ствола
    const lathePoints = [
      new THREE.Vector2(0.052, -0.25), // Внутренний канал казённика
      new THREE.Vector2(0.118, -0.25), // Утолщённый казённый кожух
      new THREE.Vector2(0.118, 0.55),
      new THREE.Vector2(0.105, 0.62),  // Переходный конус
      new THREE.Vector2(0.105, 1.38),  // Опорная зона люльки
      new THREE.Vector2(0.092, 1.42),
      new THREE.Vector2(0.092, 1.88),
      new THREE.Vector2(0.116, 1.93),  // Эжектор пороховых газов
      new THREE.Vector2(0.116, 2.22),
      new THREE.Vector2(0.086, 2.27),
      new THREE.Vector2(0.078, 2.74),  // Дульная часть ствола до тормоза
      new THREE.Vector2(0.052, 2.74),  // Внутренний радиус канала ствола
      new THREE.Vector2(0.052, -0.25),
    ];

    const barrelGeom = new THREE.LatheGeometry(lathePoints, 28);
    barrelGeom.rotateX(Math.PI / 2);
    const barrelMesh = new THREE.Mesh(barrelGeom, barrelSteelMat);
    barrelMesh.castShadow = true;
    barrelMesh.receiveShadow = true;
    barrelAssembly.add(barrelMesh);

    // Дульный срез (тёмный закопчённый канал внутри)
    const boreDarkPlug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.051, 0.051, 0.25, 20),
      sootMat
    );
    boreDarkPlug.rotation.x = Math.PI / 2;
    boreDarkPlug.position.z = 2.65;
    barrelAssembly.add(boreDarkPlug);

    // Крупный прямоугольный многокамерный щелевой дульный тормоз (z: 2.73 .. 3.24 м)
    const muzzleBrake = new THREE.Group();
    muzzleBrake.name = side < 0 ? 'muzzleBrakeLeft' : 'muzzleBrakeRight';
    muzzleBrake.position.set(0, 0, 2.73);
    barrelAssembly.add(muzzleBrake);

    const mbWidth = 0.22;
    const mbHeight = 0.24;
    const mbLength = 0.51;

    // Задняя соединительная муфта дульного тормоза
    const mbCollar = new THREE.Mesh(
      createChamferedBox(mbWidth, mbHeight, 0.08, 0.012),
      barrelSteelMat
    );
    mbCollar.position.z = 0.04;
    mbCollar.castShadow = true;
    muzzleBrake.add(mbCollar);

    // Верхняя и нижняя сплошные бронеплиты дульного тормоза
    for (const yCap of [-mbHeight / 2 + 0.022, mbHeight / 2 - 0.022]) {
      const capPlate = new THREE.Mesh(
        createChamferedBox(mbWidth, 0.044, mbLength, 0.008),
        barrelSteelMat
      );
      capPlate.position.set(0, yCap, mbLength / 2);
      capPlate.castShadow = true;
      capPlate.receiveShadow = true;
      muzzleBrake.add(capPlate);
    }

    // 3 поперечные перегородки-отражатели (образуют 3 щелевые камеры с боковыми окнами)
    const baffleZPositions = [0.20, 0.34, 0.475];
    for (let i = 0; i < baffleZPositions.length; i++) {
      const zBaffle = baffleZPositions[i];

      // Основная стальная перегородка
      const baffle = new THREE.Mesh(
        createChamferedBox(mbWidth, mbHeight - 0.03, 0.058, 0.006),
        barrelSteelMat
      );
      baffle.position.set(0, 0, zBaffle);
      baffle.castShadow = true;
      muzzleBrake.add(baffle);

      // Закопчённые внутренние поверхности боковых окон камеры
      const sootInsert = new THREE.Mesh(
        new THREE.BoxGeometry(mbWidth - 0.035, mbHeight - 0.088, 0.062),
        sootMat
      );
      sootInsert.position.set(0, 0, zBaffle);
      muzzleBrake.add(sootInsert);
    }

    // Внутренний центральный сердечник с копотью и пулевым каналом между перегородками
    const innerChamberCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, mbLength - 0.06, 18),
      sootMat
    );
    innerChamberCore.rotation.x = Math.PI / 2;
    innerChamberCore.position.z = mbLength / 2;
    muzzleBrake.add(innerChamberCore);

    // Чёрное выходное отверстие дульного среза (152 мм)
    const muzzleExitHole = new THREE.Mesh(
      new THREE.CircleGeometry(0.056, 20),
      sootMat
    );
    muzzleExitHole.position.z = mbLength + 0.002;
    muzzleBrake.add(muzzleExitHole);
  }

  return root;
}

// ============================================================================
// СЦЕНА, ORBITCONTROLS И ЦИКЛ ВЫСТРЕЛА С ГЛУБОКИМ ОТКАТОМ
// (автономный стенд; во вьювере не вызывается —
// движок index.html сам ставит свет, пол и анимацию залпа).
// ============================================================================
function initScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.backgroundColor = '#14171a';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16191d);
  scene.fog = new THREE.FogExp2(0x16191d, 0.045);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(2.85, 1.15, 3.35);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.05, -0.38, 1.05);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.2;
  controls.maxDistance = 14;
  controls.update();

  // Освещение ангара / полигона
  const hemiLight = new THREE.HemisphereLight(0xdce6f2, 0x2b3036, 0.85);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff4e4, 2.4);
  keyLight.position.set(4.5, 6.0, 5.0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 20;
  keyLight.shadow.camera.left = -4;
  keyLight.shadow.camera.right = 4;
  keyLight.shadow.camera.top = 4;
  keyLight.shadow.camera.bottom = -4;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x7aa6d8, 1.1);
  rimLight.position.set(-5.0, 2.5, -3.5);
  scene.add(rimLight);

  // Пол стенда и масштабная сетка (1 клетка = 1 метр)
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x1c2024, roughness: 0.88, metalness: 0.15 })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -1.65;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  const grid = new THREE.GridHelper(20, 20, 0x454d56, 0x282d33);
  grid.position.y = -1.648;
  scene.add(grid);

  // Инстанцирование автопушки 2А88 «Кувалда»
  const weapon = createWeapon2A88Kuvalda();
  scene.add(weapon);

  const twinHeavyBarrels = weapon.getObjectByName('twinHeavyBarrels');

  // Вспышка выстрела (PointLight + геометрия пламени)
  const muzzleLight = new THREE.PointLight(0xff9b38, 0, 7.5);
  muzzleLight.position.set(0, -0.46, 3.45);
  weapon.add(muzzleLight);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffb84d,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flashCone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.85, 16), flashMat);
  flashCone.rotation.x = Math.PI / 2;
  flashCone.position.set(0, -0.46, 3.65);
  weapon.add(flashCone);

  // Параметры цикла выстрела и глубокого отката
  const FIRE_INTERVAL = 1.45; // секунд между залпами
  const MAX_RECOIL = 0.36;    // глубина отката стволов по -Z (м)
  let cycleTimer = 0.35;

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.05);
    cycleTimer = (cycleTimer + dt) % FIRE_INTERVAL;

    let recoilOffset = 0;
    let flashIntensity = 0;

    if (cycleTimer < 0.065) {
      // Фаза 1: резкий ударный откат назад по -Z
      const p = cycleTimer / 0.065;
      const easeOut = 1 - Math.pow(1 - p, 3);
      recoilOffset = MAX_RECOIL * easeOut;
      flashIntensity = Math.max(0, 1 - cycleTimer / 0.055);
    } else if (cycleTimer < 0.68) {
      // Фаза 2: плавный гидравлический накат обратно вперёд
      const p = (cycleTimer - 0.065) / (0.68 - 0.065);
      const easeInOut = 1 - (1 - Math.cos(p * Math.PI)) * 0.5;
      recoilOffset = MAX_RECOIL * easeInOut;
    }

    if (twinHeavyBarrels) {
      twinHeavyBarrels.position.z = -recoilOffset;
    }

    // Лёгкая передача импульса на корпус оружия
    weapon.position.z = -recoilOffset * 0.08;
    weapon.rotation.x = -recoilOffset * 0.025;

    // Вспышка у дульных тормозов
    muzzleLight.intensity = flashIntensity * 18;
    flashMat.opacity = flashIntensity * 0.85;
    flashCone.scale.setScalar(0.8 + flashIntensity * 0.45);

    controls.update();
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
}

// initScene(); // Автономный стенд: раскомментировать только вне просмотрщика.

// =========================================================================
// Адаптер под единый просмотрщик: залп спаренных стволов, откат 0..0.36 м.
// applyVolley(t): поза цикла (откат → накат), вспышка, импульс корпуса.
// Возвращает { recoil, flash }.
// =========================================================================
export function createWeapon() {
  const root = createWeapon2A88Kuvalda();
  const ud = root.userData;
  const twin = root.getObjectByName('twinHeavyBarrels');

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffb84d,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flashCone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.85, 16), flashMat);
  flashCone.rotation.x = Math.PI / 2;
  flashCone.position.set(0, -0.46, 3.65);
  root.add(flashCone);

  const flashLight = new THREE.PointLight(0xff9b38, 0, 7.5);
  flashLight.position.set(0, -0.46, 3.45);
  root.add(flashLight);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  const pose = (t) => {
    let off = 0;
    let fl = 0;
    if (t < 0.065) {
      const p = t / 0.065;
      off = MAX_RECOIL * (1 - Math.pow(1 - p, 3));
      fl = Math.max(0, 1 - t / 0.055);
    } else if (t < 0.68) {
      const p = (t - 0.065) / (0.68 - 0.065);
      off = MAX_RECOIL * (1 - (1 - Math.cos(p * Math.PI)) * 0.5);
    }
    twin.position.z = -off;
    root.position.z = -off * 0.08;
    root.rotation.x = -off * 0.025;
    flashLight.intensity = fl * 18;
    flashMat.opacity = fl * 0.85;
    flashCone.scale.setScalar(0.8 + fl * 0.45);
    return { recoil: off, flash: fl };
  };

  ud.twinBarrels = twin;
  ud.applyVolley = (t) => {
    if (t === null || t === undefined || t > 10) {
      twin.position.z = 0;
      root.position.z = 0;
      root.rotation.x = 0;
      flashLight.intensity = 0;
      flashMat.opacity = 0;
      flashCone.scale.setScalar(0.8);
      return { recoil: 0, flash: 0 };
    }
    return pose(t);
  };
  ud.setExtension = (recoil) => {
    const r = Math.max(0, Math.min(MAX_RECOIL, recoil));
    twin.position.z = -r;
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
