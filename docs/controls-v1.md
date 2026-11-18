# Gameplay Camera & Aiming V1 — Object 316

The map has free OrbitControls only in overview. During combat, a dedicated
over-the-shoulder camera follows the intended world aiming direction, maintains
ground clearance and checks static cover between the chassis and camera.

The normal view sits 22 world units behind a point 6 units above the standing
mech's feet and 1.25 to its side. The 50° field of view keeps the legs and
ground ahead visible. Holding precision aim brings the camera to 7.8 units
behind the shoulder, 4.8 units high and 3.55 to the side, with a 29° field of view.
When switching views, the camera ranges the point under the crosshair and keeps
it centered through the move within the gun's aiming limits. Mouse look remains
active throughout. If cover forces the view through the mech, the camera hides
the player model until the sightline clears.

## Desktop
- WASD: forward/back and hull rotation.
- Mouse X/Y: screen-right movement turns the view right; screen-left turns left,
  mouse-up looks up. Because +Z is forward here, mouse-right maps to negative
  world yaw. Turret smoothly traverses toward the same new direction.
- First click on the *game canvas*: capture mouse Pointer Lock. (Required user gesture.)
- Left mouse button: fire 37-mm autocannons; right mouse button: hold precision aim / zoom.
- F: fire 105-mm heavy cannon. Space remains an alternate 37-mm trigger.
- Q/E: optional yaw/heading assist, T: recenter to hull, Shift: sprint.
- X dash, C crouch, V repair, P pause; Escape releases captured pointer first.
- Pausing, changing mode, blur and game over release the mouse and held triggers.

## Mobile
- Left joystick moves and turns chassis.
- Swipe on the right aim zone to control yaw **and elevation** with the
  same screen-relative directions as the desktop mouse.
- Fire / heavy / dash / repair controls remain on the right.
- Hold **ПРИЦЕЛ** for precision zoom.

## Physical aiming contract
The camera displays *desired* sight orientation; the turret has its own angular
rate and spring damping. The on-screen crosshair is projected from the **actual
muzzle shot ray** and the nearest enemy/barrel/cover intersection. A small offset
while traversing is intentional and communicates physical lag. Both 37-mm and
105-mm shots follow the same actual barrel orientation, with no auto-magnetism.
The legacy automatic targeting helper remains available to non-player callers.

## Verification
- Unit: signed mouse/touch axes, vertical limits, angle wrap, angular speed,
  projection mapping, muzzle intersection and pause/input clearing.
- CI: TypeScript, existing battle tests, production build, WebGL and audio decode.
- Manual device QA still needed for pointer lock behavior, landscape multitouch,
  collision clearance and desired sensitivity on actual phones.
