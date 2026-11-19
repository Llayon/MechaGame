import * as THREE from 'three';

export const meta = {
  id: 'rpot',
  code: 'РПО-Т',
  title: 'РПО-Т «Шмель-М»',
  subtitle: 'ЧЕТЫРЁХСТВОЛЬНЫЙ РЕАКТИВНЫЙ ТЕРМОБАРИЧЕСКИЙ ГРАНАТОМЁТ • СЛОТ MAIN • ЦИКЛ 5.4 С',
  description:
    'Четырёхствольный реактивный термобарический гранатомёт: фланец УСП с сигнальной разметкой, литой бронекожух-обойма 0.68×0.68 м с трафаретом «РПО-Т / ТЕРМОБАРИЧЕСКИЙ», коробка электроспуска 27В, перфорированные раструбы газоотвода и 4 ребристых ствола-мортира 93 мм с красными вышибными заглушками. Поочерёдный отстрел заглушек, затем перезарядка.',
  specs: [
    ['Калибр', '4 × 93 мм'],
    ['Боеприпас', 'Термобарический'],
    ['Порядок', 'Верх-лев → низ-прав → верх-прав → низ-лев'],
    ['Темп отстрела', '1 / 0.85 с'],
    ['Цикл залпа', '5.4 с'],
    ['Слот', 'MAIN'],
  ],
  maxExtension: 5.4,
  unit: 's',
  tipOffset: 1.06,
  salvoCount: 4,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'quadHousing', label: '2. Бронекожух-обойма и электроспуск' },
    { key: 'rearExhaustDiffusers', label: '3. Раструбы газоотвода' },
    { key: 'fourBarrelsGroup', label: '4. Пакет из 4 стволов-мортир' },
  ],
  cameras: {
    module: { pos: [1.75, 0.25, 2.05], target: [0, -0.45, 0.05] },
  },
  rangeMarkers: [],
  controls: 'salvo',
};

const SALVO_FIRST = 0.6;
const SALVO_INTERVAL = 0.85;
const SALVO_COUNT = 4;
const SALVO_ORDER = [0, 3, 1, 2]; // Верх-лев -> Низ-прав -> Верх-прав -> Низ-лев
const SALVO_CYCLE = 5.4;

// Детерминированные начальные скорости заглушек (вместо Math.random из стенда)
const CAP_VEL = [
  new THREE.Vector3(-0.30, 0.60, 5.2),
  new THREE.Vector3(0.30, 0.80, 5.6),
  new THREE.Vector3(-0.25, 0.50, 5.4),
  new THREE.Vector3(0.35, 0.90, 5.0),
];
const CAP_ANGVEL = [
  new THREE.Vector3(6.0, -4.0, 3.0),
  new THREE.Vector3(-5.0, 7.0, -4.0),
  new THREE.Vector3(4.0, 5.0, -3.0),
  new THREE.Vector3(-7.0, -3.0, 5.0),
];

// Мировой уровень пола полигона просмотрщика — для остановки заглушек
const WORLD_FLOOR_Y = -0.93;

/**
 * Создаёт процедурную PBR-модель четырёхствольного реактивного термобарического
 * гранатомёта РПО-Т «Шмель-М» (слот MAIN).
 *
 * Система координат:
 * - 1 unit = 1 метр
 * - Габариты пакета: ~0.68 (X) x 0.68 (Y) x 2.15 (Z) м (с УСП по высоте ~0.82 м)
 * - Направление стволов: +Z, верх: +Y, правый борт: +X
 * - Точка привязки (0, 0, 0): центр верхней плоскости стыковочного фланца УСП
 *
 * @returns {THREE.Group}
 */
