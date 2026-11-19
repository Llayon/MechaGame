import * as THREE from 'three';

export const meta = {
  id: 'sarancha',
  code: 'САРАНЧА-С',
  title: '«Саранча-С»',
  subtitle: 'СВЕРХТЯЖЁЛЫЙ КОНТЕЙНЕРНЫЙ РОЕВОЙ КОМПЛЕКС • 192 ЯЧЕЙКИ • СЛОТ SUPERHEAVY • ЦИКЛ 14 С',
  description:
    'Сверхтяжёлый контейнерный роевой комплекс: сдвоенный лафет УСП, герметичная капсула в ажурной трубчатой ферме с баллонами наддува и криомагистралями. Карусельный улей на 192 ячейки запуска выдвигается из-под 4-лепесткового головного обтекателя. Цикл 14 с: раскрытие лепестков → выдвижение карусели → боевой режим → сворачивание.',
  specs: [
    ['Ячейки', '192 (4 яруса × 2×24)'],
    ['Обтекатель', '4 лепестка, 64°'],
    ['Выдвижение', '0.88 м + вращение'],
    ['Цикл', '14 с'],
    ['Слот', 'SUPERHEAVY'],
    ['Длина', '4.40 м'],
  ],
  maxExtension: 14.0,
  unit: 's',
  tipOffset: 3.2,
  subgroups: [
    { key: 'mountFlange', label: '1. Сдвоенный лафет УСП' },
    { key: 'capsuleHull', label: '2. Капсула и ферма' },
    { key: 'carouselCore', label: '3. Карусельный улей' },
    { key: 'petalFairingsGroup', label: '4. Лепестки обтекателя' },
  ],
  cameras: {
    module: { pos: [3.8, 2.5, 4.4], target: [0, 0.9, 1.1] },
  },
  rangeMarkers: [],
  controls: 'tel',
};

const TEL_CYCLE = 14.0;
const PETAL_MAX_ANGLE = (64 * Math.PI) / 180;
const CAROUSEL_TRAVEL = 0.88;

/**
 * Процедурная генерация текстуры белой термозащитной плитки («Буран») и карты рельефа
 */
function createBuranTileTextures() {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  // Базовый светлый тон кремнезёмной плитки
  ctx.fillStyle = '#d8dce0';
  ctx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#e0e0e0';
  bCtx.fillRect(0, 0, size, size);

  const rows = 24;
  const cols = 16;
  const tileH = size / rows;
  const tileW = size / cols;

  // Детерминированный псевдорандом для вариации оттенков плиток
  let seed = 19881115;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let r = 0; r < rows; r++) {
    const offsetX = (r % 2 === 1) ? tileW * 0.5 : 0;
    for (let c = -1; c <= cols; c++) {
      const x = c * tileW + offsetX;
      const y = r * tileH;

      // Лёгкая вариация яркости плиток и термонагар
      const delta = Math.floor((rand() - 0.5) * 14);
      const baseR = 216 + delta;
      const baseG = 220 + delta;
      const baseB = 224 + delta;

      ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
      ctx.fillRect(x + 1.5, y + 1.5, tileW - 3, tileH - 3);

      // Микротекстура поверхности плитки
      const bumpVal = 215 + Math.floor((rand() - 0.5) * 20);
      bCtx.fillStyle = `rgb(${bumpVal}, ${bumpVal}, ${bumpVal})`;
      bCtx.fillRect(x + 2, y + 2, tileW - 4, tileH - 4);

      // Тёмный межплиточный термошов
      ctx.strokeStyle = 'rgba(52, 58, 66, 0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 0.5, y + 0.5, tileW - 1, tileH - 1);

      bCtx.strokeStyle = '#303030';
      bCtx.lineWidth = 2.5;
      bCtx.strokeRect(x + 0.5, y + 0.5, tileW - 1, tileH - 1);
    }
  }

  // Технологические пояса и маркировочные полосы советского орбитального блока
  ctx.fillStyle = 'rgba(40, 44, 50, 0.78)';
  ctx.fillRect(0, size * 0.12, size, 10);
  ctx.fillRect(0, size * 0.88, size, 10);

  ctx.fillStyle = 'rgba(184, 54, 42, 0.85)';
  ctx.fillRect(0, size * 0.135, size, 5);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = 8;

  return { map, bumpMap };
}

/**
 * Процедурная CanvasTexture с трафаретом лафета УСП:
 * «САРАНЧА-С / ОРБИТАЛЬНЫЙ СТАНДАРТ»
 */
function createMountStencilTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Фон бронеплиты лафета (тёмно-серый космический грунт)
  ctx.fillStyle = '#383e45';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Металлическая рамка и заклёпки по периметру
  ctx.strokeStyle = '#5c646e';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = '#737c87';
  for (let x = 28; x <= canvas.width - 28; x += 64) {
    for (const y of [24, canvas.height - 24]) {
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Предупреждающая красно-белая полоса слева
  ctx.fillStyle = '#c43a2b';
  ctx.fillRect(36, 44, 18, canvas.height - 88);
  ctx.fillStyle = '#e4e7eb';
  ctx.fillRect(62, 44, 8, canvas.height - 88);

  // Главный трафарет
  ctx.fillStyle = '#e6eaee';
  ctx.font = 'bold 54px "Courier New", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('САРАНЧА-С', 96, 86);

  // Разделительная линия
  ctx.fillStyle = '#c43a2b';
  ctx.fillRect(96, 124, 620, 4);

  // Подзаголовок стандарта
  ctx.fillStyle = '#cfd5dc';
  ctx.font = 'bold 34px "Courier New", monospace';
  ctx.fillText('ОРБИТАЛЬНЫЙ СТАНДАРТ', 96, 166);

  // Технический индекс УСП справа
  ctx.strokeStyle = '#9aa3ad';
  ctx.lineWidth = 3;
  ctx.strokeRect(756, 52, 224, 152);

  ctx.fillStyle = '#d8dce0';
  ctx.font = 'bold 26px "Courier New", monospace';
  ctx.fillText('УСП-4400М', 778, 88);
  ctx.font = '20px "Courier New", monospace';
  ctx.fillStyle = '#aeb6bf';
  ctx.fillText('ЗАМКИ: 8x М42', 778, 128);
  ctx.fillText('КАЛИБР: 1450', 778, 162);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Вспомогательная функция создания цилиндрической стойки между двумя 3D-точками
 */
function createStrutBetween(p1, p2, radius, material, radialSegments = 10) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const geom = new THREE.CylinderGeometry(radius, radius, len, radialSegments, 1);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.copy(p1).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Генератор замкнутой толстостенной геометрии конически-оживального лепестка обтекателя
 * в локальной системе шарнира:
 * - шарнир в (0, 0, 0), ось раскрытия — локальная X
 * - локальная +Y направлена радиально наружу от оси капсулы
 * - локальная +Z направлена вперёд (к носу обтекателя, длина = length)
 */
function createFairingPetalGeometry(baseRadius, wallThickness, length, sectorAngle, radialSegs = 20, heightSegs = 24) {
  const positions = [];
  const uvs = [];
  const indices = [];

  // Профиль радиуса обтекателя вдоль Z (от z=0 у стыка до z=length у носка)
  const getOuterRadius = (v) => {
    if (v < 0.92) {
      const t = v / 0.92;
      return baseRadius * (1.0 - 0.72 * Math.pow(t, 1.32));
    }
    // Скруглённый притупленный носовой конус (теплозащитный наконечник)
    const tTip = (v - 0.92) / 0.08;
    const rNeck = baseRadius * 0.28;
    return rNeck * Math.cos(tTip * Math.PI * 0.44);
  };

  // Вычисление точки в локальных координатах шарнира (центр капсулы находится в y = -baseRadius)
  const evalPoint = (u, v, isOuter) => {
    // Небольшой технологический зазор между лепестками (0.014 рад)
    const gap = 0.014;
    const theta = (u - 0.5) * (sectorAngle - gap);
    const z = v * length;
    const rOut = getOuterRadius(v);
    const localThick = Math.min(wallThickness, rOut * 0.65);
    const r = isOuter ? rOut : Math.max(0.015, rOut - localThick);

    const x = Math.sin(theta) * r;
    const y = Math.cos(theta) * r - baseRadius;
    return [x, y, z];
  };

  const stride = radialSegs + 1;
  const vertCountPerSurface = (radialSegs + 1) * (heightSegs + 1);

  // 1. Внешняя поверхность (индексы 0 .. vertCountPerSurface - 1)
  for (let j = 0; j <= heightSegs; j++) {
    const v = j / heightSegs;
    for (let i = 0; i <= radialSegs; i++) {
      const u = i / radialSegs;
      const [x, y, z] = evalPoint(u, v, true);
      positions.push(x, y, z);
      uvs.push(u * 1.2, v * 2.2);
    }
  }

  // 2. Внутренняя поверхность (индексы vertCountPerSurface .. 2 * vertCountPerSurface - 1)
  for (let j = 0; j <= heightSegs; j++) {
    const v = j / heightSegs;
    for (let i = 0; i <= radialSegs; i++) {
      const u = i / radialSegs;
      const [x, y, z] = evalPoint(u, v, false);
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  // Треугольники внешней поверхности (нормаль наружу)
  for (let j = 0; j < heightSegs; j++) {
    for (let i = 0; i < radialSegs; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = (j + 1) * stride + i;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Треугольники внутренней поверхности (нормаль внутрь)
  const inOff = vertCountPerSurface;
  for (let j = 0; j < heightSegs; j++) {
    for (let i = 0; i < radialSegs; i++) {
      const a = inOff + j * stride + i;
      const b = a + 1;
      const c = inOff + (j + 1) * stride + i;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Боковые торцы стыка лепестков (u = 0 и u = 1)
  for (let j = 0; j < heightSegs; j++) {
    // Левый торец (i = 0)
    const o0 = j * stride;
    const o1 = (j + 1) * stride;
    const i0 = inOff + j * stride;
    const i1 = inOff + (j + 1) * stride;
    indices.push(o0, i0, o1);
    indices.push(o1, i0, i1);

    // Правый торец (i = radialSegs)
    const ro0 = j * stride + radialSegs;
    const ro1 = (j + 1) * stride + radialSegs;
    const ri0 = inOff + j * stride + radialSegs;
    const ri1 = inOff + (j + 1) * stride + radialSegs;
    indices.push(ro0, ro1, ri0);
    indices.push(ro1, ri1, ri0);
  }

  // Задний торец у шарнира (j = 0) и передний торец на носке (j = heightSegs)
  for (let i = 0; i < radialSegs; i++) {
    // Задний торец (j = 0)
    const bo0 = i;
    const bo1 = i + 1;
    const bi0 = inOff + i;
    const bi1 = inOff + i + 1;
    indices.push(bo0, bo1, bi0);
    indices.push(bo1, bi1, bi0);

    // Передний торец (j = heightSegs)
    const topRow = heightSegs * stride;
    const to0 = topRow + i;
    const to1 = topRow + i + 1;
    const ti0 = inOff + topRow + i;
    const ti1 = inOff + topRow + i + 1;
    indices.push(to0, ti0, to1);
    indices.push(to1, ti0, ti1);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Создаёт процедурную 3D-модель сверхтяжёлого контейнерного роевого комплекса «Саранча-С»
 *
 * Система координат:
 * - 1 unit = 1 метр
 * - Ось капсулы вытянута вдоль +Z, верх +Y, бок +X
 * - Точка привязки (0, 0, 0) — центр сдвоенного силового лафета УСП (mountFlange)
 *
 * @returns {THREE.Group} Корневая группа комплекса «Саранча-С»
 */
export function createWeaponSaranchaS() {
  const root = new THREE.Group();
  root.name = 'SaranchaS_Complex';

  // --- PBR-материалы по спецификации ---
  const { map: tileMap, bumpMap: tileBump } = createBuranTileTextures();
  const tileMaterial = new THREE.MeshStandardMaterial({
    name: 'BuranThermalTile',
    color: 0xd8dce0,
    map: tileMap,
    bumpMap: tileBump,
    bumpScale: 0.008,
    metalness: 0.20,
    roughness: 0.55
  });

  const aluminumMaterial = new THREE.MeshStandardMaterial({
    name: 'AviationAluminum',
    color: 0x8b9299,
    metalness: 0.70,
    roughness: 0.40
  });

  const darkSteelMaterial = new THREE.MeshStandardMaterial({
    name: 'BluedSteel',
    color: 0x25282c,
    metalness: 0.85,
    roughness: 0.30
  });

  const copperMaterial = new THREE.MeshStandardMaterial({
    name: 'AerospaceCopper',
    color: 0x9c6b3b,
    metalness: 0.85,
    roughness: 0.28
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    name: 'HydraulicChrome',
    color: 0xd0d6dc,
    metalness: 0.92,
    roughness: 0.15
  });

  const accentRedMaterial = new THREE.MeshStandardMaterial({
    name: 'SovietAerospaceRed',
    color: 0xb83529,
    metalness: 0.35,
    roughness: 0.45
  });

  const beaconGlowMaterial = new THREE.MeshStandardMaterial({
    name: 'SwarmBeaconEmitter',
    color: 0xff5a2a,
    emissive: 0xff3b14,
    emissiveIntensity: 2.2,
    metalness: 0.2,
    roughness: 0.2
  });

  const stencilTexture = createMountStencilTexture();
  const stencilPlateMaterial = new THREE.MeshStandardMaterial({
    name: 'MountStencilPlate',
    map: stencilTexture,
    metalness: 0.45,
    roughness: 0.50
  });

  // Ключевые геометрические константы комплекса
  const capsuleAxisY = 0.92;     // Высота центральной оси капсулы над центром лафета (0,0,0)
  const capsuleRadius = 0.725;   // Внешний радиус капсулы (диаметр = 1.45 м)
  const fairingStartZ = 1.60;    // Стык головного обтекателя
  const fairingLength = 1.60;    // Длина обтекателя (z = 1.60 .. 3.20)
  const hullRearZ = -1.20;       // Кормовой срез (общая длина = 4.40 м)

  // =========================================================================
  // 1. СДВОЕННЫЙ КОСМИЧЕСКИЙ ЛАФЕТ УСП (mountFlange)
  // Габариты рамы: 1.15 x 0.22 x 1.70 м, центр в (0, 0, 0)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  const frameW = 1.15;
  const frameH = 0.22;
  const frameL = 1.70;
  const railW = 0.26;
  const railOffsetX = (frameW - railW) * 0.5; // ±0.445 м

  // Две параллельные силовые продольные балки сдвоенного лафета
  const railGeom = new THREE.BoxGeometry(railW, frameH, frameL);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeom, darkSteelMaterial);
    rail.position.set(side * railOffsetX, 0, 0);
    rail.castShadow = true;
    rail.receiveShadow = true;
    mountFlange.add(rail);

    // Верхние и нижние силовые полки двутаврового профиля
    const flangePlateGeom = new THREE.BoxGeometry(railW + 0.03, 0.025, frameL + 0.02);
    const topFlange = new THREE.Mesh(flangePlateGeom, aluminumMaterial);
    topFlange.position.set(side * railOffsetX, frameH * 0.5 - 0.01, 0);
    mountFlange.add(topFlange);

    const botFlange = new THREE.Mesh(flangePlateGeom, aluminumMaterial);
    botFlange.position.set(side * railOffsetX, -frameH * 0.5 + 0.01, 0);
    mountFlange.add(botFlange);

    // Боковая бронепластина с трафаретом «САРАНЧА-С / ОРБИТАЛЬНЫЙ СТАНДАРТ»
    const stencilGeom = new THREE.PlaneGeometry(1.42, 0.17);
    const stencilMesh = new THREE.Mesh(stencilGeom, stencilPlateMaterial);
    stencilMesh.position.set(side * (frameW * 0.5 + 0.003), 0, 0.04);
    stencilMesh.rotation.y = side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    mountFlange.add(stencilMesh);
  }

  // Поперечные силовые траверсы сдвоенного лафета
  const crossZPositions = [-0.76, -0.26, 0.26, 0.76];
  const crossBeamGeom = new THREE.BoxGeometry(frameW - railW * 1.4, frameH * 0.78, 0.14);
  for (const zPos of crossZPositions) {
    const crossBeam = new THREE.Mesh(crossBeamGeom, darkSteelMaterial);
    crossBeam.position.set(0, 0, zPos);
    crossBeam.castShadow = true;
    crossBeam.receiveShadow = true;
    mountFlange.add(crossBeam);
  }

  // Центральная стыковочная плита УСП с разъёмом телеметрии
  const centerDeck = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.04, 1.36),
    aluminumMaterial
  );
  centerDeck.position.set(0, 0.04, 0);
  mountFlange.add(centerDeck);

  // 8 силовых замков УСП (по 4 на левой и правой балках лафета)
  const lockZPositions = [-0.66, -0.22, 0.22, 0.66];
  const lockHousingGeom = new THREE.BoxGeometry(0.09, 0.12, 0.15);
  const lockBoltGeom = new THREE.CylinderGeometry(0.026, 0.026, 0.13, 12);
  const lockStripeGeom = new THREE.BoxGeometry(0.094, 0.022, 0.154);

  for (const side of [-1, 1]) {
    for (const zLock of lockZPositions) {
      const lockGroup = new THREE.Group();
      lockGroup.position.set(side * (frameW * 0.5 + 0.02), -0.02, zLock);

      const housing = new THREE.Mesh(lockHousingGeom, darkSteelMaterial);
      housing.castShadow = true;
      lockGroup.add(housing);

      const bolt = new THREE.Mesh(lockBoltGeom, chromeMaterial);
      bolt.rotation.z = Math.PI * 0.5;
      bolt.position.x = side * 0.02;
      lockGroup.add(bolt);

      const stripe = new THREE.Mesh(lockStripeGeom, accentRedMaterial);
      stripe.position.y = 0.035;
      lockGroup.add(stripe);

      mountFlange.add(lockGroup);
    }
  }

  // Задний силовой шарнир подъёма (z = -0.70) и ложементы капсулы
  const hingeZ = -0.70;
  const hingePivotY = 0.34;
  const trunnionShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 1.12, 20),
    chromeMaterial
  );
  trunnionShaft.rotation.z = Math.PI * 0.5;
  trunnionShaft.position.set(0, hingePivotY, hingeZ);
  trunnionShaft.castShadow = true;
  mountFlange.add(trunnionShaft);

  for (const side of [-1, 1]) {
    // Стойка-проушина шарнира на раме УСП
    const clevis = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.32, 0.22),
      darkSteelMaterial
    );
    clevis.position.set(side * railOffsetX, 0.22, hingeZ);
    clevis.castShadow = true;
    mountFlange.add(clevis);

    // Втулка подшипника шарнира
    const bearing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.14, 20),
      aluminumMaterial
    );
    bearing.rotation.z = Math.PI * 0.5;
    bearing.position.set(side * railOffsetX, hingePivotY, hingeZ);
    mountFlange.add(bearing);

    // Силовой рычаг от заднего шарнира к поясу капсулы
    const armStart = new THREE.Vector3(side * railOffsetX, hingePivotY, hingeZ);
    const armEnd = new THREE.Vector3(side * 0.52, capsuleAxisY - 0.52, hingeZ + 0.06);
    mountFlange.add(createStrutBetween(armStart, armEnd, 0.048, darkSteelMaterial, 12));

    // Гидроцилиндр подъёма (от передней части лафета к средней раме капсулы)
    const cylBase = new THREE.Vector3(side * 0.38, 0.12, 0.05);
    const cylMid = new THREE.Vector3(side * 0.44, 0.36, -0.22);
    const cylTop = new THREE.Vector3(side * 0.48, 0.56, -0.44);
    mountFlange.add(createStrutBetween(cylBase, cylMid, 0.042, darkSteelMaterial, 14));
    mountFlange.add(createStrutBetween(cylMid, cylTop, 0.025, chromeMaterial, 14));
  }

  // Передний седловой ложемент с пирозамками (z = +0.58)
  const frontSaddleGeom = new THREE.TorusGeometry(capsuleRadius + 0.03, 0.045, 12, 32, Math.PI * 0.62);
  const frontSaddle = new THREE.Mesh(frontSaddleGeom, darkSteelMaterial);
  frontSaddle.position.set(0, capsuleAxisY, 0.58);
  frontSaddle.rotation.z = Math.PI + (Math.PI - Math.PI * 0.62) * 0.5;
  frontSaddle.castShadow = true;
  mountFlange.add(frontSaddle);

  for (const side of [-1, 1]) {
    const pBottom = new THREE.Vector3(side * railOffsetX, 0.11, 0.58);
    const pTop = new THREE.Vector3(side * 0.56, capsuleAxisY - 0.48, 0.58);
    mountFlange.add(createStrutBetween(pBottom, pTop, 0.045, aluminumMaterial, 12));
  }

  // =========================================================================
  // 2. ГЕРМЕТИЧНЫЙ ЦИЛИНДРИЧЕСКИЙ КОНТЕЙНЕР В ТРУБЧАТОЙ ФЕРМЕ (capsuleHull)
  // =========================================================================
  const capsuleHull = new THREE.Group();
  capsuleHull.name = 'capsuleHull';
  capsuleHull.position.set(0, capsuleAxisY, 0);
  root.add(capsuleHull);

  const hullCylinderStart = -0.94;
  const hullCylinderEnd = 1.56;
  const hullCylinderLen = hullCylinderEnd - hullCylinderStart; // 2.50 м
  const hullCylinderMidZ = (hullCylinderStart + hullCylinderEnd) * 0.5;

  // Основной герметичный цилиндр капсулы, облицованный белой термозащитной плиткой
  const mainCylinderGeom = new THREE.CylinderGeometry(
    capsuleRadius - 0.015,
    capsuleRadius - 0.015,
    hullCylinderLen,
    48,
    1
  );
  mainCylinderGeom.rotateX(Math.PI * 0.5);
  const mainCylinder = new THREE.Mesh(mainCylinderGeom, tileMaterial);
  mainCylinder.position.set(0, 0, hullCylinderMidZ);
  mainCylinder.castShadow = true;
  mainCylinder.receiveShadow = true;
  capsuleHull.add(mainCylinder);

  // Силовые шпангоуты-кольца на корпусе капсулы
  const ringZPositions = [-0.94, -0.10, 0.74, 1.56];
  for (const rz of ringZPositions) {
    const isFrontBulkhead = rz > 1.5;
    const ringGeom = new THREE.TorusGeometry(
      capsuleRadius - (isFrontBulkhead ? 0.005 : 0.01),
      isFrontBulkhead ? 0.032 : 0.022,
      14,
      48
    );
    const ringMesh = new THREE.Mesh(ringGeom, isFrontBulkhead ? aluminumMaterial : darkSteelMaterial);
    ringMesh.position.set(0, 0, rz);
    ringMesh.castShadow = true;
    capsuleHull.add(ringMesh);
  }

  // Передняя герметичная переборка (z = 1.56)
  const frontBulkhead = new THREE.Mesh(
    new THREE.CylinderGeometry(capsuleRadius - 0.015, capsuleRadius - 0.015, 0.05, 40).rotateX(Math.PI * 0.5),
    darkSteelMaterial
  );
  frontBulkhead.position.set(0, 0, 1.55);
  capsuleHull.add(frontBulkhead);

  // Кормовой сферический теплозащитный экран и стыковочный узел (z = -0.94 .. -1.20)
  const aftDomeGeom = new THREE.SphereGeometry(
    capsuleRadius - 0.015,
    40,
    18,
    0,
    Math.PI * 2,
    Math.PI * 0.68,
    Math.PI * 0.32
  );
  aftDomeGeom.rotateX(Math.PI * 0.5);
  const aftDome = new THREE.Mesh(aftDomeGeom, tileMaterial);
  aftDome.position.set(0, 0, -0.58);
  aftDome.castShadow = true;
  capsuleHull.add(aftDome);

  // Кормовой стыковочный агрегат (АПАС-образный воротник на z = -1.16)
  const dockingCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.36, 0.14, 32).rotateX(Math.PI * 0.5),
    aluminumMaterial
  );
  dockingCollar.position.set(0, 0, -1.12);
  capsuleHull.add(dockingCollar);

  const dockingRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.024, 12, 32),
    darkSteelMaterial
  );
  dockingRing.position.set(0, 0, -1.19);
  capsuleHull.add(dockingRing);

  // 3 лепестка направляющего конуса кормового стыковочного узла
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3 + Math.PI / 6;
    const guide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.06), chromeMaterial);
    guide.position.set(Math.cos(a) * 0.26, Math.sin(a) * 0.26, -1.20);
    guide.rotation.z = a;
    capsuleHull.add(guide);
  }

  // --- Ажурная внешняя трубчатая ферма вокруг капсулы ---
  const trussGroup = new THREE.Group();
  trussGroup.name = 'tubularTrussFrame';
  capsuleHull.add(trussGroup);

  const trussRadius = 0.752;
  const trussSides = 6;
  const trussBaysZ = [-0.90, -0.08, 0.74, 1.54];
  const trussTubeR = 0.017;
  const trussDiagR = 0.013;

  // Узлы фермы [bayIndex][cornerIndex]
  const trussNodes = [];
  const nodeSphereGeom = new THREE.SphereGeometry(0.025, 10, 8);

  for (let b = 0; b < trussBaysZ.length; b++) {
    const z = trussBaysZ[b];
    const ringNodes = [];
    for (let s = 0; s < trussSides; s++) {
      const theta = (s * Math.PI * 2) / trussSides + Math.PI / 6;
      const pt = new THREE.Vector3(Math.cos(theta) * trussRadius, Math.sin(theta) * trussRadius, z);
      ringNodes.push(pt);

      const nodeCap = new THREE.Mesh(nodeSphereGeom, darkSteelMaterial);
      nodeCap.position.copy(pt);
      trussGroup.add(nodeCap);
    }
    trussNodes.push(ringNodes);
  }

  // Поперечные пояса, продольные стрингеры и диагональные раскосы фермы
  for (let b = 0; b < trussBaysZ.length; b++) {
    for (let s = 0; s < trussSides; s++) {
      const sNext = (s + 1) % trussSides;
      // Поперечный пояс фермы
      trussGroup.add(createStrutBetween(trussNodes[b][s], trussNodes[b][sNext], trussTubeR, aluminumMaterial, 8));

      if (b < trussBaysZ.length - 1) {
        // Продольный лонжерон фермы
        trussGroup.add(createStrutBetween(trussNodes[b][s], trussNodes[b + 1][s], trussTubeR, aluminumMaterial, 8));

        // Диагональные раскосы (чередование направления для жёсткости)
        if ((b + s) % 2 === 0) {
          trussGroup.add(createStrutBetween(trussNodes[b][s], trussNodes[b + 1][sNext], trussDiagR, aluminumMaterial, 8));
        } else {
          trussGroup.add(createStrutBetween(trussNodes[b][sNext], trussNodes[b + 1][s], trussDiagR, aluminumMaterial, 8));
        }
      }
    }
  }

  // --- Два сферических баллона наддува по бокам и криогенные магистрали ---
  const tankRadius = 0.22;
  const tankX = 0.86;
  const tankZ = 0.14;
  const tankSphereGeom = new THREE.SphereGeometry(tankRadius, 28, 20);
  const tankBandGeom = new THREE.TorusGeometry(tankRadius + 0.006, 0.014, 10, 32);

  for (const side of [-1, 1]) {
    const tankGroup = new THREE.Group();
    tankGroup.position.set(side * tankX, 0.04, tankZ);

    const sphere = new THREE.Mesh(tankSphereGeom, aluminumMaterial);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    tankGroup.add(sphere);

    // Экваториальный силовой бандаж баллона
    const eqBand = new THREE.Mesh(tankBandGeom, darkSteelMaterial);
    eqBand.rotation.y = Math.PI * 0.5;
    tankGroup.add(eqBand);

    // Красная маркировочная полоса высокого давления
    const redBand = new THREE.Mesh(
      new THREE.TorusGeometry(tankRadius * 0.86, 0.008, 8, 28),
      accentRedMaterial
    );
    redBand.position.x = side * (tankRadius * 0.5);
    redBand.rotation.y = Math.PI * 0.5;
    tankGroup.add(redBand);

    // Редукторный клапан на торце баллона
    const valve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.09, 14).rotateZ(Math.PI * 0.5),
      copperMaterial
    );
    valve.position.x = side * (tankRadius + 0.03);
    tankGroup.add(valve);

    capsuleHull.add(tankGroup);

    // Кронштейны крепления баллона к ферме капсулы
    const tCenter = new THREE.Vector3(side * tankX, 0.04, tankZ);
    const fAnchor1 = new THREE.Vector3(side * Math.cos(Math.PI / 6) * trussRadius, Math.sin(Math.PI / 6) * trussRadius, -0.08);
    const fAnchor2 = new THREE.Vector3(side * Math.cos(Math.PI / 6) * trussRadius, -Math.sin(Math.PI / 6) * trussRadius, -0.08);
    const fAnchor3 = new THREE.Vector3(side * Math.cos(Math.PI / 6) * trussRadius, Math.sin(Math.PI / 6) * trussRadius, 0.74);
    const fAnchor4 = new THREE.Vector3(side * Math.cos(Math.PI / 6) * trussRadius, -Math.sin(Math.PI / 6) * trussRadius, 0.74);

    capsuleHull.add(createStrutBetween(tCenter, fAnchor1, 0.018, darkSteelMaterial, 8));
    capsuleHull.add(createStrutBetween(tCenter, fAnchor2, 0.018, darkSteelMaterial, 8));
    capsuleHull.add(createStrutBetween(tCenter, fAnchor3, 0.018, darkSteelMaterial, 8));
    capsuleHull.add(createStrutBetween(tCenter, fAnchor4, 0.018, darkSteelMaterial, 8));

    // Криогенные магистрали (изогнутые трубопроводы от кормового блока через баллон к переднему шпангоуту)
    const cryoCurve1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.34, -0.22, -1.04),
      new THREE.Vector3(side * 0.68, -0.26, -0.68),
      new THREE.Vector3(side * 0.84, -0.18, tankZ),
      new THREE.Vector3(side * 0.78, -0.18, 0.85),
      new THREE.Vector3(side * 0.66, -0.14, 1.52)
    ]);
    const cryoPipe1 = new THREE.Mesh(
      new THREE.TubeGeometry(cryoCurve1, 36, 0.022, 10, false),
      chromeMaterial
    );
    cryoPipe1.castShadow = true;
    capsuleHull.add(cryoPipe1);

    const cryoCurve2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.30, 0.28, -1.02),
      new THREE.Vector3(side * 0.66, 0.34, -0.55),
      new THREE.Vector3(side * 0.82, 0.26, tankZ),
      new THREE.Vector3(side * 0.74, 0.28, 0.92),
      new THREE.Vector3(side * 0.64, 0.22, 1.52)
    ]);
    const cryoPipe2 = new THREE.Mesh(
      new THREE.TubeGeometry(cryoCurve2, 36, 0.016, 10, false),
      copperMaterial
    );
    cryoPipe2.castShadow = true;
    capsuleHull.add(cryoPipe2);
  }

  // Верхний стыковочный / телеметрический узел на спине капсулы (z = 0.32)
  const dorsalNode = new THREE.Group();
  dorsalNode.position.set(0, capsuleRadius + 0.02, 0.32);
  const dorsalBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.44), aluminumMaterial);
  dorsalBase.castShadow = true;
  dorsalNode.add(dorsalBase);

  const dorsalConnector = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.07, 18), copperMaterial);
  dorsalConnector.position.set(0, 0.06, -0.08);
  dorsalNode.add(dorsalConnector);

  const dorsalCap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), accentRedMaterial);
  dorsalCap.position.set(0, 0.06, 0.10);
  dorsalNode.add(dorsalCap);
  capsuleHull.add(dorsalNode);

  // =========================================================================
  // 3A. ВНУТРЕННИЙ КАРУСЕЛЬНЫЙ УЛЕЙ РОЯ (carouselCore)
  // Расположен внутри передней секции (z = 1.60 .. 2.95)
  // =========================================================================
  const carouselCore = new THREE.Group();
  carouselCore.name = 'carouselCore';
  carouselCore.position.set(0, capsuleAxisY, fairingStartZ);
  root.add(carouselCore);

  const drumLength = 1.24;
  const drumRadius = 0.48;
  const tiersCount = 4;

  // Телескопическая центральная колонна выдвижения барабана
  const centralShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.19, drumLength + 0.55, 24).rotateX(Math.PI * 0.5),
    darkSteelMaterial
  );
  centralShaft.position.set(0, 0, drumLength * 0.5 - 0.22);
  centralShaft.castShadow = true;
  carouselCore.add(centralShaft);

  // Медные силовые шины вдоль центральной колонны
  for (let b = 0; b < 6; b++) {
    const angle = (b * Math.PI) / 3;
    const busbar = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.028, drumLength + 0.1),
      copperMaterial
    );
    busbar.position.set(Math.cos(angle) * 0.175, Math.sin(angle) * 0.175, drumLength * 0.5);
    busbar.rotation.z = angle;
    carouselCore.add(busbar);
  }

  // Ярусные перегородки карусельного барабана (воронёная сталь + медные ободы)
  const tierSpacing = drumLength / tiersCount;
  for (let t = 0; t <= tiersCount; t++) {
    const tz = t * tierSpacing + 0.04;
    const isEndPlate = (t === 0 || t === tiersCount);
    const diskR = isEndPlate ? drumRadius + 0.03 : drumRadius + 0.015;

    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(diskR, diskR, isEndPlate ? 0.036 : 0.022, 36).rotateX(Math.PI * 0.5),
      darkSteelMaterial
    );
    plate.position.set(0, 0, tz);
    plate.castShadow = true;
    plate.receiveShadow = true;
    carouselCore.add(plate);

    const copperRim = new THREE.Mesh(
      new THREE.TorusGeometry(diskR, 0.012, 10, 36),
      copperMaterial
    );
    copperRim.position.set(0, 0, tz);
    carouselCore.add(copperRim);
  }

  // --- Десятки ячеек запуска микро-роботов через THREE.InstancedMesh ---
  const cellsPerRing = 24;
  const ringsPerTier = 2;
  const totalCells = tiersCount * ringsPerTier * cellsPerRing; // 192 ячейки запуска!

  // Геометрия пусковой ячейки-гильзы (тёмная воронёная сталь)
  const cellTubeGeom = new THREE.CylinderGeometry(0.032, 0.036, 0.24, 8);
  const cellTubeInstanced = new THREE.InstancedMesh(cellTubeGeom, darkSteelMaterial, totalCells);
  cellTubeInstanced.name = 'swarmLaunchCells';
  cellTubeInstanced.castShadow = true;
  cellTubeInstanced.receiveShadow = true;

  // Геометрия головной части микро-робота внутри ячейки (медь)
  const droneCapGeom = new THREE.CylinderGeometry(0.014, 0.025, 0.06, 8);
  const droneCapInstanced = new THREE.InstancedMesh(droneCapGeom, copperMaterial, totalCells);
  droneCapInstanced.name = 'swarmMicroDrones';

  const dummy = new THREE.Object3D();
  const droneDummy = new THREE.Object3D();
  let instanceIdx = 0;

  for (let t = 0; t < tiersCount; t++) {
    const tierBaseZ = t * tierSpacing + 0.04;
    for (let r = 0; r < ringsPerTier; r++) {
      const zLocal = tierBaseZ + (r + 0.55) * (tierSpacing / (ringsPerTier + 0.1));
      const staggerAngle = (r % 2) * (Math.PI / cellsPerRing);

      for (let c = 0; c < cellsPerRing; c++) {
        const theta = (c * Math.PI * 2) / cellsPerRing + staggerAngle;
        const radialPos = drumRadius - 0.06;

        dummy.position.set(
          Math.cos(theta) * radialPos,
          Math.sin(theta) * radialPos,
          zLocal
        );
        // Ориентируем ось ячейки радиально наружу с небольшим наклоном вперёд (+Z)
        dummy.rotation.set(0, 0, theta - Math.PI * 0.5);
        dummy.rotateX(0.22);
        dummy.updateMatrix();
        cellTubeInstanced.setMatrixAt(instanceIdx, dummy.matrix);

        // Позиционируем боеголовку микро-дрона в устье ячейки
        droneDummy.copy(dummy);
        droneDummy.translateY(0.11);
        droneDummy.updateMatrix();
        droneCapInstanced.setMatrixAt(instanceIdx, droneDummy.matrix);

        instanceIdx++;
      }
    }
  }

  cellTubeInstanced.instanceMatrix.needsUpdate = true;
  droneCapInstanced.instanceMatrix.needsUpdate = true;
  carouselCore.add(cellTubeInstanced);
  carouselCore.add(droneCapInstanced);

  // --- Центральная антенна-маяк управления роем на вершине карусели ---
  const beaconGroup = new THREE.Group();
  beaconGroup.name = 'swarmControlBeacon';
  beaconGroup.position.set(0, 0, drumLength + 0.05);
  carouselCore.add(beaconGroup);

  // Медный рефлектор фазированной антенны управления роем
  const dishGeom = new THREE.CylinderGeometry(0.22, 0.11, 0.08, 28, 1, true);
  dishGeom.rotateX(Math.PI * 0.5);
  const dishMesh = new THREE.Mesh(dishGeom, copperMaterial);
  dishMesh.position.z = 0.04;
  beaconGroup.add(dishMesh);

  // Центральная мачта излучателя
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.038, 0.34, 16).rotateX(Math.PI * 0.5),
    darkSteelMaterial
  );
  mast.position.z = 0.17;
  beaconGroup.add(mast);

  // Светящийся орбитальный маяк на кончике
  const beaconTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 16, 12),
    beaconGlowMaterial
  );
  beaconTip.position.z = 0.35;
  beaconGroup.add(beaconTip);

  // 4 штыревые телеметрические антенны роя
  for (let a = 0; a < 4; a++) {
    const ang = (a * Math.PI) / 2 + Math.PI / 4;
    const whipPivot = new THREE.Group();
    whipPivot.rotation.z = ang;
    whipPivot.position.set(Math.cos(ang) * 0.16, Math.sin(ang) * 0.16, 0.05);

    const whip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.01, 0.28, 8).rotateX(Math.PI * 0.5),
      chromeMaterial
    );
    whip.rotation.x = -0.35;
    whip.position.set(0, 0.05, 0.13);
    whipPivot.add(whip);
    beaconGroup.add(whipPivot);
  }

  // =========================================================================
  // 3B. ЛЕПЕСТКОВЫЙ ГОЛОВНОЙ ОБТЕКАТЕЛЬ (petalFairingsGroup)
  // 4 массивных конических лепестка на шарнирах (z = 1.60 .. 3.20)
  // =========================================================================
  const petalFairingsGroup = new THREE.Group();
  petalFairingsGroup.name = 'petalFairingsGroup';
  petalFairingsGroup.position.set(0, capsuleAxisY, fairingStartZ);
  root.add(petalFairingsGroup);

  const petalCount = 4;
  const sectorAngle = (Math.PI * 2) / petalCount;
  const petalWallThickness = 0.055;
  const sharedPetalGeom = createFairingPetalGeometry(
    capsuleRadius,
    petalWallThickness,
    fairingLength,
    sectorAngle,
    20,
    26
  );

  const petalPivots = [];

  for (let i = 0; i < petalCount; i++) {
    // X-образная схема раскрытия (45°, 135°, 225°, 315°), чтобы нижние лепестки не задевали спину меха
    const angle = (i * Math.PI) / 2 + Math.PI / 4;

    const petalPivot = new THREE.Group();
    petalPivot.name = `fairingPetal_${i}`;
    petalPivot.position.set(
      Math.cos(angle) * capsuleRadius,
      Math.sin(angle) * capsuleRadius,
      0
    );
    // Ориентируем локальную ось +Y радиально наружу, +Z вперёд, а локальную X — касательно для раскрытия
    petalPivot.rotation.z = angle - Math.PI * 0.5;

    // Оболочка лепестка с белой термоплиткой
    const petalShell = new THREE.Mesh(sharedPetalGeom, tileMaterial);
    petalShell.castShadow = true;
    petalShell.receiveShadow = true;
    petalPivot.add(petalShell);

    // Внутренний силовой набор лепестка (авиационный алюминий)
    const ribFractions = [0.22, 0.52, 0.80];
    for (const frac of ribFractions) {
      const zRib = frac * fairingLength;
      const rOuter = capsuleRadius * (1.0 - 0.72 * Math.pow(frac / 0.92, 1.32));
      const rInner = Math.max(0.06, rOuter - petalWallThickness - 0.005);

      const ribGeom = new THREE.TorusGeometry(
        rInner,
        0.015,
        8,
        16,
        sectorAngle * 0.82
      );
      const rib = new THREE.Mesh(ribGeom, aluminumMaterial);
      rib.position.set(0, -capsuleRadius, zRib);
      rib.rotation.z = Math.PI * 0.5 - (sectorAngle * 0.82) * 0.5;
      petalPivot.add(rib);
    }

    // Силовой шарнирный узел в основании лепестка
    const hingeKnuckle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.24, 16).rotateZ(Math.PI * 0.5),
      darkSteelMaterial
    );
    hingeKnuckle.position.set(0, 0.01, 0.02);
    petalPivot.add(hingeKnuckle);

    const hingePin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.29, 12).rotateZ(Math.PI * 0.5),
      chromeMaterial
    );
    hingePin.position.set(0, 0.01, 0.02);
    petalPivot.add(hingePin);

    petalFairingsGroup.add(petalPivot);
    petalPivots.push(petalPivot);
  }

  // Сохраняем удобные ссылки в userData для управления анимацией
  root.userData = {
    mountFlange,
    capsuleHull,
    petalFairingsGroup,
    petalPivots,
    carouselCore,
    beaconTip,
    baseCarouselZ: fairingStartZ
  };

  return root;
}

