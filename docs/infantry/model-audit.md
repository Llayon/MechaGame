# Original Tripo infantry audit

Baseline: `919aa20` (remote main on 2026-11-17). Work is isolated on
`feat/infantry-gpu-animation-lab`; the previous ZIP working tree was verified
against its source archive before restoring the current tracked baseline.

Source SHA-256: `8fd7de705b2c34f888cf4c726b4cca4813c89ef7d23a471b3f47f8f5b4805667`.
The source is retained byte-for-byte. No substitute character or paid service.

## Measurements and orientation

Blender 5.2 import: one mesh, 1452 vertices, 1247 triangles, one UV layer, one
PBR material, three embedded 512×512 textures (base color, normal, metallic /
roughness). No armature or animations. 1244 of 1247 polygons are smooth shaded.
Blender XYZ dimensions: 0.589528 × 0.448043 × 0.997598. Blender Z is up;
the visor and muzzle establish +X as forward. Normalize to Blender -Y, which
exports to glTF +Z. Target height: 0.48 game units = 1.8 m at 3.75 m/unit.

## Topology and risks

157 index-connected components, no loose vertices, 1343 boundary/non-manifold
edges. These counts include split UV/normal seams: they are not 1343 distinct
visible holes. Some very small islands occupy effectively coincident positions.
Some large components span anatomical regions, so component ID alone is NOT a
valid bone assignment. Preserve UV seams, source normals, visor and baked PBR.
The low-resolution textured sculpt has no dedicated clean deformation loops.
Shoulders, groin and knees require restricted deformation and visual inspection;
automatic heat weights alone are unsuitable. There are no authored open-mouth
or finger articulations. The rifle is already held with both hands.

## Anatomical segmentation plan

Coordinates below use normalized height H, forward -Y, lateral X.
The exhaustive original connected-component map is `component-map.json`.

| Region | Approximate region / landmark | Weight policy |
|---|---|---|
| Helmet and visor | upper 0.84–1.00 H | rigid head |
| Backpack | behind torso, upper 0.60–0.88 H | rigid spine |
| Chest | central upper 0.57–0.84 H | rigid spine |
| Pelvis | central 0.45–0.57 H | rigid pelvis, narrow waist transition |
| Upper arms | shoulder to elbow, lateral torso | rigid plate cores, narrow shoulder transition |
| Forearms/hands | elbows to existing rifle grips | preserve grips; rigid forearm cores |
| Rifle/sight | forward chest, diagonal across hands | one rigid weapon transform |
| Thighs | hips ~0.53 H to knees ~0.33 H | rigid plate cores |
| Shins | knees ~0.33 H to ankles ~0.06 H | rigid plate cores |
| Boots | bottom ~0.07 H | rigid foot, planted ground support |

Weights and the precise segmentation will be exported separately so they can
be revised without changing the original mesh. Seam-coincident vertices must
receive consistent weights. Small details should inherit their containing region.

## Evidence and gate

`images/front.png`, `back.png`, `side.png`, `three-quarter.png`,
`hip-detail.png`, `shoulder-detail.png`: real Blender PBR renders, inspected.
Source appearance and equipment are intact. **Gate 1 PASS (audit only)**;
joint deformation quality remains a separate gate and cannot be inferred from
the static mesh or performance.
