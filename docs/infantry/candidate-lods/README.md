# Alternative A-pose soldier — baked normals and static LODs

Source: `D:\Programms\Max\Assets\textured_mesh 1.glb`, SHA-256
`dd369a254695aa41508a48bfff1cecd3d713bb7c846085ad3a53c2dd31a15228`.
The original file is unchanged; an untouched copy is included as `source.glb`.
This is a separate candidate package. The original Tripo infantry lab and mission
have not been switched to this character.

## Files

| Asset | Triangles | Exported vertices | Maps | GLB bytes | Intended use |
|---|---:|---:|---|---:|---|
| [Source](../../../public/assets/infantry-candidate/source.glb) | 40000 | 25425 | Original 2048 base color + metallic/roughness | 3635684 | Untouched master |
| [LOD0](../../../public/assets/infantry-candidate/infantry-candidate-lod0.glb) | 3999 | 3857 | 1024 base color / metallic-roughness / normal | 2581792 | Close and medium inspection |
| [LOD1](../../../public/assets/infantry-candidate/infantry-candidate-lod1.glb) | 1999 | 2263 | 512 base color / metallic-roughness / normal | 853156 | Medium distance / crowd candidate |
| [LOD2](../../../public/assets/infantry-candidate/infantry-candidate-lod2.glb) | 999 | 1365 | 256 base color / metallic-roughness / normal | 297264 | Distant crowd only |

[Working Blender file](../../../public/assets/infantry-candidate/candidate-lods.blend)
contains the normalized high-resolution master and all three LODs, with packed
textures. LOD0 is visible when the file opens; the master and other LODs are hidden.
Every exported GLB is self-contained: one mesh, one PBR material, three embedded
images and an already connected normal map. UV seams increase render vertex
counts above the welded Blender vertex count; this is expected.

Separate normal maps:
[LOD0 1024](../../../public/assets/infantry-candidate/textures/normal-lod0-1024.png),
[LOD1 512](../../../public/assets/infantry-candidate/textures/normal-lod1-512.png),
[LOD2 256](../../../public/assets/infantry-candidate/textures/normal-lod2-256.png).
Base color is JPEG quality 95; data maps remain lossless PNG, Non-Color.
The source's full-resolution textures remain preserved in the untouched master.

## What was actually done

The source's 285 index-connected islands become two geometric components after
welding coincident seam vertices; UV coordinates remain on face corners. Quadric
collapse reduction produces the three meshes. Validation removes a degenerate
triangle after each requested 4000/2000/1000 target, giving 3999/1999/999.

Normals are genuinely baked from the original 40000-triangle surface onto each
specific LOD using local Blender Cycles selected-to-active baking. These are
OpenGL +Y tangent-space maps, not a grayscale conversion of the painted albedo.
They reproduce geometric shading; painted stripes and panel lines do not acquire
invented relief. The bake uses an inflated cage (.005 game units) and maximum ray
distance .02 game units. See [Blender's baking documentation](https://docs.blender.org/manual/en/latest/render/cycles/baking.html).

Each LOD needs its own normal map because topology and tangent frames differ.
Normal maps cannot restore a deleted silhouette. LOD2 visibly softens small
equipment, fingers and panel texture when enlarged: use it at a distance.

The export includes normals, UVs and Mikk tangents. One zero tangent in LOD1 was
detected by validation and repaired from that triangle's actual UV derivative,
orthogonalized against its normal; the builder repeats this correction. No
arbitrary tangent or NaN is accepted. Degenerate-UV repair is also available,
but this source required zero such UV edits.

Units are normalized to approximately .48 game units (1.8 m at 3.75 m/unit),
glTF +Y up and +Z forward, feet near zero. Collapse moves the top/bottom slightly:
actual exported height is .4790–.4797. No rig or animation has been added here.
Automated decimation does not establish good shoulder/knee deformation loops.
Rigging and animated deformation review remain the next task. A later GPU shader
must animate tangents as well as normals when using these explicit tangent attributes.

## Verification and evidence

[Side-by-side comparison](images/comparison.png): source, LOD0, LOD1, LOD2.
[Original close view](images/source-angle.png), [LOD0](images/lod0-angle.png),
[LOD1](images/lod1-angle.png), [LOD2](images/lod2-angle.png).
The distant LOD is deliberately shown enlarged here to expose its limitations.

Neutral gray shading exposes the normal map's effect:
[source](images/clay-source.png), [LOD0 with normals](images/clay-lod0-normal.png),
[LOD0 without normals](images/clay-lod0-flat.png).
[Actual Three.js render](images/browser-lod0.png).

[Metrics](metrics.json) record triangle counts, sampled surface distances and bake
settings. Source-to-low sampled p95 surface distances are about 2.38 / 4.81 / 9.35
mm at physical scale. These are sampled nearest-surface distances, not an exact
Hausdorff error bound.

[Visual metrics](visual-metrics.json) record reimported map resolutions, scale
and static silhouette IoU across front/side/angled views. Front silhouette IoU
is about 99.30% / 98.35% / 96.90%. This measures the outline, not total art quality.

[Browser/asset verification](verification.json) checks actual GLB structure,
finite unit normals/tangents, all three PBR maps, one character draw, correct
resolutions and visible lighting changes with normal maps toggled. It switches
LOD0→LOD1→LOD2→LOD0 and checks resource counters return. This is a static asset
smoke test, not a 200-character FPS or physical-phone benchmark.

## Reproduce

Run from the repository root. The builder uses the original external path when
available and otherwise the packaged source copy. Blender works in a separate
background process and does not alter the user's open scene.

```powershell
& 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/infantry/build_candidate_lods.py
& 'D:\Programms\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/infantry/review_candidate_lods.py
node scripts/infantry/verify_candidate_lods.mjs
```

No paid API, cloud baking or substitute geometry was used. All three exports
retain the candidate's original helmet, armor, gloves, boots, pouches and backpack.

The static files above remain unchanged. A later [playable wardrobe demo](../playground/README.md)
adds separate rigged exports under `demo/` and opens with `?demo=infantry`.
