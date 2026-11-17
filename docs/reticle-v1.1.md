# Object 316 — dual-layer combat reticle (V1.1)

## What the player sees

- **Main reticle (amber)**: fixed at screen center, driven by the player's
  intended camera aim. It does **not** bounce with walking, chassis sway,
  spring-damped gun motion or near-cover contact.
- **Muzzle indicator (small cyan dashed ring)**: displays the physical barrel's
  **angular direction**, including the real turret's traverse lag. It is
  smoothed only for display (140 ms nominal, faster for larger turns) and has a
  tiny dead zone to absorb walking vibrations. Changes to bullet collision
  distance never reposition this indicator.
- When the muzzle's real shot ray hits an enemy, the ring turns amber and the
  label reads **СТВОЛ · ЦЕЛЬ**. Hits on cover show **СТВОЛ · УКРЫТИЕ**.
  These contact labels are attached to the *gun ray*, not to the center dot.

## Important accuracy contract

Main reticle = **where the player wants to look/aim**.
Secondary cue = **where the weapon is actually facing**.

The ring represents the gun's direction at the camera, so it does not account
for short-range barrel-to-camera parallax. It must never be described as an
exact pixel-perfect impact marker at all distances. The weapon simulations
still use actual muzzle origins, gun quaternions, enemy/barrel collision spheres,
world cover and distance checks. There is **no hidden aim-assist magnetism**.

## Lifecycle and regressions

- Physics and bullet vectors are not smoothed.
- Main reticle remains centered during movement, firing, yaw tracking, precision
  zoom and camera/terrain collision.
- All secondary HUD animation stops during pause and resets on mode change.
- Pointer lock, mobile swipes, muzzle firing and pausing remain unchanged.
- Unit tests cover camera-relative projection, behind-camera hiding, no
  parallax jumps and frame-independent smoothing.
- Chrome CDP smoke verifies that main center remains fixed while mouse aiming,
  and that the separate muzzle indicator exists.

Visual tuning on real hardware is still useful (aim sensitivity, ring size).
