"""Blender CLI: import the untouched Tripo GLB, measure, and render diagnostics."""
import bpy
import bmesh
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'tripo_convert_299d1949-842a-4082-b69e-3a43beb1f36e.glb'
OUT = ROOT / 'docs/infantry'
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'images').mkdir(exist_ok=True)
if not SOURCE.is_file():
    raise RuntimeError('BLOCKED: original Tripo GLB is missing')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
all_components = []
metrics = {'source': SOURCE.name, 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
           'meshes': len(meshes), 'armatures': 0, 'animations': 0, 'mesh_details': []}
for obj in meshes:
    mesh = obj.data
    mesh.calc_loop_triangles()
    bm = bmesh.new(); bm.from_mesh(mesh)
    adjacency = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        adjacency[a].append(b); adjacency[b].append(a)
    seen = set(); components = []
    for v in mesh.vertices:
        if v.index in seen: continue
        stack = [v.index]; seen.add(v.index); ids = []
        while stack:
            i = stack.pop(); ids.append(i)
            for j in adjacency[i]:
                if j not in seen: seen.add(j); stack.append(j)
        points = [obj.matrix_world @ mesh.vertices[i].co for i in ids]
        lo = [min(p[k] for p in points) for k in range(3)]
        hi = [max(p[k] for p in points) for k in range(3)]
        components.append({'id': len(components), 'vertices': ids, 'count': len(ids),
                           'min': lo, 'max': hi, 'center': [(a+b)/2 for a,b in zip(lo,hi)]})
    textures = []
    for mat in mesh.materials:
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                textures.append({'name': node.image.name, 'size': list(node.image.size),
                                 'colorspace': node.image.colorspace_settings.name})
    world = [obj.matrix_world @ Vector(p) for p in obj.bound_box]
    metrics['mesh_details'].append({
        'name': obj.name, 'vertices': len(mesh.vertices), 'triangles': len(mesh.loop_triangles),
        'uv_layers': len(mesh.uv_layers), 'materials': len(mesh.materials), 'textures': textures,
        'dimensions_blender_xyz': list(obj.dimensions),
        'bounds_min': [min(p[k] for p in world) for k in range(3)],
        'bounds_max': [max(p[k] for p in world) for k in range(3)],
        'components': len(components), 'boundary_edges': sum(e.is_boundary for e in bm.edges),
        'nonmanifold_edges': sum(not e.is_manifold for e in bm.edges),
        'loose_vertices': sum(not v.link_faces for v in bm.verts),
        'smooth_faces': sum(p.use_smooth for p in mesh.polygons),
    })
    all_components.extend(components)
    bm.free()
metrics['normalization'] = {'source_forward': '+X', 'target_gltf_forward': '+Z',
    'target_blender_forward': '-Y', 'target_game_height': 0.48, 'meters_per_unit': 3.75,
    'physical_height_m': 1.8}
(OUT / 'model-metrics.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')
(OUT / 'component-map.json').write_text(json.dumps(all_components, indent=2), encoding='utf-8')

# Neutral PBR studio; geometry and material are left untouched.
scene = bpy.context.scene
scene.render.resolution_x = 768; scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.world.color = (0.18, 0.18, 0.18)
for pos, energy, size in [((3,-4,5), 450, 4), ((-3,-2,3), 300, 3), ((1,3,4), 400, 3)]:
    data = bpy.data.lights.new('Audit area', 'AREA'); data.energy = energy; data.shape = 'DISK'; data.size = size
    light = bpy.data.objects.new('Audit area', data); scene.collection.objects.link(light); light.location = pos
    light.rotation_euler = (Vector((0,0,0.5))-light.location).to_track_quat('-Z','Y').to_euler()
data = bpy.data.cameras.new('Audit camera'); camera = bpy.data.objects.new('Audit camera',data)
scene.collection.objects.link(camera); scene.camera = camera; data.type = 'ORTHO'; data.ortho_scale = 1.3
views = {'front': (3,0,0.6), 'back': (-3,0,0.6), 'side': (0,3,0.6), 'three-quarter': (3,-3,1.1),
         'hip-detail': (2,-2,0.55), 'shoulder-detail': (2,-2,0.85)}
for name, pos in views.items():
    target = Vector((0,0,0.5))
    data.ortho_scale = 1.3
    if name == 'hip-detail': target.z = 0.48; data.ortho_scale = 0.5
    if name == 'shoulder-detail': target.z = 0.76; data.ortho_scale = 0.5
    camera.location = pos; camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(OUT / 'images' / (name+'.png'))
    bpy.ops.render.render(write_still=True)
print('MODEL_AUDIT=' + json.dumps(metrics))
