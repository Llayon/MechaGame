import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 'm720',
  code: '9М720',
  title: '9М720 «Искандер-М»',
  subtitle: 'СВЕРХТЯЖЁЛЫЙ ПУСКОВОЙ КОМПЛЕКС ОТРК • СЛОТ SUPERHEAVY • ЦИКЛ 14 С',
  description: 'Сверхтяжёлый пусковой комплекс: сдвоенный лафет УСП с гидрозамками, подъёмный бронированный модуль на 2 ракеты 9М720, створки шахты на 110°, РЛС-наведение, телескопические гидроподъёмники. Цикл 14 с: подъём 45° → открытие створок → готовность → сворачивание.',
  specs: [
    ['Ракеты', '2 × 9М720'],
    ['Слот', 'SUPERHEAVY'],
    ['Возвышение', '0–45°'],
    ['Створки', '±110°'],
    ['Цикл', '14 с'],
    ['Масса снаряж.', '8450 кг'],
  ],
  maxExtension: 14.0,
  unit: 's',
  tipOffset: 2.30,
  subgroups: [
    { key: 'mountFlange', label: '1. Сдвоенный лафет УСП' },
    { key: 'launcherPodGroup', label: '2. Подъёмный пусковой модуль' },
    { key: 'hatchDoorsGroup', label: '3. Створки шахты' },
    { key: 'missilesGroup', label: '4. Ракеты 9М720' },
  ],
  cameras: {
    module: { pos: [4.8, 2.9, 5.4], target: [0, 1.15, 0.35] },
  },
  rangeMarkers: [],
  controls: 'tel',
};

const TEL_CYCLE = 14.0;
const TEL_MAX_ELEV = Math.PI / 4;
const TEL_MAX_DOOR = (110 * Math.PI) / 180;

/**
 * Создаёт процедурную 3D-модель сверхтяжёлого пускового комплекса 9М720 «Искандер-М»
 * для установки на спинной или плечевой слот SUPERHEAVY тяжёлого меха.
 *
 * Система координат:
 * - 1 unit = 1 метр
 * - Вытянут вдоль +Z, верх +Y, бок +X
 * - (0, 0, 0) — центр сдвоенного силового лафета-фланца УСП
 *
 * @returns {THREE.Group} Корневая группа пускового комплекса
 */
