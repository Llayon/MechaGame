import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const meta = {
  id: 'm311',
  code: '9М311',
  title: '9М311 «Тунгуска-Р»',
  subtitle: 'ТЯЖЁЛЫЙ ЗЕНИТНО-РАКЕТНЫЙ БЛОК ПВО • 2×4 ТПК • СЛОТ MAIN',
  description: 'Тяжёлый зенитно-ракетный блок ПВО: фланец УСП с гидроприводами, центральная РЛС сопровождения со щелевой антенной и оптико-локационной головкой, две кассеты по 4 ТПК 9М311. Антенный пост непрерывно сканирует сектор ±38°.',
  specs: [
    ['Ракеты', '2 × 4 ТПК 9М311'],
    ['РЛС', 'Сектор ±38°, nod ±8°'],
    ['Наведение', 'РЛС + ОЛС + лазер'],
    ['Слот', 'MAIN'],
    ['Габариты', '~1.5×1.0×2.6 м'],
  ],
  maxExtension: 1.0,
  unit: '%',
  tipOffset: 1.32,
  subgroups: [
    { key: 'mountFlange', label: '1. Усиленный фланец УСП' },
    { key: 'radarCenterPod', label: '2. РЛС сопровождения и ОЛС' },
    { key: 'leftPod', label: '3. Левая кассета 4×ЗУР' },
    { key: 'rightPod', label: '4. Правая кассета 4×ЗУР' },
  ],
  cameras: {
    module: { pos: [2.35, 1.55, 2.75], target: [0, 0.52, 0.05] },
  },
  rangeMarkers: [],
  controls: 'sam',
};

/**
 * Процедурная генерация текстуры диагональной жёлто-чёрной предупреждающей разметки (УСП)
 */
function createHazardStripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d89e18';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1b1d20';
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

  // Лёгкий индустриальный износ и потертости
  for (let i = 0; i < 650; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = Math.random() * 2.5 + 0.5;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(30,30,30,0.22)' : 'rgba(235,210,140,0.16)';
    ctx.fillRect(x, y, r * 2, r);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Процедурная трафаретная маркировка ТПК: «9М311 / ОПАСНО: ПУСК»
 */
function createStencilMarkingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Предупреждающая красно-белая плашка
  ctx.fillStyle = 'rgba(175, 36, 30, 0.9)';
  ctx.fillRect(42, 36, 460, 14);
  ctx.fillRect(42, 198, 460, 14);

  // Основной индекс ракеты
  ctx.fillStyle = 'rgba(22, 25, 28, 0.88)';
  ctx.font = 'bold 64px "Arial", "DejaVu Sans", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('9М311', 46, 94);

  // Предупреждение о пуске
  ctx.fillStyle = 'rgba(168, 32, 26, 0.92)';
  ctx.font = 'bold 34px "Arial", "DejaVu Sans", sans-serif';
  ctx.fillText('ОПАСНО: ПУСК', 46, 158);

  // Технические трафаретные индексы и стрелка направления
  ctx.fillStyle = 'rgba(22, 25, 28, 0.82)';
  ctx.font = 'bold 22px "Arial", "DejaVu Sans", sans-serif';
  ctx.fillText('ТПК-9М311-01', 550, 82);
  ctx.fillText('МАССА 57 КГ', 550, 118);
  ctx.fillText('НЕ КАНТОВАТЬ', 550, 154);

  // Направляющая стрелка пуска (+Z)
  ctx.strokeStyle = 'rgba(22, 25, 28, 0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(780, 118);
  ctx.lineTo(950, 118);
  ctx.lineTo(924, 98);
  ctx.moveTo(950, 118);
  ctx.lineTo(924, 138);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Процедурная карта микрорельефа окрашенной брони и металла
 */
function createMetalBumpTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 110 + Math.floor(Math.random() * 36);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
}

/**
 * Процедурная текстура щелевой антенной решётки РЛС
 */
function createRadarArrayTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#25292e';
  ctx.fillRect(0, 0, 512, 512);

  // Горизонтальные волноводные каналы и щели излучения
  for (let y = 24; y < 488; y += 22) {
    ctx.fillStyle = '#181b1f';
    ctx.fillRect(28, y, 456, 10);

    ctx.fillStyle = '#484f58';
    for (let x = 40; x < 464; x += 28) {
      ctx.fillRect(x, y + 2, 14, 6);
    }
  }

  // Крепёжные заклёпки по периметру
  ctx.fillStyle = '#5c636c';
  for (let i = 16; i <= 496; i += 32) {
    ctx.beginPath();
    ctx.arc(i, 12, 3, 0, Math.PI * 2);
    ctx.arc(i, 500, 3, 0, Math.PI * 2);
    ctx.arc(12, i, 3, 0, Math.PI * 2);
    ctx.arc(500, i, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Вспомогательная функция создания гидравлического цилиндра между двумя точками
 */
function createHydraulicActuator(startVec, endVec, barrelMat, rodMat, jointMat) {
  const actuator = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(endVec, startVec);
  const totalLen = dir.length();
  const unitDir = dir.clone().normalize();

  const barrelLen = totalLen * 0.56;
  const rodLen = totalLen * 0.56;

  // Корпус гидроцилиндра
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.032, barrelLen, 16),
    barrelMat
  );
  barrel.position.y = barrelLen * 0.5;
  barrel.castShadow = true;
  actuator.add(barrel);

  // Сальниковая муфта
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.035, 16),
    jointMat
  );
  collar.position.y = barrelLen;
  actuator.add(collar);

  // Хромированный шток
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.017, rodLen, 16),
    rodMat
  );
  rod.position.y = totalLen - rodLen * 0.5;
  rod.castShadow = true;
  actuator.add(rod);

  // Проушины крепления
  const clevisGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.044, 14);
  clevisGeo.rotateZ(Math.PI / 2);

  const bottomClevis = new THREE.Mesh(clevisGeo, jointMat);
  actuator.add(bottomClevis);

  const topClevis = new THREE.Mesh(clevisGeo, jointMat);
  topClevis.position.y = totalLen;
  actuator.add(topClevis);

  actuator.position.copy(startVec);
  actuator.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), unitDir);

  return actuator;
}

/**
 * Создаёт процедурную 3D-модель тяжёлого зенитно-ракетного блока ПВО 9М311 «Тунгуска-Р»
 * Габариты: ~1.5 x 1.0 x 2.6 м | Направление пуска: +Z | Верх: +Y | Точка привязки (0,0,0): центр нижнего фланца УСП
 * @returns {THREE.Group}
 */
