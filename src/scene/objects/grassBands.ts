import * as THREE from 'three';
import {
  createGrassClumpGeometry, GRASS_INSTANCE_COUNT_GPU, GRASS_INSTANCE_COUNT_SW,
  GRASS_PATCH_RADIUS_GPU, GRASS_PATCH_RADIUS_SW, GRASS_SPAN_W, GRASS_SPAN_D,
} from '../../map/grassField';

/** Compact the original world-locked seed population. The shader still handles
 * smooth growth, slope, wind and trampling. Only eligible seeds reach the GPU. */
export function createGrassBands(reduced: boolean, samples: Uint8Array, width: number, height: number) {
  const radius = reduced ? GRASS_PATCH_RADIUS_SW : GRASS_PATCH_RADIUS_GPU;
  const count = reduced ? GRASS_INSTANCE_COUNT_SW : GRASS_INSTANCE_COUNT_GPU;
  const period = 2 * radius;
  const template = createGrassClumpGeometry(count, period, reduced ? .35 : .32, reduced ? .084 : .046);
  const seeds = template.getAttribute('aOffset').array;
  const index = template.getIndex()!;
  // Keep both tall flowering stalks in the middle band and one at the horizon.
  // The selected blades are exactly the same shapes and positions across LODs.
  const bands = [[0,1,2,3,4,5,6], [0,2,3,5,6], [0,2,5]].map(blades => {
    const geo = new THREE.InstancedBufferGeometry();
    for (const [key, attr] of Object.entries(template.attributes)) if (key !== 'aOffset') geo.setAttribute(key, attr);
    const indices: number[] = [];
    let start = 0;
    for (let b = 0; b < 7; b++) {
      const end = start + (b === 4 ? 9 : 15);
      if (blades.includes(b)) for (let i = start; i < end; i++) indices.push(index.getX(i));
      start = end;
    }
    geo.setIndex(indices);
    const offsets = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    offsets.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aOffset', offsets);
    geo.instanceCount = 0;
    return { geo, offsets };
  });
  const maskColumns = width / GRASS_SPAN_W, maskRows = height / GRASS_SPAN_D;
  // Dilated bilinear mask: reject a tuft only when none of the four samples
  // could pass the shader threshold. Exact suitability still runs on the GPU.
  const mask = new Uint8Array(width * height);
  for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
    const current = z * width + x;
    const nextX = Math.min(width - 1, x + 1);
    const nextRow = Math.min(height - 1, z + 1) * width;
    mask[current] = Math.max(samples[current * 4 + 2], samples[(z*width+nextX)*4+2],
      samples[(nextRow+x)*4+2], samples[(nextRow+nextX)*4+2]);
  }
  let lastX = Infinity, lastZ = Infinity, lastScale = -1;
  return {
    geometries: bands.map(band => band.geo), radius,
    update(cx: number, cz: number, detail: number) {
      const scale = Math.min(1, Math.max(.3, detail));
      // Toroidal wrap skips to the opposite side of the square outside the
      // circular fade. A small guard around the radius covers movement between repacks.
      if (Math.abs(lastX-cx) < .5 && Math.abs(lastZ-cz) < .5 && scale === lastScale) return;
      lastX = cx; lastZ = cz; lastScale = scale;
      for (const band of bands) band.geo.instanceCount = 0;
      for (let id = 0; id < count; id++) {
        const src = id * 4;
        const x = seeds[src] + period * Math.floor((cx + radius - seeds[src]) / period);
        const z = seeds[src+1] + period * Math.floor((cz + radius - seeds[src+1]) / period);
        const dx = x - cx, dz = z - cz;
        const distSq = dx * dx + dz * dz;
        if (distSq > (radius + .8) ** 2) continue;
        const mx = Math.min(width-1, Math.max(0, Math.floor(x * maskColumns + width * .5 - .5)));
        const mz = Math.min(height-1, Math.max(0, Math.floor(z * maskRows + height * .5 - .5)));
        if (mask[mz * width + mx] < 35) continue;
        const rand = seeds[src+3] / (2*Math.PI);
        // Jitter the level boundaries per seed; spacing stays world-locked.
        const distance = Math.sqrt(distSq) / radius + (rand - .5) * .06;
        const level = distance < .47 * scale ? 0 : distance < .80 * scale ? 1 : 2;
        const density = (level === 2 ? .78 : 1) * scale;
        if (rand > density) continue;
        const { geo, offsets } = bands[level];
        const slot = geo.instanceCount++;
        offsets.setXYZW(slot, seeds[src], seeds[src+1], seeds[src+2], seeds[src+3]);
      }
      for (const { geo, offsets } of bands) {
        offsets.clearUpdateRanges();
        if (geo.instanceCount > 0) offsets.addUpdateRange(0, geo.instanceCount * 4);
        offsets.needsUpdate = true;
      }
    },
    dispose() { for (const { geo } of bands) geo.dispose(); template.dispose(); },
  };
}
