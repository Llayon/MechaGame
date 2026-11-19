import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'pmk100',
  code: 'ПМК-100',
  title: 'ПМК-100 «Молот-М»',
  subtitle: 'СВЕРХТЯЖЁЛЫЙ РЕАКТИВНЫЙ СЕЙСМО-ТАРАН • СЛОТ SUPERHEAVY • ЦИКЛ 3.4 С',
  description: 'Сверхтяжёлый наручный сейсмо-таран: сдвоенный фланец УСП 0.8×0.2×1.3 м, коробчатая балка-манипулятор 3.1 м, блок из 3 твердотопливных ускорителей и подвижная вольфрамовая ударная головка с 4 свайными бойками. Боевой цикл: замах → реактивный рывок → сейсмоудар → возврат.',
  specs: [
    ['Масса', '14.8 т'],
    ['Слот', 'SUPERHEAVY'],
    ['Цикл удара', '3.4 с'],
    ['Ускорители', '3 × ТТД, сопла с побежалостью'],
    ['Головка', 'Вольфрам, 4 свайных бойка'],
    ['Откат', '2 внешних демпфера + подвеска'],
  ],
  maxExtension: 3.4,
  unit: 's',
  tipOffset: 3.75,
  subgroups: [
    { key: 'mountFlange', label: '1. Сдвоенный фланец УСП' },
    { key: 'chassisBeam', label: '2. Балка-манипулятор и демпферы' },
    { key: 'seismicHammerHead', label: '3. Сейсмо-головка и бойки' },
    { key: 'rocketThrusterPod', label: '4. Блок ТТД-ускорителей' },
  ],
  cameras: {
    module: { pos: [4.6, 2.1, 4.9], target: [0, -0.25, 1.85] },
  },
  rangeMarkers: [],
  controls: 'seismic',
};

const CYCLE = 3.4;

/**
 * Создаёт процедурную 3D-модель сверхтяжёлого наручного реактивного
 * сейсмо-тарана ПМК-100 «Молот-М» (слот SUPERHEAVY).
 *
 * Масштаб: 1 unit = 1 метр.
 * Ориентация: +Z — вперёд (направление удара), +Y — вверх.
 * (0, 0, 0): центр сдвоенного усиленного фланца УСП (0.8 x 0.2 x 1.3 м).
 *
 * @returns {THREE.Group}
 */
