import * as THREE from 'three';

export const meta = {
  id: 'ak630',
  code: 'АК-630М2',
  title: 'АК-630М2 «Шквал»',
  subtitle: 'СВЕРХТЯЖЁЛАЯ ШЕСТИСТВОЛЬНАЯ РОТОРНАЯ ПУШКА • 5000 ВЫСТР/МИН • СЛОТ SUPERHEAVY',
  description:
    'Сверхтяжёлая шестиствольная роторная пушка: сдвоенный силовой узел УСП с гидрозамками, бронекожух с барабанным магазином, открытыми гидромоторами раскрутки и гофрированным гильзоотводом. Вращающийся блок из 6 стволов 30 мм на трёх перфорированных дисках-обоймах с центральным обтекателем. Плавная раскрутка гидроприводом и инерционный выбег.',
  specs: [
    ['Калибр', '6×30 мм'],
    ['Темп', '5000 выстр/мин'],
    ['Раскрутка', 'Гидропривод, 28 рад/с'],
    ['Срез блока', 'z = 3.50 м'],
    ['Питание', 'Барабан + рукав'],
    ['Слот', 'SUPERHEAVY'],
  ],
  maxExtension: 1.0,
  unit: '%',
  tipOffset: 3.5,
  subgroups: [
    { key: 'mountFlange', label: '1. Сдвоенный узел УСП' },
    { key: 'ammoDrumHousing', label: '2. Бункер и кожух привода' },
    { key: 'ammoDrumMagazine', label: '3. Барабанный магазин' },
    { key: 'hydraulicSpinMotors', label: '4. Гидромоторы раскрутки' },
    { key: 'rotaryBarrelsGroup', label: '5. Вращающийся блок стволов' },
  ],
  cameras: {
    module: { pos: [3.4, 1.35, 4.1], target: [0, -0.35, 1.35] },
  },
  rangeMarkers: [],
  controls: 'aa',
};

const SPIN_MAX = 28.0; // номинальная угловая скорость раскрутки (рад/с)
const SPIN_ACCEL = 7.5; // ускорение раскрутки гидропривода (рад/с²)
const SPIN_DECEL = 5.0; // инерционное торможение (рад/с²)
const BARREL_COUNT = 6;

/**
 * Создаёт процедурную CanvasTexture с жёлто-чёрной промышленной разметкой
 * и трафаретной маркировкой «АК-630М2».
 */
function createMarkingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Базовый флотский серо-стальной фон
  ctx.fillStyle = '#5b6268';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Верхняя и нижняя полосы жёлто-чёрной предупреждающей маркировки
  const stripeHeight = 38;
  const stripeWidth = 44;

  const drawHazardBand = (yOffset) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, yOffset, canvas.width, stripeHeight);
    ctx.clip();

    ctx.fillStyle = '#e5a910';
    ctx.fillRect(0, yOffset, canvas.width, stripeHeight);

    ctx.fillStyle = '#16181a';
    for (let x = -stripeHeight * 2; x < canvas.width + stripeHeight * 2; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, yOffset + stripeHeight);
      ctx.lineTo(x + stripeWidth, yOffset + stripeHeight);
      ctx.lineTo(x + stripeWidth + stripeHeight, yOffset);
      ctx.lineTo(x + stripeHeight, yOffset);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  drawHazardBand(0);
  drawHazardBand(canvas.height - stripeHeight);

  // Центральная тёмная панель под трафарет
  ctx.fillStyle = '#262a2e';
  ctx.fillRect(24, stripeHeight + 12, canvas.width - 48, canvas.height - (stripeHeight + 12) * 2);

  ctx.strokeStyle = '#8b939b';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, stripeHeight + 12, canvas.width - 48, canvas.height - (stripeHeight + 12) * 2);

  // Трафаретная надпись АК-630М2
  ctx.fillStyle = '#f2f4f7';
  ctx.font = 'bold 82px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('АК-630М2', 56, canvas.height / 2 - 8);

  // Технический индекс и калибр
  ctx.fillStyle = '#e5a910';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('УСП-630 // «ШКВАЛ» // 30×165 ММ', 58, canvas.height / 2 + 44);

  // Правый технический блок
  ctx.textAlign = 'right';
  ctx.fillStyle = '#cfd5dc';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('СЛОТ: SUPERHEAVY', canvas.width - 56, canvas.height / 2 - 24);
  ctx.fillText('ПРИВОД: ГИДРО-РОТОР', canvas.width - 56, canvas.height / 2 + 12);
  ctx.fillStyle = '#e5a910';
  ctx.fillText('ТЕМП: 5000 ВЫСТР/МИН', canvas.width - 56, canvas.height / 2 + 46);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Генерирует процедурную 3D-модель сверхтяжёлой шестиствольной роторной пушки АК-630М2 «Шквал».
 * Система координат: 1 unit = 1 м, стволы вдоль +Z, верх +Y, бок +X, (0,0,0) — центр фланца УСП.
 *
 * @returns {THREE.Group}
 */
