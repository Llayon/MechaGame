import * as THREE from 'three';

export const meta = {
  id: 'keu50',
  code: 'КЭУ-50',
  title: 'КЭУ-50 «Энергия-Л»',
  subtitle: 'СВЕРХТЯЖЁЛЫЙ ЛАЗЕРНЫЙ КОМПЛЕКС • СЛОТ SUPERHEAVY • ЦИКЛ 4.4 С',
  description:
    'Сверхтяжёлый лазерный комплекс: сдвоенный лафет УСП с гидроприводами наведения, криогенно-энергетический отсек в плитке «Буран» с баками и радиаторами сброса тепла, телескопический коллиматор с выходной линзой 0.70 м и раздвижными бронестворками. Цикл 4.4 с: открытие створок → накачка → импульс → охлаждение → закрытие.',
  specs: [
    ['Тип', 'Сверхтяжёлый лазер'],
    ['Слот', 'SUPERHEAVY'],
    ['Цикл', '4.4 с'],
    ['Линза', '0.70 м'],
    ['Длина', '5.20 м (z −1.60…+3.60)'],
    ['Створки', 'Раздвижные, 2 × бронеблок'],
    ['Маркировка', 'КЭУ-50 / высокая энергия'],
  ],
  maxExtension: 4.4,
  unit: 's',
  tipOffset: 3.6,
  subgroups: [
    { key: 'mountFlange', label: '1. Сдвоенный лафет УСП' },
    { key: 'cryoPowerBlock', label: '2. Криогенно-энергетический отсек' },
    { key: 'collimatorTurret', label: '3. Телескопический коллиматор' },
    { key: 'armorShutters', label: '4. Бронестворки' },
  ],
  cameras: {
    module: { pos: [4.6, 2.6, 5.8], target: [0, 0.55, 1.0] },
  },
  rangeMarkers: [],
  controls: 'laser',
};

/**
 * Процедурная генерация текстур термозащитной плитки «Буран» (цвет + карта рельефа расшивки)
 */
function createBuranTileTextures() {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  // Базовый фон швов расшивки
  cCtx.fillStyle = '#7c8288';
  cCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#303030';
  bCtx.fillRect(0, 0, size, size);

  // Детерминированный ГПСЧ для лёгкой вариации оттенков плиток
  let seed = 19881115;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const rows = 16;
  const cols = 16;
  const tileW = size / cols;
  const tileH = size / rows;
  const gap = 3;

  for (let r = 0; r < rows; r++) {
    const offsetX = (r % 2) * (tileW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * tileW + offsetX + gap * 0.5;
      const y = r * tileH + gap * 0.5;
      const w = tileW - gap;
      const h = tileH - gap;

      // Лёгкая тональная вариация вокруг #d8dce0
      const delta = Math.floor((rand() - 0.5) * 14);
      const cr = Math.min(255, Math.max(0, 0xd8 + delta));
      const cg = Math.min(255, Math.max(0, 0xdc + delta));
      const cb = Math.min(255, Math.max(0, 0xe0 + delta));

      cCtx.fillStyle = `rgb(${cr},${cg},${cb})`;
      cCtx.fillRect(x, y, w, h);

      // Лёгкая фаска плитки на карте высот
      bCtx.fillStyle = '#d8d8d8';
      bCtx.fillRect(x, y, w, h);
      bCtx.strokeStyle = '#909090';
      bCtx.lineWidth = 2;
      bCtx.strokeRect(x + 1, y + 1, w - 2, h - 2);

      // Технологические микро-точки крепления на части плиток
      if (rand() > 0.72) {
        cCtx.fillStyle = 'rgba(90, 96, 104, 0.35)';
        cCtx.fillRect(x + 6, y + 6, 3, 3);
        cCtx.fillRect(x + w - 9, y + h - 9, 3, 3);
      }
    }
  }

  // Тонкие технологические стыки термобарьеров
  cCtx.strokeStyle = 'rgba(55, 60, 66, 0.55)';
  cCtx.lineWidth = 4;
  cCtx.beginPath();
  cCtx.moveTo(0, size * 0.5);
  cCtx.lineTo(size, size * 0.5);
  cCtx.moveTo(size * 0.5, 0);
  cCtx.lineTo(size * 0.5, size);
  cCtx.stroke();

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);
  bumpMap.anisotropy = 8;

  return { map, bumpMap };
}

/**
 * Процедурная текстура трафарета лафета и предупреждающей маркировки
 */
function createStencilTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');

  // Тёмно-графитовая бронеплита
  ctx.fillStyle = '#262a2f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Внешняя рамка
  ctx.strokeStyle = '#9da4ab';
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

  // Предупреждающая красно-белая полоса сверху и снизу
  const stripeW = 36;
  ctx.save();
  ctx.beginPath();
  ctx.rect(22, 22, canvas.width - 44, 34);
  ctx.rect(22, canvas.height - 56, canvas.width - 44, 34);
  ctx.clip();

  for (let x = -100; x < canvas.width + 100; x += stripeW * 2) {
    ctx.fillStyle = '#b82925';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW - 60, canvas.height);
    ctx.lineTo(x - 60, canvas.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#d8dce0';
    ctx.beginPath();
    ctx.moveTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW * 2, 0);
    ctx.lineTo(x + stripeW * 2 - 60, canvas.height);
    ctx.lineTo(x + stripeW - 60, canvas.height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Знак лазерной опасности (слева)
  const cx = 135;
  const cy = canvas.height * 0.5 + 4;
  ctx.fillStyle = '#e0a826';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 72);
  ctx.lineTo(cx + 68, cy + 52);
  ctx.lineTo(cx - 68, cy + 52);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#181a1d';
  ctx.lineWidth = 7;
  ctx.stroke();

  // Вспышка и луч внутри знака
  ctx.fillStyle = '#181a1d';
  ctx.beginPath();
  ctx.arc(cx - 6, cy + 12, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - 6, cy + 9, 52, 6);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    ctx.save();
    ctx.translate(cx - 6, cy + 12);
    ctx.rotate(a);
    ctx.fillRect(14, -2, 12, 4);
    ctx.restore();
  }

  // Основной трафарет
  ctx.fillStyle = '#e8ecf0';
  ctx.font = 'bold 64px "Courier New", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('КЭУ-50 «ЭНЕРГИЯ-Л»', 235, 132);

  // Плашка предупреждения
  ctx.fillStyle = '#b82925';
  ctx.fillRect(235, 182, 735, 58);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px "Courier New", monospace';
  ctx.fillText('ОПАСНО: ВЫСОКАЯ ЭНЕРГИЯ', 252, 212);

  // Индекс узла УСП
  ctx.fillStyle = '#a6aeb6';
  ctx.font = 'bold 26px "Courier New", monospace';
  ctx.fillText('УСП-2М // ИЗД. 17Ф19-Л // КРИО-КОНТУР ВЫС. ДАВЛ.', 235, 282);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Вспомогательная функция создания трубчатой распорки между двумя точками
 */
function createStrut(p1, p2, radius, material) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const geom = new THREE.CylinderGeometry(radius, radius, len, 10);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Создаёт процедурную 3D-модель сверхтяжёлого лазерного комплекса КЭУ-50 «Энергия-Л»
 * Габариты: ~1.40 x 1.25 x 5.20 м (Z от -1.60 до +3.60)
 * Оптическая ось: +Z, верх: +Y, бок: +X
 * Точка привязки (0, 0, 0): центр сдвоенного силового лафета УСП
 *
 * @returns {THREE.Group}
 */