export function createWeaponRPOTShmelM() {
  const root = new THREE.Group();
  root.name = 'RPOT_ShmelM_Main';

  // ============================================================================
  // 1. ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (CanvasTexture)
  // ============================================================================

  // 1.1. Микрорельеф литой брони и шероховатость (Bump / Roughness)
  function createMetalNoiseTexture(baseGray = 128, contrast = 32, streaks = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const imgData = ctx.createImageData(512, 512);
    const data = imgData.data;
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < data.length; i += 4) {
      const n = (rand() - 0.5) * contrast;
      const v = Math.max(0, Math.min(255, baseGray + n));
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    if (streaks) {
      // Намотка стекловолокна для тубусов стволов
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      for (let y = 0; y < 512; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y + 2);
        ctx.stroke();
      }
    } else {
      // Потёртости краски по кромкам
      ctx.strokeStyle = 'rgba(210, 210, 210, 0.08)';
      for (let i = 0; i < 90; i++) {
        ctx.lineWidth = 1 + rand() * 2;
        ctx.beginPath();
        const x = rand() * 512;
        const y = rand() * 512;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 40, y + (rand() - 0.5) * 40);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  // 1.2. Жёлто-чёрная сигнальная разметка УСП
  function createHazardStripeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Базовый технический жёлтый (#c49a27)
    ctx.fillStyle = '#c49a27';
    ctx.fillRect(0, 0, 1024, 256);

    // Чёрные диагональные полосы
    ctx.fillStyle = '#1b1d1a';
    const stripeW = 48;
    for (let x = -256; x < 1280; x += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW - 140, 256);
      ctx.lineTo(x - 140, 256);
      ctx.closePath();
      ctx.fill();
    }

    // Тёмная металлическая окантовка сверху и снизу
    ctx.fillStyle = '#2a2e28';
    ctx.fillRect(0, 0, 1024, 24);
    ctx.fillRect(0, 232, 1024, 24);

    // Трафаретная плашка по центру
    ctx.fillStyle = '#383f34';
    ctx.fillRect(362, 54, 300, 148);
    ctx.strokeStyle = '#c49a27';
    ctx.lineWidth = 4;
    ctx.strokeRect(366, 58, 292, 140);

    ctx.fillStyle = '#e4dec8';
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('УСП-М // ЗАМОК', 512, 105);
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.fillStyle = '#c49a27';
    ctx.fillText('КОНТРОЛЬ СТЫКОВКИ', 512, 155);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // 1.3. Трафаретная маркировка бронекожуха «РПО-Т / ТЕРМОБАРИЧЕСКИЙ»
  function createHousingStencilTexture(mirrorText = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Фон советский защитный хаки (#4a5344)
    ctx.fillStyle = '#4a5344';
    ctx.fillRect(0, 0, 1024, 512);

    // Лёгкая фактура краски
    for (let i = 0; i < 3500; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.035)';
      ctx.fillRect(Math.random() * 1024, Math.random() * 512, 4, 4);
    }

    if (mirrorText) {
      ctx.translate(1024, 0);
      ctx.scale(-1, 1);
    }

    // Тактические полосы (красная и жёлтая) в передней части
    ctx.fillStyle = '#a83228';
    ctx.fillRect(790, 28, 34, 456);
    ctx.fillStyle = '#c49a27';
    ctx.fillRect(838, 28, 18, 456);

    // Рамка трафарета
    ctx.strokeStyle = 'rgba(228, 224, 206, 0.72)';
    ctx.lineWidth = 4;
    ctx.strokeRect(64, 56, 680, 400);

    // Главный трафарет: РПО-Т
    ctx.fillStyle = 'rgba(232, 228, 210, 0.88)';
    ctx.font = 'bold 126px "Impact", "Arial Black", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('РПО-Т', 96, 82);

    // Подзаголовок: ТЕРМОБАРИЧЕСКИЙ
    ctx.font = 'bold 46px "Courier New", monospace';
    ctx.fillStyle = '#e5c158';
    ctx.fillText('ТЕРМОБАРИЧЕСКИЙ', 98, 228);

    // Технические индексы
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillStyle = 'rgba(225, 222, 205, 0.78)';
    ctx.fillText('БЛОК 4x93 ММ  //  ИНД. 9П132-Т', 98, 305);
    ctx.fillText('ОГНЕОПАСНО • ЭЛЕКТРОСПУСК 27В', 98, 352);

    // Знак радиационной/термической опасности (стилизованный треугольник)
    ctx.strokeStyle = '#a83228';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(645, 95);
    ctx.lineTo(705, 195);
    ctx.lineTo(585, 195);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#e5c158';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 645, 142);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // 1.4. Перфорация раструбов газоотвода (AlphaMap + BumpMap)
  function createPerforationTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Непрозрачный металл
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 256);

    // Сплошные кромки по краям раструба
    const rows = 7;
    const cols = 24;
    ctx.fillStyle = '#000000';
    for (let r = 0; r < rows; r++) {
      const y = 36 + r * 30;
      const offsetX = (r % 2) * (512 / cols / 2);
      for (let c = 0; c < cols; c++) {
        const x = ((c * (512 / cols) + offsetX) % 512);
        ctx.beginPath();
        ctx.arc(x, y, 6.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  // 1.5. Маркировка красной защитной заглушки
  function createMuzzleCapTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#a83228';
    ctx.fillRect(0, 0, 512, 512);

    // Жёлтое предупреждающее кольцо
    ctx.strokeStyle = '#c49a27';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(256, 256, 200, 0, Math.PI * 2);
    ctx.stroke();

    // Надпись по кругу/центру
    ctx.fillStyle = '#f0ead6';
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('НЕ ВСКРЫВАТЬ', 256, 175);
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillStyle = '#e5c158';
    ctx.fillText('ВЫШИБНАЯ КРЫШКА', 256, 338);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ============================================================================
  // 2. PBR МАТЕРИАЛЫ
  // ============================================================================

  const castBumpTex = createMetalNoiseTexture(128, 36, false);
  const fiberBumpTex = createMetalNoiseTexture(128, 28, true);
  const hazardTex = createHazardStripeTexture();
  const stencilRightTex = createHousingStencilTexture(false);
  const stencilLeftTex = createHousingStencilTexture(true);
  const perfAlphaTex = createPerforationTexture();
  const capLabelTex = createMuzzleCapTexture();

  // Основной советский защитный хаки (бронекожух, УСП)
  const khakiArmorMat = new THREE.MeshStandardMaterial({
    color: 0x4a5344,
    metalness: 0.40,
    roughness: 0.65,
    bumpMap: castBumpTex,
    bumpScale: 0.0025,
    roughnessMap: castBumpTex,
  });

  // Тёмно-оливковый стеклопластик/сталь тубусов стволов
  const barrelOliveMat = new THREE.MeshStandardMaterial({
    color: 0x363e33,
    metalness: 0.35,
    roughness: 0.68,
    bumpMap: fiberBumpTex,
    bumpScale: 0.003,
  });

  // Тёмная воронёная сталь (замки, бугель, петли, болты)
  const gunmetalMat = new THREE.MeshStandardMaterial({
    color: 0x262925,
    metalness: 0.78,
    roughness: 0.38,
    bumpMap: castBumpTex,
    bumpScale: 0.0015,
  });

  // Вулканизированная чёрная резина (амортизаторы дульного среза, термонакладки)
  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x1b1d1c,
    metalness: 0.05,
    roughness: 0.86,
    bumpMap: castBumpTex,
    bumpScale: 0.002,
  });

  // Технический красный (заглушки, маркировка)
  const techRedMat = new THREE.MeshStandardMaterial({
    color: 0xa83228,
    metalness: 0.14,
    roughness: 0.48,
  });

  // Технический красный с трафаретом для торца заглушки
  const capFrontMat = new THREE.MeshStandardMaterial({
    map: capLabelTex,
    metalness: 0.14,
    roughness: 0.48,
  });

  // Технический жёлтый (маркировочные кольца, рычаги предохранителей)
  const techYellowMat = new THREE.MeshStandardMaterial({
    color: 0xc49a27,
    metalness: 0.18,
    roughness: 0.50,
  });

  // Латунь / кадмированная сталь (разъёмы электроспуска)
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xa38b46,
    metalness: 0.82,
    roughness: 0.32,
  });

  // Материал жёлто-чёрной разметки УСП
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    metalness: 0.30,
    roughness: 0.58,
  });

  // Материал перфорированного раструба газоотвода
  const exhaustPerfMat = new THREE.MeshStandardMaterial({
    color: 0x353b32,
    metalness: 0.55,
    roughness: 0.55,
    alphaMap: perfAlphaTex,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
  });

  // ============================================================================
  // 3. УЗЕЛ 1: СТЫКОВОЧНЫЙ УЗЕЛ УСП (mountFlange)
  // ============================================================================
  // Габариты плиты: 0.52 (X) x 0.14 (Y) x 0.85 (Z) м
  // Верхняя опорная плоскость находится строго на y = 0.0
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';

  const flangeW = 0.52;
  const flangeH = 0.14;
  const flangeL = 0.85;

  // Основная силовая плита УСП
  const mainFlangeGeo = new THREE.BoxGeometry(flangeW, flangeH * 0.72, flangeL);
  const mainFlangeMesh = new THREE.Mesh(mainFlangeGeo, khakiArmorMat);
  mainFlangeMesh.position.set(0, -flangeH * 0.36, 0);
  mainFlangeMesh.castShadow = true;
  mainFlangeMesh.receiveShadow = true;
  mountFlange.add(mainFlangeMesh);

  // Нижний переходной постамент к бронекожуху
  const lowerNeckGeo = new THREE.BoxGeometry(flangeW * 0.86, flangeH * 0.28, flangeL * 0.90);
  const lowerNeckMesh = new THREE.Mesh(lowerNeckGeo, gunmetalMat);
  lowerNeckMesh.position.set(0, -flangeH * 0.86, 0);
  lowerNeckMesh.castShadow = true;
  mountFlange.add(lowerNeckMesh);

  // Верхняя направляющая шпонка (ласточкин хвост / центрирующий гребень на y = 0)
  const topKeyGeo = new THREE.BoxGeometry(0.14, 0.012, flangeL * 0.88);
  const topKeyMesh = new THREE.Mesh(topKeyGeo, gunmetalMat);
  topKeyMesh.position.set(0, -0.006, 0);
  mountFlange.add(topKeyMesh);

  // Полосы жёлто-чёрной разметки на боковых гранях плиты УСП
  const stripePlateGeo = new THREE.PlaneGeometry(flangeL * 0.94, flangeH * 0.58);
  const stripeRight = new THREE.Mesh(stripePlateGeo, hazardMat);
  stripeRight.position.set(flangeW / 2 + 0.0015, -flangeH * 0.36, 0);
  stripeRight.rotation.y = Math.PI / 2;
  mountFlange.add(stripeRight);

  const stripeLeft = new THREE.Mesh(stripePlateGeo, hazardMat);
  stripeLeft.position.set(-flangeW / 2 - 0.0015, -flangeH * 0.36, 0);
  stripeLeft.rotation.y = -Math.PI / 2;
  mountFlange.add(stripeLeft);

  // 4 силовых замка УСП по углам плиты
  const lockOffsets = [
    [-0.21, -0.32],
    [0.21, -0.32],
    [-0.21, 0.32],
    [0.21, 0.32],
  ];

  lockOffsets.forEach(([lx, lz], idx) => {
    const lockGroup = new THREE.Group();
    lockGroup.name = `uspLock_${idx + 1}`;
    lockGroup.position.set(lx, -0.045, lz);

    // Корпус замка
    const housingBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.075, 0.13),
      gunmetalMat
    );
    housingBox.castShadow = true;
    lockGroup.add(housingBox);

    // Захватный крюк / цапфа
    const hook = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.08, 14),
      brassMat
    );
    hook.rotation.z = Math.PI / 2;
    hook.position.set(lx > 0 ? 0.045 : -0.045, 0.012, 0);
    lockGroup.add(hook);

    // Жёлтый флажок-индикатор закрытия замка
    const indicator = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.045, 0.014),
      techYellowMat
    );
    indicator.position.set(lx > 0 ? 0.058 : -0.058, 0.005, 0.04);
    indicator.rotation.x = 0.25;
    lockGroup.add(indicator);

    // Контргайка / чека с красным кольцом
    const pinRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.016, 0.003, 8, 16),
      techRedMat
    );
    pinRing.position.set(lx > 0 ? 0.062 : -0.062, -0.015, -0.035);
    pinRing.rotation.y = Math.PI / 2;
    lockGroup.add(pinRing);

    mountFlange.add(lockGroup);
  });

  // Верхний многоконтактный разъём стыковки электроцепи
  const topSocket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.032, 0.035, 16),
    brassMat
  );
  topSocket.position.set(0.14, -0.01, -0.12);
  mountFlange.add(topSocket);

  root.add(mountFlange);

  // ============================================================================
  // 4. УЗЕЛ 2: ЛИТОЙ БРОНЕКОЖУХ-ОБОЙМА (quadHousing)
  // ============================================================================
  // Габариты сечения: 0.68 x 0.68 м, центр по Y = -0.48 м (от -0.14 до -0.82 м)
  const quadHousing = new THREE.Group();
  quadHousing.name = 'quadHousing';

  const housingSize = 0.68;
  const housingChamfer = 0.085;
  const housingCenterY = -flangeH - housingSize / 2; // -0.48 м
  const housingLength = 1.90; // от z = -0.96 до z = +0.94

  // Профиль восьмигранного скошенного бронекожуха
  function createChamferedSquareShape(size, c) {
    const h = size / 2;
    const s = new THREE.Shape();
    s.moveTo(-h + c, -h);
    s.lineTo(h - c, -h);
    s.lineTo(h, -h + c);
    s.lineTo(h, h - c);
    s.lineTo(h - c, h);
    s.lineTo(-h + c, h);
    s.lineTo(-h, h - c);
    s.lineTo(-h, -h + c);
    s.closePath();
    return s;
  }

  const outerShape = createChamferedSquareShape(housingSize, housingChamfer);
  const extrudeSettings = {
    steps: 1,
    depth: housingLength,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 2,
  };

  const housingGeo = new THREE.ExtrudeGeometry(outerShape, extrudeSettings);
  // Центрируем экструзию: z от -0.96 до +0.94
  housingGeo.translate(0, housingCenterY, -0.96);

  const housingMesh = new THREE.Mesh(housingGeo, khakiArmorMat);
  housingMesh.castShadow = true;
  housingMesh.receiveShadow = true;
  quadHousing.add(housingMesh);

  // Усиленные литые передняя и задняя торцевые рамы-обоймы
  const framePositionsZ = [-0.955, -0.32, 0.32, 0.935];
  framePositionsZ.forEach((fz, idx) => {
    const isEndFrame = idx === 0 || idx === framePositionsZ.length - 1;
    const ribShape = createChamferedSquareShape(
      isEndFrame ? housingSize + 0.026 : housingSize + 0.016,
      housingChamfer + 0.006
    );
    const ribGeo = new THREE.ExtrudeGeometry(ribShape, {
      steps: 1,
      depth: isEndFrame ? 0.045 : 0.028,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 1,
    });
    ribGeo.translate(0, housingCenterY, fz - (isEndFrame ? 0.022 : 0.014));
    const ribMesh = new THREE.Mesh(
      ribGeo,
      isEndFrame ? gunmetalMat : khakiArmorMat
    );
    ribMesh.castShadow = true;
    ribMesh.receiveShadow = true;
    quadHousing.add(ribMesh);
  });

  // 4 такелажных рым-узла на верхних скосах кожуха
  const lugCoords = [
    [-0.29, -0.17, -0.65],
    [0.29, -0.17, -0.65],
    [-0.29, -0.17, 0.65],
    [0.29, -0.17, 0.65],
  ];
  lugCoords.forEach(([lx, ly, lz]) => {
    const lug = new THREE.Mesh(
      new THREE.TorusGeometry(0.024, 0.007, 8, 16),
      gunmetalMat
    );
    lug.position.set(lx, ly, lz);
    lug.rotation.z = lx > 0 ? -Math.PI / 4 : Math.PI / 4;
    quadHousing.add(lug);
  });

  // Термоизоляционные ребристые накладки на верхних и нижних гранях
  const padPositionsZ = [-0.64, 0.0, 0.64];
  padPositionsZ.forEach((pz) => {
    // Боковые верхние термопанели на скосах
    [-1, 1].forEach((side) => {
      const padGroup = new THREE.Group();
      const padBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.016, 0.24, 0.50),
        rubberMat
      );
      padGroup.add(padBase);

      // Продольные рёбра жёсткости термоизоляции
      for (let r = -2; r <= 2; r++) {
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(0.022, 0.016, 0.48),
          rubberMat
        );
        rib.position.y = r * 0.044;
        padGroup.add(rib);
      }

      // Прижимные металлические планки с болтами
      [-0.21, 0.21].forEach((bz) => {
        const strap = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.245, 0.018),
          gunmetalMat
        );
        strap.position.z = bz;
        padGroup.add(strap);
      });

      padGroup.position.set(
        side * (housingSize / 2 + 0.006),
        housingCenterY + 0.14,
        pz
      );
      quadHousing.add(padGroup);
    });
  });

  // Боковые бронелисты с трафаретом «РПО-Т / ТЕРМОБАРИЧЕСКИЙ»
  const stencilMatRight = new THREE.MeshStandardMaterial({
    map: stencilRightTex,
    metalness: 0.40,
    roughness: 0.64,
    bumpMap: castBumpTex,
    bumpScale: 0.002,
  });
  const stencilMatLeft = new THREE.MeshStandardMaterial({
    map: stencilLeftTex,
    metalness: 0.40,
    roughness: 0.64,
    bumpMap: castBumpTex,
    bumpScale: 0.002,
  });

  const sidePlateGeo = new THREE.BoxGeometry(0.012, 0.26, 0.56);
  const stencilPlateRight = new THREE.Mesh(sidePlateGeo, stencilMatRight);
  stencilPlateRight.position.set(housingSize / 2 + 0.006, housingCenterY - 0.12, 0.0);
  stencilPlateRight.castShadow = true;
  quadHousing.add(stencilPlateRight);

  const stencilPlateLeft = new THREE.Mesh(sidePlateGeo, stencilMatLeft);
  stencilPlateLeft.position.set(-housingSize / 2 - 0.006, housingCenterY - 0.12, 0.0);
  stencilPlateLeft.castShadow = true;
  quadHousing.add(stencilPlateLeft);

  // Кабельная коробка электроспуска (правый борт +X)
  const firingBoxGroup = new THREE.Group();
  firingBoxGroup.name = 'electricFiringBox';
  firingBoxGroup.position.set(housingSize / 2 + 0.032, housingCenterY - 0.10, 0.52);

  const fBoxBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.17, 0.22),
    khakiArmorMat
  );
  fBoxBody.castShadow = true;
  firingBoxGroup.add(fBoxBody);

  const fBoxLid = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.18, 0.23),
    gunmetalMat
  );
  fBoxLid.position.x = 0.034;
  firingBoxGroup.add(fBoxLid);

  // 4 болта крышки распределительной коробки
  [
    [-0.072, -0.095],
    [0.072, -0.095],
    [-0.072, 0.095],
    [0.072, 0.095],
  ].forEach(([by, bz]) => {
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.018, 6),
      brassMat
    );
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(0.038, by, bz);
    firingBoxGroup.add(bolt);
  });

  // Разъёмы ШР и бронированные жгуты кабелей электроспуска
  const connectorTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, 0.04, 14),
    brassMat
  );
  connectorTop.position.set(0, 0.10, -0.04);
  firingBoxGroup.add(connectorTop);

  // Кабель от УСП к коробке электроспуска
  const upperCableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.24, -0.09, 0.18),
    new THREE.Vector3(0.36, -0.18, 0.30),
    new THREE.Vector3(0.37, -0.35, 0.44),
    new THREE.Vector3(0.372, -0.47, 0.48),
  ]);
  const upperCable = new THREE.Mesh(
    new THREE.TubeGeometry(upperCableCurve, 24, 0.011, 10, false),
    rubberMat
  );
  upperCable.castShadow = true;
  quadHousing.add(upperCable);

  // Кабель от коробки электроспуска назад к казённикам (z = -0.92)
  const rearCableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.372, -0.62, 0.41),
    new THREE.Vector3(0.365, -0.66, 0.05),
    new THREE.Vector3(0.365, -0.66, -0.55),
    new THREE.Vector3(0.31, -0.62, -0.93),
  ]);
  const rearCable = new THREE.Mesh(
    new THREE.TubeGeometry(rearCableCurve, 28, 0.010, 10, false),
    rubberMat
  );
  rearCable.castShadow = true;
  quadHousing.add(rearCable);

  quadHousing.add(firingBoxGroup);

  // Боковой защитный бугель (стальная дуга безопасности вокруг электроспуска)
  const guardRailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(housingSize / 2, housingCenterY - 0.10, 0.34),
    new THREE.Vector3(housingSize / 2 + 0.095, housingCenterY - 0.10, 0.38),
    new THREE.Vector3(housingSize / 2 + 0.095, housingCenterY - 0.10, 0.66),
    new THREE.Vector3(housingSize / 2, housingCenterY - 0.10, 0.70),
  ]);
  const guardRailMesh = new THREE.Mesh(
    new THREE.TubeGeometry(guardRailCurve, 28, 0.013, 12, false),
    gunmetalMat
  );
  guardRailMesh.castShadow = true;
  quadHousing.add(guardRailMesh);

  // Монтажные фланцы бугеля
  [0.34, 0.70].forEach((gz) => {
    const flangePad = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.065, 0.055),
      gunmetalMat
    );
    flangePad.position.set(housingSize / 2 + 0.006, housingCenterY - 0.10, gz);
    quadHousing.add(flangePad);
  });

  // Координаты осей 4 стволов (2 x 2)
  const barrelOffsets = [
    { x: -0.165, y: housingCenterY + 0.165, name: 'TopLeft' },    // 0: Верхний левый
    { x: 0.165, y: housingCenterY + 0.165, name: 'TopRight' },    // 1: Верхний правый
    { x: -0.165, y: housingCenterY - 0.165, name: 'BottomLeft' }, // 2: Нижний левый
    { x: 0.165, y: housingCenterY - 0.165, name: 'BottomRight' }, // 3: Нижний правый
  ];

  // Задняя часть (z = -1.05): откидные перфорированные раструбы газоотвода
  const rearExhaustGroup = new THREE.Group();
  rearExhaustGroup.name = 'rearExhaustDiffusers';

  barrelOffsets.forEach((b, idx) => {
    const diffuserUnit = new THREE.Group();
    diffuserUnit.name = `exhaustBell_${idx + 1}`;
    diffuserUnit.position.set(b.x, b.y, -1.05);

    // Откидной шарнирный узел сбоку каждого раструба
    const hingeSide = b.x < 0 ? -1 : 1;
    const hingePin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.09, 12),
      gunmetalMat
    );
    hingePin.position.set(hingeSide * 0.125, 0, 0.06);
    diffuserUnit.add(hingePin);

    const hingeBracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.05, 0.08),
      khakiArmorMat
    );
    hingeBracket.position.set(hingeSide * 0.105, 0, 0.05);
    diffuserUnit.add(hingeBracket);

    // Пружинная защёлка на противоположной стороне
    const latch = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.045, 0.05),
      techYellowMat
    );
    latch.position.set(-hingeSide * 0.11, 0, 0.06);
    diffuserUnit.add(latch);

    // Перфорированный конический раструб (расширяется назад к -Z)
    // В CylinderGeometry верх (+Y) -> после rotateX(Math.PI/2) смотрит в +Z, низ (-Y) -> в -Z
    const coneGeo = new THREE.CylinderGeometry(0.096, 0.132, 0.18, 32, 1, true);
    coneGeo.rotateX(Math.PI / 2);
    const coneMesh = new THREE.Mesh(coneGeo, exhaustPerfMat);
    coneMesh.castShadow = true;
    diffuserUnit.add(coneMesh);

    // Внутренний тёмный жаропрочный канал сопла
    const innerNozzleGeo = new THREE.CylinderGeometry(0.082, 0.102, 0.15, 24, 1, true);
    innerNozzleGeo.rotateX(Math.PI / 2);
    const innerNozzleMat = new THREE.MeshStandardMaterial({
      color: 0x161815,
      metalness: 0.7,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    const innerNozzle = new THREE.Mesh(innerNozzleGeo, innerNozzleMat);
    innerNozzle.position.z = 0.015;
    diffuserUnit.add(innerNozzle);

    // Силовое обжимное кольцо на выходном срезе раструба (z = -1.14)
    const rearRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.132, 0.008, 10, 32),
      gunmetalMat
    );
    rearRing.position.z = -0.09;
    diffuserUnit.add(rearRing);

    rearExhaustGroup.add(diffuserUnit);
  });

  quadHousing.add(rearExhaustGroup);
  root.add(quadHousing);

  // ============================================================================
  // 5. УЗЕЛ 3: ПАКЕТ ИЗ 4 ТОЛСТЫХ СТВОЛОВ-МОРТИР (fourBarrelsGroup)
  // ============================================================================
  const fourBarrelsGroup = new THREE.Group();
  fourBarrelsGroup.name = 'fourBarrelsGroup';

  const capsList = [];
  const barrelsList = [];

  // Профиль толстостенного ребристого тубуса через LatheGeometry
  function createRibbedBarrelGeometry() {
    const pts = [];
    const innerR = 0.084;
    const outerR = 0.108;
    const zStart = -0.94;
    const zEnd = 1.03;

    // Внутренний канал от казённика до дульного среза
    pts.push(new THREE.Vector2(innerR, zStart));
    pts.push(new THREE.Vector2(innerR, zEnd));

    // Фаска дульного среза
    pts.push(new THREE.Vector2(outerR, zEnd));

    // Внешняя стенка с силовыми кольцевыми рёбрами на выступающей передней части
    const ribZs = [1.00, 0.965, 0.93, 0.895];
    ribZs.forEach((rz) => {
      pts.push(new THREE.Vector2(outerR, rz + 0.010));
      pts.push(new THREE.Vector2(outerR + 0.007, rz + 0.007));
      pts.push(new THREE.Vector2(outerR + 0.007, rz - 0.007));
      pts.push(new THREE.Vector2(outerR, rz - 0.010));
    });

    pts.push(new THREE.Vector2(outerR, zStart));
    pts.push(new THREE.Vector2(innerR, zStart));

    const lathe = new THREE.LatheGeometry(pts, 36);
    // Lathe вращается вокруг Y; поворачиваем вокруг X на +90°, чтобы ось стала +Z
    lathe.rotateX(Math.PI / 2);
    lathe.computeVertexNormals();
    return lathe;
  }

  const sharedBarrelGeo = createRibbedBarrelGeometry();

  // Материал головной части термобарической гранаты внутри ствола
  const warheadMat = new THREE.MeshStandardMaterial({
    color: 0x3b4236,
    metalness: 0.65,
    roughness: 0.35,
  });

  barrelOffsets.forEach((b, idx) => {
    const barrelUnit = new THREE.Group();
    barrelUnit.name = `mortarBarrel_${idx + 1}_${b.name}`;
    barrelUnit.position.set(b.x, b.y, 0);

    // 1) Толстостенный ребристый тубус ствола
    const tubeMesh = new THREE.Mesh(sharedBarrelGeo, barrelOliveMat);
    tubeMesh.castShadow = true;
    tubeMesh.receiveShadow = true;
    barrelUnit.add(tubeMesh);

    // 2) Маркировочные кольца (жёлтое + красное) перед дульным срезом
    const yellowBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1105, 0.1105, 0.018, 32, 1, true),
      techYellowMat
    );
    yellowBand.rotation.x = Math.PI / 2;
    yellowBand.position.z = 0.982;
    barrelUnit.add(yellowBand);

    const redBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1105, 0.1105, 0.014, 32, 1, true),
      techRedMat
    );
    redBand.rotation.x = Math.PI / 2;
    redBand.position.z = 0.950;
    barrelUnit.add(redBand);

    // 3) Обтекатель термобарической боевой части внутри канала ствола (виден после отстрела заглушки)
    const projectileGroup = new THREE.Group();
    projectileGroup.name = `projectileNose_${idx + 1}`;
    projectileGroup.position.z = 0.92;

    const ogiveMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.081, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      warheadMat
    );
    ogiveMesh.rotation.x = Math.PI / 2;
    ogiveMesh.scale.set(1, 1.35, 1);
    projectileGroup.add(ogiveMesh);

    const fuzeCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.024, 0.025, 16),
      brassMat
    );
    fuzeCap.rotation.x = Math.PI / 2;
    fuzeCap.position.z = 0.105;
    projectileGroup.add(fuzeCap);

    barrelUnit.add(projectileGroup);

    // 4) Резиновое амортизирующее кольцо на дульном срезе (z = 1.028)
    const rubberBumperGroup = new THREE.Group();
    rubberBumperGroup.name = `rubberShockRing_${idx + 1}`;
    rubberBumperGroup.position.z = 1.028;

    const bumperTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.104, 0.016, 14, 36),
      rubberMat
    );
    bumperTorus.castShadow = true;
    rubberBumperGroup.add(bumperTorus);

    // Демпферные радиальные выступы на резиновом кольце
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      const lug = new THREE.Mesh(
        new THREE.BoxGeometry(0.014, 0.014, 0.034),
        rubberMat
      );
      lug.position.set(Math.cos(ang) * 0.114, Math.sin(ang) * 0.114, -0.004);
      lug.rotation.z = ang;
      rubberBumperGroup.add(lug);
    }

    barrelUnit.add(rubberBumperGroup);

    // 5) Красная защитная вышибная заглушка (отстреливаемый элемент)
    const muzzleCap = new THREE.Group();
    muzzleCap.name = `muzzleCap_${idx + 1}`;
    const restPos = new THREE.Vector3(0, 0, 1.048);
    muzzleCap.position.copy(restPos);

    // Юбка заглушки, охватывающая дульный срез
    const capSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.113, 0.115, 0.032, 32, 1, true),
      techRedMat
    );
    capSkirt.rotation.x = Math.PI / 2;
    capSkirt.castShadow = true;
    muzzleCap.add(capSkirt);

    // Передний выпуклый диск заглушки с трафаретом
    const capFace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.113, 0.113, 0.008, 32),
      [techRedMat, capFrontMat, techRedMat]
    );
    capFace.rotation.x = Math.PI / 2;
    capFace.position.z = 0.016;
    capFace.castShadow = true;
    muzzleCap.add(capFace);

    // Центральный вышибной колпачок и крестообразные рёбра жёсткости
    const centerBoss = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.028, 0.016, 16),
      techRedMat
    );
    centerBoss.rotation.x = Math.PI / 2;
    centerBoss.position.z = 0.024;
    muzzleCap.add(centerBoss);

    [0, Math.PI / 2].forEach((rot) => {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.21, 0.008, 0.010),
        techRedMat
      );
      rib.position.z = 0.021;
      rib.rotation.z = rot;
      muzzleCap.add(rib);
    });

    barrelUnit.add(muzzleCap);
    fourBarrelsGroup.add(barrelUnit);

    barrelsList.push(barrelUnit);
    capsList.push({
      mesh: muzzleCap,
      projectile: projectileGroup,
      restPos: restPos.clone(),
      fired: false,
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
    });
  });

  root.add(fourBarrelsGroup);

  // Сохраняем ссылки на узлы для анимации и внешнего управления
  root.userData = {
    mountFlange,
    quadHousing,
    fourBarrelsGroup,
    barrels: barrelsList,
    caps: capsList,
  };

  return root;
}

