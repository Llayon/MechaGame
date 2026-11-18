"""Create a fitted Rigify authoring rig and compact game skeletons.

Run with Blender 5.2 --background --factory-startup --python-exit-code 1 --python ...
No automatic heat weights: preserve the candidate's deliberate armor bindings.
"""
import bpy, addon_utils, json, math, sys, hashlib
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from candidate_gltf_utils import repair_export_tangents

BASE = ROOT / 'public/assets/infantry-candidate/mixamo-demo'
RESTORE_TWIST = '--restore-twist' in sys.argv
VARIANT = 'preserved-twist' if RESTORE_TWIST else 'standard'
OUT = ROOT / ('public/assets/infantry-candidate/rigify-twist-demo' if RESTORE_TWIST else 'public/assets/infantry-candidate/rigify-demo')
DOC = ROOT / 'docs/infantry/playground/rigify' / VARIANT
OUT.mkdir(parents=True, exist_ok=True)
DOC.mkdir(parents=True, exist_ok=True)
addon_utils.enable('rigify', default_set=True, persistent=False)
scene = bpy.context.scene
scene.render.fps = 30
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(BASE / 'infantry-demo-lod0.glb'))
source = next(o for o in scene.objects if o.type == 'ARMATURE')
body = next(o for o in scene.objects if o.type == 'MESH' and o.name == 'DemoInfantry')
source.name = 'Mixamo_Reference'
for track in source.animation_data.nla_tracks:
    track.mute = True
source.animation_data.action = None
rest = {b.name: source.matrix_world @ b.matrix_local for b in source.data.bones}
heads = {n: m.translation.copy() for n, m in rest.items()}

def point(x, y, z):
    return Vector((x * .48, y * .48, z * .48))

data = bpy.data.armatures.new('Infantry_Rigify_Metarig')
meta = bpy.data.objects.new('Infantry_Metarig', data)
scene.collection.objects.link(meta)
bpy.ops.object.select_all(action='DESELECT')
meta.select_set(True)
bpy.context.view_layer.objects.active = meta
bpy.ops.object.mode_set(mode='EDIT')

def bone(name, head, tail, parent=None, connected=False):
    b = data.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent:
        b.parent = data.edit_bones[parent]
    b.use_connect = connected
    return b

# Modular Rigify: rigid torso controls suit a single armored chest shell.
# Standard limbs.arm / limbs.leg supply actual IK/FK, poles and foot rolls.
bone('pelvis', heads['pelvis'], point(0, 0, .55))
bone('chest', heads['spine'], point(0, 0, .83), 'pelvis')
bone('head', heads['head'], point(0, -.015, .98), 'chest')
for side, sign in [('L', 1), ('R', -1)]:
    bone('upper_arm.' + side, heads['upperarm_' + side], heads['forearm_' + side], 'chest')
    wrist = point(sign * .32, -.01, .53)
    bone('forearm.' + side, heads['forearm_' + side], wrist, 'upper_arm.' + side, True)
    bone('hand.' + side, wrist, point(sign * .35, -.018, .475), 'forearm.' + side, True)
    bone('thigh.' + side, heads['thigh_' + side], heads['shin_' + side], 'pelvis')
    bone('shin.' + side, heads['shin_' + side], heads['foot_' + side], 'thigh.' + side, True)
    toe = point(sign * .105, -.095, .025)
    bone('foot.' + side, heads['foot_' + side], toe, 'shin.' + side, True)
    bone('toe.' + side, toe, point(sign * .105, -.13, .025), 'foot.' + side, True)
    bone('heel.02.' + side, point(sign * .07, .055, .025), point(sign * .14, .055, .025), 'foot.' + side)
bpy.ops.object.mode_set(mode='OBJECT')
for name in ['pelvis', 'chest', 'head']:
    meta.pose.bones[name].rigify_type = 'basic.super_copy'
for side in ['L', 'R']:
    for name, kind in [('upper_arm.', 'limbs.arm'), ('thigh.', 'limbs.leg')]:
        pb = meta.pose.bones[name + side]
        pb.rigify_type = kind
        pb.rigify_parameters.segments = 1
        pb.rigify_parameters.bbones = 1
        pb.rigify_parameters.rotation_axis = 'automatic'
torso_collection = data.collections.new('Torso')
torso_collection.rigify_ui_row = 1
for b in data.bones:
    torso_collection.assign(b)
