import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'kls10',
  code: 'КЛС-10',
  title: 'КЛС-10 «Гиперион»',
  subtitle: 'ТЯЖЁЛЫЙ ЛУЧЕВОЙ ИЗЛУЧАТЕЛЬ • СЛОТ HEAVY • ЦИКЛ 7.0 С',
  description: 'Тяжёлый лучевой излучатель: фланец УСП, цилиндрический резонатор 0.85 м с теплообменниками и медными контурами, клапаны сброса тепла и фокусирующая головка с линзой 0.45 м и коллиматорами. Цикл 7 с: накачка → импульс → сброс тепла → закрытие.',
  specs: [
    ['Тип', 'Лучевой излучатель'],
    ['Слот', 'HEAVY'],
    ['Цикл', '7.0 с'],
    ['Линза', '0.45 м'],
    ['Клапаны сброса', '8 створок'],
    ['Длина модуля', '~3.7 м'],
  ],
  maxExtension: 7.0,
  unit: 's',
  tipOffset: 2.95,
  subgroups: [
    { key: 'mountFlange', label: '1. Усиленный фланец УСП' },
    { key: 'resonatorDrum', label: '2. Цилиндрический резонатор' },
    { key: 'ventFlaps', label: '3. Клапаны сброса тепла' },
    { key: 'focusingHead', label: '4. Фокусирующая головка' },
  ],
  cameras: {
    module: { pos: [3.4, 2.15, 4.35], target: [0, 0.52, 1.05] },
  },
  rangeMarkers: [],
  controls: 'hyper',
};

const HYPER_CYCLE = 7.0;

/**
 * Создаёт процедурную 3D-модель тяжёлого лучевого излучателя КЛС-10 «Гиперион» (слот HEAVY).
 * Масштаб: 1 unit = 1 метр.
 * Ориентация: ось ствола +Z, верх +Y, правый борт +X.
 * Точка привязки (0, 0, 0): геометрический центр плиты УСП стыковочного узла.
 * Общая длина: ~3.70 м (от z = -0.75 м до z = +2.95 м), диаметр кожуха: 0.85 м.
 *
 * @returns {THREE.Group}
 */
