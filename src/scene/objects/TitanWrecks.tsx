import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  TITAN_BREACH_TREES,
  createTitanWrecksGeometry,
} from '../../map/titanWrecks';
import { createUnifiedPineTreeGeometry } from './pineGeometry';

const _dummy = new THREE.Object3D();
const _tmpCol = new THREE.Color();

function createMetalPlateBumpTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    // Subtle pitted corrosion & armor panel seam grid
    for (let y = 0; y < size; y += 8) {
      for (let x = 0; x < size; x += 8) {
        const n = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        const v = Math.round(112 + n * 34);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 8, 8);
      }
    }
    ctx.strokeStyle = '#484848';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, size - 4, size - 4);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.5);
    ctx.lineTo(size, size * 0.5);
    ctx.moveTo(size * 0.5, 0);
    ctx.lineTo(size * 0.5, size);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Renders the 2 colossal buried Old-World Titan wrecks inside playable Sector 7:
 * 1) Merged low-poly hull geometry in 1 Draw Call with a custom `worldNormal.y`
 *    soil/grass top-deposition + buried slope-skirt + worn metal tread shader.
 * 2) Curated weathered pine trees growing out of soil-filled hull breaches in 1 InstancedMesh.
 */
export function TitanWrecks() {
  const breachTreeRef = useRef<THREE.InstancedMesh>(null);

  const {
    hullGeometry,
    bumpTex,
    hullMaterial,
    treeGeometry,
    treeMaterial,
  } = useMemo(() => {
    const hGeo = createTitanWrecksGeometry();
    const bTex = createMetalPlateBumpTexture();

    const hMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.28,
      bumpMap: bTex,
      bumpScale: 0.045,
      flatShading: true,
      fog: true,
    });

    hMat.customProgramCacheKey = () => 'sector7-titan-wreck-earth-v1';
    hMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aBurial;
attribute float aDeckWear;
varying vec3 vTitanWorldPos;
varying vec3 vTitanWorldNormal;
varying float vTitanBurial;
varying float vTitanDeckWear;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vec4 twWp = modelMatrix * vec4( transformed, 1.0 );
vTitanWorldPos = twWp.xyz;
vTitanWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );
vTitanBurial = aBurial;
vTitanDeckWear = aDeckWear;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vTitanWorldPos;
varying vec3 vTitanWorldNormal;
varying float vTitanBurial;
varying float vTitanDeckWear;

vec3 twSrgb2Lin( vec3 c ) {
  return pow( max( c, vec3( 0.0 ) ), vec3( 2.2 ) );
}

float twHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
}

float twNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( twHash( i ), twHash( i + vec2( 1.0, 0.0 ) ), u.x ),
    mix( twHash( i + vec2( 0.0, 1.0 ) ), twHash( i + vec2( 1.0, 1.0 ) ), u.x ),
    u.y
  );
}

