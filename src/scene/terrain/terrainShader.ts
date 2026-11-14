import * as THREE from 'three';

/**
 * Creates a PBR MeshStandardMaterial patched via onBeforeCompile with pixel-level
 * slope, elevation, and river-proximity procedural texturing:
 * - Gentle slopes: organic moss, alpine grass, and dark peat tufts (high matte roughness)
 * - Steep slopes (> 30 deg): bare stratified slate rock with geological strata & fissures
 * - 5-8 m riverbank strip: wet river pebbles & dark wet sand with moisture sheen
 * - Concrete plateaus, tactical roads, quarry ochre & shoal ramps stay cleanly preserved
 */
export function createTerrainSurfaceMaterial(
  terrainBump: THREE.Texture,
  bumpScale = 0.28,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: false,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.04,
    bumpMap: terrainBump,
    bumpScale,
  });

  mat.customProgramCacheKey = () => 'sector7-slope-height-terrain-v3';

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aZoneMask;
attribute vec4 aSurfaceHint;
varying vec3 vTerrWorldPos;
varying vec3 vTerrWorldNormal;
varying vec4 vTerrZone;
varying vec4 vTerrHint;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vec4 terrWp = modelMatrix * vec4( transformed, 1.0 );
vTerrWorldPos = terrWp.xyz;
vTerrWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );
vTerrZone = aZoneMask;
vTerrHint = aSurfaceHint;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vTerrWorldPos;
varying vec3 vTerrWorldNormal;
varying vec4 vTerrZone;
varying vec4 vTerrHint;

vec3 terrSrgb2Lin( vec3 c ) {
  return pow( max( c, vec3( 0.0 ) ), vec3( 2.2 ) );
}

float terrHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
}

float terrNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 );
  float a = terrHash( i );
  float b = terrHash( i + vec2( 1.0, 0.0 ) );
  float c = terrHash( i + vec2( 0.0, 1.0 ) );
  float d = terrHash( i + vec2( 1.0, 1.0 ) );
  return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}

float terrFbm2( vec2 p ) {
  float v = 0.0;
  float a = 0.5;
  for ( int i = 0; i < 2; i++ ) {
    v += a * terrNoise( p );
    p *= 2.07;
    a *= 0.5;
  }
  return v / 0.75;
}

float terrFbm3( vec2 p ) {
  float v = 0.0;
  float a = 0.5;
  for ( int i = 0; i < 3; i++ ) {
    v += a * terrNoise( p );
    p *= 2.03;
    a *= 0.5;
  }
  return v / 0.875;
}

