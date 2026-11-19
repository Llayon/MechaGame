import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const meta = {
  id: 'ags40',
  code: 'АГС-40',
  title: 'АГС-40 «Балкан-М»',
  subtitle: '40-ММ АВТОМАТИЧЕСКИЙ ГРАНАТОМЁТ • СЛОТ MAIN • ОЧЕРЕДЬ 5 / 1.9 С',
  description: '40-мм автоматический гранатомёт: фланец УСП с разметкой, качающаяся ствольная коробка с барабанным магазином на 120 выстрелов, баллистическим квадрантом и сервоприводом возвышения, короткий толстостенный ствол-мортира с трёхкамерным ДТК и внешними возвратными пружинами. Очереди по 5 выстрелов, темп ~400/мин.',
  specs: [
    ['Калибр', '40 мм'],
    ['Темп', '~400 выстр/мин'],
    ['Очередь', '5 + пауза 1.15 с'],
    ['Боекомплект', 'БК-120, барабан'],
    ['Откат ствола', '135 мм'],
    ['Слот', 'MAIN'],
  ],
  maxExtension: 1.9,
  unit: 's',
  tipOffset: 1.65,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'receiverAndDrum', label: '2. Коробка, барабан, привод' },
    { key: 'mortarBarrelGroup', label: '3. Ствол-мортира и ДТК' },
  ],
  cameras: {
    module: { pos: [2.2, 0.7, 2.5], target: [0, -0.25, 0.5] },
  },
  rangeMarkers: [],
  controls: 'gl',
};

const GL_SHOTS = 5;
const GL_INTERVAL = 0.15;
const GL_PAUSE = 1.15;
const GL_CYCLE = GL_SHOTS * GL_INTERVAL + GL_PAUSE; // 1.9 с
const GL_MAX_RECOIL = 0.135;

/**
 * Процедурная генерация 3D-модели 40-мм автоматического гранатомётного комплекса меха
 * АГС-40 «Балкан-М» (слот MAIN).
 *
 * Система координат:
 * - 1 unit = 1 метр, общая длина ~2.30 м (Z: от -0.65 до +1.65)
 * - Ствол направлен вдоль +Z, верх — +Y, правый борт — +X (барабан слева, -X)
 * - Точка привязки (0, 0, 0) — центр верхней плоскости фланца УСП
 *
 * @returns {THREE.Group} Корневая группа модуля вооружения
 */
