// Seed coordinates repeat once per patch. Suitability belongs to the world
// cell, so two copies of the same seed tile can have different eligible seeds.
const divisions = 8;
const cacheSide = divisions + 1; // A sliding patch can touch both end cells.
const wrap = (n: number, size: number) => ((n % size) + size) % size;

export function createGrassCells(seeds: ArrayLike<number>, period: number,
  eligible: (x: number, z: number) => boolean) {
  const side = period / divisions;
  const buckets = Array.from({ length: divisions ** 2 }, () => [] as number[]);
  for (let id = 0; id < seeds.length / 4; id++) {
    const x = Math.floor(seeds[id * 4] / side);
    const z = Math.floor(seeds[id * 4 + 1] / side);
    buckets[z * divisions + x].push(id);
  }
  const capacity = Math.max(...buckets.map(bucket => bucket.length));
  const cache = Array.from({ length: cacheSide ** 2 }, () => ({
    x: Infinity, z: Infinity, ids: new Uint32Array(capacity), count: 0,
  }));
  return {
    side,
    get(x: number, z: number) {
      const cell = cache[wrap(z, cacheSide) * cacheSide + wrap(x, cacheSide)];
      if (cell.x === x && cell.z === z) return cell;
      cell.x = x;
      cell.z = z;
      cell.count = 0;
      const originX = Math.floor(x / divisions) * period;
      const originZ = Math.floor(z / divisions) * period;
      for (const id of buckets[wrap(z, divisions) * divisions + wrap(x, divisions)]) {
        if (eligible(originX + seeds[id * 4], originZ + seeds[id * 4 + 1])) {
          cell.ids[cell.count++] = id;
        }
      }
      return cell;
    },
    tileOrigin(cell: number) { return Math.floor(cell / divisions) * period; },
  };
}
