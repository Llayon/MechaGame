import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { LightingPreset } from '../../map/sectors';
import { useSceneSimulation } from '../SceneSimulation';
import {
  MAX_MISSILE_RIBBONS,
  RIBBON_POINTS,
  RIBBON_SEGMENTS,
  resetMissileRibbonPool,
  stepMissileRibbonPool,
  type MissileRibbonPoolState,
} from './missileRibbonPool';

export interface MissileRibbonsProps {
  poolRef: React.MutableRefObject<MissileRibbonPoolState>;
  lightingPreset: LightingPreset;
  resetNonce: number;
}

const SMOKE_COLORS: Record<LightingPreset, THREE.Color> = {
  day: new THREE.Color('#E8EEF5'),
  dusk: new THREE.Color('#C7B7AB'),
  night: new THREE.Color('#4B5D73'),
};

const SMOKE_OPACITY: Record<LightingPreset, number> = {
  day: 0.88,
  dusk: 0.84,
  night: 0.72,
};

function createMissileRibbonGeometry() {
  const vertsPerTrail = RIBBON_POINTS * 2;
  const indicesPerTrail = RIBBON_SEGMENTS * 6;
  const totalVerts = MAX_MISSILE_RIBBONS * vertsPerTrail;
  const totalIndices = MAX_MISSILE_RIBBONS * indicesPerTrail;

  const positions = new Float32Array(totalVerts * 3);
  const prevPositions = new Float32Array(totalVerts * 3);
  const nextPositions = new Float32Array(totalVerts * 3);
  const sides = new Float32Array(totalVerts);
  const progresses = new Float32Array(totalVerts);
  const alphas = new Float32Array(totalVerts);
  const indices = new Uint16Array(totalIndices);

  let vIdx = 0;
  let iIdx = 0;

  for (let t = 0; t < MAX_MISSILE_RIBBONS; t++) {
    const baseVertex = t * vertsPerTrail;
    for (let p = 0; p < RIBBON_POINTS; p++) {
      const u = p / RIBBON_SEGMENTS;
      sides[vIdx] = -1.0;
      progresses[vIdx] = u;
      vIdx++;

      sides[vIdx] = 1.0;
      progresses[vIdx] = u;
      vIdx++;

      if (p < RIBBON_SEGMENTS) {
        const v0 = baseVertex + p * 2;
        const v1 = v0 + 1;
        const v2 = v0 + 2;
        const v3 = v0 + 3;
        indices[iIdx++] = v0;
        indices[iIdx++] = v1;
        indices[iIdx++] = v2;
        indices[iIdx++] = v2;
        indices[iIdx++] = v1;
        indices[iIdx++] = v3;
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  const prevAttr = new THREE.BufferAttribute(prevPositions, 3);
  const nextAttr = new THREE.BufferAttribute(nextPositions, 3);
  const alphaAttr = new THREE.BufferAttribute(alphas, 1);

  posAttr.setUsage(THREE.DynamicDrawUsage);
  prevAttr.setUsage(THREE.DynamicDrawUsage);
  nextAttr.setUsage(THREE.DynamicDrawUsage);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);

  geom.setAttribute('position', posAttr);
  geom.setAttribute('aPrev', prevAttr);
  geom.setAttribute('aNext', nextAttr);
  geom.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));
  geom.setAttribute('aProgress', new THREE.BufferAttribute(progresses, 1));
  geom.setAttribute('aAlpha', alphaAttr);
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.setDrawRange(0, 0);

  return {
    geom,
    positions,
    prevPositions,
    nextPositions,
    alphas,
    posAttr,
    prevAttr,
    nextAttr,
    alphaAttr,
  };
}

function createMissileRibbonMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseWidth: { value: 0.14 },
      uSmokeColor: { value: SMOKE_COLORS.dusk.clone() },
      uSmokeOpacity: { value: SMOKE_OPACITY.dusk },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
attribute vec3 aPrev;
attribute vec3 aNext;
attribute float aSide;
attribute float aProgress;
attribute float aAlpha;

uniform float uBaseWidth;

varying float vProgress;
varying float vAlpha;
varying float vSide;

void main() {
  vProgress = aProgress;
  vAlpha = aAlpha;
  vSide = aSide;

  if ( aAlpha <= 0.001 ) {
    gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );
    return;
  }

  vec3 tangent = aNext - aPrev;
  float tLen = length( tangent );
  tangent = tLen > 0.0005 ? tangent / tLen : vec3( 0.0, 1.0, 0.0 );

  vec3 toCamVec = cameraPosition - position;
  float cLen = length( toCamVec );
  vec3 toCam = cLen > 0.0005 ? toCamVec / cLen : vec3( 0.0, 0.0, 1.0 );

  vec3 rawSide = cross( tangent, toCam );
  float sLen = length( rawSide );
  vec3 sideDir;
  if ( sLen > 0.001 ) {
    sideDir = rawSide / sLen;
  } else {
    vec3 fallbackAxis = abs( tangent.y ) < 0.9 ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
    sideDir = normalize( cross( tangent, fallbackAxis ) );
  }

  // Crisp bright rocket head expanding slightly behind motor, then tapering cleanly to tail
  float widthCurve = mix( 0.58, 1.0, smoothstep( 0.0, 0.22, aProgress ) ) * ( 1.0 - aProgress * 0.78 );
  vec3 worldPos = position + sideDir * aSide * ( uBaseWidth * widthCurve );

  gl_Position = projectionMatrix * viewMatrix * vec4( worldPos, 1.0 );
}
`,
    fragmentShader: /* glsl */ `
