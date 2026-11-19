import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'a46m',
  code: '2А46М-5',
  title: '2А46М-5 «Молот»',
  subtitle: '125-ММ ТАНКОВАЯ ГЛАДКОСТВОЛЬНАЯ ПУШКА • СЛОТ MAIN • ОТКАТ 0.45 М',
  description: '125-мм танковая гладкоствольная пушка меха: фланец УСП с гидрозамками, бронированная люлька с казёнником и накатниками, откатной ствол 3.35 м с эжектором, термокожухом из 7 сегментов и датчиком УУИ. Выстрел каждые 3.2 с с дульной вспышкой.',
  specs: [
    ['Калибр', '125 мм, гладкоствольная'],
    ['Откат ствола', '0.45 м'],
    ['Темп', 'Выстрел / 3.2 с'],
    ['Слот', 'MAIN'],
    ['Длина модуля', '~3.80 м'],
    ['Оснащение', 'Эжектор, УУИ, ТЗК'],
  ],
  maxExtension: 0.45,
  unit: 'mm',
  tipOffset: 3.10,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел УСП' },
    { key: 'cradleBreech', label: '2. Люлька и казённик' },
    { key: 'barrelGroup', label: '3. Откатной ствол 125 мм' },
  ],
  cameras: {
    module: { pos: [2.8, 0.95, 2.7], target: [0, -0.32, 1.15] },
  },
  rangeMarkers: [],
  controls: 'cannon',
  cannon: {
    mode: 'single',
    shotPeriod: 3.2,
    recoilTime: 0.075,
    holdTime: 0.045,
    returnTime: 0.72,
    heatPerShot: 0.15,
    coolRate: 0.05,
  },
};

const MAX_RECOIL = 0.45;

/**
 * Создаёт процедурную текстуру жёлто-чёрной полосы опасности для фланца УСП.
 * @returns {THREE.CanvasTexture}
 */
function createHazardStripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Базовый индустриальный жёлтый фон
  ctx.fillStyle = '#d99b16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Диагональные чёрные полосы опасности
  ctx.fillStyle = '#16181a';
  const stripeWidth = 64;
  for (let x = -canvas.height; x < canvas.width + canvas.height; x += stripeWidth * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeWidth, 0);
    ctx.lineTo(x + stripeWidth - canvas.height, canvas.height);
    ctx.lineTo(x - canvas.height, canvas.height);
    ctx.closePath();
    ctx.fill();
  }

  // Тёмная окантовка по верхнему и нижнему краям
  ctx.fillStyle = '#1b1d20';
  ctx.fillRect(0, 0, canvas.width, 22);
  ctx.fillRect(0, canvas.height - 22, canvas.width, 22);

  // Лёгкий процедурный износ и потёртости краски
  for (let i = 0; i < 420; i++) {
    const rx = Math.random() * canvas.width;
    const ry = Math.random() * canvas.height;
    const rw = 4 + Math.random() * 28;
    const rh = 1 + Math.random() * 4;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(30, 33, 36, 0.28)' : 'rgba(255, 230, 150, 0.16)';
    ctx.fillRect(rx, ry, rw, rh);
  }

  // Технический трафарет УСП
  ctx.fillStyle = 'rgba(22, 24, 26, 0.9)';
  ctx.fillRect(360, 74, 304, 108);
  ctx.strokeStyle = '#d99b16';
  ctx.lineWidth = 4;
  ctx.strokeRect(366, 80, 292, 96);

  ctx.fillStyle = '#e5e7eb';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('УСП // 2А46М-5', 512, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Процедурная 3D-модель 125-мм танковой гладкоствольной пушки меха 2А46М-5 «Молот» (слот MAIN).
 * Система координат: 1 unit = 1 м, +Z — направление ствола, +Y — верх, +X — бок.
 * Точка привязки (0, 0, 0) — центр верхнего стыковочного фланца УСП.
 * Общая длина модуля: ~3.80 м (от z = -0.70 м до z = +3.10 м).
 *
 * @returns {THREE.Group}
 */
export function createWeapon2A46M5Molot() {
  const root = new THREE.Group();
  root.name = 'Weapon_2A46M5_Molot';

  // --- PBR Материалы ---
  const khakiMat = new THREE.MeshStandardMaterial({
    color: 0x4a5344,
    metalness: 0.40,
    roughness: 0.65,
  });

  const gunmetalMat = new THREE.MeshStandardMaterial({
    color: 0x26292e,
    metalness: 0.85,
    roughness: 0.35,
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x1c1e21,
    metalness: 0.05,
    roughness: 0.90,
  });

  const copperMat = new THREE.MeshStandardMaterial({
    color: 0x9c6b3b,
    metalness: 0.85,
    roughness: 0.35,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xc8cfd6,
    metalness: 0.95,
    roughness: 0.15,
  });

  const boreDarkMat = new THREE.MeshStandardMaterial({
    color: 0x0b0c0e,
    metalness: 0.2,
    roughness: 0.95,
  });

  const opticLensMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    emissive: 0x0a2540,
    emissiveIntensity: 0.6,
    metalness: 0.9,
    roughness: 0.1,
  });

  const hazardTexture = createHazardStripeTexture();
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTexture,
    metalness: 0.35,
    roughness: 0.55,
  });

  // =========================================================================
  // 1. СТЫКОВОЧНЫЙ УЗЕЛ УСП (mountFlange) — центр в (0, 0, 0)
  // =========================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Основная массивная стальная плита УСП: 0.55 x 0.14 x 0.95 м в (0, 0, 0)
  const plateGeo = new THREE.BoxGeometry(0.55, 0.14, 0.95);
  const plateMesh = new THREE.Mesh(plateGeo, gunmetalMat);
  plateMesh.position.set(0, 0, 0);
  mountFlange.add(plateMesh);

  // Верхний центрирующий шип / направляющий гребень УСП
  const topKeyGeo = new THREE.BoxGeometry(0.32, 0.03, 0.72);
  const topKeyMesh = new THREE.Mesh(topKeyGeo, khakiMat);
  topKeyMesh.position.set(0, 0.085, 0);
  mountFlange.add(topKeyMesh);

  // Боковые и торцевые накладки с жёлто-чёрной полосой опасности
  const sideHazardGeo = new THREE.BoxGeometry(0.008, 0.095, 0.90);
  for (const side of [-1, 1]) {
    const hazardStrip = new THREE.Mesh(sideHazardGeo, hazardMat);
    hazardStrip.position.set(side * (0.55 / 2 + 0.004), 0, 0);
    mountFlange.add(hazardStrip);
  }

  const endHazardGeo = new THREE.BoxGeometry(0.50, 0.095, 0.008);
  for (const end of [-1, 1]) {
    const endStrip = new THREE.Mesh(endHazardGeo, hazardMat);
    endStrip.position.set(0, 0, end * (0.95 / 2 + 0.004));
    mountFlange.add(endStrip);
  }

  // 4 гидрозамка по углам стыковочной плиты УСП
  const lockPositions = [
    [-0.215, 0.365],
    [0.215, 0.365],
    [-0.215, -0.365],
    [0.215, -0.365],
  ];

  const lockBodyGeo = new THREE.CylinderGeometry(0.044, 0.048, 0.19, 16);
  const lockCapGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.035, 6);
  const lockPinGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.05, 12);

  lockPositions.forEach(([lx, lz], idx) => {
    const lockGroup = new THREE.Group();
    lockGroup.name = `hydraulicLock_${idx + 1}`;
    lockGroup.position.set(lx, 0, lz);

    const body = new THREE.Mesh(lockBodyGeo, khakiMat);
    const cap = new THREE.Mesh(lockCapGeo, gunmetalMat);
    cap.position.y = 0.105;

    const pin = new THREE.Mesh(lockPinGeo, chromeMat);
    pin.position.y = 0.135;

    // Нижний штуцер подвода гидравлики
    const port = new THREE.Mesh(lockCapGeo, copperMat);
    port.position.y = -0.105;

    lockGroup.add(body, cap, pin, port);
    mountFlange.add(lockGroup);
  });

  // Силовой переходной пилон от нижней плоскости фланца (y = -0.07) к люльке (y = -0.18)
  const neckCore = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.13, 0.68), gunmetalMat);
  neckCore.position.set(0, -0.125, -0.10);
  mountFlange.add(neckCore);

  // Ребра жёсткости переходного пилона
  const ribGeo = new THREE.BoxGeometry(0.46, 0.11, 0.035);
  for (const rz of [-0.36, -0.16, 0.04, 0.20]) {
    const rib = new THREE.Mesh(ribGeo, khakiMat);
    rib.position.set(0, -0.125, rz);
    mountFlange.add(rib);
  }

  // =========================================================================
  // 2. БРОНИРОВАННАЯ ЛЮЛЬКА И КАЗЁННИК (cradleBreech)
  // =========================================================================
  const cradleBreech = new THREE.Group();
  cradleBreech.name = 'cradleBreech';
  root.add(cradleBreech);

  // Литой массивный бронекожух казённой части (центр в y = -0.32, z = -0.25)
  const breechMain = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.78), khakiMat);
  breechMain.position.set(0, -0.32, -0.25);
  cradleBreech.add(breechMain);

  // Скошенные верхние бронескулы литого корпуса
  const chamferGeo = new THREE.BoxGeometry(0.11, 0.11, 0.76);
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(chamferGeo, khakiMat);
    cheek.position.set(side * 0.20, -0.14, -0.25);
    cheek.rotation.z = side * (Math.PI / 4);
    cradleBreech.add(cheek);
  }

  // Задний массивный казённик и клиновой затвор (до z = -0.70 м)
  const breechRing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.36, 0.14), gunmetalMat);
  breechRing.position.set(0, -0.32, -0.61);
  cradleBreech.add(breechRing);

  // Верхний привод полуавтоматики клинового затвора
  const wedgeHousing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.18), gunmetalMat);
  wedgeHousing.position.set(0, -0.13, -0.58);
  cradleBreech.add(wedgeHousing);

  // Ограждение отката казённика / лоток выброса поддона (задний габарит z = -0.70)
  const guardRailGeo = new THREE.BoxGeometry(0.035, 0.26, 0.16);
  for (const side of [-1, 1]) {
    const guardSide = new THREE.Mesh(guardRailGeo, gunmetalMat);
    guardSide.position.set(side * 0.17, -0.33, -0.62);
    cradleBreech.add(guardSide);
  }
  const rearGuardPlate = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.05, 0.04), gunmetalMat);
  rearGuardPlate.position.set(0, -0.45, -0.68);
  cradleBreech.add(rearGuardPlate);

  // Передняя направляющая обойма люльки (z = 0.14 .. 0.40)
  const frontCradleTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.165, 0.185, 0.28, 24).rotateX(Math.PI / 2),
    khakiMat
  );
  frontCradleTube.position.set(0, -0.32, 0.26);
  cradleBreech.add(frontCradleTube);

  const muzzleCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.162, 0.168, 0.045, 24).rotateX(Math.PI / 2),
    gunmetalMat
  );
  muzzleCollar.position.set(0, -0.32, 0.40);
  cradleBreech.add(muzzleCollar);

  // Противокумулятивные накладки (блоки ДЗ / разнесённой брони по бортам и снизу)
  const eraSideGeo = new THREE.BoxGeometry(0.065, 0.26, 0.34);
  const eraBoltGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.075, 8).rotateZ(Math.PI / 2);

  for (const side of [-1, 1]) {
    for (const zPos of [-0.36, 0.02]) {
      const eraBlock = new THREE.Mesh(eraSideGeo, khakiMat);
      eraBlock.position.set(side * 0.258, -0.33, zPos);
      eraBlock.rotation.z = -side * 0.08;
      cradleBreech.add(eraBlock);

      // Крепёжные болты на накладках
      for (const bz of [-0.11, 0.11]) {
        for (const by of [-0.08, 0.08]) {
          const bolt = new THREE.Mesh(eraBoltGeo, gunmetalMat);
          bolt.position.set(side * 0.262, -0.33 + by, zPos + bz);
          cradleBreech.add(bolt);
        }
      }
    }
  }

  // Нижний противокумулятивный бронеблок люльки
  const lowerEra = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.065, 0.56), gunmetalMat);
  lowerEra.position.set(0, -0.545, -0.20);
  cradleBreech.add(lowerEra);

  // Два внешних гидроцилиндра накатников / тормозов отката (слева и справа сверху)
  const cylOuterGeo = new THREE.CylinderGeometry(0.056, 0.056, 0.72, 20).rotateX(Math.PI / 2);
  const cylCapGeo = new THREE.CylinderGeometry(0.064, 0.064, 0.045, 20).rotateX(Math.PI / 2);
  const cylBracketGeo = new THREE.BoxGeometry(0.13, 0.12, 0.07);
  const pistonRodGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.18, 16).rotateX(Math.PI / 2);

  for (const side of [-1, 1]) {
    const cx = side * 0.235;
    const cy = -0.165;

    const cylBody = new THREE.Mesh(cylOuterGeo, khakiMat);
    cylBody.position.set(cx, cy, -0.04);
    cradleBreech.add(cylBody);

    // Передняя и задняя крышки гидроцилиндра
    const frontCap = new THREE.Mesh(cylCapGeo, gunmetalMat);
    frontCap.position.set(cx, cy, 0.32);
    const rearCap = new THREE.Mesh(cylCapGeo, gunmetalMat);
    rearCap.position.set(cx, cy, -0.40);
    cradleBreech.add(frontCap, rearCap);

    // Хомуты-кронштейны крепления цилиндров к люльке
    for (const bz of [-0.28, 0.18]) {
      const bracket = new THREE.Mesh(cylBracketGeo, gunmetalMat);
      bracket.position.set(side * 0.205, cy - 0.015, bz);
      cradleBreech.add(bracket);
    }

    // Хромированный шток накатника спереди
    const rod = new THREE.Mesh(pistonRodGeo, chromeMat);
    rod.position.set(cx, cy, 0.39);
    cradleBreech.add(rod);
  }

  // Гидравлический распределительный коллектор под фланцем УСП
  const manifold = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.055, 0.12), gunmetalMat);
  manifold.position.set(0, -0.105, 0.18);
  cradleBreech.add(manifold);

  // Открытые медные трубки гидравлики (от гидрозамков УСП и коллектора к накатникам)
  const pipePaths = [
    // Передний левый гидрозамок -> коллектор
    [
      new THREE.Vector3(-0.215, -0.105, 0.365),
      new THREE.Vector3(-0.215, -0.135, 0.32),
      new THREE.Vector3(-0.11, -0.135, 0.23),
      new THREE.Vector3(-0.055, -0.105, 0.20),
    ],
    // Передний правый гидрозамок -> коллектор
    [
      new THREE.Vector3(0.215, -0.105, 0.365),
      new THREE.Vector3(0.215, -0.135, 0.32),
      new THREE.Vector3(0.11, -0.135, 0.23),
      new THREE.Vector3(0.055, -0.105, 0.20),
    ],
    // Задний левый гидрозамок -> левый гидроцилиндр накатника
    [
      new THREE.Vector3(-0.215, -0.105, -0.365),
      new THREE.Vector3(-0.275, -0.115, -0.365),
      new THREE.Vector3(-0.285, -0.155, -0.34),
      new THREE.Vector3(-0.235, -0.155, -0.32),
    ],
    // Задний правый гидрозамок -> правый гидроцилиндр накатника
    [
      new THREE.Vector3(0.215, -0.105, -0.365),
      new THREE.Vector3(0.275, -0.115, -0.365),
      new THREE.Vector3(0.285, -0.155, -0.34),
      new THREE.Vector3(0.235, -0.155, -0.32),
    ],
    // Магистраль высокого давления: коллектор -> передние штуцеры обоих накатников
    [
      new THREE.Vector3(-0.075, -0.105, 0.16),
      new THREE.Vector3(-0.16, -0.105, 0.16),
      new THREE.Vector3(-0.235, -0.108, 0.22),
      new THREE.Vector3(-0.235, -0.112, 0.28),
    ],
    [
      new THREE.Vector3(0.075, -0.105, 0.16),
      new THREE.Vector3(0.16, -0.105, 0.16),
      new THREE.Vector3(0.235, -0.108, 0.22),
      new THREE.Vector3(0.235, -0.112, 0.28),
    ],
  ];

  const fittingGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.024, 6);
  pipePaths.forEach((pts) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.25);
    const tubeGeo = new THREE.TubeGeometry(curve, 28, 0.0075, 10, false);
    const tubeMesh = new THREE.Mesh(tubeGeo, copperMat);
    cradleBreech.add(tubeMesh);

    // Латунно-медные обжимные штуцеры на концах трубок
    for (const endPt of [pts[0], pts[pts.length - 1]]) {
      const fitting = new THREE.Mesh(fittingGeo, copperMat);
      fitting.position.copy(endPt);
      cradleBreech.add(fitting);
    }
  });

  // Гофрированный резинотканевый пыльник на дульном срезе люльки (z = 0.42 .. 0.58)
  const bootPoints = [];
  const bootLength = 0.16;
  const bootSteps = 56;
  const convolutions = 6;
  for (let i = 0; i <= bootSteps; i++) {
    const t = i / bootSteps;
    const zLocal = t * bootLength;
    // Плавное сужение от посадочного кольца люльки (r ~ 0.145) к стволу (r ~ 0.102) + гофра
    const baseRadius = THREE.MathUtils.lerp(0.145, 0.103, t);
    const wave = Math.sin(t * Math.PI * 2 * convolutions) * 0.014 * Math.sin(t * Math.PI);
    bootPoints.push(new THREE.Vector2(baseRadius + wave, zLocal));
  }
  const bootGeo = new THREE.LatheGeometry(bootPoints, 32);
  bootGeo.rotateX(Math.PI / 2); // Выравниваем ось вращения вдоль +Z
  const dustBoot = new THREE.Mesh(bootGeo, rubberMat);
  dustBoot.name = 'dustBoot';
  dustBoot.position.set(0, -0.32, 0.42);
  cradleBreech.add(dustBoot);

  // Стяжные хомуты пыльника
  const bootRearClamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.152, 0.152, 0.018, 28).rotateX(Math.PI / 2),
    gunmetalMat
  );
  bootRearClamp.position.set(0, -0.32, 0.425);
  const bootFrontClamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.108, 0.108, 0.016, 28).rotateX(Math.PI / 2),
    gunmetalMat
  );
  bootFrontClamp.position.set(0, -0.32, 0.575);
  cradleBreech.add(bootRearClamp, bootFrontClamp);

  // =========================================================================
  // 3. ОТКАТНОЙ СТВОЛ С ЭЖЕКТОРОМ И УУИ (barrelGroup — откат по -Z на 0.45 м)
  // =========================================================================
  const barrelGroup = new THREE.Group();
  barrelGroup.name = 'barrelGroup';
  // Ось ствола совпадает с осью люльки и пыльника (y = -0.32)
  barrelGroup.position.set(0, -0.32, 0);
  root.add(barrelGroup);

  // Моноблок гладкоствольной трубы 125 мм от казённика (z = -0.25) до среза (z = 3.10)
  // Состоит из казённой откатной части и ступенчатого дульного участка
  const barrelRearTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.105, 1.90, 28).rotateX(Math.PI / 2),
    gunmetalMat
  );
  barrelRearTube.position.set(0, 0, 0.70); // z = -0.25 .. 1.65
  barrelGroup.add(barrelRearTube);

  const barrelFrontTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.090, 1.45, 28).rotateX(Math.PI / 2),
    gunmetalMat
  );
  barrelFrontTube.position.set(0, 0, 2.375); // z = 1.65 .. 3.10
  barrelGroup.add(barrelFrontTube);

  // Усиленный дульный срез ствола (z = 3.00 .. 3.10) и тёмный канал ствола (125 мм -> r = 0.0625 м)
  const muzzleTip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.080, 0.10, 28).rotateX(Math.PI / 2),
    gunmetalMat
  );
  muzzleTip.position.set(0, 0, 3.05);
  barrelGroup.add(muzzleTip);

  const boreOpening = new THREE.Mesh(
    new THREE.CircleGeometry(0.0625, 28),
    boreDarkMat
  );
  boreOpening.position.set(0, 0, 3.101);
  barrelGroup.add(boreOpening);

  // Сегментированный термозащитный кожух (ТЗК) из лёгкого сплава
  // Задняя секция (до эжектора): z = 0.60 .. 1.43 (3 сегмента)
  // Передняя секция (после эжектора): z = 1.87 .. 2.98 (4 сегмента)
  const shroudSegments = [
    // [zStart, zEnd, rRear, rFront]
    [0.60, 0.87, 0.108, 0.106],
    [0.88, 1.15, 0.106, 0.104],
    [1.16, 1.43, 0.104, 0.102],
    [1.87, 2.14, 0.098, 0.095],
    [2.15, 2.42, 0.095, 0.092],
    [2.43, 2.70, 0.092, 0.089],
    [2.71, 2.98, 0.089, 0.086],
  ];

  const clampSpecs = []; // Сюда соберём координаты и радиусы всех стяжных хомутов

  shroudSegments.forEach(([z0, z1, r0, r1]) => {
    const len = z1 - z0;
    const zMid = (z0 + z1) * 0.5;
    const shroudCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(r1, r0, len, 28).rotateX(Math.PI / 2),
      khakiMat
    );
    shroudCyl.position.set(0, 0, zMid);
    barrelGroup.add(shroudCyl);

    // Продольные рёбра жёсткости по бокам сегментов ТЗК
    const rAvg = (r0 + r1) * 0.5;
    for (const side of [-1, 1]) {
      const bead = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, len - 0.02), khakiMat);
      bead.position.set(side * (rAvg + 0.003), 0, zMid);
      barrelGroup.add(bead);
    }

    // По два стяжных хомута на каждый сегмент кожуха
    clampSpecs.push({ z: z0 + 0.032, r: THREE.MathUtils.lerp(r0, r1, 0.12) });
    clampSpecs.push({ z: z1 - 0.032, r: THREE.MathUtils.lerp(r0, r1, 0.88) });
  });

  // Стяжные хомуты термокожуха через InstancedMesh (14 кольцевых лент + замковые бобышки)
  const clampProfile = [
    new THREE.Vector2(0.985, -0.009),
    new THREE.Vector2(1.022, -0.009),
    new THREE.Vector2(1.022, 0.009),
    new THREE.Vector2(0.985, 0.009),
  ];
  const solidClampGeo = new THREE.LatheGeometry(clampProfile, 28);
  solidClampGeo.rotateX(Math.PI / 2);

  const clampInstancedMesh = new THREE.InstancedMesh(
    solidClampGeo,
    gunmetalMat,
    clampSpecs.length
  );
  clampInstancedMesh.name = 'thermalShroudClamps';

  const clampLugGeo = new THREE.BoxGeometry(0.028, 0.024, 0.024);
  const clampLugInstancedMesh = new THREE.InstancedMesh(
    clampLugGeo,
    gunmetalMat,
    clampSpecs.length
  );
  clampLugInstancedMesh.name = 'thermalShroudClampLugs';

  const dummy = new THREE.Object3D();
  clampSpecs.forEach((spec, i) => {
    // Кольцо хомута
    dummy.position.set(0, 0, spec.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(spec.r, spec.r, 1);
    dummy.updateMatrix();
    clampInstancedMesh.setMatrixAt(i, dummy.matrix);

    // Замковая стяжка хомута сбоку-сверху
    dummy.position.set(spec.r * 0.72, spec.r * 0.72, spec.z);
    dummy.rotation.set(0, 0, -Math.PI / 4);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    clampLugInstancedMesh.setMatrixAt(i, dummy.matrix);
  });

  clampInstancedMesh.instanceMatrix.needsUpdate = true;
  clampLugInstancedMesh.instanceMatrix.needsUpdate = true;
  barrelGroup.add(clampInstancedMesh, clampLugInstancedMesh);

  // Эжектор продувки пороховых газов со смещённой осью ровно посередине ствола (z = 1.65)
  const ejectorGroup = new THREE.Group();
  ejectorGroup.name = 'boreEvacuator';
  // Характерное эксцентричное смещение оси эжектора вниз относительно оси канала ствола
  ejectorGroup.position.set(0, -0.026, 1.65);
  barrelGroup.add(ejectorGroup);

  const ejectorBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.132, 0.132, 0.30, 32).rotateX(Math.PI / 2),
    khakiMat
  );
  const ejectorRearCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.132, 0.104, 0.07, 32).rotateX(Math.PI / 2),
    khakiMat
  );
  ejectorRearCone.position.z = -0.185;

  const ejectorFrontCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.098, 0.132, 0.07, 32).rotateX(Math.PI / 2),
    khakiMat
  );
  ejectorFrontCone.position.z = 0.185;

  // Сварной шов и стяжные ленты эжектора
  const ejectorSeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1345, 0.1345, 0.014, 32).rotateX(Math.PI / 2),
    gunmetalMat
  );
  const ejectorStrapRear = new THREE.Mesh(
    new THREE.CylinderGeometry(0.134, 0.134, 0.016, 32).rotateX(Math.PI / 2),
    gunmetalMat
  );
  ejectorStrapRear.position.z = -0.11;
  const ejectorStrapFront = new THREE.Mesh(
    new THREE.CylinderGeometry(0.134, 0.134, 0.016, 32).rotateX(Math.PI / 2),
    gunmetalMat
  );
  ejectorStrapFront.position.z = 0.11;

  ejectorGroup.add(
    ejectorBody,
    ejectorRearCone,
    ejectorFrontCone,
    ejectorSeam,
    ejectorStrapRear,
    ejectorStrapFront
  );

  // Датчик учёта теплового изгиба ствола (УУИ) сверху над срезом в z = 3.05
  const uuiGroup = new THREE.Group();
  uuiGroup.name = 'muzzleReferenceSensor_UUI';
  uuiGroup.position.set(0, 0.082, 3.05);
  barrelGroup.add(uuiGroup);

  // Седловидный кронштейн крепления УУИ на дульном утолщении
  const uuiBracket = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.036, 0.072), gunmetalMat);
  uuiBracket.position.set(0, 0.012, 0);
  uuiGroup.add(uuiBracket);

  // Бронекожух оптического отражателя УУИ
  const uuiHousing = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.056, 0.084), khakiMat);
  uuiHousing.position.set(0, 0.052, 0.004);
  uuiGroup.add(uuiHousing);

  // Защитный козырёк и оптическая призма, направленная назад (-Z) к прицельному комплексу
  const uuiHood = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.012, 0.025), gunmetalMat);
  uuiHood.position.set(0, 0.078, -0.042);
  const uuiLens = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.032, 0.008), opticLensMat);
  uuiLens.position.set(0, 0.050, -0.039);
  uuiGroup.add(uuiHood, uuiLens);

  // Включение теней для всех мешей модели
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  // Ссылки на ключевые узлы для удобного доступа из контроллера меха
  root.userData = {
    mountFlange,
    cradleBreech,
    barrelGroup,
    recoilDistance: 0.45,
  };

  return root;
}