export function createWeaponPMK100MolotM() {
  const root = new THREE.Group();
  root.name = 'PMK100_MolotM';

  // ============================================================================
  // 1. ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (CanvasTexture)
  // ============================================================================

  /** Карта микронеровностей и копоти для индустриальной брони */
  function createWeatheredMetalTexture(baseHex, sootStrength = 0.28) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 512);

    // Зернистость грунта и следы прокатки стали
    for (let i = 0; i < 4500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const w = 1 + Math.random() * 3;
      const h = 1 + Math.random() * 2;
      ctx.fillStyle = Math.random() > 0.5
        ? 'rgba(255,255,255,0.035)'
        : 'rgba(0,0,0,0.06)';
      ctx.fillRect(x, y, w, h);
    }

    // Пятна копоти и потёки масла по краям
    for (let i = 0; i < 36; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 20 + Math.random() * 75;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(0, `rgba(18, 20, 22, ${sootStrength})`);
      grad.addColorStop(1, 'rgba(18, 20, 22, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Тонкие эксплуатационные царапины до светлого металла
    ctx.strokeStyle = 'rgba(195, 202, 208, 0.14)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 45; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 18);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /** Текстура фланца УСП: жёлто-чёрная предупреждающая маркировка и трафарет «ПМК-100» */
  function createFlangeStencilTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Базовый индустриальный грунт с копотью (#6c7278)
    ctx.fillStyle = '#6c7278';
    ctx.fillRect(0, 0, 1024, 1024);

    // Текстура копоти по периметру
    for (let i = 0; i < 65; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const r = 30 + Math.random() * 110;
      const grad = ctx.createRadialGradient(x, y, 4, x, y, r);
      grad.addColorStop(0, 'rgba(20, 22, 24, 0.24)');
      grad.addColorStop(1, 'rgba(20, 22, 24, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Жёлто-чёрные предупреждающие полосы слева и справа
    const drawHazardBand = (x0, width) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, 0, width, 1024);
      ctx.clip();

      ctx.fillStyle = '#d49b1a';
      ctx.fillRect(x0, 0, width, 1024);

      ctx.fillStyle = '#191b1d';
      const step = 64;
      for (let y = -1024; y < 2048; y += step) {
        ctx.beginPath();
        ctx.moveTo(x0 - 40, y);
        ctx.lineTo(x0 + width + 40, y + 95);
        ctx.lineTo(x0 + width + 40, y + 95 + step * 0.5);
        ctx.lineTo(x0 - 40, y + step * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Тёмная окантовка полосы
      ctx.strokeStyle = '#1b1d1f';
      ctx.lineWidth = 6;
      ctx.strokeRect(x0, 2, width, 1020);
    };

    drawHazardBand(28, 92);
    drawHazardBand(904, 92);

    // Внутренняя технологическая рамка
    ctx.strokeStyle = 'rgba(25, 28, 30, 0.72)';
    ctx.lineWidth = 8;
    ctx.strokeRect(156, 44, 712, 936);

    // Трафаретный индекс «ПМК-100» (поворот вдоль продольной оси балки)
    ctx.save();
    ctx.translate(512, 512);
    ctx.rotate(-Math.PI / 2);

    ctx.fillStyle = '#17191b';
    ctx.font = '900 132px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ПМК-100', 0, -45);

    ctx.font = '700 46px "Courier New", monospace';
    ctx.fillStyle = '#d49b1a';
    ctx.fillRect(-310, 42, 620, 62);
    ctx.fillStyle = '#151719';
    ctx.fillText('МОЛОТ-М // УСП-СВЕРХТЯЖ', 0, 74);

    ctx.font = '700 28px "Courier New", monospace';
    ctx.fillStyle = 'rgba(20, 22, 24, 0.85)';
    ctx.fillText('МАССА 14.8 Т   •   СЕЙСМОУДАР   •   Рраб 42 МПа', 0, 146);
    ctx.restore();

    // Потёртости поверх краски для реалистичности
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = 'rgba(108, 114, 120, 0.35)';
      ctx.fillRect(
        Math.random() * 1024,
        Math.random() * 1024,
        4 + Math.random() * 18,
        2 + Math.random() * 6
      );
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  /** Процедурная текстура побежалости металла для конических сопел ускорителей */
  function createHeatTemperTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Градиент побежалости от критического сечения (верх UV) к срезу сопла (низ UV)
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#23262b'); // Тёмная окалина у камеры сгорания
    grad.addColorStop(0.22, '#8a6b3e'); // Соломенно-золотистый отпуск
    grad.addColorStop(0.45, '#6a4b7c'); // Фиолетово-пурпурный перегрев
    grad.addColorStop(0.68, '#2d4c7a'); // Синий цвет побежалости
    grad.addColorStop(0.86, '#394652'); // Серо-синий закалённый сплав
    grad.addColorStop(1.0, '#1a1c20'); // Закопчённый срез сопла

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Продольные следы газовой струи и нагар
    for (let i = 0; i < 180; i++) {
      const x = Math.random() * 512;
      const alpha = 0.04 + Math.random() * 0.08;
      ctx.fillStyle = i % 2 === 0
        ? `rgba(10, 12, 15, ${alpha})`
        : `rgba(180, 145, 95, ${alpha * 0.6})`;
      ctx.fillRect(x, 0, 1 + Math.random() * 4, 512);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ============================================================================
  // 2. PBR-МАТЕРИАЛЫ
  // ============================================================================
  const primerTex = createWeatheredMetalTexture('#6c7278', 0.30);
  const oliveTex = createWeatheredMetalTexture('#464f42', 0.26);
  const tungstenTex = createWeatheredMetalTexture('#1f2226', 0.22);
  const flangeStencilTex = createFlangeStencilTexture();
  const heatTemperTex = createHeatTemperTexture();

  // Светло-серый индустриальный грунт с копотью (#6c7278)
  const matPrimerGray = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: primerTex,
    roughnessMap: primerTex,
    metalness: 0.55,
    roughness: 0.62,
  });

  // Тёмно-оливковая броня (#464f42)
  const matOliveArmor = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: oliveTex,
    roughnessMap: oliveTex,
    metalness: 0.48,
    roughness: 0.58,
  });

  // Воронёный вольфрамовый ударный блок (#1f2226, metalness: 0.85, roughness: 0.4)
  const matTungsten = new THREE.MeshStandardMaterial({
    color: 0x1f2226,
    roughnessMap: tungstenTex,
    metalness: 0.85,
    roughness: 0.40,
  });

  // Фланец с трафаретом «ПМК-100» и жёлто-чёрной маркировкой
  const matFlangeTop = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: flangeStencilTex,
    metalness: 0.52,
    roughness: 0.55,
  });

  // Сопла с эффектом побежалости металла
  const matNozzleTemper = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: heatTemperTex,
    metalness: 0.88,
    roughness: 0.30,
  });

  // Хромированные штоки гидрозамков и демпферов
  const matChrome = new THREE.MeshStandardMaterial({
    color: 0xcfd6dd,
    metalness: 0.94,
    roughness: 0.18,
  });

  // Тёмная резина / силовые кабели / демпферные подушки
  const matDarkRubber = new THREE.MeshStandardMaterial({
    color: 0x181a1c,
    metalness: 0.15,
    roughness: 0.82,
  });

  // Латунные / медные штуцеры и клеммы
  const matBrass = new THREE.MeshStandardMaterial({
    color: 0x9c7a3c,
    metalness: 0.85,
    roughness: 0.34,
  });

  // Жёлтая сигнальная краска для отбойников и калибровочных колец
  const matHazardYellow = new THREE.MeshStandardMaterial({
    color: 0xd49b1a,
    metalness: 0.25,
    roughness: 0.50,
  });

  // ============================================================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ СБОРКИ И ЗАКЛЁПОК (InstancedMesh)
  // ============================================================================
  const staticRivetMatrices = [];
  const headRivetMatrices = [];
  const dummyObj = new THREE.Object3D();

  /** Регистрирует позицию и нормаль заклёпки для InstancedMesh */
  function addRivet(targetList, x, y, z, rx = 0, ry = 0, rz = 0, scale = 1) {
    dummyObj.position.set(x, y, z);
    dummyObj.rotation.set(rx, ry, rz);
    dummyObj.scale.setScalar(scale);
    dummyObj.updateMatrix();
    targetList.push(dummyObj.matrix.clone());
  }

  /** Заполняет линию заклёпок между двумя точками */
  function addRivetLine(targetList, p0, p1, count, rot = [0, 0, 0], scale = 1) {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      addRivet(
        targetList,
        THREE.MathUtils.lerp(p0[0], p1[0], t),
        THREE.MathUtils.lerp(p0[1], p1[1], t),
        THREE.MathUtils.lerp(p0[2], p1[2], t),
        rot[0],
        rot[1],
        rot[2],
        scale
      );
    }
  }

  // ============================================================================
  // УЗЕЛ 1: mountFlange — Сдвоенный силовой фланец УСП (0.8 x 0.2 x 1.3 м)
  // ============================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  // Верхняя и нижняя силовые плиты сдвоенного фланца (габарит 0.80 x 0.20 x 1.30 м)
  const flangeTopPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.80, 0.068, 1.30),
    [matPrimerGray, matPrimerGray, matFlangeTop, matPrimerGray, matPrimerGray, matPrimerGray]
  );
  flangeTopPlate.position.set(0, 0.066, 0);
  mountFlange.add(flangeTopPlate);

  const flangeBottomPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.80, 0.068, 1.30),
    matPrimerGray
  );
  flangeBottomPlate.position.set(0, -0.066, 0);
  mountFlange.add(flangeBottomPlate);

  // Центральная межфланцевая силовая проставка и поперечные рёбра жёсткости
  const flangeCoreWeb = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.064, 1.22),
    matOliveArmor
  );
  mountFlange.add(flangeCoreWeb);

  for (const zRib of [-0.52, -0.26, 0, 0.26, 0.52]) {
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.064, 0.036),
      matTungsten
    );
    rib.position.set(0, 0, zRib);
    mountFlange.add(rib);
  }

  // Центральная стыковочная горловина УСП сверху
  const dockingCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.25, 0.045, 24),
    matTungsten
  );
  dockingCollar.position.set(0, 0.115, 0);
  mountFlange.add(dockingCollar);

  const dockingInnerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.018, 12, 24),
    matChrome
  );
  dockingInnerRing.rotation.x = Math.PI / 2;
  dockingInnerRing.position.set(0, 0.138, 0);
  mountFlange.add(dockingInnerRing);

  // 6 гидрозамков (по 3 с каждой стороны фланца: z = -0.42, 0, +0.42)
  const lockZPositions = [-0.42, 0.0, 0.42];
  for (const side of [-1, 1]) {
    for (const zPos of lockZPositions) {
      const lockGroup = new THREE.Group();
      lockGroup.position.set(side * 0.415, 0, zPos);

      // Корпус гидроцилиндра замка
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.17, 14),
        matOliveArmor
      );
      housing.rotation.z = Math.PI / 2;
      lockGroup.add(housing);

      // Гайка-букса
      const gland = new THREE.Mesh(
        new THREE.CylinderGeometry(0.050, 0.050, 0.035, 6),
        matTungsten
      );
      gland.rotation.z = Math.PI / 2;
      gland.position.x = side * 0.065;
      lockGroup.add(gland);

      // Запирающий хромированный шток
      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 0.075, 12),
        matChrome
      );
      pin.rotation.z = Math.PI / 2;
      pin.position.x = side * 0.105;
      lockGroup.add(pin);

      // Штуцер гидроподвода
      const fitting = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.04, 8),
        matBrass
      );
      fitting.position.set(0, 0.052, 0);
      lockGroup.add(fitting);

      mountFlange.add(lockGroup);
    }
  }

  // Заклёпки по периметру верхней плиты фланца
  addRivetLine(staticRivetMatrices, [-0.36, 0.102, -0.60], [-0.36, 0.102, 0.60], 12);
  addRivetLine(staticRivetMatrices, [0.36, 0.102, -0.60], [0.36, 0.102, 0.60], 12);
  addRivetLine(staticRivetMatrices, [-0.30, 0.102, -0.61], [0.30, 0.102, -0.61], 7);
  addRivetLine(staticRivetMatrices, [-0.30, 0.102, 0.61], [0.30, 0.102, 0.61], 7);

  // ============================================================================
  // УЗЕЛ 2: chassisBeam — Гигантская коробчатая балка-манипулятор
  // ============================================================================
  const chassisBeam = new THREE.Group();
  chassisBeam.name = 'chassisBeam';
  root.add(chassisBeam);

  // Переходная силовая седловина между фланцем (y = -0.10) и балкой
  const mountSaddle = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.13, 1.24),
    matPrimerGray
  );
  mountSaddle.position.set(0, -0.135, 0);
  chassisBeam.add(mountSaddle);

  // Основная коробчатая балка-манипулятор (z от -0.45 до +2.65, длина 3.10 м)
  const mainBoxGirder = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.42, 3.10),
    matOliveArmor
  );
  mainBoxGirder.position.set(0, -0.36, 1.10);
  chassisBeam.add(mainBoxGirder);

  // Верхняя и нижняя усиленные полки двутаврового/коробчатого профиля
  const topFlangeStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.055, 3.14),
    matPrimerGray
  );
  topFlangeStrip.position.set(0, -0.145, 1.10);
  chassisBeam.add(topFlangeStrip);

  const bottomFlangeStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.60, 0.06, 3.12),
    matPrimerGray
  );
  bottomFlangeStrip.position.set(0, -0.585, 1.10);
  chassisBeam.add(bottomFlangeStrip);

  // Накладные бронелисты по бортам балки
  for (const side of [-1, 1]) {
    const sideArmor = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.30, 2.75),
      matPrimerGray
    );
    sideArmor.position.set(side * 0.285, -0.36, 1.12);
    chassisBeam.add(sideArmor);

    addRivetLine(
      staticRivetMatrices,
      [side * 0.304, -0.24, -0.18],
      [side * 0.304, -0.24, 2.42],
      18,
      [0, 0, -side * Math.PI / 2]
    );
    addRivetLine(
      staticRivetMatrices,
      [side * 0.304, -0.48, -0.18],
      [side * 0.304, -0.48, 2.42],
      18,
      [0, 0, -side * Math.PI / 2]
    );
  }

  // Косынки жёсткости (вдоль перехода к фланцу и по всей длине балки)
  const gussetZCoords = [-0.36, -0.05, 0.28, 0.62, 1.05, 1.50, 1.95, 2.38];
  for (const side of [-1, 1]) {
    for (let i = 0; i < gussetZCoords.length; i++) {
      const zG = gussetZCoords[i];
      // Наклонная треугольно-трапециевидная косынка под верхней полкой
      const gusset = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.24, 0.16),
        matPrimerGray
      );
      gusset.position.set(side * 0.32, -0.24, zG);
      gusset.rotation.z = side * 0.32;
      chassisBeam.add(gusset);

      // Дополнительные мощные косынки у корневого узла (первые 3 секции)
      if (i < 3) {
        const rootGusset = new THREE.Mesh(
          new THREE.BoxGeometry(0.045, 0.18, 0.22),
          matTungsten
        );
        rootGusset.position.set(side * 0.36, -0.11, zG);
        rootGusset.rotation.z = side * 0.48;
        chassisBeam.add(rootGusset);
      }
    }
  }

  // Противокумулятивная решётка сбоку (левый борт -X, z = +0.38..+2.14)
  const slatArmorGroup = new THREE.Group();
  slatArmorGroup.name = 'slatArmorCage';
  chassisBeam.add(slatArmorGroup);

  const slatZStart = 0.38;
  const slatZEnd = 2.14;
  const slatLength = slatZEnd - slatZStart;
  const slatZCenter = (slatZStart + slatZEnd) * 0.5;
  const slatX = -0.52;

  // 7 горизонтальных бронепланок решётки
  for (let i = 0; i < 7; i++) {
    const ySlat = -0.56 + i * 0.068;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.016, slatLength),
      i % 2 === 0 ? matOliveArmor : matPrimerGray
    );
    bar.position.set(slatX, ySlat, slatZCenter);
    slatArmorGroup.add(bar);
  }

  // 5 вертикальных силовых стоек решётки + кронштейны выноса к балке
  for (let i = 0; i < 5; i++) {
    const zPost = THREE.MathUtils.lerp(slatZStart + 0.04, slatZEnd - 0.04, i / 4);
    const vPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.45, 0.035),
      matTungsten
    );
    vPost.position.set(slatX + 0.015, -0.355, zPost);
    slatArmorGroup.add(vPost);

    for (const yBracket of [-0.21, -0.50]) {
      const standoff = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.032, 0.036),
        matPrimerGray
      );
      standoff.position.set(-0.39, yBracket, zPost);
      slatArmorGroup.add(standoff);
    }
  }

  // Открытые силовые кабели (TubeGeometry по трассам вдоль балки + хомуты)
  const cableSpecs = [
    {
      radius: 0.024,
      mat: matDarkRubber,
      points: [
        new THREE.Vector3(0.31, -0.06, -0.45),
        new THREE.Vector3(0.35, -0.09, 0.25),
        new THREE.Vector3(0.35, -0.10, 1.15),
        new THREE.Vector3(0.37, -0.12, 2.00),
        new THREE.Vector3(0.34, -0.18, 2.62),
      ],
    },
    {
      radius: 0.019,
      mat: matDarkRubber,
      points: [
        new THREE.Vector3(0.28, -0.04, -0.45),
        new THREE.Vector3(0.32, -0.06, 0.30),
        new THREE.Vector3(0.32, -0.07, 1.25),
        new THREE.Vector3(0.34, -0.09, 2.05),
        new THREE.Vector3(0.31, -0.14, 2.62),
      ],
    },
    {
      radius: 0.022,
      mat: matBrass,
      points: [
        new THREE.Vector3(-0.18, -0.62, -0.30),
        new THREE.Vector3(-0.20, -0.64, 0.65),
        new THREE.Vector3(-0.20, -0.64, 1.75),
        new THREE.Vector3(-0.22, -0.60, 2.62),
      ],
    },
    {
      radius: 0.026,
      mat: matDarkRubber,
      points: [
        new THREE.Vector3(0.16, -0.62, -0.30),
        new THREE.Vector3(0.19, -0.65, 0.75),
        new THREE.Vector3(0.19, -0.65, 1.85),
        new THREE.Vector3(0.22, -0.58, 2.62),
      ],
    },
  ];

  for (const spec of cableSpecs) {
    const curve = new THREE.CatmullRomCurve3(spec.points);
    const tubeGeo = new THREE.TubeGeometry(curve, 36, spec.radius, 10, false);
    const cableMesh = new THREE.Mesh(tubeGeo, spec.mat);
    chassisBeam.add(cableMesh);

    // Хомуты крепления кабелей
    for (const t of [0.2, 0.5, 0.8]) {
      const pt = curve.getPointAt(t);
      const clamp = new THREE.Mesh(
        new THREE.BoxGeometry(spec.radius * 2.8, spec.radius * 2.8, 0.045),
        matTungsten
      );
      clamp.position.copy(pt);
      chassisBeam.add(clamp);
    }
  }

  // Два массивных внешних демпфера отдачи (слева и справа вдоль верхней кромки балки)
  const recoilDampers = [];
  for (const side of [-1, 1]) {
    const damperGroup = new THREE.Group();
    damperGroup.name = side < 0 ? 'recoilDamperLeft' : 'recoilDamperRight';
    damperGroup.position.set(side * 0.44, -0.17, 0.55);
    chassisBeam.add(damperGroup);

    // Задняя проушина крепления демпфера к балке
    const rearBracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.22, 0.22),
      matTungsten
    );
    rearBracket.position.set(-side * 0.05, 0, 0);
    damperGroup.add(rearBracket);

    // Толстостенный цилиндр гидродемпфера
    const cylinderBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 1.18, 20),
      matOliveArmor
    );
    cylinderBody.rotation.x = Math.PI / 2;
    cylinderBody.position.set(0, 0, 0.65);
    damperGroup.add(cylinderBody);

    // Охлаждающие рёбра и стяжные кольца на корпусе демпфера
    for (let r = 0; r < 5; r++) {
      const fin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.122, 0.122, 0.028, 20),
        matPrimerGray
      );
      fin.rotation.x = Math.PI / 2;
      fin.position.set(0, 0, 0.22 + r * 0.22);
      damperGroup.add(fin);
    }

    // Внешний баллон-гидроаккумулятор азота сбоку демпфера
    const accumulator = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.046, 0.56, 14),
      matPrimerGray
    );
    accumulator.rotation.x = Math.PI / 2;
    accumulator.position.set(side * 0.12, -0.05, 0.58);
    damperGroup.add(accumulator);

    const accCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.046, 14, 10),
      matHazardYellow
    );
    accCap.position.set(side * 0.12, -0.05, 0.86);
    damperGroup.add(accCap);

    // Подвижная сборка: хромированный шток + силовая возвратная пружина
    const pistonAssembly = new THREE.Group();
    pistonAssembly.position.set(0, 0, 1.24);
    damperGroup.add(pistonAssembly);

    const pistonRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.92, 16),
      matChrome
    );
    pistonRod.rotation.x = Math.PI / 2;
    pistonRod.position.set(0, 0, 0.44);
    pistonAssembly.add(pistonRod);

    // Наборная силовая пружина вокруг штока
    const springGroup = new THREE.Group();
    pistonAssembly.add(springGroup);
    const coilCount = 13;
    for (let c = 0; c < coilCount; c++) {
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.088, 0.016, 10, 22),
        matTungsten
      );
      coil.position.set(0, 0, 0.06 + c * 0.056);
      coil.rotation.x = 0.11;
      springGroup.add(coil);
    }

    recoilDampers.push({ pistonAssembly, springGroup });
  }

  // ============================================================================
  // УЗЕЛ 4 (основная ударная часть): seismicHammerHead
  // ============================================================================
  const seismicHammerHead = new THREE.Group();
  seismicHammerHead.name = 'seismicHammerHead';
  seismicHammerHead.position.set(0, -0.34, 2.65);
  root.add(seismicHammerHead);

  // Опорная рама амортизирующей подвески (стыкуется с chassisBeam и демпферами)
  const suspensionCarrier = new THREE.Mesh(
    new THREE.BoxGeometry(1.04, 0.64, 0.24),
    matPrimerGray
  );
  suspensionCarrier.position.set(0, 0, 0.08);
  seismicHammerHead.add(suspensionCarrier);

  // Боковые проушины приёма внешних демпферов отдачи
  for (const side of [-1, 1]) {
    const damperClevis = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.22, 0.22),
      matTungsten
    );
    damperClevis.position.set(side * 0.44, 0.17, 0.08);
    seismicHammerHead.add(damperClevis);
  }

  // 4 направляющих штока и эластомерных амортизатора подвески ударной головки
  const suspOffsets = [
    [-0.32, 0.19],
    [0.32, 0.19],
    [-0.32, -0.19],
    [0.32, -0.19],
  ];
  for (const [sx, sy] of suspOffsets) {
    const guideRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.42, 14),
      matChrome
    );
    guideRod.rotation.x = Math.PI / 2;
    guideRod.position.set(sx, sy, 0.30);
    seismicHammerHead.add(guideRod);

    // Пакет эластомерных демпферных колец
    for (let d = 0; d < 3; d++) {
      const elastomer = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.068, 0.042, 16),
        matDarkRubber
      );
      elastomer.rotation.x = Math.PI / 2;
      elastomer.position.set(sx, sy, 0.23 + d * 0.056);
      seismicHammerHead.add(elastomer);
    }
  }

  // Подвижная массивная ударная часть (сжимает подвеску в момент контакта)
  const hammerMass = new THREE.Group();
  hammerMass.name = 'hammerTungstenMass';
  hammerMass.position.set(0, 0, 0.36);
  seismicHammerHead.add(hammerMass);

  // Тыльный корпус ударного блока (Т-образная шейка)
  const hammerNeck = new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 0.68, 0.34),
    matTungsten
  );
  hammerNeck.position.set(0, 0, 0.15);
  hammerMass.add(hammerNeck);

  // Массивная лобовая Т-образная вольфрамовая плита (ширина 1.30 м!)
  const hammerTHead = new THREE.Mesh(
    new THREE.BoxGeometry(1.30, 0.84, 0.26),
    matTungsten
  );
  hammerTHead.position.set(0, 0, 0.42);
  hammerMass.add(hammerTHead);

  // Клиновидные скосы ударного блока (верх, низ и центральное ребро)
  const topWedge = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.16, 0.32),
    matTungsten
  );
  topWedge.position.set(0, 0.38, 0.34);
  topWedge.rotation.x = 0.38;
  hammerMass.add(topWedge);

  const bottomWedge = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.16, 0.32),
    matTungsten
  );
  bottomWedge.position.set(0, -0.38, 0.34);
  bottomWedge.rotation.x = -0.38;
  hammerMass.add(bottomWedge);

  // Центральный вертикальный клиновидный волнорез
  const centerWedgeSpine = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.82, 0.22),
    matTungsten
  );
  centerWedgeSpine.position.set(0, 0, 0.53);
  centerWedgeSpine.rotation.y = Math.PI / 4;
  hammerMass.add(centerWedgeSpine);

  // Сменные накладные бронещёки с заклёпками
  for (const side of [-1, 1]) {
    const cheekPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.72, 0.24),
      matOliveArmor
    );
    cheekPlate.position.set(side * 0.655, 0, 0.41);
    hammerMass.add(cheekPlate);

    addRivetLine(
      headRivetMatrices,
      [side * 0.68, -0.30, 0.33],
      [side * 0.68, 0.30, 0.33],
      6,
      [0, 0, -side * Math.PI / 2],
      1.15
    );
    addRivetLine(
      headRivetMatrices,
      [side * 0.68, -0.30, 0.49],
      [side * 0.68, 0.30, 0.49],
      6,
      [0, 0, -side * Math.PI / 2],
      1.15
    );
  }

  // 4 коротких свайных ударника на лобовой плите (выход до Z = +3.75 м)
  const strikerPositions = [
    [-0.36, 0.21],
    [0.36, 0.21],
    [-0.36, -0.21],
    [0.36, -0.21],
  ];
  for (const [px, py] of strikerPositions) {
    const strikerGroup = new THREE.Group();
    strikerGroup.position.set(px, py, 0.55);
    hammerMass.add(strikerGroup);

    // Направляющая букса свайного бойка
    const bushing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.125, 0.06, 16),
      matPrimerGray
    );
    bushing.rotation.x = Math.PI / 2;
    bushing.position.set(0, 0, 0.03);
    strikerGroup.add(bushing);

    // Сигнальное жёлтое кольцо хода сваи
    const calibRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.092, 0.092, 0.025, 16),
      matHazardYellow
    );
    calibRing.rotation.x = Math.PI / 2;
    calibRing.position.set(0, 0, 0.07);
    strikerGroup.add(calibRing);

    // Цилиндрический вольфрамовый стержень свайного ударника
    const ramShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.086, 0.086, 0.14, 16),
      matTungsten
    );
    ramShaft.rotation.x = Math.PI / 2;
    ramShaft.position.set(0, 0, 0.15);
    strikerGroup.add(ramShaft);

    // Пирамидально-конический твердосплавный наконечник (пик на Z_world = +3.75 м)
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.086, 0.08, 6),
      matTungsten
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0, 0.26);
    strikerGroup.add(tip);
  }

  // Защитные отбойники по периметру Т-образной головки
  for (const ySign of [-1, 1]) {
    const horizBumper = new THREE.Mesh(
      new THREE.BoxGeometry(1.38, 0.065, 0.11),
      matPrimerGray
    );
    horizBumper.position.set(0, ySign * 0.455, 0.44);
    hammerMass.add(horizBumper);

    const rubberPad = new THREE.Mesh(
      new THREE.BoxGeometry(1.22, 0.035, 0.05),
      matDarkRubber
    );
    rubberPad.position.set(0, ySign * 0.495, 0.45);
    hammerMass.add(rubberPad);
  }

  for (const side of [-1, 1]) {
    // Боковые дуговые/балочные отбойники
    const sideFender = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.96, 0.14),
      matHazardYellow
    );
    sideFender.position.set(side * 0.70, 0, 0.43);
    hammerMass.add(sideFender);

    const sideBumperGuard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.92, 12),
      matTungsten
    );
    sideBumperGuard.position.set(side * 0.74, 0, 0.43);
    hammerMass.add(sideBumperGuard);
  }

  // ============================================================================
  // УЗЕЛ 3: rocketThrusterPod — Блок из 3 твердотопливных ускорителей
  // Смонтирован на тыльно-боковой части ударной головки, направлен в сторону -Z / -X
  // ============================================================================
  const rocketThrusterPod = new THREE.Group();
  rocketThrusterPod.name = 'rocketThrusterPod';
  // Крепится к тыльно-правому борту ударной головки и повёрнут на +17° вокруг +Y,
  // чтобы срез сопел (-Z локально) был направлен в сторону (-Z / -X)
  rocketThrusterPod.position.set(0.56, 0.12, -0.08);
  rocketThrusterPod.rotation.set(-0.05, 0.30, 0);
  seismicHammerHead.add(rocketThrusterPod);

  // Силовой пилон крепления ускорительного блока к ударной головке
  const thrusterPylon = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.42, 0.46),
    matPrimerGray
  );
  thrusterPylon.position.set(-0.18, -0.10, 0.06);
  rocketThrusterPod.add(thrusterPylon);

  // Бронекожух блока из 3 ТТД
  const podHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.48, 0.64),
    matOliveArmor
  );
  podHousing.position.set(0, 0, 0.04);
  rocketThrusterPod.add(podHousing);

  // Передний обтекатель-заглушка блока ускорителей
  const podNoseCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.44, 0.12),
    matTungsten
  );
  podNoseCap.position.set(0, 0, 0.38);
  rocketThrusterPod.add(podNoseCap);

  // 3 твердотопливных ускорителя с коническими соплами с побежалостью
  const nozzleCoords = [
    [0.0, 0.125],
    [-0.115, -0.095],
    [0.115, -0.095],
  ];
  const flameCones = [];

  for (const [nx, ny] of nozzleCoords) {
    const boosterGroup = new THREE.Group();
    boosterGroup.position.set(nx, ny, -0.28);
    rocketThrusterPod.add(boosterGroup);

    // Корпус камеры сгорания
    const chamber = new THREE.Mesh(
      new THREE.CylinderGeometry(0.098, 0.098, 0.66, 18),
      matPrimerGray
    );
    chamber.rotation.x = Math.PI / 2;
    chamber.position.set(0, 0, 0.32);
    boosterGroup.add(chamber);

    // Критическое сечение сопла (горловина)
    const throat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.064, 0.07, 18),
      matTungsten
    );
    throat.rotation.x = Math.PI / 2;
    throat.position.set(0, 0, -0.02);
    boosterGroup.add(throat);

    // Коническое расширяющееся сопло с эффектом побежалости металла
    const conicalNozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.064, 0.108, 0.24, 24, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: heatTemperTex,
        metalness: 0.90,
        roughness: 0.28,
        side: THREE.DoubleSide,
      })
    );
    conicalNozzle.rotation.x = Math.PI / 2;
    conicalNozzle.position.set(0, 0, -0.17);
    boosterGroup.add(conicalNozzle);

    // Усилительное кольцо на срезе сопла
    const exitRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.108, 0.008, 10, 24),
      matNozzleTemper
    );
    exitRim.position.set(0, 0, -0.29);
    boosterGroup.add(exitRim);

    // Внутренняя заглушка камеры сгорания
    const innerCore = new THREE.Mesh(
      new THREE.CircleGeometry(0.060, 16),
      new THREE.MeshBasicMaterial({ color: 0x101012 })
    );
    innerCore.rotation.y = Math.PI;
    innerCore.position.set(0, 0, -0.05);
    boosterGroup.add(innerCore);

    // Реактивный факел (используется в тестовой анимации при розжиге)
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff9436,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flameCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 1.15, 16, 1, true),
      flameMat
    );
    flameCone.rotation.x = -Math.PI / 2;
    flameCone.position.set(0, 0, -0.86);
    boosterGroup.add(flameCone);
    flameCones.push(flameCone);
  }

  // Многослойные термозащитные экраны (защищают кабели и демпфер от струи ТТД)
  const innerHeatShield = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.56, 0.62),
    matNozzleTemper
  );
  innerHeatShield.position.set(-0.255, -0.02, -0.26);
  innerHeatShield.rotation.y = -0.14;
  rocketThrusterPod.add(innerHeatShield);

  const lowerHeatShield = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.032, 0.58),
    matPrimerGray
  );
  lowerHeatShield.position.set(-0.02, -0.275, -0.26);
  lowerHeatShield.rotation.x = 0.12;
  rocketThrusterPod.add(lowerHeatShield);

  const upperHeatBaffle = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.028, 0.50),
    matPrimerGray
  );
  upperHeatBaffle.position.set(0, 0.265, -0.22);
  rocketThrusterPod.add(upperHeatBaffle);

  // Заклёпки на кожухе ускорительного блока
  addRivetLine(
    headRivetMatrices,
    [0.232, -0.20, -0.24],
    [0.232, -0.20, 0.32],
    6,
    [0, 0, -Math.PI / 2]
  );
  addRivetLine(
    headRivetMatrices,
    [0.232, 0.20, -0.24],
    [0.232, 0.20, 0.32],
    6,
    [0, 0, -Math.PI / 2]
  );

  // ============================================================================
  // 5. INSTANCEDMESH ДЛЯ ВСЕХ ЗАКЛЁПОК
  // ============================================================================
  const rivetGeo = new THREE.CylinderGeometry(0.009, 0.011, 0.012, 8);
  rivetGeo.translate(0, 0.005, 0);

  const staticRivets = new THREE.InstancedMesh(
    rivetGeo,
    matTungsten,
    staticRivetMatrices.length
  );
  staticRivets.name = 'staticRivetsInstanced';
  staticRivetMatrices.forEach((m, idx) => staticRivets.setMatrixAt(idx, m));
  staticRivets.instanceMatrix.needsUpdate = true;
  root.add(staticRivets);

  // Заклёпки на подвижной ударной головке привязаны к hammerMass (в её локальных координатах)
  // Переводим матрицы заклёпок головки в локальное пространство hammerMass
  root.updateMatrixWorld(true);
  const invHammerWorld = hammerMass.matrixWorld.clone().invert();
  const headRivets = new THREE.InstancedMesh(
    rivetGeo,
    matChrome,
    headRivetMatrices.length
  );
  headRivets.name = 'headRivetsInstanced';
  headRivetMatrices.forEach((m, idx) => {
    // Для заклёпок на cheekPlate (уже заданы в координатах hammerMass)
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    if (Math.abs(pos.x) > 0.6) {
      headRivets.setMatrixAt(idx, m);
    } else {
      // Заклёпки из локального пространства rocketThrusterPod
      const worldM = m.clone().premultiply(rocketThrusterPod.matrixWorld);
      worldM.premultiply(invHammerWorld);
      headRivets.setMatrixAt(idx, worldM);
    }
  });
  headRivets.instanceMatrix.needsUpdate = true;
  hammerMass.add(headRivets);

  // Сохраняем ссылки на узлы для анимации и телеметрии
  root.userData.parts = {
    mountFlange,
    chassisBeam,
    rocketThrusterPod,
    seismicHammerHead,
    hammerMass,
    recoilDampers,
    flameCones,
  };

  return root;
}