// ============================================================================
// Адаптер под единый просмотрщик: залп 4 заглушек по расписанию.
// applySalvo(t, elapsed): абсолютное время цикла — отстрел, баллистика,
// вспышки, откат блока, перезарядка. Возвращает { fired, flying }.
// ============================================================================
export function createWeapon() {
  const root = createWeaponRPOTShmelM();
  const ud = root.userData;
  const caps = ud.caps;
  const barrels = ud.barrels;

  // Время выстрела каждого ствола по порядку SALVO_ORDER
  const fireTimeOf = (i) => SALVO_FIRST + SALVO_ORDER.indexOf(i) * SALVO_INTERVAL;

  // Локальный уровень пола для каждого ствола (крышки — дети barrelUnit)
  const floorLocalY = barrels.map((b) => WORLD_FLOOR_Y - b.position.y + 0.03);

  // Дульные вспышки: по одному аддитивному ядру на ствол
  const flashGeo = new THREE.SphereGeometry(0.075, 12, 12);
  const flashes = barrels.map((b) => {
    const m = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const f = new THREE.Mesh(flashGeo, m);
    f.position.set(0, 0, 1.12);
    f.visible = false;
    b.add(f);
    return { mesh: f, mat: m };
  });

  const muzzleLight = new THREE.PointLight(0xffaa33, 0, 3.5, 1.8);
  muzzleLight.position.set(0, -0.48, 1.3);
  root.add(muzzleLight);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  const _p = new THREE.Vector3();
  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();

  // Детерминированная поза крышки i в момент ft после выстрела (баллистика + пол)
  const simCap = (i, ft) => {
    const cap = caps[i];
    _p.copy(cap.restPos);
    _v.copy(CAP_VEL[i]);
    _w.copy(CAP_ANGVEL[i]);
    let rx = 0, ry = 0, rz = 0;
    let resting = false;
    const dt = 1 / 120;
    for (let tt = 0; tt < ft; tt += dt) {
      if (resting) break;
      _v.y -= 9.81 * dt;
      _v.multiplyScalar(1 - 0.35 * dt);
      _p.addScaledVector(_v, dt);
      rx += _w.x * dt; ry += _w.y * dt; rz += _w.z * dt;
      if (_p.y <= floorLocalY[i]) {
        _p.y = floorLocalY[i];
        if (Math.abs(_v.y) > 0.35) {
          _v.y = -_v.y * 0.32;
          _v.x *= 0.65;
          _v.z *= 0.65;
          _w.multiplyScalar(0.5);
        } else {
          resting = true;
        }
      }
    }
    return { resting, rx, ry, rz };
  };

  ud.applySalvo = (t) => {
    let fired = 0;
    let flying = 0;
    let lightLevel = 0;

    for (let i = 0; i < SALVO_COUNT; i++) {
      const tFire = fireTimeOf(i);
      const cap = caps[i];
      if (t < tFire) {
        cap.mesh.position.copy(cap.restPos);
        cap.mesh.rotation.set(0, 0, 0);
        flashes[i].mesh.visible = false;
        flashes[i].mat.opacity = 0;
      } else {
        fired++;
        const ft = t - tFire;
        const s = simCap(i, ft);
        cap.mesh.position.copy(_p);
        cap.mesh.rotation.set(s.rx, s.ry, s.rz);
        if (!s.resting) flying++;
        // Вспышка 0.12 с после выстрела
        const fl = Math.max(0, 1 - ft / 0.12);
        flashes[i].mesh.visible = fl > 0.01;
        flashes[i].mat.opacity = fl * 0.95;
        flashes[i].mesh.scale.set(1.2, 1.2, 1 + fl * 1.5);
        if (fl > lightLevel) lightLevel = fl;
      }
    }

    // Пружинно-демпферный откат блока: импульс -0.55 на каждый выстрел
    let z = 0, v = 0;
    const firedFlags = [false, false, false, false];
    const dt = 1 / 120;
    for (let tt = 0; tt < t; tt += dt) {
      for (let k = 0; k < SALVO_COUNT; k++) {
        if (!firedFlags[k] && tt >= fireTimeOf(k)) {
          firedFlags[k] = true;
          v -= 0.55;
        }
      }
      v += (-140.0 * z - 18.0 * v) * dt;
      z += v * dt;
    }
    root.position.z = z;

    muzzleLight.intensity = lightLevel * 14.0;
    return { fired, flying };
  };

  ud.setExtension = (t) => {
    const info = ud.applySalvo(Math.max(0, Math.min(SALVO_CYCLE, t)));
    return info;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
