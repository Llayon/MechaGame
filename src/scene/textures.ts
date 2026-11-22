import * as THREE from 'three';

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

// Adjacent texels interpolate the same noise lattice. Hash each lattice point once.
function periodicNoise(period: number, seed: number) {
  const stride = period + 1;
  const lattice = new Float64Array(stride * stride);
  for (let y = 0; y <= period; y++) {
    for (let x = 0; x <= period; x++) {
      const n = Math.sin((x % period) * 127.1 + (y % period) * 311.7 + seed * 74.7) * 43758.5453123;
      lattice[y * stride + x] = n - Math.floor(n);
    }
  }

  return (u: number, v: number) => {
    const fx = u * period, fy = v * period;
    const x = Math.floor(fx), y = Math.floor(fy);
    const tx = fx - x, ty = fy - y;
    const sx = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
    const sy = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
    const i = y * stride + x, j = i + stride;
    const low = lattice[i] + (lattice[i + 1] - lattice[i]) * sx;
    const high = lattice[j] + (lattice[j + 1] - lattice[j]) * sx;
    return low + (high - low) * sy;
  };
}

export function createTerrainBumpTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const octave8 = periodicNoise(8, 1);
  const octave16 = periodicNoise(16, 2);
  const octave32 = periodicNoise(32, 3);
  const octave64 = periodicNoise(64, 4);

  // Seamless periodic multi-octave quintic micro-grain (zero diagonal sine striping)
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const fbm =
        octave8(u, v) * 0.48 +
        octave16(u, v) * 0.28 +
        octave32(u, v) * 0.16 +
        octave64(u, v) * 0.08;
      const val = Math.floor(Math.max(0, Math.min(1, fbm)) * 255);
      const i = (y * size + x) * 4;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(52, 42);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createHelipadTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const w = 512;
  const h = 384;
  const [canvas, ctx] = makeCanvas(w, h);

  // Light industrial concrete base (#9BA1A6)
  ctx.fillStyle = '#9BA1A6';
  ctx.fillRect(0, 0, w, h);

  // Subtle concrete expansion joint grid
  ctx.strokeStyle = 'rgba(54, 62, 70, 0.32)';
  ctx.lineWidth = 2;
  for (let gx = 0; gx <= w; gx += 64) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let gy = 0; gy <= h; gy += 64) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  // Subtle surface grain
  for (let i = 0; i < 3500; i++) {
    const rx = ((Math.sin(i * 17.1) * 43758.5) % 1 + 1) % 1;
    const ry = ((Math.sin(i * 53.7) * 29311.3) % 1 + 1) % 1;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(30,38,44,0.05)';
    ctx.fillRect(rx * w, ry * h, 2, 2);
  }

  // Two Helipad "H" circles with yellow-black technical hazard markings
  const drawPad = (cx: number, cy: number, radius: number) => {
    ctx.save();
    // Outer yellow-black segmented technical hazard ring
    const segs = 24;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2;
      const a1 = ((s + 1) / segs) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 7, a0, a1);
      ctx.strokeStyle = s % 2 === 0 ? 'rgba(218, 162, 46, 0.92)' : 'rgba(26, 30, 34, 0.92)';
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    // Cool slate asphalt circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(54, 62, 70, 0.72)';
    ctx.fill();

    // Dashed outer ring
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(232, 224, 198, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crisp "H"
    ctx.strokeStyle = 'rgba(235, 229, 206, 0.92)';
    ctx.lineWidth = 8;
    const hw = radius * 0.38;
    const hh = radius * 0.48;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy - hh);
    ctx.lineTo(cx - hw, cy + hh);
    ctx.moveTo(cx + hw, cy - hh);
    ctx.lineTo(cx + hw, cy + hh);
    ctx.moveTo(cx - hw, cy);
    ctx.lineTo(cx + hw, cy);
    ctx.stroke();

    // Yellow-black hazard safety strips flanking pad entry/exit edges
    for (const sign of [-1, 1]) {
      const bx = cx - 26;
      const by = cy + sign * (radius + 14);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k % 2 === 0 ? 'rgba(218, 162, 46, 0.9)' : 'rgba(26, 30, 34, 0.9)';
        ctx.fillRect(bx + k * 9, by - 2.5, 9, 5);
      }
    }
    ctx.restore();
  };

  drawPad(w * 0.33, h * 0.35, 62);
  drawPad(w * 0.68, h * 0.64, 62);

  // Taxiway yellow/ochre dashed safety border
  ctx.strokeStyle = 'rgba(218, 162, 46, 0.78)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createCorrugatedTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const size = 128;
  const [canvas, ctx] = makeCanvas(size, size);
  for (let y = 0; y < size; y++) {
    const wave = Math.sin((y / size) * Math.PI * 16) * 0.5 + 0.5;
    const v = Math.floor(110 + wave * 120);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, size, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBlueprintGridTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size, size);

  ctx.fillStyle = '#091118';
  ctx.fillRect(0, 0, size, size);

  // Minor grid
  ctx.strokeStyle = 'rgba(65, 108, 136, 0.14)';
  ctx.lineWidth = 1;
  const step = 32;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Major grid
  ctx.strokeStyle = 'rgba(92, 146, 178, 0.25)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= size; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Tactical crosshairs at major intersections
  ctx.strokeStyle = 'rgba(130, 185, 215, 0.36)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= size; x += 256) {
    for (let y = 0; y <= size; y += 256) {
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x, y + 6);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(42, 42);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWaterNormalTexture(maxAnisotropy = 4): THREE.DataTexture {
  const size = 512;
  const data = new Uint8Array(size * size * 4);

  const octave8 = periodicNoise(8, 1);
  const octave16 = periodicNoise(16, 2);
  const octave32 = periodicNoise(32, 3);
  const octave64 = periodicNoise(64, 4);

  // Precompute seamless multi-octave water heightfield so derivatives have zero grid alignment
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Slightly anisotropic across X/Y for natural river-current elongation
      const h =
        (octave8(u, v) - 0.5) * 0.50 +
        (octave16(u, v) - 0.5) * 0.28 +
        (octave32(u, v) - 0.5) * 0.14 +
        (octave64(u, v) - 0.5) * 0.06;
      heights[y * size + x] = h;
    }
  }

  // Gentle slope scale so ripples tilt +/-5..8 deg (realistic water Fresnel & localized sun trail)
  const slopeScale = 0.095;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const dhdx = (heights[y * size + xp] - heights[y * size + xm]) * 0.5 * size;
      const dhdy = (heights[yp * size + x] - heights[ym * size + x]) * 0.5 * size;

      let nx = -dhdx * (slopeScale / 12);
      let ny = -dhdy * (slopeScale / 12);
      let nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.repeat.set(14, 12);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createMistTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.04,
    size / 2,
    size / 2,
    size * 0.48,
  );
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.58)');
  grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.25)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Soft radial ground contact AO decal texture for anchoring trees onto sloped terrain.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const [canvas, ctx] = makeCanvas(size, size);
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.05,
    size / 2,
    size / 2,
    size * 0.49,
  );
  grad.addColorStop(0, 'rgba(8, 12, 10, 0.44)');
  grad.addColorStop(0.55, 'rgba(8, 12, 10, 0.22)');
  grad.addColorStop(1, 'rgba(8, 12, 10, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
