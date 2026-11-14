import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { SectorId, TacticalPinSpec } from '../../map/sectors';
import { getTerrainHeight } from '../../map/terrainMath';

function createPinTexture(
  badge: string,
  tone: TacticalPinSpec['tone'],
  isActive: boolean,
): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const r = 44;

  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = isActive ? 'rgba(217, 162, 68, 0.35)' : 'rgba(10, 16, 22, 0.65)';
  ctx.fill();

  const fillMap: Record<TacticalPinSpec['tone'], string> = {
    crimson: '#6d2b24',
    amber: '#8a6220',
    steel: '#263844',
  };
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = isActive ? '#b98229' : fillMap[tone];
  ctx.fill();

  ctx.lineWidth = isActive ? 5 : 3.5;
  ctx.strokeStyle = isActive ? '#ffe2a6' : '#cfdbe3';
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font =
    badge.length > 1
      ? '700 34px "Barlow Condensed", sans-serif'
      : '700 44px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, cx, cy + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface TacticalPinProps {
  pin: TacticalPinSpec;
  isActive: boolean;
  onSelect: (id: SectorId) => void;
}

export function TacticalPin({ pin, isActive, onSelect }: TacticalPinProps) {
  const [hovered, setHovered] = useState(false);
  const groundY = useMemo(() => getTerrainHeight(pin.x, pin.z), [pin.x, pin.z]);
  const stemH = pin.yOffset - groundY;

  const texture = useMemo(
    () => createPinTexture(pin.badge, pin.tone, isActive),
    [pin.badge, pin.tone, isActive],
  );

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  const spriteScale = isActive || hovered ? 10.5 : 8.5;

  return (
    <group position={[pin.x, groundY, pin.z]}>
      <mesh position={[0, stemH * 0.5, 0]}>
        <cylinderGeometry args={[0.16, 0.16, stemH, 6]} />
        <meshBasicMaterial
          color={isActive ? '#f3c168' : '#8ea3b0'}
          transparent
          opacity={0.7}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, 0]}>
        <ringGeometry args={[1.4, 2.2, 20]} />
        <meshBasicMaterial
          color={isActive ? '#f3c168' : '#8ea3b0'}
          transparent
          opacity={isActive ? 0.9 : 0.45}
        />
      </mesh>
      <sprite
        position={[0, stemH + 2.2, 0]}
        scale={[spriteScale, spriteScale, 1]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(pin.sectorId);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <spriteMaterial map={texture} transparent depthTest={false} />
      </sprite>
    </group>
  );
}
