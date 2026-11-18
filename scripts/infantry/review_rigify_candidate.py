"""Render the actual Rigify files and their diagnostic deform skeletons."""
import bpy, sys, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
variant = 'preserved-twist' if '--restore-twist' in sys.argv else 'standard'
directory = 'rigify-twist-demo' if '--restore-twist' in sys.argv else 'rigify-demo'
OUT = ROOT / 'docs/infantry/playground/rigify' / variant / 'images'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'public/assets/infantry-candidate' / directory / 'infantry-rigify.blend'))
scene = bpy.context.scene
rig = bpy.data.objects['Infantry_Rigify']
mesh = bpy.data.objects['Infantry_LOD0']
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12
scene.cycles.use_denoising = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.resolution_x, scene.render.resolution_y = 480, 640
scene.render.resolution_percentage = 100
scene.world.color = (.12, .12, .12)
for pos, energy, size in [((1, -1.5, 2), 100, 2), ((-1, -1, 1), 50, 1), ((0, 1, 1), 70, 1)]:
    data = bpy.data.lights.new('Review light', 'AREA')
    data.energy, data.size = energy, size
    light = bpy.data.objects.new('Review light', data)
    scene.collection.objects.link(light)
    light.location = pos
    light.rotation_euler = (Vector((0, 0, .24)) - light.location).to_track_quat('-Z', 'Y').to_euler()
data = bpy.data.cameras.new('Review camera')
camera = bpy.data.objects.new('Review camera', data)
scene.collection.objects.link(camera)
scene.camera = camera
data.type, data.ortho_scale = 'ORTHO', .55
camera.location = (.65, -1.2, .43)
camera.rotation_euler = (Vector((0, 0, .24)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
for name, frame in [('idle', 0), ('run', 4), ('run', 10), ('walk', 7), ('QA_IK_PlantedFeet', 12)]:
    for side in ['L', 'R']:
        rig.pose.bones['thigh_parent.' + side]['IK_FK'] = 1.0
    rig.animation_data.action = bpy.data.actions[name if name.startswith('QA_') else 'Rigify_' + name]
    scene.frame_set(frame)
    scene.render.filepath = str(OUT / f'{name}-{frame}.png')
    bpy.ops.render.render(write_still=True)

# A real 3D x-ray-style diagnostic, not a replacement character or game asset.
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.matrix_basis.identity()
for side in ['L', 'R']:
    for stem in ['thigh_parent.', 'upper_arm_parent.']:
        rig.pose.bones[stem + side]['IK_FK'] = 1.0
bpy.context.view_layer.update()
for slot in mesh.material_slots:
    material = slot.material.copy()
    slot.material = material
    tree = material.node_tree
    output = next(n for n in tree.nodes if n.type == 'OUTPUT_MATERIAL')
    original = output.inputs['Surface'].links[0].from_socket
    transparent = tree.nodes.new('ShaderNodeBsdfTransparent')
    mix = tree.nodes.new('ShaderNodeMixShader')
    mix.inputs[0].default_value = .23
    tree.links.new(transparent.outputs[0], mix.inputs[1])
    tree.links.new(original, mix.inputs[2])
    tree.links.new(mix.outputs[0], output.inputs['Surface'])
material = bpy.data.materials.new('Diagnostic bone overlay')
material.use_nodes = True
tree = material.node_tree
output = next(n for n in tree.nodes if n.type == 'OUTPUT_MATERIAL')
emission = tree.nodes.new('ShaderNodeEmission')
emission.inputs['Color'].default_value = (1, .28, .025, 1)
emission.inputs['Strength'].default_value = 2
tree.links.new(emission.outputs[0], output.inputs['Surface'])
for bone in rig.data.bones:
    if not bone.use_deform:
        continue
    curve = bpy.data.curves.new('Diagnostic ' + bone.name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth, curve.bevel_resolution = .0015, 2
    spline = curve.splines.new('POLY')
    spline.points.add(1)
    spline.points[0].co = (*bone.head_local, 1)
    spline.points[1].co = (*bone.tail_local, 1)
    obj = bpy.data.objects.new('Diagnostic ' + bone.name, curve)
    scene.collection.objects.link(obj)
    curve.materials.append(material)
camera.location = (0, -1.2, .25)
camera.rotation_euler = (Vector((0, 0, .24)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(OUT / 'skeleton-rest.png')
bpy.ops.render.render(write_still=True)
