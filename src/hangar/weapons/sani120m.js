import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'sani',
  code: '2Б11',
  title: '2Б11 «Сани-М»',
  subtitle: 'ТЯЖЁЛЫЙ 120-ММ АВТОМАТИЧЕСКИЙ МИНОМЁТ • СЛОТ MAIN • ВЫСТРЕЛ / 3.2 С',
  description: 'Тяжёлый 120-мм автоматический миномёт: фланец УСП с демпферами, качающаяся люлька с гидronакатами и кассетным лотком на 3 мины, гладкоствольный ствол под 35° с трёхкамерным ДТК. Откат 270 мм вдоль оси ствола, дульная вспышка.',
  specs: [
    ['Калибр', '120 мм, гладкоствольный'],
    ['Возвышение', '35° фиксированное'],
    ['Откат ствола', '270 мм'],
    ['Темп', 'Выстрел / 3.2 с'],
    ['Подача', 'Кассета, 3 мины 7П39'],
    ['Слот', 'MAIN'],
  ],
  maxExtension: 0.27,
  unit: 'mm',
  tipOffset: 2.45,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'mortarCarriage', label: '2. Люлька и накатники' },
    { key: 'mortarTubeGroup', label: '3. Ствол-мортира и ДТК' },
  ],
  cameras: {
    module: { pos: [3.2, 1.9, 3.1], target: [0, 0.95, 0.75] },
  },
  rangeMarkers: [],
  controls: 'volley',
  volley: {
    mode: 'single',
    shotPeriod: 3.2,
    recoilTime: 0.065,
    holdTime: 0,
    returnTime: 0.78,
    heatPerShot: 0.1,
    coolRate: 0.08,
    single: true,
  },
  drive: {
    title: 'Затвор и накат',
    caption: 'ОТКАТ СТВОЛА',
    fire: 'ВЫСТРЕЛ',
  },
};

const MAX_RECOIL = 0.27;
const RET_TIME = 0.065;
const RETURN_TIME = 0.78;

// Ось ствола: вперёд и вверх под углом 35° в плоскости +Z/+Y
const BARREL_AXIS = new THREE.Vector3(0, Math.sin(35 * Math.PI / 180), Math.cos(35 * Math.PI / 180));

/**
 * Создаёт процедурную 3D-модель тяжёлого 120-мм автоматического миномётного комплекса 2Б11 «Сани-М»
 * Единицы измерения: 1 unit = 1 метр.
 * Точка привязки (0, 0, 0): центр усиленного фланца УСП.
 * Ориентация: корневая группа по +Z, ось ствола направлена вперёд и вверх под углом 35° в плоскости +Z / +Y.
 *
 * @returns {THREE.Group}
 */
