import * as THREE from 'three';

export const meta = {
  id: 'lpo50',
  code: 'ЛПО-50М',
  title: 'ЛПО-50М «Факел»',
  subtitle: 'ЛЁГКИЙ НАРУЧНЫЙ СТРУЙНЫЙ ОГНЕМЁТ • СЛОТ AUX • ДЛИНА 1.55 М',
  description:
    'Струйный огнемёт AUX-слота: плита УСП с полосами опасности, спаренные баллоны огнесмеси в защитной корзине, редуктор с манометром и красными вентилями, армированный шланг, брандспойт с шаровым клапаном, перфорированным кожухом и пиромеханическим поджигом на срезе форсунки.',
  specs: [
    ['Тип', 'Струйный огнемёт'],
    ['Слот', 'AUX'],
    ['Длина', '1.55 м (z −0.30…+1.25)'],
    ['Баки', '2 × огнесмесь, 25 атм'],
    ['Поджиг', 'Пиромеханический, 2 электрода'],
    ['Маркировка', 'ОГНЕОПАСНО / ЛПО-50М'],
  ],
  maxExtension: 1.0,
  unit: '%',
  tipOffset: 1.25,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'fuelTanksGroup', label: '2. Баллоны и арматура' },
    { key: 'nozzleGroup', label: '3. Брандспойт и форсунка' },
  ],
  cameras: {
    module: { pos: [1.55, 0.38, 1.75], target: [0, -0.16, 0.45] },
  },
  rangeMarkers: [],
  controls: 'beam',
};

/**
 * Создаёт процедурную 3D-модель лёгкого наручного струйного огнемёта
 * ЛПО-50М «Факел» (слот AUX).
 *
 * Система координат:
 * - 1 unit = 1 метр (общая длина ~1.55 м: от z = -0.30 до z = +1.25)
 * - Направление ствола: +Z, верх: +Y, бок: +X
 * - Точка привязки (0, 0, 0): центр верхнего стыковочного фланца УСП
 *
 * @returns {THREE.Group} Корневая группа модели с именованными подузлами
 */
