import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { YARD_OBSTACLES } from './controller';

export function TrainingYard() {
  const sign = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const c = canvas.getContext('2d')!; c.fillStyle = '#17262e'; c.fillRect(0, 0, 1024, 256);
    c.fillStyle = '#dab45a'; c.fillRect(24, 28, 10, 192); c.font = 'bold 98px monospace'; c.fillText('ПОЛИГОН 316', 68, 130);
    c.font = '25px monospace'; c.fillStyle = '#99aeb7'; c.fillText('ПЕХОТА / ИСПЫТАНИЕ ЭКИПИРОВКИ', 72, 195);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }, []);
  useEffect(() => () => sign.dispose(), [sign]);
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#434d4d" roughness={.96} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .001, 0]} receiveShadow><planeGeometry args={[18, 18]} /><meshStandardMaterial color="#69706b" roughness={.91} /></mesh>
    <gridHelper args={[18, 36, '#7f8780', '#737a74']} position={[0, .002, 0]} />
    {[-1, 1].flatMap(sign => [0, 1].map(axis => <mesh key={`${sign}-${axis}`} position={axis ? [0, .003, sign * 8.8] : [sign * 8.8, .003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={axis ? [17.6, .045] : [.045, 17.6]} /><meshBasicMaterial color="#d7ac4f" />
    </mesh>))}
    {[-1, 0, 1].map(lane => <mesh key={lane} rotation={[-Math.PI / 2, 0, 0]} position={[lane * 1.7, .004, 1.9]}>
      <planeGeometry args={[.026, 6.5]} /><meshBasicMaterial color={lane === 0 ? '#e0bb61' : '#a8b1a6'} />
    </mesh>)}
    {YARD_OBSTACLES.map((o, index) => <group key={index} position={[o.x, 0, o.z]}>
      <mesh position={[0, o.height / 2, 0]} castShadow receiveShadow><boxGeometry args={[o.width, o.height, o.depth]} /><meshStandardMaterial color={index % 2 ? '#52645d' : '#454f55'} roughness={.78} metalness={.25} /></mesh>
      <mesh position={[0, o.height + .002, 0]}><boxGeometry args={[o.width * .84, .004, o.depth * .84]} /><meshStandardMaterial color="#81908a" roughness={.8} /></mesh>
      {[-1, 1].map(side => <mesh key={side} position={[o.width * side * .31, o.height / 2, -o.depth / 2 - .001]}>
        <boxGeometry args={[.035, o.height * .86, .003]} /><meshStandardMaterial color="#c6a353" roughness={.8} /></mesh>)}
    </group>)}
    {Array.from({ length: 18 }, (_, i) => {
      const angle = i / 18 * Math.PI * 2; const x = Math.sin(angle) * 11.2, z = Math.cos(angle) * 11.2;
      return <mesh key={i} position={[x, .45, z]} castShadow><boxGeometry args={[.45, .9, .45]} /><meshStandardMaterial color="#3e5055" roughness={.9} /></mesh>;
    })}
    <group position={[0, 0, 7.4]}>
      <mesh position={[0, .72, 0]}><boxGeometry args={[2.8, .72, .11]} /><meshStandardMaterial color="#17262e" roughness={.7} /></mesh>
      <mesh position={[0, .72, -.06]} rotation={[0, Math.PI, 0]}><planeGeometry args={[2.65, .66]} /><meshBasicMaterial map={sign} /></mesh>
      {[-1, 1].map(side => <mesh key={side} position={[side * 1.22, .24, 0]}><boxGeometry args={[.065, .48, .065]} /><meshStandardMaterial color="#283c43" metalness={.6} roughness={.6} /></mesh>)}
    </group>
    {[-1, 1].flatMap(side => [-1, 1].map(end => <group key={`${side}-${end}`} position={[side * 7.8, 0, end * 7.8]}>
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[.025, .045, 2.4, 8]} /><meshStandardMaterial color="#253c44" metalness={.55} roughness={.7} /></mesh>
      <mesh position={[0, 2.42, 0]}><boxGeometry args={[.3, .065, .15]} /><meshStandardMaterial color="#e8dbad" emissive="#dcc48b" emissiveIntensity={1.7} /></mesh>
    </group>))}
  </group>;
}
