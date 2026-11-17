import { useSceneSimulation } from '../SceneSimulation';
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export interface HelicopterProps {
  position: [number, number, number];
  rotationY?: number;
  rotorSpin?: boolean;
}

export function Helicopter({
  position,
  rotationY = 0,
  rotorSpin = false,
}: HelicopterProps) {
  const mainRotorRef = useRef<THREE.Group>(null);
  const tailRotorRef = useRef<THREE.Group>(null);

  const { paused } = useSceneSimulation();

  useFrame((_, delta) => {
    if (paused) return;
    if (rotorSpin) {
      if (mainRotorRef.current) {
        mainRotorRef.current.rotation.y += delta * 12;
      }
      if (tailRotorRef.current) {
        tailRotorRef.current.rotation.x += delta * 18;
      }
    }
  });

  // Палитра Yellow Jacket
  const yellowArmor = '#e5a916';
  const darkMetal = '#222526';
  const gunmetal = '#383d40';
  const accentBlack = '#151718';

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Посадочные лыжи (усиленные под 30 тонн веса) */}
      {[-0.44, 0.44].map((xOff, idx) => (
        <mesh key={`skid-${idx}`} position={[xOff, 0.06, -0.05]} castShadow>
          <boxGeometry args={[0.08, 0.07, 1.85]} />
          <meshStandardMaterial color={darkMetal} roughness={0.7} metalness={0.6} />
        </mesh>
      ))}

      {/* Стойки лыж */}
      {[-0.45, 0.45].map((zOff, idx) => (
        <mesh key={`strut-${idx}`} position={[0, 0.22, zOff]} castShadow>
          <boxGeometry args={[0.88, 0.06, 0.08]} />
          <meshStandardMaterial color={darkMetal} roughness={0.65} metalness={0.5} />
        </mesh>
      ))}

      {/* === ГАУСС-ПУШКА (Poland Main Model C Gauss Rifle) === */}
      <group position={[0, 0.26, 0.45]}>
        {/* Бронированный кожух казенной части под брюхом */}
        <mesh position={[0, 0, -0.25]} castShadow>
          <boxGeometry args={[0.38, 0.24, 1.35]} />
          <meshStandardMaterial color={gunmetal} roughness={0.5} metalness={0.7} />
        </mesh>

        {/* Длинный ствол пушки Гаусса (выступает далеко вперед) */}
        <mesh position={[0, -0.02, 1.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.075, 0.09, 1.5, 12]} />
          <meshStandardMaterial color={darkMetal} roughness={0.35} metalness={0.85} />
        </mesh>

        {/* Магнитные катушки разгона на стволе */}
        {[0.55, 0.9, 1.25, 1.6].map((zCoil, idx) => (
          <mesh key={`coil-${idx}`} position={[0, -0.02, zCoil]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.105, 0.105, 0.09, 12]} />
            <meshStandardMaterial color={yellowArmor} roughness={0.4} metalness={0.5} />
          </mesh>
        ))}

        {/* Дульный тормоз */}
        <mesh position={[0, -0.02, 1.82]} castShadow>
          <boxGeometry args={[0.18, 0.16, 0.18]} />
          <meshStandardMaterial color={accentBlack} roughness={0.4} metalness={0.8} />
        </mesh>
      </group>

      {/* === ОСНОВНОЙ УГЛОВАТЫЙ ФЮЗЕЛЯЖ === */}
      <mesh position={[0, 0.62, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[0.68, 0.52, 1.65]} />
        <meshStandardMaterial color={yellowArmor} roughness={0.45} metalness={0.25} />
      </mesh>

      {/* Черные предупреждающие полосы ("осиный" паттерн по бокам) */}
      {[-0.25, 0.05, 0.35].map((zStripe, idx) => (
        <mesh key={`stripe-${idx}`} position={[0, 0.63, zStripe]} rotation={[0.25, 0, 0]} castShadow>
          <boxGeometry args={[0.7, 0.48, 0.12]} />
          <meshStandardMaterial color={accentBlack} roughness={0.6} metalness={0.2} />
        </mesh>
      ))}

      {/* Носовой обтекатель с сенсорами наведения */}
      <mesh position={[0, 0.52, 1.05]} rotation={[0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.52, 0.32, 0.55]} />
        <meshStandardMaterial color={yellowArmor} roughness={0.45} metalness={0.25} />
      </mesh>

      {/* Бронированный ступенчатый кокпит (тандемная посадка пилота и стрелка) */}
      {/* Передняя кабина стрелка */}
      <mesh position={[0, 0.78, 0.82]} rotation={[0.42, 0, 0]} castShadow>
        <boxGeometry args={[0.46, 0.28, 0.48]} />
        <meshPhysicalMaterial color="#10222e" roughness={0.1} metalness={0.25} clearcoat={1} />
      </mesh>
      {/* Верхняя кабина пилота */}
      <mesh position={[0, 0.94, 0.42]} rotation={[0.25, 0, 0]} castShadow>
        <boxGeometry args={[0.48, 0.28, 0.54]} />
        <meshPhysicalMaterial color="#10222e" roughness={0.1} metalness={0.25} clearcoat={1} />
      </mesh>

      {/* Боковые спонсоны (отсеки на 2 тонны боекомплекта Гаусса и брони) */}
      {[-0.46, 0.46].map((xSponson, idx) => (
        <group key={`sponson-${idx}`} position={[xSponson, 0.56, -0.05]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.26, 0.28, 0.95]} />
            <meshStandardMaterial color={yellowArmor} roughness={0.48} metalness={0.25} />
          </mesh>
          {/* Боковая бронеплита */}
          <mesh position={[xSponson > 0 ? 0.135 : -0.135, 0, 0]}>
            <boxGeometry args={[0.02, 0.2, 0.75]} />
            <meshStandardMaterial color={accentBlack} roughness={0.6} metalness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Двигательный отсек и спаренные турбины */}
      <mesh position={[0, 0.98, -0.28]} castShadow>
        <boxGeometry args={[0.56, 0.26, 0.88]} />
        <meshStandardMaterial color={gunmetal} roughness={0.5} metalness={0.45} />
      </mesh>
      {[-0.2, 0.2].map((xExh, idx) => (
        <mesh key={`exhaust-${idx}`} position={[xExh, 0.98, -0.76]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.11, 0.18, 10]} />
          <meshStandardMaterial color={accentBlack} roughness={0.4} metalness={0.8} />
        </mesh>
      ))}

      {/* === ХВОСТОВАЯ БАЛКА И КИЛЬ С ФЕНЕСТРОНОМ === */}
      <mesh position={[0, 0.68, -1.35]} castShadow>
        <boxGeometry args={[0.22, 0.26, 1.35]} />
        <meshStandardMaterial color={yellowArmor} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Черная полоса на хвосте */}
      <mesh position={[0, 0.68, -1.45]} castShadow>
        <boxGeometry args={[0.23, 0.27, 0.28]} />
        <meshStandardMaterial color={accentBlack} roughness={0.6} metalness={0.2} />
      </mesh>

      {/* Массивный наклонный киль + горизонтальный стабилизатор */}
      <mesh position={[0, 0.92, -2.02]} rotation={[-0.22, 0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.68, 0.42]} />
        <meshStandardMaterial color={yellowArmor} roughness={0.5} metalness={0.25} />
      </mesh>
      <mesh position={[0, 1.22, -2.08]} castShadow>
        <boxGeometry args={[0.56, 0.05, 0.24]} />
        <meshStandardMaterial color={accentBlack} roughness={0.55} metalness={0.3} />
      </mesh>

      {/* Рулевой винт в кольцевом канале */}
      <group position={[0, 0.72, -1.98]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
          <meshStandardMaterial color={darkMetal} roughness={0.5} metalness={0.6} />
        </mesh>
        <group ref={tailRotorRef}>
          <mesh>
            <boxGeometry args={[0.12, 0.34, 0.03]} />
            <meshStandardMaterial color={yellowArmor} roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.12, 0.03, 0.34]} />
            <meshStandardMaterial color={yellowArmor} roughness={0.4} metalness={0.5} />
          </mesh>
        </group>
      </group>

      {/* === 4-ЛОПАСТНОЙ НЕСУЩИЙ ВИНТ === */}
      <group ref={mainRotorRef} position={[0, 1.18, -0.15]} rotation={[0, 0.45, 0]}>
        {/* Бронированная втулка винта */}
        <mesh castShadow>
          <cylinderGeometry args={[0.14, 0.18, 0.16, 12]} />
          <meshStandardMaterial color={darkMetal} roughness={0.4} metalness={0.75} />
        </mesh>

        {/* Широкие боевые лопасти */}
        <mesh castShadow>
          <boxGeometry args={[2.95, 0.025, 0.15]} />
          <meshStandardMaterial color={accentBlack} roughness={0.45} metalness={0.5} />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[0.15, 0.025, 2.95]} />
          <meshStandardMaterial color={accentBlack} roughness={0.45} metalness={0.5} />
        </mesh>

        {/* Желтые законцовки лопастей (хорошо читаются при вращении) */}
        {[-1.42, 1.42].map((tipPos, idx) => (
          <group key={`tips-${idx}`}>
            <mesh position={[tipPos, 0, 0]}>
              <boxGeometry args={[0.14, 0.028, 0.155]} />
              <meshStandardMaterial color={yellowArmor} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, tipPos]}>
              <boxGeometry args={[0.155, 0.028, 0.14]} />
              <meshStandardMaterial color={yellowArmor} roughness={0.4} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