export function createWeaponLPO50MFakel() {
  const root = new THREE.Group();
  root.name = 'LPO50M_Fakel';

  // ============================================================================
  // 1. ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (CanvasTexture, без внешних ассетов)
  // ============================================================================

  /** Жёлто-чёрная полоса опасности для стыковочного фланца УСП */
  function createHazardStripeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#d99e00';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#181a1c';
    const stripeWidth = 36;
    for (let x = -canvas.height; x < canvas.width + canvas.height; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth - canvas.height, canvas.height);
      ctx.lineTo(x - canvas.height, canvas.height);
      ctx.closePath();
      ctx.fill();
    }

    // Лёгкая эксплуатационная потёртость и грязь
    for (let i = 0; i < 650; i++) {
      const gx = Math.random() * canvas.width;
      const gy = Math.random() * canvas.height;
      const r = 1 + Math.random() * 2.5;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(30,32,28,0.22)' : 'rgba(220,210,180,0.12)';
      ctx.fillRect(gx, gy, r, r);
    }

    // Тёмная металлическая окантовка по краям
    ctx.fillStyle = '#25282c';
    ctx.fillRect(0, 0, canvas.width, 10);
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  /** Текстура баллонов: тёмно-оливковый металл + красные полосы + трафарет «ОГНЕОПАСНО / ЛПО-50М» */
  function createFuelTankTexture(mirrorSide = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Базовый цвет баллона (#3d4538)
    ctx.fillStyle = '#3d4538';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Неоднородность краски и следы масла
    for (let i = 0; i < 2400; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const w = 2 + Math.random() * 14;
      const h = 1 + Math.random() * 3;
      ctx.fillStyle = Math.random() > 0.45 ? 'rgba(20, 24, 18, 0.14)' : 'rgba(88, 98, 82, 0.10)';
      ctx.fillRect(x, y, w, h);
    }

    // Красные технические полосы (по высоте текстуры = вдоль оси цилиндра)
    ctx.fillStyle = '#a3241e';
    ctx.fillRect(0, 56, canvas.width, 34);
    ctx.fillRect(0, canvas.height - 90, canvas.width, 34);

    // Тонкие белые контрольные риски у полос
    ctx.fillStyle = 'rgba(235, 232, 220, 0.72)';
    ctx.fillRect(0, 52, canvas.width, 3);
    ctx.fillRect(0, canvas.height - 55, canvas.width, 3);

    // Трафаретная маркировка на внешней боковой-верхней образующей
    const drawStencilBlock = (centerX) => {
      ctx.save();
      ctx.translate(centerX, canvas.height * 0.5);

      ctx.fillStyle = 'rgba(236, 232, 218, 0.88)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = 'bold 42px "Courier New", monospace';
      ctx.fillText('ОГНЕОПАСНО', 0, -34);

      ctx.fillStyle = '#c93028';
      ctx.fillRect(-155, -4, 310, 5);

      ctx.fillStyle = 'rgba(236, 232, 218, 0.88)';
      ctx.font = 'bold 34px "Courier New", monospace';
      ctx.fillText('ЛПО-50М', 0, 30);

      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillStyle = 'rgba(210, 208, 195, 0.72)';
      ctx.fillText('Р раб. 25 АТМ  //  СМЕСЬ ОГН', 0, 68);
      ctx.restore();
    };

    // Размещаем надпись на наружной стороне (для левого и правого баллона)
    drawStencilBlock(mirrorSide ? canvas.width * 0.72 : canvas.width * 0.28);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  /** Карта прозрачности (alphaMap) для перфорированного теплозащитного кожуха ствола */
  function createPerforatedShieldAlphaTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Белый = непрозрачный металл кожуха
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Чёрный = сквозные вентиляционные прорези
    ctx.fillStyle = '#000000';
    const cols = 12;
    const rows = 10;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    for (let r = 0; r < rows; r++) {
      // Сплошные неперфорированные пояски по краям кожуха
      if (r === 0 || r === rows - 1) continue;
      const offsetX = (r % 2) * (cellW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const cx = c * cellW + offsetX + cellW * 0.5;
        const cy = r * cellH + cellH * 0.5;
        const slotW = cellW * 0.44;
        const slotH = cellH * 0.58;

        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cx - slotW * 0.5, cy - slotH * 0.5, slotW, slotH, slotW * 0.45);
        else ctx.rect(cx - slotW * 0.5, cy - slotH * 0.5, slotW, slotH);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  /** Циферблат манометра редуктора давления */
  function createGaugeDialTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const cx = 128;
    const cy = 128;

    // Старая эмалевая шкала
    ctx.fillStyle = '#e7e2cf';
    ctx.beginPath();
    ctx.arc(cx, cy, 122, 0, Math.PI * 2);
    ctx.fill();

    // Красный сектор критического давления
    ctx.strokeStyle = '#b8251e';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 94, -0.35, 0.72);
    ctx.stroke();

    // Деления шкалы
    ctx.strokeStyle = '#1b1d1f';
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI * 0.75 + (i / 20) * Math.PI * 1.5;
      const isMajor = i % 5 === 0;
      const r1 = isMajor ? 82 : 90;
      const r2 = 104;
      ctx.lineWidth = isMajor ? 3.5 : 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }

    ctx.fillStyle = '#1b1d1f';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('АТМ', cx, cy + 54);

    // Стрелка манометра (рабочее давление ~25 атм)
    const needleAngle = -0.42;
    ctx.strokeStyle = '#141517';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(needleAngle) * 18, cy - Math.sin(needleAngle) * 18);
    ctx.lineTo(cx + Math.cos(needleAngle) * 86, cy + Math.sin(needleAngle) * 86);
    ctx.stroke();

    ctx.fillStyle = '#2c3034';
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Текстура металлической оплётки армированного термостойкого шланга */
  function createBraidedHoseTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#25282b';
    ctx.fillRect(0, 0, 256, 256);

    ctx.lineWidth = 5;
    for (let i = -256; i < 512; i += 16) {
      ctx.strokeStyle = '#3b4045';
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.stroke();

      ctx.strokeStyle = '#191b1d';
      ctx.beginPath();
      ctx.moveTo(i + 256, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(18, 3);
    return tex;
  }

  // ============================================================================
  // 2. PBR-МАТЕРИАЛЫ
  // ============================================================================

  // Рама и кожух ствола: защитный хаки
  const khakiFrameMat = new THREE.MeshStandardMaterial({
    color: 0x4b5346,
    metalness: 0.45,
    roughness: 0.65,
  });

  // Перфорированный кожух ствола (двусторонний, с альфа-вырезами)
  const perforatedShieldMat = new THREE.MeshStandardMaterial({
    color: 0x4b5346,
    metalness: 0.45,
    roughness: 0.65,
    alphaMap: createPerforatedShieldAlphaTexture(),
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });

  // Баллоны огнесмеси: матовый тёмно-оливковый металл (сферы торцов)
  const tankOliveMat = new THREE.MeshStandardMaterial({
    color: 0x3d4538,
    metalness: 0.55,
    roughness: 0.50,
  });

  // Цилиндрическая часть баллонов с трафаретом и красными полосами
  const tankBodyLeftMat = new THREE.MeshStandardMaterial({
    map: createFuelTankTexture(false),
    metalness: 0.55,
    roughness: 0.50,
  });
  const tankBodyRightMat = new THREE.MeshStandardMaterial({
    map: createFuelTankTexture(true),
    metalness: 0.55,
    roughness: 0.50,
  });

  // Форсунка и электроды: закопчённая воронёная сталь
  const sootedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x23262a,
    metalness: 0.85,
    roughness: 0.40,
  });

  // Вспомогательные конструкционные материалы
  const darkGunmetalMat = new THREE.MeshStandardMaterial({
    color: 0x2d3237,
    metalness: 0.78,
    roughness: 0.44,
  });

  const brassFittingMat = new THREE.MeshStandardMaterial({
    color: 0x94793c,
    metalness: 0.82,
    roughness: 0.36,
  });

  const redValveMat = new THREE.MeshStandardMaterial({
    color: 0xb5241e,
    metalness: 0.35,
    roughness: 0.42,
  });

  const ceramicInsulatorMat = new THREE.MeshStandardMaterial({
    color: 0x827360,
    metalness: 0.06,
    roughness: 0.34,
  });

  const hazardStripeMat = new THREE.MeshStandardMaterial({
    map: createHazardStripeTexture(),
    metalness: 0.30,
    roughness: 0.58,
  });

  const hoseTex = createBraidedHoseTexture();
  const braidedHoseMat = new THREE.MeshStandardMaterial({
    map: hoseTex,
    bumpMap: hoseTex,
    bumpScale: 0.0025,
    metalness: 0.42,
    roughness: 0.68,
  });

  const gaugeFaceMat = new THREE.MeshStandardMaterial({
    map: createGaugeDialTexture(),
    metalness: 0.1,
    roughness: 0.3,
  });

  // Вспомогательная функция создания стержня/трубы между двумя точками
  function createStrutBetween(p1, p2, radius, material, radialSegments = 12) {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    const geom = new THREE.CylinderGeometry(radius, radius, len, radialSegments);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.copy(p1).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // ============================================================================
  // 3. УЗЕЛ 1: СТЫКОВОЧНЫЙ УЗЕЛ УСП (mountFlange)
  // ============================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Основная стальная плита УСП в (0, 0, 0) размером 0.36 x 0.10 x 0.55 м
  const plateWidth = 0.36;
  const plateHeight = 0.10;
  const plateLength = 0.55;

  const mainPlate = new THREE.Mesh(
    new THREE.BoxGeometry(plateWidth, plateHeight, plateLength),
    khakiFrameMat
  );
  mainPlate.position.set(0, 0, 0);
  mainPlate.castShadow = true;
  mainPlate.receiveShadow = true;
  mountFlange.add(mainPlate);

  // Верхние направляющие шпонки/полозья стыковки УСП
  for (const sx of [-0.11, 0.11]) {
    const guideRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.012, plateLength - 0.04),
      darkGunmetalMat
    );
    guideRail.position.set(sx, plateHeight * 0.5 + 0.006, 0);
    guideRail.castShadow = true;
    mountFlange.add(guideRail);
  }

  // Боковые и торцевые накладки с жёлто-чёрной полосой опасности (CanvasTexture)
  for (const side of [-1, 1]) {
    const sideHazard = new THREE.Mesh(
      new THREE.BoxGeometry(0.004, 0.046, plateLength - 0.04),
      hazardStripeMat
    );
    sideHazard.position.set(side * (plateWidth * 0.5 + 0.002), 0.005, 0);
    mountFlange.add(sideHazard);

    const endHazard = new THREE.Mesh(
      new THREE.BoxGeometry(plateWidth - 0.04, 0.042, 0.004),
      hazardStripeMat
    );
    endHazard.position.set(0, 0.005, side * (plateLength * 0.5 + 0.002));
    mountFlange.add(endHazard);
  }

  // 4 силовых замка УСП по углам плиты
  const lockPositions = [
    [-0.145, 0.195],
    [0.145, 0.195],
    [-0.145, -0.195],
    [0.145, -0.195],
  ];

  lockPositions.forEach(([lx, lz]) => {
    const lockGroup = new THREE.Group();
    lockGroup.position.set(lx, 0, lz);

    // Цилиндрический корпус замка
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, plateHeight + 0.024, 16),
      darkGunmetalMat
    );
    barrel.castShadow = true;
    lockGroup.add(barrel);

    // Верхняя шестигранная головка стяжного болта
    const topHex = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.014, 6),
      sootedSteelMat
    );
    topHex.position.y = plateHeight * 0.5 + 0.016;
    lockGroup.add(topHex);

    // Нижняя стопорная гайка
    const botNut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.020, 0.020, 0.016, 6),
      sootedSteelMat
    );
    botNut.position.y = -plateHeight * 0.5 - 0.014;
    lockGroup.add(botNut);

    // Боковой эксцентриковый рычаг-фиксатор
    const sideSign = Math.sign(lx);
    const camLever = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.032, 0.048),
      sootedSteelMat
    );
    camLever.position.set(sideSign * 0.036, -0.012, 0);
    lockGroup.add(camLever);

    mountFlange.add(lockGroup);
  });

  // 4 подвесных кронштейна от плиты УСП вниз к раме баллонов
  for (const sx of [-0.155, 0.155]) {
    for (const sz of [-0.21, 0.21]) {
      const hanger = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.088, 0.036),
        khakiFrameMat
      );
      hanger.position.set(sx, -0.092, sz);
      hanger.castShadow = true;
      mountFlange.add(hanger);
    }
  }

  // ============================================================================
  // 4. УЗЕЛ 2: СПАРЕННЫЕ БАЛЛОНЫ ОГНЕСМЕСИ И АРМАТУРА (fuelTanksGroup)
  // ============================================================================
  const fuelTanksGroup = new THREE.Group();
  fuelTanksGroup.name = 'fuelTanksGroup';
  root.add(fuelTanksGroup);

  const tankRadius = 0.088;
  const tankCylLen = 0.36;
  const tankCenterY = -0.225;
  const tankCenterZ = -0.01;
  const tankOffsetX = 0.104;

  // Два параллельных цилиндрических баллона со сферическими торцами
  [-tankOffsetX, tankOffsetX].forEach((tx, idx) => {
    const tankUnit = new THREE.Group();
    tankUnit.position.set(tx, tankCenterY, tankCenterZ);

    // Открытый цилиндр для корректной развёртки трафарета и полос
    const cylGeom = new THREE.CylinderGeometry(tankRadius, tankRadius, tankCylLen, 32, 1, true);
    cylGeom.rotateX(Math.PI * 0.5);
    // Ориентируем текстуру так, чтобы надпись смотрела вверх-наружу
    cylGeom.rotateZ(idx === 0 ? -Math.PI * 0.28 : Math.PI * 0.28);

    const cylMesh = new THREE.Mesh(
      cylGeom,
      idx === 0 ? tankBodyLeftMat : tankBodyRightMat
    );
    cylMesh.castShadow = true;
    cylMesh.receiveShadow = true;
    tankUnit.add(cylMesh);

    // Сферические торцы (передний и задний) + сварные кольца
    [-1, 1].forEach((endDir) => {
      const domeGeom = new THREE.SphereGeometry(
        tankRadius,
        32,
        16,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.5
      );
      domeGeom.rotateX(endDir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
      const domeMesh = new THREE.Mesh(domeGeom, tankOliveMat);
      domeMesh.position.z = endDir * (tankCylLen * 0.5);
      domeMesh.castShadow = true;
      domeMesh.receiveShadow = true;
      tankUnit.add(domeMesh);

      // Сварной шов-бандаж на стыке сферы и цилиндра
      const weldRing = new THREE.Mesh(
        new THREE.TorusGeometry(tankRadius + 0.0015, 0.003, 10, 32),
        tankOliveMat
      );
      weldRing.position.z = endDir * (tankCylLen * 0.5);
      tankUnit.add(weldRing);
    });

    // Заливная горловина с гранёной латунной пробкой в задней части сверху
    const fillBoss = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.026, 12),
      darkGunmetalMat
    );
    fillBoss.position.set(0, tankRadius + 0.008, -0.13);
    tankUnit.add(fillBoss);

    const fillPlug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.014, 6),
      brassFittingMat
    );
    fillPlug.position.set(0, tankRadius + 0.025, -0.13);
    tankUnit.add(fillPlug);

    fuelTanksGroup.add(tankUnit);
  });

  // Защитная стальная рама-корзина вокруг баллонов
  const cageGroup = new THREE.Group();
  cageGroup.name = 'protectiveCage';
  fuelTanksGroup.add(cageGroup);

  const railR = 0.011;
  const frameZBack = -0.30;
  const frameZFront = 0.295;
  const upperY = -0.135;
  const lowerY = -0.326;
  const sideUpperX = 0.210;
  const sideLowerX = 0.192;

  // Верхние и нижние продольные лонжероны + центральная балка
  for (const sx of [-1, 1]) {
    cageGroup.add(
      createStrutBetween(
        new THREE.Vector3(sx * sideUpperX, upperY, frameZBack),
        new THREE.Vector3(sx * sideUpperX, upperY, frameZFront),
        railR,
        khakiFrameMat
      )
    );
    cageGroup.add(
      createStrutBetween(
        new THREE.Vector3(sx * sideLowerX, lowerY, frameZBack + 0.02),
        new THREE.Vector3(sx * sideLowerX, lowerY, frameZFront - 0.02),
        railR,
        khakiFrameMat
      )
    );
  }
  // Центральная несущая балка корзины
  cageGroup.add(
    createStrutBetween(
      new THREE.Vector3(0, upperY, frameZBack),
      new THREE.Vector3(0, upperY, frameZFront + 0.02),
      railR * 1.15,
      khakiFrameMat
    )
  );

  // Поперечные силовые дуги (передняя, средняя, задняя)
  for (const fz of [frameZBack, -0.01, frameZFront]) {
    const isEnd = fz !== -0.01;
    const ux = isEnd ? sideUpperX : sideUpperX + 0.004;
    const lx = isEnd ? sideLowerX : sideLowerX + 0.004;

    // Верхняя поперечина
    cageGroup.add(
      createStrutBetween(
        new THREE.Vector3(-ux, upperY, fz),
        new THREE.Vector3(ux, upperY, fz),
        railR,
        khakiFrameMat
      )
    );
    // Нижняя поперечина
    cageGroup.add(
      createStrutBetween(
        new THREE.Vector3(-lx, lowerY, fz),
        new THREE.Vector3(lx, lowerY, fz),
        railR,
        khakiFrameMat
      )
    );
    // Боковые стойки
    for (const sx of [-1, 1]) {
      cageGroup.add(
        createStrutBetween(
          new THREE.Vector3(sx * ux, upperY, fz),
          new THREE.Vector3(sx * lx, lowerY, fz),
          railR,
          khakiFrameMat
        )
      );
    }
  }

  // Стальные стяжные ленты-хомуты, фиксирующие оба баллона в корзине
  for (const strapZ of [-0.11, 0.09]) {
    for (const sx of [-1, 1]) {
      const strap = new THREE.Mesh(
        new THREE.CylinderGeometry(tankRadius + 0.004, tankRadius + 0.004, 0.026, 28, 1, true),
        darkGunmetalMat
      );
      strap.rotation.x = Math.PI * 0.5;
      strap.position.set(sx * tankOffsetX, tankCenterY, strapZ);
      strap.material = darkGunmetalMat.clone();
      strap.material.side = THREE.DoubleSide;
      cageGroup.add(strap);
    }
    // Центральный стяжной замок хомутов
    const tensionBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.032, 0.032),
      sootedSteelMat
    );
    tensionBlock.position.set(0, tankCenterY, strapZ);
    cageGroup.add(tensionBlock);
  }

  // Узел редуктора давления, красных вентилей и манометра
  const regulatorGroup = new THREE.Group();
  regulatorGroup.name = 'pressureRegulatorAssembly';
  fuelTanksGroup.add(regulatorGroup);

  const frontCapZ = tankCenterZ + tankCylLen * 0.5 + tankRadius; // ~0.258

  // Выпускные штуцеры и красные вентили на обоих баллонах
  [-tankOffsetX, tankOffsetX].forEach((tx) => {
    // Выходной патрубок из переднего сферического торца
    const outletPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.014, 0.048, 14),
      brassFittingMat
    );
    outletPipe.rotation.x = Math.PI * 0.5;
    outletPipe.position.set(tx, tankCenterY, frontCapZ + 0.018);
    regulatorGroup.add(outletPipe);

    // Вертикальный корпус вентиля и шток
    const valveBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.085, 14),
      brassFittingMat
    );
    valveBody.position.set(tx, tankCenterY + 0.048, frontCapZ + 0.012);
    regulatorGroup.add(valveBody);

    // Красный маховик вентиля (обод + 4 спицы)
    const wheelY = tankCenterY + 0.095;
    const wheelZ = frontCapZ + 0.012;
    const wheelRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.028, 0.0045, 10, 24),
      redValveMat
    );
    wheelRim.rotation.x = Math.PI * 0.5;
    wheelRim.position.set(tx, wheelY, wheelZ);
    wheelRim.castShadow = true;
    regulatorGroup.add(wheelRim);

    for (let s = 0; s < 2; s++) {
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0028, 0.0028, 0.054, 8),
        redValveMat
      );
      spoke.rotation.z = Math.PI * 0.5;
      spoke.rotation.y = s * Math.PI * 0.5;
      spoke.position.set(tx, wheelY, wheelZ);
      regulatorGroup.add(spoke);
    }

    // Соединительная трубка от баллона к центральному коллектору
    regulatorGroup.add(
      createStrutBetween(
        new THREE.Vector3(tx, tankCenterY, frontCapZ + 0.036),
        new THREE.Vector3(0, tankCenterY + 0.005, frontCapZ + 0.055),
        0.009,
        brassFittingMat
      )
    );
  });

  // Центральный коллектор и редуктор давления
  const manifoldPos = new THREE.Vector3(0, tankCenterY + 0.005, frontCapZ + 0.058);
  const manifoldBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.054, 0.048),
    darkGunmetalMat
  );
  manifoldBlock.position.copy(manifoldPos);
  manifoldBlock.castShadow = true;
  regulatorGroup.add(manifoldBlock);

  // Мембранный колокол редуктора давления (выступает вперёд)
  const reducerBell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.034, 0.036, 20),
    brassFittingMat
  );
  reducerBell.rotation.x = Math.PI * 0.5;
  reducerBell.position.set(0, manifoldPos.y, manifoldPos.z + 0.038);
  reducerBell.castShadow = true;
  regulatorGroup.add(reducerBell);

  // Регулировочный винт с Т-воротком на редукторе
  const adjScrew = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.026, 10),
    sootedSteelMat
  );
  adjScrew.rotation.x = Math.PI * 0.5;
  adjScrew.position.set(0, manifoldPos.y, manifoldPos.z + 0.064);
  regulatorGroup.add(adjScrew);

  const tBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0035, 0.0035, 0.034, 8),
    sootedSteelMat
  );
  tBar.rotation.z = Math.PI * 0.5;
  tBar.position.set(0, manifoldPos.y, manifoldPos.z + 0.074);
  regulatorGroup.add(tBar);

  // Манометр давления с процедурным циферблатом
  const gaugeGroup = new THREE.Group();
  gaugeGroup.position.set(-0.048, manifoldPos.y + 0.048, manifoldPos.z + 0.012);
  gaugeGroup.rotation.set(-0.32, -0.45, 0.15);

  const gaugeStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.006, 0.032, 10),
    brassFittingMat
  );
  gaugeStem.position.y = -0.024;
  gaugeGroup.add(gaugeStem);

  const gaugeCase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.018, 24),
    sootedSteelMat
  );
  gaugeCase.rotation.x = Math.PI * 0.5;
  gaugeCase.castShadow = true;
  gaugeGroup.add(gaugeCase);

  const gaugeBezel = new THREE.Mesh(
    new THREE.TorusGeometry(0.025, 0.0028, 10, 24),
    brassFittingMat
  );
  gaugeBezel.position.z = 0.009;
  gaugeGroup.add(gaugeBezel);

  const gaugeDial = new THREE.Mesh(
    new THREE.CircleGeometry(0.024, 24),
    gaugeFaceMat
  );
  gaugeDial.position.z = 0.0095;
  gaugeGroup.add(gaugeDial);

  regulatorGroup.add(gaugeGroup);

  // Армированный термостойкий шланг (TubeGeometry) от редуктора к шаровому клапану ствола
  const barrelAxisY = -0.115;
  const hoseStart = new THREE.Vector3(0, manifoldPos.y - 0.028, manifoldPos.z + 0.018);
  const hoseEnd = new THREE.Vector3(0, barrelAxisY - 0.036, 0.62);

  const hoseCurve = new THREE.CatmullRomCurve3([
    hoseStart,
    new THREE.Vector3(0.018, -0.295, 0.40),
    new THREE.Vector3(0.022, -0.275, 0.51),
    new THREE.Vector3(0.006, -0.195, 0.59),
    hoseEnd,
  ]);

  const hoseMesh = new THREE.Mesh(
    new THREE.TubeGeometry(hoseCurve, 40, 0.0145, 14, false),
    braidedHoseMat
  );
  hoseMesh.castShadow = true;
  hoseMesh.receiveShadow = true;
  fuelTanksGroup.add(hoseMesh);

  // Латунные обжимные штуцеры и стальные хомуты на шланге
  [0.03, 0.97].forEach((t) => {
    const pt = hoseCurve.getPoint(t);
    const tangent = hoseCurve.getTangent(t);
    const nut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.019, 0.024, 6),
      brassFittingMat
    );
    nut.position.copy(pt);
    nut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    fuelTanksGroup.add(nut);
  });

  [0.25, 0.52, 0.78].forEach((t) => {
    const pt = hoseCurve.getPoint(t);
    const tangent = hoseCurve.getTangent(t);
    const clamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.010, 16),
      sootedSteelMat
    );
    clamp.position.copy(pt);
    clamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    fuelTanksGroup.add(clamp);
  });

  // ============================================================================
  // 5. УЗЕЛ 3: БРАНДСПОЙТ, ШАРОВОЙ КЛАПАН И ФОРСУНКА ПОДЖИГА (nozzleGroup)
  // ============================================================================
  const nozzleGroup = new THREE.Group();
  nozzleGroup.name = 'nozzleGroup';
  root.add(nozzleGroup);

  // Консольная ферма-кронштейн от плиты УСП и рамы к казённику ствола
  for (const sx of [-0.042, 0.042]) {
    nozzleGroup.add(
      createStrutBetween(
        new THREE.Vector3(sx * 1.4, -0.045, 0.275),
        new THREE.Vector3(sx, barrelAxisY, 0.60),
        0.011,
        khakiFrameMat
      )
    );
    nozzleGroup.add(
      createStrutBetween(
        new THREE.Vector3(sx, upperY, frameZFront),
        new THREE.Vector3(sx, barrelAxisY, 0.62),
        0.010,
        khakiFrameMat
      )
    );
  }

  // Шаровой клапан-затвор (z = 0.57 .. 0.67)
  const valveGroup = new THREE.Group();
  valveGroup.name = 'ballValveBreech';
  valveGroup.position.set(0, barrelAxisY, 0.62);
  nozzleGroup.add(valveGroup);

  // Сферический корпус шарового крана
  const valveSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 24, 18),
    darkGunmetalMat
  );
  valveSphere.castShadow = true;
  valveGroup.add(valveSphere);

  // Проходной патрубок и стяжные фланцы клапана
  const valvePipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.095, 20),
    darkGunmetalMat
  );
  valvePipe.rotation.x = Math.PI * 0.5;
  valveGroup.add(valvePipe);

  for (const fz of [-0.042, 0.042]) {
    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.012, 16),
      sootedSteelMat
    );
    flange.rotation.x = Math.PI * 0.5;
    flange.position.z = fz;
    valveGroup.add(flange);
  }

  // Нижний входной штуцер под шланг
  const bottomInlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.019, 0.036, 14),
    brassFittingMat
  );
  bottomInlet.position.set(0, -0.032, 0);
  valveGroup.add(bottomInlet);

  // Боковой электропневматический привод затвора и рычаг
  const actuatorCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.088, 16),
    sootedSteelMat
  );
  actuatorCyl.rotation.x = Math.PI * 0.5;
  actuatorCyl.position.set(0.048, 0.008, -0.01);
  actuatorCyl.castShadow = true;
  valveGroup.add(actuatorCyl);

  const valveLever = new THREE.Mesh(
    new THREE.BoxGeometry(0.046, 0.012, 0.014),
    redValveMat
  );
  valveLever.position.set(0.026, 0.024, 0.012);
  valveGroup.add(valveLever);

  // Внутренний ствол-трубка высокого давления (от z = 0.665 до z = 1.13)
  const barrelStartZ = 0.665;
  const barrelEndZ = 1.13;
  const barrelLen = barrelEndZ - barrelStartZ;

  const innerBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.018, barrelLen, 20),
    sootedSteelMat
  );
  innerBarrel.rotation.x = Math.PI * 0.5;
  innerBarrel.position.set(0, barrelAxisY, barrelStartZ + barrelLen * 0.5);
  innerBarrel.castShadow = true;
  nozzleGroup.add(innerBarrel);

  // Перфорированный теплозащитный кожух ствола (z = 0.69 .. 1.09)
  const shieldStartZ = 0.69;
  const shieldEndZ = 1.09;
  const shieldLen = shieldEndZ - shieldStartZ;
  const shieldRadius = 0.034;

  const heatShield = new THREE.Mesh(
    new THREE.CylinderGeometry(shieldRadius, shieldRadius, shieldLen, 32, 1, true),
    perforatedShieldMat
  );
  heatShield.rotation.x = Math.PI * 0.5;
  heatShield.position.set(0, barrelAxisY, shieldStartZ + shieldLen * 0.5);
  heatShield.castShadow = true;
  heatShield.receiveShadow = true;
  nozzleGroup.add(heatShield);

  // Усилительные хомуты-кольца на теплозащитном кожухе
  [shieldStartZ, 0.89, shieldEndZ].forEach((ringZ) => {
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(shieldRadius + 0.003, shieldRadius + 0.003, 0.016, 28),
      khakiFrameMat
    );
    collar.rotation.x = Math.PI * 0.5;
    collar.position.set(0, barrelAxisY, ringZ);
    collar.castShadow = true;
    nozzleGroup.add(collar);
  });

  // Нижняя тяга жёсткости ствола
  nozzleGroup.add(
    createStrutBetween(
      new THREE.Vector3(0, barrelAxisY - 0.036, 0.655),
      new THREE.Vector3(0, barrelAxisY - shieldRadius - 0.003, 0.89),
      0.0065,
      khakiFrameMat
    )
  );

  // Массивный раструб-форсунка (LatheGeometry с толстыми стенками и рёбрами охлаждения)
  // Профиль задаётся от z = 1.09 до z = 1.225
  const nozzlePoints = [
    new THREE.Vector2(0.017, 0.000), // Внутренний канал (начало)
    new THREE.Vector2(0.041, 0.000), // Задняя муфта
    new THREE.Vector2(0.041, 0.022),
    // 3 массивных радиаторных ребра охлаждения
    new THREE.Vector2(0.047, 0.025),
    new THREE.Vector2(0.047, 0.031),
    new THREE.Vector2(0.037, 0.033),
    new THREE.Vector2(0.047, 0.037),
    new THREE.Vector2(0.047, 0.043),
    new THREE.Vector2(0.037, 0.045),
    new THREE.Vector2(0.047, 0.049),
    new THREE.Vector2(0.047, 0.055),
    // Шейка форсунки
    new THREE.Vector2(0.032, 0.062),
    new THREE.Vector2(0.032, 0.080),
    // Расширяющийся раструб-диффузор
    new THREE.Vector2(0.052, 0.128),
    new THREE.Vector2(0.052, 0.135), // Срез дула (z = 1.09 + 0.135 = 1.225)
    new THREE.Vector2(0.042, 0.135), // Толщина кромки раструба
    new THREE.Vector2(0.024, 0.082), // Внутренний конус сопла
    new THREE.Vector2(0.017, 0.055),
  ];

  const nozzleGeom = new THREE.LatheGeometry(nozzlePoints, 32);
  nozzleGeom.rotateX(Math.PI * 0.5);
  const nozzleBell = new THREE.Mesh(nozzleGeom, sootedSteelMat);
  nozzleBell.position.set(0, barrelAxisY, 1.09);
  nozzleBell.castShadow = true;
  nozzleBell.receiveShadow = true;
  nozzleGroup.add(nozzleBell);

  // Центральный рассекатель-распилитель струи внутри раструба
  const pintleCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.013, 0.036, 16),
    sootedSteelMat
  );
  pintleCone.rotation.x = Math.PI * 0.5;
  pintleCone.position.set(0, barrelAxisY, 1.185);
  nozzleGroup.add(pintleCone);

  // Два электрода пиромеханического поджига на срезе форсунки (доходят до z = 1.25)
  const igniterGroup = new THREE.Group();
  igniterGroup.name = 'pyroIgniterAssembly';
  nozzleGroup.add(igniterGroup);

  [-1, 1].forEach((side) => {
    const holderX = side * 0.047;

    // Боковой хомут-кронштейн на муфте форсунки
    const clampLug = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.022, 0.028),
      sootedSteelMat
    );
    clampLug.position.set(holderX, barrelAxisY, 1.115);
    clampLug.castShadow = true;
    igniterGroup.add(clampLug);

    // Ребристый керамический высоковольтный изолятор
    const insulator = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0085, 0.010, 0.058, 16),
      ceramicInsulatorMat
    );
    insulator.rotation.x = Math.PI * 0.5;
    insulator.position.set(holderX, barrelAxisY, 1.158);
    igniterGroup.add(insulator);

    for (let r = 0; r < 3; r++) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(0.0095, 0.002, 8, 16),
        ceramicInsulatorMat
      );
      rib.position.set(holderX, barrelAxisY, 1.142 + r * 0.015);
      igniterGroup.add(rib);
    }

    // Прямой участок электрода до z = 1.235
    igniterGroup.add(
      createStrutBetween(
        new THREE.Vector3(holderX, barrelAxisY, 1.186),
        new THREE.Vector3(holderX * 0.92, barrelAxisY, 1.238),
        0.0032,
        sootedSteelMat,
        10
      )
    );

    // Загнутый внутрь наконечник электрода с искровым зазором в точке z = 1.25
    igniterGroup.add(
      createStrutBetween(
        new THREE.Vector3(holderX * 0.92, barrelAxisY, 1.238),
        new THREE.Vector3(side * 0.014, barrelAxisY, 1.25),
        0.0026,
        sootedSteelMat,
        10
      )
    );
  });

  // Точка крепления дульной искры поджига (используется тестовой сценой / адаптером)
  const sparkAnchor = new THREE.Object3D();
  sparkAnchor.name = 'muzzleSparkAnchor';
  sparkAnchor.position.set(0, barrelAxisY, 1.25);
  nozzleGroup.add(sparkAnchor);
  root.userData.sparkAnchor = sparkAnchor;

  return root;
}

