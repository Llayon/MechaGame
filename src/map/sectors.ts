import {
  AIRFIELD_CENTER_X,
  AIRFIELD_CENTER_Z,
  CITADEL_CENTER_X,
  CITADEL_CENTER_Z,
  ISLAND_CENTER_X,
  ISLAND_CENTER_Z,
  METERS_PER_UNIT,
  QUARRY_CENTER_X,
  QUARRY_CENTER_Z,
  SCALE_X,
  SCALE_Y,
  SCALE_Z,
  getTerrainHeight,
} from './terrainMath';

export type SectorId =
  | 'overview'
  | 'airfield'
  | 'refinery'
  | 'crossing'
  | 'citadel'
  | 'quarry';

export type LightingPreset = 'day' | 'dusk' | 'night';

export interface SectorInfo {
  id: SectorId;
  code: string;
  name: string;
  role: string;
  elevationM: number;
  coordinates: string;
  description: string;
  assets: string[];
  // 3D anchor in world space (x, z)
  anchorXZ: readonly [number, number];
  // Camera position & lookAt target when focusing this sector
  cameraPos: readonly [number, number, number];
  cameraTarget: readonly [number, number, number];
  // Normalized 0..1 coordinates on 2D minimap
  minimapPos: readonly [number, number];
}

const CITADEL_ELEV_M = Math.round(
  getTerrainHeight(CITADEL_CENTER_X, CITADEL_CENTER_Z) * METERS_PER_UNIT,
);
const ISLAND_ELEV_M = Math.round(
  getTerrainHeight(ISLAND_CENTER_X, ISLAND_CENTER_Z) * METERS_PER_UNIT,
);
const AIRFIELD_ELEV_M = Math.round(
  getTerrainHeight(AIRFIELD_CENTER_X, AIRFIELD_CENTER_Z) * METERS_PER_UNIT,
);
const QUARRY_ELEV_M = Math.round(
  getTerrainHeight(QUARRY_CENTER_X, QUARRY_CENTER_Z) * METERS_PER_UNIT,
);

export const SECTORS: Record<SectorId, SectorInfo> = {
  overview: {
    id: 'overview',
    code: 'ALL',
    name: 'Сектор 7: Железное Ущелье',
    role: 'Боевая арена · 1500×1245 м',
    elevationM: CITADEL_ELEV_M,
    coordinates: '47°14\'N · 39°42\'E',
    description:
      'Тактическая арена 1500×1245 м для мехов (8–14 м): секционные мосты с укрытиями каждые 45 м, мелководье с 4 скальными съездами и 3 уступа штурма у Цитадели.',
    assets: ['Мосты 45 м секции', '4 съезда из воды', '3 уступа 15–20 м', 'Цитадель 3×'],
    anchorXZ: [0, 0],
    cameraPos: [-168, 178, 360],
    cameraTarget: [2, 6, 4],
    minimapPos: [0.5, 0.5],
  },
  airfield: {
    id: 'airfield',
    code: 'HQ',
    name: 'Плацдарм «Юг» и вертодром',
    role: 'Старт · 225 м от берега',
    elevationM: AIRFIELD_ELEV_M,
    coordinates: '47°13\'N · 39°38\'E',
    description:
      'Отодвинутый на 225 м от русла плацдарм 225×165 м с шестью периметровыми ангарами высотой 13–14,5 м для укрытия от огня с центрального острова.',
    assets: ['Отступ 225 м от воды', '6 ангаров (13–14,5 м)', '2 вертолётные зоны', 'Выезд 32 м'],
    anchorXZ: [AIRFIELD_CENTER_X, AIRFIELD_CENTER_Z],
    cameraPos: [AIRFIELD_CENTER_X - 58, 58, AIRFIELD_CENTER_Z + 104],
    cameraTarget: [AIRFIELD_CENTER_X + 6, 6, AIRFIELD_CENTER_Z - 4],
    minimapPos: [0.15, 0.8],
  },
  refinery: {
    id: 'refinery',
    code: 'IND',
    name: 'Центральный промышленный остров',
    role: 'Узел перестрелок · Ø 230 м',
    elevationM: ISLAND_ELEV_M,
    coordinates: '47°14\'N · 39°41\'E',
    description:
      'Островная арена диаметром ~230 м вокруг вышки-крана: 5 крупных цехов и резервуаров (10–14 м), бронеэкраны и широкие улицы для ближнего боя и засад.',
    assets: ['Диаметр 230 м', '5 цехов (12–14 м)', 'Резервуары и экраны', 'Рампа 32 м'],
    anchorXZ: [ISLAND_CENTER_X, ISLAND_CENTER_Z],
    cameraPos: [ISLAND_CENTER_X - 68, 66, ISLAND_CENTER_Z + 118],
    cameraTarget: [ISLAND_CENTER_X + 4, 10, ISLAND_CENTER_Z],
    minimapPos: [0.49, 0.5],
  },
  crossing: {
    id: 'crossing',
    code: 'A-B',
    name: 'Северный перевал (Точки A и B)',
    role: 'Транзитный рубеж и мост',
    elevationM: Math.round(2.6 * SCALE_Y * METERS_PER_UNIT),
    coordinates: '47°15\'N · 39°40\'E',
    description:
      'Северная магистраль шириной 32 м: ферменный мост A с арками, контейнерами и остовами каждые 45 м, плюс скальный выход из реки на северный фланг.',
    assets: ['Секции 45 м (арки)', 'Контейнеры и остовы', 'Скальный выход', 'Серпантин'],
    anchorXZ: [-3.5 * SCALE_X, -10.5 * SCALE_Z],
    cameraPos: [-15.5 * SCALE_X, 62, 4.0 * SCALE_Z],
    cameraTarget: [-4.5 * SCALE_X, 11, -9.8 * SCALE_Z],
    minimapPos: [0.43, 0.21],
  },
  citadel: {
    id: 'citadel',
    code: 'CIT',
    name: 'Высокогорная Цитадель',
    role: 'Укрепрайон 3× · 3 уступа',
    elevationM: CITADEL_ELEV_M,
    coordinates: '47°16\'N · 39°46\'E',
    description:
      'Укрепрайон 3× на отметке +69 м со стенами 11–12 м и тремя промежуточными скальными уступами (по 16–18 м) для флангового штурма на джетпаках.',
    assets: ['3 уступа 16–18 м', 'Стены 11–12 м', '8 ангаров мехов', 'Ворота тоннеля'],
    anchorXZ: [CITADEL_CENTER_X, CITADEL_CENTER_Z],
    cameraPos: [CITADEL_CENTER_X - 96, 86, CITADEL_CENTER_Z + 138],
    cameraTarget: [CITADEL_CENTER_X, 20, CITADEL_CENTER_Z],
    minimapPos: [0.81, 0.26],
  },
  quarry: {
    id: 'quarry',
    code: 'QRY',
    name: 'Восточный карьер и руины',
    role: 'Юго-восточный фланг',
    elevationM: QUARRY_ELEV_M,
    coordinates: '47°13\'N · 39°45\'E',
    description:
      'Террасированный карьерный склон у разрушенной восточной переправы, затопленных индустриальных руин в русле (ускоренное охлаждение в воде 2×) и 60-метрового скального съезда.',
    assets: ['Затопленные руины', 'Охлаждение 2× в воде', 'Выход из воды 60 м', 'Карьер'],
    anchorXZ: [QUARRY_CENTER_X, QUARRY_CENTER_Z],
    cameraPos: [10.0 * SCALE_X, 54, 19.0 * SCALE_Z],
    cameraTarget: [16.5 * SCALE_X, 9, 5.0 * SCALE_Z],
    minimapPos: [0.81, 0.63],
  },
};

