"""Reimport the final asset in Blender and verify the actual exported rig."""
import bpy
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/infantry/infantry-rigged.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
assert len(meshes)==1 and len(rigs)==1,[(o.name,o.type) for o in bpy.context.scene.objects]
mesh=meshes[0];mesh.data.calc_loop_triangles()
assert len(mesh.data.loop_triangles)==1247
assert len(rigs[0].data.bones)==14
clips=[a.name for a in bpy.data.actions]
assert len(clips)==7,clips
maps=[n.image for n in mesh.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE']
assert len(maps)==3 and all(tuple(im.size)==(512,512) for im in maps)
helpers=[o.name for o in bpy.context.scene.objects if o.type=='MESH' and o not in meshes]
report={'blender':bpy.app.version_string,'meshes':1,'bones':14,'triangles':1247,'importer_bone_display_helpers':helpers,
        'render_vertices':len(mesh.data.vertices),'clips':clips,'maps':[list(im.size) for im in maps],
        'source_sha256':hashlib.sha256((ROOT/'public/assets/infantry/source.glb').read_bytes()).hexdigest()}
(ROOT/'docs/infantry/roundtrip-metrics.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('ROUNDTRIP_PASS='+json.dumps(report))