float twFbm( vec2 p ) {
  float v = 0.0;
  float a = 0.5;
  for ( int i = 0; i < 3; i++ ) {
    v += a * twNoise( p );
    p *= 2.07;
    a *= 0.5;
  }
  return v / 0.875;
}`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
vec3 twN = normalize( vTitanWorldNormal );
float twMacro = twFbm( vTitanWorldPos.xz * 0.11 + vec2( 2.4, -4.1 ) );
float twMid = twNoise( vTitanWorldPos.xz * 0.45 + vec2( vTitanWorldPos.y * 0.25, 1.7 ) );
float twFine = twNoise( vTitanWorldPos.xz * 1.45 - vec2( 3.2, vTitanWorldPos.y * 0.5 ) );

// Weathered rust streaks & oxidized panel variation on exposed metal
float rustNoise = smoothstep( 0.42, 0.78, twMacro * 0.65 + twMid * 0.35 );
vec3 colRust = twSrgb2Lin( vec3( 0.365, 0.235, 0.175 ) );
diffuseColor.rgb = mix( diffuseColor.rgb, colRust, rustNoise * 0.38 * ( 1.0 - vTitanDeckWear * 0.55 ) );

// Matched to Sector 7 terrainShader earth, alpine grass, & river sand palette
vec3 colEarth = twSrgb2Lin( vec3( 0.205, 0.190, 0.160 ) );
vec3 colShoreSand = twSrgb2Lin( vec3( 0.385, 0.365, 0.330 ) );
vec3 colMossDark = twSrgb2Lin( vec3( 0.175, 0.255, 0.180 ) );
vec3 colGrassOlive = twSrgb2Lin( vec3( 0.275, 0.340, 0.235 ) );

// 1. Upward-facing worldNormal.y earth & grass turf accumulation
float upFacing = smoothstep( 0.46, 0.88, twN.y );
float treadClear = 1.0 - vTitanDeckWear * 0.56;
float soilWeight = smoothstep( 0.28, 0.68, upFacing * ( 0.55 + twMacro * 0.68 ) ) * treadClear;
float grassWeight = smoothstep( 0.50, 0.82, upFacing * ( 0.48 + twMid * 0.62 ) + twMacro * 0.16 ) * ( 1.0 - vTitanDeckWear * 0.72 );

// 2. Buried terrain-skirt blend where hull plunges into riverbank or mountain slope
float skirtTop = 1.75 + ( twMid - 0.5 ) * 0.85;
float skirtMask = ( 1.0 - smoothstep( -0.25, skirtTop, vTitanBurial ) ) * ( 1.0 - vTitanDeckWear * 0.75 );
float lowBankBlend = 1.0 - smoothstep( 1.2, 5.2, vTitanWorldPos.y );
vec3 skirtEarth = mix( colEarth, colShoreSand, lowBankBlend * 0.68 ) * ( 0.88 + twFine * 0.22 );

float twSoilCover = clamp( max( soilWeight, skirtMask ), 0.0, 1.0 );
vec3 turfCol = mix( colMossDark, colGrassOlive, smoothstep( 0.28, 0.76, twMacro ) ) * ( 0.88 + twFine * 0.24 );
vec3 earthLayer = mix( skirtEarth, turfCol, grassWeight );

diffuseColor.rgb = mix( diffuseColor.rgb, earthLayer, twSoilCover );
float twDirtOverlay = twSoilCover;`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
roughnessFactor = mix( roughnessFactor, 0.94, twDirtOverlay );`,
        )
        .replace(
          '#include <metalnessmap_fragment>',
          `#include <metalnessmap_fragment>
metalnessFactor = mix( metalnessFactor, 0.02, twDirtOverlay );`,
        );
    };

    const tGeo = createUnifiedPineTreeGeometry();
    const tMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.87,
      metalness: 0.02,
    });

    return {
      hullGeometry: hGeo,
      bumpTex: bTex,
      hullMaterial: hMat,
      treeGeometry: tGeo,
      treeMaterial: tMat,
    };
  }, []);

  useEffect(() => {
    const mesh = breachTreeRef.current;
    if (!mesh) return;

    const colA = new THREE.Color('#D4E5DE');
    const colB = new THREE.Color('#E8F4E2');

    TITAN_BREACH_TREES.forEach((t, i) => {
      _dummy.position.set(t.x, t.y, t.z);
      _dummy.rotation.set(t.tiltX, t.rotY, t.tiltZ);
      _dummy.scale.set(t.widthScale, t.heightScale, t.widthScale);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);

      _tmpCol.copy(colA).lerp(colB, t.tint);
      mesh.setColorAt(i, _tmpCol);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);

  useEffect(() => {
    return () => {
      hullGeometry.dispose();
      bumpTex.dispose();
      hullMaterial.dispose();
      treeGeometry.dispose();
      treeMaterial.dispose();
    };
  }, [hullGeometry, bumpTex, hullMaterial, treeGeometry, treeMaterial]);

  return (
    <group name="titan-wrecks">
      <mesh
        geometry={hullGeometry}
        material={hullMaterial}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={breachTreeRef}
        args={[treeGeometry, treeMaterial, TITAN_BREACH_TREES.length]}
        castShadow
        receiveShadow
      />
    </group>
  );
}
