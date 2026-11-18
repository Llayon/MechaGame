"""Check generated Rigify controls, compact export and save a planted-foot IK study."""
import bpy, addon_utils, json, math, sys, struct
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion

ROOT = Path(__file__).resolve().parents[2]
variant = 'preserved-twist' if '--restore-twist' in sys.argv else 'standard'
directory = 'rigify-twist-demo' if '--restore-twist' in sys.argv else 'rigify-demo'
BASE = ROOT / 'public/assets/infantry-candidate' / directory
DOC = ROOT / 'docs/infantry/playground/rigify' / variant
addon_utils.enable('rigify', default_set=True, persistent=False)
bpy.ops.wm.open_mainfile(filepath=str(BASE / 'infantry-rigify.blend'))
scene = bpy.context.scene
scene.render.fps = 30
rig = bpy.data.objects['Infantry_Rigify']
assert len(rig.data.bones) == 146
assert len([b for b in rig.data.bones if b.use_deform]) == 17
assert bpy.data.objects.get('Infantry_Metarig') is not None
assert bpy.data.objects.get('Mixamo_Reference') is None
assert all(b.bbone_segments == 1 for b in rig.data.bones if b.use_deform)
manifest = json.loads((BASE / 'manifest.json').read_text())
actions = {c['name']: bpy.data.actions['Rigify_' + c['name']] for c in manifest['clips']}

def sample(frame):
    scene.frame_set(math.floor(frame), subframe=frame - math.floor(frame))
    bpy.context.view_layer.update()

def reset():
    rig.animation_data.action = None
    for b in rig.pose.bones:
        b.matrix_basis = Matrix.Identity(4)
    for side in ['L', 'R']:
        for stem in ['upper_arm_parent.', 'thigh_parent.']:
            rig.pose.bones[stem + side]['IK_FK'] = 1.0
            assert rig.pose.bones[stem + side]['IK_Stretch'] == 0
    bpy.context.view_layer.update()

reset()
for side in ['L', 'R']:
    rig.pose.bones['thigh_parent.' + side]['IK_FK'] = 0.0
    rig.pose.bones['thigh_parent.' + side]['pole_vector'] = True
bpy.context.view_layer.update()
feet_before = {s: rig.pose.bones['DEF-foot.' + s].matrix.translation.copy() for s in ['L', 'R']}
qa_action = bpy.data.actions.new('QA_IK_PlantedFeet')
qa_action.use_fake_user = True
rig.animation_data.action = qa_action
foot_errors = []
length_errors = []
relative_length_errors = []
for frame, shift in [(0, 0), (12, 1), (24, 0)]:
    sample(frame)
    rig.pose.bones['pelvis'].matrix = Matrix.Translation((.005 * shift, 0, -.02 * shift)) @ rig.data.bones['pelvis'].matrix_local
    bpy.context.view_layer.update()
    for pb in rig.pose.bones:
        if pb.name.startswith(('ORG-', 'DEF-', 'MCH-', 'VIS_')):
            continue
        for field in ['location', 'rotation_quaternion' if pb.rotation_mode == 'QUATERNION' else 'rotation_euler', 'scale']:
            pb.keyframe_insert(data_path=field, frame=frame, group=pb.name)
    for side in ['L', 'R']:
        settings = rig.pose.bones['thigh_parent.' + side]
        for prop in ['IK_FK', 'pole_vector']:
            settings.keyframe_insert(data_path='["' + prop + '"]', frame=frame)
        foot_errors.append((rig.pose.bones['DEF-foot.' + side].matrix.translation - feet_before[side]).length)
        for stem in ['DEF-thigh.', 'DEF-shin.']:
            b = rig.pose.bones[stem + side]
            length_errors.append(abs((b.tail - b.head).length - b.bone.length))
            relative_length_errors.append(length_errors[-1] / b.bone.length)
            if '--debug' in sys.argv and frame == 12:
                print('IK_DEBUG', b.name, 'head', list(b.head), 'tail', list(b.tail), 'scale', list(b.matrix.to_scale()), 'org', list(rig.pose.bones[b.name.replace('DEF-', 'ORG-')].matrix.to_scale()))
assert max(foot_errors) < .0001, foot_errors
# Stock Rigify's soft IK solver retains small compression even with the UI
# Stretch slider at zero. Report it; do not silently rewrite its mechanisms.
assert max(relative_length_errors) < .03, relative_length_errors
reset()

# Test wrist controls really articulate the glove, independently of forearm.
mesh = bpy.data.objects['Infantry_LOD0']
before = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
before_points = [v.co.copy() for v in before.vertices]
mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
rig.pose.bones['hand_fk.L'].rotation_mode = 'XYZ'
rig.pose.bones['hand_fk.L'].rotation_euler.z = .25
bpy.context.view_layer.update()
evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
after = evaluated.to_mesh()
hand_indices = [v.index for v in mesh.data.vertices if any(mesh.vertex_groups[g.group].name == 'DEF-hand.L' and g.weight > .99 for g in v.groups)]
assert len(hand_indices) > 5
glove_motion = max((after.vertices[i].co - before_points[i]).length for i in hand_indices)
assert glove_motion > .001
chest_indices = [v.index for v in mesh.data.vertices if any(mesh.vertex_groups[g.group].name == 'DEF-chest' and g.weight > .99 for g in v.groups)]
assert max((after.vertices[i].co - before_points[i]).length for i in chest_indices) < 1e-6
evaluated.to_mesh_clear()
reset()
# Return hand's mode to the keyed quaternion mode before loading any clips.
rig.pose.bones['hand_fk.L'].rotation_mode = 'QUATERNION'

