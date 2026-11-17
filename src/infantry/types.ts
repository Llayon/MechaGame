export const ANIMATIONS = ['idle', 'walk', 'run', 'fire', 'crouch', 'hit', 'death'] as const;
export type InfantryAnimation = typeof ANIMATIONS[number];
export interface InfantryInstanceState {
  id: number;
  faction: 'friendly' | 'enemy';
  squadId: number;
  position: [number, number, number];
  heading: number;
  animation: InfantryAnimation;
  animationPhase: number;
  /** Game world units / second (one unit = 3.75 m). */
  movementSpeed: number;
  alive: boolean;
}
export interface AnimationClip {
  name: InfantryAnimation; duration: number; frames: number; offset: number;
  loop: boolean; movementSpeed: number;
  bounds: { min: number[]; max: number[] };
}
export interface AnimationAtlas {
  schemaVersion: number; method: string; fps: number; height: number;
  metersPerUnit: number; forward: string; bones: string[]; width: number;
  heightTexels: number; format: string; clips: AnimationClip[]; byteLength: number;
  sourceSha256: string;
}
export interface LabSettings {
  count: 1 | 20 | 100 | 200;
  animation: InfantryAnimation | 'mixed';
  individualPhases: boolean;
  batches: 1 | 10;
  shadows: boolean;
  travel: boolean;
  matricesEveryFrame: boolean;
  preset: 'low' | 'balanced' | 'high' | 'ultra';
  camera: 'close' | 'medium' | 'gameplay';
}
export const DEFAULT_LAB: LabSettings = {
  count: 20, animation: 'mixed', individualPhases: true, batches: 1,
  shadows: false, travel: false, matricesEveryFrame: false, preset: 'high', camera: 'medium',
};
export function makeInstances(settings: LabSettings): InfantryInstanceState[] {
  if (![1, 20, 100, 200].includes(settings.count)) throw Error('Unsupported infantry count');
  const columns = settings.count === 1 ? 1 : settings.count <= 20 ? 5 : 20;
  return Array.from({ length: settings.count }, (_, id) => {
    const animation = settings.animation === 'mixed' ? ANIMATIONS[id % 5] : settings.animation;
    const rate = settings.individualPhases ? .9 + ((id * .371) % .2) : 1;
    const speed = animation === 'run' ? .4 * .48 / (.43 * (25 / 30))
      : animation === 'walk' ? .22 * .48 / (.62 * (38 / 30)) : 0;
    return ({
    id, faction: id < Math.ceil(settings.count / 4) ? 'friendly' : 'enemy',
    squadId: Math.floor(id / 20),
    position: [(id % columns - (columns - 1) / 2) * 0.55, 0,
      (Math.floor(id / columns) - (Math.ceil(settings.count / columns) - 1) / 2) * .7],
    heading: 0,
    animation,
    animationPhase: settings.individualPhases ? ((id * 0.61803398875) % 1) : 0,
    movementSpeed: speed * rate,
    alive: true,
  }); });
}
export function sampleClip(clip: AnimationClip, seconds: number, phase: number) {
  const time = Math.max(0, seconds + phase * clip.duration);
  const progress = clip.loop ? (time / clip.duration) % 1 : Math.min(1, time / clip.duration);
  const frame = progress * (clip.frames - 1);
  return { a: clip.offset + Math.floor(frame), b: clip.offset + Math.min(clip.frames - 1, Math.floor(frame) + 1), mix: frame % 1 };
}