export function createWeapon2B11SaniM() {
  const root = new THREE.Group();
  root.name = 'Weapon2B11SaniM';

  const ELEVATION_DEG = 35;
  const ELEVATION_RAD = THREE.MathUtils.degToRad(ELEVATION_DEG);
  const PIVOT_POS = new THREE.Vector3(0, 0.54, 0.02);

  // --- ПРОЦЕДУРНЫЕ ТЕКСТУРЫ ---
  function createHazardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Жёлтый индустриальный фон
    ctx.fillStyle = '#d49b1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Чёрные диагональные полосы
    ctx.fillStyle = '#181a1c';
    const stripeW = 32;
    for (let x = -128; x < canvas.width + 128; x += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW - 64, canvas.height);
      ctx.lineTo(x - 64, canvas.height);
      ctx.closePath();
      ctx.fill();
    }

    // Центральная плашка под трафаретную маркировку
    ctx.fillStyle = '#232722';
    ctx.fillRect(116, 22, 280, 84);
    ctx.strokeStyle = '#d49b1a';
    ctx.lineWidth = 4;
    ctx.strokeRect(116, 22, 280, 84);

    // Советский трафаретный шрифт
    ctx.fillStyle = '#e5e2d9';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('УСП-120 // 2Б11-М', 256, 50);

    ctx.fillStyle = '#d49b1a';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('ОПАСНО • ЗОНА ОТКАТА', 256, 82);

    // Лёгкий шум износа
    for (let i = 0; i < 1800; i++) {
      const rx = Math.random() * canvas.width;
      const ry = Math.random() * canvas.height;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(rx, ry, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  function createMicroGrainBump() {
    const size = 128;
    const data = new Uint8Array(size * size);
    for (let i = 0; i < data.length; i++) {
      data[i] = 110 + Math.floor(Math.random() * 36);
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    tex.needsUpdate = true;
    return tex;
  }

  const grainBump = createMicroGrainBump();
  const hazardTex = createHazardTexture();

  // --- PBR МАТЕРИАЛЫ ---
  const khakiMat = new THREE.MeshStandardMaterial({
    color: 0x4b5346,
    metalness: 0.45,
    roughness: 0.65,
    bumpMap: grainBump,
    bumpScale: 0.0025
  });

  const darkKhakiMat = new THREE.MeshStandardMaterial({
    color: 0x383f34,
    metalness: 0.50,
    roughness: 0.68,
    bumpMap: grainBump,
    bumpScale: 0.003
  });

  const bluedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x26292e,
    metalness: 0.85,
    roughness: 0.35,
    bumpMap: grainBump,
    bumpScale: 0.0015
  });

  const boreDarkMat = new THREE.MeshStandardMaterial({
    color: 0x0b0c0e,
    metalness: 0.6,
    roughness: 0.7
  });

  const aluminumMat = new THREE.MeshStandardMaterial({
    color: 0x8b9299,
    metalness: 0.75,
    roughness: 0.40
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd8dee6,
    metalness: 0.95,
    roughness: 0.14
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xb58938,
    metalness: 0.85,
    roughness: 0.32
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c1e,
    metalness: 0.10,
    roughness: 0.88
  });

  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    metalness: 0.35,
    roughness: 0.55
  });

  // Вспомогательная фабрика мешей с тенями
  function makeMesh(geo, mat, name = '') {
    const m = new THREE.Mesh(geo, mat);
    if (name) m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Основная массивная плита УСП: 0.70 x 0.16 x 1.10 м, центр в (0, 0, 0)
  const uspCore = makeMesh(new THREE.BoxGeometry(0.64, 0.14, 1.04), darkKhakiMat, 'uspCorePlate');
  mountFlange.add(uspCore);

  // Верхняя и нижняя силовые накладки фланца (полный габарит 0.70 x 0.16 x 1.10)
  const uspTopDeck = makeMesh(new THREE.BoxGeometry(0.70, 0.025, 1.10), khakiMat, 'uspTopDeck');
  uspTopDeck.position.y = 0.0675;
  mountFlange.add(uspTopDeck);

  const uspBottomDeck = makeMesh(new THREE.BoxGeometry(0.70, 0.025, 1.10), khakiMat, 'uspBottomDeck');
  uspBottomDeck.position.y = -0.0675;
  mountFlange.add(uspBottomDeck);

  // Полосы жёлто-чёрной маркировки на бортах и торцах плиты УСП
  const sideHazardGeo = new THREE.BoxGeometry(0.012, 0.095, 0.96);
  const leftHazard = makeMesh(sideHazardGeo, hazardMat, 'hazardStripeLeft');
  leftHazard.position.set(-0.324, 0, 0);
  mountFlange.add(leftHazard);

  const rightHazard = makeMesh(sideHazardGeo, hazardMat, 'hazardStripeRight');
  rightHazard.position.set(0.324, 0, 0);
  mountFlange.add(rightHazard);

  const frontHazard = makeMesh(new THREE.BoxGeometry(0.58, 0.095, 0.012), hazardMat, 'hazardStripeFront');
  frontHazard.position.set(0, 0, 0.524);
  mountFlange.add(frontHazard);

  // 6 силовых замков УСП (по 3 на левом и правом бортах)
  const lockZPositions = [-0.36, 0.0, 0.36];
  for (const side of [-1, 1]) {
    lockZPositions.forEach((zPos, idx) => {
      const lockGroup = new THREE.Group();
      lockGroup.name = `uspLock_${side > 0 ? 'R' : 'L'}_${idx + 1}`;
      lockGroup.position.set(side * 0.355, 0, zPos);

      // Корпус замка
      const housing = makeMesh(new THREE.BoxGeometry(0.06, 0.12, 0.15), bluedSteelMat);
      lockGroup.add(housing);

      // Эксцентриковый рычаг-фиксатор
      const latch = makeMesh(new THREE.BoxGeometry(0.035, 0.15, 0.05), chromeMat);
      latch.position.set(side * 0.022, 0.01, 0);
      latch.rotation.z = side * -0.18;
      lockGroup.add(latch);

      // Силовые болты крепления
      for (const bz of [-0.045, 0.045]) {
        const bolt = makeMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.075, 6), bluedSteelMat);
        bolt.rotation.z = Math.PI / 2;
        bolt.position.set(0, 0.035, bz);
        lockGroup.add(bolt);
      }

      mountFlange.add(lockGroup);
    });
  }

  // 4 демпфирующие эластомерные подушки между плитой УСП и основанием лафета
  const padCoords = [
    [-0.22, -0.34],
    [0.22, -0.34],
    [-0.22, 0.34],
    [0.22, 0.34]
  ];
  padCoords.forEach(([px, pz], i) => {
    const padGroup = new THREE.Group();
    padGroup.name = `dampingPad_${i + 1}`;
    padGroup.position.set(px, 0.105, pz);

    const rubberBlock = makeMesh(new THREE.BoxGeometry(0.16, 0.05, 0.22), rubberMat);
    padGroup.add(rubberBlock);

    // Стальные обоймы демпфера
    const topCap = makeMesh(new THREE.BoxGeometry(0.175, 0.014, 0.235), bluedSteelMat);
    topCap.position.y = 0.026;
    padGroup.add(topCap);

    const botCap = makeMesh(new THREE.BoxGeometry(0.175, 0.014, 0.235), bluedSteelMat);
    botCap.position.y = -0.026;
    padGroup.add(botCap);

    mountFlange.add(padGroup);
  });

  // Подрамник и вертикальные стойки цапф (неподвижная часть лафета на фланце)
  const subFrame = makeMesh(new THREE.BoxGeometry(0.58, 0.045, 0.92), khakiMat, 'carriageSubFrame');
  subFrame.position.set(0, 0.155, 0);
  mountFlange.add(subFrame);

  for (const side of [-1, 1]) {
    const cheek = makeMesh(new THREE.BoxGeometry(0.055, 0.42, 0.44), khakiMat, `trunnionCheek_${side > 0 ? 'R' : 'L'}`);
    cheek.position.set(side * 0.24, 0.36, 0.02);
    mountFlange.add(cheek);

    // Косынки жёсткости стоек
    const gusset = makeMesh(new THREE.BoxGeometry(0.022, 0.28, 0.24), darkKhakiMat);
    gusset.position.set(side * 0.275, 0.28, 0.14);
    gusset.rotation.x = -0.45;
    mountFlange.add(gusset);

    // Ось цапфы
    const trunnionPin = makeMesh(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 16), bluedSteelMat);
    trunnionPin.rotation.z = Math.PI / 2;
    trunnionPin.position.set(side * 0.255, PIVOT_POS.y, PIVOT_POS.z);
    mountFlange.add(trunnionPin);
  }

  // Сектор механизма вертикального наведения
  const elevSector = makeMesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.025, 24, 1, false, -0.3, 1.3),
    bluedSteelMat,
    'elevationArcGear'
  );
  elevSector.rotation.z = Math.PI / 2;
  elevSector.position.set(-0.20, PIVOT_POS.y, PIVOT_POS.z);
  mountFlange.add(elevSector);

  // =========================================================================
  // 2. ОПОРНАЯ ПЛИТА И ЛАФЕТ ЗАРЯЖАНИЯ (mortarCarriage)
  // =========================================================================
  const mortarCarriage = new THREE.Group();
  mortarCarriage.name = 'mortarCarriage';
  mortarCarriage.position.copy(PIVOT_POS);
  // Наклон на 35° вверх в плоскости +Z / +Y (локальная ось +Z становится осью ствола)
  mortarCarriage.rotation.x = -ELEVATION_RAD;
  root.add(mortarCarriage);

  // Люлька ствола (направляющий жёлоб и обоймы)
  const cradleTube = makeMesh(
    new THREE.CylinderGeometry(0.145, 0.155, 1.15, 24, 1, true),
    khakiMat,
    'cradleSleeve'
  );
  cradleTube.rotation.x = Math.PI / 2;
  cradleTube.position.set(0, 0, 0.38);
  mortarCarriage.add(cradleTube);

  const cradleBaseBox = makeMesh(new THREE.BoxGeometry(0.36, 0.16, 1.12), darkKhakiMat, 'cradleFrame');
  cradleBaseBox.position.set(0, -0.09, 0.36);
  mortarCarriage.add(cradleBaseBox);

  // Передний и задний бугели люльки
  for (const bz of [-0.16, 0.92]) {
    const collar = makeMesh(new THREE.CylinderGeometry(0.168, 0.168, 0.11, 24), khakiMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0, bz);
    mortarCarriage.add(collar);
  }

  // --- КРУГЛАЯ РЕБРИСТАЯ ОПОРНАЯ ПЛИТА-АМОРТИЗАТОР (в основании ствола) ---
  const baseplateGroup = new THREE.Group();
  baseplateGroup.name = 'recoilBaseplate';
  baseplateGroup.position.set(0, 0, -0.58);
  mortarCarriage.add(baseplateGroup);

  // Профиль круглой миномётной плиты (диаметр ~0.78 м) через LatheGeometry
  const platePts = [
    new THREE.Vector2(0.00, -0.045),
    new THREE.Vector2(0.14, -0.055),
    new THREE.Vector2(0.28, -0.035),
    new THREE.Vector2(0.37, -0.045),
    new THREE.Vector2(0.39, -0.015),
    new THREE.Vector2(0.39, 0.025),
    new THREE.Vector2(0.34, 0.035),
    new THREE.Vector2(0.16, 0.040),
    new THREE.Vector2(0.00, 0.045)
  ];
  const plateGeo = new THREE.LatheGeometry(platePts, 32);
  plateGeo.rotateX(Math.PI / 2);
  const roundBaseplate = makeMesh(plateGeo, khakiMat, 'roundBaseplateDisk');
  baseplateGroup.add(roundBaseplate);

  // Концентрические кольца жёсткости на опорной плите
  for (const r of [0.21, 0.33]) {
    const ring = makeMesh(new THREE.TorusGeometry(r, 0.014, 10, 32), darkKhakiMat);
    ring.position.z = -0.032;
    baseplateGroup.add(ring);
  }

  // 12 радиальных рёбер жёсткости на тыльной стороне опорной плиты
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const rib = makeMesh(new THREE.BoxGeometry(0.018, 0.25, 0.045), darkKhakiMat);
    rib.position.set(Math.cos(angle) * 0.23, Math.sin(angle) * 0.23, -0.028);
    rib.rotation.z = angle + Math.PI / 2;
    baseplateGroup.add(rib);
  }

  // Шаровая пята казённика в центре опорной плиты
  const breechSocket = makeMesh(new THREE.SphereGeometry(0.125, 20, 16), bluedSteelMat, 'breechBallSocket');
  breechSocket.position.z = 0.03;
  baseplateGroup.add(breechSocket);

  // 4 мощных амортизаторных стойки-буфера между опорной плитой и люлькой
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const sx = Math.cos(a) * 0.19;
    const sy = Math.sin(a) * 0.19;

    const strutOuter = makeMesh(new THREE.CylinderGeometry(0.028, 0.032, 0.26, 12), darkKhakiMat);
    strutOuter.rotation.x = Math.PI / 2;
    strutOuter.position.set(sx, sy, 0.15);
    baseplateGroup.add(strutOuter);

    const strutRod = makeMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 12), chromeMat);
    strutRod.rotation.x = Math.PI / 2;
    strutRod.position.set(sx, sy, 0.28);
    baseplateGroup.add(strutRod);
  }

  // --- ДВА МОЩНЫХ ГИДРАВЛИЧЕСКИХ НАКАТНИКА ПО БОКАМ ---
  const recuperatorRods = [];
  for (const side of [-1, 1]) {
    const recGroup = new THREE.Group();
    recGroup.name = `hydraulicRecuperator_${side > 0 ? 'R' : 'L'}`;
    recGroup.position.set(side * 0.22, -0.02, 0.35);
    mortarCarriage.add(recGroup);

    // Основной цилиндр гидронакатника
    const cylBody = makeMesh(new THREE.CylinderGeometry(0.056, 0.056, 1.05, 20), khakiMat);
    cylBody.rotation.x = Math.PI / 2;
    recGroup.add(cylBody);

    // Стяжные бугели цилиндра
    for (const cz of [-0.42, 0.0, 0.45]) {
      const band = makeMesh(new THREE.CylinderGeometry(0.064, 0.064, 0.06, 20), bluedSteelMat);
      band.rotation.x = Math.PI / 2;
      band.position.z = cz;
      recGroup.add(band);
    }

    // Передний сальник и латунный штуцер
    const gland = makeMesh(new THREE.CylinderGeometry(0.044, 0.052, 0.08, 16), brassMat);
    gland.rotation.x = Math.PI / 2;
    gland.position.z = 0.54;
    recGroup.add(gland);

    // Хромированный шток накатника (уходит к переднему хомуту ствола)
    const pistonRod = makeMesh(new THREE.CylinderGeometry(0.026, 0.026, 0.62, 16), chromeMat, 'recuperatorRod');
    pistonRod.rotation.x = Math.PI / 2;
    pistonRod.position.z = 0.82;
    recGroup.add(pistonRod);
    recuperatorRods.push(pistonRod);

    // Гидромагистраль высокого давления
    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.055, -0.45),
      new THREE.Vector3(side * 0.03, -0.085, -0.15),
      new THREE.Vector3(side * 0.03, -0.085, 0.35),
      new THREE.Vector3(0, -0.055, 0.48)
    ]);
    const pipeMesh = makeMesh(new THREE.TubeGeometry(pipeCurve, 16, 0.009, 8, false), brassMat);
    recGroup.add(pipeMesh);
  }

  // --- АВТОМАТИЧЕСКИЙ КАССЕТНЫЙ ЛОТОК ПОДАЧИ 120-ММ МИН И ЭЛЕКТРОПРИВОД ДОСЫЛАТЕЛЯ ---
  const loaderGroup = new THREE.Group();
  loaderGroup.name = 'automaticCassetteLoader';
  loaderGroup.position.set(0.28, 0.14, 0.25);
  loaderGroup.rotation.z = -0.35; // Наклон лотка к линии заряжания
  mortarCarriage.add(loaderGroup);

  // Открытый каркас кассетного лотка (чтобы были чётко видны 3 мины)
  const trayBottom = makeMesh(new THREE.BoxGeometry(0.46, 0.022, 0.62), darkKhakiMat, 'cassetteTrayFloor');
  loaderGroup.add(trayBottom);

  const trayFrontWall = makeMesh(new THREE.BoxGeometry(0.46, 0.14, 0.024), khakiMat);
  trayFrontWall.position.set(0, 0.07, 0.30);
  loaderGroup.add(trayFrontWall);

  const trayOuterWall = makeMesh(new THREE.BoxGeometry(0.024, 0.14, 0.62), khakiMat);
  trayOuterWall.position.set(0.22, 0.07, 0);
  loaderGroup.add(trayOuterWall);

  // Направляющие рёбра обоймы
  for (const zBar of [-0.26, 0.02]) {
    const retainerBar = makeMesh(new THREE.BoxGeometry(0.44, 0.018, 0.022), bluedSteelMat);
    retainerBar.position.set(0, 0.145, zBar);
    loaderGroup.add(retainerBar);
  }

  // Процедурная 120-мм оперенная мина (акцент на хвостовике и оперении из матового алюминия)
  function create120mmMortarRound(index) {
    const round = new THREE.Group();
    round.name = `mortarRound120mm_${index + 1}`;

    // Корпус мины (чугунный каплевидный корпус, уходящий вперёд в лоток)
    const bodyPts = [
      new THREE.Vector2(0.022, -0.02),
      new THREE.Vector2(0.048, 0.08),
      new THREE.Vector2(0.059, 0.20),
      new THREE.Vector2(0.059, 0.30),
      new THREE.Vector2(0.042, 0.42),
      new THREE.Vector2(0.016, 0.50),
      new THREE.Vector2(0.000, 0.52)
    ];
    const bodyGeo = new THREE.LatheGeometry(bodyPts, 20);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMesh = makeMesh(bodyGeo, darkKhakiMat);
    round.add(bodyMesh);

    // Взрыватель М-12
    const fuze = makeMesh(new THREE.CylinderGeometry(0.012, 0.018, 0.045, 14), brassMat);
    fuze.rotation.x = Math.PI / 2;
    fuze.position.z = 0.535;
    round.add(fuze);

    // Обтюрирующие проточки на поясе мины
    for (const rz of [0.22, 0.25, 0.28]) {
      const obturator = makeMesh(new THREE.TorusGeometry(0.0595, 0.0025, 8, 24), bluedSteelMat);
      obturator.position.z = rz;
      round.add(obturator);
    }

    // Хвостовик мины с 10 перьями стабилизатора (матовый серый алюминий #8b9299)
    const tailBoom = makeMesh(new THREE.CylinderGeometry(0.017, 0.021, 0.22, 16), aluminumMat, 'tailBoom');
    tailBoom.rotation.x = Math.PI / 2;
    tailBoom.position.z = -0.12;
    round.add(tailBoom);

    // Донный капсюль-воспламенитель
    const primerCap = makeMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.016, 12), brassMat);
    primerCap.rotation.x = Math.PI / 2;
    primerCap.position.z = -0.232;
    round.add(primerCap);

    // 10 радиальных перьев стабилизатора (отчётливо видны в обойме сзади и сверху)
    const finCount = 10;
    for (let f = 0; f < finCount; f++) {
      const fAngle = (f / finCount) * Math.PI * 2;
      const fin = makeMesh(new THREE.BoxGeometry(0.0035, 0.038, 0.115), aluminumMat);
      fin.position.set(
        Math.cos(fAngle) * 0.036,
        Math.sin(fAngle) * 0.036,
        -0.165
      );
      fin.rotation.z = fAngle + Math.PI / 2;
      round.add(fin);
    }

    return round;
  }

  // Размещаем 3 мины в кассетном лотке так, чтобы хвостовики эффектно выступали из обоймы
  for (let i = 0; i < 3; i++) {
    const round = create120mmMortarRound(i);
    round.position.set(-0.11 + i * 0.135, 0.075, -0.24);
    loaderGroup.add(round);
  }

  // Электропривод досылателя (сбоку-сзади лотка)
  const rammerDrive = new THREE.Group();
  rammerDrive.name = 'electricRammerDrive';
  rammerDrive.position.set(0.12, 0.07, -0.46);
  loaderGroup.add(rammerDrive);

  // Редуктор досылателя
  const gearbox = makeMesh(new THREE.BoxGeometry(0.16, 0.13, 0.15), darkKhakiMat, 'rammerGearbox');
  rammerDrive.add(gearbox);

  // Ребристый электродвигатель
  const motorBody = makeMesh(new THREE.CylinderGeometry(0.058, 0.058, 0.22, 20), bluedSteelMat, 'rammerMotor');
  motorBody.rotation.z = Math.PI / 2;
  motorBody.position.set(0.16, 0.01, 0);
  rammerDrive.add(motorBody);

  // Охлаждающие рёбра электродвигателя
  for (let r = 0; r < 7; r++) {
    const finRing = makeMesh(new THREE.TorusGeometry(0.061, 0.004, 6, 20), bluedSteelMat);
    finRing.rotation.y = Math.PI / 2;
    finRing.position.set(0.08 + r * 0.026, 0.01, 0);
    rammerDrive.add(finRing);
  }

  // Клеммная коробка и силовой кабель электропривода
  const terminalBox = makeMesh(new THREE.BoxGeometry(0.06, 0.045, 0.06), brassMat);
  terminalBox.position.set(0.15, 0.075, 0);
  rammerDrive.add(terminalBox);

  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.15, 0.095, 0),
    new THREE.Vector3(0.12, 0.15, -0.08),
    new THREE.Vector3(-0.08, 0.05, -0.18),
    new THREE.Vector3(-0.22, -0.12, -0.10)
  ]);
  const powerCable = makeMesh(new THREE.TubeGeometry(cableCurve, 16, 0.011, 8, false), rubberMat);
  rammerDrive.add(powerCable);

  // =========================================================================
  // 3. ГЛАДКОСТВОЛЬНЫЙ МИНОМЁТНЫЙ СТВОЛ (mortarTubeGroup — откат вдоль оси)
  // =========================================================================
  const mortarTubeGroup = new THREE.Group();
  mortarTubeGroup.name = 'mortarTubeGroup';
  mortarTubeGroup.position.copy(PIVOT_POS);
  mortarTubeGroup.rotation.x = -ELEVATION_RAD;
  root.add(mortarTubeGroup);

  // Общая длина ствола ~2.90 м (от казённика z = -0.45 до дульного среза z = +2.45)
  // Внутренний калибр: R_in = 0.060 м (диаметр 120 мм)
  const barrelProfile = [
    new THREE.Vector2(0.000, -0.45), // Закрытый казённик
    new THREE.Vector2(0.118, -0.45),
    new THREE.Vector2(0.118, -0.25),
    new THREE.Vector2(0.108, 0.15),
    new THREE.Vector2(0.098, 1.15),
    new THREE.Vector2(0.090, 2.38),
    new THREE.Vector2(0.060, 2.38),  // Дульный срез (калибр 120 мм)
    new THREE.Vector2(0.060, -0.35), // Глубокий гладкий канал ствола
    new THREE.Vector2(0.000, -0.35)
  ];
  const barrelLatheGeo = new THREE.LatheGeometry(barrelProfile, 32);
  barrelLatheGeo.rotateX(Math.PI / 2); // Ориентируем вдоль +Z
  const mainBarrel = makeMesh(barrelLatheGeo, bluedSteelMat, 'smoothboreBarrel120mm');
  mortarTubeGroup.add(mainBarrel);

  // Тёмная заглушка глубины канала ствола для реалистичного контраста при взгляде в дуло
  const borePlug = makeMesh(new THREE.CircleGeometry(0.059, 24), boreDarkMat, 'boreDepthPlug');
  borePlug.position.z = 0.80;
  mortarTubeGroup.add(borePlug);

  // Казённик с резьбовой пробкой и экстрактором
  const breechCap = makeMesh(new THREE.CylinderGeometry(0.124, 0.115, 0.12, 24), bluedSteelMat, 'breechCap');
  breechCap.rotation.x = Math.PI / 2;
  breechCap.position.z = -0.44;
  mortarTubeGroup.add(breechCap);

  // Хомут крепления штоков гидравлических накатников на стволе
  const recuperatorYoke = makeMesh(new THREE.BoxGeometry(0.52, 0.14, 0.09), khakiMat, 'recuperatorBarrelYoke');
  recuperatorYoke.position.set(0, -0.01, 1.32);
  mortarTubeGroup.add(recuperatorYoke);

  const yokeRing = makeMesh(new THREE.CylinderGeometry(0.115, 0.115, 0.11, 24), bluedSteelMat);
  yokeRing.rotation.x = Math.PI / 2;
  yokeRing.position.z = 1.32;
  mortarTubeGroup.add(yokeRing);

  // Поперечные рёбра жёсткости / охлаждения вдоль ствола
  for (let i = 0; i < 16; i++) {
    const rz = 0.15 + i * 0.072;
    if (Math.abs(rz - 1.32) < 0.06) continue; // Пропуск в зоне хомута накатников
    const ribRadius = 0.112 - i * 0.0005;
    const coolingRib = makeMesh(
      new THREE.TorusGeometry(ribRadius, 0.0085, 8, 28),
      bluedSteelMat,
      `barrelCoolingRib_${i + 1}`
    );
    coolingRib.position.z = rz;
    mortarTubeGroup.add(coolingRib);
  }

  // Термозащитный экран снизу ствола
  const heatShieldGroup = new THREE.Group();
  heatShieldGroup.name = 'bottomThermalShield';
  mortarTubeGroup.add(heatShieldGroup);

  const shieldArc = new THREE.CylinderGeometry(
    0.126,
    0.122,
    1.55,
    24,
    1,
    true,
    -Math.PI * 0.38,
    Math.PI * 0.76
  );
  shieldArc.rotateX(Math.PI / 2);
  shieldArc.rotateZ(Math.PI); // Ориентируем дугу строго вниз (-Y)
  const shieldMatDouble = darkKhakiMat.clone();
  shieldMatDouble.side = THREE.DoubleSide;
  const shieldShell = makeMesh(shieldArc, shieldMatDouble, 'thermalShieldPlate');
  shieldShell.position.set(0, -0.005, 1.42);
  heatShieldGroup.add(shieldShell);

  // Стойки-кронштейны термоэкрана и поперечные прорези-рёбра
  for (const sz of [0.72, 1.15, 1.65, 2.12]) {
    const bracket = makeMesh(new THREE.BoxGeometry(0.024, 0.045, 0.03), bluedSteelMat);
    bracket.position.set(0, -0.108, sz);
    heatShieldGroup.add(bracket);
  }

  // Массивный дульный предохранитель от двойного заряжания на срезе (z = 2.28 .. 2.46)
  const muzzleSafetyGroup = new THREE.Group();
  muzzleSafetyGroup.name = 'muzzleDoubleLoadSafety';
  muzzleSafetyGroup.position.set(0, 0, 2.36);
  mortarTubeGroup.add(muzzleSafetyGroup);

  // Усиленный дульный венец
  const muzzleCollar = makeMesh(new THREE.CylinderGeometry(0.108, 0.102, 0.16, 24), bluedSteelMat, 'muzzleCollar');
  muzzleCollar.rotation.x = Math.PI / 2;
  muzzleSafetyGroup.add(muzzleCollar);

  // Боковой шарнирный блок с возвратной пружиной предохранителя
  const pivotHousing = makeMesh(new THREE.BoxGeometry(0.065, 0.095, 0.13), darkKhakiMat);
  pivotHousing.position.set(-0.125, 0.045, 0.01);
  muzzleSafetyGroup.add(pivotHousing);

  const pivotShaft = makeMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.14, 12), chromeMat);
  pivotShaft.rotation.z = Math.PI / 2;
  pivotShaft.position.set(-0.11, 0.075, 0.03);
  muzzleSafetyGroup.add(pivotShaft);

  // Массивная вилка-заслонка предохранителя над дульным срезом
  const safetyFork = makeMesh(new THREE.BoxGeometry(0.17, 0.026, 0.075), bluedSteelMat, 'safetyFlapperGate');
  safetyFork.position.set(-0.02, 0.105, 0.065);
  safetyFork.rotation.z = -0.12;
  muzzleSafetyGroup.add(safetyFork);

  const safetyLip = makeMesh(new THREE.BoxGeometry(0.07, 0.055, 0.024), chromeMat);
  safetyLip.position.set(0.045, 0.085, 0.095);
  muzzleSafetyGroup.add(safetyLip);

  return root;
}

