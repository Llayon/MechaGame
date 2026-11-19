import * as THREE from 'three';

export const meta = {
  id: 'kg4',
  code: 'КГ-4',
  title: 'КГ-4 «Гарпун»',
  subtitle: 'МОДУЛЬ НАРУЧНЫЙ ГАРПУННЫЙ • УСП-01 • L=3.20 М • ДАЛЬНОСТЬ 25.0 М',
  description: 'Наручный гарпунный комплекс меха: стыковочный фланец УСП, силовой корпус с барабаном-лебёдкой, направляющая рельса с гидроцилиндрами-демпферами, пиропатрон-газогенератор и кованая пика с раскрывающимися зубьями. Вылет 25 м, смотка троса электромотором.',
  specs: [
    ['Длина модуля', '3.20 м'],
    ['Дальность', '25.0 м'],
    ['Привод', 'Пиропатрон + лебёдка'],
    ['Трос', 'Стальной, барабан 3 слоя'],
    ['Пика', '8-гранная, 4 зуба, пирамидальный наконечник'],
    ['Откат', '2 гидроцилиндра + пружины'],
  ],
  maxExtension: 25.0,
  unit: 'm',
  harpoonStartZ: 0.80,
  tipOffset: 2.60,
  subgroups: [
    { key: 'mountFlange', label: '1. Стыковочный узел (УСП)' },
    { key: 'winchHousing', label: '2. Силовой корпус и лебёдка' },
    { key: 'launchRail', label: '3. Направляющая и демпферы' },
    { key: 'pyroBreech', label: '4. Пиропатрон / газогенератор' },
    { key: 'harpoonProjectile', label: '5. Кованый гарпун-пика' },
  ],
  cameras: {
    module: { pos: [2.45, 1.05, 2.85], target: [0, -0.25, 0.95] },
    range: { pos: [12.2, 4.4, 14.2], target: [0, -0.25, 13.5] },
  },
  rangeMarkers: [0, 5, 10, 15, 20, 25],
  targetAt: 27.55,
  controls: 'harpoon',
};

