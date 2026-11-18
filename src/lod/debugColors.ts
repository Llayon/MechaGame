import * as THREE from 'three';

const colors = ['0.15, 0.85, 0.25', '0.95, 0.72, 0.08', '0.95, 0.25, 0.08', '0.52, 0.18, 0.9'];

/** Only installed during inspection. Retain the source vertex shaders (wind, GPU skinning, sliding grass). */
export function showLodColors(renderer: THREE.WebGLRenderer) {
  const direct = renderer.renderBufferDirect;
  const variants = new Map<THREE.Material, Map<number, THREE.Material>>();
  renderer.renderBufferDirect = function(camera, scene, geometry, material, object, group) {
    let node: THREE.Object3D | null = object;
    while (node && node.userData.lodLevel === undefined) node = node.parent;
    if (scene && node) {
      const level = Math.min(colors.length - 1, Math.max(0, node.userData.lodLevel | 0));
      let levels = variants.get(material);
      if (!levels) variants.set(material, levels = new Map());
      let tinted = levels.get(level);
      if (!tinted) {
        const source = material;
        tinted = source.clone();
        if (tinted instanceof THREE.ShaderMaterial && source instanceof THREE.ShaderMaterial) {
          tinted.uniforms = source.uniforms;
        }
        tinted.onBeforeCompile = (shader, gl) => {
          source.onBeforeCompile(shader, gl);
          const tint = 'gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(' + colors[level] + '), 0.74);';
          const marker = '#include <tonemapping_fragment>';
          shader.fragmentShader = shader.fragmentShader.includes(marker)
            ? shader.fragmentShader.replace(marker, tint + '\n' + marker)
            : shader.fragmentShader.replace(/}\s*$/, tint + '\n}');
        };
        tinted.customProgramCacheKey = () => source.customProgramCacheKey() + '/lod-debug/' + level;
        levels.set(level, tinted);
      }
      material = tinted;
    }
    direct.call(this, camera, scene, geometry, material, object, group);
  };
  return () => {
    renderer.renderBufferDirect = direct;
    variants.forEach(levels => levels.forEach(m => m.dispose()));
  };
}
