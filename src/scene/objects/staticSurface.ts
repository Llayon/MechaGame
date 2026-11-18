import * as THREE from 'three';

export function canPackSurface(material: THREE.Material): material is THREE.MeshStandardMaterial {
  return material.type === 'MeshStandardMaterial' &&
    material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile &&
    !Object.values(material).some(value => value?.isTexture);
}

// Three's material serialization captures depth/stencil, blending, fog, shading and other
// flags. Sharing a draw across those boundaries would change render ordering or shading.
export function staticMaterialKey(material: THREE.Material, pack: boolean): string {
  if (material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ||
      Object.values(material).some(value => value?.isTexture)) return material.uuid;
  const { uuid, metadata, name, ...settings } = material.toJSON();
  if (pack) {
    delete settings.color;
    delete settings.roughness;
    delete settings.metalness;
    delete settings.emissive;
    delete settings.emissiveIntensity;
  }
  return JSON.stringify(settings);
}

export function createPackedSurface(source: THREE.MeshStandardMaterial) {
  const material = source.clone();
  material.color.setRGB(1, 1, 1);
  material.onBeforeCompile = shader => {
    const varyings = 'varying vec4 vAlbedoRough;\nvarying vec4 vEmissionMetal;\n';
    shader.vertexShader = 'attribute vec4 aAlbedoRough;\nattribute vec4 aEmissionMetal;\n' +
      varyings + shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvAlbedoRough = aAlbedoRough;\nvEmissionMetal = aEmissionMetal;');
    shader.fragmentShader = varyings + shader.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vAlbedoRough.rgb;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vAlbedoRough.a;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vEmissionMetal.a;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = vEmissionMetal.rgb;');
  };
  material.customProgramCacheKey = () => 'static-world-pbr-v1';
  return material;
}

export function writeSurfaceAttributes(geometry: THREE.BufferGeometry, materials: THREE.MeshStandardMaterial[], instanced: boolean) {
  const count = instanced ? materials.length : geometry.getAttribute('position').count;
  const albedoRough = new Float32Array(count * 4);
  const emissionMetal = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const surface = materials[instanced ? i : 0];
    const offset = i * 4;
    surface.color.toArray(albedoRough, offset);
    albedoRough[offset + 3] = surface.roughness;
    emissionMetal[offset] = surface.emissive.r * surface.emissiveIntensity;
    emissionMetal[offset + 1] = surface.emissive.g * surface.emissiveIntensity;
    emissionMetal[offset + 2] = surface.emissive.b * surface.emissiveIntensity;
    emissionMetal[offset + 3] = surface.metalness;
  }
  const Attribute = instanced ? THREE.InstancedBufferAttribute : THREE.BufferAttribute;
  geometry.setAttribute('aAlbedoRough', new Attribute(albedoRough, 4));
  geometry.setAttribute('aEmissionMetal', new Attribute(emissionMetal, 4));
}