export function createWeapon9M311TunguskaR() {
  const root = new THREE.Group();
  root.name = 'Weapon_9M311_TunguskaR';

  // Текстуры
  const bumpMap = createMetalBumpTexture();
  const hazardTex = createHazardStripeTexture();
  const stencilTex = createStencilMarkingTexture();
  const radarArrayTex = createRadarArrayTexture();

  // Основные PBR-материалы
  const khakiMat = new THREE.MeshStandardMaterial({
    color: 0x475041,
    metalness: 0.45,
    roughness: 0.65,
    bumpMap,
    bumpScale: 0.004
  });

  const containerGreyMat = new THREE.MeshStandardMaterial({
    color: 0x73797f,
    metalness: 0.35,
    roughness: 0.60,
    bumpMap,
    bumpScale: 0.003
  });

  const graphiteMat = new THREE.MeshStandardMaterial({
    color: 0x2c3035,
    metalness: 0.80,
    roughness: 0.35,
    bumpMap,
    bumpScale: 0.002
  });

  const noseConeMat = new THREE.MeshStandardMaterial({
    color: 0x4e5459,
    metalness: 0.25,
    roughness: 0.55
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd8dee6,
    metalness: 0.94,
    roughness: 0.14
  });

  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x1b1d20,
    metalness: 0.2,
    roughness: 0.78
  });

  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    metalness: 0.3,
    roughness: 0.55
  });

  const stencilMat = new THREE.MeshStandardMaterial({
    map: stencilTex,
    transparent: true,
    roughness: 0.65,
    metalness: 0.15,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });

  const radarFaceMat = new THREE.MeshStandardMaterial({
    map: radarArrayTex,
    color: 0x8f969e,
    metalness: 0.82,
    roughness: 0.32
  });

  const opticLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x091c24,
    emissive: 0x052836,
    emissiveIntensity: 0.45,
    metalness: 0.1,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });

  // =========================================================================
  // 1. УСИЛЕННЫЙ СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Нижняя опорная плита УСП: 0.75 x 0.18 x 1.05 м (нижняя грань строго на y = 0)
  const flangeW = 0.75;
  const flangeH = 0.18;
  const flangeL = 1.05;
  const bevel = 0.035;

  const baseShape = new THREE.Shape();
  const hw = flangeW * 0.5 - bevel;
  const hl = flangeL * 0.5 - bevel;
  baseShape.moveTo(-hw, -hl - bevel);
  baseShape.lineTo(hw, -hl - bevel);
  baseShape.lineTo(hw + bevel, -hl);
  baseShape.lineTo(hw + bevel, hl);
  baseShape.lineTo(hw, hl + bevel);
  baseShape.lineTo(-hw, hl + bevel);
  baseShape.lineTo(-hw - bevel, hl);
  baseShape.lineTo(-hw - bevel, -hl);
  baseShape.closePath();

  const basePlateGeo = new THREE.ExtrudeGeometry(baseShape, {
    depth: flangeH - 0.02,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2
  });
  basePlateGeo.rotateX(Math.PI * 0.5);

  const basePlate = new THREE.Mesh(basePlateGeo, khakiMat);
  basePlate.position.set(0, flangeH - 0.01, 0);
  basePlate.castShadow = true;
  basePlate.receiveShadow = true;
  mountFlange.add(basePlate);

  // Полоса жёлто-чёрной предупреждающей маркировки по периметру фланца
  const stripeH = 0.055;
  const sideStripeGeo = new THREE.BoxGeometry(flangeW + 0.024, stripeH, flangeL - 0.06);
  const sideStripes = new THREE.Mesh(sideStripeGeo, hazardMat);
  sideStripes.position.set(0, 0.055, 0);
  mountFlange.add(sideStripes);

  const endStripeGeo = new THREE.BoxGeometry(flangeW - 0.06, stripeH, flangeL + 0.024);
  const endStripes = new THREE.Mesh(endStripeGeo, hazardMat);
  endStripes.position.set(0, 0.055, 0);
  mountFlange.add(endStripes);

  // Силовые стыковочные болты УСП по периметру плиты
  const boltGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.022, 6);
  for (let i = -3; i <= 3; i++) {
    for (const sx of [-1, 1]) {
      const bolt = new THREE.Mesh(boltGeo, graphiteMat);
      bolt.position.set(sx * (flangeW * 0.5 - 0.042), flangeH + 0.008, i * 0.14);
      mountFlange.add(bolt);
    }
  }

  // Поворотный погон и цапфы наведения по углу места
  const azimuthRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.31, 0.06, 24),
    graphiteMat
  );
  azimuthRing.position.set(0, flangeH + 0.03, 0);
  azimuthRing.castShadow = true;
  mountFlange.add(azimuthRing);

  // Поперечная несущая балка-коромысло для крепления левой и правой кассет ЗУР
  const crossBeam = new THREE.Mesh(
    new THREE.BoxGeometry(1.26, 0.11, 0.34),
    khakiMat
  );
  crossBeam.position.set(0, 0.29, -0.04);
  crossBeam.castShadow = true;
  crossBeam.receiveShadow = true;
  mountFlange.add(crossBeam);

  // Усиливающие косынки поперечной балки
  for (const sx of [-1, 1]) {
    const gusset = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.08, 0.24),
      graphiteMat
    );
    gusset.position.set(sx * 0.32, 0.24, -0.04);
    gusset.rotation.z = sx * 0.22;
    mountFlange.add(gusset);
  }

  // Парные силовые гидроприводы наклона (спереди и сзади)
  for (const sx of [-1, 1]) {
    const frontActuator = createHydraulicActuator(
      new THREE.Vector3(sx * 0.22, flangeH + 0.01, 0.36),
      new THREE.Vector3(sx * 0.22, 0.30, 0.11),
      khakiMat,
      chromeMat,
      graphiteMat
    );
    mountFlange.add(frontActuator);

    const rearActuator = createHydraulicActuator(
      new THREE.Vector3(sx * 0.22, flangeH + 0.01, -0.40),
      new THREE.Vector3(sx * 0.22, 0.30, -0.18),
      khakiMat,
      chromeMat,
      graphiteMat
    );
    mountFlange.add(rearActuator);
  }

  // =========================================================================
  // 2. ЦЕНТРАЛЬНАЯ РЛС СОПРОВОЖДЕНИЯ (radarCenterPod)
  // =========================================================================
  const radarCenterPod = new THREE.Group();
  radarCenterPod.name = 'radarCenterPod';
  // Точка вращения антенного поста по оси Y
  radarCenterPod.position.set(0, 0.345, 0.02);
  root.add(radarCenterPod);

  // Опорно-поворотный подшипник РЛС
  const radarTurretBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.19, 0.05, 24),
    graphiteMat
  );
  radarTurretBase.position.y = 0.025;
  radarTurretBase.castShadow = true;
  radarCenterPod.add(radarTurretBase);

  // Бронированная центральная колонка аппаратуры наведения
  const columnMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.36, 0.52),
    khakiMat
  );
  columnMesh.position.set(0, 0.22, -0.02);
  columnMesh.castShadow = true;
  columnMesh.receiveShadow = true;
  radarCenterPod.add(columnMesh);

  // Скошенный лобовой бронелист колонки (+Z)
  const frontArmor = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.32, 0.12),
    khakiMat
  );
  frontArmor.position.set(0, 0.21, 0.24);
  frontArmor.rotation.x = -0.18;
  frontArmor.castShadow = true;
  radarCenterPod.add(frontArmor);

  // Задний радиаторный блок охлаждения электроники (-Z)
  const rearCooler = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.26, 0.08),
    graphiteMat
  );
  rearCooler.position.set(0, 0.22, -0.29);
  radarCenterPod.add(rearCooler);

  for (let i = -3; i <= 3; i++) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.27, 0.012, 0.095),
      graphiteMat
    );
    fin.position.set(0, 0.22 + i * 0.032, -0.295);
    radarCenterPod.add(fin);
  }

  // Боковые люки обслуживания и ручки
  for (const sx of [-1, 1]) {
    const hatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.22, 0.30),
      graphiteMat
    );
    hatch.position.set(sx * 0.165, 0.22, -0.02);
    radarCenterPod.add(hatch);
  }

  // Антенный пост РЛС сопровождения цели и ракет (направлен строго на +Z)
  const radarDishAssembly = new THREE.Group();
  radarDishAssembly.name = 'radarDishAssembly';
  radarDishAssembly.position.set(0, 0.48, 0.06);
  radarCenterPod.add(radarDishAssembly);

  // Каркас/кожух зеркала антенны
  const dishShroud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.165, 0.145, 0.13, 24),
    khakiMat
  );
  dishShroud.rotation.x = Math.PI * 0.5;
  dishShroud.scale.set(1.18, 1.0, 0.88);
  dishShroud.castShadow = true;
  radarDishAssembly.add(dishShroud);

  // Рабочее щелевое полотно антенны (тёмный графит)
  const dishFace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.152, 0.152, 0.02, 24),
    radarFaceMat
  );
  dishFace.rotation.x = Math.PI * 0.5;
  dishFace.scale.set(1.16, 1.0, 0.86);
  dishFace.position.z = 0.062;
  radarDishAssembly.add(dishFace);

  // Волноводный облучатель в центре антенны
  const feedHorn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.032, 0.09, 12),
    graphiteMat
  );
  feedHorn.rotation.x = Math.PI * 0.5;
  feedHorn.position.z = 0.105;
  radarDishAssembly.add(feedHorn);

  const feedCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.024, 12, 10),
    noseConeMat
  );
  feedCap.position.z = 0.148;
  radarDishAssembly.add(feedCap);

  // Оптико-локационная головка (ОЛС) сверху РЛС (верх ~1.01 м от y=0)
  const opticalHead = new THREE.Group();
  opticalHead.name = 'opticalSightHead';
  opticalHead.position.set(0, 0.60, 0.04);
  radarCenterPod.add(opticalHead);

  const olsHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.12, 0.22),
    khakiMat
  );
  olsHousing.castShadow = true;
  opticalHead.add(olsHousing);

  // Бронекозырёк оптики
  const olsVisor = new THREE.Mesh(
    new THREE.BoxGeometry(0.215, 0.022, 0.25),
    graphiteMat
  );
  olsVisor.position.set(0, 0.062, 0.02);
  opticalHead.add(olsVisor);

  // Основной объектив тепловизора/ТВ-канала (+Z)
  const mainBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.046, 0.03, 20),
    graphiteMat
  );
  mainBezel.rotation.x = Math.PI * 0.5;
  mainBezel.position.set(-0.042, -0.005, 0.115);
  opticalHead.add(mainBezel);

  const mainLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
    opticLensMat
  );
  mainLens.rotation.x = Math.PI * 0.5;
  mainLens.position.set(-0.042, -0.005, 0.112);
  opticalHead.add(mainLens);

  // Лазерный дальномер / пеленгатор ракет (+Z)
  const auxBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.030, 0.028, 16),
    graphiteMat
  );
  auxBezel.rotation.x = Math.PI * 0.5;
  auxBezel.position.set(0.052, -0.005, 0.115);
  opticalHead.add(auxBezel);

  const auxLens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.021, 0.008, 16),
    opticLensMat
  );
  auxLens.rotation.x = Math.PI * 0.5;
  auxLens.position.set(0.052, -0.005, 0.128);
  opticalHead.add(auxLens);

  // =========================================================================
  // 3. ДВЕ КАССЕТЫ ПО 4 ЗУР (leftPod, rightPod)
  // =========================================================================
  // Аутентичный бикалиберный профиль ТПК ракеты 9М311 (LatheGeometry вдоль оси Y -> поворот на +Z)
  const tubeProfile = [
    new THREE.Vector2(0.001, -1.28),
    new THREE.Vector2(0.092, -1.28),
    new THREE.Vector2(0.104, -1.25),
    new THREE.Vector2(0.104, -0.18),
    new THREE.Vector2(0.082, -0.02),
    new THREE.Vector2(0.082, 1.12),
    new THREE.Vector2(0.087, 1.14),
    new THREE.Vector2(0.087, 1.16),
    new THREE.Vector2(0.001, 1.16)
  ];
  const tubeGeo = new THREE.LatheGeometry(tubeProfile, 28);
  tubeGeo.rotateX(Math.PI * 0.5);

  // Передний конический обтекатель-крышка (+Z, до z = +1.32 -> общая длина ~2.60 м)
  const noseConeGeo = new THREE.ConeGeometry(0.085, 0.17, 24);
  noseConeGeo.rotateX(Math.PI * 0.5);

  // Заднее сопловое кольцо выброса газа (-Z)
  const rearCapGeo = new THREE.TorusGeometry(0.086, 0.014, 10, 24);

  // Геометрия дугового трафарета «9М311 / ОПАСНО: ПУСК» на боковую поверхность ТПК
  const decalArcGeo = new THREE.CylinderGeometry(
    0.1055,
    0.1055,
    0.72,
    20,
    1,
    true,
    Math.PI * 0.18,
    Math.PI * 0.64
  );
  decalArcGeo.rotateZ(Math.PI * 0.5);
  decalArcGeo.rotateY(Math.PI * 0.5);

  function buildMissilePod(side) {
    const isRight = side > 0;
    const podGroup = new THREE.Group();
    podGroup.name = isRight ? 'rightPod' : 'leftPod';
    podGroup.position.set(side * 0.52, 0.555, 0.02);

    // Сетка 2 x 2 цилиндрических ТПК
    const spacing = 0.118;
    const offsets = [
      { x: -spacing, y: spacing },  // Верхний левый
      { x: spacing, y: spacing },   // Верхний правый
      { x: -spacing, y: -spacing }, // Нижний левый
      { x: spacing, y: -spacing }   // Нижний правый
    ];

    offsets.forEach((off, idx) => {
      const tubeUnit = new THREE.Group();
      tubeUnit.name = `missileTube_${idx + 1}`;
      tubeUnit.position.set(off.x, off.y, 0);

      // Основной корпус ТПК
      const body = new THREE.Mesh(tubeGeo, containerGreyMat);
      body.castShadow = true;
      body.receiveShadow = true;
      tubeUnit.add(body);

      // Коническая крышка-обтекатель спереди (+Z)
      const nose = new THREE.Mesh(noseConeGeo, noseConeMat);
      nose.position.z = 1.245;
      nose.castShadow = true;
      tubeUnit.add(nose);

      // Стяжной замок крышки
      const noseLockRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.089, 0.089, 0.022, 24),
        graphiteMat
      );
      noseLockRing.rotation.x = Math.PI * 0.5;
      noseLockRing.position.z = 1.155;
      tubeUnit.add(noseLockRing);

      // Задний торец контейнера (-Z)
      const rearRing = new THREE.Mesh(rearCapGeo, graphiteMat);
      rearRing.position.z = -1.275;
      tubeUnit.add(rearRing);

      // Трафаретная маркировка на внешних сторонах блока
      const isOuterTube = (isRight && off.x > 0) || (!isRight && off.x < 0);
      if (isOuterTube) {
        const decal = new THREE.Mesh(decalArcGeo, stencilMat);
        decal.position.set(0, 0, -0.68);
        if (!isRight) {
          decal.rotation.z = Math.PI;
        }
        tubeUnit.add(decal);
      }

      podGroup.add(tubeUnit);
    });

    // Три мощных силовых стяжных хомута-обоймы вдоль блока ТПК
    const clampZPositions = [-0.88, -0.14, 0.68];
    clampZPositions.forEach((cz, cIdx) => {
      const isFrontClamp = cIdx === 2;
      const frameSize = isFrontClamp ? 0.42 : 0.46;
      const clampGroup = new THREE.Group();
      clampGroup.position.z = cz;

      // Несущая плита-стяжка кассеты
      const web = new THREE.Mesh(
        new THREE.BoxGeometry(frameSize, frameSize, 0.065),
        khakiMat
      );
      web.castShadow = true;
      web.receiveShadow = true;
      clampGroup.add(web);

      // Центральный замок стяжки (тёмный графит)
      const centerLock = new THREE.Mesh(
        new THREE.BoxGeometry(0.095, 0.095, 0.088),
        graphiteMat
      );
      clampGroup.add(centerLock);

      // Боковые силовые стяжные замки и болтовые накладки
      for (const sx of [-1, 1]) {
        const sideClamp = new THREE.Mesh(
          new THREE.BoxGeometry(0.032, frameSize * 0.82, 0.082),
          graphiteMat
        );
        sideClamp.position.x = sx * (frameSize * 0.5 + 0.012);
        clampGroup.add(sideClamp);
      }

      podGroup.add(clampGroup);
    });

    // Нижний силовой подрамник крепления кассеты к поперечной балке УСП
    const subFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.065, 1.05),
      khakiMat
    );
    subFrame.position.set(0, -0.23, -0.12);
    subFrame.castShadow = true;
    podGroup.add(subFrame);

    // Распределительная коробка синхронизации пуска (на внутренней стороне кассеты)
    const innerX = -side * 0.22;
    const syncBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.14, 0.24),
      graphiteMat
    );
    syncBox.position.set(innerX, 0.0, -0.14);
    podGroup.add(syncBox);

    // Кабели синхронизации и пиропатронов к каждому из 4 контейнеров
    offsets.forEach((off) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(innerX, 0.0, -0.14),
        new THREE.Vector3(innerX - side * 0.03, off.y * 0.65, -0.02),
        new THREE.Vector3(off.x * 0.85, off.y * 0.92, 0.18),
        new THREE.Vector3(off.x, off.y + (off.y > 0 ? 0.084 : -0.084), 0.34)
      ]);
      const cableGeo = new THREE.TubeGeometry(curve, 16, 0.0085, 8, false);
      const cable = new THREE.Mesh(cableGeo, cableMat);
      cable.castShadow = true;
      podGroup.add(cable);

      // Штепсельный разъём на корпусе ТПК
      const plug = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.03, 10),
        graphiteMat
      );
      plug.position.set(off.x, off.y + (off.y > 0 ? 0.088 : -0.088), 0.34);
      podGroup.add(plug);
    });

    // Магистральный жгут от центральной колонки РЛС к кассете
    const mainTrunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.36, -0.16, -0.04),
      new THREE.Vector3(-side * 0.28, -0.12, -0.08),
      new THREE.Vector3(innerX, -0.03, -0.14)
    ]);
    const mainTrunk = new THREE.Mesh(
      new THREE.TubeGeometry(mainTrunkCurve, 12, 0.014, 8, false),
      cableMat
    );
    podGroup.add(mainTrunk);

    return podGroup;
  }

  const leftPod = buildMissilePod(-1);
  const rightPod = buildMissilePod(1);
  root.add(leftPod);
  root.add(rightPod);

  // Включаем тени для всех мешей модели
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return root;
}

// ===========================================================================
// Адаптер под единый просмотрщик: секторное сканирование РЛС ±38° + кивок зеркала.
// Возвращает { az, el, speed } для телеметрии.
// =========================================================================
export function createWeapon() {
  const root = createWeapon9M311TunguskaR();
  const ud = root.userData;
  const pod = root.getObjectByName('radarCenterPod');
  const dish = root.getObjectByName('radarDishAssembly');

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
    const az = Math.sin(t * 1.35) * 0.66 * s;
    const el = Math.sin(t * 2.7) * 0.08 * s - 0.04;
    if (pod) pod.rotation.y = az;
    if (dish) dish.rotation.x = el;
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
