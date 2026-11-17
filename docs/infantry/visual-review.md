# Technical art review — qualified, not final art acceptance

Review order: BUILDER → TECHNICAL ART CRITIC → PERFORMANCE CRITIC → FIXER → VERIFIER.
The same agent performed these passes; no claim of independent human art approval.

## Evidence

Original: [front](images/front.png), [back](images/back.png), [side](images/side.png),
[45 degrees](images/three-quarter.png), [hips](images/hip-detail.png),
[shoulders](images/shoulder-detail.png).

Prepared model: [Run](animations/run-0.25.png), [Fire](animations/fire-0.25.png),
[Crouch](animations/crouch-1.00.png), [Death end](animations/death-1.00.png).
Blender loop videos: [Idle](animations/idle.mp4), [Run](animations/run.mp4),
[Fire](animations/fire.mp4).

GPU close-up: [Run with animated shadow](browser/close-run.png),
[Run without shadow](browser/close-run-no-shadow.png), [Idle](browser/close-idle.png),
[Fire](browser/close-fire.png), [Crouch](browser/close-crouch.png).
Formation: [20](browser/mixed-20.png), [100](browser/mixed-100.png),
[200](browser/mixed-200.png). [Behind Object 316](browser/gameplay-scale.png)
uses the actual existing mech on the isolated floor, not the main mission environment.

GPU videos: [20](browser/20-mixed.mp4), [100](browser/100-mixed.mp4),
[200](browser/200-mixed.mp4). These are deterministic rendered previews at 15 fps,
not recordings proving real-time frame rate; use the benchmark JSON for timing.

## Findings and fixes

* The original helmet, orange visor, rifle, backpack, armor silhouette and embedded
  texture bytes survive. Normal-seam splits add six exported vertices, no faces.
* Armor cores and the complete rifle use rigid transforms. Knee/hip seams have
  narrow blended weights. Quantized coincident seam positions receive identical
  weights, avoiding independently weighted UV-seam cracks.
* Walk/run have alternating stance/swing, pelvis weight shift, knee IK, foot lift
  and matched translation speed. Loop endpoints and planted stance travel are
  tested against the actual half-float atlas. In-place mode intentionally moves
  feet backward during stance; enable root travel to evaluate world foot planting.
* Fire originally retained low-ready aim. The fix raises both arms and weapon
  together around the shoulder axis and adds restrained recoil, preserving grips.
* Death initially used the wrong knee bend direction after rotating the body.
  The fix rotates that direction into the falling frame and applies floor support
  correction. Terminal views were reframed to show the entire model.
* A population replacement once left invisible PBR characters while shadows still
  drew. Fixed buffer ownership; browser pixel assertions now catch that failure.
* Different phases/rates and five distinct states remove synchronous clone motion.
  One batch/ten-batch changes and all presets are browser-tested.

## Remaining art issues — battle integration HOLD

1. **Death is a simple controlled backward fall.** It lacks convincing impact,
   secondary arm collapse and settling. It is not approved as final heavy-infantry
   death motion. A more natural hand-authored fall is needed before battle use.
2. **Arms preserve the original carry assembly.** No independent elbow articulation
   or sight-aligned aiming IK exists. Fire is a raised held-weapon recoil study;
   retargeting a fully shouldered firing stance needs tighter anatomical segmentation.
3. **State changes hard-cut.** No crossfade, locomotion/upper-body additive fire,
   crouch exit or death transition selection. Popping can be visible despite good FPS.
4. Source topology has few joint loops and many seams/islands. Some small detached
   equipment details (including the sight-like blue detail in the source side view)
   already existed; no invented connector geometry was added. Close shoulder/groin
   views still need artist approval under larger limb ranges.
5. Crouch is a moderate lowered ready stance, not a deep squat. Run is a restrained
   armored jog (~2.0 m/s), not a sprint. No mocap or claim of production-final motion.
6. The gameplay distance establishes mech/infantry scale and silhouette only.
   Occlusion, camouflage and visor readability in the real forest/industrial map
   remain unverified. The mission was intentionally not modified for this lab.

The prototype provides genuine moving GPU characters and measurable scaling.
It does not yet meet the requested final art gate. Do not approve the future
50-vs-150 battle merely because the isolated 200-instance desktop benchmark is fast.