export function createWeaponAK630M2Shkval() {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'AK630M2_Shkval';

  // ==================== PBR МАТЕРИАЛЫ ====================
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x5b6268,
    metalness: 0.50,
    roughness: 0.60,
  });

  const armorDarkMat = new THREE.MeshStandardMaterial({
    color: 0x3e4348,
    metalness: 0.55,
    roughness: 0.55,
  });

  const gunmetalMat = new THREE.MeshStandardMaterial({
    color: 0x23262a,
    metalness: 0.88,
    roughness: 0.32,
  });

  const boreDarkMat = new THREE.MeshStandardMaterial({
    color: 0x090a0c,
    metalness: 0.40,
    roughness: 0.85,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd5dbe3,
    metalness: 0.94,
    roughness: 0.16,
  });

  const hazardYellowMat = new THREE.MeshStandardMaterial({
    color: 0xd99e16,
    metalness: 0.35,
    roughness: 0.48,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xb88935,
    metalness: 0.86,
    roughness: 0.28,
  });

  const hoseMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c1f,
    metalness: 0.15,
    roughness: 0.82,
  });

  const markingTexture = createMarkingTexture();
  const markingMat = new THREE.MeshStandardMaterial({
    map: markingTexture,
    metalness: 0.42,
    roughness: 0.55,
  });

  // Массивы матриц для инстансинга болтов и заклёпок
  const staticBoltMatrices = [];
  const rotaryBoltMatrices = [];
  const dummy = new THREE.Object3D();

  const addBolt = (targetArray, x, y, z, rx = 0, ry = 0, rz = 0, scale = 1) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    targetArray.push(dummy.matrix.clone());
  };

  // =========================================================================
  // 1. СДВОЕННЫЙ СИЛОВОЙ УЗЕЛ КРЕПЛЕНИЯ (mountFlange)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  rootGroup.add(mountFlange);

  // Основная гигантская плита УСП: 0.80 x 0.20 x 1.30 м с центром в (0, 0, 0)
  const mainPlateGeo = new THREE.BoxGeometry(0.80, 0.20, 1.30);
  const mainPlate = new THREE.Mesh(mainPlateGeo, armorMat);
  mainPlate.castShadow = true;
  mainPlate.receiveShadow = true;
  mountFlange.add(mainPlate);

  // Сдвоенные силовые верхние фланцевые воротники (передний и задний контуры УСП)
  const dualCollarZ = [-0.34, 0.34];
  for (const cz of dualCollarZ) {
    const collarOuter = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.48), armorDarkMat);
    collarOuter.position.set(0, 0.13, cz);
    collarOuter.castShadow = true;
    collarOuter.receiveShadow = true;
    mountFlange.add(collarOuter);

    const collarInner = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.34), gunmetalMat);
    collarInner.position.set(0, 0.165, cz);
    collarInner.castShadow = true;
    mountFlange.add(collarInner);

    // Болты по периметру каждого из сдвоенных воротников
    for (let bx = -0.32; bx <= 0.321; bx += 0.128) {
      addBolt(staticBoltMatrices, bx, 0.163, cz - 0.20, 0, 0, 0, 1.1);
      addBolt(staticBoltMatrices, bx, 0.163, cz + 0.20, 0, 0, 0, 1.1);
    }
  }

  // Поперечное силовое ребро жёсткости между сдвоенными узлами
  const centerBridge = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.05, 0.14), armorMat);
  centerBridge.position.set(0, 0.125, 0);
  centerBridge.castShadow = true;
  mountFlange.add(centerBridge);

  // Бронепластины с маркировкой АК-630М2 на боковых гранях плиты УСП
  const sideLabelGeo = new THREE.BoxGeometry(0.014, 0.16, 1.16);
  const leftLabelPlate = new THREE.Mesh(sideLabelGeo, markingMat);
  leftLabelPlate.position.set(-0.405, 0.0, 0.0);
  mountFlange.add(leftLabelPlate);

  const rightLabelPlate = new THREE.Mesh(sideLabelGeo, markingMat);
  rightLabelPlate.position.set(0.405, 0.0, 0.0);
  mountFlange.add(rightLabelPlate);

  // 6 гидрозамков (по 3 на левом и правом бортах фланца УСП)
  const lockZPositions = [-0.46, 0.0, 0.46];
  const lockSides = [-1, 1];

  const lockBodyGeo = new THREE.BoxGeometry(0.11, 0.14, 0.16);
  const lockCylGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.17, 16);
  const lockPistonGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.12, 12);
  const lockClawGeo = new THREE.BoxGeometry(0.13, 0.05, 0.12);

  for (const side of lockSides) {
    for (const lz of lockZPositions) {
      const lockAssembly = new THREE.Group();
      lockAssembly.position.set(side * 0.43, 0.02, lz);

      // Литой корпус гидрозамка
      const housing = new THREE.Mesh(lockBodyGeo, armorDarkMat);
      housing.castShadow = true;
      housing.receiveShadow = true;
      lockAssembly.add(housing);

      // Силовой гидроцилиндр (жёлтая промышленная окраска)
      const cylinder = new THREE.Mesh(lockCylGeo, hazardYellowMat);
      cylinder.position.set(side * 0.02, 0.07, 0);
      cylinder.castShadow = true;
      lockAssembly.add(cylinder);

      // Хромированный шток гидроцилиндра
      const piston = new THREE.Mesh(lockPistonGeo, chromeMat);
      piston.position.set(side * 0.02, -0.05, 0);
      lockAssembly.add(piston);

      // Захватный кулачок замка
      const claw = new THREE.Mesh(lockClawGeo, gunmetalMat);
      claw.position.set(-side * 0.02, 0.095, 0);
      claw.castShadow = true;
      lockAssembly.add(claw);

      // Болты крепления корпуса замка
      addBolt(staticBoltMatrices, side * 0.486, 0.05, lz - 0.05, 0, 0, -side * Math.PI / 2, 1.0);
      addBolt(staticBoltMatrices, side * 0.486, 0.05, lz + 0.05, 0, 0, -side * Math.PI / 2, 1.0);

      mountFlange.add(lockAssembly);
    }
  }

  // =========================================================================
  // 2. БАРАБАННЫЙ БУНКЕР БОЕПИТАНИЯ И КОЖУХ ПРИВОДА (ammoDrumHousing)
  // =========================================================================
  const ammoDrumHousing = new THREE.Group();
  ammoDrumHousing.name = 'ammoDrumHousing';
  rootGroup.add(ammoDrumHousing);

  // Ось вращения блока стволов проходит на высоте y = -0.42
  const barrelAxisY = -0.42;

  // Верхняя переходная шея под фланцем УСП
  const neckMesh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 1.24), armorDarkMat);
  neckMesh.position.set(0, -0.18, 0.0);
  neckMesh.castShadow = true;
  neckMesh.receiveShadow = true;
  ammoDrumHousing.add(neckMesh);

  // Основной бронекожух ствольной коробки и редуктора (z от -0.78 до +0.86)
  const receiverMain = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.56, 1.62), armorMat);
  receiverMain.position.set(0, -0.48, 0.04);
  receiverMain.castShadow = true;
  receiverMain.receiveShadow = true;
  ammoDrumHousing.add(receiverMain);

  // Наклонная лобовая бронеплита вокруг выхода блока стволов
  const frontGlacis = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.46, 0.18), armorDarkMat);
  frontGlacis.position.set(0, -0.44, 0.86);
  frontGlacis.rotation.x = -0.14;
  frontGlacis.castShadow = true;
  ammoDrumHousing.add(frontGlacis);

  // Задний бронеколпак казённой части (доводит габарит назад до z = -0.80)
  const rearBreechCap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.44, 0.14), armorDarkMat);
  rearBreechCap.position.set(0, -0.46, -0.73);
  rearBreechCap.castShadow = true;
  ammoDrumHousing.add(rearBreechCap);

  // Демпферы отката на кормовой плите
  const bufferGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.08, 16);
  bufferGeo.rotateX(Math.PI / 2);
  for (const bx of [-0.15, 0.15]) {
    const buffer = new THREE.Mesh(bufferGeo, gunmetalMat);
    buffer.position.set(bx, -0.46, -0.80);
    ammoDrumHousing.add(buffer);
  }

  // Массивный опорный подшипниковый стакан ротора стволов (z = 0.88)
  const rotorHousingGeo = new THREE.CylinderGeometry(0.255, 0.275, 0.20, 28);
  rotorHousingGeo.rotateX(Math.PI / 2);
  const rotorHousing = new THREE.Mesh(rotorHousingGeo, gunmetalMat);
  rotorHousing.position.set(0, barrelAxisY, 0.88);
  rotorHousing.castShadow = true;
  ammoDrumHousing.add(rotorHousing);

  // Заклёпки по периметру бронекожуха
  for (let bz = -0.68; bz <= 0.76; bz += 0.16) {
    addBolt(staticBoltMatrices, -0.323, -0.25, bz, 0, 0, Math.PI / 2, 0.95);
    addBolt(staticBoltMatrices, -0.323, -0.71, bz, 0, 0, Math.PI / 2, 0.95);
    addBolt(staticBoltMatrices, 0.323, -0.25, bz, 0, 0, -Math.PI / 2, 0.95);
    addBolt(staticBoltMatrices, 0.323, -0.71, bz, 0, 0, -Math.PI / 2, 0.95);
  }

  // --- КРУПНЫЙ ЦИЛИНДРИЧЕСКИЙ БАРАБАННЫЙ МАГАЗИН (левый/нижний борт) ---
  const drumGroup = new THREE.Group();
  drumGroup.name = 'ammoDrumMagazine';
  drumGroup.position.set(-0.56, -0.54, -0.04);
  ammoDrumHousing.add(drumGroup);

  const drumRadius = 0.41;
  const drumLength = 0.94;
  const drumBodyGeo = new THREE.CylinderGeometry(drumRadius, drumRadius, drumLength, 32);
  drumBodyGeo.rotateX(Math.PI / 2);
  const drumBody = new THREE.Mesh(drumBodyGeo, armorMat);
  drumBody.castShadow = true;
  drumBody.receiveShadow = true;
  drumGroup.add(drumBody);

  // Силовые бандажные кольца и торцевые крышки барабана
  const drumRingGeo = new THREE.CylinderGeometry(drumRadius + 0.016, drumRadius + 0.016, 0.045, 32);
  drumRingGeo.rotateX(Math.PI / 2);
  for (const rz of [-0.44, -0.15, 0.15, 0.44]) {
    const ring = new THREE.Mesh(drumRingGeo, armorDarkMat);
    ring.position.z = rz;
    ring.castShadow = true;
    drumGroup.add(ring);
  }

  // Центральные ступицы на торцах барабана и болты по кругу
  const hubGeo = new THREE.CylinderGeometry(0.11, 0.13, drumLength + 0.06, 20);
  hubGeo.rotateX(Math.PI / 2);
  const drumHub = new THREE.Mesh(hubGeo, gunmetalMat);
  drumGroup.add(drumHub);

  const drumBoltCount = 16;
  for (let i = 0; i < drumBoltCount; i++) {
    const a = (i / drumBoltCount) * Math.PI * 2;
    const bx = -0.56 + Math.cos(a) * (drumRadius - 0.045);
    const by = -0.54 + Math.sin(a) * (drumRadius - 0.045);
    addBolt(staticBoltMatrices, bx, by, -0.04 + drumLength / 2 + 0.015, Math.PI / 2, 0, 0, 1.0);
    addBolt(staticBoltMatrices, bx, by, -0.04 - drumLength / 2 - 0.015, -Math.PI / 2, 0, 0, 1.0);
  }

  // Кронштейны подвеса барабана к бронекорпусу
  for (const sz of [-0.30, 0.24]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.12), armorDarkMat);
    strut.position.set(0.24, 0.20, sz);
    strut.rotation.z = -0.45;
    strut.castShadow = true;
    drumGroup.add(strut);
  }

  // Бронированный рукав подачи ленты из барабана в казённую часть + видимые 30-мм патроны
  const feedChute = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.28), armorDarkMat);
  feedChute.position.set(0.26, 0.26, 0.22);
  feedChute.rotation.z = -0.38;
  feedChute.castShadow = true;
  drumGroup.add(feedChute);

  const shellGeo = new THREE.CylinderGeometry(0.015, 0.016, 0.16, 10);
  shellGeo.rotateZ(Math.PI / 2);
  for (let s = 0; s < 5; s++) {
    const shell = new THREE.Mesh(shellGeo, brassMat);
    shell.position.set(0.22, 0.33, 0.12 + s * 0.048);
    shell.rotation.z = -0.35;
    drumGroup.add(shell);
  }

  // --- ОТКРЫТЫЕ ГИДРОМОТОРЫ РАСКРУТКИ БЛОКА СТВОЛОВ (правый верхний борт) ---
  const hydroBay = new THREE.Group();
  hydroBay.name = 'hydraulicSpinMotors';
  hydroBay.position.set(0.36, -0.36, -0.18);
  ammoDrumHousing.add(hydroBay);

  // Ниша и защитная дуга гидропривода
  const bayBacking = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.72), armorDarkMat);
  bayBacking.position.set(-0.03, 0, 0);
  hydroBay.add(bayBacking);

  const motorBodyGeo = new THREE.CylinderGeometry(0.085, 0.095, 0.24, 20);
  motorBodyGeo.rotateX(Math.PI / 2);
  const motorCapGeo = new THREE.CylinderGeometry(0.065, 0.085, 0.06, 20);
  motorCapGeo.rotateX(Math.PI / 2);
  const finGeo = new THREE.CylinderGeometry(0.098, 0.098, 0.012, 20);
  finGeo.rotateX(Math.PI / 2);

  for (const mz of [-0.18, 0.16]) {
    const motor = new THREE.Group();
    motor.position.set(0.05, 0.02, mz);

    const body = new THREE.Mesh(motorBodyGeo, gunmetalMat);
    body.castShadow = true;
    motor.add(body);

    const rearCap = new THREE.Mesh(motorCapGeo, hazardYellowMat);
    rearCap.position.z = -0.14;
    motor.add(rearCap);

    // Охлаждающие рёбра гидромотора
    for (let f = -0.08; f <= 0.081; f += 0.04) {
      const fin = new THREE.Mesh(finGeo, armorMat);
      fin.position.z = f;
      motor.add(fin);
    }

    // Латунные штуцеры высокого давления
    const fitting = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), brassMat);
    fitting.position.set(0.04, 0.09, -0.04);
    motor.add(fitting);

    hydroBay.add(motor);
  }

  // Защитная трубчатая рама поверх открытых гидромоторов
  const guardCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.02, 0.13, -0.35),
    new THREE.Vector3(0.16, 0.13, -0.32),
    new THREE.Vector3(0.16, 0.13, 0.32),
    new THREE.Vector3(-0.02, 0.13, 0.35),
  ]);
  const guardTube = new THREE.Mesh(new THREE.TubeGeometry(guardCurve, 24, 0.014, 10, false), armorDarkMat);
  guardTube.castShadow = true;
  hydroBay.add(guardTube);

  // Гибкие гидравлические рукава высокого давления (РВД)
  const hosePaths = [
    [
      new THREE.Vector3(0.09, 0.11, -0.22),
      new THREE.Vector3(0.14, 0.18, -0.05),
      new THREE.Vector3(0.12, 0.14, 0.34),
      new THREE.Vector3(0.0, 0.02, 0.56),
    ],
    [
      new THREE.Vector3(0.09, 0.11, 0.12),
      new THREE.Vector3(0.15, 0.15, 0.32),
      new THREE.Vector3(0.08, 0.04, 0.52),
      new THREE.Vector3(-0.02, -0.04, 0.64),
    ],
  ];

  for (const pts of hosePaths) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.015, 10, false), hoseMat);
    hose.castShadow = true;
    hydroBay.add(hose);
  }

  // --- ГОФРИРОВАННЫЙ КОЖУХ ОТВОДА ГИЛЬЗ (правый нижний борт) ---
  const ejectionChuteGroup = new THREE.Group();
  ejectionChuteGroup.name = 'corrugatedShellChute';
  ammoDrumHousing.add(ejectionChuteGroup);

  const chuteCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.30, -0.56, 0.34),
    new THREE.Vector3(0.46, -0.62, 0.24),
    new THREE.Vector3(0.54, -0.76, 0.06),
    new THREE.Vector3(0.55, -0.94, -0.14),
  ]);

  const bellowsCount = 18;
  const ribGeo = new THREE.CylinderGeometry(0.092, 0.082, 0.042, 18);
  const upVec = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < bellowsCount; i++) {
    const t = i / (bellowsCount - 1);
    const pt = chuteCurve.getPointAt(t);
    const tangent = chuteCurve.getTangentAt(t).normalize();

    const rib = new THREE.Mesh(ribGeo, i % 2 === 0 ? armorDarkMat : gunmetalMat);
    rib.position.copy(pt);
    rib.quaternion.setFromUnitVectors(upVec, tangent);
    rib.castShadow = true;
    ejectionChuteGroup.add(rib);
  }

  // Выходной раструб гильзоотвода
  const exitPt = chuteCurve.getPointAt(1);
  const exitTan = chuteCurve.getTangentAt(1).normalize();
  const exitNozzle = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.07, 0.16), armorMat);
  exitNozzle.position.copy(exitPt);
  exitNozzle.quaternion.setFromUnitVectors(upVec, exitTan);
  ejectionChuteGroup.add(exitNozzle);

  // --- ВЕНТИЛЯЦИОННЫЕ ЖАЛЮЗИ НА БРОНЕКОЖУХЕ ---
  const louverSlatsCount = 7;
  const slatGeo = new THREE.BoxGeometry(0.025, 0.012, 0.34);

  for (const side of [-1, 1]) {
    const louverFrame = new THREE.Group();
    louverFrame.position.set(side * 0.322, -0.34, 0.56);

    const recess = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.19, 0.38), boreDarkMat);
    louverFrame.add(recess);

    const frameBorder = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.21, 0.40), armorDarkMat);
    frameBorder.position.x = -side * 0.004;
    louverFrame.add(frameBorder);

    for (let j = 0; j < louverSlatsCount; j++) {
      const sy = -0.072 + j * 0.024;
      const slat = new THREE.Mesh(slatGeo, armorMat);
      slat.position.set(side * 0.008, sy, 0);
      slat.rotation.z = -side * 0.52;
      louverFrame.add(slat);
    }

    ammoDrumHousing.add(louverFrame);
  }

  // =========================================================================
  // 3. ВРАЩАЮЩИЙСЯ ШЕСТИСТВОЛЬНЫЙ БЛОК (rotaryBarrelsGroup)
  // =========================================================================
  const rotaryBarrelsGroup = new THREE.Group();
  rotaryBarrelsGroup.name = 'rotaryBarrelsGroup';
  // Старт группы у выходного подшипника (z = 0.90); длина стволов 2.60 -> срез на world z = 3.50 м
  rotaryBarrelsGroup.position.set(0, barrelAxisY, 0.90);
  rootGroup.add(rotaryBarrelsGroup);

  const clusterRadius = 0.145; // Радиус окружности осей 6 стволов
  const barrelLength = 2.60;   // Локальный Z от 0.00 до 2.60 (мировой Z = 3.50 м)

  // Центральный силовой вал блока стволов
  const centerShaftGeo = new THREE.CylinderGeometry(0.048, 0.052, 2.38, 24);
  centerShaftGeo.rotateX(Math.PI / 2);
  const centerShaft = new THREE.Mesh(centerShaftGeo, gunmetalMat);
  centerShaft.position.z = 1.19;
  centerShaft.castShadow = true;
  rotaryBarrelsGroup.add(centerShaft);

  // Шесть толстостенных стволов через THREE.InstancedMesh (казённая муфта, ствол, дульный срез, канал)
  const breechJacketLen = 0.68;
  const breechJacketGeo = new THREE.CylinderGeometry(0.039, 0.042, breechJacketLen, 20);
  breechJacketGeo.rotateX(Math.PI / 2);

  const mainBarrelLen = barrelLength - breechJacketLen;
  const mainBarrelGeo = new THREE.CylinderGeometry(0.029, 0.033, mainBarrelLen, 20);
  mainBarrelGeo.rotateX(Math.PI / 2);

  const muzzleCollarGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.08, 20);
  muzzleCollarGeo.rotateX(Math.PI / 2);

  const boreGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.05, 16);
  boreGeo.rotateX(Math.PI / 2);

  const instBreech = new THREE.InstancedMesh(breechJacketGeo, armorDarkMat, BARREL_COUNT);
  const instBarrels = new THREE.InstancedMesh(mainBarrelGeo, gunmetalMat, BARREL_COUNT);
  const instMuzzles = new THREE.InstancedMesh(muzzleCollarGeo, gunmetalMat, BARREL_COUNT);
  const instBores = new THREE.InstancedMesh(boreGeo, boreDarkMat, BARREL_COUNT);

  instBreech.castShadow = true;
  instBarrels.castShadow = true;
  instBarrels.receiveShadow = true;
  instMuzzles.castShadow = true;

  for (let i = 0; i < BARREL_COUNT; i++) {
    const angle = (i / BARREL_COUNT) * Math.PI * 2;
    const bx = Math.cos(angle) * clusterRadius;
    const by = Math.sin(angle) * clusterRadius;

    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);

    // Усиленная казённая часть ствола
    dummy.position.set(bx, by, breechJacketLen / 2);
    dummy.updateMatrix();
    instBreech.setMatrixAt(i, dummy.matrix);

    // Основной толстостенный ствол
    dummy.position.set(bx, by, breechJacketLen + mainBarrelLen / 2);
    dummy.updateMatrix();
    instBarrels.setMatrixAt(i, dummy.matrix);

    // Дульное утолщение
    dummy.position.set(bx, by, barrelLength - 0.04);
    dummy.updateMatrix();
    instMuzzles.setMatrixAt(i, dummy.matrix);

    // Канал ствола 30 мм
    dummy.position.set(bx, by, barrelLength - 0.02);
    dummy.updateMatrix();
    instBores.setMatrixAt(i, dummy.matrix);
  }

  instBreech.instanceMatrix.needsUpdate = true;
  instBarrels.instanceMatrix.needsUpdate = true;
  instMuzzles.instanceMatrix.needsUpdate = true;
  instBores.instanceMatrix.needsUpdate = true;
  instBarrels.computeBoundingSphere();

  rotaryBarrelsGroup.add(instBreech, instBarrels, instMuzzles, instBores);

  // --- ТРИ МАССИВНЫХ ПЕРФОРИРОВАННЫХ СТАЛЬНЫХ ДИСКА-ОБОЙМЫ ---
  const discOuterRadius = 0.215;
  const discThickness = 0.044;

  const discShape = new THREE.Shape();
  discShape.absarc(0, 0, discOuterRadius, 0, Math.PI * 2, false);

  // Центральное отверстие под вал
  const centerHole = new THREE.Path();
  centerHole.absarc(0, 0, 0.048, 0, Math.PI * 2, true);
  discShape.holes.push(centerHole);

  // 6 отверстий под стволы + 6 вентиляционных перфораций между стволами
  for (let i = 0; i < BARREL_COUNT; i++) {
    const barrelAngle = (i / BARREL_COUNT) * Math.PI * 2;
    const bHole = new THREE.Path();
    bHole.absarc(
      Math.cos(barrelAngle) * clusterRadius,
      Math.sin(barrelAngle) * clusterRadius,
      0.032,
      0,
      Math.PI * 2,
      true
    );
    discShape.holes.push(bHole);

    const perfAngle = ((i + 0.5) / BARREL_COUNT) * Math.PI * 2;
    const pHole = new THREE.Path();
    pHole.absarc(
      Math.cos(perfAngle) * 0.132,
      Math.sin(perfAngle) * 0.132,
      0.022,
      0,
      Math.PI * 2,
      true
    );
    discShape.holes.push(pHole);
  }

  const discGeo = new THREE.ExtrudeGeometry(discShape, {
    depth: discThickness,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 36,
  });

  const clampCollarGeo = new THREE.CylinderGeometry(0.041, 0.041, discThickness + 0.018, 20);
  clampCollarGeo.rotateX(Math.PI / 2);

  // Позиции трёх стяжных дисков по длине блока стволов
  const discZPositions = [0.74, 1.50, 2.26];

  for (const dz of discZPositions) {
    const discMesh = new THREE.Mesh(discGeo, gunmetalMat);
    discMesh.position.z = dz - discThickness / 2;
    discMesh.castShadow = true;
    discMesh.receiveShadow = true;
    rotaryBarrelsGroup.add(discMesh);

    // Стяжные муфты вокруг каждого ствола на диске + радиальные болты
    for (let i = 0; i < BARREL_COUNT; i++) {
      const a = (i / BARREL_COUNT) * Math.PI * 2;
      const collar = new THREE.Mesh(clampCollarGeo, armorDarkMat);
      collar.position.set(Math.cos(a) * clusterRadius, Math.sin(a) * clusterRadius, dz);
      rotaryBarrelsGroup.add(collar);

      // Болты на передней и задней плоскостях диска
      const boltAngle = ((i + 0.5) / BARREL_COUNT) * Math.PI * 2;
      const rBolt = 0.182;
      addBolt(
        rotaryBoltMatrices,
        Math.cos(boltAngle) * rBolt,
        Math.sin(boltAngle) * rBolt,
        dz + discThickness / 2 + 0.005,
        Math.PI / 2,
        0,
        0,
        0.95
      );
      addBolt(
        rotaryBoltMatrices,
        Math.cos(boltAngle) * rBolt,
        Math.sin(boltAngle) * rBolt,
        dz - discThickness / 2 - 0.005,
        -Math.PI / 2,
        0,
        0,
        0.95
      );
    }
  }

  // --- ЦЕНТРАЛЬНЫЙ КОНУС-ОБТЕКАТЕЛЬ НА СРЕЗЕ БЛОКА СТВОЛОВ ---
  const coneProfile = [
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.082, 0.00),
    new THREE.Vector2(0.082, 0.045),
    new THREE.Vector2(0.072, 0.065),
    new THREE.Vector2(0.048, 0.190),
    new THREE.Vector2(0.022, 0.300),
    new THREE.Vector2(0.012, 0.335),
    new THREE.Vector2(0.00, 0.340),
  ];
  const noseConeGeo = new THREE.LatheGeometry(coneProfile, 32);
  noseConeGeo.rotateX(Math.PI / 2);

  const noseCone = new THREE.Mesh(noseConeGeo, gunmetalMat);
  // Основание конуса у переднего диска (z = 2.26), вершина ровно на срезе стволов (z = 2.60 -> world z = 3.50)
  noseCone.position.z = 2.26;
  noseCone.castShadow = true;
  noseCone.receiveShadow = true;
  rotaryBarrelsGroup.add(noseCone);

  // =========================================================================
  // 4. МЕЛКИЕ БОЛТЫ И ЗАКЛЁПКИ ЧЕРЕЗ THREE.InstancedMesh
  // =========================================================================
  const boltGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.009, 6);

  const staticBoltsInst = new THREE.InstancedMesh(boltGeo, chromeMat, staticBoltMatrices.length);
  staticBoltsInst.name = 'staticBoltsInstanced';
  staticBoltMatrices.forEach((mat, idx) => staticBoltsInst.setMatrixAt(idx, mat));
  staticBoltsInst.instanceMatrix.needsUpdate = true;
  staticBoltsInst.computeBoundingSphere();
  rootGroup.add(staticBoltsInst);

  const rotaryBoltsInst = new THREE.InstancedMesh(boltGeo, chromeMat, rotaryBoltMatrices.length);
  rotaryBoltsInst.name = 'rotaryBoltsInstanced';
  rotaryBoltMatrices.forEach((mat, idx) => rotaryBoltsInst.setMatrixAt(idx, mat));
  rotaryBoltsInst.instanceMatrix.needsUpdate = true;
  rotaryBoltsInst.computeBoundingSphere();
  rotaryBarrelsGroup.add(rotaryBoltsInst);

  return rootGroup;
}

