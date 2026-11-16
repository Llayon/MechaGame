import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { generateRockOutcropsData } from '../../map/worldStructures';
import { createChiseledRockGeometry } from './rockGeometry';

const _dummy = new THREE.Object3D();

function seededRand(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function RockOutcrops() {
  const rockRef = useRef<THREE.InstancedMesh>(null);

  const rocks = useMemo(() => generateRockOutcropsData(), []);

  const { geometry, material } = useMemo(() => {
    const geo = createChiseledRockGeometry(1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.04,
      flatShading: true,
    });

    mat.customProgramCacheKey = () => 'sector7-smart-rock-v1';
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying float vRockLocalY;
varying vec3 vRockWorldPos;
varying vec3 vRockWorldNormal;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vRockLocalY = transformed.y;
#ifdef USE_INSTANCING
  vec4 rWp = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
  vRockWorldNormal = normalize( mat3( modelMatrix ) * mat3( instanceMatrix ) * objectNormal );
#else
  vec4 rWp = modelMatrix * vec4( transformed, 1.0 );
  vRockWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );
#endif
vRockWorldPos = rWp.xyz;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying float vRockLocalY;
varying vec3 vRockWorldPos;
varying vec3 vRockWorldNormal;

vec3 rockSrgb2Lin( vec3 c ) {
  return pow( max( c, vec3( 0.0 ) ), vec3( 2.2 ) );
}

float rockHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
}

float rockNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( rockHash( i ), rockHash( i + vec2( 1.0, 0.0 ) ), f.x ),
    mix( rockHash( i + vec2( 0.0, 1.0 ) ), rockHash( i + vec2( 1.0, 1.0 ) ), f.x ),
    f.y
  );
}`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
// Match terrainShader.ts ground palette so lower stone edge grows seamlessly out of soil & moss
float rNoise = rockNoise( vRockWorldPos.xz * 0.14 + vec2( 2.3, -1.7 ) );
vec3 seamMoss = rockSrgb2Lin( vec3( 0.215, 0.305, 0.205 ) );
vec3 seamSoil = rockSrgb2Lin( vec3( 0.235, 0.215, 0.175 ) );
vec3 seamQuarry = rockSrgb2Lin( vec3( 0.365, 0.280, 0.210 ) );

float quarryBias = (1.0 - smoothstep( 12.0, 42.0, length( vRockWorldPos.xz - vec2( 116.0, 42.0 ) ) ));
vec3 groundSeamCol = mix( seamMoss, seamSoil, smoothstep( 0.38, 0.72, rNoise ) );
groundSeamCol = mix( groundSeamCol, seamQuarry, quarryBias * 0.75 );

// Blend bottom 30-45cm of stone into ground + darken recessed crevices near earth
float bottomBlend = smoothstep( -0.34, 0.24, vRockLocalY );
diffuseColor.rgb = mix( groundSeamCol * 0.88, diffuseColor.rgb, bottomBlend );

// Subtle weathered moss / lichen patina on flat upward-facing stone ledges
float topMoss = smoothstep( 0.62, 0.90, vRockWorldNormal.y ) * smoothstep( 0.25, 0.80, rNoise );
diffuseColor.rgb = mix( diffuseColor.rgb, seamMoss * 1.12, topMoss * 0.44 );`,
        );
    };

    return { geometry: geo, material: mat };
  }, []);

  useEffect(() => {
    const rMesh = rockRef.current;
    if (!rMesh) return;
    const c1 = new THREE.Color('#47505a');
    const c2 = new THREE.Color('#636d78');
    const cWarm = new THREE.Color('#5c5952');
    const tmp = new THREE.Color();

    rocks.forEach((r, i) => {
      // Embed bottom ~35% cleanly into slope so rocks never appear floating
      _dummy.position.set(r.x, r.y + r.sy * 0.10, r.z);
      _dummy.rotation.set(r.rotX, r.rotY, r.rotZ);
      _dummy.scale.set(r.sx, r.sy, r.sz);
      _dummy.updateMatrix();
      rMesh.setMatrixAt(i, _dummy.matrix);

      const t = seededRand(i + 500);
      tmp.copy(c1).lerp(c2, t);
      if (seededRand(i + 777) > 0.65) {
        tmp.lerp(cWarm, 0.45);
      }
      rMesh.setColorAt(i, tmp);
    });
    rMesh.instanceMatrix.needsUpdate = true;
    if (rMesh.instanceColor) rMesh.instanceColor.needsUpdate = true;
    rMesh.computeBoundingSphere();
  }, [rocks]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <instancedMesh
      ref={rockRef}
      args={[geometry, material, rocks.length]}
      castShadow
      receiveShadow
    />
  );
}