compact_map = {'root': 'root', 'pelvis': 'DEF-pelvis', 'spine': 'DEF-chest', 'head': 'DEF-head'}
for side in ['L', 'R']:
    for old, new in [('upperarm_', 'upper_arm.'), ('forearm_', 'forearm.'), ('hand_', 'hand.'),
                     ('thigh_', 'thigh.'), ('shin_', 'shin.'), ('foot_', 'foot.'), ('toe_', 'toe.')]:
        compact_map[old + side] = 'DEF-' + new + side
maximum_error = 0
worst_sample = None
bone_errors = {}
for level in range(3):
    bpy.context.view_layer.objects.active = rig
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    previous = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(BASE / f'infantry-demo-lod{level}.glb'))
    added = set(scene.objects) - previous
    imported = next(o for o in added if o.type == 'ARMATURE')
    imported_mesh = next(o for o in added if o.type == 'MESH' and o.name.startswith('DemoInfantry'))
    assert len(imported_mesh.data.polygons) == [3999, 1999, 999][level]
    assert len(imported.data.bones) == 18
    for track in imported.animation_data.nla_tracks:
        track.mute = True
    glb = (BASE / f'infantry-demo-lod{level}.glb').read_bytes()
    json_size = struct.unpack_from('<I', glb, 12)[0]
    document = json.loads(glb[20:20 + json_size])
    def accessor(index):
        a = document['accessors'][index]
        v = document['bufferViews'][a['bufferView']]
        width = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
        assert a['componentType'] == 5126
        return [struct.unpack_from('<' + 'f' * width, glb, 28 + json_size + v.get('byteOffset', 0) +
                                  a.get('byteOffset', 0) + i * v.get('byteStride', width * 4)) for i in range(a['count'])]
    bind_inverse = [Matrix([r[i:i+4] for i in range(0, 16, 4)]).transposed()
                    for r in accessor(document['skins'][0]['inverseBindMatrices'])]
    conversion = Matrix.Rotation(-math.pi / 2, 4, 'X')
    for clip in manifest['clips']:
        # Reset IK properties: the QA action keys must not leak into locomotion.
        reset()
        rig.animation_data.action = actions[clip['name']]
        imported.animation_data.action = next(t.strips[0].action for t in imported.animation_data.nla_tracks if t.name == clip['name'])
        animation = next(a for a in document['animations'] if a['name'] == clip['name'])
        tracks = [(c['target']['node'], c['target']['path'], accessor(animation['samplers'][c['sampler']]['input']),
                   accessor(animation['samplers'][c['sampler']]['output'])) for c in animation['channels']]
        for frame in range(round(clip['duration'] * 30) + 1):
            sample(frame)
            trs = [{'translation': n.get('translation', [0, 0, 0]), 'rotation': n.get('rotation', [0, 0, 0, 1]),
                    'scale': n.get('scale', [1, 1, 1])} for n in document['nodes']]
            for node, field, times, values in tracks:
                index = min(range(len(times)), key=lambda i: abs(times[i][0] - frame / 30))
                trs[node][field] = values[index]
            worlds = {}
            def traverse(node, parent):
                t = trs[node]
                q = t['rotation']
                worlds[node] = parent @ Matrix.Translation(t['translation']) @ Quaternion((q[3], q[0], q[1], q[2])).to_matrix().to_4x4() @ Matrix.Diagonal((*t['scale'], 1))
                for child in document['nodes'][node].get('children', []):
                    traverse(child, worlds[node])
            for node in document['scenes'][document.get('scene', 0)]['nodes']:
                traverse(node, Matrix.Identity(4))
            for name, deform in compact_map.items():
                joint = next(i for i, node in enumerate(document['skins'][0]['joints']) if document['nodes'][node]['name'] == name)
                node = document['skins'][0]['joints'][joint]
                exported_delta = conversion.inverted() @ worlds[node] @ bind_inverse[joint] @ conversion
                expected_delta = rig.pose.bones[deform].matrix @ rig.data.bones[deform].matrix_local.inverted()
                for i in range(4):
                    for j in range(4):
                        actual, expected = exported_delta[i][j], expected_delta[i][j]
                        assert math.isfinite(actual) and math.isfinite(expected)
                        error = abs(actual - expected)
                        bone_errors[name] = max(bone_errors.get(name, 0), error)
                        if error > maximum_error:
                            maximum_error = error
                            worst_sample = {'lod': level, 'clip': clip['name'], 'frame': frame, 'bone': name,
                                            'actual': list(map(list, exported_delta)), 'expected': list(map(list, expected_delta))}
    for o in added:
        bpy.data.objects.remove(o, do_unlink=True)
assert maximum_error < .0001, (maximum_error, worst_sample, bone_errors)
reset()
rig.animation_data.action = actions['idle']
sample(0)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
bpy.context.preferences.filepaths.save_version = 0
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BASE / 'infantry-rigify.blend'))
report = {'passed': True, 'variant': variant, 'roundtripMaximumMatrixError': maximum_error,
          'ikPlantedFootMaximumErrorUnits': max(foot_errors), 'ikPlantedFootMaximumErrorMeters': max(foot_errors) * 3.75,
          'ikBoneLengthMaximumErrorUnits': max(length_errors), 'independentGloveMotionUnits': glove_motion,
          'stockIkMaximumRelativeCompression': max(relative_length_errors),
          'qaAction': 'QA_IK_PlantedFeet', 'clips': [c['name'] for c in manifest['clips']],
          'lods': [3999, 1999, 999], 'physicalDeviceQA': 'NOT VERIFIED',
          'note': 'Planted-foot QA verifies IK functionality; stock soft IK shows small compression. Playback clips use FK. This does not prove locomotion is free of all foot sliding'}
(DOC / 'verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('RIGIFY_QA=' + json.dumps(report))
