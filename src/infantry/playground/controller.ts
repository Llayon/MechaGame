export interface Obstacle { x: number; z: number; width: number; depth: number; height: number }
export const YARD_LIMIT = 8.7;
export const HERO_RADIUS = .075;
export const YARD_OBSTACLES: Obstacle[] = [
  { x: -1.4, z: 1.6, width: .6, depth: .6, height: .24 },
  { x: -1.85, z: 1.6, width: .3, depth: .42, height: .36 },
  { x: 1.2, z: 2.1, width: .75, depth: .36, height: .10 },
  { x: 2.7, z: -.8, width: .55, depth: .55, height: .28 },
  { x: -2.6, z: -2, width: .9, depth: .4, height: .32 },
  { x: 3.7, z: 3.4, width: 1.1, depth: .55, height: .44 },
  { x: -3.4, z: 3.6, width: .4, depth: .9, height: .28 },
];
export interface HeroState {
  x: number; y: number; z: number; vx: number; vz: number; vy: number;
  heading: number; speed: number; grounded: boolean;
}
export interface HeroInput { x: number; z: number; sprint: boolean; walk: boolean; crouch: boolean; jump: boolean }
export type HeroAnimation = 'idle' | 'walk' | 'run' | 'crouch' | 'crouchWalk' | 'jump';
export const createHeroState = (): HeroState => ({ x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, heading: 0, speed: 0, grounded: true });
export function groundHeight(x: number, z: number, obstacles: readonly Obstacle[] = YARD_OBSTACLES) {
  return obstacles.reduce((height, o) => Math.abs(x - o.x) < o.width / 2 && Math.abs(z - o.z) < o.depth / 2 ? Math.max(height, o.height) : height, 0);
}
function blocked(x: number, z: number, y: number, obstacles: readonly Obstacle[]) {
  return obstacles.some(o => y < o.height - .008 && Math.abs(x - o.x) < o.width / 2 + HERO_RADIUS && Math.abs(z - o.z) < o.depth / 2 + HERO_RADIUS);
}
/** One controlled character, velocities in game units/second. Pure and deterministic. */
export function stepHero(state: HeroState, input: HeroInput, dt: number, obstacles: readonly Obstacle[] = YARD_OBSTACLES) {
  dt = Math.max(0, Math.min(.05, Number.isFinite(dt) ? dt : 0));
  if (!dt) return;
  const length = Math.hypot(input.x, input.z), magnitude = Math.min(1, length);
  const maxSpeed = input.crouch ? .8 / 3.75 : input.walk ? .36 : input.sprint ? 4.5 / 3.75 : 3.2 / 3.75;
  const targetX = length ? input.x / length * magnitude * maxSpeed : 0;
  const targetZ = length ? input.z / length * magnitude * maxSpeed : 0;
  const blend = 1 - Math.exp(-dt * (magnitude ? 13 : 20));
  state.vx += (targetX - state.vx) * blend; state.vz += (targetZ - state.vz) * blend;
  if (Math.hypot(state.vx, state.vz) < .002 && !magnitude) state.vx = state.vz = 0;
  const oldX = state.x, oldZ = state.z;
  const x = Math.max(-YARD_LIMIT, Math.min(YARD_LIMIT, state.x + state.vx * dt));
  if (!blocked(x, state.z, state.y, obstacles)) state.x = x; else state.vx = 0;
  const z = Math.max(-YARD_LIMIT, Math.min(YARD_LIMIT, state.z + state.vz * dt));
  if (!blocked(state.x, z, state.y, obstacles)) state.z = z; else state.vz = 0;
  state.speed = Math.hypot(state.x - oldX, state.z - oldZ) / dt;
  if (state.speed > .015) {
    const target = Math.atan2(state.x - oldX, state.z - oldZ);
    const delta = Math.atan2(Math.sin(target - state.heading), Math.cos(target - state.heading));
    state.heading += delta * (1 - Math.exp(-dt * 18));
  }
  const ground = groundHeight(state.x, state.z, obstacles);
  if (input.jump && state.grounded) { state.vy = .88; state.grounded = false; }
  if (state.y > ground + .001) state.grounded = false;
  if (!state.grounded) {
    state.vy -= (9.81 / 3.75) * dt; state.y += state.vy * dt;
    if (state.y <= ground) { state.y = ground; state.vy = 0; state.grounded = true; }
  } else state.y = ground;
}
export function heroAnimation(state: HeroState, input: Pick<HeroInput, 'crouch' | 'walk'>): HeroAnimation {
  if (!state.grounded) return 'jump';
  if (input.crouch) return state.speed > .015 ? 'crouchWalk' : 'crouch';
  if (state.speed < .015) return 'idle';
  return input.walk ? 'walk' : 'run';
}
