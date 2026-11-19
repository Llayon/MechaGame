import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const meta = {
  id: 'b8m',
  code: 'Б-8М',
  title: 'Б-8М «Кассета»',
  subtitle: 'ПОДВЕСНОЙ БЛОК НАР С-8 • 12 НАПРАВЛЯЮЩИХ • СЛОТ AUX',
  description: 'Подвесной блок неуправляемых ракет С-8: фланец УСП с полосой опасности, цилиндрический корпус с хомутами и газоотводом, кассета из 12 направляющих труб и 12 мини-ракет с красной заглушкой. Поочерёдный пуск через 0.42 с, затем перезарядка.',
  specs: [
    ['Снаряд', 'С-8, 12 шт'],
    ['Темп пуска', '1 / 0.42 с'],
    ['Порядок', 'Через один, затем центр'],
    ['Слот', 'AUX'],
    ['Цикл залпа', '7.42 с'],
    ['Трубы', '12 направляющих'],
  ],
  maxExtension: 7.42,
  unit: 's',
  tipOffset: 0.78,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'podHousing', label: '2. Корпус блока и газоотвод' },
    { key: 'rocketTubesGroup', label: '3. Кассета труб и ракеты' },
  ],
  cameras: {
    module: { pos: [1.35, 0.35, 1.45], target: [0, -0.24, 0.12] },
  },
  rangeMarkers: [],
  controls: 'salvo',
};

const SALVO_FIRST = 0.6;
const SALVO_INTERVAL = 0.42;
const SALVO_COUNT = 12;
const SALVO_RELOAD_AT = SALVO_FIRST + (SALVO_COUNT - 1) * SALVO_INTERVAL + 2.2; // 7.42
const SALVO_ORDER = [1, 6, 3, 8, 5, 10, 2, 7, 4, 9, 11, 0];

/**
 * Создаёт процедурную 3D-модель подвесного блока НАР Б-8М «Кассета» (слот AUX).
 * Система координат: 1 unit = 1 м, +Z — направление пуска, +Y — верх, (0, 0, 0) — центр фланца УСП.
 * @returns {THREE.Group}
 */
