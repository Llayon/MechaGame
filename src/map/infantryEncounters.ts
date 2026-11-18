import type { SectorId } from './sectors';

export const INFANTRY_PER_SITE = { friendly: 10, enemy: 30 } as const;

interface Point {
  x: number;
  z: number;
}

/** A squad's cover anchor and the direction out from the obstacle, in degrees from +Z. */
type CoverAnchor = readonly [x: number, z: number, facing: number];

export interface InfantrySite extends Point {
  id: string;
  sectorId: Exclude<SectorId, 'overview'>;
  label: string;
  yaw: number;
  posts: readonly CoverAnchor[];
}

export const INFANTRY_SITES: readonly InfantrySite[] = [
  { id: 'airfield-perimeter', sectorId: 'airfield', label: 'Периметр вертодрома',
    x: -111, z: 66, yaw: Math.PI / 2,
    // North hangar and the rock screen overlooking the road out of the airfield.
    posts: [[-121.3, 69.8, 245], [-108.9, 57.1, 330], [-117.1, 83.2, 65],
      [-103.1, 57.1, 30], [-121.5, 82.4, 335], [-111.8, 52, 270], [-100.2, 52, 90]] },
  { id: 'bridge-a', sectorId: 'crossing', label: 'Мост А',
    x: -59, z: -56.5, yaw: Math.atan2(59.9, -43),
    // The parapets carry the patrols. Guards hold the cargo and wrecks on the deck.
    posts: [[-42.9, -64.2, 216], [-75.2, -48.8, 36], [-45.9, -69.8, 36],
      [-57.5, -56.7, 210], [-49.8, -62.1, 208], [-68.7, -50.5, 30], [-72.2, -43.2, 216]] },
  { id: 'refinery-yard', sectorId: 'refinery', label: 'Цеха нефтезавода',
    x: 5, z: 0, yaw: 0,
    // Derrick, workshops and tank farm on the raised island slab.
    posts: [[-0.1, 1.7, 60], [8.4, 5.2, 208], [9.8, -8.3, 66], [13.9, 4.7, 240],
      [-3, -3.3, 180], [0.2, -9.1, 336], [1.1, 10.4, 298]] },
  { id: 'east-quarry', sectorId: 'quarry', label: 'Восточный карьер',
    x: 125, z: 51, yaw: Math.PI / 2,
    // Route from the quarry shed to the eastern pillbox.
    posts: [[118.4, 43.3, 90], [123.7, 57.1, 180], [131.4, 47.3, 300],
      [135.9, 58.7, 150], [115.2, 44.5, 0], [130.7, 63.9, 300], [120.8, 58, 270]] },
  { id: 'citadel-bunkers', sectorId: 'citadel', label: 'ДОТы Цитадели',
    x: 106, z: -65, yaw: 0,
    // Southern hangars, bunker, blast screens and parked armor.
    posts: [[105.7, -58.8, 186], [98.3, -63.1, 167], [111.7, -65.4, 300],
      [98.8, -69.5, 49], [103.2, -74.2, 270], [115.4, -60.7, 270], [114.4, -74.6, 300]] },
];

function offset(origin: Point, yaw: number, across: number, forward: number): Point {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return { x: origin.x + across * cos + forward * sin, z: origin.z - across * sin + forward * cos };
}

// The first five squads have four members each. The final two have five.
export function getInfantrySquad(index: number) {
  if (index < 20) return { squadIndex: Math.floor(index / 4), memberIndex: index % 4 };
  return { squadIndex: 5 + Math.floor((index - 20) / 5), memberIndex: (index - 20) % 5 };
}

export function getInfantrySlot(site: InfantrySite, team: keyof typeof INFANTRY_PER_SITE, index: number): Point {
  if (team === 'enemy') {
    const { squadIndex, memberIndex } = getInfantrySquad(index);
    return getInfantryPost(site, squadIndex, memberIndex).patrol[0];
  }
  const rank = Math.floor(index / 5);
  return offset(site, site.yaw, (index % 5 - 2) * 0.55 + rank * 0.16, -4 - rank * 0.8);
}

export function getInfantryPost(site: InfantrySite, squadIndex: number, memberIndex = 0) {
  const [x, z, facing] = site.posts[squadIndex];
  const yaw = facing * Math.PI / 180;
  const column = (memberIndex % 3 - 1) * 0.54;
  const rank = Math.floor(memberIndex / 3) * 0.53;
  const at = (across: number, forward: number) => offset({ x, z }, yaw, across + column, forward + rank);
  return {
    patrol: [at(-1.6, 1.4), at(1.6, 1.4)] as const,
    cover: at(0, 0),
  };
}