export function createWeaponKEU50EnergiaL() {
  const root = new THREE.Group();
  root.name = 'KEU50_EnergiaL';

  // --- PBR МАТЕРИАЛЫ ---
  const tileTextures = createBuranTileTextures();
  const stencilTexture = createStencilTexture();

  // 1. Термозащитная обшивка («Буран»)
  const matThermalTile = new THREE.MeshStandardMaterial({
    color: 0xd8dce0,
    map: tileTextures.map,
    bumpMap: tileTextures.bumpMap,
    bumpScale: 0.008,
    metalness: 0.20,
    roughness: 0.55,
  });

  // 2. Матовый авиационный алюминий (фермы и криогенные баки)
  const matAeroAlum = new THREE.MeshStandardMaterial({
    color: 0x8b9299,
    metalness: 0.70,
    roughness: 0.40,
  });

  // 3. Тёмная термостойкая керамика / графит (выходной узел и затворы)
  const matDarkCeramic = new THREE.MeshStandardMaterial({
    color: 0x23262a,
    metalness: 0.65,
    roughness: 0.50,
  });

  // Вспомогательные технические материалы
  const matGunmetal = new THREE.MeshStandardMaterial({
    color: 0x3b4046,
    metalness: 0.78,
    roughness: 0.35,
  });

  const matKaptonGold = new THREE.MeshStandardMaterial({
    color: 0xc9933b,
    metalness: 0.85,
    roughness: 0.28,
  });

  const matHazardYellow = new THREE.MeshStandardMaterial({
    color: 0xd49b24,
    metalness: 0.35,
    roughness: 0.45,
  });

  const matStencilPlate = new THREE.MeshStandardMaterial({
    map: stencilTexture,
    metalness: 0.45,
    roughness: 0.48,
  });

  const matLensCoating = new THREE.MeshPhysicalMaterial({
    color: 0x164a66,
    emissive: 0x0a2e42,
    emissiveIntensity: 0.45,
    metalness: 0.15,
    roughness: 0.06,
    transmission: 0.55,
    thickness: 0.18,
    ior: 1.72,
    iridescence: 1.0,
    iridescenceIOR: 1.48,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });

  const matEmitterCore = new THREE.MeshStandardMaterial({
    color: 0x4be1ff,
    emissive: 0x1fb8ff,
    emissiveIntensity: 1.6,
    metalness: 0.2,
    roughness: 0.2,
  });

  // =========================================================================
  // 1. СДВОЕННЫЙ КОСМИЧЕСКИЙ ЛАФЕТ (mountFlange)
  // Габариты основания: 1.15 x 0.22 x 1.75 м, центр строго в (0, 0, 0)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Центральная силовая плита-кессон лафета (y: -0.11 .. +0.07)
  const basePlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.18, 1.68),
    matDarkCeramic
  );
  basePlate.position.set(0, -0.02, 0);
  mountFlange.add(basePlate);

  // Сдвоенные продольные силовые балки УСП (ширина суммарно 1.15 м, высота 0.22 м, длина 1.75 м)
  for (const side of [-1, 1]) {
    const beamX = side * 0.485;

    // Нижняя и верхняя полки двутавра
    const flangeBottom = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.045, 1.75),
      matGunmetal
    );
    flangeBottom.position.set(beamX, -0.0875, 0);
    mountFlange.add(flangeBottom);

    const flangeTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.045, 1.75),
      matGunmetal
    );
    flangeTop.position.set(beamX, 0.0875, 0);
    mountFlange.add(flangeTop);

    // Стенка двутавра
    const beamWeb = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.13, 1.72),
      matDarkCeramic
    );
    beamWeb.position.set(beamX, 0, 0);
    mountFlange.add(beamWeb);

    // Трафаретная бронеплита «КЭУ-50 / ОПАСНО: ВЫСОКАЯ ЭНЕРГИЯ» на боковой грани лафета
    const stencilMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.18, 0.56),
      matStencilPlate
    );
    stencilMesh.position.set(side * 0.576, 0.0, 0.0);
    mountFlange.add(stencilMesh);
  }

  // Поперечные силовые шпангоуты лафета
  for (const zPos of [-0.82, -0.42, 0.42, 0.82]) {
    const crossRib = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.19, 0.09),
      matAeroAlum
    );
    crossRib.position.set(0, -0.005, zPos);
    mountFlange.add(crossRib);
  }

  // 8 силовых стыковочных замков УСП (по 4 на каждом борту)
  const lockZPositions = [-0.66, -0.24, 0.24, 0.66];
  for (const side of [-1, 1]) {
    for (const zPos of lockZPositions) {
      const lockGroup = new THREE.Group();
      lockGroup.position.set(side * 0.535, 0.01, zPos);

      // Корпус гидрозамка
      const lockHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.16, 0.15),
        matAeroAlum
      );
      lockGroup.add(lockHousing);

      // Силовой захват-клешня
      const lockClaw = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.06, 0.09),
        matGunmetal
      );
      lockClaw.position.set(side * 0.015, -0.055, 0);
      lockGroup.add(lockClaw);

      // Индикаторная планка фиксации
      const lockMarker = new THREE.Mesh(
        new THREE.BoxGeometry(0.095, 0.025, 0.11),
        matHazardYellow
      );
      lockMarker.position.set(0, 0.045, 0);
      lockGroup.add(lockMarker);

      mountFlange.add(lockGroup);
    }
  }

  // Силовой привод горизонтального и вертикального наведения над лафетом (y: 0.07 .. 0.24)
  const slewRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.46, 0.10, 24),
    matGunmetal
  );
  slewRing.position.set(0, 0.12, 0.05);
  mountFlange.add(slewRing);

  const gimbalCradle = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.10, 1.32),
    matDarkCeramic
  );
  gimbalCradle.position.set(0, 0.19, 0.02);
  mountFlange.add(gimbalCradle);

  // Сдвоенные силовые гидроцилиндры привода угла места
  for (const side of [-1, 1]) {
    const cylBase = new THREE.Vector3(side * 0.34, 0.11, -0.58);
    const cylTop = new THREE.Vector3(side * 0.34, 0.27, -0.22);
    mountFlange.add(createStrut(cylBase, cylTop, 0.042, matAeroAlum));

    const rodBase = new THREE.Vector3(side * 0.34, 0.13, 0.64);
    const rodTop = new THREE.Vector3(side * 0.34, 0.27, 0.32);
    mountFlange.add(createStrut(rodBase, rodTop, 0.038, matAeroAlum));
  }

  // =========================================================================
  // 2. КРИОГЕННО-ЭНЕРГЕТИЧЕСКИЙ ОТСЕК (cryoPowerBlock)
  // Расположение: z = -1.60 до +1.20 (длина 2.80 м), ось на y = 0.62
  // =========================================================================
  const cryoPowerBlock = new THREE.Group();
  cryoPowerBlock.name = 'cryoPowerBlock';
  root.add(cryoPowerBlock);

  const opticalAxisY = 0.62;

  // Многогранный корпус со скошенными гранями (восьмиугольный профиль)
  // Ширина корпуса ~0.88 м, высота ~0.86 м (y от 0.19 до 1.05)
  const hullShape = new THREE.Shape();
  const hw = 0.44;
  const hh = 0.43;
  const cham = 0.14;
  hullShape.moveTo(-hw + cham, -hh);
  hullShape.lineTo(hw - cham, -hh);
  hullShape.lineTo(hw, -hh + cham);
  hullShape.lineTo(hw, hh - cham);
  hullShape.lineTo(hw - cham, hh);
  hullShape.lineTo(-hw + cham, hh);
  hullShape.lineTo(-hw, hh - cham);
  hullShape.lineTo(-hw, -hh + cham);
  hullShape.closePath();

  const hullGeom = new THREE.ExtrudeGeometry(hullShape, {
    depth: 2.66,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  });
  hullGeom.translate(0, 0, -1.53);

  const mainHull = new THREE.Mesh(hullGeom, matThermalTile);
  mainHull.position.set(0, opticalAxisY, 0);
  cryoPowerBlock.add(mainHull);

  // Силовые графитовые шпангоуты и продольные стрингера поверх плитки
  for (const zRing of [-1.42, -0.72, 0.0, 0.72, 1.12]) {
    const frameRing = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.90, 0.07),
      matDarkCeramic
    );
    frameRing.position.set(0, opticalAxisY, zRing);
    cryoPowerBlock.add(frameRing);
  }

  // Верхний технологический гаргрот с шинами накачки
  const dorsalSpine = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.09, 2.52),
    matDarkCeramic
  );
  dorsalSpine.position.set(0, opticalAxisY + 0.46, -0.18);
  cryoPowerBlock.add(dorsalSpine);

  // Кормовая переборка (z = -1.55 .. -1.60): выхлопные сопла турбонасосного агрегата и высоковольтные вводы
  const rearBulkhead = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.74, 0.08),
    matDarkCeramic
  );
  rearBulkhead.position.set(0, opticalAxisY, -1.56);
  cryoPowerBlock.add(rearBulkhead);

  for (const side of [-1, 1]) {
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.15, 0.14, 18),
      matGunmetal
    );
    nozzle.rotation.x = Math.PI * 0.5;
    nozzle.position.set(side * 0.21, opticalAxisY - 0.12, -1.54);
    cryoPowerBlock.add(nozzle);

    // Высоковольтные конденсаторные купола
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      matAeroAlum
    );
    capDome.position.set(side * 0.20, opticalAxisY + 0.17, -1.54);
    cryoPowerBlock.add(capDome);
  }

  // --- ДВА КРУПНЫХ КРИОГЕННЫХ БАКА В ОТКРЫТОЙ ТРУБЧАТОЙ ФЕРМЕ (+X борт) ---
  // Внешний край фермы на x = +0.70 м (общая ширина комплекса ровно 1.40 м)
  const cryoBay = new THREE.Group();
  cryoBay.name = 'cryoTanksAndTruss';
  cryoPowerBlock.add(cryoBay);

  const tankX = 0.545;
  const tankRadius = 0.145;
  const tankCylLen = 0.76;
  const tankZCenters = [-0.78, 0.34];

  for (const zc of tankZCenters) {
    const tankGroup = new THREE.Group();
    tankGroup.position.set(tankX, opticalAxisY + 0.02, zc);

    // Цилиндрическая обечайка криогенного бака
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(tankRadius, tankRadius, tankCylLen, 24),
      matAeroAlum
    );
    cyl.rotation.x = Math.PI * 0.5;
    tankGroup.add(cyl);

    // Сферические днища
    for (const endDir of [-1, 1]) {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(
          tankRadius,
          24,
          14,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.5
        ),
        matAeroAlum
      );
      dome.rotation.x = endDir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      dome.position.z = endDir * (tankCylLen * 0.5);
      tankGroup.add(dome);

      // Криогенный клапан и золотая экранно-вакуумная теплоизоляция (ЭВТИ)
      const valve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.042, 0.09, 12),
        matKaptonGold
      );
      valve.rotation.x = Math.PI * 0.5;
      valve.position.z = endDir * (tankCylLen * 0.5 + tankRadius + 0.02);
      tankGroup.add(valve);
    }

    // Силовые хомуты крепления бака
    for (const strapZ of [-0.24, 0.24]) {
      const strap = new THREE.Mesh(
        new THREE.CylinderGeometry(
          tankRadius + 0.008,
          tankRadius + 0.008,
          0.035,
          24
        ),
        matDarkCeramic
      );
      strap.rotation.x = Math.PI * 0.5;
      strap.position.z = strapZ;
      tankGroup.add(strap);
    }

    cryoBay.add(tankGroup);
  }

  // Криогенный трубопровод подачи между баками и в резонатор
  const cryoPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 2.35, 12),
    matKaptonGold
  );
  cryoPipe.rotation.x = Math.PI * 0.5;
  cryoPipe.position.set(0.47, opticalAxisY + 0.22, -0.18);
  cryoBay.add(cryoPipe);

  // Открытая пространственная трубчатая ферма вокруг криогенных баков
  const trussZNodes = [-1.36, -0.78, -0.22, 0.34, 0.92];
  const innerX = 0.43;
  const outerX = 0.695;
  const topY = opticalAxisY + 0.26;
  const botY = opticalAxisY - 0.22;

  for (let i = 0; i < trussZNodes.length; i++) {
    const z = trussZNodes[i];
    const pInTop = new THREE.Vector3(innerX, topY, z);
    const pInBot = new THREE.Vector3(innerX, botY, z);
    const pOutTop = new THREE.Vector3(outerX, topY - 0.04, z);
    const pOutBot = new THREE.Vector3(outerX, botY + 0.04, z);

    // Поперечные рамы фермы
    cryoBay.add(createStrut(pInTop, pOutTop, 0.014, matAeroAlum));
    cryoBay.add(createStrut(pInBot, pOutBot, 0.014, matAeroAlum));
    cryoBay.add(createStrut(pOutTop, pOutBot, 0.015, matAeroAlum));

    // Продольные и диагональные раскосы между секциями
    if (i < trussZNodes.length - 1) {
      const zNext = trussZNodes[i + 1];
      const nOutTop = new THREE.Vector3(outerX, topY - 0.04, zNext);
      const nOutBot = new THREE.Vector3(outerX, botY + 0.04, zNext);
      const nInTop = new THREE.Vector3(innerX, topY, zNext);
      const nInBot = new THREE.Vector3(innerX, botY, zNext);

      cryoBay.add(createStrut(pOutTop, nOutTop, 0.015, matAeroAlum));
      cryoBay.add(createStrut(pOutBot, nOutBot, 0.015, matAeroAlum));
      // Диагональные раскосы жёсткости
      cryoBay.add(createStrut(pOutBot, nOutTop, 0.011, matAeroAlum));
      cryoBay.add(createStrut(pInTop, nOutTop, 0.011, matAeroAlum));
      cryoBay.add(createStrut(pInBot, nOutBot, 0.011, matAeroAlum));
    }
  }

  // --- РАЗВЁРНУТЫЕ РЕБРИСТЫЕ ПАНЕЛИ РАДИАТОРОВ СБРОСА ТЕПЛА (-X борт и верх) ---
  // Внешний край левого радиатора на x = -0.70 м, верхнего на y = 1.14 м (высота комплекса 1.25 м)
  const radiatorGroup = new THREE.Group();
  radiatorGroup.name = 'heatRadiators';
  cryoPowerBlock.add(radiatorGroup);

  // Бортовой блок радиаторов (-X)
  const sideManifold = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.56, 2.24),
    matDarkCeramic
  );
  sideManifold.position.set(-0.47, opticalAxisY + 0.02, -0.22);
  radiatorGroup.add(sideManifold);

  // Развёрнутая несущая плита и 24 поперечных ребра охлаждения
  const sideRadBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.03, 2.18),
    matAeroAlum
  );
  sideRadBase.position.set(-0.59, opticalAxisY + 0.16, -0.22);
  sideRadBase.rotation.z = -0.22;
  radiatorGroup.add(sideRadBase);

  const sideRadLower = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.03, 2.18),
    matAeroAlum
  );
  sideRadLower.position.set(-0.59, opticalAxisY - 0.14, -0.22);
  sideRadLower.rotation.z = 0.22;
  radiatorGroup.add(sideRadLower);

  for (let i = 0; i < 24; i++) {
    const fz = -1.26 + i * 0.09;
    const finTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.11, 0.014),
      matDarkCeramic
    );
    finTop.position.set(-0.585, opticalAxisY + 0.20, fz);
    finTop.rotation.z = -0.22;
    radiatorGroup.add(finTop);

    const finBot = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.11, 0.014),
      matDarkCeramic
    );
    finBot.position.set(-0.585, opticalAxisY - 0.18, fz);
    finBot.rotation.z = 0.22;
    radiatorGroup.add(finBot);
  }

  // Верхняя секция оребрения радиатора сброса тепла (y до 1.14 м)
  for (let i = 0; i < 20; i++) {
    const fz = -1.20 + i * 0.105;
    const topFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.075, 0.014),
      matAeroAlum
    );
    topFin.position.set(0, opticalAxisY + 0.485, fz);
    radiatorGroup.add(topFin);
  }

  // =========================================================================
  // 3. ТЕЛЕСКОПИЧЕСКИЙ ВЫХОДНОЙ КОЛЛИМАТОР (collimatorTurret)
  // Расположение: z = 1.20 до +3.60 (длина 2.40 м), ось (0, 0.62, z)
  // =========================================================================
  const collimatorTurret = new THREE.Group();
  collimatorTurret.name = 'collimatorTurret';
  collimatorTurret.position.set(0, opticalAxisY, 0);
  root.add(collimatorTurret);

  // Поворотный карданный воротник турели наведения (z: 1.16 .. 1.54)
  const turretCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.49, 0.51, 0.36, 32),
    matDarkCeramic
  );
  turretCollar.rotation.x = Math.PI * 0.5;
  turretCollar.position.z = 1.34;
  collimatorTurret.add(turretCollar);

  const gimbalRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.515, 0.515, 0.08, 32),
    matAeroAlum
  );
  gimbalRing.rotation.x = Math.PI * 0.5;
  gimbalRing.position.z = 1.48;
  collimatorTurret.add(gimbalRing);

  // Первая телескопическая ступень (z: 1.52 .. 2.34, радиус 0.45 м, плитка «Буран»)
  const barrelStage1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.46, 0.82, 32),
    matThermalTile
  );
  barrelStage1.rotation.x = Math.PI * 0.5;
  barrelStage1.position.z = 1.93;
  collimatorTurret.add(barrelStage1);

  // Продольные силовые рёбра жёсткости на первой ступени
  for (let a = 0; a < Math.PI * 2; a += Math.PI * 0.5) {
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.78),
      matDarkCeramic
    );
    rib.position.set(Math.cos(a) * 0.455, Math.sin(a) * 0.455, 1.93);
    rib.rotation.z = a;
    collimatorTurret.add(rib);
  }

  // Переходное кольцо телескопа
  const stepRing1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.425, 0.465, 0.09, 32),
    matGunmetal
  );
  stepRing1.rotation.x = Math.PI * 0.5;
  stepRing1.position.z = 2.36;
  collimatorTurret.add(stepRing1);

  // Вторая телескопическая ступень (z: 2.38 .. 3.16, радиус 0.415 м, тёмный графит)
  const barrelStage2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.41, 0.415, 0.78, 32),
    matDarkCeramic
  );
  barrelStage2.rotation.x = Math.PI * 0.5;
  barrelStage2.position.z = 2.77;
  collimatorTurret.add(barrelStage2);

  // Охлаждающие кольца и волноводы на второй ступени
  for (const zr of [2.52, 2.72, 2.92, 3.10]) {
    const coolingBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.422, 0.422, 0.032, 32),
      matAeroAlum
    );
    coolingBand.rotation.x = Math.PI * 0.5;
    coolingBand.position.z = zr;
    collimatorTurret.add(coolingBand);
  }

  // Бортовые оптико-локационные блоки тонкого наведения (ЛИДАР / ИК-пеленгатор)
  for (const side of [-1, 1]) {
    const trackerPod = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.16, 0.62),
      matAeroAlum
    );
    trackerPod.position.set(side * 0.44, 0.04, 2.74);
    collimatorTurret.add(trackerPod);

    const trackerLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.04, 16),
      matLensCoating
    );
    trackerLens.rotation.x = Math.PI * 0.5;
    trackerLens.position.set(side * 0.44, 0.04, 3.06);
    collimatorTurret.add(trackerLens);
  }

  // Передняя бленда выходного телескопа (z: 3.15 .. 3.50, внешний радиус 0.435 м)
  const hoodOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.435, 0.425, 0.35, 36, 1, true),
    matDarkCeramic
  );
  hoodOuter.rotation.x = Math.PI * 0.5;
  hoodOuter.position.z = 3.325;
  collimatorTurret.add(hoodOuter);

  const hoodInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.365, 0.365, 0.35, 36, 1, true),
    matGunmetal
  );
  hoodInner.rotation.x = Math.PI * 0.5;
  hoodInner.position.z = 3.325;
  collimatorTurret.add(hoodInner);

  // Торцевое кольцо бленды
  const hoodFrontCap = new THREE.Mesh(
    new THREE.RingGeometry(0.365, 0.435, 36),
    matDarkCeramic
  );
  hoodFrontCap.position.z = 3.50;
  collimatorTurret.add(hoodFrontCap);

  // --- ВЫХОДНОЕ ЗЕРКАЛО / ЛИНЗА ДИАМЕТРОМ 0.70 М (R = 0.35 М) ---
  const lensAssembly = new THREE.Group();
  lensAssembly.name = 'outputLens070m';
  lensAssembly.position.z = 3.36;
  collimatorTurret.add(lensAssembly);

  // Оправа линзы (внутренний просвет ровно D = 0.70 м -> R = 0.35 м)
  const lensBezel = new THREE.Mesh(
    new THREE.TorusGeometry(0.355, 0.016, 16, 48),
    matAeroAlum
  );
  lensAssembly.add(lensBezel);

  // Внутренний излучатель и вторичное зеркало Кассегрена за линзой
  const backMirror = new THREE.Mesh(
    new THREE.CircleGeometry(0.345, 36),
    matGunmetal
  );
  backMirror.position.z = -0.14;
  lensAssembly.add(backMirror);

  const emitterRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.012, 12, 36),
    matEmitterCore
  );
  emitterRing.position.z = -0.10;
  lensAssembly.add(emitterRing);

  const secondaryMirror = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.095, 0.06, 24),
    matDarkCeramic
  );
  secondaryMirror.rotation.x = Math.PI * 0.5;
  secondaryMirror.position.z = -0.04;
  lensAssembly.add(secondaryMirror);

  // Растяжки-пилоны вторичного зеркала (паук)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const pStart = new THREE.Vector3(
      Math.cos(angle) * 0.085,
      Math.sin(angle) * 0.085,
      -0.04
    );
    const pEnd = new THREE.Vector3(
      Math.cos(angle) * 0.345,
      Math.sin(angle) * 0.345,
      -0.08
    );
    lensAssembly.add(createStrut(pStart, pEnd, 0.008, matDarkCeramic));
  }

  // Главная менисковая линза диаметром 0.70 м (radius = 0.35 м)
  const primaryLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 48, 24, 0, Math.PI * 2, 0, 0.378),
    matLensCoating
  );
  primaryLens.rotation.x = Math.PI * 0.5;
  // Смещение так, чтобы сферический сегмент диаметром 0.70 м сидел точно в оправе z = 0
  primaryLens.position.z = -0.882;
  lensAssembly.add(primaryLens);

  // =========================================================================
  // 4. МАССИВНЫЕ РАЗДВИЖНЫЕ БРОНЕСТВОРКИ (armorShutters)
  // Отдельная sub-group внутри collimatorTurret для анимации открытия
  // Передний срез закрытых створок на z = 3.60 м (общая длина комплекса 5.20 м)
  // =========================================================================
  const armorShutters = new THREE.Group();
  armorShutters.name = 'armorShutters';
  armorShutters.position.set(0, 0, 3.535);
  collimatorTurret.add(armorShutters);

  // Верхняя и нижняя направляющие рельсы раздвижения бронестворок
  for (const yDir of [-1, 1]) {
    const guideRail = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.036, 0.055),
      matAeroAlum
    );
    guideRail.position.set(0, yDir * 0.435, -0.01);
    armorShutters.add(guideRail);
  }

  // Геометрия одной половины массивной бронестворки (с перекрытием по центру)
  function buildShutterLeaf(side) {
    const leafGroup = new THREE.Group();
    leafGroup.name = side < 0 ? 'leftShutter' : 'rightShutter';

    // Основной массивный бронеблок из термостойкой керамики/графита
    const mainSlab = new THREE.Mesh(
      new THREE.BoxGeometry(0.43, 0.83, 0.075),
      matDarkCeramic
    );
    mainSlab.position.set(side * 0.215, 0, 0);
    leafGroup.add(mainSlab);

    // Внешняя накладка из термозащитной плитки на фронтальной броне
    const frontArmorTile = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.68, 0.025),
      matThermalTile
    );
    frontArmorTile.position.set(side * 0.23, 0, 0.046);
    leafGroup.add(frontArmorTile);

    // Силовые вертикальные рёбра жёсткости и скос стыка по центру
    const seamBevel = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.84, 0.095),
      matGunmetal
    );
    seamBevel.position.set(side * 0.02, 0, 0.005);
    leafGroup.add(seamBevel);

    // Ползуны-каретки на верхней и нижней направляющих
    for (const yDir of [-1, 1]) {
      const carriage = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.055, 0.085),
        matAeroAlum
      );
      carriage.position.set(side * 0.22, yDir * 0.435, -0.01);
      leafGroup.add(carriage);
    }

    return leafGroup;
  }

  const leftShutter = buildShutterLeaf(-1);
  const rightShutter = buildShutterLeaf(1);
  armorShutters.add(leftShutter);
  armorShutters.add(rightShutter);

  // Включение теней для всех мешей комплекса
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  // Удобный контроллер раскрытия бронестворок (t: 0 = закрыто, 1 = полностью открыто)
  root.userData.armorShutters = armorShutters;
  root.userData.leftShutter = leftShutter;
  root.userData.rightShutter = rightShutter;
  // Ссылки на излучающие материалы для адаптера просмотрщика (накачка/импульс)
  root.userData.matEmitterCore = matEmitterCore;
  root.userData.matLensCoating = matLensCoating;
  root.userData.setShutterOpen = (t) => {
    const clamped = Math.max(0, Math.min(1, t));
    // Плавная S-кривая (cubic smoothstep)
    const ease = clamped * clamped * (3 - 2 * clamped);
    const travelX = 0.395 * ease;
    const retractZ = -0.035 * ease;

    leftShutter.position.set(-travelX, 0, retractZ);
    rightShutter.position.set(travelX, 0, retractZ);

    // Усиление свечения оптического тракта при открытии затвора
    matEmitterCore.emissiveIntensity = 0.6 + ease * 2.2;
    matLensCoating.emissiveIntensity = 0.2 + ease * 0.75;
  };

  return root;
}

