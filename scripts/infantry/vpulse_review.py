"""Verify the two V-Pulse game GLBs in Blender and render matched views.

Run with Blender --background --factory-startup --python-exit-code 1
  --python scripts/infantry/vpulse_review.py
"""
import json
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'public/assets/infantry-vpulse'
OUT = ROOT / '.tools/vpulse'
OUT.mkdir(parents=True, exist_ok=True)
manifest = json.loads((ASSETS / 'manifest.json').read_text(encoding='utf-8'))


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def area_light(name, position, energy, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    point_at(obj, (0, 0, .025))


for name, expected in manifest['variants'].items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ASSETS / expected['file']))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    assert len(meshes) == 1
    mesh = meshes[0]
    mesh.data.calc_loop_triangles()
    assert len(mesh.data.loop_triangles) == expected['triangles']
    assert len(mesh.data.materials) == 1
    materials = mesh.data.materials[0].node_tree.nodes
    images = {node.image.name for node in materials if node.type == 'TEX_IMAGE' and node.image}
    assert len(images) == expected['textures'], images
    for marker, position in manifest['markers'].items():
        x, y, z = position
        obj = bpy.context.scene.objects.get(marker)
        assert obj and (obj.matrix_world.translation - Vector((x, -z, y))).length < .000001, marker
    data = bpy.data.cameras.new('Review camera')
    data.type = 'ORTHO'
    data.ortho_scale = .273
    data.clip_start = .001
    camera = bpy.data.objects.new('Review camera', data)
    bpy.context.collection.objects.link(camera)
    camera.location = (.25, -.068, .122)
    point_at(camera, (.003, -.012, .026))
    area_light('Key', (.26, .075, .24), 8, .19)
    area_light('Fill', (.12, -.26, .10), 5, .2)
    area_light('Edge', (-.18, .04, .15), 10, .16)
    scene = bpy.context.scene
    scene.camera = camera
    scene.world = bpy.data.worlds.new('Review world')
    scene.world.color = (.1, .1, .1)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 520
    scene.render.resolution_percentage = 100
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    scene.render.filepath = str(OUT / f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print(f'{name}: PASS ({expected["triangles"]} triangles, one material, {len(images)} maps)')