export function createWeaponKLS10Hyperion() {
  const root = new THREE.Group();
  root.name = 'KLS10_Hyperion';

  // ============================================================================
  // 1. ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (CanvasTexture)
  // ============================================================================

  // Текстура предупреждающей разметки УСП (чёрно-жёлтые полосы, трафареты, потёртости)
  function createFlangeWarningTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Базовый цвет тёмной оружейной стали
    ctx.fillStyle = '#33383d';
    ctx.fillRect(0, 0, 1024, 1024);

    // Полосы предупреждающей разметки по левому и правому краям плиты
    const stripeZones = [
      { x: 0, w: 150 },
      { x: 874, w: 150 }
    ];

    for (const zone of stripeZones) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(zone.x, 0, zone.w, 1024);
      ctx.clip();

      ctx.fillStyle = '#d4961a';
      ctx.fillRect(zone.x, 0, zone.w, 1024);

      ctx.fillStyle = '#181a1c';
      const step = 64;
      for (let y = -256; y < 1280; y += step) {
        ctx.beginPath();
        ctx.moveTo(zone.x - 20, y);
        ctx.lineTo(zone.x + zone.w + 20, y + 90);
        ctx.lineTo(zone.x + zone.w + 20, y + 90 + step * 0.52);
        ctx.lineTo(zone.x - 20, y + step * 0.52);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Контрастная разделительная кайма
      ctx.fillStyle = '#141618';
      ctx.fillRect(zone.x === 0 ? zone.w : zone.x - 10, 0, 10, 1024);
    }

    // Координатная сетка Т-пазов УСП в центральной части
    ctx.strokeStyle = '#1f2326';
    ctx.lineWidth = 6;
    for (let x = 220; x <= 804; x += 97) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, 1004);
      ctx.stroke();
    }
    for (let y = 64; y <= 960; y += 128) {
      ctx.beginPath();
      ctx.moveTo(170, y);
      ctx.lineTo(854, y);
      ctx.stroke();
    }

    // Советская техническая трафаретная маркировка
    ctx.fillStyle = '#cfd4d8';
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('УСП-10Т // СТЫК ТЯЖ.', 512, 110);
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = '#d4961a';
    ctx.fillText('КЛС-10 «ГИПЕРИОН»', 512, 935);

    // Имитация копоти, царапин и масляных пятен
    for (let i = 0; i < 450; i++) {
      const rx = Math.random() * 1024;
      const ry = Math.random() * 1024;
      const r = 2 + Math.random() * 18;
      ctx.fillStyle =
        Math.random() > 0.45
          ? `rgba(18, 20, 22, ${0.06 + Math.random() * 0.14})`
          : `rgba(165, 172, 178, ${0.04 + Math.random() * 0.08})`;
      ctx.beginPath();
      ctx.arc(rx, ry, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // Процедурная текстура копоти, сварных швов и заводской маркировки для корпуса резонатора
  function createResonatorSurfaceTextures() {
    const size = 1024;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const cCtx = colorCanvas.getContext('2d');

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d');

    // Нейтральный белый фон для умножения на базовый color материала (#5e646a)
    cCtx.fillStyle = '#ffffff';
    cCtx.fillRect(0, 0, size, size);

    // Базовая шероховатость ~0.55 (140 / 255)
    rCtx.fillStyle = 'rgb(142, 142, 142)';
    rCtx.fillRect(0, 0, size, size);

    // Продольные и кольцевые технологические швы обшивки
    cCtx.strokeStyle = 'rgba(40, 44, 48, 0.45)';
    cCtx.lineWidth = 4;
    rCtx.strokeStyle = 'rgb(205, 205, 205)';
    rCtx.lineWidth = 5;

    for (let i = 1; i < 6; i++) {
      const y = (size / 6) * i;
      cCtx.beginPath();
      cCtx.moveTo(0, y);
      cCtx.lineTo(size, y);
      cCtx.stroke();

      rCtx.beginPath();
      rCtx.moveTo(0, y);
      rCtx.lineTo(size, y);
      rCtx.stroke();
    }

    for (let i = 0; i < 4; i++) {
      const x = (size / 4) * i + 64;
      cCtx.beginPath();
      cCtx.moveTo(x, 0);
      cCtx.lineTo(x, size);
      cCtx.stroke();
    }

    // Пятна нагара, копоти и потёки технической жидкости
    for (let i = 0; i < 650; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const rad = 4 + Math.random() * 28;
      const dark = 185 + Math.floor(Math.random() * 65);
      cCtx.fillStyle = `rgba(${dark}, ${dark}, ${dark}, 0.16)`;
      cCtx.beginPath();
      cCtx.arc(x, y, rad, 0, Math.PI * 2);
      cCtx.fill();

      const rVal = 115 + Math.floor(Math.random() * 85);
      rCtx.fillStyle = `rgba(${rVal}, ${rVal}, ${rVal}, 0.22)`;
      rCtx.beginPath();
      rCtx.arc(x, y, rad, 0, Math.PI * 2);
      rCtx.fill();
    }

    // Бортовой трафарет «КЛС-10» на левом и правом бортах цилиндра
    const drawStencil = (cx, cy) => {
      cCtx.save();
      cCtx.translate(cx, cy);
      cCtx.rotate(-Math.PI / 2);
      cCtx.fillStyle = 'rgba(235, 232, 220, 0.78)';
      cCtx.font = 'bold 42px monospace';
      cCtx.textAlign = 'center';
      cCtx.fillText('КЛС-10', 0, 0);
      cCtx.font = 'bold 20px monospace';
      cCtx.fillStyle = 'rgba(225, 165, 45, 0.85)';
      cCtx.fillText('ОПАСНО • ЛАЗЕР', 0, 28);
      cCtx.restore();
    };
    drawStencil(size * 0.25, size * 0.52);
    drawStencil(size * 0.75, size * 0.52);

    const map = new THREE.CanvasTexture(colorCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.anisotropy = 8;

    return { map, roughnessMap };
  }

  const flangeWarningTex = createFlangeWarningTexture();
  const resonatorTextures = createResonatorSurfaceTextures();

  // ============================================================================
  // 2. PBR-МАТЕРИАЛЫ (строго по спецификации)
  // ============================================================================

  // Корпус резонатора: серо-стальной грунт с копотью
  const matResonatorBody = new THREE.MeshStandardMaterial({
    color: 0x5e646a,
    metalness: 0.55,
    roughness: 0.55,
    map: resonatorTextures.map,
    roughnessMap: resonatorTextures.roughnessMap,
    bumpMap: resonatorTextures.roughnessMap,
    bumpScale: 0.004
  });

  // Бандажные кольца и бленда: тёмный графит
  const matGraphite = new THREE.MeshStandardMaterial({
    color: 0x282c30,
    metalness: 0.8,
    roughness: 0.4
  });

  // Плита УСП с предупреждающей разметкой
  const matFlangeTop = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: flangeWarningTex,
    metalness: 0.65,
    roughness: 0.48
  });

  // Трубки охлаждения: медь
  const matCopper = new THREE.MeshStandardMaterial({
    color: 0x9c6b3b,
    metalness: 0.85,
    roughness: 0.35
  });

  // Оксидированная сталь / крепёж / рычаги замков
  const matSteelBolt = new THREE.MeshStandardMaterial({
    color: 0x454a50,
    metalness: 0.85,
    roughness: 0.32
  });

  const matLockLever = new THREE.MeshStandardMaterial({
    color: 0x8f291d,
    metalness: 0.45,
    roughness: 0.45
  });

  // Радиаторный теплообменник внутри клапанов сброса тепла (с управляемым накалом)
  const matHeatCore = new THREE.MeshStandardMaterial({
    color: 0x4a2518,
    emissive: new THREE.Color(0xff3b0a),
    emissiveIntensity: 0.12,
    metalness: 0.75,
    roughness: 0.35
  });

  // Главная линза: глубокий янтарно-рубиновый оптический кристалл
  const matMainLens = new THREE.MeshPhysicalMaterial({
    color: 0x6b1d14,
    roughness: 0.08,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    ior: 1.76,
    reflectivity: 1.0,
    emissive: new THREE.Color(0x4d1008),
    emissiveIntensity: 0.35
  });

  // Оптическая камера за линзой
  const matOpticChamber = new THREE.MeshStandardMaterial({
    color: 0x120908,
    metalness: 0.9,
    roughness: 0.25
  });

  // Вспомогательная функция включения теней
  function enableShadows(obj) {
    obj.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  // ============================================================================
  // 3. УЗЕЛ 1: УСИЛЕННЫЙ СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange)
  // ============================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Основная плита УСП: 0.70 x 0.16 x 1.15 м с центром строго в (0, 0, 0)
  const flangeW = 0.70;
  const flangeH = 0.16;
  const flangeL = 1.15;

  const flangeMaterials = [
    matGraphite, // +X
    matGraphite, // -X
    matFlangeTop, // +Y (верх с предупреждающей разметкой)
    matFlangeTop, // -Y (низ с предупреждающей разметкой)
    matGraphite, // +Z
    matGraphite // -Z
  ];
  const flangePlate = new THREE.Mesh(
    new THREE.BoxGeometry(flangeW, flangeH, flangeL),
    flangeMaterials
  );
  flangePlate.name = 'uspBasePlate';
  mountFlange.add(flangePlate);

  // Нижняя центрирующая шпонка УСП (на стыковочной плоскости y = -0.08)
  const keywayBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.03, 0.96),
    matGraphite
  );
  keywayBar.position.set(0, -flangeH * 0.5 - 0.015, 0);
  mountFlange.add(keywayBar);

  // Усиленные продольные направляющие рельсы по бокам плиты
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, flangeH + 0.016, flangeL - 0.04),
      matGraphite
    );
    rail.position.set(side * (flangeW * 0.5 - 0.015), 0.004, 0);
    mountFlange.add(rail);
  }

  // 6 силовых механических замков стыковки (по 3 на левом и правом бортах плиты)
  const lockZPositions = [-0.38, 0.0, 0.38];
  for (const side of [-1, 1]) {
    for (let i = 0; i < lockZPositions.length; i++) {
      const zPos = lockZPositions[i];
      const lockGroup = new THREE.Group();
      lockGroup.name = `uspLock_${side > 0 ? 'R' : 'L'}_${i + 1}`;
      lockGroup.position.set(side * (flangeW * 0.5 + 0.025), 0.0, zPos);

      // Корпус замка
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, 0.145, 0.16),
        matGraphite
      );
      lockGroup.add(housing);

      // Силовой зажимной крюк / кулачок снизу
      const jaw = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.06, 0.11),
        matSteelBolt
      );
      jaw.position.set(-side * 0.01, -0.085, 0);
      lockGroup.add(jaw);

      // Ось эксцентрика
      const pinGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.19, 12);
      pinGeo.rotateX(Math.PI / 2);
      const pin = new THREE.Mesh(pinGeo, matSteelBolt);
      pin.position.set(side * 0.018, 0.01, 0);
      lockGroup.add(pin);

      // Стопорный рычаг с рукояткой
      const lever = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.11, 0.024),
        matLockLever
      );
      lever.position.set(side * 0.045, 0.045, 0.035);
      lever.rotation.x = 0.28;
      lockGroup.add(lever);

      // Два крепёжных болта на корпусе замка
      for (const bz of [-0.045, 0.045]) {
        const boltGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.025, 6);
        boltGeo.rotateZ(Math.PI / 2);
        const bolt = new THREE.Mesh(boltGeo, matSteelBolt);
        bolt.position.set(side * 0.046, -0.025, bz);
        lockGroup.add(bolt);
      }

      mountFlange.add(lockGroup);
    }
  }

  // Ось цилиндрического резонатора расположена на высоте y = 0.58 м
  const axisY = 0.58;
  const drumRadius = 0.425; // диаметр 0.85 м

  // Два массивных литых ложемента (опорные стойки), связывающие плиту УСП (y = 0.08) с резонатором
  const saddleZPositions = [-0.30, 0.30];
  for (const sz of saddleZPositions) {
    const saddleGroup = new THREE.Group();
    saddleGroup.position.set(0, 0, sz);

    // Нижняя опорная подошва с болтами
    const baseFoot = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.04, 0.24),
      matGraphite
    );
    baseFoot.position.set(0, flangeH * 0.5 + 0.02, 0);
    saddleGroup.add(baseFoot);

    // Болты крепления подошвы к плите УСП
    for (const bx of [-0.23, -0.11, 0.11, 0.23]) {
      for (const bz of [-0.08, 0.08]) {
        const bolt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.013, 0.013, 0.022, 6),
          matSteelBolt
        );
        bolt.position.set(bx, flangeH * 0.5 + 0.045, bz);
        saddleGroup.add(bolt);
      }
    }

    // Седловая дуга охвата резонатора
    const cradleArcGeo = new THREE.CylinderGeometry(
      drumRadius + 0.032,
      drumRadius + 0.032,
      0.18,
      24,
      1,
      false,
      Math.PI * 0.62,
      Math.PI * 0.76
    );
    cradleArcGeo.rotateZ(Math.PI / 2);
    cradleArcGeo.rotateY(Math.PI / 2);
    const cradleArc = new THREE.Mesh(cradleArcGeo, matGraphite);
    cradleArc.position.set(0, axisY, 0);
    saddleGroup.add(cradleArc);

    // Вертикальные силовые косынки (рёбра жёсткости)
    for (const rx of [-0.21, -0.07, 0.07, 0.21]) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.22, 0.2),
        matResonatorBody
      );
      rib.position.set(rx, flangeH * 0.5 + 0.11, 0);
      saddleGroup.add(rib);
    }

    mountFlange.add(saddleGroup);
  }

  // ============================================================================
  // 4. УЗЕЛ 2: СИЛОВОЙ ЦИЛИНДРИЧЕСКИЙ РЕЗОНАТОР (resonatorDrum)
  // ============================================================================
  const resonatorDrum = new THREE.Group();
  resonatorDrum.name = 'resonatorDrum';
  root.add(resonatorDrum);

  const drumStartZ = -0.58;
  const drumEndZ = 2.55;
  const drumLength = drumEndZ - drumStartZ; // 3.13 м
  const drumCenterZ = (drumStartZ + drumEndZ) * 0.5;

  // Основной силовой цилиндр резонатора (D = 0.85 м, R = 0.425 м)
  const mainCylinderGeo = new THREE.CylinderGeometry(
    drumRadius,
    drumRadius,
    drumLength,
    48,
    1
  );
  mainCylinderGeo.rotateX(Math.PI / 2);
  const mainCylinder = new THREE.Mesh(mainCylinderGeo, matResonatorBody);
  mainCylinder.name = 'resonatorCoreCylinder';
  mainCylinder.position.set(0, axisY, drumCenterZ);
  resonatorDrum.add(mainCylinder);

  // Задний бронеколпак / казённик резонатора (z = -0.75 .. -0.58)
  const rearCapGeo = new THREE.CylinderGeometry(0.35, drumRadius, 0.17, 36);
  rearCapGeo.rotateX(Math.PI / 2);
  const rearCap = new THREE.Mesh(rearCapGeo, matGraphite);
  rearCap.position.set(0, axisY, -0.665);
  resonatorDrum.add(rearCap);

  // Задний коллекторный блок охлаждения и ввод силовых кабелей
  const rearManifold = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.26, 0.12),
    matGraphite
  );
  rearManifold.position.set(0, axisY - 0.1, -0.73);
  resonatorDrum.add(rearManifold);

  // Два толстых бронированных силовых кабеля питания сзади
  for (const side of [-1, 1]) {
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.14, axisY - 0.16, -0.76),
      new THREE.Vector3(side * 0.19, axisY - 0.34, -0.74),
      new THREE.Vector3(side * 0.22, 0.14, -0.56),
      new THREE.Vector3(side * 0.22, 0.11, -0.35)
    ]);
    const cableGeo = new THREE.TubeGeometry(cableCurve, 20, 0.026, 10, false);
    const cable = new THREE.Mesh(cableGeo, matGraphite);
    resonatorDrum.add(cable);

    // Латунный/медный гермоввод
    const glandGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.05, 12);
    glandGeo.rotateX(Math.PI / 2);
    const gland = new THREE.Mesh(glandGeo, matCopper);
    gland.position.set(side * 0.14, axisY - 0.16, -0.76);
    resonatorDrum.add(gland);
  }

  // Мощные бандажные кольца (5 шт.) с болтовыми стяжками и рым-болтами
  const ringZPositions = [-0.52, 0.16, 0.94, 1.72, 2.48];
  const ringOuterR = drumRadius + 0.026;
  const ringWidth = 0.088;

  for (let rIdx = 0; rIdx < ringZPositions.length; rIdx++) {
    const rz = ringZPositions[rIdx];
    const ringGroup = new THREE.Group();
    ringGroup.position.set(0, axisY, rz);

    // Основное кольцо
    const ringGeo = new THREE.CylinderGeometry(
      ringOuterR,
      ringOuterR,
      ringWidth,
      48
    );
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, matGraphite);
    ringGroup.add(ringMesh);

    // Усиленные стяжные замки бандажа по бокам (±X)
    for (const side of [-1, 1]) {
      const clampLug = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.11, ringWidth + 0.015),
        matGraphite
      );
      clampLug.position.set(side * (ringOuterR + 0.015), 0, 0);
      ringGroup.add(clampLug);

      const tieBolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.15, 8),
        matSteelBolt
      );
      tieBolt.position.set(side * (ringOuterR + 0.022), 0, 0);
      ringGroup.add(tieBolt);
    }

    // 16 радиальных болтов по периметру бандажного кольца
    const boltCount = 16;
    for (let b = 0; b < boltCount; b++) {
      const ang = (b / boltCount) * Math.PI * 2;
      // Пропускаем верхнюю зону, где расположен короб клапанов сброса пара
      if (Math.sin(ang) > 0.88 && rz > 0.2 && rz < 2.2) continue;

      const bMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.018, 6),
        matSteelBolt
      );
      bMesh.position.set(
        Math.cos(ang) * (ringOuterR + 0.005),
        Math.sin(ang) * (ringOuterR + 0.005),
        0
      );
      bMesh.rotation.z = ang - Math.PI / 2;
      ringGroup.add(bMesh);
    }

    // Такелажные рым-болты на крайних кольцах
    if (rIdx === 0 || rIdx === ringZPositions.length - 1) {
      for (const side of [-1, 1]) {
        const lugAng = Math.PI * 0.5 + side * 0.42;
        const eyeTorus = new THREE.Mesh(
          new THREE.TorusGeometry(0.028, 0.009, 8, 16),
          matSteelBolt
        );
        eyeTorus.position.set(
          Math.cos(lugAng) * (ringOuterR + 0.025),
          Math.sin(lugAng) * (ringOuterR + 0.025),
          0
        );
        eyeTorus.rotation.y = Math.PI / 2;
        ringGroup.add(eyeTorus);
      }
    }

    resonatorDrum.add(ringGroup);
  }

  // Два цилиндрических теплообменника по бокам (±X)
  const hexX = 0.545;
  const hexY = axisY - 0.06;
  const hexStartZ = 0.22;
  const hexEndZ = 2.02;
  const hexLength = hexEndZ - hexStartZ; // 1.80 м
  const hexCenterZ = (hexStartZ + hexEndZ) * 0.5;

  for (const side of [-1, 1]) {
    const hexGroup = new THREE.Group();
    hexGroup.name = `heatExchanger_${side > 0 ? 'R' : 'L'}`;
    hexGroup.position.set(side * hexX, hexY, hexCenterZ);

    // Внутренний сердечник теплообменника
    const coreGeo = new THREE.CylinderGeometry(0.088, 0.088, hexLength, 24);
    coreGeo.rotateX(Math.PI / 2);
    const coreMesh = new THREE.Mesh(coreGeo, matResonatorBody);
    hexGroup.add(coreMesh);

    // Оребрение радиатора (30 охлаждающих дисков)
    const finCount = 30;
    const finGeo = new THREE.CylinderGeometry(0.118, 0.118, 0.012, 24);
    finGeo.rotateX(Math.PI / 2);
    const finInstanced = new THREE.InstancedMesh(
      finGeo,
      matGraphite,
      finCount
    );
    const dummy = new THREE.Object3D();
    for (let f = 0; f < finCount; f++) {
      const fz = -hexLength * 0.44 + (f / (finCount - 1)) * (hexLength * 0.88);
      dummy.position.set(0, 0, fz);
      dummy.updateMatrix();
      finInstanced.setMatrixAt(f, dummy.matrix);
    }
    finInstanced.instanceMatrix.needsUpdate = true;
    hexGroup.add(finInstanced);

    // Передний и задний торцевые коллекторы теплообменника
    for (const endDir of [-1, 1]) {
      const capGeo = new THREE.CylinderGeometry(0.112, 0.122, 0.09, 24);
      capGeo.rotateX(Math.PI / 2);
      const cap = new THREE.Mesh(capGeo, matGraphite);
      cap.position.set(0, 0, endDir * (hexLength * 0.5 + 0.04));
      hexGroup.add(cap);
    }

    // Защитная перфорированная продольная шина снаружи
    const guardBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.09, hexLength - 0.08),
      matResonatorBody
    );
    guardBar.position.set(side * 0.122, 0, 0);
    hexGroup.add(guardBar);

    // 3 силовых кронштейна крепления теплообменника к корпусу резонатора
    for (const bz of [-0.62, 0.0, 0.62]) {
      const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.065, 0.075),
        matGraphite
      );
      bracket.position.set(-side * 0.075, 0.03, bz);
      bracket.rotation.z = -side * 0.25;
      hexGroup.add(bracket);
    }

    resonatorDrum.add(hexGroup);
  }

  // Открытые медные трубки жидкостного охлаждения (по левому и правому бортам)
  function addCopperPipe(points, radius = 0.017) {
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, 36, radius, 12, false);
    const tubeMesh = new THREE.Mesh(tubeGeo, matCopper);
    resonatorDrum.add(tubeMesh);

    // Муфты-фитинги на концах трубки
    for (const idx of [0, points.length - 1]) {
      const pt = points[idx];
      const tangent = curve.getTangent(idx === 0 ? 0 : 1);
      const fitting = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.48, radius * 1.48, 0.038, 10),
        matGraphite
      );
      fitting.position.copy(pt);
      fitting.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      resonatorDrum.add(fitting);
    }
  }

  for (const side of [-1, 1]) {
    // 1. Подающая магистраль от заднего коллектора в теплообменник
    addCopperPipe([
      new THREE.Vector3(side * 0.22, axisY - 0.08, -0.71),
      new THREE.Vector3(side * 0.43, axisY - 0.16, -0.58),
      new THREE.Vector3(side * 0.46, axisY - 0.21, -0.15),
      new THREE.Vector3(side * 0.52, hexY - 0.03, 0.08),
      new THREE.Vector3(side * 0.545, hexY, hexStartZ - 0.07)
    ]);

    // 2. Отводящая магистраль из теплообменника в охлаждающую рубашку фокусирующего узла
    addCopperPipe([
      new THREE.Vector3(side * 0.545, hexY, hexEndZ + 0.07),
      new THREE.Vector3(side * 0.51, hexY + 0.04, 2.24),
      new THREE.Vector3(side * 0.44, axisY + 0.06, 2.42),
      new THREE.Vector3(side * 0.37, axisY + 0.12, 2.57)
    ]);

    // 3. Верхний контур отвода тепла от резонатора в теплообменник
    addCopperPipe(
      [
        new THREE.Vector3(side * 0.24, axisY + 0.36, 0.45),
        new THREE.Vector3(side * 0.41, axisY + 0.24, 0.55),
        new THREE.Vector3(side * 0.53, hexY + 0.11, 0.72),
        new THREE.Vector3(side * 0.53, hexY + 0.11, 1.55),
        new THREE.Vector3(side * 0.41, axisY + 0.24, 1.75),
        new THREE.Vector3(side * 0.24, axisY + 0.36, 1.88)
      ],
      0.013
    );
  }

  // ============================================================================
  // 4.1. ПОДУЗЕЛ КЛАПАНОВ СБРОСА ПАРА / ТЕПЛА (ventFlaps)
  // ============================================================================
  const ventFlaps = new THREE.Group();
  ventFlaps.name = 'ventFlaps';
  resonatorDrum.add(ventFlaps);

  const ventBaseY = axisY + drumRadius - 0.025; // ~0.98 м
  const ventStartZ = 0.38;
  const ventEndZ = 2.18;
  const ventLength = ventEndZ - ventStartZ; // 1.80 м
  const ventCenterZ = (ventStartZ + ventEndZ) / 2;
  const ventWidth = 0.34;

  // Бронированный короб газоотводного канала сверху резонатора
  const ventFrame = new THREE.Mesh(
    new THREE.BoxGeometry(ventWidth + 0.05, 0.075, ventLength + 0.08),
    matGraphite
  );
  ventFrame.position.set(0, ventBaseY + 0.02, ventCenterZ);
  ventFlaps.add(ventFrame);

  // Внутренний раскалённый теплообменный пакет (виден при открытии створок)
  const coreBlock = new THREE.Mesh(
    new THREE.BoxGeometry(ventWidth - 0.04, 0.045, ventLength - 0.04),
    matHeatCore
  );
  coreBlock.position.set(0, ventBaseY + 0.032, ventCenterZ);
  ventFlaps.add(coreBlock);

  // Поперечные раскалённые пластины радиатора внутри шахты
  const radiatorBladeCount = 22;
  for (let i = 0; i < radiatorBladeCount; i++) {
    const bz =
      ventStartZ +
      0.06 +
      (i / (radiatorBladeCount - 1)) * (ventLength - 0.12);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(ventWidth - 0.03, 0.055, 0.014),
      matHeatCore
    );
    blade.position.set(0, ventBaseY + 0.036, bz);
    ventFlaps.add(blade);
  }

  // Центральная продольная перемычка-упор для створок
  const spineDivider = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, 0.078, ventLength + 0.06),
    matGraphite
  );
  spineDivider.position.set(0, ventBaseY + 0.035, ventCenterZ);
  ventFlaps.add(spineDivider);

  // 8 шарнирных бронестворок клапанов сброса тепла (4 секции x левая/правая створки)
  const sectionCount = 4;
  const flapLength = (ventLength - 0.08) / sectionCount - 0.02;
  const flapWidth = ventWidth * 0.5 - 0.015;
  const flapPivots = [];

  for (let s = 0; s < sectionCount; s++) {
    const sz =
      ventStartZ +
      0.04 +
      (s + 0.5) * ((ventLength - 0.08) / sectionCount);

    for (const side of [-1, 1]) {
      // Шарнирная группа с точкой вращения строго на внешней петле
      const hingePivot = new THREE.Group();
      hingePivot.name = `ventFlapPivot_${s + 1}_${side > 0 ? 'R' : 'L'}`;
      hingePivot.position.set(
        side * (ventWidth * 0.5 + 0.01),
        ventBaseY + 0.062,
        sz
      );
      hingePivot.userData.side = side;

      // Цилиндрический шарнир петли
      const hingePinGeo = new THREE.CylinderGeometry(
        0.012,
        0.012,
        flapLength * 0.85,
        10
      );
      hingePinGeo.rotateX(Math.PI / 2);
      const hingePin = new THREE.Mesh(hingePinGeo, matSteelBolt);
      hingePivot.add(hingePin);

      // Бронекрышка клапана (смещена внутрь к оси симметрии от шарнира)
      const flapPlate = new THREE.Mesh(
        new THREE.BoxGeometry(flapWidth, 0.024, flapLength),
        matResonatorBody
      );
      flapPlate.position.set(-side * (flapWidth * 0.5), 0.008, 0);
      hingePivot.add(flapPlate);

      // Силовая накладка жёсткости сверху створки
      const stiffener = new THREE.Mesh(
        new THREE.BoxGeometry(flapWidth * 0.72, 0.014, flapLength * 0.65),
        matGraphite
      );
      stiffener.position.set(-side * (flapWidth * 0.5), 0.024, 0);
      hingePivot.add(stiffener);

      ventFlaps.add(hingePivot);
      flapPivots.push(hingePivot);
    }
  }

  // ============================================================================
  // 5. УЗЕЛ 3: ФОКУСИРУЮЩИЙ УЗЕЛ И ЗАЩИТНАЯ ТУРЕЛЬ-БЛЕНДА (focusingHead)
  // ============================================================================
  const focusingHead = new THREE.Group();
  focusingHead.name = 'focusingHead';
  focusingHead.position.set(0, axisY, 2.6); // Базовая плоскость стыка на z = 2.6 м
  root.add(focusingHead);

  // Ступень 1: стыковочный фланец фокусирующего модуля (z_local = -0.05 .. +0.03)
  const headFlangeGeo = new THREE.CylinderGeometry(0.455, 0.455, 0.08, 48);
  headFlangeGeo.rotateX(Math.PI / 2);
  const headFlange = new THREE.Mesh(headFlangeGeo, matGraphite);
  headFlange.position.set(0, 0, -0.01);
  focusingHead.add(headFlange);

  // Ступень 2: массивный бронекожух оптического блока (z_local = +0.03 .. +0.16)
  const stepTwoGeo = new THREE.CylinderGeometry(0.415, 0.44, 0.13, 36);
  stepTwoGeo.rotateX(Math.PI / 2);
  const stepTwo = new THREE.Mesh(stepTwoGeo, matResonatorBody);
  stepTwo.position.set(0, 0, 0.095);
  focusingHead.add(stepTwo);

  // Ступень 3: передний ступенчатый раструб-бленда (z_local = +0.16 .. +0.29)
  const shroudOuterR = 0.385;
  const shroudInnerR = 0.255;
  const shroudDepth = 0.13;

  // Создаём полый ступенчатый раструб через LatheGeometry
  const shroudProfile = [
    new THREE.Vector2(shroudInnerR, 0.14),
    new THREE.Vector2(shroudOuterR + 0.025, 0.14),
    new THREE.Vector2(shroudOuterR + 0.025, 0.21),
    new THREE.Vector2(shroudOuterR, 0.22),
    new THREE.Vector2(shroudOuterR, 0.16 + shroudDepth),
    new THREE.Vector2(shroudInnerR + 0.022, 0.16 + shroudDepth),
    new THREE.Vector2(shroudInnerR, 0.19)
  ];
  const shroudGeo = new THREE.LatheGeometry(shroudProfile, 48);
  shroudGeo.rotateX(Math.PI / 2);
  const shroudMesh = new THREE.Mesh(shroudGeo, matGraphite);
  focusingHead.add(shroudMesh);

  // Верхний бронекозырёк бленды (защита от осадков и осколков сверху)
  const visorGeo = new THREE.CylinderGeometry(
    shroudOuterR + 0.018,
    shroudOuterR + 0.018,
    0.09,
    36,
    1,
    true,
    -Math.PI * 0.36,
    Math.PI * 0.72
  );
  visorGeo.rotateX(Math.PI / 2);
  visorGeo.rotateZ(Math.PI / 2);
  const visorMat = matGraphite.clone();
  visorMat.side = THREE.DoubleSide;
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0, 0.295);
  focusingHead.add(visor);

  // Огромная центральная фокусирующая линза диаметром 0.45 м (R = 0.225 м)
  const mainLensRadius = 0.225;

  // Оправа главной линзы
  const lensBezel = new THREE.Mesh(
    new THREE.TorusGeometry(mainLensRadius + 0.016, 0.02, 16, 48),
    matGraphite
  );
  lensBezel.position.set(0, 0, 0.165);
  focusingHead.add(lensBezel);

  // Внутренняя тёмная оптическая шахта за линзой
  const opticBackGeo = new THREE.CylinderGeometry(
    mainLensRadius,
    mainLensRadius * 0.85,
    0.08,
    36
  );
  opticBackGeo.rotateX(Math.PI / 2);
  const opticBack = new THREE.Mesh(opticBackGeo, matOpticChamber);
  opticBack.position.set(0, 0, 0.115);
  focusingHead.add(opticBack);

  // Выпуклый оптический кристалл линзы (точный диаметр 0.45 м)
  const lensPts = [];
  const lensSegments = 24;
  for (let i = 0; i <= lensSegments; i++) {
    const t = i / lensSegments;
    const r = t * mainLensRadius;
    const sag = Math.cos(t * Math.PI * 0.5) * 0.048;
    lensPts.push(new THREE.Vector2(r, sag));
  }
  const mainLensGeo = new THREE.LatheGeometry(lensPts, 48);
  mainLensGeo.rotateX(Math.PI / 2);
  const mainLens = new THREE.Mesh(mainLensGeo, matMainLens);
  mainLens.name = 'mainFocusingLens';
  mainLens.position.set(0, 0, 0.16);
  focusingHead.add(mainLens);

  // 12 прижимных винтов по окружности оправы главной линзы
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const clampBolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.016, 6),
      matSteelBolt
    );
    clampBolt.rotation.x = Math.PI / 2;
    clampBolt.position.set(
      Math.cos(a) * (mainLensRadius + 0.016),
      Math.sin(a) * (mainLensRadius + 0.016),
      0.182
    );
    focusingHead.add(clampBolt);
  }

  // 3 малых юстировочных коллиматора вокруг главной линзы (под углами 90°, 210°, 330°)
  const collimatorAngles = [
    Math.PI * 0.5, // Верх (12 часов)
    (Math.PI * 7) / 6, // Низ-лево (7 часов)
    (Math.PI * 11) / 6 // Низ-право (5 часов)
  ];
  const collimatorOrbitR = 0.322;

  for (let c = 0; c < collimatorAngles.length; c++) {
    const ang = collimatorAngles[c];
    const cx = Math.cos(ang) * collimatorOrbitR;
    const cy = Math.sin(ang) * collimatorOrbitR;

    const collGroup = new THREE.Group();
    collGroup.name = `alignmentCollimator_${c + 1}`;
    collGroup.position.set(cx, cy, 0.14);

    // Тубус коллиматора
    const barrelGeo = new THREE.CylinderGeometry(0.044, 0.048, 0.22, 24);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, matGraphite);
    barrel.position.set(0, 0, 0.04);
    collGroup.add(barrel);

    // Передняя защитная бленда коллиматора
    const hoodGeo = new THREE.CylinderGeometry(0.047, 0.047, 0.045, 24, 1, true);
    hoodGeo.rotateX(Math.PI / 2);
    const hoodMat = matGraphite.clone();
    hoodMat.side = THREE.DoubleSide;
    const hood = new THREE.Mesh(hoodGeo, hoodMat);
    hood.position.set(0, 0, 0.165);
    collGroup.add(hood);

    // Малая оптическая линза коллиматора
    const miniLensGeo = new THREE.SphereGeometry(
      0.034,
      20,
      12,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.35
    );
    miniLensGeo.rotateX(Math.PI / 2);
    const miniLens = new THREE.Mesh(miniLensGeo, matMainLens);
    miniLens.position.set(0, 0, 0.125);
    collGroup.add(miniLens);

    // Микрометрические юстировочные винты (2 ортогональных барабанчика)
    for (const screwAng of [ang + 0.35, ang - 0.35]) {
      const screw = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.011, 0.036, 10),
        matCopper
      );
      screw.position.set(
        Math.cos(screwAng) * 0.052,
        Math.sin(screwAng) * 0.052,
        0.06
      );
      screw.rotation.z = screwAng - Math.PI / 2;
      collGroup.add(screw);
    }

    focusingHead.add(collGroup);
  }

  // Защитная решётчатая дуга-отбойник снизу фокусирующего узла
  const guardGroup = new THREE.Group();
  guardGroup.name = 'lowerProtectiveGrid';
  focusingHead.add(guardGroup);

  const arcRadiusOuter = 0.445;
  const arcRadiusInner = 0.365;
  const arcStart = -Math.PI * 0.86;
  const arcLength = Math.PI * 0.72; // симметричная дуга снизу (-155° .. -25°)

  // Внешняя вынесенная труба-отбойник (доводит общую длину модуля до ~3.70 м)
  const outerBarGeo = new THREE.TorusGeometry(
    arcRadiusOuter,
    0.019,
    12,
    36,
    arcLength
  );
  const outerBar = new THREE.Mesh(outerBarGeo, matGraphite);
  outerBar.rotation.z = arcStart;
  outerBar.position.set(0, -0.02, 0.33); // 2.60 + 0.33 + 0.02 = 2.95 м
  guardGroup.add(outerBar);

  // Внутренняя опорная дуга решётки
  const innerBarGeo = new THREE.TorusGeometry(
    arcRadiusInner,
    0.015,
    10,
    32,
    arcLength
  );
  const innerBar = new THREE.Mesh(innerBarGeo, matGraphite);
  innerBar.rotation.z = arcStart;
  innerBar.position.set(0, -0.01, 0.25);
  guardGroup.add(innerBar);

  // 7 силовых решётчатых перемычек (рёбер отбойника)
  const ribCount = 7;
  for (let r = 0; r < ribCount; r++) {
    const t = r / (ribCount - 1);
    const a = arcStart + t * arcLength;

    const pBack = new THREE.Vector3(
      Math.cos(a) * (arcRadiusInner + 0.01),
      Math.sin(a) * (arcRadiusInner + 0.01),
      0.13
    );
    const pMid = new THREE.Vector3(
      Math.cos(a) * arcRadiusInner,
      Math.sin(a) * arcRadiusInner - 0.01,
      0.25
    );
    const pFront = new THREE.Vector3(
      Math.cos(a) * arcRadiusOuter,
      Math.sin(a) * arcRadiusOuter - 0.02,
      0.33
    );

    const ribCurve = new THREE.CatmullRomCurve3([pBack, pMid, pFront]);
    const ribGeo = new THREE.TubeGeometry(ribCurve, 12, 0.013, 8, false);
    const ribMesh = new THREE.Mesh(ribGeo, matResonatorBody);
    guardGroup.add(ribMesh);
  }

  // Боковые силовые кронштейны крепления отбойника к корпусу бленды
  for (const endAng of [arcStart, arcStart + arcLength]) {
    const strutCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(
        Math.cos(endAng) * 0.39,
        Math.sin(endAng) * 0.39,
        0.08
      ),
      new THREE.Vector3(
        Math.cos(endAng) * arcRadiusOuter,
        Math.sin(endAng) * arcRadiusOuter - 0.02,
        0.33
      )
    ]);
    const strut = new THREE.Mesh(
      new THREE.TubeGeometry(strutCurve, 8, 0.018, 8, false),
      matGraphite
    );
    guardGroup.add(strut);
  }

  // Включаем тени на всей иерархии модели
  enableShadows(root);

  // Сохраняем удобные ссылки для анимации выстрела и сброса тепла
  root.userData = {
    mountFlange,
    resonatorDrum,
    ventFlaps,
    focusingHead,
    flapPivots,
    matHeatCore,
    matMainLens,
    muzzleLocalPos: new THREE.Vector3(0, axisY, 2.78)
  };

  return root;
}