export function createWeaponAGS40BalkanM() {
  const root = new THREE.Group();
  root.name = 'AGS40_BalkanM_Root';

  // ============================================================================
  // 1. ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (CanvasTexture)
  // ============================================================================

  // Текстура микрорельефа и шероховатости катанной бронестали
  function createSteelNoiseTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 6500; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const v = 110 + Math.floor(Math.random() * 36);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 2, 1);
    }

    // Лёгкие эксплуатационные царапины
    ctx.strokeStyle = 'rgba(185, 185, 185, 0.25)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 45; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 28, y + (Math.random() - 0.5) * 14);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  // Жёлто-чёрная предупреждающая разметка и маркировка УСП
  function createHazardFlangeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Базовый жёлтый промышленный цвет
    ctx.fillStyle = '#d99e16';
    ctx.fillRect(0, 0, 1024, 256);

    // Диагональные чёрные полосы
    ctx.fillStyle = '#191b1d';
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

    // Стальные защитные каёмки сверху и снизу
    ctx.fillStyle = '#3b413a';
    ctx.fillRect(0, 0, 1024, 34);
    ctx.fillRect(0, 222, 1024, 34);

    // Центральная плашка с техническим трафаретом УСП
    ctx.fillStyle = '#232724';
    ctx.fillRect(332, 54, 360, 148);
    ctx.strokeStyle = '#d99e16';
    ctx.lineWidth = 4;
    ctx.strokeRect(338, 60, 348, 136);

    ctx.fillStyle = '#ece8d9';
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('УСП-40 // ОСН.', 512, 108);

    ctx.fillStyle = '#d99e16';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText('НАГР. ДО 2.4 Т • ВПЕРЁД ▲', 512, 152);

    // Потёртости краски
    for (let i = 0; i < 450; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(60,65,60,0.35)' : 'rgba(20,20,20,0.25)';
      ctx.fillRect(Math.random() * 1024, Math.random() * 256, 4 + Math.random() * 10, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  // Трафаретная маркировка барабанного магазина «АГС-40»
  function createDrumStencilTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Базовый серо-оливковый тон корпуса (#4a5248)
    ctx.fillStyle = '#4a5248';
    ctx.fillRect(0, 0, 1024, 1024);

    // Кольцевая тактическая полоса
    ctx.strokeStyle = '#c89628';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(512, 512, 415, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(235, 232, 220, 0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(512, 512, 392, 0, Math.PI * 2);
    ctx.stroke();

    // Главный трафарет «АГС-40»
    ctx.save();
    ctx.translate(512, 255);
    ctx.fillStyle = '#eae6d7';
    ctx.font = 'bold 92px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('АГС-40', 0, 0);

    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.fillStyle = '#d9a426';
    ctx.fillText('«БАЛКАН-М» • 40 ММ', 0, 44);
    ctx.restore();

    // Нижняя техническая маркировка боекомплекта
    ctx.save();
    ctx.translate(512, 805);
    ctx.fillStyle = '#eae6d7';
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('БК-120 // ВЫСТР. 7П39', 0, 0);

    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillStyle = '#c5c8be';
    ctx.fillText('ПОДАЧА ЛЕВ. ↻ ВЗВОД', 0, 38);
    ctx.restore();

    // Имитация облупившейся трафаретной краски
    ctx.fillStyle = '#4a5248';
    for (let i = 0; i < 650; i++) {
      const rx = 180 + Math.random() * 664;
      const ry = 140 + Math.random() * 744;
      ctx.fillRect(rx, ry, 2 + Math.random() * 6, 1.5 + Math.random() * 3);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  // Шкала баллистического вычислителя-квадранта
  function createQuadrantDialTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1b1e1c';
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = '#e6e2d3';
    ctx.fillStyle = '#e6e2d3';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i <= 16; i++) {
      const x = 24 + (i / 16) * 464;
      const isMajor = i % 2 === 0;
      ctx.lineWidth = isMajor ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x, 30);
      ctx.lineTo(x, isMajor ? 85 : 62);
      ctx.stroke();

      if (isMajor) {
        const angleDeg = i * 5;
        ctx.fillText(`${angleDeg}°`, x, 112);
      }
    }

    // Красная баллистическая шкала тысячных
    ctx.strokeStyle = '#d9412b';
    ctx.fillStyle = '#d9412b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(24, 150);
    ctx.lineTo(488, 150);
    ctx.stroke();

    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText('УГЛОМЕР 0-00 .. 14-00 ТЫС.', 256, 195);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const steelNoiseTex = createSteelNoiseTexture();
  const hazardTex = createHazardFlangeTexture();
  const drumStencilTex = createDrumStencilTexture();
  const quadrantDialTex = createQuadrantDialTexture();

  // ============================================================================
  // 2. PBR-МАТЕРИАЛЫ
  // ============================================================================

  // Основная серо-оливковая бронесталь корпуса и барабана
  const armorOliveMat = new THREE.MeshStandardMaterial({
    color: 0x4a5248,
    metalness: 0.45,
    roughness: 0.65,
    bumpMap: steelNoiseTex,
    bumpScale: 0.0025,
    roughnessMap: steelNoiseTex,
  });

  // Чуть более тёмный оттенок серо-оливковой стали для силовых рёбер и кронштейнов
  const armorOliveDarkMat = new THREE.MeshStandardMaterial({
    color: 0x3b4239,
    metalness: 0.5,
    roughness: 0.62,
    bumpMap: steelNoiseTex,
    bumpScale: 0.002,
  });

  // Материал торца барабана с трафаретом «АГС-40»
  const drumStencilMat = new THREE.MeshStandardMaterial({
    map: drumStencilTex,
    metalness: 0.45,
    roughness: 0.65,
    bumpMap: steelNoiseTex,
    bumpScale: 0.002,
  });

  // Воронёная сталь ствола, дульного тормоза и возвратных пружин
  const bluedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x25282c,
    metalness: 0.85,
    roughness: 0.35,
    bumpMap: steelNoiseTex,
    bumpScale: 0.0015,
  });

  // Глубокий матовый канал ствола и внутренние полости ДТК
  const boreDarkMat = new THREE.MeshStandardMaterial({
    color: 0x111315,
    metalness: 0.7,
    roughness: 0.5,
  });

  // Жёлто-чёрная разметка плиты УСП
  const hazardFlangeMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    metalness: 0.35,
    roughness: 0.55,
  });

  // Оцинкованный / кадмированный крепёж и заклёпки
  const fastenerMat = new THREE.MeshStandardMaterial({
    color: 0x6e7578,
    metalness: 0.88,
    roughness: 0.3,
  });

  // Латунь / медный сплав для 40-мм выстрелов и шкал квадранта
  const brassAmmoMat = new THREE.MeshStandardMaterial({
    color: 0xb88b3a,
    metalness: 0.85,
    roughness: 0.28,
  });

  // Оптическая линза видоискателя с просветлением
  const opticLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x124734,
    emissive: 0x062419,
    emissiveIntensity: 0.4,
    metalness: 0.1,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });

  // Резиновый наглазник и уплотнители
  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c1e,
    metalness: 0.05,
    roughness: 0.88,
  });

  // ============================================================================
  // 3. НАКОПИТЕЛЬ ДЛЯ INSTANCED MESH (КРЕПЁЖ И ЗАКЛЁПКИ)
  // ============================================================================
  const fastenerTransforms = [];
  const _dummy = new THREE.Object3D();

  /**
   * Регистрирует болт/заклёпку в мировых координатах узла (относительно targetParent -> root)
   */
  function addFastener(parentObj, x, y, z, rx = 0, ry = 0, rz = 0, scale = 1.0) {
    _dummy.position.set(x, y, z);
    _dummy.rotation.set(rx, ry, rz);
    _dummy.scale.setScalar(scale);
    _dummy.updateMatrix();
    fastenerTransforms.push({ parent: parentObj, localMatrix: _dummy.matrix.clone() });
  }

  // ============================================================================
  // 4. УЗЕЛ 1: СТЫКОВОЧНЫЙ УЗЕЛ УСП (mountFlange)
  // ============================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Главная стальная плита УСП 0.50 x 0.14 x 0.80 м.
  // Верхняя плоскость строго на Y = 0.0, центр на Y = -0.07.
  const plateGeo = new THREE.BoxGeometry(0.50, 0.14, 0.80);
  const plateMaterials = [
    hazardFlangeMat,   // +X правый борт (жёлто-чёрная разметка)
    hazardFlangeMat,   // -X левый борт (жёлто-чёрная разметка)
    armorOliveDarkMat, // +Y верхняя стыковочная плоскость
    armorOliveDarkMat, // -Y нижняя плоскость
    hazardFlangeMat,   // +Z передний торец
    hazardFlangeMat,   // -Z задний торец
  ];
  const flangePlate = new THREE.Mesh(plateGeo, plateMaterials);
  flangePlate.position.set(0, -0.07, 0);
  flangePlate.castShadow = true;
  flangePlate.receiveShadow = true;
  mountFlange.add(flangePlate);

  // Верхняя стыковочная направляющая рама и центрирующий конус УСП (вровень с Y = 0)
  const dockingRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.16, 0.012, 24),
    bluedSteelMat
  );
  dockingRing.position.set(0, -0.004, 0);
  mountFlange.add(dockingRing);

  const dockingCenterPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.016, 16),
    fastenerMat
  );
  dockingCenterPin.position.set(0, -0.002, 0);
  mountFlange.add(dockingCenterPin);

  // Продольные силовые рёбра сверху плиты
  for (const sx of [-0.19, 0.19]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.72), bluedSteelMat);
    rail.position.set(sx, -0.003, 0);
    mountFlange.add(rail);
  }

  // 4 силовых замка УСП по углам плиты
  const lockPositions = [
    [-0.255, -0.07, -0.29, 1],
    [0.255, -0.07, -0.29, -1],
    [-0.255, -0.07, 0.29, 1],
    [0.255, -0.07, 0.29, -1],
  ];

  lockPositions.forEach(([lx, ly, lz, sideSign]) => {
    const lockGroup = new THREE.Group();
    lockGroup.position.set(lx, ly, lz);

    // Корпус замка
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.13), armorOliveDarkMat);
    housing.castShadow = true;
    lockGroup.add(housing);

    // Захватный крюк / кулачок замка, выходящий к верхнему фланцу
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.045, 0.07), bluedSteelMat);
    claw.position.set(-sideSign * 0.012, 0.052, 0);
    lockGroup.add(claw);

    // Горизонтальный стопорный шток гидрозамка
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.16, 12),
      fastenerMat
    );
    pin.rotation.x = Math.PI / 2;
    pin.position.set(-sideSign * 0.01, 0.015, 0);
    lockGroup.add(pin);

    // Болты крепления замка
    addFastener(lockGroup, -sideSign * 0.028, -0.032, -0.042, 0, 0, sideSign * Math.PI / 2, 1.1);
    addFastener(lockGroup, -sideSign * 0.028, -0.032, 0.042, 0, 0, sideSign * Math.PI / 2, 1.1);

    mountFlange.add(lockGroup);
  });

  // Заклёпки по периметру верхней плиты УСП
  for (let z = -0.35; z <= 0.351; z += 0.14) {
    addFastener(mountFlange, -0.22, 0.002, z, 0, 0, 0, 1.0);
    addFastener(mountFlange, 0.22, 0.002, z, 0, 0, 0, 1.0);
  }

  // Подвесная турельная вилка / кронштейн цапф (от Y = -0.14 до оси цапф Y = -0.48, Z = 0.08)
  const trunnionY = -0.48;
  const trunnionZ = 0.08;

  const yokeBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.44), armorOliveDarkMat);
  yokeBase.position.set(0, -0.175, trunnionZ);
  yokeBase.castShadow = true;
  mountFlange.add(yokeBase);

  // Две массивные щёки люльки (левая и правая)
  const cheekShape = new THREE.Shape();
  cheekShape.moveTo(-0.20, 0);
  cheekShape.lineTo(0.20, 0);
  cheekShape.lineTo(0.11, -0.32);
  cheekShape.absarc(0, -0.31, 0.11, 0, Math.PI, false);
  cheekShape.closePath();

  const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, {
    depth: 0.042,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  cheekGeo.rotateY(Math.PI / 2);

  for (const sideX of [-0.225, 0.183]) {
    const cheek = new THREE.Mesh(cheekGeo, armorOliveMat);
    cheek.position.set(sideX, -0.17, trunnionZ);
    cheek.castShadow = true;
    cheek.receiveShadow = true;
    mountFlange.add(cheek);
  }

  // Буксы главных горизонтальных цапф
  for (const bx of [-0.23, 0.23]) {
    const bearingCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.082, 0.055, 20),
      bluedSteelMat
    );
    bearingCap.rotation.z = Math.PI / 2;
    bearingCap.position.set(bx, trunnionY, trunnionZ);
    mountFlange.add(bearingCap);

    // Болты крышки цапфы по кругу
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      addFastener(
        mountFlange,
        bx + Math.sign(bx) * 0.028,
        trunnionY + Math.sin(ang) * 0.056,
        trunnionZ + Math.cos(ang) * 0.056,
        0,
        0,
        -Math.sign(bx) * Math.PI / 2,
        0.95
      );
    }
  }

  // ============================================================================
  // 5. УЗЕЛ 2: СТВОЛЬНАЯ КОРОБКА И БАРАБАННЫЙ МАГАЗИН (receiverAndDrum)
  // ============================================================================
  const receiverAndDrum = new THREE.Group();
  receiverAndDrum.name = 'receiverAndDrum';
  // Размещаем на оси цапф (0, -0.48, 0.08), чтобы весь блок качался по углу возвышения
  receiverAndDrum.position.set(0, trunnionY, trunnionZ);
  root.add(receiverAndDrum);

  // --- 5.1. Угловатый бронекорпус ствольной коробки ---
  // Профиль в плоскости YZ (выдавливаем по оси X от -0.18 до +0.18, ширина 0.36 м)
  // Локальный Z: от -0.73 (мировой -0.65) до +0.56 (мировой +0.64)
  const receiverProfile = new THREE.Shape();
  receiverProfile.moveTo(-0.68, -0.13);   // Задний нижний скос
  receiverProfile.lineTo(0.46, -0.16);    // Нижний бронелист
  receiverProfile.lineTo(0.56, -0.09);    // Передний нижний скос
  receiverProfile.lineTo(0.56, 0.11);     // Передний лобовой бронелист
  receiverProfile.lineTo(0.34, 0.17);     // Передний верхний скос
  receiverProfile.lineTo(-0.48, 0.17);    // Верхняя крышка ствольной коробки
  receiverProfile.lineTo(-0.68, 0.09);    // Задний верхний скос
  receiverProfile.closePath();

  const receiverGeo = new THREE.ExtrudeGeometry(receiverProfile, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  // Extrude идёт вдоль +Z; поворачиваем так, чтобы X формы -> Z, Y формы -> Y, глубина -> X
  receiverGeo.rotateY(-Math.PI / 2);
  receiverGeo.translate(0.17, 0, 0);

  const receiverBody = new THREE.Mesh(receiverGeo, armorOliveMat);
  receiverBody.castShadow = true;
  receiverBody.receiveShadow = true;
  receiverAndDrum.add(receiverBody);

  // Верхняя откидная крышка приёмника с выштампованными рёбрами жёсткости
  const topCover = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.032, 0.72), armorOliveDarkMat);
  topCover.position.set(0, 0.192, -0.06);
  topCover.castShadow = true;
  receiverAndDrum.add(topCover);

  for (let rz = -0.34; rz <= 0.221; rz += 0.11) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.014, 0.035), armorOliveMat);
    rib.position.set(0, 0.212, rz);
    receiverAndDrum.add(rib);
    addFastener(receiverAndDrum, -0.155, 0.195, rz, 0, 0, 0, 0.9);
    addFastener(receiverAndDrum, 0.155, 0.195, rz, 0, 0, 0, 0.9);
  }

  // Защёлки крышки ствольной коробки
  for (const lz of [-0.41, 0.29]) {
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.042, 0.045), bluedSteelMat);
    latch.position.set(0, 0.198, lz);
    receiverAndDrum.add(latch);
  }

  // Передний массивный блок казённика и направляющая муфта ствола
  const frontTrunnionBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.26, 0.14),
    armorOliveDarkMat
  );
  frontTrunnionBlock.position.set(0, -0.01, 0.56);
  frontTrunnionBlock.castShadow = true;
  receiverAndDrum.add(frontTrunnionBlock);

  const barrelSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.125, 0.135, 0.12, 24),
    bluedSteelMat
  );
  barrelSleeve.rotation.x = Math.PI / 2;
  barrelSleeve.position.set(0, 0, 0.63);
  receiverAndDrum.add(barrelSleeve);

  // Боковые накладные бронеплиты с заклёпками
  for (const side of [-1, 1]) {
    const sideArmor = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.21, 0.88),
      armorOliveDarkMat
    );
    sideArmor.position.set(side * 0.192, -0.01, -0.08);
    sideArmor.castShadow = true;
    receiverAndDrum.add(sideArmor);

    for (let z = -0.46; z <= 0.301; z += 0.15) {
      addFastener(receiverAndDrum, side * 0.204, 0.075, z, 0, 0, -side * Math.PI / 2, 1.0);
      addFastener(receiverAndDrum, side * 0.204, -0.095, z, 0, 0, -side * Math.PI / 2, 1.0);
    }
  }

  // Правый борт (+X): окно экстракции гильз/звеньев с бронещитком-отражателем
  const ejectionHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.11, 0.24),
    bluedSteelMat
  );
  ejectionHousing.position.set(0.20, 0.01, 0.12);
  receiverAndDrum.add(ejectionHousing);

  const ejectionSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.075, 0.19),
    boreDarkMat
  );
  ejectionSlot.position.set(0.224, 0.01, 0.12);
  receiverAndDrum.add(ejectionSlot);

  // Задний гидробуфер отката и рукоятка перезаряжания (до локального Z = -0.73 -> мировой Z = -0.65)
  const rearBufferCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.095, 0.08, 20),
    bluedSteelMat
  );
  rearBufferCap.rotation.x = Math.PI / 2;
  rearBufferCap.position.set(0, 0, -0.69);
  receiverAndDrum.add(rearBufferCap);

  // Задние силовые поручни обслуживания
  for (const hx of [-0.12, 0.12]) {
    const handleBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.18, 12),
      bluedSteelMat
    );
    handleBar.position.set(hx, 0, -0.71);
    receiverAndDrum.add(handleBar);

    for (const hy of [-0.075, 0.075]) {
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.016, 0.05, 10),
        armorOliveDarkMat
      );
      stand.rotation.x = Math.PI / 2;
      stand.position.set(hx, hy, -0.685);
      receiverAndDrum.add(stand);
    }
  }

  if (typeof boreDarkMat === 'undefined') {
    // страховочный фолбэк (не должен срабатывать)
  }

  // --- 5.2. Массивный сервопривод вертикального угла возвышения (навесная стрельба) ---
  const elevationServoGroup = new THREE.Group();
  elevationServoGroup.name = 'elevationServoDrive';
  elevationServoGroup.position.set(0.255, 0, 0);
  receiverAndDrum.add(elevationServoGroup);

  // Зубчатый сектор наведения по углу возвышения (от -10° до +70° для навесной стрельбы)
  const sectorRadius = 0.26;
  const sectorShape = new THREE.Shape();
  const startAng = -0.25;
  const endAng = 1.25;
  sectorShape.moveTo(0, 0);
  sectorShape.absarc(0, 0, sectorRadius, startAng, endAng, false);
  sectorShape.closePath();

  const sectorGeo = new THREE.ExtrudeGeometry(sectorShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 1,
  });
  sectorGeo.rotateY(-Math.PI / 2);
  const sectorMesh = new THREE.Mesh(sectorGeo, bluedSteelMat);
  sectorMesh.position.set(0.02, 0, 0);
  sectorMesh.castShadow = true;
  elevationServoGroup.add(sectorMesh);

  // Нарезные зубья по дуге сектора
  const teethCount = 22;
  for (let i = 0; i <= teethCount; i++) {
    const a = startAng + (i / teethCount) * (endAng - startAng);
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.016, 0.014), fastenerMat);
    tooth.position.set(
      0.002,
      Math.sin(a) * (sectorRadius + 0.006),
      Math.cos(a) * (sectorRadius + 0.006)
    );
    tooth.rotation.x = -a;
    elevationServoGroup.add(tooth);
  }

  // Корпус планетарного редуктора и мощный бесколлекторный серводвигатель
  const gearbox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.095, 0.11, 20),
    armorOliveDarkMat
  );
  gearbox.rotation.z = Math.PI / 2;
  gearbox.position.set(0.045, 0.13, 0.18);
  gearbox.castShadow = true;
  elevationServoGroup.add(gearbox);

  const servoMotor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.072, 0.25, 20),
    bluedSteelMat
  );
  servoMotor.position.set(0.055, 0.24, 0.18);
  servoMotor.castShadow = true;
  elevationServoGroup.add(servoMotor);

  // Оребрение охлаждения серводвигателя
  for (let fy = 0.17; fy <= 0.33; fy += 0.025) {
    const fin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.081, 0.081, 0.008, 20),
      armorOliveDarkMat
    );
    fin.position.set(0.055, fy, 0.18);
    elevationServoGroup.add(fin);
  }

  // Бронированный силовой кабель от сервопривода к плите УСП
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.055, 0.36, 0.18),
    new THREE.Vector3(0.04, 0.43, 0.14),
    new THREE.Vector3(-0.04, 0.45, 0.02),
    new THREE.Vector3(-0.08, 0.42, -0.08),
  ]);
  const cableMesh = new THREE.Mesh(
    new THREE.TubeGeometry(cableCurve, 20, 0.016, 10, false),
    rubberMat
  );
  elevationServoGroup.add(cableMesh);

  // --- 5.3. Барабанный магазин-«улитка» сбоку (-X) ---
  const drumGroup = new THREE.Group();
  drumGroup.name = 'snailDrumMagazine';
  drumGroup.position.set(-0.37, -0.03, -0.06);
  receiverAndDrum.add(drumGroup);

  const drumRadius = 0.275;
  const drumWidth = 0.24;

  // Основной цилиндр барабана с трафаретной крышкой на наружном торце (-X)
  const drumGeo = new THREE.CylinderGeometry(drumRadius, drumRadius, drumWidth, 36);
  drumGeo.rotateZ(Math.PI / 2);
  const drumMaterials = [
    armorOliveMat,    // Боковая обечайка
    armorOliveDarkMat,// +X внутренняя стенка
    drumStencilMat,   // -X наружная стенка с трафаретом «АГС-40»
  ];
  const drumCylinder = new THREE.Mesh(drumGeo, drumMaterials);
  drumCylinder.castShadow = true;
  drumCylinder.receiveShadow = true;
  drumGroup.add(drumCylinder);

  // Выштамповки (рельефные рёбра жёсткости) на наружной и внутренней стенках барабана
  for (const rRing of [0.14, 0.225]) {
    const stampingRing = new THREE.Mesh(
      new THREE.TorusGeometry(rRing, 0.011, 10, 36),
      armorOliveMat
    );
    stampingRing.rotation.y = Math.PI / 2;
    stampingRing.position.set(-drumWidth / 2 - 0.002, 0, 0);
    drumGroup.add(stampingRing);
  }

  // Радиальные лучевые выштамповки на наружной крышке (-X)
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.022, 0.145),
      armorOliveDarkMat
    );
    spoke.position.set(
      -drumWidth / 2 - 0.003,
      Math.sin(ang) * 0.155,
      Math.cos(ang) * 0.155
    );
    spoke.rotation.x = -ang;
    drumGroup.add(spoke);
  }

  // Центральная ступица механизма подпружинивания подавателя
  const drumHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.078, 0.036, 20),
    bluedSteelMat
  );
  drumHub.rotation.z = Math.PI / 2;
  drumHub.position.set(-drumWidth / 2 - 0.016, 0, 0);
  drumGroup.add(drumHub);

  // Рычаг взвода пружины барабана
  const windLever = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.13, 0.026), fastenerMat);
  windLever.position.set(-drumWidth / 2 - 0.035, 0.03, 0);
  drumGroup.add(windLever);

  // Заклёпки по ободу барабана
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    addFastener(
      drumGroup,
      -drumWidth / 2 - 0.004,
      Math.sin(a) * (drumRadius - 0.018),
      Math.cos(a) * (drumRadius - 0.018),
      0,
      0,
      Math.PI / 2,
      0.95
    );
  }

  // Горловина-«улитка» подачи ленты в левое окно приёмника ствольной коробки
  const snailShape = new THREE.Shape();
  snailShape.moveTo(0, 0.10);
  snailShape.quadraticCurveTo(0.18, 0.26, 0.34, 0.14);
  snailShape.lineTo(0.34, 0.04);
  snailShape.quadraticCurveTo(0.18, 0.11, 0.04, 0.0);
  snailShape.closePath();

  const snailNeckGeo = new THREE.ExtrudeGeometry(snailShape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  // Поворачиваем в плоскость XY (от центра барабана вправо к ствольной коробке)
  snailNeckGeo.translate(0, 0, -0.08);
  const snailNeck = new THREE.Mesh(snailNeckGeo, armorOliveDarkMat);
  snailNeck.position.set(-0.12, 0.04, 0);
  snailNeck.castShadow = true;
  drumGroup.add(snailNeck);

  // Индикатор остатка боекомплекта (смотровое окно на передней обечайке барабана с 40-мм гранатами)
  const indicatorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.17, 0.025),
    bluedSteelMat
  );
  indicatorFrame.position.set(0, 0.04, drumRadius - 0.004);
  indicatorFrame.rotation.x = -0.15;
  drumGroup.add(indicatorFrame);

  const indicatorRecess = new THREE.Mesh(
    new THREE.BoxGeometry(0.105, 0.145, 0.015),
    boreDarkMat
  );
  indicatorRecess.position.set(0, 0.04, drumRadius + 0.003);
  indicatorRecess.rotation.x = -0.15;
  drumGroup.add(indicatorRecess);

  // Видимые 40-мм безгильзовые/телескопические выстрелы внутри индикатора
  const ammoStackGroup = new THREE.Group();
  ammoStackGroup.name = 'ammoIndicatorRounds';
  ammoStackGroup.position.set(0, 0.04, drumRadius + 0.004);
  ammoStackGroup.rotation.x = -0.15;
  drumGroup.add(ammoStackGroup);

  for (let r = -2; r <= 2; r++) {
    const roundMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.095, 12),
      brassAmmoMat
    );
    roundMesh.rotation.z = Math.PI / 2;
    roundMesh.position.set(0, r * 0.026, 0);
    ammoStackGroup.add(roundMesh);
  }

  // --- 5.4. Механический баллистический вычислитель-квадрант с оптическим видоискателем ---
  const sightBracketGroup = new THREE.Group();
  sightBracketGroup.name = 'ballisticQuadrantSight';
  // Размещаем на левом верхнем кронштейне (ниже фланца УСП с зазором по высоте)
  sightBracketGroup.position.set(-0.175, 0.215, 0.18);
  receiverAndDrum.add(sightBracketGroup);

  // Кронштейн типа «ласточкин хвост» с эксцентриковым зажимом
  const mountArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.14), armorOliveDarkMat);
  mountArm.position.set(0.015, -0.025, 0);
  mountArm.castShadow = true;
  sightBracketGroup.add(mountArm);

  // Корпус механического баллистического вычислителя-квадранта
  const calcBody = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.085, 0.12), armorOliveMat);
  calcBody.position.set(-0.01, 0.03, -0.01);
  calcBody.castShadow = true;
  sightBracketGroup.add(calcBody);

  // Барабанчик углов возвышения с градуированной шкалой
  const dialMat = new THREE.MeshStandardMaterial({
    map: quadrantDialTex,
    metalness: 0.4,
    roughness: 0.45,
  });
  const elevationDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.034, 0.055, 24),
    [dialMat, bluedSteelMat, bluedSteelMat]
  );
  elevationDrum.rotation.z = Math.PI / 2;
  elevationDrum.position.set(-0.065, 0.035, -0.01);
  sightBracketGroup.add(elevationDrum);

  // Тяга синхронизации угла возвышения от оси цапф к вычислителю
  const linkageRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.007, 0.25, 10),
    fastenerMat
  );
  linkageRod.position.set(-0.035, -0.10, -0.09);
  linkageRod.rotation.x = 0.55;
  sightBracketGroup.add(linkageRod);

  // Оптический видоискатель (трубка прицела с блендой и резиновым наглазником)
  const opticTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.022, 0.21, 20),
    bluedSteelMat
  );
  opticTube.rotation.x = Math.PI / 2;
  opticTube.position.set(-0.01, 0.085, 0.01);
  opticTube.castShadow = true;
  sightBracketGroup.add(opticTube);

  // Передняя бленда объектива (+Z)
  const sunShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.029, 0.025, 0.055, 20),
    bluedSteelMat
  );
  sunShade.rotation.x = Math.PI / 2;
  sunShade.position.set(-0.01, 0.085, 0.125);
  sightBracketGroup.add(sunShade);

  // Просветлённая линза объектива
  const frontLens = new THREE.Mesh(
    new THREE.CircleGeometry(0.024, 20),
    opticLensMat
  );
  frontLens.position.set(-0.01, 0.085, 0.145);
  sightBracketGroup.add(frontLens);

  // Резиновый наглазник окуляра (-Z)
  const eyecup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.021, 0.042, 20, 1, true),
    rubberMat
  );
  eyecup.rotation.x = Math.PI / 2;
  eyecup.position.set(-0.01, 0.085, -0.11);
  sightBracketGroup.add(eyecup);

  // ============================================================================
  // 6. УЗЕЛ 3: КОРОТКИЙ ТОЛСТОСТЕННЫЙ СТВОЛ (mortarBarrelGroup)
  // ============================================================================
  // Отдельная группа для скорострельной анимации отката вдоль -Z.
  // Выступает вперёд до мирового Z = 1.65 (локальный Z = 1.65 - 0.08 = 1.57).
  const mortarBarrelGroup = new THREE.Group();
  mortarBarrelGroup.name = 'mortarBarrelGroup';
  receiverAndDrum.add(mortarBarrelGroup);

  // Профиль толстостенного ствола-мортиры (LatheGeometry вдоль +Z)
  // Калибр 40 мм (внутренний радиус 0.020 м), толстые стенки (внешний радиус до 0.115 м)
  const barrelPoints = [
    new THREE.Vector2(0.020, 0.42),   // Казённый срез (внутри направляющей муфты)
    new THREE.Vector2(0.115, 0.42),   // Усиленная казённая часть
    new THREE.Vector2(0.115, 0.68),
    new THREE.Vector2(0.098, 0.71),   // Переходный конус
    new THREE.Vector2(0.098, 1.24),   // Основной толстостенный ствол-мортира
    new THREE.Vector2(0.086, 1.26),   // Дульный срез перед ДТК
    new THREE.Vector2(0.020, 1.26),   // Внутренняя фаска дульного среза
    new THREE.Vector2(0.020, 0.42),
  ];

  const barrelLatheGeo = new THREE.LatheGeometry(barrelPoints, 32);
  barrelLatheGeo.rotateX(Math.PI / 2); // Ориентируем вдоль +Z
  const thickBarrelMesh = new THREE.Mesh(barrelLatheGeo, bluedSteelMat);
  thickBarrelMesh.castShadow = true;
  thickBarrelMesh.receiveShadow = true;
  mortarBarrelGroup.add(thickBarrelMesh);

  // Внутренний тёмный канал ствола (40 мм)
  const boreCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0205, 0.0205, 1.15, 20, 1, true),
    boreDarkMat
  );
  boreCylinder.rotation.x = Math.PI / 2;
  boreCylinder.position.set(0, 0, 0.99);
  mortarBarrelGroup.add(boreCylinder);

  // Продольные рёбра охлаждения (рифление толстостенного ствола-мортиры)
  const fluteCount = 12;
  for (let i = 0; i < fluteCount; i++) {
    const angle = (i / fluteCount) * Math.PI * 2;
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.024, 0.48),
      bluedSteelMat
    );
    const rPos = 0.098;
    rib.position.set(Math.cos(angle) * rPos, Math.sin(angle) * rPos, 0.97);
    rib.rotation.z = angle;
    rib.castShadow = true;
    mortarBarrelGroup.add(rib);
  }

  // Поперечные бандажные кольца ствола
  for (const bz of [0.73, 0.97, 1.21]) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.106, 0.106, 0.026, 28),
      armorOliveDarkMat
    );
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0, bz);
    mortarBarrelGroup.add(band);
  }

  // Траверса (упорная обойма) крепления возвратных пружин на стволе (локальный Z = 1.16)
  const springCollarZ = 1.16;
  const springCollar = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.11, 0.048),
    armorOliveDarkMat
  );
  springCollar.position.set(0, 0, springCollarZ);
  springCollar.castShadow = true;
  mortarBarrelGroup.add(springCollar);

  // Направляющие штоки возвратных пружин по бокам ствола (±X)
  const springSideX = 0.145;
  for (const side of [-1, 1]) {
    const guideRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.66, 12),
      fastenerMat
    );
    guideRod.rotation.x = Math.PI / 2;
    guideRod.position.set(side * springSideX, 0, 0.87);
    mortarBarrelGroup.add(guideRod);

    // Торцевая гайка штока
    const endNut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.020, 0.020, 0.024, 6),
      bluedSteelMat
    );
    endNut.rotation.x = Math.PI / 2;
    endNut.position.set(side * springSideX, 0, 1.195);
    mortarBarrelGroup.add(endNut);
  }

  // --- Массивный дульный тормоз-компенсатор (ДТК) до мирового Z = 1.65 (локальный Z = 1.57) ---
  const muzzleBrakeGroup = new THREE.Group();
  muzzleBrakeGroup.name = 'muzzleBrakeCompensator';
  muzzleBrakeGroup.position.set(0, 0, 1.26); // Длина ДТК = 0.31 м -> торец на локальном Z = 1.57 (мировой 1.65)
  mortarBarrelGroup.add(muzzleBrakeGroup);

  // Зажимная муфта ДТК с стяжными болтами
  const brakeCollar = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.21, 0.065),
    bluedSteelMat
  );
  brakeCollar.position.set(0, 0, 0.0325);
  brakeCollar.castShadow = true;
  muzzleBrakeGroup.add(brakeCollar);

  for (const by of [-0.075, 0.075]) {
    addFastener(muzzleBrakeGroup, -0.106, by, 0.032, 0, 0, Math.PI / 2, 1.15);
    addFastener(muzzleBrakeGroup, 0.106, by, 0.032, 0, 0, -Math.PI / 2, 1.15);
  }

  // Верхняя и нижняя силовые плиты трёхкамерного ДТК
  for (const py of [-0.095, 0.095]) {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.026, 0.245),
      bluedSteelMat
    );
    plate.position.set(0, py, 0.1875);
    plate.castShadow = true;
    muzzleBrakeGroup.add(plate);
  }

  // 4 поперечные перегородки-отсекатели (baffles) с угловым наклоном для отвода пороховых газов назад-вбок
  const bafflePositionsZ = [0.085, 0.155, 0.225, 0.295];
  bafflePositionsZ.forEach((bz, idx) => {
    const isFrontCrown = idx === bafflePositionsZ.length - 1;
    const baffle = new THREE.Mesh(
      new THREE.BoxGeometry(0.235, 0.215, isFrontCrown ? 0.030 : 0.022),
      bluedSteelMat
    );
    baffle.position.set(0, 0, bz);
    baffle.castShadow = true;
    muzzleBrakeGroup.add(baffle);

    // Боковые косые дефлекторы в камерах
    if (!isFrontCrown) {
      for (const sx of [-0.072, 0.072]) {
        const vane = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.165, 0.016),
          boreDarkMat
        );
        vane.position.set(sx, 0, bz + 0.035);
        vane.rotation.y = Math.sign(sx) * 0.32;
        muzzleBrakeGroup.add(vane);
      }
    }
  });

  // Верхние щели компенсатора подброса ствола
  for (const sz of [0.12, 0.19, 0.26]) {
    const ventSlot = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.03, 0.032),
      boreDarkMat
    );
    ventSlot.position.set(0, 0.096, sz);
    muzzleBrakeGroup.add(ventSlot);
  }

  // --- Внешние возвратные пружины по бокам ствола (сжимаются при откате) ---
  // Крепятся к передней стенке ствольной коробки (локальный Z = 0.63) и упираются в траверсу ствола (Z = 1.16)
  class HelixSpringCurve extends THREE.Curve {
    constructor(radius, length, turns) {
      super();
      this.radius = radius;
      this.length = length;
      this.turns = turns;
    }
    getPoint(t, optionalTarget = new THREE.Vector3()) {
      const angle = t * Math.PI * 2 * this.turns;
      const x = Math.cos(angle) * this.radius;
      const y = Math.sin(angle) * this.radius;
      const z = t * this.length;
      return optionalTarget.set(x, y, z);
    }
  }

  const springBaseLength = springCollarZ - 0.63; // 0.53 м
  const springCurve = new HelixSpringCurve(0.025, springBaseLength, 14);
  const springGeo = new THREE.TubeGeometry(springCurve, 140, 0.0065, 8, false);

  const returnSprings = [];
  for (const side of [-1, 1]) {
    const springMesh = new THREE.Mesh(springGeo, bluedSteelMat);
    springMesh.position.set(side * springSideX, 0, 0.63);
    springMesh.castShadow = true;
    receiverAndDrum.add(springMesh);
    returnSprings.push(springMesh);
  }

  // ============================================================================
  // 7. СБОРКА ЕДИНОГО INSTANCED MESH ДЛЯ МЕЛКОГО КРЕПЕЖА И ЗАКЛЁПОК
  // ============================================================================
  // Геометрия шестигранного болта с пресс-шайбой
  const boltGeo = new THREE.CylinderGeometry(0.0075, 0.0085, 0.008, 6);
  const rivetsInstancedMesh = new THREE.InstancedMesh(
    boltGeo,
    fastenerMat,
    fastenerTransforms.length
  );
  rivetsInstancedMesh.name = 'fastenersAndRivetsInstanced';
  rivetsInstancedMesh.castShadow = true;

  // Обновляем мировые матрицы иерархии перед записью в InstancedMesh
  root.updateMatrixWorld(true);
  const _finalMatrix = new THREE.Matrix4();

  fastenerTransforms.forEach((item, index) => {
    item.parent.updateMatrixWorld(true);
    _finalMatrix.multiplyMatrices(item.parent.matrixWorld, item.localMatrix);
    rivetsInstancedMesh.setMatrixAt(index, _finalMatrix);
  });
  rivetsInstancedMesh.instanceMatrix.needsUpdate = true;
  root.add(rivetsInstancedMesh);

  // Сохраняем ссылки на ключевые узлы для удобного доступа при анимации
  root.userData = {
    mountFlange,
    receiverAndDrum,
    mortarBarrelGroup,
    returnSprings,
    springBaseLength,
    ammoStackGroup,
  };

  return root;
}