export function createWeaponB8MKasseta() {
  const root = new THREE.Group();
  root.name = 'B8M_Kasseta';

  // --- 1. ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (CanvasTexture) ---

  // Жёлто-чёрная полоса опасности для фланца УСП
  function createHazardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#d89b00';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#181a1d';
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

    // Лёгкая техническая потёртость краёв
    ctx.strokeStyle = 'rgba(20, 22, 25, 0.65)';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    return tex;
  }

  // Трафаретная техническая надпись «Б-8М / НЕ СТОЯТЬ» для бортов корпуса
  function createStencilTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рамка технического трафарета
    ctx.strokeStyle = 'rgba(24, 27, 30, 0.88)';
    ctx.lineWidth = 6;
    ctx.strokeRect(48, 44, canvas.width - 96, canvas.height - 88);

    // Угловые технологические метки
    ctx.fillStyle = 'rgba(24, 27, 30, 0.88)';
    ctx.fillRect(48, 44, 36, 14);
    ctx.fillRect(canvas.width - 84, 44, 36, 14);

    // Основной индекс изделия: Б-8М
    ctx.font = '900 132px "Arial Black", "Impact", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Б-8М', canvas.width * 0.5, 168);

    // Разделительная черта
    ctx.fillRect(140, 252, canvas.width - 280, 6);

    // Предупреждающий трафарет: НЕ СТОЯТЬ
    ctx.font = '800 84px "Arial", sans-serif';
    ctx.fillText('НЕ СТОЯТЬ', canvas.width * 0.5, 336);

    // Мелкая сервисная маркировка
    ctx.font = '700 28px "Consolas", "Courier New", monospace';
    ctx.fillStyle = 'rgba(28, 31, 35, 0.78)';
    ctx.fillText('СНАР. С-8  •  20/12 НАПР.  •  ВЗРЫВООПАСНО', canvas.width * 0.5, 418);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // Процедурная карта шероховатости / заклёпочных швов алюминиевой обшивки
  function createHullRoughnessTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    // Технологические стыки листов
    ctx.strokeStyle = '#a8a8a8';
    ctx.lineWidth = 2;
    for (let y = 64; y < 512; y += 128) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();

      // Заклёпки вдоль шва
      ctx.fillStyle = '#5a5a5a';
      for (let x = 8; x < 512; x += 16) {
        ctx.fillRect(x, y - 6, 3, 3);
        ctx.fillRect(x, y + 4, 3, 3);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    return tex;
  }

  // --- 2. PBR МАТЕРИАЛЫ ---

  const hullRoughnessMap = createHullRoughnessTexture();
  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a8086,
    metalness: 0.60,
    roughness: 0.50,
    roughnessMap: hullRoughnessMap,
    bumpMap: hullRoughnessMap,
    bumpScale: 0.0015
  });

  const gunmetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x23262a,
    metalness: 0.80,
    roughness: 0.45
  });

  const redCapMaterial = new THREE.MeshStandardMaterial({
    color: 0xa83228,
    metalness: 0.08,
    roughness: 0.60
  });

  const brassContactMaterial = new THREE.MeshStandardMaterial({
    color: 0xc29345,
    metalness: 0.88,
    roughness: 0.30
  });

  const rocketBodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b5258,
    metalness: 0.72,
    roughness: 0.38
  });

  const hazardMaterial = new THREE.MeshStandardMaterial({
    map: createHazardTexture(),
    metalness: 0.25,
    roughness: 0.55
  });

  const stencilMaterial = new THREE.MeshStandardMaterial({
    map: createStencilTexture(),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    metalness: 0.2,
    roughness: 0.65
  });

  // Геометрические константы блока
  const POD_RADIUS = 0.24; // Диаметр 0.48 м
  const POD_AXIS_Y = -0.28; // Ось цилиндра ниже центра фланца (0,0,0)

  // =========================================================================
  // УЗЕЛ 1: СТЫКОВОЧНЫЙ УЗЕЛ УСП (mountFlange)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';

  // Верхняя опорная плита УСП (0.32 x 0.035 x 0.65 м)
  const topPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.035, 0.65),
    hullMaterial
  );
  topPlate.position.set(0, 0.0425, 0);
  mountFlange.add(topPlate);

  // Силовой корпус пилона с жёлто-чёрной полосой опасности по бортам
  const pylonBodyMaterials = [
    hazardMaterial, // +X
    hazardMaterial, // -X
    hullMaterial,   // +Y
    hullMaterial,   // -Y
    hullMaterial,   // +Z
    hullMaterial    // -Z
  ];
  const pylonCore = new THREE.Mesh(
    new THREE.BoxGeometry(0.29, 0.055, 0.62),
    pylonBodyMaterials
  );
  pylonCore.position.set(0, -0.0025, 0);
  mountFlange.add(pylonCore);

  // Нижний переходной обтекатель-седло, сопрягающий фланец с цилиндром корпуса
  const saddleSkirt = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.075, 0.58),
    hullMaterial
  );
  saddleSkirt.position.set(0, -0.065, 0);
  mountFlange.add(saddleSkirt);

  // Передний и задний скошенные обтекатели пилона
  const fairingGeo = new THREE.CylinderGeometry(0.04, 0.055, 0.28, 4);
  fairingGeo.rotateZ(Math.PI / 2);
  fairingGeo.rotateY(Math.PI / 4);

  const frontPylonCap = new THREE.Mesh(fairingGeo, hullMaterial);
  frontPylonCap.scale.set(1, 0.7, 0.7);
  frontPylonCap.position.set(0, 0.005, 0.325);
  mountFlange.add(frontPylonCap);

  const rearPylonCap = new THREE.Mesh(fairingGeo, hullMaterial);
  rearPylonCap.scale.set(1, 0.7, 0.7);
  rearPylonCap.position.set(0, 0.005, -0.325);
  mountFlange.add(rearPylonCap);

  // 4 стыковочных замка (бугели / узлы фиксации УСП)
  const lockCoords = [
    [-0.115, 0.058,  0.21],
    [ 0.115, 0.058,  0.21],
    [-0.115, 0.058, -0.21],
    [ 0.115, 0.058, -0.21]
  ];
  const lockHousingGeo = new THREE.BoxGeometry(0.044, 0.026, 0.068);
  const lockPinGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.056, 16);
  lockPinGeo.rotateZ(Math.PI / 2);

  for (const [lx, ly, lz] of lockCoords) {
    const lockUnit = new THREE.Group();
    const housing = new THREE.Mesh(lockHousingGeo, gunmetalMaterial);
    const pin = new THREE.Mesh(lockPinGeo, brassContactMaterial);
    pin.position.y = 0.006;
    lockUnit.add(housing, pin);
    lockUnit.position.set(lx, ly, lz);
    mountFlange.add(lockUnit);
  }

  root.add(mountFlange);

  // =========================================================================
  // УЗЕЛ 2: ЦИЛИНДРИЧЕСКИЙ КОРПУС БЛОКА (podHousing)
  // =========================================================================
  const podHousing = new THREE.Group();
  podHousing.name = 'podHousing';

  // Основной цилиндрический тубус (z: от -0.45 до +0.75, длина 1.20 м, диаметр 0.48 м)
  const mainTubeGeo = new THREE.CylinderGeometry(POD_RADIUS, POD_RADIUS, 1.20, 48, 1, false);
  mainTubeGeo.rotateX(Math.PI / 2);
  const mainTube = new THREE.Mesh(mainTubeGeo, hullMaterial);
  mainTube.position.set(0, POD_AXIS_Y, 0.15);
  podHousing.add(mainTube);

  // 3 силовых стяжных хомута с натяжными болтовыми замками
  const bandZPositions = [-0.36, -0.02, 0.52];
  const bandGeo = new THREE.CylinderGeometry(POD_RADIUS + 0.0035, POD_RADIUS + 0.0035, 0.026, 48, 1, true);
  bandGeo.rotateX(Math.PI / 2);
  const clampLugGeo = new THREE.BoxGeometry(0.022, 0.032, 0.034);
  const clampBoltGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.048, 10);
  clampBoltGeo.rotateX(Math.PI / 2);

  for (const bz of bandZPositions) {
    const band = new THREE.Mesh(bandGeo, gunmetalMaterial);
    band.position.set(0, POD_AXIS_Y, bz);
    podHousing.add(band);

    for (const side of [-1, 1]) {
      const lug = new THREE.Mesh(clampLugGeo, gunmetalMaterial);
      lug.position.set(side * (POD_RADIUS + 0.006), POD_AXIS_Y, bz);
      const bolt = new THREE.Mesh(clampBoltGeo, hullMaterial);
      bolt.position.set(side * (POD_RADIUS + 0.011), POD_AXIS_Y, bz);
      podHousing.add(lug, bolt);
    }
  }

  // Продольные силовые рёбра жёсткости (стрингеры) по обводу корпуса
  const ribAngles = [-28, -68, -112, -152, 28, 152].map((deg) => (deg * Math.PI) / 180);
  const ribGeo = new THREE.BoxGeometry(0.010, 0.012, 1.12);
  for (const angle of ribAngles) {
    const rib = new THREE.Mesh(ribGeo, hullMaterial);
    rib.position.set(
      Math.cos(angle) * (POD_RADIUS + 0.003),
      POD_AXIS_Y + Math.sin(angle) * (POD_RADIUS + 0.003),
      0.15
    );
    rib.rotation.z = angle;
    podHousing.add(rib);
  }

  // Задний обтекаемый конус-газоотвод с перфорацией (-Z: от z = -0.45 до z = -0.80)
  const rearConeGroup = new THREE.Group();
  rearConeGroup.position.set(0, POD_AXIS_Y, 0);

  // Переходное кольцо (z: -0.45 -> -0.50)
  const collarPoints = [
    new THREE.Vector2(0.21, -0.50),
    new THREE.Vector2(0.228, -0.50),
    new THREE.Vector2(0.24, -0.45),
    new THREE.Vector2(0.21, -0.45)
  ];
  const collarGeo = new THREE.LatheGeometry(collarPoints, 48);
  collarGeo.rotateX(Math.PI / 2);
  rearConeGroup.add(new THREE.Mesh(collarGeo, hullMaterial));

  // Перфорированный конус газоотвода (z: -0.50 -> -0.80)
  const conePoints = [
    new THREE.Vector2(0.042, -0.80),
    new THREE.Vector2(0.068, -0.80),
    new THREE.Vector2(0.165, -0.66),
    new THREE.Vector2(0.226, -0.50),
    new THREE.Vector2(0.205, -0.50),
    new THREE.Vector2(0.148, -0.66),
    new THREE.Vector2(0.042, -0.78)
  ];
  const coneGeo = new THREE.LatheGeometry(conePoints, 48);
  coneGeo.rotateX(Math.PI / 2);
  rearConeGroup.add(new THREE.Mesh(coneGeo, gunmetalMaterial));

  // Перфорация газоотвода (InstancedMesh радиальных вентиляционных отверстий)
  const ventRows = [
    { z: -0.535, r: 0.214, tilt: 0.34 },
    { z: -0.580, r: 0.197, tilt: 0.34 },
    { z: -0.625, r: 0.179, tilt: 0.34 }
  ];
  const ventsPerRow = 24;
  const totalVents = ventRows.length * ventsPerRow;
  const ventHoleGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.016, 12);
  const ventHoleMat = new THREE.MeshStandardMaterial({
    color: 0x0b0c0e,
    metalness: 0.2,
    roughness: 0.9
  });
  const ventInstanced = new THREE.InstancedMesh(ventHoleGeo, ventHoleMat, totalVents);

  const dummy = new THREE.Object3D();
  let vIdx = 0;
  for (let rIdx = 0; rIdx < ventRows.length; rIdx++) {
    const row = ventRows[rIdx];
    const phaseOffset = (rIdx % 2) * (Math.PI / ventsPerRow);
    for (let i = 0; i < ventsPerRow; i++) {
      const theta = (i / ventsPerRow) * Math.PI * 2 + phaseOffset;
      dummy.position.set(
        Math.cos(theta) * row.r,
        Math.sin(theta) * row.r,
        row.z
      );
      dummy.rotation.set(0, 0, theta - Math.PI / 2);
      dummy.rotateX(row.tilt);
      dummy.updateMatrix();
      ventInstanced.setMatrixAt(vIdx++, dummy.matrix);
    }
  }
  ventInstanced.instanceMatrix.needsUpdate = true;
  rearConeGroup.add(ventInstanced);
  podHousing.add(rearConeGroup);

  // Бортовые трафаретные таблички «Б-8М / НЕ СТОЯТЬ» (+X и -X)
  function createCurvedStencilDecal(sideSign) {
    const segsU = 16;
    const segsV = 10;
    const geo = new THREE.PlaneGeometry(0.46, 0.21, segsU, segsV);
    const pos = geo.attributes.position;
    const decalRadius = POD_RADIUS + 0.0018;

    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i); // вдоль оси Z
      const v = pos.getY(i); // по дуге окружности
      const arcAngle = v / decalRadius;

      const x = sideSign * Math.cos(arcAngle) * decalRadius;
      const y = POD_AXIS_Y + Math.sin(arcAngle) * decalRadius;
      // Для +X текст читается слева направо от хвоста к носу (-Z -> +Z), для -X наоборот (+Z -> -Z)
      const z = 0.25 - sideSign * u;

      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, stencilMaterial);
  }

  podHousing.add(createCurvedStencilDecal(1));
  podHousing.add(createCurvedStencilDecal(-1));

  root.add(podHousing);

  // =========================================================================
  // УЗЕЛ 3: КАССЕТА НАПРАВЛЯЮЩИХ ТРУБ (rocketTubesGroup)
  // =========================================================================
  const rocketTubesGroup = new THREE.Group();
  rocketTubesGroup.name = 'rocketTubesGroup';

  // Утопленная передняя торцевая плита (z = 0.745)
  const bulkheadGeo = new THREE.CylinderGeometry(POD_RADIUS - 0.006, POD_RADIUS - 0.006, 0.016, 48);
  bulkheadGeo.rotateX(Math.PI / 2);
  const bulkhead = new THREE.Mesh(bulkheadGeo, gunmetalMaterial);
  bulkhead.position.set(0, POD_AXIS_Y, 0.745);
  rocketTubesGroup.add(bulkhead);

  // Защитный кольцевой отбойник по периметру переднего среза (z = 0.74 .. 0.805)
  const bumperPoints = [
    new THREE.Vector2(0.226, 0.745),
    new THREE.Vector2(0.228, 0.798),
    new THREE.Vector2(0.236, 0.806),
    new THREE.Vector2(0.244, 0.800),
    new THREE.Vector2(0.244, 0.742),
    new THREE.Vector2(0.226, 0.745)
  ];
  const bumperGeo = new THREE.LatheGeometry(bumperPoints, 48);
  bumperGeo.rotateX(Math.PI / 2);
  const bumperRing = new THREE.Mesh(bumperGeo, hullMaterial);
  bumperRing.position.set(0, POD_AXIS_Y, 0);
  rocketTubesGroup.add(bumperRing);

  // Координаты 12 направляющих труб: 1 в центре + кольцо из 11 вокруг
  const TUBE_COUNT = 12;
  const RING_RADIUS = 0.148;
  const tubeOffsets = [{ x: 0, y: 0 }];
  for (let i = 0; i < 11; i++) {
    const theta = (i / 11) * Math.PI * 2 + Math.PI / 2;
    tubeOffsets.push({
      x: Math.cos(theta) * RING_RADIUS,
      y: Math.sin(theta) * RING_RADIUS
    });
  }

  // Геометрия направляющей трубы (полый толстостенный ствол с фаской дульного среза)
  const tubeProfile = [
    new THREE.Vector2(0.0315, 0.62),
    new THREE.Vector2(0.0315, 0.776),
    new THREE.Vector2(0.0340, 0.780),
    new THREE.Vector2(0.0365, 0.776),
    new THREE.Vector2(0.0365, 0.62),
    new THREE.Vector2(0.0315, 0.62)
  ];
  const tubeGeo = new THREE.LatheGeometry(tubeProfile, 28);
  tubeGeo.rotateX(Math.PI / 2);

  const tubesInstanced = new THREE.InstancedMesh(tubeGeo, gunmetalMaterial, TUBE_COUNT);
  tubesInstanced.name = 'guideTubesInstanced';

  for (let i = 0; i < TUBE_COUNT; i++) {
    dummy.position.set(tubeOffsets[i].x, POD_AXIS_Y + tubeOffsets[i].y, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    tubesInstanced.setMatrixAt(i, dummy.matrix);
  }
  tubesInstanced.instanceMatrix.needsUpdate = true;
  rocketTubesGroup.add(tubesInstanced);

  // --- 12 РАКЕТ ВНУТРИ ТРУБ (корпус + коническая БЧ с красной заглушкой + контакт электроподжига) ---
  // 1) Корпус мини-ракеты (виден при вылете из трубы)
  const rocketBodyProfile = [
    new THREE.Vector2(0.001, -0.52),
    new THREE.Vector2(0.022, -0.52),
    new THREE.Vector2(0.029, -0.46),
    new THREE.Vector2(0.029, -0.055),
    new THREE.Vector2(0.001, -0.055)
  ];
  const rocketBodyGeo = new THREE.LatheGeometry(rocketBodyProfile, 20);
  rocketBodyGeo.rotateX(Math.PI / 2);
  const rocketBodiesInstanced = new THREE.InstancedMesh(rocketBodyGeo, rocketBodyMaterial, TUBE_COUNT);

  // 2) Коническая головная часть + матовая красная транспортная заглушка (#a83228)
  const capProfile = [
    new THREE.Vector2(0.029, -0.055),
    new THREE.Vector2(0.027, -0.018),
    new THREE.Vector2(0.015,  0.014),
    new THREE.Vector2(0.0085, 0.017),
    new THREE.Vector2(0.0085, 0.008),
    new THREE.Vector2(0.001,  0.008)
  ];
  const capGeo = new THREE.LatheGeometry(capProfile, 24);
  capGeo.rotateX(Math.PI / 2);
  const rocketCapsInstanced = new THREE.InstancedMesh(capGeo, redCapMaterial, TUBE_COUNT);

  // 3) Центральный контакт электроподжига и контактное кольцо
  const contactProfile = [
    new THREE.Vector2(0.0001, 0.008),
    new THREE.Vector2(0.0055, 0.008),
    new THREE.Vector2(0.0055, 0.020),
    new THREE.Vector2(0.0022, 0.022),
    new THREE.Vector2(0.0001, 0.022)
  ];
  const contactGeo = new THREE.LatheGeometry(contactProfile, 16);
  contactGeo.rotateX(Math.PI / 2);
  const rocketContactsInstanced = new THREE.InstancedMesh(contactGeo, brassContactMaterial, TUBE_COUNT);

  const INITIAL_ROCKET_Z = 0.752; // Головная часть утоплена внутри дульного среза (z = 0.780)
  for (let i = 0; i < TUBE_COUNT; i++) {
    dummy.position.set(tubeOffsets[i].x, POD_AXIS_Y + tubeOffsets[i].y, INITIAL_ROCKET_Z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    rocketBodiesInstanced.setMatrixAt(i, dummy.matrix);
    rocketCapsInstanced.setMatrixAt(i, dummy.matrix);
    rocketContactsInstanced.setMatrixAt(i, dummy.matrix);
  }
  rocketBodiesInstanced.instanceMatrix.needsUpdate = true;
  rocketCapsInstanced.instanceMatrix.needsUpdate = true;
  rocketContactsInstanced.instanceMatrix.needsUpdate = true;

  rocketTubesGroup.add(rocketBodiesInstanced, rocketCapsInstanced, rocketContactsInstanced);
  root.add(rocketTubesGroup);

  // Сохраняем ссылки и параметры для анимации пуска в userData
  root.userData = {
    podAxisY: POD_AXIS_Y,
    tubeOffsets,
    initialRocketZ: INITIAL_ROCKET_Z,
    rocketBodiesInstanced,
    rocketCapsInstanced,
    rocketContactsInstanced
  };

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
// ТЕСТОВАЯ СЦЕНА (автономный стенд; во вьювере не вызывается —
// движок index.html сам ставит свет, пол и анимацию залпа).
// ===========================================================================
function initTestScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16191e);
  scene.fog = new THREE.FogExp2(0x16191e, 0.035);

  // Реалистичное PBR-отражение для металлов (алюминий и воронёная сталь)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 100);
  camera.position.set(1.35, 0.35, 1.45);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -0.24, 0.12);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 0.5;
  controls.maxDistance = 8.0;

  // Освещение
  const hemiLight = new THREE.HemisphereLight(0xdbe6f5, 0x262930, 0.75);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff6ea, 2.2);
  keyLight.position.set(2.5, 3.5, 2.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 12;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x7aa4d6, 1.1);
  rimLight.position.set(-2.5, -1.0, -2.5);
  scene.add(rimLight);

  // Пол ангара и условный узел подвески в (0, 0, 0)
  const grid = new THREE.GridHelper(10, 20, 0x3b424d, 0x252930);
  grid.position.y = -0.95;
  scene.add(grid);

  const pylonMountStub = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.45, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.7, roughness: 0.45 })
  );
  pylonMountStub.position.set(0, 0.285, 0);
  scene.add(pylonMountStub);

  // Добавляем блок Б-8М «Кассета»
  const b8mPod = createWeaponB8MKasseta();
  scene.add(b8mPod);

  // Реактивные факелы выхлопа (для анимации пуска)
  const {
    podAxisY,
    tubeOffsets,
    initialRocketZ,
    rocketBodiesInstanced,
    rocketCapsInstanced,
    rocketContactsInstanced
  } = b8mPod.userData;

  const flameGeo = new THREE.ConeGeometry(0.026, 0.38, 12);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0.9
  });
  const flamesInstanced = new THREE.InstancedMesh(flameGeo, flameMat, 12);
  scene.add(flamesInstanced);

  // Симметричный порядок стрельбы из 12 стволов (сначала внешнее кольцо через один, затем центр)
  const firingOrder = [1, 6, 3, 8, 5, 10, 2, 7, 4, 9, 11, 0];
  const rocketsState = Array.from({ length: 12 }, () => ({
    launched: false,
    flightTime: 0,
    z: initialRocketZ,
    roll: 0
  }));

  const dummy = new THREE.Object3D();
  const zeroScaleMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  // Инициализация факелов в скрытом состоянии
  for (let i = 0; i < 12; i++) {
    flamesInstanced.setMatrixAt(i, zeroScaleMatrix);
  }
  flamesInstanced.instanceMatrix.needsUpdate = true;

  let elapsed = 0;
  let nextFireIndex = 0;
  let fireTimer = 0.6;
  const FIRE_INTERVAL = 0.42;

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    fireTimer += dt;

    // Поочерёдный пуск ракет
    if (nextFireIndex < firingOrder.length && fireTimer >= FIRE_INTERVAL) {
      fireTimer = 0;
      const tubeIdx = firingOrder[nextFireIndex++];
      rocketsState[tubeIdx].launched = true;
      rocketsState[tubeIdx].flightTime = 0;
    }

    // Перезарядка после отстрела всех 12 ракет и паузы 1.5 сек
    if (nextFireIndex >= firingOrder.length && fireTimer >= 2.2) {
      nextFireIndex = 0;
      fireTimer = 0;
      for (const st of rocketsState) {
        st.launched = false;
        st.flightTime = 0;
        st.z = initialRocketZ;
        st.roll = 0;
      }
    }

    // Обновление матриц полёта каждой ракеты и факела
    let needsMatrixUpdate = false;
    for (let i = 0; i < 12; i++) {
      const st = rocketsState[i];
      const offset = tubeOffsets[i];

      if (st.launched) {
        st.flightTime += dt;
        // Ускоренное движение строго вдоль +Z с лёгким вращением по крену
        st.z = initialRocketZ + 4.5 * st.flightTime + 26.0 * st.flightTime * st.flightTime;
        st.roll += dt * 18.0;
        needsMatrixUpdate = true;

        if (st.z < 22.0) {
          dummy.position.set(offset.x, podAxisY + offset.y, st.z);
          dummy.rotation.set(0, 0, st.roll);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();

          rocketBodiesInstanced.setMatrixAt(i, dummy.matrix);
          rocketCapsInstanced.setMatrixAt(i, dummy.matrix);
          rocketContactsInstanced.setMatrixAt(i, dummy.matrix);

          // Реактивный факел позади сопла ракеты
          const flicker = 0.85 + Math.sin(elapsed * 65 + i) * 0.25;
          dummy.position.set(offset.x, podAxisY + offset.y, st.z - 0.70);
          dummy.scale.set(1, 1, flicker);
          dummy.updateMatrix();
          flamesInstanced.setMatrixAt(i, dummy.matrix);
        } else {
          rocketBodiesInstanced.setMatrixAt(i, zeroScaleMatrix);
          rocketCapsInstanced.setMatrixAt(i, zeroScaleMatrix);
          rocketContactsInstanced.setMatrixAt(i, zeroScaleMatrix);
          flamesInstanced.setMatrixAt(i, zeroScaleMatrix);
        }
      } else if (nextFireIndex === 0 && fireTimer === 0) {
        // Возврат ракет в кассету при перезарядке
        needsMatrixUpdate = true;
        dummy.position.set(offset.x, podAxisY + offset.y, initialRocketZ);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        rocketBodiesInstanced.setMatrixAt(i, dummy.matrix);
        rocketCapsInstanced.setMatrixAt(i, dummy.matrix);
        rocketContactsInstanced.setMatrixAt(i, dummy.matrix);
        flamesInstanced.setMatrixAt(i, zeroScaleMatrix);
      }
    }

    if (needsMatrixUpdate) {
      rocketBodiesInstanced.instanceMatrix.needsUpdate = true;
      rocketCapsInstanced.instanceMatrix.needsUpdate = true;
      rocketContactsInstanced.instanceMatrix.needsUpdate = true;
      flamesInstanced.instanceMatrix.needsUpdate = true;
    }

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