for index, (side, limb) in enumerate((s, l) for s in ['L', 'R'] for l in ['Arm', 'Leg']):
    pb = meta.pose.bones[('upper_arm.' if limb == 'Arm' else 'thigh.') + side]
    for row, label, param in [(3, 'IK', 'ik'), (4, 'FK', 'fk'), (5, 'Tweak', 'tweak')]:
        collection = data.collections.new(f'{limb}.{side} ({label})')
        collection.rigify_ui_row = row + index * 4
        refs = getattr(pb.rigify_parameters, param + '_coll_refs', None)
        if refs is not None:
            refs.add().set_collection(collection)
data.rigify_rig_basename = 'Infantry_Controls'
bpy.ops.pose.rigify_generate()
rig = bpy.context.object
rig.name = 'Infantry_Rigify'
rig.show_in_front = True
for side in ['L', 'R']:
    for stem in ['upper_arm_parent.', 'thigh_parent.']:
        rig.pose.bones[stem + side]['IK_FK'] = 1.0
        rig.pose.bones[stem + side]['IK_Stretch'] = 0.0

control_source = {'root': 'root', 'pelvis': 'pelvis', 'chest': 'spine', 'head': 'head'}
deform_source = {'DEF-pelvis': 'pelvis', 'DEF-chest': 'spine', 'DEF-head': 'head'}
for side in ['L', 'R']:
    for control, src in [('upper_arm_fk.', 'upperarm_'), ('forearm_fk.', 'forearm_'),
                         ('hand_fk.', 'forearm_'), ('thigh_fk.', 'thigh_'),
                         ('shin_fk.', 'shin_'), ('foot_fk.', 'foot_'), ('toe.', 'foot_')]:
        control_source[control + side] = src + side
    for deform, src in [('upper_arm.', 'upperarm_'), ('forearm.', 'forearm_'),
                        ('hand.', 'forearm_'), ('thigh.', 'thigh_'),
                        ('shin.', 'shin_'), ('foot.', 'foot_'), ('toe.', 'foot_')]:
        deform_source['DEF-' + deform + side] = src + side
rig_rest = {b.name: b.matrix_local.copy() for b in rig.data.bones}

def frame_set(frame):
    scene.frame_set(math.floor(frame), subframe=frame - math.floor(frame))
    bpy.context.view_layer.update()

clips = json.loads((BASE / 'manifest.json').read_text())['clips']
actions = {}
fidelity = []
for clip in clips:
    name = clip['name']
    track = next(t for t in source.animation_data.nla_tracks if t.name == name)
    source.animation_data.action = track.strips[0].action
    source_begin, source_end = source.animation_data.action.frame_range
    action = bpy.data.actions.new('Rigify_' + name)
    actions[name] = action
    rig.animation_data_create()
    rig.animation_data.action = action
    maximum_error = 0
    maximum_joint_error = 0
    frame_count = round(clip['duration'] * 30)
    for frame in range(frame_count + 1):
        # Imported prototype actions start at frame 1; Mixamo actions start at 0.
        # Sample their actual endpoints so neither loop loses its last frame.
        frame_set(source_begin + (source_end - source_begin) * frame / frame_count)
        deltas = {n: source.matrix_world @ source.pose.bones[n].matrix @ r.inverted()
                  for n, r in rest.items()}
        # Bake editable controls, not constraints targeting a hidden donor.
        for control, src in control_source.items():
            pb = rig.pose.bones[control]
            pb.rotation_mode = 'QUATERNION'
            pb.matrix = deltas[src] @ rig_rest[control]
            bpy.context.view_layer.update()
            for field in ['location', 'rotation_quaternion', 'scale']:
                pb.keyframe_insert(data_path=field, frame=frame, group=control)
        # Rigify's first tweak deliberately removes FK axial twist. Restore
        # the authored twist on its editable Y channel for rigid armor shells.
        for side in (['L', 'R'] if RESTORE_TWIST else []):
            for stem, src_stem in [('upper_arm', 'upperarm_'), ('thigh', 'thigh_')]:
                name_tweak = stem + '_tweak.' + side
                pb = rig.pose.bones[name_tweak]
                pb.matrix = deltas[src_stem + side] @ rig_rest[name_tweak]
                bpy.context.view_layer.update()
                pb.keyframe_insert(data_path='rotation_euler', frame=frame, group=name_tweak)
        for deform, src in deform_source.items():
            actual = rig.pose.bones[deform].matrix @ rig_rest[deform].inverted()
            maximum_joint_error = max(maximum_joint_error, (rig.pose.bones[deform].matrix.translation -
                                     (deltas[src] @ rig_rest[deform]).translation).length)
            if '--debug' in sys.argv and frame == 0:
                error = max(abs(actual[i][j] - deltas[src][i][j]) for i in range(4) for j in range(4))
                print('DEBUG', deform, error, 'scale', list(rig.pose.bones[deform].matrix.to_scale()))
                if error > .01:
                    print('ACTUAL', list(map(list, actual)), 'EXPECTED', list(map(list, deltas[src])))
            maximum_error = max(maximum_error, max(abs(actual[i][j] - deltas[src][i][j])
                                                  for i in range(4) for j in range(4)))
    fidelity.append({'clip': name, 'maximumDeformationMatrixError': maximum_error,
                     'maximumJointPositionError': maximum_joint_error})
    print('FIDELITY', name, maximum_error)
    if (RESTORE_TWIST and maximum_error > .001) or maximum_joint_error > .0001:
        raise RuntimeError(f'Rigify motion diverged: {name}: {maximum_error}')