// Fast rounded river-pebble cellular field: x = dome height (0..1), y = per-pebble ID (0..1)
vec2 terrPebbleCell( vec2 p ) {
  vec2 ip = floor( p );
  vec2 fp = fract( p );
  float minD = 1.6;
  float bestId = 0.0;
  for ( int j = -1; j <= 1; j++ ) {
    for ( int i = -1; i <= 1; i++ ) {
      vec2 neighbor = vec2( float( i ), float( j ) );
      vec2 cellId = ip + neighbor;
      float r1 = terrHash( cellId );
      float r2 = terrHash( cellId + vec2( 19.3, 47.1 ) );
      vec2 pt = neighbor + 0.18 + 0.64 * vec2( r1, r2 ) - fp;
      float d = dot( pt, pt );
      if ( d < minD ) {
        minD = d;
        bestId = r1;
      }
    }
  }
  float dome = clamp( 1.0 - sqrt( minD ) * 1.45, 0.0, 1.0 );
  return vec2( dome * dome, bestId );
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec3 terrN = normalize( vTerrWorldNormal );
float terrNY = clamp( terrN.y, 0.0, 1.0 );
float terrSlopeDeg = acos( terrNY ) * 57.29578;
float terrSlopeTan = sqrt( max( 0.0, 1.0 - terrNY * terrNY ) ) / max( 0.18, terrNY );

float terrMacro = terrFbm3( vTerrWorldPos.xz * 0.065 + vec2( 3.1, -2.4 ) );
float terrMid = terrFbm2( vTerrWorldPos.xz * 0.26 + vec2( -5.2, 7.8 ) );
float terrFine = terrNoise( vTerrWorldPos.xz * 1.25 + vec2( 1.7, 4.3 ) );
float terrMicro = terrNoise( vTerrWorldPos.xz * 3.4 - vec2( 8.1, 2.9 ) );

// Continuous interpolated fields (zero binary vertex color jumps across triangles)
float terrIslandMask = clamp( vTerrZone.x, 0.0, 1.0 );
float terrQuarryRaw = clamp( vTerrZone.y, 0.0, 1.0 );
float terrRiverVicinity = clamp( vTerrZone.z, 0.0, 1.0 );
float terrRoadDist = vTerrZone.w;
float terrShoalDist = vTerrHint.x;
float terrRockRampDist = vTerrHint.y;
float terrChannelMask = clamp( vTerrHint.z, 0.0, 1.0 );
float terrTerraceDist = vTerrHint.w;

// Per-pixel manmade concrete masks (Airfield apron, Citadel courtyard, Central Island deck)
vec2 airD = vTerrWorldPos.xz - vec2( -134.0, 99.0 );
vec2 airL = vec2( airD.x * 0.97589745 - airD.y * -0.21822962, airD.x * -0.21822962 + airD.y * 0.97589745 );
float airPadMask = ( 1.0 - smoothstep( 32.0, 44.0, abs( airL.x ) ) ) * ( 1.0 - smoothstep( 24.0, 36.0, abs( airL.y ) ) );
float airConcrete = smoothstep( 0.48, 0.62, airPadMask + ( terrMid - 0.5 ) * 0.06 );

float citOctDist = length( ( vTerrWorldPos.xz - vec2( 122.0, -78.0 ) ) / vec2( 52.9, 44.7 ) );
float citConcrete = ( 1.0 - smoothstep( 0.96, 1.02, citOctDist + ( terrMid - 0.5 ) * 0.025 ) ) * smoothstep( 16.0, 17.5, vTerrWorldPos.y );
float islandConcrete = smoothstep( 0.60, 0.72, terrIslandMask + ( terrMid - 0.5 ) * 0.05 ) * smoothstep( 5.05, 5.45, vTerrWorldPos.y );
float terrConcrete = clamp( max( airConcrete, max( citConcrete, islandConcrete ) ), 0.0, 1.0 );

// Per-pixel compacted dirt road mask from continuous road SDF + sub-meter gravel noise
float roadNoise = ( terrMid - 0.5 ) * 0.22 + ( terrFine - 0.5 ) * 0.12;
float terrRoad = ( 1.0 - smoothstep( 0.86, 1.06, terrRoadDist + roadNoise ) ) * ( 1.0 - smoothstep( 0.14, 0.28, terrChannelMask ) ) * ( 1.0 - terrConcrete );
float terrManmade = clamp( terrConcrete + terrRoad, 0.0, 1.0 );
float terrQuarry = terrQuarryRaw * ( 1.0 - terrConcrete ) * smoothstep( -0.4, 0.2, vTerrWorldPos.y );

// Per-pixel rock pads around Citadel wall skirt, 3 jump-jet terraces, and rocky approach ramps
float citSkirtRock = smoothstep( 0.96, 1.03, citOctDist ) * ( 1.0 - smoothstep( 1.24, 1.54, citOctDist + ( terrMid - 0.5 ) * 0.08 ) ) * smoothstep( 11.5, 14.5, vTerrWorldPos.y );
float terraceRock = 1.0 - smoothstep( 0.76, 1.05, terrTerraceDist + ( terrMacro - 0.5 ) * 0.22 + ( terrMid - 0.5 ) * 0.12 );
float shoalNoise = ( terrMid - 0.5 ) * 0.20 + ( terrFine - 0.5 ) * 0.10;
float terrShoalRamp = ( 1.0 - smoothstep( 0.84, 1.06, terrShoalDist + shoalNoise ) ) * ( 1.0 - terrConcrete );
float rampRock = ( 1.0 - smoothstep( 0.86, 1.08, terrRockRampDist + ( terrMid - 0.5 ) * 0.15 ) ) * ( 1.0 - terrShoalRamp );
float terrRockPad = clamp( max( citSkirtRock, max( terraceRock, rampRock ) ), 0.0, 1.0 );

// Per-pixel Citadel flank cliff darkening so fortress walls pop like a crown
float citMtnDist = length( ( vTerrWorldPos.xz - vec2( 122.0, -78.0 ) ) / vec2( 86.0, 76.0 ) );
float citDarkBase = clamp( ( 1.08 - citMtnDist ) * 1.65, 0.0, 1.0 ) * clamp( ( vTerrWorldPos.y - 6.5 ) / 5.5, 0.0, 1.0 );
float terrCitDark = citDarkBase * mix( 0.85, 0.45, terrRoad ) * ( 1.0 - terrConcrete );

// 1. Gentle slope biome: organic moss, tactical alpine grass & peat flecks (matte, non-plastic)
vec3 colMossDeep = terrSrgb2Lin( vec3( 0.165, 0.245, 0.180 ) );
vec3 colMossRich = terrSrgb2Lin( vec3( 0.235, 0.325, 0.220 ) );
vec3 colGrassOlive = terrSrgb2Lin( vec3( 0.285, 0.345, 0.245 ) );
vec3 colGrassDry = terrSrgb2Lin( vec3( 0.340, 0.375, 0.305 ) );
vec3 colPeatSoil = terrSrgb2Lin( vec3( 0.185, 0.180, 0.155 ) );

float mossPatch = smoothstep( 0.32, 0.72, terrMacro * 0.65 + terrMid * 0.35 );
vec3 naturalGrassCol = mix( colMossDeep, colMossRich, smoothstep( 0.25, 0.78, terrMid ) );
vec3 oliveGrassCol = mix( colGrassOlive, colGrassDry, smoothstep( 0.38, 0.85, terrMacro ) );
naturalGrassCol = mix( naturalGrassCol, oliveGrassCol, mossPatch );
float peatMask = smoothstep( 0.68, 0.90, terrFine * 0.55 + ( 1.0 - terrMid ) * 0.45 ) * 0.45;
naturalGrassCol = mix( naturalGrassCol, colPeatSoil, peatMask );
naturalGrassCol *= 0.88 + terrMicro * 0.24;
float highAltDry = smoothstep( 9.5, 19.0, vTerrWorldPos.y );
naturalGrassCol = mix( naturalGrassCol, colGrassDry * ( 0.90 + terrFine * 0.20 ), highAltDry * 0.52 );

// Subtle dry sandy-shore blend near waterline (below 1.12 units) before river pebbles
vec3 colShoreSand = terrSrgb2Lin( vec3( 0.435, 0.416, 0.380 ) );
float lowSandMask = ( 1.0 - smoothstep( 0.75, 1.35, vTerrWorldPos.y + ( terrMid - 0.5 ) * 0.35 ) ) * ( 1.0 - smoothstep( 26.0, 34.0, terrSlopeDeg ) );
naturalGrassCol = mix( naturalGrassCol, colShoreSand * ( 0.90 + terrFine * 0.18 ), lowSandMask * 0.45 );

// 2. Steep slopes (> 26-32 deg), rock terraces & upper alpine cliffs -> bare fractured slate rock
float terrSlopeRock = smoothstep( 25.5, 32.5, terrSlopeDeg + ( terrMacro - 0.5 ) * 5.8 + ( terrMid - 0.5 ) * 3.4 + ( terrFine - 0.5 ) * 1.4 );
float terrHighRock = smoothstep( 23.0, 31.0, vTerrWorldPos.y + ( terrMacro - 0.5 ) * 5.0 );
float terrRockWeight = clamp( max( max( terrSlopeRock, terrHighRock ), terrRockPad ), 0.0, 1.0 ) * ( 1.0 - terrManmade );

float rockGrain = terrFbm3( vec2( vTerrWorldPos.x * 0.14 + vTerrWorldPos.z * 0.07, vTerrWorldPos.y * 0.28 + terrMacro * 2.4 ) );
float rockDetail = terrFbm2( vTerrWorldPos.xz * 0.34 + vec2( vTerrWorldPos.y * 0.18, -vTerrWorldPos.y * 0.12 ) );
float strataLedge = mix( rockGrain, rockDetail, 0.45 );
float strataDistFade = clamp( 1.0 - length( vViewPosition ) / 460.0, 0.25, 1.0 );
float strataContrast = mix( 0.5, strataLedge, 0.48 * strataDistFade + 0.18 );
float rockFissure = ( 1.0 - smoothstep( 0.06, 0.24, abs( terrMid - 0.5 ) ) ) * ( 0.45 + 0.55 * terrFine );

vec3 colRockBase = terrSrgb2Lin( vec3( 0.322, 0.357, 0.400 ) );
vec3 colRockDark = terrSrgb2Lin( vec3( 0.225, 0.255, 0.292 ) );
vec3 colRockLight = terrSrgb2Lin( vec3( 0.388, 0.428, 0.472 ) );
vec3 colRockCrevice = terrSrgb2Lin( vec3( 0.165, 0.190, 0.222 ) );

vec3 rockCol = mix( colRockDark, colRockBase, smoothstep( 0.22, 0.78, strataContrast ) );
rockCol = mix( rockCol, colRockLight, smoothstep( 0.62, 0.94, strataContrast ) * 0.42 );
rockCol = mix( rockCol, colRockCrevice, rockFissure * 0.52 );
rockCol *= 0.89 + terrMicro * 0.22;

// Preserve quarry terracotta ochre on gentle quarry ground & ironstone strata on steep pit walls
vec3 colQuarryEarth = terrSrgb2Lin( vec3( 0.561, 0.337, 0.259 ) );
vec3 colQuarryDeep = terrSrgb2Lin( vec3( 0.415, 0.245, 0.185 ) );
vec3 quarryTone = mix( colQuarryDeep, colQuarryEarth, 0.35 + terrMid * 0.55 ) * ( 0.92 + terrFine * 0.16 );
naturalGrassCol = mix( naturalGrassCol, quarryTone, terrQuarry * 0.92 );
rockCol = mix( rockCol, mix( rockCol, quarryTone, 0.62 ), terrQuarry );

// Darken cliffs directly supporting the Citadel so its concrete walls pop cleanly
rockCol *= mix( 1.0, 0.76, terrCitDark * 0.82 );
naturalGrassCol *= mix( 1.0, 0.80, terrCitDark * 0.65 );

// Blend gentle moss/grass with > 26-32 deg rock per pixel
vec3 terrCol = mix( naturalGrassCol, rockCol, terrRockWeight );

// Per-pixel sandy-gravel shoal ramp tinting
vec3 colSandDry = terrSrgb2Lin( vec3( 0.639, 0.576, 0.478 ) );
vec3 colSandWet = terrSrgb2Lin( vec3( 0.467, 0.427, 0.369 ) );
vec3 colShoalSub = terrSrgb2Lin( vec3( 0.341, 0.396, 0.412 ) );
vec3 colShallowBed = terrSrgb2Lin( vec3( 0.298, 0.337, 0.376 ) );
vec3 shoalHigh = mix( colSandWet, colSandDry, clamp( 0.45 + terrMid * 0.50, 0.0, 1.0 ) );
vec3 shoalMid = mix( colShoalSub, colSandWet, smoothstep( -0.55, 0.35, vTerrWorldPos.y ) );
vec3 shoalLow = mix( colShallowBed, colShoalSub, 0.58 + terrMid * 0.32 );
vec3 shoalTone = mix( shoalLow, shoalMid, smoothstep( -0.60, -0.45, vTerrWorldPos.y ) );
shoalTone = mix( shoalTone, shoalHigh, smoothstep( 0.28, 0.45, vTerrWorldPos.y ) );
terrCol = mix( terrCol, shoalTone * ( 0.92 + terrFine * 0.16 ), terrShoalRamp * ( 1.0 - terrRockWeight * 0.6 ) );

// 3. 5-8 m riverbank strip: wet pebbles & dark damp sand (with underwater riverbed continuity)
float approxHorizDistM = ( max( 0.0, vTerrWorldPos.y ) / clamp( terrSlopeTan, 0.22, 0.56 ) ) * 3.75;
float shoreWobbleM = ( terrMacro - 0.5 ) * 2.1 + ( terrMid - 0.5 ) * 0.9;
float distFromWaterM = approxHorizDistM + shoreWobbleM;

float cliffWetLimit = 1.0 - smoothstep( 38.0, 56.0, terrSlopeDeg );
float shoreBand = ( 1.0 - smoothstep( 4.8, 8.2, distFromWaterM ) ) * terrRiverVicinity * cliffWetLimit * ( 1.0 - terrManmade );
float underWaterMask = ( 1.0 - smoothstep( -0.45, 0.15, vTerrWorldPos.y ) ) * terrRiverVicinity * ( 1.0 - terrManmade );

vec2 pebCoarse = terrPebbleCell( vTerrWorldPos.xz * 1.45 );
vec2 pebFine = terrPebbleCell( vTerrWorldPos.xz * 3.6 + vec2( 11.4, -7.2 ) );
float pebDome = max( pebCoarse.x, pebFine.x * 0.76 );
float pebSpec = smoothstep( 0.14, 0.62, pebDome );

vec3 colDarkSand = terrSrgb2Lin( vec3( 0.195, 0.175, 0.155 ) );
vec3 colWetSand = terrSrgb2Lin( vec3( 0.145, 0.132, 0.118 ) );
vec3 colPebbleCool = terrSrgb2Lin( vec3( 0.340, 0.365, 0.390 ) );
vec3 colPebbleWarm = terrSrgb2Lin( vec3( 0.435, 0.390, 0.330 ) );
vec3 colDampGravel = terrSrgb2Lin( vec3( 0.365, 0.330, 0.285 ) );

vec3 pebbleTint = mix( colPebbleCool, colPebbleWarm, pebCoarse.y );
vec3 shoreMat = mix( colDarkSand, pebbleTint, pebSpec * 0.84 );
shoreMat = mix( shoreMat, colDampGravel, smoothstep( 4.4, 7.8, distFromWaterM ) * 0.48 );
float waterMoisture = ( 1.0 - smoothstep( 0.6, 5.8, distFromWaterM ) ) * smoothstep( -0.9, 0.05, vTerrWorldPos.y );
shoreMat = mix( shoreMat, colWetSand * ( 0.78 + pebSpec * 0.65 ), waterMoisture * 0.56 );

// Apply riverbank wet pebble & dark sand strip, and keep deep riverbed coherent
float effectiveShore = clamp( max( shoreBand, underWaterMask * 0.55 ), 0.0, 1.0 );
terrCol = mix( terrCol, shoreMat, effectiveShore );
vec3 colDeepRiverbed = terrSrgb2Lin( vec3( 0.102, 0.161, 0.204 ) );
float deepBedFade = ( 1.0 - smoothstep( -2.2, -0.35, vTerrWorldPos.y ) ) * underWaterMask;
terrCol = mix( terrCol, mix( colDeepRiverbed, shoreMat, 0.28 ), deepBedFade );

// 4. Manmade concrete pads (HQ, Citadel, Island) & compacted tactical dirt roads (100% per-pixel)
vec3 colConcreteBase = terrSrgb2Lin( vec3( 0.608, 0.631, 0.651 ) );
vec3 colRoadDirt = terrSrgb2Lin( vec3( 0.341, 0.369, 0.400 ) );
vec3 concreteCol = mix( colConcreteBase, colRockBase, terrMacro * 0.14 ) * ( 0.94 + terrFine * 0.12 );
vec3 roadCol = mix( colRoadDirt, colRockDark, terrMid * 0.22 ) * ( 0.94 + terrFine * 0.12 );
vec3 manmadeCol = mix( roadCol, concreteCol, clamp( terrConcrete / max( 0.001, terrManmade ), 0.0, 1.0 ) );
diffuseColor.rgb = mix( terrCol, manmadeCol, terrManmade );

float terrWetness = clamp( waterMoisture * effectiveShore, 0.0, 1.0 ) * ( 1.0 - terrManmade );
float terrGrassWeight = ( 1.0 - terrRockWeight ) * ( 1.0 - effectiveShore ) * ( 1.0 - terrManmade ) * ( 1.0 - terrQuarry );
float terrMicroHeight =
  strataLedge * terrRockWeight * 0.58 +
  pebDome * effectiveShore * 0.98 +
  ( terrMicro - 0.5 ) * terrGrassWeight * 0.35;
float terrMicroStrength =
  mix( 0.12, 0.30, clamp( max( terrRockWeight * 0.85, effectiveShore ), 0.0, 1.0 ) ) *
  ( 1.0 - terrManmade * 0.7 ) *
  clamp( 1.0 - length( vViewPosition ) / 480.0, 0.18, 1.0 );`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
float terrTargetRough = 0.93;
terrTargetRough = mix( terrTargetRough, 0.84, terrRockWeight );
terrTargetRough = mix( terrTargetRough, 0.86, terrQuarry * ( 1.0 - terrRockWeight ) );
terrTargetRough = mix( terrTargetRough, 0.78, effectiveShore );
terrTargetRough = mix( terrTargetRough, 0.34, terrWetness );
terrTargetRough = mix( terrTargetRough, 0.82, terrManmade );
roughnessFactor = clamp( terrTargetRough, 0.28, 0.98 );`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
#ifdef USE_BUMPMAP
  vec2 terrDxy = vec2( dFdx( terrMicroHeight ), dFdy( terrMicroHeight ) ) * terrMicroStrength;
  normal = perturbNormalArb( - vViewPosition, normal, terrDxy, faceDirection );
#endif`,
      );
  };

  return mat;
}