// =========================================================================
// Адаптер под единый просмотрщик: цикл 7 с — накачка → импульс → сброс тепла.
// applyHyper(t): створки клапанов, луч, вспышка, накал. Возвращает инфо для телеметрии.
// =========================================================================
export function createWeapon() {
  const root = createWeaponKLS10Hyperion();
  const ud = root.userData;
  const pivots = ud.flapPivots;
  const heatMat = ud.matHeatCore;
  const lensMat = ud.matMainLens;

  const beamGroup = new THREE.Group();
  beamGroup.position.copy(ud.muzzleLocalPos);
  beamGroup.visible = false;
  root.add(beamGroup);

  const beamLen = 14.0;
  const beamGeo = new THREE.CylinderGeometry(0.055, 0.075, beamLen, 20, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  const beamCoreMat = new THREE.MeshBasicMaterial({
    color: 0xffb380,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beamCore = new THREE.Mesh(beamGeo, beamCoreMat);
  beamCore.position.z = beamLen * 0.5;
  beamGroup.add(beamCore);

  const haloGeo = new THREE.CylinderGeometry(0.16, 0.22, beamLen, 20, 1, true);
  haloGeo.rotateX(Math.PI / 2);
  const beamHaloMat = new THREE.MeshBasicMaterial({
    color: 0xd92b14,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beamHalo = new THREE.Mesh(haloGeo, beamHaloMat);
  beamHalo.position.z = beamLen * 0.5;
  beamGroup.add(beamHalo);

  const muzzleLight = new THREE.PointLight(0xff441a, 0, 8.0);
  muzzleLight.position.copy(ud.muzzleLocalPos).add(new THREE.Vector3(0, 0, 0.25));
  root.add(muzzleLight);

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

  ud.setFlaps = (open01) => {
    const a = Math.max(0, Math.min(1, open01)) * 0.84;
    for (const pivot of pivots) {
      pivot.rotation.z = -pivot.userData.side * a;
    }
  };

  ud.applyHyper = (t) => {
    let flap = 0, beam = 0, heat = 0.12, lens = 0.35, recoil = 0;
    if (t < 0.8) {
      const k = t / 0.8;
      lens = 0.35 + k * k * 2.2;
      heat = 0.12 + k * 0.6;
    } else if (t < 1.7) {
      const shotT = (t - 0.8) / 0.9;
      const flicker = 0.88 + Math.sin(t * 95) * 0.12;
      beam = flicker;
      lens = 4.2 * flicker;
      heat = 0.72 + shotT * 2.1;
      recoil = -0.055 * Math.exp(-shotT * 4.5) * Math.sin(Math.min(1, shotT * 6) * Math.PI * 0.5);
    } else if (t < 5.6) {
      const ventT = (t - 1.7) / 3.9;
      const openEase = Math.min(1, ventT * 4.5);
      flap = (1 - Math.pow(1 - openEase, 3)) * 0.84;
      heat = 2.8 * (1 - ventT * 0.72);
      lens = 0.35 + 1.4 * Math.exp(-ventT * 4.0);
    } else {
      const closeT = (t - 5.6) / 1.4;
      flap = (1 - closeT * closeT * (3 - 2 * closeT)) * 0.84;
      heat = 0.12 + (1 - closeT * closeT * (3 - 2 * closeT)) * 0.65;
      lens = 0.35;
    }
    for (const pivot of pivots) {
      pivot.rotation.z = -pivot.userData.side * flap;
    }
    heatMat.emissiveIntensity = heat;
    lensMat.emissiveIntensity = lens;
    beamGroup.visible = beam > 0.01;
    const fl = beam > 0.01 ? beam : 0;
    beamCore.scale.set(fl, fl, 1);
    beamHalo.scale.set(fl * 1.1, fl * 1.1, 1);
    muzzleLight.intensity = 16.0 * fl;
    root.position.z = recoil;
    return { flap: flap / 0.84, heat, lens, beam: fl };
  };

  ud.setExtension = (t) => {
    const info = ud.applyHyper(Math.max(0, Math.min(HYPER_CYCLE, t)));
    return info;
  };
  ud.setFlash = (k) => {
    muzzleLight.intensity = 16.0 * Math.max(0, Math.min(1, k));
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