// ============================================================================
// Адаптер под единый просмотрщик: цикл 4.4 с — створки → накачка → импульс.
// applyLaser(t): поза створок, накал линзы, луч, вспышка. Возвращает { open, charge, pulse }.
// ============================================================================
const LASER_CYCLE = 4.4;

export function createWeapon() {
  const root = createWeaponKEU50EnergiaL();
  const ud = root.userData;
  const emitterMat = ud.matEmitterCore;
  const lensMat = ud.matLensCoating;

  // Луч сверхтяжёлого класса: яркое ядро + широкое гало, вперёд от среза створок
  const beamGroup = new THREE.Group();
  beamGroup.name = 'beamJet';
  beamGroup.position.set(0, 0.62, 3.60);
  beamGroup.visible = false;
  root.add(beamGroup);

  const beamLen = 14.0;
  const beamCoreGeo = new THREE.CylinderGeometry(0.06, 0.10, beamLen, 16, 1, true);
  beamCoreGeo.rotateX(Math.PI * 0.5);
  const beamCoreMat = new THREE.MeshBasicMaterial({
    color: 0xcfeeff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beamCore = new THREE.Mesh(beamCoreGeo, beamCoreMat);
  beamCore.position.z = beamLen * 0.5;
  beamGroup.add(beamCore);

  const haloGeo = new THREE.CylinderGeometry(0.20, 0.30, beamLen, 16, 1, true);
  haloGeo.rotateX(Math.PI * 0.5);
  const beamHaloMat = new THREE.MeshBasicMaterial({
    color: 0x2fa8ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beamHalo = new THREE.Mesh(haloGeo, beamHaloMat);
  beamHalo.position.z = beamLen * 0.5;
  beamGroup.add(beamHalo);

  const flashLight = new THREE.PointLight(0x9fdcff, 0, 10, 1.8);
  flashLight.position.set(0, 0.62, 3.75);
  root.add(flashLight);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  const sstep = (e0, e1, x) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  ud.applyLaser = (t) => {
    let open = 0;
    if (t >= 0.8 && t < 2.9) open = sstep(0.8, 1.55, t);
    else if (t >= 2.9 && t < 3.7) open = 1 - sstep(2.9, 3.65, t);

    let charge = 0;
    if (t >= 1.55 && t < 2.0) charge = sstep(1.55, 2.0, t) * 0.6;
    else if (t >= 2.0 && t < 2.5) charge = Math.max(0, 1 - sstep(2.0, 2.5, t)) * 0.6;

    let pulse = 0;
    if (t >= 2.0 && t < 2.25) {
      pulse = Math.sin(((t - 2.0) / 0.25) * Math.PI);
      pulse *= 0.88 + 0.12 * Math.sin(t * 95.0);
    }

    ud.setShutterOpen(open);
    // Поверх базового свечения створок — накачка резонатора и вспышка импульса
    emitterMat.emissiveIntensity += charge * 2.0 + pulse * 4.5;
    lensMat.emissiveIntensity += charge * 1.2 + pulse * 2.8;

    beamGroup.visible = pulse > 0.01;
    beamCoreMat.opacity = pulse * 0.9;
    beamHaloMat.opacity = pulse * 0.4;
    const w = 0.7 + pulse * 0.6;
    beamCore.scale.set(w, w, 1);
    beamHalo.scale.set(w, w, 1);
    flashLight.intensity = pulse * 30.0;
    root.position.z = -pulse * 0.03;

    return { open, charge, pulse };
  };

  ud.setExtension = (t) => {
    const info = ud.applyLaser(Math.max(0, Math.min(LASER_CYCLE, t)));
    return info;
  };

  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