rig.animation_data.action = actions['idle']
source.animation_data.action = None
frame_set(0)

if '--probe' in sys.argv:
    print('RIGIFY_BONES=' + json.dumps([{'name': b.name, 'parent': b.parent.name if b.parent else None,
                                      'deform': b.use_deform} for b in rig.data.bones]))
    print('RIGIFY_PROPS=' + json.dumps({b.name: dict(b.items()) for b in rig.pose.bones if b.keys()}, default=str))
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / '.tools/rigify-probe.blend'))
    raise SystemExit(0)

old_to_def = {'pelvis': 'DEF-pelvis', 'spine': 'DEF-chest', 'head': 'DEF-head', 'root': 'root'}
for side in ['L', 'R']:
    for old, new in [('upperarm_', 'upper_arm.'), ('forearm_', 'forearm.'),
                     ('thigh_', 'thigh.'), ('shin_', 'shin.'), ('foot_', 'foot.')]:
        old_to_def[old + side] = 'DEF-' + new + side

def bind_mesh(mesh):
    assignments = []
    for vertex in mesh.data.vertices:
        weights = {old_to_def[mesh.vertex_groups[g.group].name]: g.weight for g in vertex.groups if g.weight > 1e-7}
        # Separate glove from forearm armor at the existing wrist. This has no
        # motion discontinuity: the new hand initially follows the forearm delta.
        side = 'L' if vertex.co.x >= 0 else 'R'
        forearm = 'DEF-forearm.' + side
        if forearm in weights:
            t = max(0, min(1, (.54 - vertex.co.z / .48) / .02))
            t = t * t * (3 - 2 * t)
            if t > 0:
                weights['DEF-hand.' + side] = weights[forearm] * t
                weights[forearm] *= 1 - t
        assignments.append({n: w for n, w in weights.items() if w > 1e-7})
    mesh.vertex_groups.clear()
    for n in ['root'] + list(deform_source):
        mesh.vertex_groups.new(name=n)
    for vertex, weights in zip(mesh.data.vertices, assignments):
        for name, weight in weights.items():
            mesh.vertex_groups[name].add([vertex.index], weight, 'REPLACE')
    for modifier in list(mesh.modifiers):
        mesh.modifiers.remove(modifier)
    modifier = mesh.modifiers.new('Rigify armor deformation', 'ARMATURE')
    modifier.object = rig
    mesh.parent = rig
    mesh.matrix_parent_inverse = Matrix.Identity(4)
    mesh.matrix_basis = Matrix.Identity(4)
    return assignments

meshes = []
for level in range(3):
    if level == 0:
        mesh = body
    else:
        previous = set(scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(BASE / f'infantry-demo-lod{level}.glb'))
        imported = set(scene.objects) - previous
        mesh = next(o for o in imported if o.type == 'MESH' and o.name.startswith('DemoInfantry'))
    assert len(mesh.data.polygons) == [3999, 1999, 999][level], 'Wrong LOD mesh selected'
    bind_mesh(mesh)
    if level:
        for o in imported - {mesh}:
            bpy.data.objects.remove(o, do_unlink=True)
    mesh.name = f'Infantry_LOD{level}'
    mesh.hide_render = level != 0
    mesh.hide_set(level != 0)
    meshes.append(mesh)
