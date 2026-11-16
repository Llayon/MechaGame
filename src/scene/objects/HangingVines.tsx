import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  VINE_HEIGHT,
  createHangingVineGeometry,
  generateHangingVinesData,
} from '../../map/hangingVines';

export interface HangingVinesProps {
  isSoftwareGl: boolean;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

/**
 * Generates a crisp 128x256 trailing vine & ivy curtain texture on 2D Canvas.
 * Uses bold 4-5px stems and dense olive/pine leaf clusters so alphaTest cutouts
 * hold cleanly across mipmaps from close-up Drive mode to 150m Overview.
 */
function createHangingVinesTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 256);

  const stems: ReadonlyArray<{ x: number; len: number; freq: number; phase: number }> = [
    { x: 18, len: 188, freq: 0.048, phase: 0.2 },
    { x: 40, len: 236, freq: 0.042, phase: 1.4 },
    { x: 64, len: 214, freq: 0.052, phase: 2.6 },
    { x: 88, len: 242, freq: 0.044, phase: 3.8 },
    { x: 110, len: 174, freq: 0.056, phase: 5.0 },
  ];

  const leafTones = ['#364E23', '#46642D', '#587838', '#3F5A27', '#62843E'];

  // Top overhanging root crown mat so cornice seam looks anchored
  ctx.fillStyle = '#31471F';
  ctx.beginPath();
  ctx.ellipse(64, 10, 62, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  stems.forEach((stem, sIdx) => {
    // Draw main woody vine tendril
    ctx.strokeStyle = '#2E411D';
    ctx.lineWidth = 4.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(stem.x, 0);
    for (let y = 4; y <= stem.len; y += 6) {
      const wx = stem.x + Math.sin(y * stem.freq + stem.phase) * 5.8;
      ctx.lineTo(wx, y);
    }
    ctx.stroke();

    // Draw bold overlapping pointed ivy leaf clusters so silhouettes survive mipmapping
    for (let y = 10; y < stem.len - 6; y += 11) {
      const wx = stem.x + Math.sin(y * stem.freq + stem.phase) * 5.8;
      const taper = 1.0 - 0.32 * (y / stem.len);
      const leafRx = (9.2 + ((sIdx + y) % 3) * 1.6) * taper;
      const leafRy = (5.4 + ((sIdx * 2 + y) % 2) * 1.3) * taper;

      ctx.fillStyle = leafTones[(sIdx + Math.floor(y / 11)) % leafTones.length];
      ctx.beginPath();
      ctx.ellipse(wx - leafRx * 0.82, y, leafRx, leafRy, -0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = leafTones[(sIdx + Math.floor(y / 11) + 2) % leafTones.length];
      ctx.beginPath();
      ctx.ellipse(wx + leafRx * 0.82, y + 4, leafRx, leafRy, 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Central filler leaf for dense alpha silhouette
      if (y % 22 === 10) {
        ctx.fillStyle = leafTones[(sIdx + 1) % leafTones.length];
        ctx.beginPath();
        ctx.ellipse(wx, y + 2, leafRx * 0.84, leafRy * 0.94, 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Instanced trailing ivy/vines anchored beneath bridge cornices, arch crowns,
 * the Central Island retaining rim, Citadel outer walls, and Outpost ruins.
 * Renders in 1 Draw Call using alphaTest cutout (zero mobile transparency overdraw).
 */
export function HangingVines({ isSoftwareGl }: HangingVinesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const vines = useMemo(() => generateHangingVinesData(), []);
  const uTimeRef = useRef({ value: 1.1 });

  const { geometry, texture, material } = useMemo(() => {
    const geo = createHangingVineGeometry();
    const phases = new Float32Array(vines.length);
    for (let i = 0; i < vines.length; i++) {
      phases[i] = vines[i].phase;
    }
    geo.setAttribute('aVinePhase', new THREE.InstancedBufferAttribute(phases, 1));

    const tex = createHangingVinesTexture();
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      alphaTest: 0.34,
      side: THREE.DoubleSide,
      roughness: 0.86,
      metalness: 0.02,
      fog: true,
    });

    mat.customProgramCacheKey = () => 'sector7-hanging-vines-v1';
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTimeRef.current;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aVinePhase;
uniform float uTime;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
float swayFactor = clamp( -position.y / ${VINE_HEIGHT.toFixed(1)}, 0.0, 1.0 );
float swayBend = swayFactor * swayFactor;
transformed.z += sin( uTime * 1.9 + aVinePhase + position.y * 0.75 ) * 0.16 * swayBend;
transformed.x += cos( uTime * 1.35 + aVinePhase * 1.3 ) * 0.08 * swayFactor;`,
        );
    };

    return { geometry: geo, texture: tex, material: mat };
  }, [vines]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < vines.length; i++) {
      const v = vines[i];
      _dummy.position.set(v.x, v.y, v.z);
      _dummy.rotation.set(0, v.rotY, 0);
      _dummy.scale.set(v.scaleX, v.scaleY, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      _color.setRGB(v.tint[0], v.tint[1], v.tint[2]);
      mesh.setColorAt(i, _color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [vines]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      texture.dispose();
      material.dispose();
    };
  }, [geometry, texture, material]);

  useFrame((_, delta) => {
    if (isSoftwareGl) {
      uTimeRef.current.value = 1.1;
      return;
    }
    uTimeRef.current.value += Math.min(delta, 0.05);
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, vines.length]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    />
  );
}