// =========================================================================
// Адаптер под единый просмотрщик: выстрел 120 мм, откат 0..0.27 м вдоль оси.
// applyVolley(t): резкий откат → накат, вспышка. Возвращает { recoil, flash }.
// =========================================================================
export function createWeapon() {
  const root = createWeapon2B11SaniM();
  const ud = root.userData;
  const barrel = root.getObjectByName('mortarTubeGroup');

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flashCone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.75, 16), flashMat);
  flashCone.rotation.x = Math.PI / 2;
  flashCone.position.set(0, 0, 2.52 + 0.32);
  barrel.add(flashCone);

  const flashLight = new THREE.PointLight(0xff8c24, 0, 8);
  flashLight.position.set(0, 0, 2.52);
  barrel.add(flashLight);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  const basePos = barrel.position.clone(); // точка цапф PIVOT_POS, откат — строго вдоль оси ствола

  ud.applyVolley = (t) => {
    let off = 0;
    let fl = 0;
    if (t < RET_TIME) {
      const u = t / RET_TIME;
      off = MAX_RECOIL * Math.sin(u * (Math.PI / 2));
      fl = Math.max(0, 1 - t / 0.07);
    } else if (t < RET_TIME + RETURN_TIME) {
      const u = (t - RET_TIME) / RETURN_TIME;
      off = MAX_RECOIL * Math.pow(1 - u, 2.4);
    }
    barrel.position.copy(basePos).addScaledVector(BARREL_AXIS, -off);
    flashMat.opacity = fl * 0.92;
    flashCone.scale.set(0.8 + fl * 0.5, 0.8 + fl * 0.5, 0.6 + fl * 0.9);
    flashLight.intensity = fl * 18.0;
    return { recoil: off, flash: fl };
  };
  ud.setExtension = (recoil) => {
    const r = Math.max(0, Math.min(MAX_RECOIL, recoil));
    barrel.position.copy(basePos).addScaledVector(BARREL_AXIS, -r);
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