bpy.data.objects.remove(source, do_unlink=True)
for o in list(scene.objects):
    if o.type == 'MESH' and o not in meshes and o.name.startswith('Icosphere'):
        bpy.data.objects.remove(o, do_unlink=True)
meta.hide_render = True
meta.hide_set(True)

# Export only compact deformation bones. Generated MCH/ORG/control bones never
# enter GLB or the eventual GPU atlas. DEF transforms are evaluated from Rigify.
compact_map = {'root': 'root', 'pelvis': 'DEF-pelvis', 'spine': 'DEF-chest', 'head': 'DEF-head'}
parents = {'pelvis': 'root', 'spine': 'pelvis', 'head': 'spine'}
for side in ['L', 'R']:
    for old, new, parent in [('upperarm_', 'upper_arm.', 'spine'), ('forearm_', 'forearm.', 'upperarm_' + side),
                             ('hand_', 'hand.', 'forearm_' + side), ('thigh_', 'thigh.', 'pelvis'),
                             ('shin_', 'shin.', 'thigh_' + side), ('foot_', 'foot.', 'shin_' + side),
                             ('toe_', 'toe.', 'foot_' + side)]:
        compact_map[old + side] = 'DEF-' + new + side
        parents[old + side] = parent
compact_data = bpy.data.armatures.new('Infantry_Export_Skeleton')
compact = bpy.data.objects.new('Infantry_Export', compact_data)
scene.collection.objects.link(compact)
bpy.ops.object.select_all(action='DESELECT')
compact.select_set(True)
bpy.context.view_layer.objects.active = compact
bpy.ops.object.mode_set(mode='EDIT')
for name, deform in compact_map.items():
    b = compact_data.edit_bones.new(name)
    # A new EditBone has zero length. Give it length BEFORE setting its matrix,
    # otherwise Blender cannot preserve the requested rest-axis direction.
    b.length = rig.data.bones[deform].length
    b.matrix = rig.data.bones[deform].matrix_local
    if name in parents:
        b.parent = compact_data.edit_bones[parents[name]]
bpy.ops.object.mode_set(mode='OBJECT')
rest_errors = {n: max(abs(compact.data.bones[n].matrix_local[i][j] - rig.data.bones[d].matrix_local[i][j])
                     for i in range(4) for j in range(4)) for n, d in compact_map.items()}
assert max(rest_errors.values()) < 1e-5, rest_errors
compact.animation_data_create()
export_actions = []
export_error = 0
for clip in clips:
    rig.animation_data.action = actions[clip['name']]
    action = bpy.data.actions.new('Export_' + clip['name'])
    export_actions.append(action)
    compact.animation_data.action = action
    for frame in range(round(clip['duration'] * 30) + 1):
        frame_set(frame)
        for name, deform in compact_map.items():
            pb = compact.pose.bones[name]
            pb.rotation_mode = 'QUATERNION'
            pb.matrix = rig.pose.bones[deform].matrix.copy()
            bpy.context.view_layer.update()
            for field in ['location', 'rotation_quaternion', 'scale']:
                pb.keyframe_insert(data_path=field, frame=frame, group=name)
            export_error = max(export_error, max(abs(pb.matrix[i][j] - rig.pose.bones[deform].matrix[i][j])
                                                for i in range(4) for j in range(4)))
    compact.animation_data.action = None
    track = compact.animation_data.nla_tracks.new()
    track.name = clip['name']
    strip = track.strips.new(clip['name'], 0, action)
    strip.action_frame_start = 0
    strip.action_frame_end = round(clip['duration'] * 30)
    track.mute = True
if export_error > .0001:
    raise RuntimeError(f'Compact skeleton deviates from Rigify: {export_error}')

# Re-evaluate the stored curves before invoking the exporter. Immediate matrix
# assignment alone is not proof that Blender will play the keys identically.
playback_error = 0
for clip, action in zip(clips, export_actions):
    rig.animation_data.action = actions[clip['name']]
    compact.animation_data.action = action
    for frame in range(round(clip['duration'] * 30) + 1):
        frame_set(frame)
        for name, deform in compact_map.items():
            error = max(abs(compact.pose.bones[name].matrix[i][j] - rig.pose.bones[deform].matrix[i][j])
                        for i in range(4) for j in range(4))
            playback_error = max(playback_error, error)
    compact.animation_data.action = None