// ============================================================================
// Адаптер под единый просмотрщик: цикл развёртывания 14 с.
// applyTel(t): раскрытие лепестков → выдвижение карусели → боевой режим.
// Возвращает { elev, doors } для телеметрии.
// ============================================================================
export function createWeapon() {
  const root = createWeaponSaranchaS();
  const ud = root.userData;

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeInOutCubic = (x) => {
    const t = clamp01(x);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  ud.applyTel = (t) => {
    const tt = Math.max(0, Math.min(TEL_CYCLE, t));

    // Лепестки: раскрытие 2.0–4.5 с, удержание, закрытие 11.4–13.8 с
    let open;
    if (tt < 2.0) open = 0;
    else if (tt < 4.5) open = easeInOutCubic((tt - 2.0) / 2.5);
    else if (tt < 11.4) open = 1;
    else open = 1 - easeInOutCubic((tt - 11.4) / 2.4);

    // Карусель: выдвижение 4.4–6.2 с, удержание, втягивание 9.8–11.4 с
    let deploy;
    if (tt < 4.4) deploy = 0;
    else if (tt < 6.2) deploy = easeInOutCubic((tt - 4.4) / 1.8);
    else if (tt < 9.8) deploy = 1;
    else deploy = 1 - easeInOutCubic((tt - 9.8) / 1.6);

    for (const pivot of ud.petalPivots) {
      pivot.rotation.x = -open * PETAL_MAX_ANGLE;
    }

    ud.carouselCore.position.z = ud.baseCarouselZ + deploy * CAROUSEL_TRAVEL;
    ud.carouselCore.rotation.z = tt * 0.45 * deploy;

    if (ud.beaconTip) {
      ud.beaconTip.material.emissiveIntensity = 1.4 + Math.sin(tt * 6.0) * 0.9;
    }

    return { elev: deploy * 45, doors: open };
  };

  ud.setExtension = (t) => {
    const info = ud.applyTel(Math.max(0, Math.min(TEL_CYCLE, t)));
    return info;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
