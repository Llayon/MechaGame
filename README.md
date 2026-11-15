# MechaGame

Interactive 3D mech demonstrator: procedural terrain, an Object 316 inverse-kinematic
walk cycle, effects, a tactical HUD and Sector 7 exploration.

## Development

Install Bun, run `bun install`, then `bun run dev`.
Quality gates: `bun run lint`, `bun run test`, `bun run build`.

## Architecture

`src/scene/objects/SovietMech.tsx` is the React Three Fiber adapter.
Simulation order: MechController → MechMovementSystem → MechIKSystem →
WeaponSystem → MechEffects. MechState has no React dependency;
MechModel constructs the Three.js rig and owns its disposables.

**Currently:** weapons spawn visual tracers only, with no damage system;
movement enforces terrain/slope limits but no building obstacle collision.
The standalone Project 1952 HTML showcase remains in
`public/assets/aistudio/1952_three_js_ik_c76835dd.html`.
