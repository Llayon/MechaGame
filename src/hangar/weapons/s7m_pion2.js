import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const meta = {
  id: 's7m',
  code: '2С7М',
  title: '2С7М «Пион-2»',
  subtitle: 'СВЕРХТЯЖЁЛАЯ 240-ММ ОСАДНАЯ ПУШКА-ГАУБИЦА • СЛОТ SUPERHEAVY',
  description: 'Сверхтяжёлая 240-мм осадная пушка-гаубица: сдвоенный лафет УСП на 8 гидрозамках, массивная люлька с 4 гидропневматическими цилиндрами и досылателем, откатной ствол 240 мм с термокожухом и многокамерным дульным тормозом. Откат 0.85 м, выстрел каждые 3.2 с.',
  specs: [
    ['Калибр', '240 мм'],
    ['Слот', 'SUPERHEAVY'],
    ['Откат ствола', '0.85 м'],
    ['Темп', 'Выстрел / 3.2 с'],
    ['Длина модуля', '~5.6 м'],
    ['Накатники', '4 гидроцилиндра + пружины'],
  ],
  maxExtension: 0.85,
  unit: 'mm',
  tipOffset: 4.60,
  subgroups: [
    { key: 'mountFlange', label: '1. Осадный лафет УСП' },
    { key: 'siegeCradle', label: '2. Люлька и накатники' },
    { key: 'siegeBarrelGroup', label: '3. Откатной ствол 240 мм' },
  ],
  cameras: {
    module: { pos: [3.55, 2.05, 4.35], target: [0, 0.82, 1.45] },
  },
  rangeMarkers: [],
  controls: 'volley',
  volley: {
    mode: 'single',
    shotPeriod: 3.2,
    recoilTime: 0.11,
    holdTime: 0.06,
    returnTime: 1.18,
    heatPerShot: 0.12,
    coolRate: 0.05,
    single: true,
  },
  drive: {
    title: 'Затвор и накат',
    caption: 'ОТКАТ СТВОЛА',
    fire: 'ВЫСТРЕЛ',
  },
};

const MAX_RECOIL = 0.85;
const RET_TIME = 0.11;
const HOLD_TIME = 0.06;
const RETURN_TIME = 1.18;

/**
 * Создаёт процедурную 3D-модель сверхтяжёлой 240-мм осадной пушки-гаубицы 2С7М «Пион-2»
 * (слот SUPERHEAVY, масштаб 1 unit = 1 метр, ствол строго вдоль +Z, опора УСП в (0, 0, 0)).
 *
 * @returns {THREE.Group} Корневая группа модуля с именованными подузлами и контроллером отката.
 */