// ============================================================================
// Адаптер под единый просмотрщик (controls: 'beam').
// Слайдер/кнопка задают мощность струи 0..1, applyBeam(t) строит пульсацию
// пламени и возвращает { main, target } для телеметрии.
// ============================================================================
export function createWeapon() {
  const root = createWeaponLPO50MFakel();
  const ud = root.userData;
  const sparkAnchor = root.getObjectByName('muzzleSparkAnchor') || ud.sparkAnchor;

  // --- Струя огнесмеси: внешний конус + яркое ядро + свет + искра ---
  const flameGroup = new THREE.Group();
  flameGroup.name = 'flameJet';
  sparkAnchor.add(flameGroup);

  const outerGeo = new THREE.CylinderGeometry(0.155, 0.035, 1.7, 18, 6, true);
  outerGeo.rotateX(Math.PI * 0.5);
  outerGeo.translate(0, 0, 0.85);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xff6a00,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const outerJet = new THREE.Mesh(outerGeo, outerMat);
  flameGroup.add(outerJet);

  const coreGeo = new THREE.CylinderGeometry(0.07, 0.018, 1.15, 14, 4, true);
  coreGeo.rotateX(Math.PI * 0.5);
  coreGeo.translate(0, 0, 0.575);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const coreJet = new THREE.Mesh(coreGeo, coreMat);
  flameGroup.add(coreJet);

  // Искра поджига на срезе (маленький аддитивный спрайт)
  const flareCanvas = document.createElement('canvas');
  flareCanvas.width = 128;
  flareCanvas.height = 128;
  const fCtx = flareCanvas.getContext('2d');
  const grad = fCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.25, 'rgba(255, 220, 150, 0.9)');
  grad.addColorStop(0.55, 'rgba(255, 140, 30, 0.45)');
  grad.addColorStop(1.0, 'rgba(255, 90, 0, 0.0)');
  fCtx.fillStyle = grad;
  fCtx.fillRect(0, 0, 128, 128);
  const sparkTex = new THREE.CanvasTexture(flareCanvas);
  sparkTex.colorSpace = THREE.SRGBColorSpace;
  const sparkMat = new THREE.SpriteMaterial({
    map: sparkTex,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.0,
  });
  const sparkSprite = new THREE.Sprite(sparkMat);
  sparkSprite.scale.set(0.09, 0.09, 1);
  flameGroup.add(sparkSprite);

  const flameLight = new THREE.PointLight(0xff8a22, 0, 4.5, 1.8);
  flameLight.position.set(0, 0, 0.55);
  flameGroup.add(flameLight);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });
  allMats.add(outerMat);
  allMats.add(coreMat);

  ud.charge = 1;

  ud.applyBeam = (t) => {
    const s = ud.charge;
    // Детерминированная пульсация струи (без Math.random — стабильный кадр)
    const f1 = 0.5 + 0.5 * Math.sin(t * 31.0);
    const f2 = 0.5 + 0.5 * Math.sin(t * 57.0 + 1.3);
    const flick = 0.82 + 0.18 * (f1 * 0.6 + f2 * 0.4);
    const on = s > 0.02;

    flameGroup.visible = on;
    if (on) {
      const lenScale = (0.35 + 0.65 * s) * flick;
      flameGroup.scale.set(0.7 + 0.5 * s * flick, 0.7 + 0.5 * s * flick, lenScale);
      outerMat.opacity = Math.min(0.85, s * 0.75 * flick + 0.08);
      coreMat.opacity = Math.min(0.95, s * 0.9 * flick + 0.05);
      sparkMat.opacity = Math.min(1, 0.25 + s * 0.75);
      const sc = 0.06 + s * 0.07 * flick;
      sparkSprite.scale.set(sc, sc, 1);
      flameLight.intensity = s * (6 + 5 * flick);
    } else {
      flameLight.intensity = 0;
      outerMat.opacity = 0;
      coreMat.opacity = 0;
      sparkMat.opacity = 0;
    }
    return { main: s, target: s * flick };
  };

  ud.setExtension = (v) => {
    ud.charge = Math.max(0, Math.min(1, v));
    return ud.charge;
  };

  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => {
      if ('wireframe' in m) m.wireframe = enabled;
    });
  };

  return root;
}