export function createWeapon9M720IskanderM() {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'Weapon_9M720_IskanderM';

  // ============================================================================
  // 1. ПРОЦЕДУРНЫЕ ТЕКСТУРЫ И PBR-МАТЕРИАЛЫ
  // ============================================================================

  // Процедурная карта шероховатости и микрорельефа для советской катаной брони
  function createArmorSurfaceMaps() {
    const size = 512;
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext('2d');

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d');

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    rCtx.fillStyle = '#adadae'; // ~0.68 базовый уровень
    rCtx.fillRect(0, 0, size, size);

    // Зернистость порошковой/матовой краски и следы проката металла
    for (let i = 0; i < 6500; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 0.6 + Math.random() * 1.8;
      const shade = Math.floor(112 + Math.random() * 32);
      bCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
      bCtx.fillRect(x, y, r, r);

      const rShade = Math.floor(150 + Math.random() * 55);
      rCtx.fillStyle = `rgba(${rShade},${rShade},${rShade},0.35)`;
      rCtx.fillRect(x, y, r * 1.5, r * 1.5);
    }

    // Лёгкие эксплуатационные потёртости
    rCtx.strokeStyle = 'rgba(110, 110, 110, 0.25)';
    for (let i = 0; i < 45; i++) {
      rCtx.lineWidth = 0.5 + Math.random() * 1.5;
      rCtx.beginPath();
      const sx = Math.random() * size;
      const sy = Math.random() * size;
      rCtx.moveTo(sx, sy);
      rCtx.lineTo(sx + (Math.random() - 0.5) * 60, sy + (Math.random() - 0.5) * 60);
      rCtx.stroke();
    }

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.repeat.set(3, 3);

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(3, 3);

    return { bumpMap, roughnessMap };
  }

  // Процедурная декаль бортовой маркировки: Красная звезда, «9М720», «ОПАСНАЯ ЗОНА ГАЗОВОЙ СТРУИ»
  function createSideStencilTexture(isRightSide = true) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Вспомогательная функция рисования пятиконечной звезды с двойной окантовкой
    const drawSovietStar = (cx, cy, outerR) => {
      const innerR = outerR * 0.382;
      const traceStar = (rOut, rIn) => {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const angle = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 === 0 ? rOut : rIn;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      };

      // Внешняя красная окантовка
      traceStar(outerR, innerR);
      ctx.fillStyle = '#a81e1b';
      ctx.fill();

      // Белая окантовка
      traceStar(outerR * 0.87, innerR * 0.87);
      ctx.fillStyle = '#e8e6df';
      ctx.fill();

      // Внутренняя алая звезда
      traceStar(outerR * 0.77, innerR * 0.77);
      ctx.fillStyle = '#b9201c';
      ctx.fill();
    };

    // Полоса предупреждения о газовой струе (жёлто-чёрная диагональ + текст)
    const drawBlastWarning = (x, y, w, h) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      ctx.fillStyle = '#d49b1a';
      ctx.fillRect(x, y, w, h);

      ctx.fillStyle = '#181a1b';
      const stripeW = 24;
      for (let sx = x - h; sx < x + w + h; sx += stripeW * 2) {
        ctx.beginPath();
        ctx.moveTo(sx, y + h);
        ctx.lineTo(sx + stripeW, y + h);
        ctx.lineTo(sx + stripeW + h, y);
        ctx.lineTo(sx + h, y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Рамка и подложка под текст
      ctx.strokeStyle = '#d49b1a';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = 'rgba(20, 22, 20, 0.92)';
      ctx.fillRect(x + 8, y + h + 8, w - 16, 44);

      ctx.fillStyle = '#e5b52b';
      ctx.font = 'bold 25px "Arial Narrow", "Impact", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ОПАСНАЯ ЗОНА ГАЗОВОЙ СТРУИ', x + w / 2, y + h + 31);
    };

    // Размещение элементов в зависимости от борта (чтобы нос всегда был в сторону +Z)
    const starX = isRightSide ? 1620 : 428;
    const indexX = isRightSide ? 1140 : 908;
    const warnX = isRightSide ? 110 : 1298;

    drawSovietStar(starX, 225, 118);

    // Трафаретный индекс «9М720»
    ctx.save();
    ctx.fillStyle = 'rgba(232, 230, 220, 0.92)';
    ctx.font = '900 132px "Impact", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('9М720', indexX, 205);

    // Имитация трафаретных перемычек (тонкие линии цвета фона)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(indexX - 240, 198, 480, 5);
    ctx.restore();

    // Подпись комплекса и технические индексы
    ctx.fillStyle = 'rgba(225, 223, 212, 0.85)';
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ПУСКОВОЙ МОДУЛЬ // ОТРК 9К720', indexX, 305);

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = 'rgba(210, 210, 198, 0.75)';
    ctx.fillText('МАССА СНАРЯЖ. 8450 КГ   |   УГОЛ ПУСКА 45°', indexX, 345);

    // Предупреждение о газовой струе ближе к кормовому срезу
    drawBlastWarning(warnX, 345, 640, 34);

    // Лёгкий эффект потёртости краски трафарета
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 450; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.35})`;
      ctx.fillRect(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        1 + Math.random() * 4,
        1 + Math.random() * 4
      );
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  const { bumpMap, roughnessMap } = createArmorSurfaceMaps();

  const materials = {
    // Основная советская оливково-защитная броня
    oliveArmor: new THREE.MeshStandardMaterial({
      color: 0x475041,
      metalness: 0.40,
      roughness: 0.68,
      bumpMap,
      bumpScale: 0.004,
      roughnessMap
    }),
    // Чуть более тёмный оттенок для силовых шпангоутов и усилений
    oliveDark: new THREE.MeshStandardMaterial({
      color: 0x384033,
      metalness: 0.48,
      roughness: 0.62,
      bumpMap,
      bumpScale: 0.005
    }),
    // Оружейная сталь / силовой каркас УСП / петли / замки
    gunmetal: new THREE.MeshStandardMaterial({
      color: 0x25282a,
      metalness: 0.78,
      roughness: 0.42
    }),
    // Тёмный интерьер пусковых шахт и термоэкранов
    interiorSilo: new THREE.MeshStandardMaterial({
      color: 0x1c1f1d,
      metalness: 0.55,
      roughness: 0.72
    }),
    // Термозащитные экраны (титаново-графитовый сплав)
    thermalShield: new THREE.MeshStandardMaterial({
      color: 0x575b56,
      metalness: 0.65,
      roughness: 0.48
    }),
    // Полированный хром штоков гидроподъёмников
    chrome: new THREE.MeshStandardMaterial({
      color: 0xd4dae0,
      metalness: 0.95,
      roughness: 0.15
    }),
    // Термостойкий корпус баллистических ракет 9М720
    missileBody: new THREE.MeshStandardMaterial({
      color: 0xcfd4d8,
      metalness: 0.35,
      roughness: 0.45
    }),
    // Красные тактические кольца на ракетах и заглушки
    missileRedRing: new THREE.MeshStandardMaterial({
      color: 0xb5241e,
      metalness: 0.30,
      roughness: 0.42
    }),
    // Радиопрозрачный/термостойкий наконечник ГСН
    seekerTip: new THREE.MeshStandardMaterial({
      color: 0x2e3134,
      metalness: 0.50,
      roughness: 0.35
    }),
    // Латунные штуцеры гидролиний
    brass: new THREE.MeshStandardMaterial({
      color: 0xb88b3a,
      metalness: 0.85,
      roughness: 0.30
    }),
    // Амортизирующие резиновые демпферы
    rubber: new THREE.MeshStandardMaterial({
      color: 0x141516,
      metalness: 0.08,
      roughness: 0.88
    })
  };

  // ============================================================================
  // 2. СДВОЕННЫЙ СИЛОВОЙ ЛАФЕТ-ФЛАНЕЦ УСП (`mountFlange`)
  // ============================================================================
  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  rootGroup.add(mountFlange);

  // Главная опорная плита-рама УСП: 1.15 x 0.22 x 1.70 м с центром в (0, 0, 0)
  const basePlateGeo = new THREE.BoxGeometry(1.15, 0.14, 1.70);
  const basePlate = new THREE.Mesh(basePlateGeo, materials.gunmetal);
  basePlate.position.set(0, -0.04, 0);
  basePlate.castShadow = true;
  basePlate.receiveShadow = true;
  mountFlange.add(basePlate);

  // Две продольные силовые балки сдвоенного лафета (верхняя часть рамы до y = +0.11)
  const railGeo = new THREE.BoxGeometry(0.28, 0.08, 1.70);
  [-0.38, 0.38].forEach((xPos) => {
    const rail = new THREE.Mesh(railGeo, materials.oliveDark);
    rail.position.set(xPos, 0.07, 0);
    rail.castShadow = true;
    rail.receiveShadow = true;
    mountFlange.add(rail);

    // Резиновые демпферные подушки сверху лафета
    for (let zPad = -0.65; zPad <= 0.65; zPad += 0.65) {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.03, 0.32),
        materials.rubber
      );
      pad.position.set(xPos, 0.125, zPad);
      mountFlange.add(pad);
    }
  });

  // 8 гидравлических замков крепления к слоту меха (по 4 с каждого борта)
  const lockZPositions = [-0.66, -0.22, 0.22, 0.66];
  [-1, 1].forEach((side) => {
    lockZPositions.forEach((zPos) => {
      const lockGroup = new THREE.Group();
      lockGroup.position.set(side * 0.59, 0.0, zPos);

      // Корпус гидрозамка
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.18, 0.18),
        materials.oliveArmor
      );
      housing.castShadow = true;
      lockGroup.add(housing);

      // Силовой силовой зацеп-клык
      const claw = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.10, 0.12),
        materials.gunmetal
      );
      claw.position.set(side * 0.03, -0.09, 0);
      lockGroup.add(claw);

      // Малый гидроцилиндр стопора с хромированным штоком
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 0.12, 12),
        materials.gunmetal
      );
      cyl.position.set(side * 0.02, 0.09, 0);
      lockGroup.add(cyl);

      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.08, 12),
        materials.chrome
      );
      pin.position.set(side * 0.02, 0.15, 0);
      lockGroup.add(pin);

      // Латунный штуцер гидроподвода
      const fitting = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.03, 8),
        materials.brass
      );
      fitting.rotation.z = Math.PI / 2;
      fitting.position.set(side * 0.06, 0.04, 0.05);
      lockGroup.add(fitting);

      mountFlange.add(lockGroup);
    });
  });

  // Кормовые силовые кронштейны шарнирного узла подъёма контейнера (вынос до z = -1.95)
  const pivotY = 0.28;
  const pivotZ = -1.95;

  [-0.46, 0.46].forEach((xPos) => {
    // Нижняя продольная консоль подрамника к шарниру
    const boom = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 1.35),
      materials.gunmetal
    );
    boom.position.set(xPos, -0.02, -1.40);
    boom.castShadow = true;
    mountFlange.add(boom);

    // Вертикальная треугольная проушина (щёки шарнира)
    const lugShape = new THREE.Shape();
    lugShape.moveTo(-0.22, -0.10);
    lugShape.lineTo(0.32, -0.10);
    lugShape.lineTo(0.10, 0.34);
    lugShape.lineTo(-0.14, 0.34);
    lugShape.closePath();

    const lugGeo = new THREE.ExtrudeGeometry(lugShape, {
      depth: 0.07,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2
    });
    lugGeo.rotateY(Math.PI / 2);

    const lug = new THREE.Mesh(lugGeo, materials.oliveDark);
    lug.position.set(xPos - 0.035, 0.04, pivotZ);
    lug.castShadow = true;
    mountFlange.add(lug);
  });

  // Главный поперечный силовой вал-ось шарнира
  const mainPivotShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 1.18, 24),
    materials.chrome
  );
  mainPivotShaft.rotation.z = Math.PI / 2;
  mainPivotShaft.position.set(0, pivotY, pivotZ);
  mainPivotShaft.castShadow = true;
  mountFlange.add(mainPivotShaft);

  // Торцевые крышки подшипниковых узлов
  [-0.60, 0.60].forEach((xCap) => {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.04, 16),
      materials.gunmetal
    );
    cap.rotation.z = Math.PI / 2;
    cap.position.set(xCap, pivotY, pivotZ);
    mountFlange.add(cap);
  });

  // ============================================================================
  // 3. ПОДЪЁМНЫЙ ПУСКОВОЙ МОДУЛЬ (`launcherPodGroup`)
  // ============================================================================
  // Точка пивота совпадает с осью шарнира (0, 0.28, -1.95).
  // При rotation.x = 0:
  //   - Габариты бронекороба: 1.35 (X) x 1.15 (Y) x 4.60 (Z) м
  //   - Передний срез шахты находится точно на world z = +2.30 (local z = +4.25)
  //   - Кормовой срез находится на world z = -2.30 (local z = -0.35)
  const launcherPodGroup = new THREE.Group();
  launcherPodGroup.name = 'launcherPodGroup';
  launcherPodGroup.position.set(0, pivotY, pivotZ);
  rootGroup.add(launcherPodGroup);

  const podWidth = 1.35;
  const podHeight = 1.15;
  const podLength = 4.60;
  const podCenterY = 0.445; // world y = 0.28 + 0.445 = 0.725 (низ на 0.15, верх на 1.30)
  const podCenterZ = 1.95;  // world z = -1.95 + 1.95 = 0.0 (перед на +2.30, зад на -2.30)
  const wallT = 0.055;

  // 3.1. Сварной бронированный короб (полый внутри для размещения двух ракет)
  const podShellGroup = new THREE.Group();
  podShellGroup.name = 'podArmorShell';
  launcherPodGroup.add(podShellGroup);

  // Верхняя и нижняя бронеплиты
  const topPlate = new THREE.Mesh(
    new THREE.BoxGeometry(podWidth, wallT, podLength),
    materials.oliveArmor
  );
  topPlate.position.set(0, podCenterY + podHeight / 2 - wallT / 2, podCenterZ);
  topPlate.castShadow = true;
  topPlate.receiveShadow = true;
  podShellGroup.add(topPlate);

  const bottomPlate = new THREE.Mesh(
    new THREE.BoxGeometry(podWidth, wallT, podLength),
    materials.oliveArmor
  );
  bottomPlate.position.set(0, podCenterY - podHeight / 2 + wallT / 2, podCenterZ);
  bottomPlate.castShadow = true;
  bottomPlate.receiveShadow = true;
  podShellGroup.add(bottomPlate);

  // Левая и правая бортовые бронеплиты
  const sideHeight = podHeight - wallT * 2;
  [-1, 1].forEach((side) => {
    const sidePlate = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, sideHeight, podLength),
      materials.oliveArmor
    );
    sidePlate.position.set(
      side * (podWidth / 2 - wallT / 2),
      podCenterY,
      podCenterZ
    );
    sidePlate.castShadow = true;
    sidePlate.receiveShadow = true;
    podShellGroup.add(sidePlate);
  });

  // Внутренняя продольная перегородка между двумя пусковыми шахтами
  const centerBulkhead = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, sideHeight, podLength - 0.12),
    materials.interiorSilo
  );
  centerBulkhead.position.set(0, podCenterY, podCenterZ - 0.04);
  podShellGroup.add(centerBulkhead);

  // Кормовой газоотводный бронещит (задняя стенка с выхлопными дефлекторами)
  const rearBulkhead = new THREE.Mesh(
    new THREE.BoxGeometry(podWidth - 0.02, podHeight - 0.02, 0.09),
    materials.oliveDark
  );
  rearBulkhead.position.set(0, podCenterY, podCenterZ - podLength / 2 + 0.045);
  rearBulkhead.castShadow = true;
  podShellGroup.add(rearBulkhead);

  // Газоотводные жалюзи/сопла вышибных панелей сзади
  [-0.33, 0.33].forEach((xBay) => {
    const exhaustFrame = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.29, 0.12, 20),
      materials.gunmetal
    );
    exhaustFrame.rotation.x = Math.PI / 2;
    exhaustFrame.position.set(xBay, podCenterY, podCenterZ - podLength / 2 - 0.02);
    podShellGroup.add(exhaustFrame);

    const blastCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.04, 20),
      materials.missileRedRing
    );
    blastCap.rotation.x = Math.PI / 2;
    blastCap.position.set(xBay, podCenterY, podCenterZ - podLength / 2 - 0.07);
    podShellGroup.add(blastCap);
  });

  // Проушины крепления модуля к шарниру на нижней части короба
  [-0.37, 0.37].forEach((xLug) => {
    const podLug = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.26, 0.34),
      materials.gunmetal
    );
    podLug.position.set(xLug, -0.06, 0.02);
    podLug.castShadow = true;
    podShellGroup.add(podLug);
  });

  // 3.2. Мощные поперечные шпангоуты (рёбра жёсткости по периметру короба)
  const ribZPositions = [-0.22, 0.55, 1.35, 2.15, 2.95, 3.75, 4.16];
  ribZPositions.forEach((zRib, idx) => {
    const isEndFrame = idx === 0 || idx === ribZPositions.length - 1;
    const ribThickness = isEndFrame ? 0.09 : 0.065;
    const ribProtrusion = isEndFrame ? 0.045 : 0.032;

    const frameGroup = new THREE.Group();
    frameGroup.position.set(0, podCenterY, zRib);

    // Верхний пояс шпангоута
    const topRib = new THREE.Mesh(
      new THREE.BoxGeometry(podWidth + ribProtrusion * 2, ribProtrusion, ribThickness),
      materials.oliveDark
    );
    topRib.position.y = podHeight / 2 + ribProtrusion / 2;
    topRib.castShadow = true;
    frameGroup.add(topRib);

    // Нижний пояс шпангоута
    const botRib = new THREE.Mesh(
      new THREE.BoxGeometry(podWidth + ribProtrusion * 2, ribProtrusion, ribThickness),
      materials.oliveDark
    );
    botRib.position.y = -podHeight / 2 - ribProtrusion / 2;
    botRib.castShadow = true;
    frameGroup.add(botRib);

    // Боковые стойки шпангоута
    [-1, 1].forEach((side) => {
      const sideRib = new THREE.Mesh(
        new THREE.BoxGeometry(ribProtrusion, podHeight + ribProtrusion * 2, ribThickness),
        materials.oliveDark
      );
      sideRib.position.x = side * (podWidth / 2 + ribProtrusion / 2);
      sideRib.castShadow = true;
      frameGroup.add(sideRib);

      // Косынки-усилители по углам
      [-1, 1].forEach((vDir) => {
        const gusset = new THREE.Mesh(
          new THREE.BoxGeometry(ribProtrusion + 0.015, 0.11, ribThickness + 0.01),
          materials.gunmetal
        );
        gusset.position.set(
          side * (podWidth / 2 + ribProtrusion / 2),
          vDir * (podHeight / 2 - 0.02),
          0
        );
        frameGroup.add(gusset);
      });
    });

    launcherPodGroup.add(frameGroup);
  });

  // 3.3. Защитные термоэкраны на крыше и бортах
  const thermalGroup = new THREE.Group();
  thermalGroup.name = 'thermalShields';
  launcherPodGroup.add(thermalGroup);

  // Верхние секционные термоэкраны с вентиляционным зазором
  [0.95, 2.55, 3.45].forEach((zSection, i) => {
    const secLen = i === 0 ? 1.35 : 0.72;
    const shield = new THREE.Mesh(
      new THREE.BoxGeometry(1.16, 0.025, secLen),
      materials.thermalShield
    );
    shield.position.set(0, podCenterY + podHeight / 2 + 0.055, zSection);
    shield.castShadow = true;
    shield.receiveShadow = true;
    thermalGroup.add(shield);

    // Продольные рёбра гофрирования термоэкрана
    for (let xSlit = -0.45; xSlit <= 0.45; xSlit += 0.15) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.018, secLen - 0.04),
        materials.oliveDark
      );
      fin.position.set(xSlit, podCenterY + podHeight / 2 + 0.072, zSection);
      thermalGroup.add(fin);
    }
  });

  // 3.4. Бортовые трафаретные маркировки («9М720», красная звезда, «ОПАСНАЯ ЗОНА ГАЗОВОЙ СТРУИ»)
  const rightDecalMat = new THREE.MeshStandardMaterial({
    map: createSideStencilTexture(true),
    transparent: true,
    roughness: 0.65,
    metalness: 0.25,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2
  });

  const leftDecalMat = new THREE.MeshStandardMaterial({
    map: createSideStencilTexture(false),
    transparent: true,
    roughness: 0.65,
    metalness: 0.25,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2
  });

  const decalGeo = new THREE.PlaneGeometry(4.15, 1.02);

  // Правый борт (+X)
  const rightDecal = new THREE.Mesh(decalGeo, rightDecalMat);
  rightDecal.rotation.y = Math.PI / 2;
  rightDecal.position.set(podWidth / 2 + 0.004, podCenterY, podCenterZ);
  launcherPodGroup.add(rightDecal);

  // Левый борт (-X)
  const leftDecal = new THREE.Mesh(decalGeo, leftDecalMat);
  leftDecal.rotation.y = -Math.PI / 2;
  leftDecal.position.set(-podWidth / 2 - 0.004, podCenterY, podCenterZ);
  launcherPodGroup.add(leftDecal);

  // 3.5. Лестница обслуживания сбоку (на правом борту +X ближе к корме)
  const ladderGroup = new THREE.Group();
  ladderGroup.name = 'serviceLadder';
  ladderGroup.position.set(podWidth / 2 + 0.075, podCenterY, 0.16);
  launcherPodGroup.add(ladderGroup);

  const ladderHeight = 1.06;
  const ladderWidth = 0.34;
  [-ladderWidth / 2, ladderWidth / 2].forEach((zRail) => {
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, ladderHeight, 12),
      materials.gunmetal
    );
    rail.position.set(0, 0, zRail);
    rail.castShadow = true;
    ladderGroup.add(rail);

    // Кронштейны крепления лестницы к бронекоробу
    [-0.42, 0.42].forEach((yBracket) => {
      const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.025, 0.025),
        materials.oliveDark
      );
      bracket.position.set(-0.04, yBracket, zRail);
      ladderGroup.add(bracket);
    });
  });

  // Ступени лестницы с противоскользящей насечкой
  for (let yStep = -0.44; yStep <= 0.44; yStep += 0.22) {
    const rung = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, ladderWidth, 10),
      materials.chrome
    );
    rung.rotation.x = Math.PI / 2;
    rung.position.set(0, yStep, 0);
    rung.castShadow = true;
    ladderGroup.add(rung);
  }

  // Поручни на крыше у выхода с лестницы
  [-0.17, 0.17].forEach((zGrab) => {
    const grabHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.025, 0.025),
      materials.gunmetal
    );
    grabHandle.position.set(-0.18, ladderHeight / 2 + 0.06, zGrab);
    ladderGroup.add(grabHandle);
  });

  // ============================================================================
  // 4. СТВОРКИ ПУСКОВОЙ ШАХТЫ (`hatchDoorsGroup`) — на переднем срезе (world z = 2.3)
  // ============================================================================
  const frontPlaneZ = podCenterZ + podLength / 2; // local z = 4.25 (world z = 2.30)

  const hatchDoorsGroup = new THREE.Group();
  hatchDoorsGroup.name = 'hatchDoorsGroup';
  hatchDoorsGroup.position.set(0, podCenterY, frontPlaneZ);
  launcherPodGroup.add(hatchDoorsGroup);

  const doorWidth = podWidth / 2 - 0.008;
  const doorHeight = podHeight - 0.02;
  const doorDepth = 0.075;

  function createArmoredHatchDoor(isLeft) {
    const sideSign = isLeft ? -1 : 1;
    // Пивот двери расположен строго на внешней петле
    const doorPivot = new THREE.Group();
    doorPivot.name = isLeft ? 'leftDoorPivot' : 'rightDoorPivot';
    doorPivot.position.set(sideSign * (podWidth / 2), 0, 0);

    // Основная бронеплита створки (смещена от петли к центру на половину ширины)
    const doorSlab = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth),
      materials.oliveArmor
    );
    doorSlab.position.set(-sideSign * (doorWidth / 2), 0, doorDepth / 2);
    doorSlab.castShadow = true;
    doorSlab.receiveShadow = true;
    doorPivot.add(doorSlab);

    // Силовые внешние рёбра жёсткости створки
    [-0.36, 0, 0.36].forEach((yRib) => {
      const hRib = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth - 0.06, 0.055, 0.035),
        materials.oliveDark
      );
      hRib.position.set(-sideSign * (doorWidth / 2), yRib, doorDepth + 0.015);
      hRib.castShadow = true;
      doorPivot.add(hRib);
    });

    // Вертикальный притворный уплотнитель и запорные клинья по центру
    const centerSeal = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, doorHeight - 0.04, doorDepth + 0.02),
      materials.rubber
    );
    centerSeal.position.set(-sideSign * (doorWidth - 0.01), 0, doorDepth / 2);
    doorPivot.add(centerSeal);

    // Внутренний теплоотражающий экран створки
    const innerLiner = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth - 0.08, doorHeight - 0.10, 0.018),
      materials.thermalShield
    );
    innerLiner.position.set(-sideSign * (doorWidth / 2), 0, 0.005);
    doorPivot.add(innerLiner);

    // Три массивные шарнирные петли с хромированными пальцами
    [-0.38, 0, 0.38].forEach((yHinge) => {
      const hingeBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.14, 16),
        materials.gunmetal
      );
      hingeBarrel.position.set(0, yHinge, 0.035);
      hingeBarrel.castShadow = true;
      doorPivot.add(hingeBarrel);

      const hingePin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.17, 12),
        materials.chrome
      );
      hingePin.position.set(0, yHinge, 0.035);
      doorPivot.add(hingePin);
    });

    return doorPivot;
  }

  const leftDoorPivot = createArmoredHatchDoor(true);
  const rightDoorPivot = createArmoredHatchDoor(false);
  hatchDoorsGroup.add(leftDoorPivot, rightDoorPivot);

  // ============================================================================
  // 5. БОЕВЫЕ БАЛЛИСТИЧЕСКИЕ РАКЕТЫ 9М720 ВНУТРИ ШАХТ (`missilesGroup`)
  // ============================================================================
  const missilesGroup = new THREE.Group();
  missilesGroup.name = 'missilesGroup';
  launcherPodGroup.add(missilesGroup);

  function createBallisticMissile9M720(name) {
    const missile = new THREE.Group();
    missile.name = name;

    const bodyRadius = 0.225;
    const bodyLength = 2.95;

    // 1) Цилиндрический корпус ступени (вытянут вдоль +Z)
    const bodyGeo = new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyLength, 32);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMesh = new THREE.Mesh(bodyGeo, materials.missileBody);
    bodyMesh.position.z = 1.65;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    missile.add(bodyMesh);

    // 2) Оживальный конический головной обтекатель (LatheGeometry для плавного профиля)
    const nosePoints = [];
    const noseLen = 1.15;
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments; // 0 у основания, 1 на острие
      const z = t * noseLen;
      // Оживальный профиль с лёгким притуплением радиопрозрачного наконечника
      const r = bodyRadius * Math.pow(1 - t, 0.78) * (1 - 0.12 * t) + 0.018 * (1 - t);
      nosePoints.push(new THREE.Vector2(Math.max(r, 0.014), z));
    }
    const noseGeo = new THREE.LatheGeometry(nosePoints, 32);
    noseGeo.rotateX(Math.PI / 2);
    const noseMesh = new THREE.Mesh(noseGeo, materials.missileBody);
    noseMesh.position.z = 1.65 + bodyLength / 2;
    noseMesh.castShadow = true;
    missile.add(noseMesh);

    // Металлический/радиопрозрачный наконечник ГСН
    const tipGeo = new THREE.ConeGeometry(0.036, 0.11, 20);
    tipGeo.rotateX(Math.PI / 2);
    const tipMesh = new THREE.Mesh(tipGeo, materials.seekerTip);
    tipMesh.position.z = 1.65 + bodyLength / 2 + noseLen + 0.02;
    missile.add(tipMesh);

    // 3) Красные тактические маркировочные кольца и силовые шпангоуты
    const ringZPositions = [0.45, 1.55, 2.75, 3.12];
    ringZPositions.forEach((zRing, idx) => {
      const isRed = idx === 1 || idx === 3;
      const ringGeo = new THREE.CylinderGeometry(
        bodyRadius + 0.004,
        bodyRadius + 0.004,
        isRed ? 0.065 : 0.035,
        32
      );
      ringGeo.rotateX(Math.PI / 2);
      const ring = new THREE.Mesh(
        ringGeo,
        isRed ? materials.missileRedRing : materials.gunmetal
      );
      ring.position.z = zRing;
      missile.add(ring);
    });

    // Продольный гаргрот кабельной трассы
    const raceway = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.025, 2.65),
      materials.missileBody
    );
    raceway.position.set(0, bodyRadius + 0.006, 1.72);
    missile.add(raceway);

    // 4) Хвостовой отсек, сопловой блок и 4 складных аэродинамических руля
    const tailSkirtGeo = new THREE.CylinderGeometry(bodyRadius * 0.86, bodyRadius, 0.28, 28);
    tailSkirtGeo.rotateX(Math.PI / 2);
    const tailSkirt = new THREE.Mesh(tailSkirtGeo, materials.gunmetal);
    tailSkirt.position.z = 0.04;
    missile.add(tailSkirt);

    // 4 складных аэродинамических руля, прижатых к корпусу в транспортном положении
    for (let f = 0; f < 4; f++) {
      const angle = Math.PI / 4 + (f * Math.PI) / 2;
      const finPivot = new THREE.Group();
      finPivot.rotation.z = angle;
      finPivot.position.z = 0.36;

      // Сложенное крыло-руль вдоль корпуса
      const finBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.055, 0.56),
        materials.thermalShield
      );
      finBlade.position.set(0, bodyRadius + 0.022, 0.12);
      finPivot.add(finBlade);

      // Шарнирный узел раскрытия руля
      const finHinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.05, 12),
        materials.gunmetal
      );
      finHinge.rotation.z = Math.PI / 2;
      finHinge.position.set(0, bodyRadius + 0.008, -0.14);
      finPivot.add(finHinge);

      missile.add(finPivot);
    }

    return missile;
  }

  // Размещаем две ракеты в левой и правой пусковых шахтах + направляющие ложементы
  [-0.33, 0.33].forEach((xBay, idx) => {
    const missile = createBallisticMissile9M720(idx === 0 ? 'missile_9M720_L' : 'missile_9M720_R');
    missile.position.set(xBay, podCenterY - 0.02, -0.12);
    missilesGroup.add(missile);

    // Кольцевые пусковые направляющие внутри шахты
    [0.85, 2.45, 3.85].forEach((zCradle) => {
      const cradleRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.258, 0.022, 10, 28),
        materials.gunmetal
      );
      cradleRing.position.set(xBay, podCenterY - 0.02, zCradle);
      launcherPodGroup.add(cradleRing);
    });
  });

  // ============================================================================
  // 6. ДВА ТЕЛЕСКОПИЧЕСКИХ ГИДРОПОДЪЁМНИКА СНИЗУ (ХРОМИРОВАННЫЕ ШТОКИ)
  // ============================================================================
  const hydraulicsGroup = new THREE.Group();
  hydraulicsGroup.name = 'hydraulicLifts';
  rootGroup.add(hydraulicsGroup);

  const hydraulicRams = [];

  [-0.38, 0.38].forEach((xRam) => {
    // Нижняя проушина на силовом лафете mountFlange
    const lowerAnchor = new THREE.Object3D();
    lowerAnchor.position.set(xRam, 0.06, -0.35);
    mountFlange.add(lowerAnchor);

    const lowerClevis = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.10, 0.14),
      materials.gunmetal
    );
    lowerClevis.position.copy(lowerAnchor.position);
    mountFlange.add(lowerClevis);

    // Верхняя проушина под днищем подъёмного модуля launcherPodGroup
    const upperAnchor = new THREE.Object3D();
    upperAnchor.position.set(xRam, podCenterY - podHeight / 2 - 0.01, 2.45);
    launcherPodGroup.add(upperAnchor);

    const upperClevis = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.10, 0.16),
      materials.gunmetal
    );
    upperClevis.position.copy(upperAnchor.position);
    launcherPodGroup.add(upperClevis);

    // Ступень 1: Внешний силовой корпус гидроцилиндра
    const stage1Group = new THREE.Group();
    const stage1Mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.076, 0.78, 20),
      materials.oliveDark
    );
    stage1Mesh.rotation.x = Math.PI / 2;
    stage1Mesh.position.z = 0.39;
    stage1Mesh.castShadow = true;
    stage1Group.add(stage1Mesh);

    // Грязесъёмная манжета цилиндра
    const collar1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.082, 0.05, 20),
      materials.gunmetal
    );
    collar1.rotation.x = Math.PI / 2;
    collar1.position.z = 0.77;
    stage1Group.add(collar1);
    hydraulicsGroup.add(stage1Group);

    // Ступень 2: Средняя телескопическая секция (полированный хром)
    const stage2Group = new THREE.Group();
    const stage2Mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.058, 0.74, 20),
      materials.chrome
    );
    stage2Mesh.rotation.x = Math.PI / 2;
    stage2Mesh.position.z = 0.37;
    stage2Mesh.castShadow = true;
    stage2Group.add(stage2Mesh);

    const collar2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.04, 20),
      materials.gunmetal
    );
    collar2.rotation.x = Math.PI / 2;
    collar2.position.z = 0.73;
    stage2Group.add(collar2);
    hydraulicsGroup.add(stage2Group);

    // Ступень 3: Внутренний шток (полированный хром, крепится к верхнему шарниру)
    const stage3Group = new THREE.Group();
    const stage3Mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.044, 0.044, 0.72, 20),
      materials.chrome
    );
    stage3Mesh.rotation.x = Math.PI / 2;
    stage3Mesh.position.z = 0.36;
    stage3Mesh.castShadow = true;
    stage3Group.add(stage3Mesh);
    hydraulicsGroup.add(stage3Group);

    hydraulicRams.push({
      lowerAnchor,
      upperAnchor,
      stage1Group,
      stage2Group,
      stage3Group
    });
  });

  // Функция кинематического обновления телескопических гидроподъёмников
  const _pLow = new THREE.Vector3();
  const _pHigh = new THREE.Vector3();
  const _dir = new THREE.Vector3();

  function updateHydraulics() {
    rootGroup.updateMatrixWorld(true);

    for (const ram of hydraulicRams) {
      ram.lowerAnchor.getWorldPosition(_pLow);
      ram.upperAnchor.getWorldPosition(_pHigh);

      // Переводим мировые координаты в локальное пространство rootGroup
      rootGroup.worldToLocal(_pLow);
      rootGroup.worldToLocal(_pHigh);

      _dir.subVectors(_pHigh, _pLow);
      const totalDist = _dir.length();
      _dir.normalize();

      // Ступень 1 стоит на нижней опоре и смотрит в верхнюю
      ram.stage1Group.position.copy(_pLow);
      ram.stage1Group.lookAt(
        rootGroup.localToWorld(_pHigh.clone())
      );

      // Ступень 3 стоит на верхней опоре и смотрит в нижнюю
      ram.stage3Group.position.copy(_pHigh);
      ram.stage3Group.lookAt(
        rootGroup.localToWorld(_pLow.clone())
      );

      // Ступень 2 плавно выдвигается пропорционально текущему ходу штока
      const midOffset = Math.max(0.04, (totalDist - 0.74) * 0.5);
      ram.stage2Group.position.copy(_pLow).addScaledVector(_dir, midOffset);
      ram.stage2Group.lookAt(
        rootGroup.localToWorld(_pHigh.clone())
      );
    }
  }

  // Начальная синхронизация положения штоков в походном положении
  updateHydraulics();

  // Сохраняем ссылки на узлы и метод кинематики для удобного управления извне
  rootGroup.userData = {
    mountFlange,
    launcherPodGroup,
    hatchDoorsGroup,
    missilesGroup,
    leftDoorPivot,
    rightDoorPivot,
    updateHydraulics
  };

  return rootGroup;
}

// =========================================================================
// Адаптер под единый просмотрщик: цикл развёртывания 14 с.
// applyTel(t): подъём модуля 45° → открытие створок → готовность → сворачивание.
// Возвращает { elev, doors } для телеметрии.
// =========================================================================
export function createWeapon() {
  const root = createWeapon9M720IskanderM();
  const ud = root.userData;
  const pod = root.getObjectByName('launcherPodGroup');
  const leftDoor = ud.leftDoorPivot;
  const rightDoor = ud.rightDoorPivot;

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

  ud.applyTel = (t) => {
    const tt = Math.max(0, Math.min(TEL_CYCLE, t));
    let elev, door;
    if (tt < 6.2) {
      elev = sstep(1.2, 4.4, tt);
      door = sstep(4.4, 6.2, tt);
    } else {
      door = 1 - sstep(9.8, 11.4, tt);
      elev = 1 - sstep(11.4, 13.8, tt);
    }
    if (pod) pod.rotation.x = -elev * TEL_MAX_ELEV;
    if (leftDoor) leftDoor.rotation.y = -door * TEL_MAX_DOOR;
    if (rightDoor) rightDoor.rotation.y = door * TEL_MAX_DOOR;
    if (typeof ud.updateHydraulics === 'function') ud.updateHydraulics();
    return { elev: elev * 45, doors: door };
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