// ============================================================================
// Адаптер под единый просмотрщик: плавная раскрутка блока стволов 28 рад/с.
// applyAA(phase, firing, t): интеграция скорости, вспышки по стволам, свет.
// ============================================================================
export function createWeapon() {
  const root = createWeaponAK630M2Shkval();
  const ud = root.userData;
  const rotary = root.getObjectByName('rotaryBarrelsGroup');

  // Дульные вспышки: по одному спрайту на ствол (дети блока, вращаются вместе с ним)
  const flashCanvas = document.createElement('canvas');
  flashCanvas.width = 64;
  flashCanvas.height = 64;
  const fCtx = flashCanvas.getContext('2d');
  const grad = fCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.35, 'rgba(255, 200, 110, 0.85)');
  grad.addColorStop(1.0, 'rgba(255, 120, 20, 0.0)');
  fCtx.fillStyle = grad;
  fCtx.fillRect(0, 0, 64, 64);
  const flashTex = new THREE.CanvasTexture(flashCanvas);
  flashTex.colorSpace = THREE.SRGBColorSpace;

  const clusterR = 0.145;
  const flashSprites = [];
  for (let i = 0; i < BARREL_COUNT; i++) {
    const a = (i / BARREL_COUNT) * Math.PI * 2;
    const m = new THREE.SpriteMaterial({
      map: flashTex,
      color: 0xffc37a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const s = new THREE.Sprite(m);
    s.position.set(Math.cos(a) * clusterR, Math.sin(a) * clusterR, 2.66);
    s.scale.set(0.16, 0.16, 1);
    rotary.add(s);
    flashSprites.push(s);
  }

  const muzzleLight = new THREE.PointLight(0xffa63d, 0, 6.0, 1.7);
  muzzleLight.position.set(0, -0.42, 3.62);
  root.add(muzzleLight);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  // Состояние ротора (замыкание адаптера)
  let angle = 0;
  let vel = 0;
  let lastT = null;

  ud.applyAA = (phase, firing, t) => {
    let dt = lastT === null ? 0 : t - lastT;
    if (dt < 0 || dt > 0.25) dt = 0; // скраб слайдером / разрыв времени — без прыжка
    lastT = t;

    const target = firing ? SPIN_MAX : 0;
    const rate = target > vel ? SPIN_ACCEL : SPIN_DECEL;
    vel += Math.max(-rate * dt, Math.min(rate * dt, target - vel));
    angle += vel * dt;
    rotary.rotation.z = angle;

    // Вспышки: каждый ствол — один выстрел за оборот
    const rev = angle / (Math.PI * 2);
    let glow = 0;
    for (let i = 0; i < BARREL_COUNT; i++) {
      const sp = (((rev - i / BARREL_COUNT) % 1) + 1) % 1;
      const fl = firing && vel > 1 ? Math.max(0, 1 - sp / 0.12) : 0;
      flashSprites[i].material.opacity = fl * 0.9;
      const sc = 0.10 + fl * 0.12;
      flashSprites[i].scale.set(sc, sc, 1);
      glow += fl;
    }
    muzzleLight.intensity = firing ? 2.0 + glow * 3.0 : 0;
    root.position.z = firing && vel > 1 ? Math.sin(t * Math.PI * 2 * 40) * 0.0012 : 0;
  };

  ud.setExtension = (phase) => {
    const p = Math.max(0, Math.min(1, phase));
    angle = p * Math.PI * 2;
    vel = 0;
    lastT = null;
    rotary.rotation.z = angle;
    flashSprites.forEach((s) => { s.material.opacity = 0; });
    muzzleLight.intensity = 0;
    root.position.z = 0;
    return p;
  };

  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