export const SECTOR_ORDER: SectorId[] = [
  'overview',
  'airfield',
  'crossing',
  'refinery',
  'citadel',
  'quarry',
];

export interface TacticalPinSpec {
  id: string;
  sectorId: SectorId;
  badge: string;
  label: string;
  x: number;
  z: number;
  yOffset: number;
  tone: 'amber' | 'crimson' | 'steel';
}

const BASE_TACTICAL_PINS: TacticalPinSpec[] = [
  {
    id: 'pin-a',
    sectorId: 'crossing',
    badge: 'A',
    label: 'Мост A',
    x: -59.0,
    z: -56.5,
    yOffset: 15,
    tone: 'crimson',
  },
  {
    id: 'pin-b',
    sectorId: 'crossing',
    badge: 'B',
    label: 'Рубеж B',
    x: -1.8 * SCALE_X,
    z: -11.4 * SCALE_Z,
    yOffset: 13,
    tone: 'crimson',
  },
  {
    id: 'pin-hq',
    sectorId: 'airfield',
    badge: 'HQ',
    label: 'Вертодром',
    x: AIRFIELD_CENTER_X + 8,
    z: AIRFIELD_CENTER_Z - 4,
    yOffset: 13,
    tone: 'amber',
  },
  {
    id: 'pin-ref',
    sectorId: 'refinery',
    badge: 'R',
    label: 'Нефтезавод',
    x: ISLAND_CENTER_X,
    z: ISLAND_CENTER_Z,
    yOffset: 25,
    tone: 'steel',
  },
  {
    id: 'pin-cit',
    sectorId: 'citadel',
    badge: 'C',
    label: 'Цитадель',
    x: CITADEL_CENTER_X,
    z: CITADEL_CENTER_Z,
    yOffset: 20,
    tone: 'amber',
  },
  {
    id: 'pin-qry',
    sectorId: 'quarry',
    badge: 'E',
    label: 'Карьер',
    x: 17.8 * SCALE_X,
    z: 4.8 * SCALE_Z,
    yOffset: 13,
    tone: 'steel',
  },
];

export const TACTICAL_PINS: TacticalPinSpec[] = BASE_TACTICAL_PINS.map((pin) => ({
  ...pin,
  yOffset: getTerrainHeight(pin.x, pin.z) + pin.yOffset,
}));