// ===========================================================================
// ТЕСТОВАЯ СЦЕНА (автономный стенд; во вьювере не вызывается —
// движок index.html сам ставит свет, пол и анимацию выстрела).
// ===========================================================================
function initTestScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#111417';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14171a);
  scene.fog = new THREE.FogExp2(0x14171a, 0.055);

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.05,
    50
  );
  camera.position.set(2.8, 0.95, 2.7);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, -0.32, 1.15);
  controls.minDistance = 0.8;
  controls.maxDistance = 12.0;

  // Процедурная студийная среда (PMREM) для реалистичных бликов на воронёной стали и меди
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x20252b);
  const panelTop = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff5e4, side: THREE.DoubleSide })
  );
  panelTop.position.set(0, 6, 0);
  panelTop.rotation.x = Math.PI / 2;
  const panelSide = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 6),
    new THREE.MeshBasicMaterial({ color: 0x8fa8c8, side: THREE.DoubleSide })
  );
  panelSide.position.set(-6, 2, 2);
  panelSide.rotation.y = Math.PI / 2;
  envScene.add(panelTop, panelSide);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();

  // Освещение ангара / испытательного стенда
  const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x26292e, 0.65);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff3e0, 2.6);
  keyLight.position.set(4.5, 5.5, 3.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 16;
  keyLight.shadow.camera.left = -3.5;
  keyLight.shadow.camera.right = 3.5;
  keyLight.shadow.camera.top = 3.5;
  keyLight.shadow.camera.bottom = -3.5;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.1);
  rimLight.position.set(-4.0, 2.0, -3.5);
  scene.add(rimLight);

  // Вспышка дульного среза при выстреле
  const muzzleFlashLight = new THREE.PointLight(0xff9d3b, 0, 8, 1.8);
  muzzleFlashLight.position.set(0, -0.32, 3.25);
  scene.add(muzzleFlashLight);

  // Сборочный пол и координатная сетка
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 0.85, metalness: 0.15 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.25;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(12, 24, 0x3b424c, 0x252a30);
  grid.position.y = -1.248;
  scene.add(grid);

  // Инициализация орудия 2А46М-5 «Молот»
  const weapon = createWeapon2A46M5Molot();
  scene.add(weapon);

  const { barrelGroup, recoilDistance } = weapon.userData;

  // Параметры цикла выстрела: резкий откат (-0.45 м) и плавный гидравлический накат
  const fireCycle = {
    isFiring: false,
    elapsed: 0,
    recoilTime: 0.075, // Быстрый импульс отдачи (75 мс)
    holdTime: 0.045,   // Краткая задержка в крайнем заднем положении
    returnTime: 0.72,  // Плавный демпфированный накат в исходное положение
    autoInterval: 3.2, // Автоматический тестовый выстрел каждые 3.2 с
    cooldown: 0.8,
  };

  function triggerFire() {
    if (!fireCycle.isFiring) {
      fireCycle.isFiring = true;
      fireCycle.elapsed = 0;
      muzzleFlashLight.intensity = 18.0;
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') triggerFire();
  });
  renderer.domElement.addEventListener('dblclick', triggerFire);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (fireCycle.isFiring) {
      fireCycle.elapsed += dt;
      const t = fireCycle.elapsed;
      const { recoilTime, holdTime, returnTime } = fireCycle;

      // Затухание дульной вспышки
      muzzleFlashLight.intensity = Math.max(0, 18.0 * (1 - t / 0.09));

      let offset = 0;
      if (t < recoilTime) {
        // Фаза отката (кубическое торможение в конце хода)
        const p = t / recoilTime;
        offset = recoilDistance * (1 - Math.pow(1 - p, 3));
      } else if (t < recoilTime + holdTime) {
        // Пик отката
        offset = recoilDistance;
      } else if (t < recoilTime + holdTime + returnTime) {
        // Фаза наката (гладкая C1-кривая без рывков на старте и при постановке на упор)
        const u = (t - recoilTime - holdTime) / returnTime;
        const smoothReturn = 1 - (3 * u * u - 2 * u * u * u);
        offset = recoilDistance * smoothReturn;
      } else {
        offset = 0;
        fireCycle.isFiring = false;
        fireCycle.cooldown = fireCycle.autoInterval;
      }

      barrelGroup.position.z = -offset;
    } else {
      fireCycle.cooldown -= dt;
      if (fireCycle.cooldown <= 0) {
        triggerFire();
      }
    }

    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

// initTestScene(); // Автономный стенд: раскомментировать только вне просмотрщика.

// =========================================================================
// Адаптер под единый просмотрщик: откат ствола 0..0.45 м + дульная вспышка.
// Профиль выстрела (откат/удержание/накат) задаётся через meta.cannon.
// =========================================================================
export function createWeapon() {
  const root = createWeapon2A46M5Molot();
  const ud = root.userData;
  const barrel = root.getObjectByName('barrelGroup');

  const flash = new THREE.PointLight(0xff9d3b, 0, 8, 1.8);
  flash.position.set(0, -0.32, 3.25);
  root.add(flash);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  ud.barrel = barrel;
  ud.setExtension = (recoil) => {
    const r = Math.max(0, Math.min(MAX_RECOIL, recoil));
    barrel.position.z = -r;
    return r / MAX_RECOIL;
  };
  ud.setFlash = (k) => {
    flash.intensity = 18.0 * Math.max(0, Math.min(1, k));
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