// ============================================================================
// Адаптер под единый просмотрщик: поза боевого цикла 3.4 с по фазе t.
// Замах (0–1.15) → реактивный рывок ТТД (1.15–1.58) → сейсмоудар (1.58–2.05)
// → возврат (2.05–3.4). Движение предплечья применяется к корню модели.
// Возвращает { power, compression } для телеметрии.
// =========================================================================
const smoothstep01 = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

function applyCyclePhase(root, cycle) {
  const P = root.userData.parts;
  const baseHammerZ = 0.36;

  let armZ = 0;
  let armY = 0;
  let armPitch = 0;
  let armYaw = 0;
  let thrusterPower = 0;
  let suspensionCompression = 0;

  if (cycle < 1.15) {
    // Фаза 1: тяжёлый замах назад (-Z) и вверх
    const k = smoothstep01(0.0, 1.05, cycle);
    armZ = -0.82 * k;
    armY = 0.22 * k;
    armPitch = -0.14 * k;
    armYaw = 0.08 * k;
  } else if (cycle < 1.58) {
    // Фаза 2: розжиг ТТД и реактивный рывок вперёд (+Z)
    const k = smoothstep01(1.15, 1.56, cycle);
    const accel = k * k;
    armZ = THREE.MathUtils.lerp(-0.82, 0.52, accel);
    armY = THREE.MathUtils.lerp(0.22, -0.02, accel);
    armPitch = THREE.MathUtils.lerp(-0.14, 0.02, accel);
    armYaw = THREE.MathUtils.lerp(0.08, -0.015, accel);
    thrusterPower = Math.sin(Math.min(1, Math.max(0, (cycle - 1.15) / 0.43)) * Math.PI);
  } else if (cycle < 2.05) {
    // Фаза 3: сейсмоудар, сжатие подвески и внешних демпферов
    const impactT = (cycle - 1.58) / 0.47;
    const shockWave = Math.exp(-impactT * 5.5) * Math.sin(impactT * Math.PI * 3);
    suspensionCompression = 0.17 * Math.exp(-impactT * 4.2) * Math.sin(Math.min(1, impactT * 3) * (Math.PI / 2));
    armZ = 0.52 - 0.14 * smoothstep01(0.0, 1.0, impactT) + shockWave * 0.03;
    armY = shockWave * 0.025;
    armPitch = 0.02 + shockWave * 0.02;
    thrusterPower = Math.max(0, 1 - impactT * 5) * 0.5;
  } else {
    // Фаза 4: возврат подвески и стабилизация
    const rec = smoothstep01(2.05, 3.30, cycle);
    armZ = THREE.MathUtils.lerp(0.38, 0.0, rec);
    armPitch = THREE.MathUtils.lerp(0.02, 0.0, rec);
    armYaw = THREE.MathUtils.lerp(-0.015, 0.0, rec);
  }

  root.position.set(0, armY, armZ);
  root.rotation.set(armPitch, armYaw, 0);

  P.hammerMass.position.z = baseHammerZ - suspensionCompression;
  for (const damper of P.recoilDampers) {
    damper.pistonAssembly.position.z = 1.24 - suspensionCompression * 0.85;
    damper.springGroup.scale.z = 1.0 - suspensionCompression * 1.65;
  }

  for (const flame of P.flameCones) {
    flame.material.opacity = thrusterPower * (0.75 + Math.random() * 0.25);
    const flicker = 0.85 + Math.random() * 0.35;
    flame.scale.set(1, flicker * Math.max(0.01, thrusterPower), 1);
  }

  return { power: thrusterPower, compression: suspensionCompression };
}

export function createWeapon() {
  const root = createWeaponPMK100MolotM();
  const ud = root.userData;

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  ud.setExtension = (phase) => {
    const t = Math.max(0, Math.min(CYCLE - 0.001, phase));
    return applyCyclePhase(root, t);
  };
  ud.applyPhase = (t) => applyCyclePhase(root, t);
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  applyCyclePhase(root, 0);
  return root;
}