export function createWeapon2S7MPion2() {
  const root = new THREE.Group();
  root.name = 'Weapon_2S7M_Pion2';

  // ============================================================================
  // 1. ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (CanvasTexture — без внешних ассетов)
  // ============================================================================

  function createArmorMicroBumpTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    // Зернистость литой и катаной броневой стали
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < data.length; i += 4) {
      const grain = (rand() - 0.5) * 26;
      const v = Math.max(0, Math.min(255, 128 + grain));
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    // Лёгкие технологические царапины и следы сварки
    ctx.strokeStyle = 'rgba(210, 210, 210, 0.14)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 45; i++) {
      ctx.beginPath();
      const x = rand() * 512;
      const y = rand() * 512;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 90, y + (rand() - 0.5) * 20);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  function createHazardStripeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#e5a912';
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = '#181a1c';
    const stripeW = 48;
    for (let x = -256; x < 768; x += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW - 256, 256);
      ctx.lineTo(x - 256, 256);
      ctx.closePath();
      ctx.fill();
    }

    // Потёртости краски по краям
    ctx.strokeStyle = 'rgba(71, 80, 65, 0.45)';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 502, 246);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function createPionMarkingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Базовый оливковый фон плиты
    ctx.fillStyle = '#475041';
    ctx.fillRect(0, 0, 1024, 256);

    // Нижняя жёлто-чёрная предупреждающая полоса
    const stripeH = 44;
    const y0 = 256 - stripeH;
    ctx.fillStyle = '#e5a912';
    ctx.fillRect(0, y0, 1024, stripeH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, 1024, stripeH);
    ctx.clip();
    ctx.fillStyle = '#17191b';
    for (let x = -64; x < 1088; x += 56) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x + 28, y0);
      ctx.lineTo(x + 28 - stripeH, 256);
      ctx.lineTo(x - stripeH, 256);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Разделительная техническая кайма
    ctx.fillStyle = '#1b1e1a';
    ctx.fillRect(0, y0 - 6, 1024, 6);

    // Трафаретная тактическая маркировка «2С7М»
    ctx.fillStyle = '#f0ebd8';
    ctx.font = '900 112px "Arial Black", Impact, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('2С7М', 46, 106);

    // Индекс и калибр
    ctx.fillStyle = '#e5a912';
    ctx.font = 'bold 34px monospace';
    ctx.fillText('240 ММ • УСП-ОСАДА', 430, 78);

    ctx.fillStyle = '#d3d7cc';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('ОТКАТ 850 ММ // ОПАСНАЯ ЗОНА', 430, 134);

    // Технические риски и тактический знак
    ctx.strokeStyle = '#f0ebd8';
    ctx.lineWidth = 4;
    ctx.strokeRect(915, 42, 68, 110);
    ctx.beginPath();
    ctx.moveTo(915, 97);
    ctx.lineTo(983, 97);
    ctx.moveTo(949, 42);
    ctx.lineTo(949, 152);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  function createMuzzleSootTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#23262a');
    grad.addColorStop(0.35, '#191b1e');
    grad.addColorStop(0.75, '#0e0f11');
    grad.addColorStop(1.0, '#070809');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Пятна порохового нагара
    for (let i = 0; i < 240; i++) {
      const x = (i * 73) % 512;
      const y = 140 + ((i * 137) % 372);
      const r = 10 + (i % 28);
      const radGrad = ctx.createRadialGradient(x, y, 1, x, y, r);
      radGrad.addColorStop(0, 'rgba(6, 6, 8, 0.45)');
      radGrad.addColorStop(1, 'rgba(6, 6, 8, 0)');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function createManometerTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#e7e5dc';
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1e2226';
    ctx.stroke();

    // Красная зона давления
    ctx.strokeStyle = '#c82828';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(64, 64, 44, -0.3, 0.8);
    ctx.stroke();

    // Стрелка
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(96, 36);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ============================================================================
  // 2. PBR-МАТЕРИАЛЫ
  // ============================================================================

  const armorBumpTex = createArmorMicroBumpTexture();
  const hazardTex = createHazardStripeTexture();
  const pionMarkingTex = createPionMarkingTexture();
  const sootTex = createMuzzleSootTexture();
  const gaugeTex = createManometerTexture();

  // Советский защитный оливковый хаки (лафет и люлька)
  const oliveArmorMat = new THREE.MeshStandardMaterial({
    color: 0x475041,
    metalness: 0.40,
    roughness: 0.68,
    bumpMap: armorBumpTex,
    bumpScale: 0.004,
  });

  // Более тёмный оттенок хаки для силовых косынок и внутренних узлов
  const darkOliveMat = new THREE.MeshStandardMaterial({
    color: 0x384033,
    metalness: 0.45,
    roughness: 0.64,
    bumpMap: armorBumpTex,
    bumpScale: 0.004,
  });

  // Тёмная воронёная сталь (ствол и силовые элементы дульного тормоза)
  const bluedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x23262a,
    metalness: 0.85,
    roughness: 0.36,
    bumpMap: armorBumpTex,
    bumpScale: 0.002,
  });

  // Закопчённая сталь перегородок дульного тормоза и дульного среза
  const scorchedMuzzleMat = new THREE.MeshStandardMaterial({
    color: 0x23262a,
    map: sootTex,
    metalness: 0.72,
    roughness: 0.56,
  });

  // Глубокий матовый нагар внутренних камер дульного тормоза и канала ствола
  const innerSootMat = new THREE.MeshStandardMaterial({
    color: 0x101113,
    metalness: 0.45,
    roughness: 0.85,
  });

  // Полированный хром (штоки накатников и гидрозамков)
  const chromeRodMat = new THREE.MeshStandardMaterial({
    color: 0xd4dae0,
    metalness: 0.95,
    roughness: 0.15,
  });

  // Жёлто-чёрная предупреждающая маркировка и индекс «2С7М»
  const markingPlateMat = new THREE.MeshStandardMaterial({
    map: pionMarkingTex,
    metalness: 0.32,
    roughness: 0.58,
  });

  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    metalness: 0.30,
    roughness: 0.55,
  });

  // Маслопроводы и латунные/стальные штуцеры
  const oilPipeMat = new THREE.MeshStandardMaterial({
    color: 0x2d332c,
    metalness: 0.65,
    roughness: 0.42,
  });

  const brassFittingMat = new THREE.MeshStandardMaterial({
    color: 0x9c8244,
    metalness: 0.82,
    roughness: 0.32,
  });

  const gaugeMat = new THREE.MeshStandardMaterial({
    map: gaugeTex,
    metalness: 0.1,
    roughness: 0.3,
  });

  // Вспомогательная фабрика для батчинга болтов и заклёпок через THREE.InstancedMesh
  const boltGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.018, 6);
  function createBoltBatch(transforms, material) {
    const inst = new THREE.InstancedMesh(boltGeo, material, transforms.length);
    const dummy = new THREE.Object3D();
    transforms.forEach((t, idx) => {
      dummy.position.copy(t.pos);
      if (t.rot) dummy.rotation.copy(t.rot);
      else dummy.rotation.set(0, 0, 0);
      const s = t.scale ?? 1;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    inst.receiveShadow = true;
    return inst;
  }

  // ============================================================================
  // 3. УЗЕЛ 1: СДВОЕННЫЙ ОСАДНЫЙ ЛАФЕТ (`mountFlange`)
  // Опорная плита 1.10 x 0.22 x 1.60 м с центром опорной плоскости в (0, 0, 0)
  // ============================================================================

  const mountFlange = new THREE.Group();
  mountFlange.name = 'mountFlange';
  root.add(mountFlange);

  const mountBolts = [];

  // Сдвоенная продольная силовая рама плиты (общий габарит: 1.10 x 0.22 x 1.60 м)
  const sideRailGeo = new THREE.BoxGeometry(0.34, 0.22, 1.60);
  [-0.38, 0.38].forEach((xPos) => {
    const rail = new THREE.Mesh(sideRailGeo, oliveArmorMat);
    rail.position.set(xPos, 0.11, 0);
    rail.castShadow = true;
    rail.receiveShadow = true;
    mountFlange.add(rail);

    // Верхняя усиленная накладка рельса лафета
    const topCap = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.03, 1.54), darkOliveMat);
    topCap.position.set(xPos, 0.225, 0);
    topCap.castShadow = true;
    topCap.receiveShadow = true;
    mountFlange.add(topCap);
  });

  // Центральная силовая перемычка сдвоенного фланца УСП
  const centerBridge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.17, 1.52), darkOliveMat);
  centerBridge.position.set(0, 0.085, 0);
  centerBridge.castShadow = true;
  centerBridge.receiveShadow = true;
  mountFlange.add(centerBridge);

  // Поперечные силовые балки с жёлто-чёрной маркировкой (спереди и сзади)
  const crossBeamGeo = new THREE.BoxGeometry(1.10, 0.20, 0.10);
  [-0.75, 0.75].forEach((zPos) => {
    const beam = new THREE.Mesh(crossBeamGeo, oliveArmorMat);
    beam.position.set(0, 0.10, zPos);
    beam.castShadow = true;
    beam.receiveShadow = true;
    mountFlange.add(beam);

    const hazardStrip = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.12, 0.012), hazardMat);
    hazardStrip.position.set(0, 0.11, zPos + (zPos > 0 ? 0.052 : -0.052));
    mountFlange.add(hazardStrip);
  });

  // Боковые бронепластины с маркировкой «2С7М» и жёлто-чёрной полосой
  [-0.553, 0.553].forEach((xSide) => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.19, 1.44), markingPlateMat);
    plate.position.set(xSide, 0.11, 0);
    mountFlange.add(plate);
  });

  // 8 массивных гидрозамков фиксации осадного лафета (по 4 на борт)
  const lockZPositions = [-0.60, -0.20, 0.20, 0.60];
  lockZPositions.forEach((zPos) => {
    [-1, 1].forEach((side) => {
      const lockGroup = new THREE.Group();
      lockGroup.position.set(side * 0.51, 0.13, zPos);

      // Литой корпус гидрозамка
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.18), darkOliveMat);
      housing.castShadow = true;
      housing.receiveShadow = true;
      lockGroup.add(housing);

      // Силовой гидроцилиндр зажима
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.22, 16), oliveArmorMat);
      cyl.position.set(side * 0.03, 0.05, 0);
      cyl.castShadow = true;
      lockGroup.add(cyl);

      // Верхняя крышка и хромированный индикаторный шток
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8), bluedSteelMat);
      cap.position.set(side * 0.03, 0.165, 0);
      lockGroup.add(cap);

      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 12), chromeRodMat);
      pin.position.set(side * 0.03, 0.20, 0);
      lockGroup.add(pin);

      // Захватный кулачок внизу
      const claw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.14), bluedSteelMat);
      claw.position.set(side * 0.02, -0.11, 0);
      lockGroup.add(claw);

      mountFlange.add(lockGroup);

      // Болты крепления крышки гидрозамка
      for (let b = 0; b < 4; b++) {
        const ang = (b * Math.PI) / 2 + Math.PI / 4;
        mountBolts.push({
          pos: new THREE.Vector3(
            side * 0.54 + Math.cos(ang) * 0.044,
            0.315,
            zPos + Math.sin(ang) * 0.044
          ),
          scale: 0.85,
        });
      }
    });
  });

  // Массивные цапфенные стойки лафета (поднимают ось люльки на Y = 0.76 м)
  [-0.43, 0.43].forEach((xPed) => {
    const pedestalShape = new THREE.Shape();
    pedestalShape.moveTo(-0.46, 0);
    pedestalShape.lineTo(0.46, 0);
    pedestalShape.lineTo(0.24, 0.56);
    pedestalShape.absarc(0, 0.56, 0.24, 0, Math.PI, false);
    pedestalShape.closePath();

    const pedGeo = new THREE.ExtrudeGeometry(pedestalShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
    });
    pedGeo.rotateY(Math.PI / 2);

    const pedestal = new THREE.Mesh(pedGeo, oliveArmorMat);
    pedestal.position.set(xPed - 0.07, 0.22, 0.10);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    mountFlange.add(pedestal);

    // Косынки жёсткости по периметру стоек и опорной плиты
    const gussetShape = new THREE.Shape();
    gussetShape.moveTo(0, 0);
    gussetShape.lineTo(0.24, 0);
    gussetShape.lineTo(0, 0.34);
    gussetShape.closePath();

    const gussetGeo = new THREE.ExtrudeGeometry(gussetShape, {
      depth: 0.026,
      bevelEnabled: false,
    });

    // Передняя и задняя косынки каждой стойки
    const frontGusset = new THREE.Mesh(gussetGeo, darkOliveMat);
    frontGusset.rotation.y = -Math.PI / 2;
    frontGusset.position.set(xPed + 0.013, 0.22, 0.48);
    frontGusset.castShadow = true;
    mountFlange.add(frontGusset);

    const rearGusset = new THREE.Mesh(gussetGeo, darkOliveMat);
    rearGusset.rotation.y = Math.PI / 2;
    rearGusset.position.set(xPed - 0.013, 0.22, -0.28);
    rearGusset.castShadow = true;
    mountFlange.add(rearGusset);

    // Внешний бугель цапфы (подшипниковый узел)
    const bearingCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.16, 0.08, 24),
      bluedSteelMat
    );
    bearingCap.rotation.z = Math.PI / 2;
    bearingCap.position.set(xPed + (xPed > 0 ? 0.09 : -0.09), 0.78, 0.10);
    bearingCap.castShadow = true;
    mountFlange.add(bearingCap);

    // Болты крышки цапфы
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mountBolts.push({
        pos: new THREE.Vector3(
          xPed + (xPed > 0 ? 0.135 : -0.135),
          0.78 + Math.cos(a) * 0.115,
          0.10 + Math.sin(a) * 0.115
        ),
        rot: new THREE.Euler(0, 0, Math.PI / 2),
        scale: 1.0,
      });
    }
  });

  // Заклёпки и болты по периметру опорной плиты УСП
  for (let z = -0.72; z <= 0.72; z += 0.16) {
    [-0.49, -0.27, 0.27, 0.49].forEach((x) => {
      mountBolts.push({ pos: new THREE.Vector3(x, 0.245, z), scale: 1.05 });
    });
  }
  mountFlange.add(createBoltBatch(mountBolts, bluedSteelMat));

  // ============================================================================
  // 4. УЗЕЛ 2: МАССИВНАЯ ЛЮЛЬКА И ПРОТИВООТКАТНЫЕ УСТРОЙСТВА (`siegeCradle`)
  // Ось цапф расположена в (0, 0.78, 0.10)
  // ============================================================================

  const siegeCradle = new THREE.Group();
  siegeCradle.name = 'siegeCradle';
  siegeCradle.position.set(0, 0.78, 0.10);
  root.add(siegeCradle);

  const cradleBolts = [];

  // Главный броневой короб люльки (направляющие отката ствола)
  const cradleTrough = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.62, 1.55),
    oliveArmorMat
  );
  cradleTrough.position.set(0, 0, 0.55);
  cradleTrough.castShadow = true;
  cradleTrough.receiveShadow = true;
  siegeCradle.add(cradleTrough);

  // Поперечные цапфы люльки, входящие в стойки лафета
  const trunnionAxle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 1.04, 24),
    bluedSteelMat
  );
  trunnionAxle.rotation.z = Math.PI / 2;
  trunnionAxle.position.set(0, 0, 0);
  siegeCradle.add(trunnionAxle);

  // Бронированный казённый блок (задняя часть люльки с окном выхода казённика при откате)
  const breechGuardGroup = new THREE.Group();
  breechGuardGroup.position.set(0, 0, -0.46);
  siegeCradle.add(breechGuardGroup);

  // Верхняя и нижняя бронеплиты казённого блока
  const breechTopArmor = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.15, 0.58), oliveArmorMat);
  breechTopArmor.position.set(0, 0.29, 0);
  breechTopArmor.castShadow = true;
  breechGuardGroup.add(breechTopArmor);

  const breechBottomArmor = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.14, 0.58), darkOliveMat);
  breechBottomArmor.position.set(0, -0.29, 0);
  breechBottomArmor.castShadow = true;
  breechGuardGroup.add(breechBottomArmor);

  // Боковые бронещёки казённого блока (оставляют центральный канал для отката казённика на 0.85 м)
  [-0.31, 0.31].forEach((xSide) => {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.58), oliveArmorMat);
    cheek.position.set(xSide, 0, 0);
    cheek.castShadow = true;
    cheek.receiveShadow = true;
    breechGuardGroup.add(cheek);

    // Болты бронещёк
    for (let bz = -0.22; bz <= 0.22; bz += 0.11) {
      [-0.18, 0.18].forEach((by) => {
        cradleBolts.push({
          pos: new THREE.Vector3(xSide + (xSide > 0 ? 0.065 : -0.065), by, -0.46 + bz),
          rot: new THREE.Euler(0, 0, Math.PI / 2),
          scale: 1.0,
        });
      });
    }
  });

  // Полуавтоматический досылатель снарядов сзади (z_local = -1.10 .. -0.68 -> z_world = -1.00)
  const rammerGroup = new THREE.Group();
  rammerGroup.name = 'semiAutoShellRammer';
  rammerGroup.position.set(0, -0.24, -0.88);
  siegeCradle.add(rammerGroup);

  // Направляющий лоток подачи 240-мм снаряда
  const trayShape = new THREE.Shape();
  trayShape.absarc(0, 0.12, 0.16, Math.PI * 1.12, Math.PI * 1.88, false);
  trayShape.absarc(0, 0.12, 0.135, Math.PI * 1.88, Math.PI * 1.12, true);
  trayShape.closePath();

  const trayGeo = new THREE.ExtrudeGeometry(trayShape, {
    depth: 0.44,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 1,
  });
  const loadingTray = new THREE.Mesh(trayGeo, bluedSteelMat);
  loadingTray.position.set(0, 0.02, -0.22);
  loadingTray.castShadow = true;
  rammerGroup.add(loadingTray);

  // Силовая рама и цепной/гидравлический привод досылателя
  const rammerBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.42), darkOliveMat);
  rammerBase.position.set(0, -0.05, 0);
  rammerBase.castShadow = true;
  rammerGroup.add(rammerBase);

  const rammerDriveCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.44, 16),
    oliveArmorMat
  );
  rammerDriveCyl.rotation.x = Math.PI / 2;
  rammerDriveCyl.position.set(-0.21, 0.05, 0.02);
  rammerDriveCyl.castShadow = true;
  rammerGroup.add(rammerDriveCyl);

  // Пневмоаккумулятор и редуктор досылателя справа
  const accumulator = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.34, 16),
    bluedSteelMat
  );
  accumulator.rotation.x = Math.PI / 2;
  accumulator.position.set(0.21, 0.04, 0.04);
  rammerGroup.add(accumulator);

  // Штурвал ручного дублирования досылателя
  const handwheel = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 10, 24), bluedSteelMat);
  handwheel.rotation.y = Math.PI / 2;
  handwheel.position.set(0.29, 0.07, 0.14);
  rammerGroup.add(handwheel);

  // ЧЕТЫРЕ ГИГАНТСКИХ ГИДРОПНЕВМАТИЧЕСКИХ ЦИЛИНДРА (2 накатника + 2 тормоза отката)
  // Расположены симметрично вокруг основания ствола
  const cylinderOffsets = [
    { x: -0.255, y: 0.235, label: 'upperLeft' },
    { x: 0.255, y: 0.235, label: 'upperRight' },
    { x: -0.255, y: -0.235, label: 'lowerLeft' },
    { x: 0.255, y: -0.235, label: 'lowerRight' },
  ];

  cylinderOffsets.forEach((off) => {
    const cylGroup = new THREE.Group();
    cylGroup.position.set(off.x, off.y, 0.48);

    // Основной толстостенный корпус цилиндра (длина 1.44 м: от z = -0.24 до z = +1.20)
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.092, 0.092, 1.44, 24),
      oliveArmorMat
    );
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    cylGroup.add(body);

    // Передняя и задняя массивные крышки-сальники с фланцами
    [-0.72, 0.72].forEach((endZ) => {
      const flange = new THREE.Mesh(
        new THREE.CylinderGeometry(0.112, 0.112, 0.07, 24),
        darkOliveMat
      );
      flange.rotation.x = Math.PI / 2;
      flange.position.z = endZ;
      flange.castShadow = true;
      cylGroup.add(flange);

      const glandNut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.074, 0.05, 8),
        bluedSteelMat
      );
      glandNut.rotation.x = Math.PI / 2;
      glandNut.position.z = endZ + (endZ > 0 ? 0.045 : -0.045);
      cylGroup.add(glandNut);

      // Кольцо болтов на фланце цилиндра
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        cradleBolts.push({
          pos: new THREE.Vector3(
            off.x + Math.cos(a) * 0.096,
            off.y + Math.sin(a) * 0.096,
            0.48 + endZ + (endZ > 0 ? 0.04 : -0.04)
          ),
          rot: new THREE.Euler(Math.PI / 2, 0, 0),
          scale: 0.85,
        });
      }
    });

    // Стяжные хомуты крепления цилиндров к люльке
    [-0.35, 0.35].forEach((bandZ) => {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.10, 0.06, 24),
        bluedSteelMat
      );
      band.rotation.x = Math.PI / 2;
      band.position.z = bandZ;
      cylGroup.add(band);
    });

    siegeCradle.add(cylGroup);
  });

  // Защитные бронекожухи противооткатных устройств (боковые и верхний)
  [-0.375, 0.375].forEach((xShield) => {
    const sideShroud = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.56, 1.32),
      oliveArmorMat
    );
    sideShroud.position.set(xShield, 0, 0.50);
    sideShroud.castShadow = true;
    sideShroud.receiveShadow = true;
    siegeCradle.add(sideShroud);

    // Ребра жёсткости на защитном кожухе
    for (let rz = -0.05; rz <= 1.05; rz += 0.275) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.52, 0.03), darkOliveMat);
      rib.position.set(xShield, 0, rz);
      siegeCradle.add(rib);
    }
  });

  // Верхний защитный кожух над накатниками
  const topShroud = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.035, 1.28), oliveArmorMat);
  topShroud.position.set(0, 0.345, 0.50);
  topShroud.castShadow = true;
  siegeCradle.add(topShroud);

  // Внешние маслопроводы высокого давления и гидрораспределитель (TubeGeometry)
  [-1, 1].forEach((side) => {
    const sx = side * 0.395;

    // Блок гидрораспределителя на борту люльки
    const manifold = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.22), bluedSteelMat);
    manifold.position.set(sx + side * 0.015, 0, 0.22);
    manifold.castShadow = true;
    siegeCradle.add(manifold);

    // Манометр давления азота/жидкости
    const gaugeBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.025, 16),
      bluedSteelMat
    );
    gaugeBody.rotation.z = Math.PI / 2;
    gaugeBody.position.set(sx + side * 0.045, 0.04, 0.16);
    siegeCradle.add(gaugeBody);

    const gaugeFace = new THREE.Mesh(new THREE.CircleGeometry(0.031, 16), gaugeMat);
    gaugeFace.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    gaugeFace.position.set(sx + side * 0.058, 0.04, 0.16);
    siegeCradle.add(gaugeFace);

    // Маслопровод к верхнему цилиндру
    const upperPipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 0.06, 0.26),
      new THREE.Vector3(sx + side * 0.025, 0.18, 0.38),
      new THREE.Vector3(sx + side * 0.02, 0.24, 0.85),
      new THREE.Vector3(side * 0.32, 0.24, 1.12),
    ]);
    const upperPipe = new THREE.Mesh(
      new THREE.TubeGeometry(upperPipeCurve, 24, 0.013, 10, false),
      oilPipeMat
    );
    upperPipe.castShadow = true;
    siegeCradle.add(upperPipe);

    // Маслопровод к нижнему цилиндру и назад к казённику
    const lowerPipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, -0.06, 0.18),
      new THREE.Vector3(sx + side * 0.025, -0.20, 0.05),
      new THREE.Vector3(sx + side * 0.02, -0.23, -0.35),
      new THREE.Vector3(side * 0.32, -0.23, -0.55),
    ]);
    const lowerPipe = new THREE.Mesh(
      new THREE.TubeGeometry(lowerPipeCurve, 24, 0.013, 10, false),
      oilPipeMat
    );
    lowerPipe.castShadow = true;
    siegeCradle.add(lowerPipe);

    // Латунные штуцеры на концах магистралей
    [
      new THREE.Vector3(sx + side * 0.015, 0.06, 0.26),
      new THREE.Vector3(side * 0.32, 0.24, 1.12),
      new THREE.Vector3(sx + side * 0.015, -0.06, 0.18),
    ].forEach((fPos) => {
      const fitting = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.035, 6),
        brassFittingMat
      );
      fitting.position.copy(fPos);
      siegeCradle.add(fitting);
    });
  });

  siegeCradle.add(createBoltBatch(cradleBolts, bluedSteelMat));

  // ============================================================================
  // 5. УЗЕЛ 3: СВЕРХТЯЖЁЛЫЙ ОТКАТНОЙ СТВОЛ (`siegeBarrelGroup`)
  // Откатывается строго по -Z на 0.85 м; срез дульного тормоза в покое на z = 4.60 м
  // ============================================================================

  const siegeBarrelGroup = new THREE.Group();
  siegeBarrelGroup.name = 'siegeBarrelGroup';
  siegeCradle.add(siegeBarrelGroup);

  const barrelBolts = [];

  // 5.1. Массивный казённик (казённая часть ствола с поршневым затвором)
  // При откате на 0.85 м выдвигается назад из казённого блока люльки
  const breechRing = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.44, 0.44),
    bluedSteelMat
  );
  breechRing.position.set(0, 0, -0.36);
  breechRing.castShadow = true;
  breechRing.receiveShadow = true;
  siegeBarrelGroup.add(breechRing);

  // Цилиндрический поршневой затвор на заднем торце казённика
  const breechPlug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.155, 0.09, 24),
    chromeRodMat
  );
  breechPlug.rotation.x = Math.PI / 2;
  breechPlug.position.set(0, 0, -0.60);
  siegeBarrelGroup.add(breechPlug);

  const breechDoorHinge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, 0.36, 14),
    bluedSteelMat
  );
  breechDoorHinge.position.set(0.24, 0, -0.56);
  siegeBarrelGroup.add(breechDoorHinge);

  // 5.2. Толстостенный ступенчатый ствол 240 мм (LatheGeometry до z_local = 3.84 -> z_world = 3.94)
  // Калибр 240 мм => внутренний радиус канала ствола = 0.120 м
  const boreR = 0.120;
  const barrelProfile = [
    // Внутренний канал ствола (от дульной части к каморе)
    new THREE.Vector2(boreR, 3.84),
    new THREE.Vector2(boreR, -0.15),
    // Казённая муфта (камора)
    new THREE.Vector2(0.245, -0.15),
    new THREE.Vector2(0.245, 1.12),
    // Первое массивное кольцевое утолщение
    new THREE.Vector2(0.275, 1.15),
    new THREE.Vector2(0.275, 1.42),
    new THREE.Vector2(0.215, 1.46),
    // Средняя ступень под термозащитный экран
    new THREE.Vector2(0.215, 1.98),
    new THREE.Vector2(0.196, 2.02),
    // Передняя сужающаяся ступень ствола
    new THREE.Vector2(0.196, 3.22),
    new THREE.Vector2(0.182, 3.26),
    new THREE.Vector2(0.172, 3.74),
    // Дульное кольцевое утолщение перед тормозом
    new THREE.Vector2(0.205, 3.76),
    new THREE.Vector2(0.205, 3.84),
    new THREE.Vector2(boreR, 3.84),
  ];

  const barrelLatheGeo = new THREE.LatheGeometry(barrelProfile, 48);
  // Поворачиваем ось Y LatheGeometry вдоль +Z
  barrelLatheGeo.rotateX(Math.PI / 2);

  const mainBarrelMesh = new THREE.Mesh(barrelLatheGeo, bluedSteelMat);
  mainBarrelMesh.castShadow = true;
  mainBarrelMesh.receiveShadow = true;
  siegeBarrelGroup.add(mainBarrelMesh);

  // Тёмный нарезной канал внутри дульной части
  const rifledLiner = new THREE.Mesh(
    new THREE.CylinderGeometry(boreR - 0.001, boreR - 0.001, 1.8, 32, 1, true),
    innerSootMat
  );
  rifledLiner.rotation.x = Math.PI / 2;
  rifledLiner.position.set(0, 0, 3.55);
  siegeBarrelGroup.add(rifledLiner);

  // 5.3. Силовой хомут (обойма) отката и 4 полированных хромированных штока накатников
  // Хомут на z_local = 2.05 соединяет ствол со штоками 4 цилиндров люльки
  const recoilYoke = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.62, 0.14),
    darkOliveMat
  );
  recoilYoke.position.set(0, 0, 2.05);
  recoilYoke.castShadow = true;
  recoilYoke.receiveShadow = true;
  siegeBarrelGroup.add(recoilYoke);

  const yokeRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.255, 0.255, 0.18, 32),
    bluedSteelMat
  );
  yokeRing.rotation.x = Math.PI / 2;
  yokeRing.position.set(0, 0, 2.05);
  siegeBarrelGroup.add(yokeRing);

  // 4 полированных хромированных штока (#d4dae0, metalness: 0.95, roughness: 0.15)
  // Идут от хомута (z_local = 2.05) внутрь цилиндров люльки (до z_local = 0.65).
  // При откате на -0.85 м штоки полностью уходят вглубь цилиндров люльки.
  const rodLength = 1.42;
  const rodGeo = new THREE.CylinderGeometry(0.044, 0.044, rodLength, 24);
  rodGeo.rotateX(Math.PI / 2);

  cylinderOffsets.forEach((off) => {
    const rod = new THREE.Mesh(rodGeo, chromeRodMat);
    rod.position.set(off.x, off.y, 2.05 - rodLength / 2);
    rod.castShadow = true;
    siegeBarrelGroup.add(rod);

    // Гайка крепления штока на передней стороне силового хомута
    const rodNut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.062, 0.045, 6),
      bluedSteelMat
    );
    rodNut.rotation.x = Math.PI / 2;
    rodNut.position.set(off.x, off.y, 2.13);
    siegeBarrelGroup.add(rodNut);
  });

  // 5.4. Термозащитный экран в средней части ствола (z_local = 2.15 .. 3.20)
  const thermalShroudGroup = new THREE.Group();
  thermalShroudGroup.name = 'thermalShroud';
  siegeBarrelGroup.add(thermalShroudGroup);

  const shroudTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.222, 0.214, 1.04, 36),
    darkOliveMat
  );
  shroudTube.rotation.x = Math.PI / 2;
  shroudTube.position.set(0, 0, 2.68);
  shroudTube.castShadow = true;
  shroudTube.receiveShadow = true;
  thermalShroudGroup.add(shroudTube);

  // Боковые продольные фланцы стыковки половин термокожуха
  [-0.225, 0.225].forEach((xSeam) => {
    const seamFlange = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.045, 1.02),
      bluedSteelMat
    );
    seamFlange.position.set(xSeam, 0, 2.68);
    thermalShroudGroup.add(seamFlange);
  });

  // 4 стяжных кольцевых хомута термозащитного экрана с болтами
  [2.22, 2.52, 2.84, 3.14].forEach((zBand) => {
    const clampBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.229, 0.229, 0.038, 36),
      bluedSteelMat
    );
    clampBand.rotation.x = Math.PI / 2;
    clampBand.position.set(0, 0, zBand);
    clampBand.castShadow = true;
    thermalShroudGroup.add(clampBand);

    [-0.235, 0.235].forEach((bx) => {
      barrelBolts.push({
        pos: new THREE.Vector3(bx, 0.028, zBand),
        scale: 0.9,
      });
    });
  });

  // 5.5. Гигантский многокамерный щелевой дульный тормоз (диаметр ~0.55 м, срез на z_world = 4.60)
  // z_local: от 3.84 до 4.50 (в мировых координатах: 3.94 .. 4.60 м)
  const muzzleBrakeGroup = new THREE.Group();
  muzzleBrakeGroup.name = 'muzzleBrake';
  siegeBarrelGroup.add(muzzleBrakeGroup);

  const brakeOuterRadius = 0.275; // Диаметр = 0.55 м
  const brakeInnerRadius = 0.130;

  // Создаём 4 массивные перегородки дульного тормоза с фасками и сквозным каналом
  const baffleShape = new THREE.Shape();
  baffleShape.absarc(0, 0, brakeOuterRadius, 0, Math.PI * 2, false);
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, brakeInnerRadius, 0, Math.PI * 2, true);
  baffleShape.holes.push(holePath);

  const baffleGeo = new THREE.ExtrudeGeometry(baffleShape, {
    depth: 0.048,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 40,
  });

  // 4 перегородки образуют 3 мощные реактивные боковые камеры сброса пороховых газов
  const baffleZPositions = [3.85, 4.05, 4.25, 4.444];
  baffleZPositions.forEach((bz, idx) => {
    const mat = idx === 0 ? bluedSteelMat : scorchedMuzzleMat;
    const baffle = new THREE.Mesh(baffleGeo, mat);
    baffle.position.set(0, 0, bz);
    baffle.castShadow = true;
    baffle.receiveShadow = true;
    muzzleBrakeGroup.add(baffle);

    // Закопчённое кольцо на задней рабочей грани каждой перегородки
    if (idx > 0) {
      const sootRing = new THREE.Mesh(
        new THREE.RingGeometry(brakeInnerRadius, brakeOuterRadius * 0.94, 36),
        innerSootMat
      );
      sootRing.rotation.y = Math.PI;
      sootRing.position.set(0, 0, bz - 0.009);
      muzzleBrakeGroup.add(sootRing);
    }
  });

  // Верхняя и нижняя силовые продольные перемычки дульного тормоза (оставляют широкие щели по бокам)
  [-1, 1].forEach((vDir) => {
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.072, 0.64),
      scorchedMuzzleMat
    );
    spine.position.set(0, vDir * (brakeOuterRadius - 0.036), 4.17);
    spine.castShadow = true;
    spine.receiveShadow = true;
    muzzleBrakeGroup.add(spine);

    // Внутренние закопчённые дефлекторы верхнего/нижнего свода камер
    const innerVault = new THREE.Mesh(
      new THREE.BoxGeometry(0.21, 0.02, 0.58),
      innerSootMat
    );
    innerVault.position.set(0, vDir * (brakeOuterRadius - 0.072), 4.17);
    muzzleBrakeGroup.add(innerVault);
  });

  // Конические газоотводные втулки внутри камер дульного тормоза
  [3.95, 4.15, 4.35].forEach((cz) => {
    const blastSleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.146, 0.136, 0.09, 28, 1, true),
      innerSootMat
    );
    blastSleeve.rotation.x = Math.PI / 2;
    blastSleeve.position.set(0, 0, cz);
    muzzleBrakeGroup.add(blastSleeve);
  });

  // Болты крепления муфты дульного тормоза к стволу
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    barrelBolts.push({
      pos: new THREE.Vector3(Math.cos(a) * 0.23, Math.sin(a) * 0.23, 3.84),
      rot: new THREE.Euler(Math.PI / 2, 0, 0),
      scale: 0.95,
    });
  }

  siegeBarrelGroup.add(createBoltBatch(barrelBolts, bluedSteelMat));

  // ============================================================================
  // 6. МЕТАДАННЫЕ И КОНТРОЛЛЕР БАЛЛИСТИЧЕСКОГО ОТКАТА / НАКАТА
  // ============================================================================

  const recoilState = {
    isFiring: false,
    elapsed: 0,
    recoilDistance: 0.85, // Глубокий откат по -Z на 0.85 м
    recoilDuration: 0.11, // Стремительный импульс отката (110 мс)
    dwellDuration: 0.06,  // Краткая гидравлическая отсечка в крайнем положении
    returnDuration: 1.18, // Плавный гидропневматический накат (1.18 с)
    flashIntensity: 0,
  };

  function triggerFire() {
    recoilState.isFiring = true;
    recoilState.elapsed = 0;
    recoilState.flashIntensity = 1.0;
  }

  function updateRecoil(dt) {
    if (!recoilState.isFiring) {
      siegeBarrelGroup.position.z = 0;
      siegeCradle.rotation.x = 0;
      recoilState.flashIntensity = 0;
      return;
    }

    recoilState.elapsed += dt;
    const t = recoilState.elapsed;
    const { recoilDistance, recoilDuration, dwellDuration, returnDuration } = recoilState;
    const totalDuration = recoilDuration + dwellDuration + returnDuration;

    let zOffset = 0;

    if (t < recoilDuration) {
      // Фаза 1: Резкий откат назад (-Z) под действием пороховых газов
      const u = t / recoilDuration;
      const easeOut = 1 - Math.pow(1 - u, 3.2);
      zOffset = -recoilDistance * easeOut;
    } else if (t < recoilDuration + dwellDuration) {
      // Фаза 2: Пиковое сжатие тормоза отката
      zOffset = -recoilDistance;
    } else if (t < totalDuration) {
      // Фаза 3: Плавный демпфированный накат обратно в боевое положение (0.0)
      const u = (t - recoilDuration - dwellDuration) / returnDuration;
      const smoothReturn = u * u * u * (u * (u * 6 - 15) + 10);
      // Лёгкое гидравлическое дожатие при постановке на защёлку
      const latchSettle = Math.sin(u * Math.PI) * 0.012 * (1 - u);
      zOffset = -recoilDistance * (1 - smoothReturn) - latchSettle;
    } else {
      zOffset = 0;
      recoilState.isFiring = false;
    }

    siegeBarrelGroup.position.z = zOffset;

    // Микро-подброс люльки на цапфах от импульса выстрела
    const kickEnvelope = Math.exp(-t * 6.5) * Math.sin(Math.min(t * 22, Math.PI));
    siegeCradle.rotation.x = -0.014 * kickEnvelope;

    // Затухание дульной вспышки
    recoilState.flashIntensity = Math.max(0, 1 - t / 0.085);
  }

  root.userData = {
    caliberMm: 240,
    totalLengthMeters: 5.6,
    recoilStrokeMeters: 0.85,
    parts: {
      mountFlange,
      siegeCradle,
      siegeBarrelGroup,
    },
    recoilState,
    triggerFire,
    updateRecoil,
  };

  return root;
}