export const MAX_EXTENSION = 25.0;

    /**
     * Процедурная 3D-модель наручного гарпунного комплекса меха КГ-4 «Гарпун»
     * Система координат: 1 ед = 1 м, общая длина модуля ~3.2 м, ствол вдоль +Z, верх +Y, бок +X.
     * Точка (0, 0, 0) — центр верхнего стыковочного фланца (УСП).
     * @returns {THREE.Group}
     */
    export function createWeaponKG4Harpoon() {
      const root = new THREE.Group();
      root.name = 'KG4_Harpoon_Module';

      // =========================================================================
      // 1. ПРОЦЕДУРНЫЕ ТЕКСТУРЫ (CanvasTexture)
      // =========================================================================
      function createHazardTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Промышленная жёлтая эмаль
        ctx.fillStyle = '#d49b1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Диагональные чёрные предупреждающие полосы
        ctx.fillStyle = '#191b1d';
        const stripeWidth = 48;
        for (let i = -128; i < canvas.width + 128; i += stripeWidth * 2) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + stripeWidth, 0);
          ctx.lineTo(i + stripeWidth - 64, canvas.height);
          ctx.lineTo(i - 64, canvas.height);
          ctx.closePath();
          ctx.fill();
        }

        // Тёмная металлическая окантовка по краям таблички
        ctx.strokeStyle = '#25282c';
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        // Процедурные потёртости, царапины и копоть
        for (let i = 0; i < 650; i++) {
          const isScratch = Math.random() > 0.7;
          ctx.fillStyle = isScratch
            ? 'rgba(195, 200, 205, 0.32)'
            : 'rgba(22, 24, 21, 0.34)';
          ctx.fillRect(
            Math.random() * canvas.width,
            Math.random() * canvas.height,
            Math.random() * 18 + 2,
            Math.random() * 3 + 1
          );
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      }

      function createMetalRoughnessTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#a4a4a4';
        ctx.fillRect(0, 0, 256, 256);

        // Грубая фактура проката и эксплуатационных потёртостей
        for (let i = 0; i < 3600; i++) {
          const v = Math.floor(110 + Math.random() * 105);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(
            Math.random() * 256,
            Math.random() * 256,
            Math.random() * 8 + 1,
            Math.random() * 2 + 1
          );
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
      }

      const roughMap = createMetalRoughnessTexture();

      // =========================================================================
      // 2. PBR МАТЕРИАЛЫ (MeshStandardMaterial)
      // =========================================================================
      const matArmorOlive = new THREE.MeshStandardMaterial({
        color: 0x4a5248,
        metalness: 0.45,
        roughness: 0.65,
        roughnessMap: roughMap
      });

      const matArmorDark = new THREE.MeshStandardMaterial({
        color: 0x353b34,
        metalness: 0.55,
        roughness: 0.58,
        roughnessMap: roughMap
      });

      const matGunmetal = new THREE.MeshStandardMaterial({
        color: 0x2b2e33,
        metalness: 0.85,
        roughness: 0.35,
        roughnessMap: roughMap
      });

      const matChrome = new THREE.MeshStandardMaterial({
        color: 0xcfd4da,
        metalness: 0.95,
        roughness: 0.15
      });

      const matCopper = new THREE.MeshStandardMaterial({
        color: 0x9c5a3c,
        metalness: 0.85,
        roughness: 0.35
      });

      const matRubber = new THREE.MeshStandardMaterial({
        color: 0x1a1b1d,
        metalness: 0.1,
        roughness: 0.88
      });

      const matHazard = new THREE.MeshStandardMaterial({
        map: createHazardTexture(),
        metalness: 0.35,
        roughness: 0.55
      });

      const allMaterials = [
        matArmorOlive,
        matArmorDark,
        matGunmetal,
        matChrome,
        matCopper,
        matRubber,
        matHazard
      ];

      // Сборщик матриц для InstancedMesh болтов и заклёпок
      const boltMatrices = [];
      const dummyObj = new THREE.Object3D();

      function addBolt(x, y, z, rx = 0, ry = 0, rz = 0, scale = 1) {
        dummyObj.position.set(x, y, z);
        dummyObj.rotation.set(rx, ry, rz);
        dummyObj.scale.setScalar(scale);
        dummyObj.updateMatrix();
        boltMatrices.push(dummyObj.matrix.clone());
      }

      function enableShadows(group) {
        group.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
      }

      // =========================================================================
      // УЗЕЛ 1: СТЫКОВОЧНЫЙ УЗЕЛ (mountFlange)
      // =========================================================================
      const mountFlange = new THREE.Group();
      mountFlange.name = 'mountFlange';

      const plateW = 0.55;
      const plateH = 0.14;
      const plateL = 0.90;
      const bevel = 0.025;

      const flangeShape = new THREE.Shape();
      const hw = plateW / 2 - bevel;
      const hl = plateL / 2 - bevel;
      flangeShape.moveTo(-hw, -hl);
      flangeShape.lineTo(hw, -hl);
      flangeShape.lineTo(hw, hl);
      flangeShape.lineTo(-hw, hl);
      flangeShape.closePath();

      const flangeGeo = new THREE.ExtrudeGeometry(flangeShape, {
        depth: plateH - bevel * 2,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: bevel,
        bevelThickness: bevel
      });
      flangeGeo.rotateX(Math.PI / 2);
      flangeGeo.translate(0, -bevel, 0);

      const flangeMesh = new THREE.Mesh(flangeGeo, matArmorOlive);
      mountFlange.add(flangeMesh);

      // Верхнее центрирующее кольцо УСП в (0, 0, 0)
      const centerRingOuter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.125, 0.14, 0.026, 24),
        matGunmetal
      );
      centerRingOuter.position.set(0, 0.013, 0);
      mountFlange.add(centerRingOuter);

      const centerRingInner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.032, 20),
        matArmorDark
      );
      centerRingInner.position.set(0, 0.016, 0);
      mountFlange.add(centerRingInner);

      // 4 цилиндрических гидравлических замка по углам с хромированными штоками
      const lockCoords = [
        [-0.22, -0.35],
        [0.22, -0.35],
        [-0.22, 0.35],
        [0.22, 0.35]
      ];
      const lockHousingGeo = new THREE.CylinderGeometry(0.048, 0.052, 0.16, 16);
      const lockCollarGeo = new THREE.CylinderGeometry(0.056, 0.056, 0.025, 16);
      const lockPinGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.22, 16);

      lockCoords.forEach(([lx, lz]) => {
        const lockH = new THREE.Mesh(lockHousingGeo, matArmorDark);
        lockH.position.set(lx, -0.06, lz);
        mountFlange.add(lockH);

        const lockCollar = new THREE.Mesh(lockCollarGeo, matGunmetal);
        lockCollar.position.set(lx, 0.005, lz);
        mountFlange.add(lockCollar);

        const lockP = new THREE.Mesh(lockPinGeo, matChrome);
        lockP.position.set(lx, -0.045, lz);
        mountFlange.add(lockP);
      });

      // Жёлто-чёрные полосатые предупреждающие накладки по бокам фланца
      const hazardGeo = new THREE.BoxGeometry(0.016, 0.076, 0.72);
      const hazardLeft = new THREE.Mesh(hazardGeo, matHazard);
      hazardLeft.position.set(-plateW / 2 - 0.004, -plateH / 2, 0);
      mountFlange.add(hazardLeft);

      const hazardRight = new THREE.Mesh(hazardGeo, matHazard);
      hazardRight.position.set(plateW / 2 + 0.004, -plateH / 2, 0);
      mountFlange.add(hazardRight);

      // Болты по периметру верхней плиты
      for (let z = -0.36; z <= 0.36; z += 0.12) {
        addBolt(-0.24, 0.003, z, 0, 0, 0, 1.1);
        addBolt(0.24, 0.003, z, 0, 0, 0, 1.1);
      }

      root.add(mountFlange);

      // =========================================================================
      // УЗЕЛ 2: СИЛОВОЙ КОРПУС И ЛЕБЁДКА (winchHousing)
      // =========================================================================
      const winchHousing = new THREE.Group();
      winchHousing.name = 'winchHousing';

      // Боковые бронещёки под фланцем
      const sidePlateGeo = new THREE.BoxGeometry(0.055, 0.34, 0.86);
      const leftCheek = new THREE.Mesh(sidePlateGeo, matArmorOlive);
      leftCheek.position.set(-0.22, -0.30, -0.05);
      winchHousing.add(leftCheek);

      const rightCheek = new THREE.Mesh(sidePlateGeo, matArmorOlive);
      rightCheek.position.set(0.22, -0.30, -0.05);
      winchHousing.add(rightCheek);

      // Задний бронеподдон и передняя переборка с окном под барабан лебёдки
      const rearBelly = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.36), matArmorDark);
      rearBelly.position.set(0, -0.31, -0.28);
      winchHousing.add(rearBelly);

      const frontBulkhead = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.16), matArmorOlive);
      frontBulkhead.position.set(0, -0.30, 0.30);
      winchHousing.add(frontBulkhead);

      // Сварные усиливающие косынки
      const gussetGeo = new THREE.BoxGeometry(0.032, 0.16, 0.22);
      [-0.255, 0.255].forEach((gx) => {
        const gusset = new THREE.Mesh(gussetGeo, matArmorDark);
        gusset.position.set(gx, -0.20, 0.22);
        gusset.rotation.x = 0.35;
        winchHousing.add(gusset);
      });

      // Открытый силовой барабан-лебёдка по оси X (центр y = -0.32, z = 0.04)
      const drumCenter = new THREE.Vector3(0, -0.32, 0.04);
      const drumGroup = new THREE.Group();
      drumGroup.position.copy(drumCenter);

      // Вал и сердечник барабана
      const drumShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.56, 20),
        matChrome
      );
      drumShaft.rotation.z = Math.PI / 2;
      drumGroup.add(drumShaft);

      const drumCore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.36, 24),
        matGunmetal
      );
      drumCore.rotation.z = Math.PI / 2;
      drumGroup.add(drumCore);

      // Толстые боковые фланцы барабана
      const drumFlangeGeo = new THREE.CylinderGeometry(0.175, 0.175, 0.022, 28);
      const drumFlangeL = new THREE.Mesh(drumFlangeGeo, matArmorDark);
      drumFlangeL.rotation.z = Math.PI / 2;
      drumFlangeL.position.x = -0.175;
      drumGroup.add(drumFlangeL);

      const drumFlangeR = new THREE.Mesh(drumFlangeGeo, matArmorDark);
      drumFlangeR.rotation.z = Math.PI / 2;
      drumFlangeR.position.x = 0.175;
      drumGroup.add(drumFlangeR);

      // Несколько рядов витков стального троса, динамически сматываемых при выстреле на 25 м
      const cableCoils = [];
      const layerRadii = [0.124, 0.140, 0.156];
      layerRadii.forEach((radius, layerIdx) => {
        const coilGeo = new THREE.TorusGeometry(radius, 0.0095, 10, 32);
        coilGeo.rotateY(Math.PI / 2);
        const maxX = layerIdx === 2 ? 0.11 : 0.15;
        for (let x = -0.15; x <= maxX; x += 0.019) {
          const coil = new THREE.Mesh(coilGeo, matGunmetal);
          coil.position.x = x;
          drumGroup.add(coil);
          cableCoils.push(coil);
        }
      });

      // Защитная дуга-скоба под барабаном
      const guardCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.22, -0.15, -0.16),
        new THREE.Vector3(-0.22, -0.21, 0.04),
        new THREE.Vector3(0.22, -0.21, 0.04),
        new THREE.Vector3(0.22, -0.15, -0.16)
      ]);
      const guardBar = new THREE.Mesh(
        new THREE.TubeGeometry(guardCurve, 20, 0.016, 10, false),
        matArmorOlive
      );
      drumGroup.add(guardBar);

      winchHousing.add(drumGroup);

      // Массивный цилиндрический электромотор-редуктор справа (+X) с рёбрами охлаждения
      const motorGroup = new THREE.Group();
      motorGroup.position.set(0.35, -0.32, 0.04);

      const gearbox = new THREE.Mesh(
        new THREE.CylinderGeometry(0.125, 0.135, 0.11, 20),
        matArmorDark
      );
      gearbox.rotation.z = Math.PI / 2;
      gearbox.position.x = -0.05;
      motorGroup.add(gearbox);

      const motorBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.115, 0.115, 0.24, 24),
        matArmorOlive
      );
      motorBody.rotation.z = Math.PI / 2;
      motorBody.position.x = 0.12;
      motorGroup.add(motorBody);

      // Рёбра охлаждения электромотора
      const finGeo = new THREE.CylinderGeometry(0.132, 0.132, 0.008, 24);
      finGeo.rotateZ(Math.PI / 2);
      for (let fx = 0.02; fx <= 0.21; fx += 0.022) {
        const fin = new THREE.Mesh(finGeo, matGunmetal);
        fin.position.x = fx;
        motorGroup.add(fin);
      }

      // Торцевая крышка электромотора
      const motorCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.115, 0.045, 20),
        matArmorDark
      );
      motorCap.rotation.z = Math.PI / 2;
      motorCap.position.x = 0.26;
      motorGroup.add(motorCap);

      // Клеммная коробка и толстый бронированный кабель в корпус
      const terminalBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.06, 0.07),
        matArmorDark
      );
      terminalBox.position.set(0.15, 0.12, -0.02);
      motorGroup.add(terminalBox);

      const powerCableCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.15, 0.13, -0.03),
        new THREE.Vector3(0.18, 0.21, -0.14),
        new THREE.Vector3(0.07, 0.22, -0.28),
        new THREE.Vector3(-0.08, 0.14, -0.34)
      ]);
      const powerCable = new THREE.Mesh(
        new THREE.TubeGeometry(powerCableCurve, 24, 0.022, 10, false),
        matRubber
      );
      motorGroup.add(powerCable);

      winchHousing.add(motorGroup);

      // Заклёпки/болты на боковых бронещёках
      for (let y = -0.43; y <= -0.18; y += 0.08) {
        for (let z = -0.42; z <= 0.34; z += 0.15) {
          addBolt(-0.25, y, z, 0, 0, Math.PI / 2, 0.9);
          addBolt(0.25, y, z, 0, 0, -Math.PI / 2, 0.9);
        }
      }

      root.add(winchHousing);

      // =========================================================================
      // УЗЕЛ 3: НАПРАВЛЯЮЩАЯ РЕЛЬСА И АМОРТИЗАТОРЫ (launchRail)
      // =========================================================================
      const launchRail = new THREE.Group();
      launchRail.name = 'launchRail';

      const railStartZ = 0.32;
      const railEndZ = 2.12;
      const railLen = railEndZ - railStartZ;
      const railCenterZ = (railStartZ + railEndZ) / 2;
      const railY = -0.24;

      // П-образная стальная направляющая балка
      const bottomBeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.045, railLen),
        matGunmetal
      );
      bottomBeam.position.set(0, railY - 0.09, railCenterZ);
      launchRail.add(bottomBeam);

      const sideWallGeo = new THREE.BoxGeometry(0.035, 0.16, railLen);
      const leftRailWall = new THREE.Mesh(sideWallGeo, matArmorOlive);
      leftRailWall.position.set(-0.12, railY - 0.01, railCenterZ);
      launchRail.add(leftRailWall);

      const rightRailWall = new THREE.Mesh(sideWallGeo, matArmorOlive);
      rightRailWall.position.set(0.12, railY - 0.01, railCenterZ);
      launchRail.add(rightRailWall);

      // Верхние полозья направляющей из воронёной стали
      const slideStripGeo = new THREE.BoxGeometry(0.045, 0.022, railLen + 0.04);
      const leftStrip = new THREE.Mesh(slideStripGeo, matGunmetal);
      leftStrip.position.set(-0.115, railY + 0.075, railCenterZ);
      launchRail.add(leftStrip);

      const rightStrip = new THREE.Mesh(slideStripGeo, matGunmetal);
      rightStrip.position.set(0.115, railY + 0.075, railCenterZ);
      launchRail.add(rightStrip);

      // Перфорированные рёбра жёсткости (шпангоуты)
      const ribShape = new THREE.Shape();
      ribShape.moveTo(-0.18, -0.14);
      ribShape.lineTo(0.18, -0.14);
      ribShape.lineTo(0.15, 0.06);
      ribShape.lineTo(-0.15, 0.06);
      ribShape.closePath();

      const channelHole = new THREE.Path();
      channelHole.moveTo(-0.095, -0.06);
      channelHole.lineTo(0.095, -0.06);
      channelHole.lineTo(0.095, 0.07);
      channelHole.lineTo(-0.095, 0.07);
      channelHole.closePath();
      ribShape.holes.push(channelHole);

      [-0.09, 0, 0.09].forEach((hx) => {
        const hole = new THREE.Path();
        hole.absarc(hx, -0.10, 0.02, 0, Math.PI * 2, false);
        ribShape.holes.push(hole);
      });

      const ribGeo = new THREE.ExtrudeGeometry(ribShape, {
        depth: 0.024,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.003,
        bevelThickness: 0.003
      });

      for (let z = 0.45; z <= 1.98; z += 0.25) {
        const rib = new THREE.Mesh(ribGeo, matArmorDark);
        rib.position.set(0, railY, z);
        launchRail.add(rib);

        addBolt(-0.138, railY + 0.02, z + 0.012, 0, 0, Math.PI / 2, 0.85);
        addBolt(0.138, railY + 0.02, z + 0.012, 0, 0, -Math.PI / 2, 0.85);
      }

      // Направляющий ролик-клюз под передней частью рельсы
      const fairleadBracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.08, 0.12),
        matArmorDark
      );
      fairleadBracket.position.set(0, railY - 0.14, 0.52);
      launchRail.add(fairleadBracket);

      const fairleadRoller = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.11, 16),
        matChrome
      );
      fairleadRoller.rotation.z = Math.PI / 2;
      fairleadRoller.position.set(0, railY - 0.155, 0.52);
      launchRail.add(fairleadRoller);

      // Два мощных гидроцилиндра-демпфера отдачи по бокам
      const damperRods = [];
      [-0.21, 0.21].forEach((hx) => {
        const damperGroup = new THREE.Group();
        damperGroup.position.set(hx, railY - 0.03, 0.36);

        const rearMount = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.08, 0.08),
          matArmorDark
        );
        damperGroup.add(rearMount);

        const sleeve = new THREE.Mesh(
          new THREE.CylinderGeometry(0.044, 0.044, 0.92, 20),
          matArmorOlive
        );
        sleeve.rotation.x = Math.PI / 2;
        sleeve.position.z = 0.48;
        damperGroup.add(sleeve);

        const gland = new THREE.Mesh(
          new THREE.CylinderGeometry(0.052, 0.052, 0.06, 8),
          matGunmetal
        );
        gland.rotation.x = Math.PI / 2;
        gland.position.z = 0.94;
        damperGroup.add(gland);

        const pistonRod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.026, 0.026, 0.72, 20),
          matChrome
        );
        pistonRod.rotation.x = Math.PI / 2;
        pistonRod.position.z = 1.30;
        damperGroup.add(pistonRod);
        damperRods.push(pistonRod);

        // Пружинный буфер на дульном срезе
        const springPoints = [];
        const springStart = 1.44;
        const springLength = 0.22;
        const turns = 7;
        for (let i = 0; i <= 70; i++) {
          const t = i / 70;
          const angle = t * turns * Math.PI * 2;
          springPoints.push(
            new THREE.Vector3(
              Math.cos(angle) * 0.038,
              Math.sin(angle) * 0.038,
              springStart + t * springLength
            )
          );
        }
        const springCurve = new THREE.CatmullRomCurve3(springPoints);
        const springMesh = new THREE.Mesh(
          new THREE.TubeGeometry(springCurve, 64, 0.007, 8, false),
          matGunmetal
        );
        damperGroup.add(springMesh);

        const muzzleBracket = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 0.09, 0.06),
          matArmorDark
        );
        muzzleBracket.position.set(hx > 0 ? -0.03 : 0.03, 0, 1.69);
        damperGroup.add(muzzleBracket);

        launchRail.add(damperGroup);
      });

      root.add(launchRail);

      // =========================================================================
      // УЗЕЛ 4: ПИРОПАТРОН / ГАЗОГЕНЕРАТОР ВЫСТРЕЛА (pyroBreech)
      // =========================================================================
      const pyroBreech = new THREE.Group();
      pyroBreech.name = 'pyroBreech';
      pyroBreech.position.set(0, -0.24, -0.65);

      const breechChamber = new THREE.Mesh(
        new THREE.CylinderGeometry(0.145, 0.155, 0.44, 24),
        matGunmetal
      );
      breechChamber.rotation.x = Math.PI / 2;
      breechChamber.position.z = 0.06;
      pyroBreech.add(breechChamber);

      // Бандажные кольца казённика
      [-0.08, 0.14].forEach((bz) => {
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(0.168, 0.168, 0.045, 24),
          matArmorOlive
        );
        band.rotation.x = Math.PI / 2;
        band.position.z = bz;
        pyroBreech.add(band);
      });

      // Затвор-крышка с петлёй и рукоятью запирания
      const breechDoor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.135, 0.155, 0.08, 16),
        matArmorDark
      );
      breechDoor.rotation.x = Math.PI / 2;
      breechDoor.position.z = -0.19;
      pyroBreech.add(breechDoor);

      const hinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.14, 12),
        matGunmetal
      );
      hinge.position.set(-0.155, 0, -0.17);
      pyroBreech.add(hinge);

      const lockLever = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.28, 12),
        matChrome
      );
      lockLever.rotation.z = Math.PI / 4;
      lockLever.position.set(0, 0, -0.24);
      pyroBreech.add(lockLever);

      // Стравливающий клапан сверху
      const valveStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.034, 0.11, 14),
        matGunmetal
      );
      valveStem.position.set(0, 0.18, 0.02);
      pyroBreech.add(valveStem);

      const valveCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.03, 14),
        matCopper
      );
      valveCap.position.set(0, 0.24, 0.02);
      pyroBreech.add(valveCap);

      // Две изогнутые медная и стальная трубки газоотвода в рельсу
      [-1, 1].forEach((side) => {
        const pipeCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.12, 0.08, 0.10),
          new THREE.Vector3(side * 0.21, 0.12, 0.28),
          new THREE.Vector3(side * 0.21, 0.09, 0.75),
          new THREE.Vector3(side * 0.13, 0.03, 0.98)
        ]);
        const pipeMesh = new THREE.Mesh(
          new THREE.TubeGeometry(pipeCurve, 28, 0.014, 10, false),
          side > 0 ? matCopper : matChrome
        );
        pyroBreech.add(pipeMesh);

        const fitting = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, 0.035, 6),
          matGunmetal
        );
        fitting.rotation.x = Math.PI / 2;
        fitting.position.set(side * 0.13, 0.03, 0.98);
        pyroBreech.add(fitting);
      });

      root.add(pyroBreech);

      // =========================================================================
      // УЗЕЛ 5: КОВАНЫЙ ГАРПУН-ПИКА (harpoonProjectile) И НАТЯНУТЫЙ ТРОС
      // =========================================================================
      const harpoonProjectile = new THREE.Group();
      harpoonProjectile.name = 'harpoonProjectile';

      const harpoonStartZ = 0.80;
      const harpoonY = -0.23;
      harpoonProjectile.position.set(0, harpoonY, harpoonStartZ);

      // Хвостовик-толкатель с рым-болтом для троса
      const tailCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.072, 0.14, 16),
        matGunmetal
      );
      tailCollar.rotation.x = Math.PI / 2;
      tailCollar.position.z = 0.07;
      harpoonProjectile.add(tailCollar);

      const shackleRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.032, 0.011, 10, 20),
        matGunmetal
      );
      shackleRing.rotation.y = Math.PI / 2;
      shackleRing.position.z = -0.02;
      harpoonProjectile.add(shackleRing);

      // Направляющие ползуны
      const shoeGeo = new THREE.BoxGeometry(0.19, 0.038, 0.12);
      const rearShoe = new THREE.Mesh(shoeGeo, matArmorDark);
      rearShoe.position.z = 0.10;
      harpoonProjectile.add(rearShoe);

      const frontShoe = new THREE.Mesh(shoeGeo, matArmorDark);
      frontShoe.position.z = 1.15;
      harpoonProjectile.add(frontShoe);

      // Восьмигранное кованое стальное древко
      const shaftLen = 1.24;
      const shaftGeo = new THREE.CylinderGeometry(0.044, 0.052, shaftLen, 8);
      shaftGeo.rotateX(Math.PI / 2);
      const shaftMesh = new THREE.Mesh(shaftGeo, matGunmetal);
      shaftMesh.position.z = 0.14 + shaftLen / 2;
      harpoonProjectile.add(shaftMesh);

      // Ударная муфта перед зубьями
      const barbHub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.064, 0.056, 0.12, 8),
        matArmorDark
      );
      barbHub.rotation.x = Math.PI / 2;
      barbHub.position.z = 1.38;
      harpoonProjectile.add(barbHub);

      // 4 раскрывающихся зазубренных лепестка-фиксатора (зубья)
      const barbShape = new THREE.Shape();
      barbShape.moveTo(0, 0);
      barbShape.lineTo(0.24, 0.015);
      barbShape.lineTo(0.26, 0.055);
      barbShape.lineTo(0.18, 0.042);
      barbShape.lineTo(0.16, 0.062);
      barbShape.lineTo(0.09, 0.048);
      barbShape.lineTo(0.07, 0.068);
      barbShape.lineTo(-0.02, 0.055);
      barbShape.closePath();

      const barbGeo = new THREE.ExtrudeGeometry(barbShape, {
        depth: 0.018,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.003,
        bevelThickness: 0.003
      });
      barbGeo.translate(0, 0, -0.009);

      const barbMeshes = [];
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2 + Math.PI / 4;
        const barbPivot = new THREE.Group();
        barbPivot.position.set(
          Math.cos(angle) * 0.048,
          Math.sin(angle) * 0.048,
          1.42
        );
        barbPivot.rotation.z = angle;

        const barbMesh = new THREE.Mesh(barbGeo, matGunmetal);
        barbMesh.rotation.y = Math.PI / 2;
        barbMesh.rotation.x = -0.18;
        barbPivot.add(barbMesh);
        barbMeshes.push(barbMesh);

        const pin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.009, 0.009, 0.036, 10),
          matChrome
        );
        barbPivot.add(pin);

        harpoonProjectile.add(barbPivot);
      }

      // Массивный пирамидальный бронебойный наконечник (z итог: 2.60 м)
      const tipLen = 0.36;
      const tipGeo = new THREE.ConeGeometry(0.088, tipLen, 4);
      tipGeo.rotateX(Math.PI / 2);
      tipGeo.rotateZ(Math.PI / 4);
      const tipMesh = new THREE.Mesh(tipGeo, matGunmetal);
      tipMesh.position.z = 1.44 + tipLen / 2;
      harpoonProjectile.add(tipMesh);

      root.add(harpoonProjectile);

      // Динамический стальной трос (TubeGeometry) от лебёдки через ролик-клюз к рым-болту гарпуна
      function buildCableGeometry(harpoonZ, sagAmount = 0) {
        const shackleZ = harpoonZ - 0.02;
        const span = Math.max(0.1, shackleZ - 0.66);
        const points = [
          new THREE.Vector3(0, -0.45, 0.04),
          new THREE.Vector3(0, -0.40, 0.52),
          new THREE.Vector3(0, -0.25, 0.66)
        ];

        if (span > 1.2) {
          const segments = Math.min(14, Math.ceil(span / 2.0));
          for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const z = 0.66 + span * t;
            const sag = Math.sin(t * Math.PI) * sagAmount;
            points.push(new THREE.Vector3(0, harpoonY - sag, z));
          }
        }

        points.push(new THREE.Vector3(0, harpoonY, shackleZ));
        const curve = new THREE.CatmullRomCurve3(points);
        const tubularSegments = Math.min(180, Math.max(32, Math.ceil(span * 6)));
        return new THREE.TubeGeometry(curve, tubularSegments, 0.011, 8, false);
      }

      const cableMesh = new THREE.Mesh(buildCableGeometry(harpoonStartZ, 0), matGunmetal);
      cableMesh.name = 'harpoonCable';
      cableMesh.castShadow = true;
      cableMesh.receiveShadow = true;
      root.add(cableMesh);

      // =========================================================================
      // INSTANCED MESH ДЛЯ ВСЕХ БОЛТОВ И ЗАКЛЁПОК
      // =========================================================================
      const boltGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.014, 6);
      const boltsInstanced = new THREE.InstancedMesh(boltGeo, matGunmetal, boltMatrices.length);
      boltsInstanced.name = 'hardwareBolts';
      boltMatrices.forEach((mat, idx) => {
        boltsInstanced.setMatrixAt(idx, mat);
      });
      boltsInstanced.instanceMatrix.needsUpdate = true;
      boltsInstanced.castShadow = true;
      boltsInstanced.receiveShadow = true;
      root.add(boltsInstanced);

      enableShadows(root);

      // Методы управления кинематикой и режимом отображения
      root.userData.setWireframe = (enabled) => {
        allMaterials.forEach((m) => {
          m.wireframe = enabled;
        });
      };

      root.userData.setHarpoonExtension = (extensionMeters, options = {}) => {
        const clamped = Math.max(0, Math.min(MAX_EXTENSION, extensionMeters));
        const newZ = harpoonStartZ + clamped;
        harpoonProjectile.position.z = newZ;

        // Вращение барабана лебёдки пропорционально вытравленному тросу
        drumGroup.rotation.x = clamped / 0.14;

        // Динамическое сматывание витков троса с барабана по мере вылета до 25 м
        const payoutRatio = clamped / MAX_EXTENSION;
        const visibleCoilsCount = Math.max(
          3,
          Math.round(cableCoils.length * (1 - payoutRatio * 0.90))
        );
        cableCoils.forEach((coil, idx) => {
          coil.visible = idx < visibleCoilsCount;
        });

        // Ход штоков гидроцилиндров отдачи
        const recoilShift = (options.recoil || 0) * 0.14;
        damperRods.forEach((rod) => {
          rod.position.z = 1.30 - recoilShift;
        });

        // Раскрытие 4 зазубренных лепестков при выходе за дульный срез (> 0.6 м)
        const barbOpenRatio = Math.max(0, Math.min(1, (clamped - 0.6) / 0.9));
        barbMeshes.forEach((bm) => {
          bm.rotation.x = -0.18 - barbOpenRatio * 0.44;
        });

        // Баллистическое провисание троса в полёте и выпрямление при фиксации на 25 м
        const sag =
          options.sag !== undefined
            ? options.sag
            : clamped > 1.0 && clamped < MAX_EXTENSION - 0.15
              ? Math.min(0.45, clamped * 0.018)
              : 0.02 * payoutRatio;

        cableMesh.geometry.dispose();
        cableMesh.geometry = buildCableGeometry(newZ, sag);
        cableMesh.visible = harpoonProjectile.visible;

        return barbOpenRatio;
      };

      return root;
    }

export function createWeapon() {
  return createWeaponKG4Harpoon();
}