// initTestScene(); // Автономный стенд: раскомментировать только вне просмотрщика.

// =========================================================================
// Адаптер под единый просмотрщик: залп 12 ракет С-8 по расписанию.
// applySalvo(t, elapsed): абсолютное время цикла — пуск, полёт, факелы,
// перезарядка. Возвращает { fired, flying } для телеметрии.
// =========================================================================
export function createWeapon() {
  const root = createWeaponB8MKasseta();
  const ud = root.userData;
  const { podAxisY, tubeOffsets, initialRocketZ } = ud;
  const bodies = ud.rocketBodiesInstanced;
  const caps = ud.rocketCapsInstanced;
  const contacts = ud.rocketContactsInstanced;

  const flameGeo = new THREE.ConeGeometry(0.026, 0.38, 12);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0.9,
  });
  const flames = new THREE.InstancedMesh(flameGeo, flameMat, SALVO_COUNT);
  root.add(flames);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  const dummyL = new THREE.Object3D();
  const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < SALVO_COUNT; i++) flames.setMatrixAt(i, zeroM);
  flames.instanceMatrix.needsUpdate = true;

  const placeRocket = (i, z, roll, withFlame, elapsed) => {
    const off = tubeOffsets[i];
    dummyL.position.set(off.x, podAxisY + off.y, z);
    dummyL.rotation.set(0, 0, roll);
    dummyL.scale.set(1, 1, 1);
    dummyL.updateMatrix();
    bodies.setMatrixAt(i, dummyL.matrix);
    caps.setMatrixAt(i, dummyL.matrix);
    contacts.setMatrixAt(i, dummyL.matrix);
    if (withFlame) {
      const flicker = 0.85 + Math.sin(elapsed * 65 + i) * 0.25;
      dummyL.position.set(off.x, podAxisY + off.y, z - 0.70);
      dummyL.scale.set(1, 1, flicker);
      dummyL.updateMatrix();
      flames.setMatrixAt(i, dummyL.matrix);
    } else {
      flames.setMatrixAt(i, zeroM);
    }
  };

  ud.applySalvo = (t, elapsed) => {
    let fired = 0;
    let flying = 0;
    for (let i = 0; i < SALVO_COUNT; i++) {
      const k = SALVO_ORDER.indexOf(i);
      const tFire = SALVO_FIRST + k * SALVO_INTERVAL;
      const off = tubeOffsets[i];
      if (t < tFire) {
        // Ещё в трубе
        dummyL.position.set(off.x, podAxisY + off.y, initialRocketZ);
        dummyL.rotation.set(0, 0, 0);
        dummyL.scale.set(1, 1, 1);
        dummyL.updateMatrix();
        bodies.setMatrixAt(i, dummyL.matrix);
        caps.setMatrixAt(i, dummyL.matrix);
        contacts.setMatrixAt(i, dummyL.matrix);
        flames.setMatrixAt(i, zeroM);
      } else {
        fired++;
        const ft = t - tFire;
        const z = initialRocketZ + 4.5 * ft + 26.0 * ft * ft;
        if (z < 22.0) {
          flying++;
          placeRocket(i, z, ft * 18.0, true, elapsed);
        } else {
          bodies.setMatrixAt(i, zeroM);
          caps.setMatrixAt(i, zeroM);
          contacts.setMatrixAt(i, zeroM);
          flames.setMatrixAt(i, zeroM);
        }
      }
    }
    bodies.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    contacts.instanceMatrix.needsUpdate = true;
    flames.instanceMatrix.needsUpdate = true;
    return { fired, flying };
  };

  ud.setExtension = (t) => {
    const info = ud.applySalvo(Math.max(0, Math.min(SALVO_RELOAD_AT, t)), 0);
    return info;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