uniform vec3 uSmokeColor;
uniform float uSmokeOpacity;

varying float vProgress;
varying float vAlpha;
varying float vSide;

void main() {
  if ( vAlpha <= 0.005 ) discard;

  float edgeFade = 1.0 - pow( abs( vSide ), 2.2 );
  float tailFade = pow( clamp( 1.0 - vProgress, 0.0, 1.0 ), 1.35 );

  // Bright rocket exhaust flame in first 16% of trail, transitioning to dense contrail smoke
  float flameMask = 1.0 - smoothstep( 0.0, 0.17, vProgress );
  float headGlow = 1.0 - smoothstep( 0.0, 0.06, vProgress );

  vec3 flameColor = vec3( 1.0, 0.56, 0.12 );
  vec3 col = mix( uSmokeColor, flameColor, flameMask );
  col += vec3( 1.0, 0.94, 0.72 ) * headGlow * 1.35;

  float density = mix( uSmokeOpacity, 1.0, flameMask );
  float alpha = edgeFade * tailFade * vAlpha * density;
  if ( alpha < 0.012 ) discard;

  gl_FragColor = vec4( col, clamp( alpha, 0.0, 1.0 ) );
}
`,
  });
}

export function MissileRibbons({
  poolRef,
  lightingPreset,
  resetNonce,
}: MissileRibbonsProps) {
  const { paused } = useSceneSimulation();
  const hadActiveRef = useRef(false);
  const prevResetNonceRef = useRef(resetNonce);

  const setup = useMemo(() => {
    const geo = createMissileRibbonGeometry();
    const mat = createMissileRibbonMaterial();
    return { ...geo, mat };
  }, []);

  useEffect(() => {
    setup.mat.uniforms.uSmokeColor.value.copy(SMOKE_COLORS[lightingPreset]);
    setup.mat.uniforms.uSmokeOpacity.value = SMOKE_OPACITY[lightingPreset];
  }, [lightingPreset, setup]);

  useEffect(() => {
    return () => {
      setup.geom.dispose();
      setup.mat.dispose();
    };
  }, [setup]);

  useEffect(() => {
    if (prevResetNonceRef.current === resetNonce) return;
    prevResetNonceRef.current = resetNonce;
    resetMissileRibbonPool(poolRef.current);
    hadActiveRef.current = true;
  }, [resetNonce, poolRef]);

  useFrame((_, delta) => {
    if (paused) return;

    const dt = Math.min(delta, 0.05);
    const pool = poolRef.current;
    if (pool.activeCount === 0 && !hadActiveRef.current && !pool.dirty) return;

    const nowActive = stepMissileRibbonPool(pool, dt);
    if (!pool.dirty && nowActive === 0 && !hadActiveRef.current) return;

    const { positions, prevPositions, nextPositions, alphas } = setup;
    const vertsPerTrail = RIBBON_POINTS * 2;

    let rendered = 0;
    for (let t = 0; t < pool.slots.length; t++) {
      const slot = pool.slots[t];
      if (!slot.active || slot.alpha <= 0.001) continue;
      const baseVertex = rendered++ * vertsPerTrail;

      const hx = slot.historyX;
      const hy = slot.historyY;
      const hz = slot.historyZ;
      const alpha = slot.alpha;

      for (let p = 0; p < RIBBON_POINTS; p++) {
        const pPrev = p > 0 ? p - 1 : 0;
        const pNext = p < RIBBON_POINTS - 1 ? p + 1 : RIBBON_POINTS - 1;

        const cx = hx[p];
        const cy = hy[p];
        const cz = hz[p];
        const px = hx[pPrev];
        const py = hy[pPrev];
        const pz = hz[pPrev];
        const nx = hx[pNext];
        const ny = hy[pNext];
        const nz = hz[pNext];

        for (let side = 0; side < 2; side++) {
          const vIdx = baseVertex + p * 2 + side;
          const i3 = vIdx * 3;
          positions[i3] = cx;
          positions[i3 + 1] = cy;
          positions[i3 + 2] = cz;

          prevPositions[i3] = px;
          prevPositions[i3 + 1] = py;
          prevPositions[i3 + 2] = pz;

          nextPositions[i3] = nx;
          nextPositions[i3 + 1] = ny;
          nextPositions[i3 + 2] = nz;

          alphas[vIdx] = alpha;
        }
      }
    }

    setup.geom.setDrawRange(0, rendered * RIBBON_SEGMENTS * 6);
    setup.posAttr.needsUpdate = true;
    setup.prevAttr.needsUpdate = true;
    setup.nextAttr.needsUpdate = true;
    setup.alphaAttr.needsUpdate = true;
    pool.dirty = false;
    hadActiveRef.current = nowActive > 0;
  });

  return (
    <mesh
      name="missile-ribbon-trails"
      geometry={setup.geom}
      material={setup.mat}
      frustumCulled={false}
      renderOrder={4}
    />
  );
}
