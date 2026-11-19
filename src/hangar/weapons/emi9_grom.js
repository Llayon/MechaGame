import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const meta = {
  id: 'emi9',
  code: 'ЭМИ-9',
  title: 'ЭМИ-9 «Гром»',
  subtitle: 'РЕЛЬСОВАЯ ЭЛЕКТРОМАГНИТНАЯ ПУШКА • СЛОТ HEAVY • 45 кВ / 1.4 МДж',
  description: 'Рельсовая электромагнитная пушка: фланец УСП с табличкой высокого напряжения, конденсаторный блок из 6 банок 45 кВ с керамическими изоляторами и радиаторами, разрезной рельсовый ствол 3.05 м с медными шинами, графитовыми вкладышами и 8-ступенчатой индикацией накала. Цикл 6.4 с: накопление → разряд → остывание.',
  specs: [
    ['Напряжение', '45 кВ'],
    ['Энергия', '1.4 МДж'],
    ['Слот', 'HEAVY'],
    ['Цикл', '6.4 с'],
    ['Ступени накала', '8'],
    ['Длина модуля', '~4.3 м'],
  ],
  maxExtension: 6.4,
  unit: 's',
  tipOffset: 3.50,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'capacitorBank', label: '2. Конденсаторный блок 45 кВ' },
    { key: 'railBarrelGroup', label: '3. Рельсовый ствол' },
  ],
  cameras: {
    module: { pos: [3.2, 1.85, 3.4], target: [0, 0.42, 1.15] },
  },
  rangeMarkers: [],
  controls: 'railgun',
};

const RAIL_CYCLE = 6.4;
const RAIL_CHARGE_END = 4.2;
const RAIL_FIRE_TIME = 5.05;

/**
 * Процедурная генерация текстуры предупреждающей таблички УСП по ГОСТ
 */
function createWarningPlateTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Базовый фон тёмно-жёлтой промышленной эмали
  ctx.fillStyle = '#c8961e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Лёгкая фактура потёртости и старения краски
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const w = 1 + Math.random() * 6;
    const h = 1 + Math.random() * 3;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(30,25,20,0.08)' : 'rgba(255,240,190,0.07)';
    ctx.fillRect(x, y, w, h);
  }

  // Диагональные черно-жёлтые полосы сверху и снизу
  const stripeH = 34;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, stripeH);
  ctx.rect(0, canvas.height - stripeH, canvas.width, stripeH);
  ctx.clip();

  ctx.fillStyle = '#1b1d1f';
  for (let x = -60; x < canvas.width + 60; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 24, 0);
    ctx.lineTo(x - 16, canvas.height);
    ctx.lineTo(x - 40, canvas.height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Чёрная рамка и разделитель знака
  ctx.strokeStyle = '#1b1d1f';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, stripeH + 8, canvas.width - 24, canvas.height - stripeH * 2 - 16);

  // Треугольный знак высокого напряжения (слева)
  const triCx = 115;
  const triCy = canvas.height / 2 + 4;
  ctx.fillStyle = '#e0ac24';
  ctx.strokeStyle = '#1b1d1f';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(triCx, triCy - 56);
  ctx.lineTo(triCx + 62, triCy + 48);
  ctx.lineTo(triCx - 62, triCy + 48);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Молния внутри треугольника
  ctx.fillStyle = '#1b1d1f';
  ctx.beginPath();
  ctx.moveTo(triCx + 2, triCy - 30);
  ctx.lineTo(triCx - 16, triCy + 6);
  ctx.lineTo(triCx + 2, triCy + 6);
  ctx.lineTo(triCx - 10, triCy + 38);
  ctx.lineTo(triCx + 22, triCy - 4);
  ctx.lineTo(triCx + 4, triCy - 4);
  ctx.closePath();
  ctx.fill();

  // Трафаретные надписи
  ctx.fillStyle = '#181a1c';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 42px "Courier New", monospace';
  ctx.fillText('ОПАСНО: ВЫСОКОЕ НАПРЯЖЕНИЕ', 210, canvas.height / 2 - 22);

  ctx.font = 'bold 25px "Courier New", monospace';
  ctx.fillStyle = '#24272a';
  ctx.fillText('ИЗДЕЛИЕ ЭМИ-9 «ГРОМ»  |  45 кВ / 1.4 МДж  |  УСП-ТЯЖ', 210, canvas.height / 2 + 28);

  // Заклёпки по углам
  const rivets = [
    [28, stripeH + 22],
    [canvas.width - 28, stripeH + 22],
    [28, canvas.height - stripeH - 22],
    [canvas.width - 28, canvas.height - stripeH - 22],
  ];
  ctx.fillStyle = '#3c4044';
  for (const [rx, ry] of rivets) {
    ctx.beginPath();
    ctx.arc(rx, ry, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Процедурная микротекстура шероховатости катаной броневой стали
 */
function createSteelRoughnessTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#999999';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 120 + Math.floor(Math.random() * 75);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 2 + Math.random() * 8, 1 + Math.random() * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

/**
 * Создаёт профилированную геометрию ребристого керамического изолятора (LatheGeometry)
 */
function createCeramicBushingGeometry(radius = 0.042, height = 0.16, sheds = 4) {
  const points = [];
  const baseR = radius * 0.62;
  points.push(new THREE.Vector2(0.001, 0));
  points.push(new THREE.Vector2(baseR * 1.15, 0));
  points.push(new THREE.Vector2(baseR * 1.15, height * 0.1));

  const bodyStart = height * 0.12;
  const bodyEnd = height * 0.88;
  const step = (bodyEnd - bodyStart) / sheds;

  for (let i = 0; i < sheds; i++) {
    const y0 = bodyStart + i * step;
    points.push(new THREE.Vector2(baseR * 0.85, y0 + step * 0.15));
    points.push(new THREE.Vector2(radius, y0 + step * 0.45));
    points.push(new THREE.Vector2(radius * 0.96, y0 + step * 0.62));
    points.push(new THREE.Vector2(baseR * 0.82, y0 + step * 0.85));
  }

  points.push(new THREE.Vector2(baseR * 0.95, height * 0.94));
  points.push(new THREE.Vector2(baseR * 0.95, height));
  points.push(new THREE.Vector2(0.001, height));

  const geom = new THREE.LatheGeometry(points, 24);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Создаёт самодостаточную 3D-модель рельсовой электромагнитной пушки ЭМИ-9 «Гром» (слот HEAVY).
 * Система координат: +Z — направление ствола, +Y — верх, +X — бок, (0, 0, 0) — центр фланца УСП.
 * Общая длина: ~4.3 м (от z = -0.80 до z = +3.50).
 *
 * @returns {THREE.Group} Корневая группа модуля вооружения
 */
export function createWeaponEMI9Grom() {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'Weapon_EMI9_Grom';

  // --- ОБЩИЕ PBR-МАТЕРИАЛЫ ---
  const steelRoughMap = createSteelRoughnessTexture();

  // Основная серо-стальная броня и силовые стяжки
  const armorSteelMat = new THREE.MeshStandardMaterial({
    color: 0x596066,
    metalness: 0.50,
    roughness: 0.60,
    roughnessMap: steelRoughMap,
    bumpMap: steelRoughMap,
    bumpScale: 0.002,
  });

  // Тёмный конструкционный металл (рамы, болты, радиаторные коллекторы)
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x363b40,
    metalness: 0.62,
    roughness: 0.52,
    roughnessMap: steelRoughMap,
  });

  // Токоведущие шины и рельсы — тёмная медь
  const copperMat = new THREE.MeshStandardMaterial({
    color: 0x9c6b3b,
    metalness: 0.88,
    roughness: 0.30,
  });

  // Графитовые / карбидные контактные вкладыши рельсов
  const graphiteMat = new THREE.MeshStandardMaterial({
    color: 0x2b2e33,
    metalness: 0.88,
    roughness: 0.30,
  });

  // Технический коричнево-белый фарфор / керамика изоляторов
  const ceramicMat = new THREE.MeshStandardMaterial({
    color: 0xd8d2c5,
    metalness: 0.05,
    roughness: 0.25,
  });

  // Коричневая глазурь на торцах высоковольтных проходных изоляторов
  const ceramicGlazeMat = new THREE.MeshStandardMaterial({
    color: 0x6b442a,
    metalness: 0.05,
    roughness: 0.22,
  });

  // Отдельные материалы для 8 ступеней накала индикаторов заряда (тёплый янтарный цвет)
  const STAGE_COUNT = 8;
  const chargeStageMaterials = Array.from({ length: STAGE_COUNT }, (_, idx) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2e1b08,
      emissive: new THREE.Color(0xff8c1a),
      emissiveIntensity: 0.0,
      metalness: 0.15,
      roughness: 0.35,
    });
    mat.name = `EMI9_ChargeStageMat_${idx}`;
    return mat;
  });

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange) — центр в (0, 0, 0)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  rootGroup.add(mountFlange);

  // Основная плита УСП: 0.68 x 0.16 x 1.10 м, центр в (0, 0, 0)
  const flangePlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.16, 1.10),
    armorSteelMat
  );
  flangePlate.castShadow = true;
  flangePlate.receiveShadow = true;
  mountFlange.add(flangePlate);

  // Силовые продольные и поперечные рёбра жёсткости плиты УСП
  const flangeRimFront = new THREE.Mesh(
    new THREE.BoxGeometry(0.71, 0.05, 0.08),
    darkMetalMat
  );
  flangeRimFront.position.set(0, -0.055, 0.52);
  mountFlange.add(flangeRimFront);

  const flangeRimRear = flangeRimFront.clone();
  flangeRimRear.position.set(0, -0.055, -0.52);
  mountFlange.add(flangeRimRear);

  // 4 механических замка УСП по бокам плиты + направляющие штифты снизу
  const lockPositions = [
    [-0.355, -0.01, -0.34],
    [0.355, -0.01, -0.34],
    [-0.355, -0.01, 0.34],
    [0.355, -0.01, 0.34],
  ];

  const lockHousingGeom = new THREE.BoxGeometry(0.055, 0.11, 0.16);
  const lockPinGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.21, 16);
  lockPinGeom.rotateX(Math.PI / 2);

  for (const [lx, ly, lz] of lockPositions) {
    const lockGroup = new THREE.Group();
    lockGroup.position.set(lx, ly, lz);

    const housing = new THREE.Mesh(lockHousingGeom, darkMetalMat);
    housing.castShadow = true;
    lockGroup.add(housing);

    const pin = new THREE.Mesh(lockPinGeom, armorSteelMat);
    pin.position.x = Math.sign(lx) * 0.012;
    lockGroup.add(pin);

    mountFlange.add(lockGroup);
  }

  // Нижние конусные направляющие ловители УСП
  const guidePinGeom = new THREE.CylinderGeometry(0.024, 0.036, 0.055, 16);
  for (const [gx, gz] of [
    [-0.22, -0.40],
    [0.22, -0.40],
    [-0.22, 0.40],
    [0.22, 0.40],
  ]) {
    const guide = new THREE.Mesh(guidePinGeom, darkMetalMat);
    guide.position.set(gx, -0.107, gz);
    mountFlange.add(guide);
  }

  // Боковые таблички с CanvasTexture «ОПАСНО: ВЫСОКОЕ НАПРЯЖЕНИЕ»
  const warningTex = createWarningPlateTexture();
  const warningMat = new THREE.MeshStandardMaterial({
    map: warningTex,
    metalness: 0.25,
    roughness: 0.55,
  });

  const plaqueGeom = new THREE.PlaneGeometry(0.50, 0.125);
  const leftPlaque = new THREE.Mesh(plaqueGeom, warningMat);
  leftPlaque.position.set(-0.342, 0.0, 0.0);
  leftPlaque.rotation.y = -Math.PI / 2;
  mountFlange.add(leftPlaque);

  const rightPlaque = new THREE.Mesh(plaqueGeom, warningMat);
  rightPlaque.position.set(0.342, 0.0, 0.0);
  rightPlaque.rotation.y = Math.PI / 2;
  mountFlange.add(rightPlaque);

  // =========================================================================
  // 2. КОНДЕНСАТОРНЫЙ БЛОК ПИТАНИЯ (capacitorBank) — z от -0.80 до +0.30
  // =========================================================================
  const capacitorBank = new THREE.Group();
  capacitorBank.name = 'capacitorBank';
  rootGroup.add(capacitorBank);

  // Нижний бронекороб отсека конденсаторов (z = -0.80 .. +0.30, длина 1.10 м)
  const capChassis = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.22, 1.10),
    armorSteelMat
  );
  capChassis.position.set(0, 0.19, -0.25); // y: 0.08 .. 0.30
  capChassis.castShadow = true;
  capChassis.receiveShadow = true;
  capacitorBank.add(capChassis);

  // Консольные силовые косынки, связывающие задний свес (z = -0.80..-0.55) с фланцем УСП
  for (const side of [-1, 1]) {
    const gusset = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.14, 0.34),
      darkMetalMat
    );
    gusset.position.set(side * 0.27, 0.04, -0.63);
    gusset.rotation.x = 0.28;
    capacitorBank.add(gusset);
  }

  // Задняя торцевая бронеплита с рым-болтами и вентиляционной решёткой (z = -0.80)
  const rearBulkhead = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.56, 0.05),
    armorSteelMat
  );
  rearBulkhead.position.set(0, 0.44, -0.785);
  rearBulkhead.castShadow = true;
  rearBulkhead.receiveShadow = true;
  capacitorBank.add(rearBulkhead);

  // Верхняя защитная силовая рама вокруг конденсаторной батареи
  const cageRailGeom = new THREE.BoxGeometry(0.035, 0.035, 1.08);
  for (const side of [-1, 1]) {
    const topRail = new THREE.Mesh(cageRailGeom, darkMetalMat);
    topRail.position.set(side * 0.31, 0.72, -0.25);
    topRail.castShadow = true;
    capacitorBank.add(topRail);

    for (const pz of [-0.76, -0.25, 0.26]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.44, 0.035),
        darkMetalMat
      );
      post.position.set(side * 0.31, 0.50, pz);
      post.castShadow = true;
      capacitorBank.add(post);
    }
  }

  // 6 вертикальных цилиндрических высоковольтных конденсаторов (2 ряда x 3)
  const capRadius = 0.112;
  const capHeight = 0.46;
  const capCylinderGeom = new THREE.CylinderGeometry(capRadius, capRadius, capHeight, 28);
  const capBandGeom = new THREE.CylinderGeometry(capRadius + 0.005, capRadius + 0.005, 0.024, 28);
  const capTopFlangeGeom = new THREE.CylinderGeometry(capRadius * 0.94, capRadius * 0.94, 0.025, 24);
  const topCeramicBushingGeom = createCeramicBushingGeometry(0.036, 0.145, 4);
  const terminalStudGeom = new THREE.CylinderGeometry(0.011, 0.011, 0.055, 12);

  const capZCoords = [-0.58, -0.25, 0.08];
  const capXCoords = [-0.165, 0.165];

  capZCoords.forEach((cz, zIdx) => {
    capXCoords.forEach((cx, xIdx) => {
      const capUnit = new THREE.Group();
      capUnit.position.set(cx, 0.24, cz);

      // Корпус импульсного конденсатора (серо-стальной с защитной эмалью)
      const body = new THREE.Mesh(capCylinderGeom, armorSteelMat);
      body.position.y = capHeight / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      capUnit.add(body);

      // Стяжные бандажные хомуты на корпусе конденсатора
      for (const bandY of [0.11, 0.35]) {
        const band = new THREE.Mesh(capBandGeom, darkMetalMat);
        band.position.y = bandY;
        capUnit.add(band);
      }

      // Верхняя крышка банки
      const topLid = new THREE.Mesh(capTopFlangeGeom, darkMetalMat);
      topLid.position.y = capHeight + 0.01;
      capUnit.add(topLid);

      // Керамический проходной изолятор на вершине конденсатора
      const bushing = new THREE.Mesh(topCeramicBushingGeom, ceramicMat);
      bushing.position.y = capHeight + 0.02;
      bushing.castShadow = true;
      capUnit.add(bushing);

      // Глазурованное основание изолятора
      const glazeCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.034, 0.038, 0.024, 18),
        ceramicGlazeMat
      );
      glazeCollar.position.y = capHeight + 0.028;
      capUnit.add(glazeCollar);

      // Медный токовывод
      const stud = new THREE.Mesh(terminalStudGeom, copperMat);
      stud.position.y = capHeight + 0.185;
      capUnit.add(stud);

      // Вертикальный индикатор заряда банки (привязан к ранним ступеням накала)
      const stageIdx = Math.min(STAGE_COUNT - 1, zIdx * 2 + xIdx);
      const capMeter = new THREE.Mesh(
        new THREE.BoxGeometry(0.014, 0.22, 0.016),
        chargeStageMaterials[stageIdx]
      );
      capMeter.position.set(Math.sign(cx) * (capRadius + 0.002), 0.24, 0);
      capUnit.add(capMeter);

      capacitorBank.add(capUnit);
    });
  });

  // Ребристые радиаторы охлаждения по обоим бортам конденсаторного блока (через InstancedMesh)
  const finCountPerSide = 34;
  const totalFins = finCountPerSide * 2;
  const finGeom = new THREE.BoxGeometry(0.048, 0.34, 0.008);
  const radiatorFinsInstanced = new THREE.InstancedMesh(finGeom, darkMetalMat, totalFins);
  radiatorFinsInstanced.castShadow = true;
  radiatorFinsInstanced.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let finIndex = 0;
  for (const side of [-1, 1]) {
    // Плита основания радиатора и коллекторные трубки
    const radBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.36, 0.94),
      armorSteelMat
    );
    radBase.position.set(side * 0.325, 0.33, -0.25);
    radBase.castShadow = true;
    capacitorBank.add(radBase);

    for (const pipeY of [0.18, 0.48]) {
      const manifold = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.96, 12),
        copperMat
      );
      manifold.rotation.x = Math.PI / 2;
      manifold.position.set(side * 0.345, pipeY, -0.25);
      capacitorBank.add(manifold);
    }

    for (let i = 0; i < finCountPerSide; i++) {
      const fz = -0.70 + (i / (finCountPerSide - 1)) * 0.90;
      dummy.position.set(side * 0.352, 0.33, fz);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      radiatorFinsInstanced.setMatrixAt(finIndex++, dummy.matrix);
    }
  }
  radiatorFinsInstanced.instanceMatrix.needsUpdate = true;
  capacitorBank.add(radiatorFinsInstanced);

  // Толстые медные токоведущие шины, собирающие заряд с конденсаторов и идущие вперёд
  for (const side of [-1, 1]) {
    const busX = side * 0.165;
    // Продольная сборная медная шина над конденсаторами
    const collectorBus = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.018, 0.84),
      copperMat
    );
    collectorBus.position.set(busX, 0.895, -0.21);
    collectorBus.castShadow = true;
    capacitorBank.add(collectorBus);

    // Керамические опорные изоляторы шины
    for (const sz of [-0.42, -0.08, 0.22]) {
      const standoff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.020, 0.024, 0.09, 14),
        ceramicMat
      );
      standoff.position.set(busX, 0.84, sz);
      capacitorBank.add(standoff);
    }
  }

  // Поперечная перемычка и перевод шин на верхний (+Y) и нижний (-Y) контуры ствола
  const crossBusUpper = new THREE.Mesh(
    new THREE.BoxGeometry(0.37, 0.020, 0.045),
    copperMat
  );
  crossBusUpper.position.set(0, 0.895, 0.19);
  capacitorBank.add(crossBusUpper);

  // Наклонный спуск верхней силовой шины в казённую часть (z = 0.19 -> 0.48)
  const upperFeedBus = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.028, 0.36),
    copperMat
  );
  upperFeedBus.position.set(0, 0.77, 0.33);
  upperFeedBus.rotation.x = 0.72;
  upperFeedBus.castShadow = true;
  capacitorBank.add(upperFeedBus);

  // Нижняя силовая шина питания нижнего рельса (z = -0.10 -> 0.48)
  const lowerFeedBus = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.028, 0.56),
    copperMat
  );
  lowerFeedBus.position.set(0, 0.25, 0.24);
  lowerFeedBus.castShadow = true;
  capacitorBank.add(lowerFeedBus);

  // Два массивных горизонтальных проходных керамических изолятора на передней переборке (z = 0.30)
  const mainFeedBushingGeom = createCeramicBushingGeometry(0.055, 0.20, 4);
  mainFeedBushingGeom.rotateX(Math.PI / 2);

  for (const by of [0.62, 0.26]) {
    const mainBushing = new THREE.Mesh(mainFeedBushingGeom, ceramicMat);
    mainBushing.position.set(0, by, 0.24);
    mainBushing.castShadow = true;
    capacitorBank.add(mainBushing);
  }

  // =========================================================================
  // 3. РАЗРЕЗНОЙ РЕЛЬСОВЫЙ СТВОЛ (railBarrelGroup) — z от +0.30 до +3.50
  // =========================================================================
  const railBarrelGroup = new THREE.Group();
  railBarrelGroup.name = 'railBarrelGroup';
  rootGroup.add(railBarrelGroup);

  // Казённый силовой блок / коллектор тока (z = 0.28 .. 0.64)
  const breechBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.66, 0.36),
    armorSteelMat
  );
  breechBlock.position.set(0, 0.41, 0.46);
  breechBlock.castShadow = true;
  breechBlock.receiveShadow = true;
  railBarrelGroup.add(breechBlock);

  // Боковые броненакладки казённика с болтовыми фланцами
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.52, 0.30),
      darkMetalMat
    );
    cheek.position.set(side * 0.265, 0.41, 0.46);
    railBarrelGroup.add(cheek);
  }

  // Геометрия верхнего и нижнего токоведущих рельсов (z = 0.45 .. 3.50, длина = 3.05 м)
  const barrelStartZ = 0.45;
  const barrelEndZ = 3.50;
  const barrelLen = barrelEndZ - barrelStartZ; // 3.05 м
  const barrelCenterZ = (barrelStartZ + barrelEndZ) / 2; // 1.975 м
  const boreAxisY = 0.44; // Ось канала ствола
  const railHalfGap = 0.068; // Половина зазора между контактными поверхностями рельсов

  for (const dir of [1, -1]) {
    const railAssembly = new THREE.Group();
    railAssembly.name = dir === 1 ? 'upperRailAssembly' : 'lowerRailAssembly';

    // 1) Внешняя несущая стальная балка рельса
    const spineHeight = 0.072;
    const spineY = boreAxisY + dir * (railHalfGap + 0.046 + spineHeight / 2);
    const steelSpine = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, spineHeight, barrelLen),
      armorSteelMat
    );
    steelSpine.position.set(0, spineY, barrelCenterZ);
    steelSpine.castShadow = true;
    steelSpine.receiveShadow = true;
    railAssembly.add(steelSpine);

    // 2) Массивная медная токоведущая шина рельса
    const copperHeight = 0.036;
    const copperY = boreAxisY + dir * (railHalfGap + 0.010 + copperHeight / 2);
    const copperRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.135, copperHeight, barrelLen),
      copperMat
    );
    copperRail.position.set(0, copperY, barrelCenterZ);
    copperRail.castShadow = true;
    railAssembly.add(copperRail);

    // 3) Внутренняя графито-композитная контактная полоса скольжения снаряда
    const contactHeight = 0.012;
    const contactY = boreAxisY + dir * (railHalfGap + contactHeight / 2);
    const graphiteStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.092, contactHeight, barrelLen),
      graphiteMat
    );
    graphiteStrip.position.set(0, contactY, barrelCenterZ);
    railAssembly.add(graphiteStrip);

    // Боковые медные контактные полосы вдоль зазора рельсов
    for (const side of [-1, 1]) {
      const sideContact = new THREE.Mesh(
        new THREE.BoxGeometry(0.010, 0.022, barrelLen - 0.04),
        copperMat
      );
      sideContact.position.set(
        side * 0.056,
        boreAxisY + dir * (railHalfGap + 0.014),
        barrelCenterZ
      );
      railAssembly.add(sideContact);
    }

    railBarrelGroup.add(railAssembly);
  }

  // Открытая боковая силовая ферма (продольные стрингеры и диагональные раскосы)
  const trussSideX = 0.165;
  for (const side of [-1, 1]) {
    for (const dir of [1, -1]) {
      const longeron = new THREE.Mesh(
        new THREE.BoxGeometry(0.024, 0.028, barrelLen - 0.10),
        darkMetalMat
      );
      longeron.position.set(
        side * trussSideX,
        boreAxisY + dir * 0.145,
        barrelCenterZ
      );
      longeron.castShadow = true;
      railBarrelGroup.add(longeron);
    }
  }

  // Серия из 8 мощных диэлектрических хомутов-изоляторов через InstancedMesh
  const clampCount = 8;
  const clampZStart = 0.72;
  const clampZEnd = 3.36;

  // Слой А: Керамические диэлектрические обоймы, изолирующие верхний и нижний рельсы
  const ceramicClampGeom = new THREE.BoxGeometry(0.24, 0.35, 0.075);
  const ceramicClampsInstanced = new THREE.InstancedMesh(
    ceramicClampGeom,
    ceramicMat,
    clampCount
  );
  ceramicClampsInstanced.name = 'dielectricCeramicClamps';
  ceramicClampsInstanced.castShadow = true;
  ceramicClampsInstanced.receiveShadow = true;

  // Слой Б: Внешние стальные силовые стяжки-ярмо поверх керамических изоляторов
  const steelYokeGeom = new THREE.BoxGeometry(0.32, 0.41, 0.052);
  const steelYokesInstanced = new THREE.InstancedMesh(
    steelYokeGeom,
    armorSteelMat,
    clampCount
  );
  steelYokesInstanced.name = 'steelClampYokes';
  steelYokesInstanced.castShadow = true;
  steelYokesInstanced.receiveShadow = true;

  // Внутренние проставки фермы по краям хомутов (оставляют центральный зазор рельсов открытым!)
  const sideStrutGeom = new THREE.BoxGeometry(0.048, 0.38, 0.068);
  const sideStrutsInstanced = new THREE.InstancedMesh(
    sideStrutGeom,
    darkMetalMat,
    clampCount * 2
  );
  sideStrutsInstanced.castShadow = true;

  const clampDummy = new THREE.Object3D();
  let strutIdx = 0;
  for (let i = 0; i < clampCount; i++) {
    const cz = clampZStart + (i / (clampCount - 1)) * (clampZEnd - clampZStart);

    clampDummy.position.set(0, boreAxisY + 0.145, cz);
    clampDummy.scale.set(1, 0.32, 1);
    clampDummy.rotation.set(0, 0, 0);
    clampDummy.updateMatrix();
    ceramicClampsInstanced.setMatrixAt(i, clampDummy.matrix);

    clampDummy.position.set(0, boreAxisY + 0.165, cz);
    clampDummy.scale.set(1, 0.24, 1);
    clampDummy.updateMatrix();
    steelYokesInstanced.setMatrixAt(i, clampDummy.matrix);

    // Боковые силовые стойки каждого хомута (слева и справа от зазора рельсов)
    for (const side of [-1, 1]) {
      clampDummy.position.set(side * 0.145, boreAxisY, cz);
      clampDummy.scale.set(1, 1, 1);
      clampDummy.updateMatrix();
      sideStrutsInstanced.setMatrixAt(strutIdx++, clampDummy.matrix);
    }
  }

  // Нижние полуобоймы керамических изоляторов и стальных стяжек (второй InstancedMesh на 8 элементов)
  const lowerCeramicClampsInstanced = new THREE.InstancedMesh(
    ceramicClampGeom,
    ceramicMat,
    clampCount
  );
  lowerCeramicClampsInstanced.castShadow = true;

  const lowerSteelYokesInstanced = new THREE.InstancedMesh(
    steelYokeGeom,
    armorSteelMat,
    clampCount
  );
  lowerSteelYokesInstanced.castShadow = true;

  for (let i = 0; i < clampCount; i++) {
    const cz = clampZStart + (i / (clampCount - 1)) * (clampZEnd - clampZStart);

    clampDummy.position.set(0, boreAxisY - 0.145, cz);
    clampDummy.scale.set(1, 0.32, 1);
    clampDummy.rotation.set(0, 0, 0);
    clampDummy.updateMatrix();
    lowerCeramicClampsInstanced.setMatrixAt(i, clampDummy.matrix);

    clampDummy.position.set(0, boreAxisY - 0.165, cz);
    clampDummy.scale.set(1, 0.24, 1);
    clampDummy.updateMatrix();
    lowerSteelYokesInstanced.setMatrixAt(i, clampDummy.matrix);
  }

  ceramicClampsInstanced.instanceMatrix.needsUpdate = true;
  steelYokesInstanced.instanceMatrix.needsUpdate = true;
  lowerCeramicClampsInstanced.instanceMatrix.needsUpdate = true;
  lowerSteelYokesInstanced.instanceMatrix.needsUpdate = true;
  sideStrutsInstanced.instanceMatrix.needsUpdate = true;

  railBarrelGroup.add(
    ceramicClampsInstanced,
    steelYokesInstanced,
    lowerCeramicClampsInstanced,
    lowerSteelYokesInstanced,
    sideStrutsInstanced
  );

  // Световые индикаторы заряда внутри зазора между рельсами (8 ступеней с отдельными материалами)
  const indicatorSegmentLen = (clampZEnd - clampZStart) / STAGE_COUNT;
  const innerStripGeom = new THREE.BoxGeometry(0.010, 0.012, indicatorSegmentLen * 0.72);
  const sideSlotGeom = new THREE.BoxGeometry(0.014, 0.018, 0.045);

  for (let i = 0; i < STAGE_COUNT; i++) {
    const segZ = clampZStart + (i + 0.5) * indicatorSegmentLen;
    const mat = chargeStageMaterials[i];

    // Верхние и нижние emissive-полоски внутри канала между рельсами
    for (const side of [-1, 1]) {
      for (const dir of [1, -1]) {
        const boreStrip = new THREE.Mesh(innerStripGeom, mat);
        boreStrip.position.set(
          side * 0.052,
          boreAxisY + dir * (railHalfGap - 0.004),
          segZ
        );
        railBarrelGroup.add(boreStrip);
      }

      // Наружные контрольные глазки-индикаторы ступени на хомутах
      const clampZ = clampZStart + (i / (clampCount - 1)) * (clampZEnd - clampZStart);
      const sideIndicator = new THREE.Mesh(sideSlotGeom, mat);
      sideIndicator.position.set(side * 0.172, boreAxisY, clampZ);
      railBarrelGroup.add(sideIndicator);
    }
  }

  // Дульный срез / концевой изоляционный блок (z = 3.48)
  const muzzleBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.36, 0.06),
    darkMetalMat
  );
  muzzleBlock.position.set(0, boreAxisY, 3.47);
  muzzleBlock.castShadow = true;
  railBarrelGroup.add(muzzleBlock);

  // Сохраняем ссылки на подгруппы и API анимации зарядки в userData
  rootGroup.userData = {
    mountFlange,
    capacitorBank,
    railBarrelGroup,
    chargeStageMaterials,
  };

  return rootGroup;
}