// ==============================================================================
// ТЕСТОВАЯ СЦЕНА С ORBITCONTROLS И АНИМАЦИЕЙ ОТКАТА / НАКАТА
// (автономный стенд; во вьювере не вызывается —
// движок index.html сам ставит свет, пол и анимацию выстрела).
// ==============================================================================

function initTestScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16191d);
  scene.fog = new THREE.FogExp2(0x16191d, 0.032);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(3.55, 2.05, 4.35);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 0.82, 1.45);
  controls.minDistance = 1.8;
  controls.maxDistance = 16;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();

  // Трёхточечное студийно-полигонное освещение для выразительного PBR-металла
  const hemiLight = new THREE.HemisphereLight(0xc9d6e3, 0x2c3029, 0.95);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff4e4, 2.6);
  keyLight.position.set(5.5, 8.0, 4.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 22;
  const d = 5.5;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x7aa4d6, 1.25);
  rimLight.position.set(-5.0, 3.5, -4.0);
  scene.add(rimLight);

  // Испытательный стенд / площадка полигона под опорной плитой (0, 0, 0)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({
      color: 0x22262a,
      roughness: 0.85,
      metalness: 0.15,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(16, 32, 0x4b5346, 0x2b3035);
  grid.position.y = 0.002;
  scene.add(grid);

  // Монтаж 2С7М «Пион-2» в центр стенда (0, 0, 0)
  const weapon2S7M = createWeapon2S7MPion2();
  scene.add(weapon2S7M);

  // Точечный источник дульной вспышки у среза ствола (z = 4.65 м)
  const muzzleFlashLight = new THREE.PointLight(0xff8c2a, 0, 14, 1.6);
  muzzleFlashLight.position.set(0, 0.78, 4.72);
  scene.add(muzzleFlashLight);

  // Управление стрельбой: пробел, двойной клик и автоматический цикл каждые 3.2 с
  let autoFireTimer = 1.8;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      weapon2S7M.userData.triggerFire();
      autoFireTimer = 0;
    }
  });
  renderer.domElement.addEventListener('dblclick', () => {
    weapon2S7M.userData.triggerFire();
    autoFireTimer = 0;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    autoFireTimer += dt;
    if (autoFireTimer >= 3.2 && !weapon2S7M.userData.recoilState.isFiring) {
      weapon2S7M.userData.triggerFire();
      autoFireTimer = 0;
    }

    weapon2S7M.userData.updateRecoil(dt);
    muzzleFlashLight.intensity = weapon2S7M.userData.recoilState.flashIntensity * 38;

    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

// initTestScene(); // Автономный стенд: раскомментировать только вне просмотрщика.

// =========================================================================
// Адаптер под единый просмотрщик: выстрел 240 мм, откат 0..0.85 м.
// applyVolley(t): резкий откат → отсечка → накат smootherstep + дожатие,
// микро-подброс люльки, вспышка. Возвращает { recoil, flash }.
// =========================================================================
export function createWeapon() {
  const root = createWeapon2S7MPion2();
  const ud = root.userData;
  const barrel = root.getObjectByName('siegeBarrelGroup');
  const cradle = root.getObjectByName('siegeCradle');

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffb84d,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flashCone = new THREE.Mesh(new THREE.ConeGeometry(0.30, 1.05, 18), flashMat);
  flashCone.rotation.x = Math.PI / 2;
  flashCone.position.set(0, 0.78, 4.85);
  root.add(flashCone);

  const flashLight = new THREE.PointLight(0xff8c2a, 0, 14, 1.6);
  flashLight.position.set(0, 0.78, 4.72);
  root.add(flashLight);

  const allMats = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => allMats.add(m));
    }
  });

  const pose = (t) => {
    let off = 0;
    let fl = 0;
    if (t < RET_TIME) {
      const u = t / RET_TIME;
      off = MAX_RECOIL * (1 - Math.pow(1 - u, 3.2));
      fl = Math.max(0, 1 - t / 0.085);
    } else if (t < RET_TIME + HOLD_TIME) {
      off = MAX_RECOIL;
    } else if (t < RET_TIME + HOLD_TIME + RETURN_TIME) {
      const u = (t - RET_TIME - HOLD_TIME) / RETURN_TIME;
      const smoothReturn = u * u * u * (u * (u * 6 - 15) + 10);
      const latchSettle = Math.sin(u * Math.PI) * 0.012 * (1 - u);
      off = MAX_RECOIL * (1 - smoothReturn) + latchSettle;
    }
    barrel.position.z = -off;
    const kickEnvelope = Math.exp(-t * 6.5) * Math.sin(Math.min(t * 22, Math.PI));
    cradle.rotation.x = -0.014 * kickEnvelope;
    flashLight.intensity = fl * 38;
    flashMat.opacity = fl * 0.85;
    flashCone.scale.setScalar(0.8 + fl * 0.45);
    return { recoil: off, flash: fl };
  };
  ud.barrel = barrel;
  ud.applyVolley = (t) => {
    if (t === null || t === undefined || t > 10) {
      barrel.position.z = 0;
      cradle.rotation.x = 0;
      flashLight.intensity = 0;
      flashMat.opacity = 0;
      flashCone.scale.setScalar(0.8);
      return { recoil: 0, flash: 0 };
    }
    return pose(t);
  };
  ud.setExtension = (recoil) => {
    const r = Math.max(0, Math.min(MAX_RECOIL, recoil));
    barrel.position.z = -r;
    return r / MAX_RECOIL;
  };
  ud.setFlash = (k) => {
    flashLight.intensity = 38.0 * Math.max(0, Math.min(1, k));
  };
  ud.setWireframe = (enabled) => {
    allMats.forEach((m) => { m.wireframe = enabled; });
  };

  return root;
}