print('COMPACT_PLAYBACK_ERROR', playback_error)
if playback_error > .0001:
    raise RuntimeError(f'Compact keyed playback differs: {playback_error}')

reports = []
inverse_names = {v: k for k, v in compact_map.items()}
for level, mesh in enumerate(meshes):
    exported = mesh.copy()
    exported.data = mesh.data.copy()
    exported.name = 'DemoInfantry'
    scene.collection.objects.link(exported)
    exported.parent = compact
    exported.hide_render = False
    exported.hide_set(False)
    for group in exported.vertex_groups:
        group.name = inverse_names[group.name]
    exported.modifiers[0].object = compact
    bpy.ops.object.select_all(action='DESELECT')
    compact.select_set(True)
    exported.select_set(True)
    bpy.context.view_layer.objects.active = compact
    for track in compact.animation_data.nla_tracks:
        track.mute = False
    frame_set(0)
    path = OUT / f'infantry-demo-lod{level}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_tangents=True, export_animations=True, export_skins=True,
                              export_animation_mode='NLA_TRACKS', export_rest_position_armature=True)
    repaired = repair_export_tangents(path)
    for track in compact.animation_data.nla_tracks:
        track.mute = True
    bpy.data.objects.remove(exported, do_unlink=True)
    reports.append({'level': level, 'glb': path.name, 'bytes': path.stat().st_size,
                    'triangles': len(mesh.data.polygons), 'bones': len(compact_map), 'repairedTangents': repaired})
bpy.data.objects.remove(compact, do_unlink=True)
for action in export_actions:
    bpy.data.actions.remove(action)

for name, action in actions.items():
    action.use_fake_user = True
rig.animation_data.action = actions['idle']
frame_set(0)
for collection in rig.data.collections_all:
    if 'Tweak' in collection.name or '(IK)' in collection.name:
        collection.is_visible = False
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
scene.frame_start, scene.frame_end = 0, 75
rig['authoring_note'] = f'Rigify {VARIANT}; FK Mixamo clips. Use generated IK/FK snap before switching modes. IK Stretch disabled for armor.'
rig['animation_provenance'] = 'idle/walk/run: Mixamo; crouch/crouchWalk/jump: explicit prototypes, pending actual Mixamo FBXs'
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_location = Vector((0, 0, .24))
            area.spaces.active.region_3d.view_distance = .85
            area.spaces.active.region_3d.view_rotation = Vector((.5, -1, .35)).to_track_quat('Z', 'Y')
            area.spaces.active.clip_start = .001
            area.spaces.active.clip_end = 100
            area.spaces.active.shading.color_type = 'TEXTURE'
            area.spaces.active.overlay.show_floor = False
            area.spaces.active.overlay.show_extras = False
for image in bpy.data.images:
    if image.has_data and not image.packed_file and image.source == 'FILE':
        image.pack()
bpy.context.preferences.filepaths.save_version = 0
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'infantry-rigify.blend'))
manifest = json.loads((BASE / 'manifest.json').read_text())
manifest.update({'lods': reports, 'authoringRig': 'Rigify modular humanoid',
                 'authoringFile': 'infantry-rigify.blend', 'exportBones': len(compact_map),
                 'generatedRigBones': len(rig.data.bones), 'bakedFrom': 'evaluated Rigify DEF transforms',
                 'gpuAtlasBaked': False, 'rigifyVariant': VARIANT})
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
metrics = {'variant': VARIANT, 'restoredAxialTwist': RESTORE_TWIST,
           'blender': bpy.app.version_string, 'rigifyVersion': list(__import__('rigify').bl_info['version']),
           'generatedBones': len(rig.data.bones), 'deformBones': len(deform_source),
           'metarigBones': len(meta.data.bones), 'compactBones': len(compact_map),
           'fidelity': fidelity, 'compactExportMatrixError': export_error, 'lods': reports,
           'sourceAssetSha256': hashlib.sha256((BASE / 'infantry-demo-lod0.glb').read_bytes()).hexdigest(),
           'notes': ['Armor retains deliberate weights; no automatic heat weighting',
                     'Gloves receive separate hand bones; rigid boots retain foot weights (toe controls are reserved)',
                     'Rigify generation is a tooling change, not automatic animation art approval',
                     'GPU texture atlas is a subsequent step; this export is compact skeletal GLB']}
(DOC / 'rig-metrics.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')
print('RIGIFY_RESULT=' + json.dumps(metrics))