// =========================================================================
// Адаптер под единый просмотрщик: очередь 5 выстрелов / 1.9 с.
// applyGl(t): детерминированный прогон пружинно-демпферной физики отката.
// Возвращает { fired, flash } для телеметрии.
// =========================================================================
export function createWeapon() {
  const root = createWeaponAGS40BalkanM();
  const ud = root.userData;
  const barrel = root.getObjectByName('mortarBarrelGroup');
  const receiver = root.getObjectByName('receiverAndDrum');
  const springs = ud.returnSprings;
  const springLen = ud.springBaseLength;

  const flashLight = new THREE.PointLight(0xff9429, 0, 3.5);
  flashLight.position.set(0, 0, 1.52);
  barrel.add(flashLight);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffb347,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const flashCone = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.34, 16, 1, true), flashMat);
  flashCone.rotation.x = Math.PI / 2;
  flashCone.position.set(0, 0, 1.66);
  barrel.add(flashCone);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  // Детерминированный прогон физики очереди от 0 до t (шаг 1/120 с).
  const poseAt = (t) => {
    let off = 0, vel = 0, flash = 0, kick = 0, fired = 0, nextFire = 0;
    const dt = 1 / 120;
    for (let tt = 0; tt < t; tt += dt) {
      if (fired < 5 && tt >= nextFire) {
        vel = -3.4;
        flash = 1.0;
        kick = -0.014;
        fired++;
        nextFire += 0.15;
      }
      vel += (-380.0 * off - 26.0 * vel) * dt;
      off += vel * dt;
      if (off < -0.135) { off = -0.135; vel = Math.max(0, vel); }
      if (off > 0) { off = 0; vel = 0; }
      flash = Math.max(0, flash - dt * 16.0);
      kick += (0 - kick) * Math.min(1, dt * 18);
    }
    barrel.position.z = off;
    const ratio = Math.max(0.55, (springLen + off) / springLen);
    for (const s of springs) s.scale.z = ratio;
    receiver.rotation.x = kick;
    flashLight.intensity = flash * 14.0;
    flashMat.opacity = flash * 0.85;
    flashCone.scale.setScalar(0.75 + flash * 0.45);
    return { fired, flash };
  };

  ud.applyGl = (t) => poseAt(Math.max(0, Math.min(GL_CYCLE, t)));
  ud.setExtension = (t) => {
    const info = ud.applyGl(t);
    return info;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
