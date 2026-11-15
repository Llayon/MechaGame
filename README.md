# MechaGame — Sector 7

Browser-based 3D mech combat arena, using React 19, React Three Fiber, Three.js and Vite.

Current features include the procedural 3D terrain and structures, the walking Object 316
mech with IK and environmental effects, aim assist, three enemy archetypes, player/enemy
combat, heavy cannon, overheating, dash, repair, mission victory/defeat, and touch controls.

## Development

Requires [Bun](https://bun.sh/).

```bash
bun install --frozen-lockfile
bun run dev
bun run lint
bun run test
bun run build
```

## GitHub Pages deployment

Target URL: https://llayon.github.io/MechaGame/

The workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) builds, tests
and deploys the Vite bundle whenever a commit is pushed to `main`.
It sets `GITHUB_PAGES=true` while building so Vite emits
`/MechaGame/` asset paths. Ordinary builds use `/` and remain compatible
with local development / other hosting environments.

**One-time GitHub setting required:** open
[Settings → Pages](https://github.com/Llayon/MechaGame/settings/pages),
select **Source: GitHub Actions** under Build and deployment. GitHub Pages
must be enabled for the deployment to succeed.

## Mech systems

- `MechModel`: builds and owns Three.js geometry/material resources.
- `MechState`: framework-independent mutable mech simulation state.
- `MechController`: keyboard commands and input normalization.
- `MechMovementSystem`: movement, gait and terrain/collision integration.
- `MechIKSystem`: leg contact and three-joint inverse kinematics.
- `WeaponSystem`: weapon rate/aim and shot events.
- `MechEffects`: muzzle flashes, tracers, dust, smoke, debris and recoil.
- `SovietMech.tsx`: React Three Fiber lifecycle and combat integration.

Combat rules live in `src/game/combatSimulation.ts`. Spatial obstacle and shot
occlusion utilities are in `src/map/worldColliders.ts` and `worldRaycaster.ts`.
The original Project 1952 demonstrator is retained in `public/assets/aistudio/`.