// ===========================================================================
// СЦЕНА (автономный стенд; во вьювере не вызывается —
// движок index.html сам ставит свет, пол и анимацию цикла заряда/разряда).
// ===========================================================================
function initDemoScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16191c);
  scene.fog = new THREE.FogExp2(0x16191c, 0.045);

  // Процедурная среда отражений для корректного PBR-рендера меди, графита, стали и керамики
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.65;

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.position.set(3.2, 1.85, 3.4);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.2;
  controls.maxDistance = 12.0;
  controls.target.set(0, 0.42, 1.15);
  controls.update();

  // Освещение испытательного стенда (холодный верхний свет цеха + тёплый контровой акцент)
  const hemiLight = new THREE.HemisphereLight(0xbcc6d0, 0x26292c, 0.75);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff5e8, 2.2);
  keyLight.position.set(4.5, 6.5, 3.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 18;
  const d = 4.2;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x8fa4b8, 1.1);
  rimLight.position.set(-4.0, 2.5, -3.0);
  scene.add(rimLight);

  // Локальный тёплый точечный свет в зазоре рельсов, усиливающийся при накале конденсаторов
  const barrelGlowLight = new THREE.PointLight(0xff8c1a, 0.0, 3.2, 1.8);
  barrelGlowLight.position.set(0, 0.44, 1.9);
  scene.add(barrelGlowLight);

  // Испытательный стапель / пол лаборатории
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x202428, roughness: 0.85, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.78;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(20, 40, 0x3b4248, 0x292e33);
  grid.position.y = -0.778;
  scene.add(grid);

  // Опорная тумба под фланец УСП (0, 0, 0)
  const testStand = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.70, 0.96),
    new THREE.MeshStandardMaterial({ color: 0x2f3439, metalness: 0.45, roughness: 0.7 })
  );
  testStand.position.set(0, -0.43, 0);
  testStand.castShadow = true;
  testStand.receiveShadow = true;
  scene.add(testStand);

  // Создаём и добавляем пушку ЭМИ-9 «Гром»
  const emi9Weapon = createWeaponEMI9Grom();
  scene.add(emi9Weapon);

  const stageMaterials = emi9Weapon.userData.chargeStageMaterials;
  const stageCount = stageMaterials.length;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Плавная анимация ступенчатого накала индикаторов конденсаторов и сброса заряда при выстреле
  const clock = new THREE.Clock();
  const CYCLE_DURATION = 6.4; // секунд на полный цикл зарядка -> выстрел -> остывание
  const CHARGE_END = 4.2;     // время завершения ступенчатого накала всех 8 секций
  const FIRE_TIME = 5.05;     // момент разряда (выстрела)

  const coldColor = new THREE.Color(0x2e1b08);
  const warmAmber = new THREE.Color(0xff8c1a);
  const hotAmber = new THREE.Color(0xffbe55);

  function animate() {
    requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();
    const t = elapsed % CYCLE_DURATION;

    let totalGlow = 0;
    let recoilZ = 0;

    for (let i = 0; i < stageCount; i++) {
      const mat = stageMaterials[i];
      const stageStart = (i / stageCount) * (CHARGE_END * 0.86);
      const stageRampDuration = 0.58;

      let heat = 0;

      if (t < FIRE_TIME) {
        // Плавный ступенчатый накал каждой следующей секции конденсаторов и рельсов
        const localProgress = THREE.MathUtils.clamp((t - stageStart) / stageRampDuration, 0, 1);
        // S-образное сглаживание (smoothstep) для инерционного аналогового накала
        const smoothHeat = localProgress * localProgress * (3 - 2 * localProgress);
        // Лёгкая пульсация высоковольтного преобразователя на заряженных ступенях
        const ripple = localProgress >= 1 ? Math.sin(elapsed * 26 + i * 0.9) * 0.06 : 0;
        heat = Math.max(0, smoothHeat + ripple);
      } else {
        // Момент выстрела: бегущая волна разряда по рельсам и тепловое затухание
        const postFire = t - FIRE_TIME;
        const waveDelay = i * 0.018;
        if (postFire < waveDelay + 0.09) {
          // Кратковременный пик тока при прохождении импульса через секцию
          heat = 1.65;
        } else {
          // Плавное остывание нитей индикаторов после сброса заряда
          const decay = Math.max(0, 1 - (postFire - waveDelay - 0.09) / 0.85);
          heat = decay * decay * 0.45;
        }
      }

      mat.emissiveIntensity = heat * 2.8;
      mat.emissive.lerpColors(warmAmber, hotAmber, Math.min(1, heat * 0.75));
      mat.color.lerpColors(coldColor, warmAmber, Math.min(1, heat * 0.6));
      totalGlow += heat;
    }

    // Лёгкий импульс отдачи ствола в момент выстрела
    if (t >= FIRE_TIME && t < FIRE_TIME + 0.45) {
      const ft = (t - FIRE_TIME) / 0.45;
      recoilZ = -0.045 * Math.sin(ft * Math.PI) * Math.exp(-ft * 3.5);
    }
    emi9Weapon.position.z = recoilZ;

    barrelGlowLight.intensity = (totalGlow / stageCount) * 1.4;

    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

// initDemoScene(); // Автономный стенд: раскомментировать только вне просмотрщика.

// =========================================================================
// Адаптер под единый просмотрщик: цикл заряда/разряда 6.4 с.
// applyCharge(t, elapsed): ступенчатый накал, волна разряда, свечение, откат.
// Возвращает { heat, firing } для телеметрии.
// =========================================================================
export function createWeapon() {
  const root = createWeaponEMI9Grom();
  const ud = root.userData;
  const stageMaterials = ud.chargeStageMaterials;
  const stageCount = stageMaterials.length;

  const coldColor = new THREE.Color(0x2e1b08);
  const warmAmber = new THREE.Color(0xff8c1a);
  const hotAmber = new THREE.Color(0xffbe55);

  const glowLight = new THREE.PointLight(0xff8c1a, 0.0, 3.2, 1.8);
  glowLight.position.set(0, 0.44, 1.9);
  root.add(glowLight);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  const applyStageHeat = (heat) => {
    const h = Math.max(0, heat);
    for (const mat of stageMaterials) {
      mat.emissiveIntensity = h * 2.8;
      mat.emissive.lerpColors(warmAmber, hotAmber, Math.min(1, h * 0.75));
      mat.color.lerpColors(coldColor, warmAmber, Math.min(1, h * 0.6));
    }
    return h;
  };

  ud.applyCharge = (t, elapsed) => {
    let totalGlow = 0;
    let recoilZ = 0;
    for (let i = 0; i < stageCount; i++) {
      const mat = stageMaterials[i];
      const stageStart = (i / stageCount) * (RAIL_CHARGE_END * 0.86);
      let heat = 0;
      if (t < RAIL_FIRE_TIME) {
        const localProgress = Math.min(1, Math.max(0, (t - stageStart) / 0.58));
        const smoothHeat = localProgress * localProgress * (3 - 2 * localProgress);
        const ripple = localProgress >= 1 ? Math.sin(elapsed * 26 + i * 0.9) * 0.06 : 0;
        heat = Math.max(0, smoothHeat + ripple);
      } else {
        const postFire = t - RAIL_FIRE_TIME;
        const waveDelay = i * 0.018;
        if (postFire < waveDelay + 0.09) {
          heat = 1.65;
        } else {
          const decay = Math.max(0, 1 - (postFire - waveDelay - 0.09) / 0.85);
          heat = decay * decay * 0.45;
        }
      }
      mat.emissiveIntensity = heat * 2.8;
      mat.emissive.lerpColors(warmAmber, hotAmber, Math.min(1, heat * 0.75));
      mat.color.lerpColors(coldColor, warmAmber, Math.min(1, heat * 0.6));
      totalGlow += heat;
    }
    if (t >= RAIL_FIRE_TIME && t < RAIL_FIRE_TIME + 0.45) {
      const ft = (t - RAIL_FIRE_TIME) / 0.45;
      recoilZ = -0.045 * Math.sin(ft * Math.PI) * Math.exp(-ft * 3.5);
    }
    root.position.z = recoilZ;
    glowLight.intensity = (totalGlow / stageCount) * 1.4;
    const avg = totalGlow / stageCount;
    return { heat: Math.min(1, avg), firing: t >= RAIL_FIRE_TIME && t < RAIL_FIRE_TIME + 0.35 };
  };
  ud.setExtension = (charge01) => {
    const c = Math.max(0, Math.min(1, charge01));
    applyStageHeat(c);
    root.position.z = 0;
    glowLight.intensity = c * 1.4;
    return c;
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
