"""Retarget selected user Mixamo FBXs onto the existing compact candidate rig.

Keep the verified Idle/Walk/Run. Add real crouch locomotion, a jump pose track
without duplicate controller translation, and a separately named kneeling idle.
"""
import bpy, sys, json, math, hashlib, shutil
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from candidate_gltf_utils import repair_export_tangents
OUT = ROOT / 'public/assets/infantry-candidate/mixamo-demo'
DOC = ROOT / 'docs/infantry/motion-library'
SOURCES = ROOT / 'sources/infantry-motions'
STAGE = ROOT / '.tools/user-motion-build'
SOURCES.mkdir(parents=True, exist_ok=True)
STAGE.mkdir(parents=True, exist_ok=True)
catalog = json.loads((DOC / 'catalog.json').read_text())
manifest = json.loads((OUT / 'manifest.json').read_text())
selection = [
    {'name': 'crouch', 'file': 'Idle Crouching.fbx', 'sourceFrames': [1, 64], 'frames': 63,
     'loop': True, 'vertical': 'retain', 'displayName': 'Присед · Mixamo'},
    {'name': 'crouchWalk', 'file': 'Crouch Walking.fbx', 'sourceFrames': [1, 36], 'frames': 35,
     'loop': True, 'vertical': 'retain', 'displayName': 'Шаг в приседе · Mixamo'},
    {'name': 'jump', 'file': 'Pistol Jump.fbx', 'sourceFrames': [1, 19], 'frames': 20,
     'loop': False, 'vertical': 'controller', 'displayName': 'Прыжок · Mixamo'},
    {'name': 'kneel', 'file': 'Pistol Kneeling Idle.fbx', 'sourceFrames': [1, 115], 'frames': 114,
     'loop': True, 'vertical': 'retain', 'displayName': 'На одном колене · Mixamo'},
]
mapping = {'pelvis': 'Hips', 'spine': 'Spine2', 'head': 'Head',
           'upperarm_L': 'LeftArm', 'forearm_L': 'LeftForeArm', 'upperarm_R': 'RightArm', 'forearm_R': 'RightForeArm',
           'thigh_L': 'LeftUpLeg', 'shin_L': 'LeftLeg', 'foot_L': 'LeftFoot',
           'thigh_R': 'RightUpLeg', 'shin_R': 'RightLeg', 'foot_R': 'RightFoot'}
ends = {'Hips': 'Spine', 'Spine2': 'Neck', 'Head': 'HeadTop_End', 'LeftArm': 'LeftForeArm', 'LeftForeArm': 'LeftHand',
        'RightArm': 'RightForeArm', 'RightForeArm': 'RightHand', 'LeftUpLeg': 'LeftLeg', 'LeftLeg': 'LeftFoot',
        'LeftFoot': 'LeftToeBase', 'RightUpLeg': 'RightLeg', 'RightLeg': 'RightFoot', 'RightFoot': 'RightToeBase'}

def sample(frame):
    bpy.context.scene.frame_set(math.floor(frame), subframe=frame - math.floor(frame))
    bpy.context.view_layer.update()

def point(x, y, z):
    return Vector((x * .48, y * .48, z * .48))

reports, sources = [], []
for spec in selection:
    row = next(r for r in catalog['records'] if r['file'] == spec['file'])
    assert row['stacks'][0]['name'] == 'mixamo.com' and row['bones'] == 65
    path = SOURCES / spec['file']
    cache = ROOT / row['cache']
    if cache.exists():
        shutil.copyfile(cache, path)
    assert path.exists(), f'Missing animation-only source: {path}; run audit against the downloaded FBXs'
    if row.get('animationOnlySha256'):
        assert hashlib.sha256(path.read_bytes()).hexdigest() == row['animationOnlySha256']
    spec['sourcePath'] = path
    spec['sourceInfo'] = {'file': spec['file'], 'originalSha256': row['sha256'], 'originalBytes': row['bytes'],
                          'animationOnlySha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                          'animationOnlyBytes': path.stat().st_size, 'stack': 'mixamo.com',
                          'asset': path.relative_to(ROOT).as_posix()}
    sources.append(spec['sourceInfo'])

for level in range(3):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    scene = bpy.context.scene
    scene.render.fps = 30
    bpy.ops.import_scene.gltf(filepath=str(OUT / f'infantry-demo-lod{level}.glb'))
    target = next(o for o in scene.objects if o.type == 'ARMATURE')
    body = next(o for o in scene.objects if o.type == 'MESH' and o.name == 'DemoInfantry')
    for track in target.animation_data.nla_tracks:
        track.mute = True
    target.animation_data.action = None
    rest = {b.name: target.matrix_world @ b.matrix_local for b in target.data.bones}
    heads = {n: m.translation.copy() for n, m in rest.items()}
    target_axis = {}
    for name in mapping:
        if name.startswith('thigh_'):
            end = heads[name.replace('thigh_', 'shin_')]
        elif name.startswith('shin_'):
            end = heads[name.replace('shin_', 'foot_')]
        elif name.startswith('upperarm_'):
            end = heads[name.replace('upperarm_', 'forearm_')]
        elif name.startswith('forearm_'):
            end = point((1 if name.endswith('_L') else -1) * .32, -.01, .53)
        else:
            end = heads[name] + Vector((0, 0, .1))
        target_axis[name] = (end - heads[name]).normalized()
    lengths = {s: ((heads['shin_' + s] - heads['thigh_' + s]).length,
                   (heads['foot_' + s] - heads['shin_' + s]).length) for s in ['L', 'R']}
    for spec in selection:
        before = set(scene.objects)
        bpy.ops.import_scene.fbx(filepath=str(spec['sourcePath']), use_image_search=False)
        added = set(scene.objects) - before
        assert not any(o.type == 'MESH' for o in added), 'Donor geometry must never be imported'
        donor = next(o for o in added if o.type == 'ARMATURE')
        source_action = donor.animation_data.action
        source_bones = {b.name.split(':')[-1]: b for b in donor.data.bones}
        source_rest = {n: donor.matrix_world @ b.matrix_local for n, b in source_bones.items()}
        source_heads = {n: m.translation.copy() for n, m in source_rest.items()}
        scale = sum(lengths['L']) / ((source_heads['LeftLeg'] - source_heads['LeftUpLeg']).length +
                                    (source_heads['LeftFoot'] - source_heads['LeftLeg']).length)
        alignment = {name: target_axis[name].rotation_difference((source_heads[ends[src]] - source_heads[src]).normalized()).to_matrix().to_4x4()
                     if name.startswith(('upperarm_', 'forearm_', 'thigh_', 'shin_')) else Matrix.Identity(4)
                     for name, src in mapping.items()}
        begin, end = spec['sourceFrames']
        assert source_action.frame_range[0] <= begin < end <= source_action.frame_range[1] + .001
        sample(begin)
        first_hip = (donor.matrix_world @ donor.pose.bones[source_bones['Hips'].name].matrix).translation
        sample(end)
        last_hip = (donor.matrix_world @ donor.pose.bones[source_bones['Hips'].name].matrix).translation
        drift = last_hip - first_hip
        offset = first_hip - source_heads['Hips']
        drift.z = offset.z = 0
        action = bpy.data.actions.new('UserMixamo_' + spec['name'])
        target.animation_data.action = action
        first_pose = None
        seam_error = 0
        maximum_lift_removed = 0
        ground_before = []
        for frame in range(spec['frames'] + 1):
            phase = frame / spec['frames']
            sample(begin + (end - begin) * phase)
            poses = {n: donor.matrix_world @ donor.pose.bones[b.name].matrix for n, b in source_bones.items()}
            rotations = {n: poses[n].to_quaternion() @ source_rest[n].to_quaternion().inverted() for n in source_bones}
            removed = offset + drift * phase
            if spec['vertical'] == 'controller':
                # Keep skeletal articulation, but let stepHero own the jump arc.
                baseline = first_hip.z + (last_hip.z - first_hip.z) * phase
                removed.z = max(0, poses['Hips'].translation.z - baseline)
                maximum_lift_removed = max(maximum_lift_removed, removed.z * scale)
            hip = heads['pelvis'] + (poses['Hips'].translation - source_heads['Hips'] - removed) * scale
            matrices = {n: rotations[s].to_matrix().to_4x4() @ alignment[n] @ rest[n] for n, s in mapping.items()}
            pelvis_delta = Matrix.Translation(hip) @ rotations['Hips'].to_matrix().to_4x4() @ Matrix.Translation(-heads['pelvis'])
            hips = {s: pelvis_delta @ heads['thigh_' + s] for s in ['L', 'R']}
            ankles = {s: heads['foot_' + s] + (poses[p + 'Foot'].translation - source_heads[p + 'Foot'] - removed) * scale
                      for s, p in [('L', 'Left'), ('R', 'Right')]}
            lower = 0
            for s in ['L', 'R']:
                diff = hips[s] - ankles[s]
                reach = math.sqrt(max(0, (sum(lengths[s]) - .0001) ** 2 - diff.x ** 2 - diff.y ** 2))
                lower = max(lower, diff.z - reach)
            if lower:
                correction = Matrix.Translation((0, 0, -lower))
                pelvis_delta = correction @ pelvis_delta
                hip.z -= lower
                hips = {s: correction @ value for s, value in hips.items()}
            desired = {'root': rest['root'].copy(), 'pelvis': matrices['pelvis'].copy()}
            desired['pelvis'].translation = hip
            spine_head = pelvis_delta @ heads['spine']
            spine_delta = Matrix.Translation(spine_head) @ matrices['spine'].to_quaternion().to_matrix().to_4x4() @ rest['spine'].to_quaternion().inverted().to_matrix().to_4x4() @ Matrix.Translation(-heads['spine'])
            desired['spine'] = matrices['spine'].copy()
            desired['spine'].translation = spine_head
            desired['head'] = matrices['head'].copy()
            desired['head'].translation = spine_delta @ heads['head']
            for side, prefix in [('L', 'Left'), ('R', 'Right')]:
                h, ankle = hips[side], ankles[side]
                l1, l2 = lengths[side]
                delta = ankle - h
                direction = delta.normalized()
                distance = min(max(delta.length, abs(l1 - l2) + 1e-5), l1 + l2 - 1e-5)
                along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance)
                height = math.sqrt(max(0, l1 * l1 - along * along))
                sh, sk, sf = [poses[prefix + n].translation for n in ['UpLeg', 'Leg', 'Foot']]
                axis = (sf - sh).normalized()
                bend = sk - sh - axis * (sk - sh).dot(axis)
                if bend.length < 1e-5:
                    bend = Vector((0, -1, 0))
                bend = (bend - direction * bend.dot(direction)).normalized()
                knee = h + direction * along + bend * height
                for bone, head, tail in [('thigh_' + side, h, knee), ('shin_' + side, knee, ankle)]:
                    rotation = matrices[bone].to_quaternion()
                    align = (rotation @ Vector((0, 1, 0))).rotation_difference((tail - head).normalized())
                    desired[bone] = (align @ rotation).to_matrix().to_4x4()
                    desired[bone].translation = head
                desired['foot_' + side] = matrices['foot_' + side].copy()
                desired['foot_' + side].translation = ankle
                shoulder = spine_delta @ heads['upperarm_' + side]
                desired['upperarm_' + side] = matrices['upperarm_' + side].copy()
                desired['upperarm_' + side].translation = shoulder
                arm_length = (heads['forearm_' + side] - heads['upperarm_' + side]).length
                desired['forearm_' + side] = matrices['forearm_' + side].copy()
                desired['forearm_' + side].translation = shoulder + desired['upperarm_' + side].to_quaternion() @ Vector((0, arm_length, 0))
            deltas = {n: desired[n] @ rest[n].inverted() for n in rest}
            low = min(sum(((deltas[target.data.bones[g.group].name] @ vertex.co) * g.weight for g in vertex.groups), Vector()).z
                      for vertex in body.data.vertices if vertex.co.z < .48 * .12)
            ground_before.append(low)
            if low < 0:
                lift = Matrix.Translation((0, 0, -low))
                desired = {n: lift @ m for n, m in desired.items()}
            if frame == 0:
                first_pose = {n: m.copy() for n, m in desired.items()}
            if spec['loop'] and frame == spec['frames']:
                seam_error = max(abs(desired[n][i][j] - first_pose[n][i][j]) for n in desired for i in range(4) for j in range(4))
                if seam_error > .025:
                    raise RuntimeError(f'{spec["name"]} is not a usable loop: {seam_error}')
                desired = first_pose
            for bone in target.data.bones:
                pb = target.pose.bones[bone.name]
                pb.rotation_mode = 'QUATERNION'
                pb.matrix = target.matrix_world.inverted() @ desired[bone.name]
                bpy.context.view_layer.update()
                for field in ['location', 'rotation_quaternion', 'scale']:
                    pb.keyframe_insert(data_path=field, frame=frame)
        target.animation_data.action = None
        track = next((t for t in target.animation_data.nla_tracks if t.name == spec['name']), None)
        if track is None:
            track = target.animation_data.nla_tracks.new()
            track.name = spec['name']
        for strip in list(track.strips):
            track.strips.remove(strip)
        strip = track.strips.new(spec['name'], 0, action)
        strip.action_frame_start, strip.action_frame_end = 0, spec['frames']
        track.mute = True
        if level == 0:
            duration = spec['frames'] / 30
            reports.append({'name': spec['name'], 'duration': duration, 'loop': spec['loop'],
                            'movementSpeed': abs(drift.y) * scale / duration if spec['name'] == 'crouchWalk' else 0,
                            'source': 'mixamo', 'sourceClip': spec['file'], 'sourceSha256': spec['sourceInfo']['originalSha256'],
                            'sourceAsset': spec['sourceInfo']['asset'], 'sourceFrames': spec['sourceFrames'],
                            'displayName': spec['displayName'], 'retargetScale': scale, 'horizontalRootMotion': 'removed',
                            'verticalRootMotion': spec['vertical'], 'maximumLiftRemovedUnits': maximum_lift_removed,
                            'maximumLoopSeamMatrixAdjustment': seam_error, 'groundMinBeforeCorrection': min(ground_before)})
        for o in added:
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.actions.remove(source_action)
        print('RETARGETED', level, spec['name'], flush=True)
    for track in target.animation_data.nla_tracks:
        # Blender's glTF importer places some existing strips at frame 1.
        # Normalize the strip placement, preserving its action interval, so
        # Three.js does not count a leading unanimated frame as clip duration.
        for strip in track.strips:
            duration_frames = (strip.action_frame_end - strip.action_frame_start) * strip.scale * strip.repeat
            strip.frame_start = 0
            strip.frame_end = duration_frames
        track.mute = False
    sample(0)
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    path = STAGE / f'infantry-demo-lod{level}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_tangents=True,
                              export_skins=True, export_animations=True, export_animation_mode='NLA_TRACKS')
    repair_export_tangents(path)
    if level == 0:
        for track in target.animation_data.nla_tracks:
            track.mute = True
        target.animation_data.action = next(t.strips[0].action for t in target.animation_data.nla_tracks if t.name == 'kneel')
        sample(0)
        bpy.data.orphans_purge(do_recursive=True)
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(STAGE / 'infantry-mixamo-rig.blend'))
    manifest['lods'][level]['bytes'] = path.stat().st_size
replacement_names = {r['name'] for r in reports}
manifest['clips'] = [c for c in manifest['clips'] if c['name'] not in replacement_names] + reports
manifest['pendingMixamoClips'] = [c['name'] for c in manifest['clips'] if c.get('source') == 'prototype']
manifest['userMotionSources'] = sources
manifest['notes'] = ['Idle/Walk/Run retain the verified Three.js Mixamo source',
                     'Crouch/CrouchWalk/Jump/Kneel use user-provided Mixamo FBXs; donor geometry is stripped',
                     'Kneel is explicitly separate from crouch',
                     'Jump horizontal movement and positive root lift are removed; controller supplies movement and gravity']
(STAGE / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
for name in ['infantry-demo-lod0.glb', 'infantry-demo-lod1.glb', 'infantry-demo-lod2.glb', 'infantry-mixamo-rig.blend', 'manifest.json']:
    shutil.copyfile(STAGE / name, OUT / name)
(DOC / 'selection.json').write_text(json.dumps({'sources': sources, 'clips': reports, 'pending': manifest['pendingMixamoClips']}, indent=2), encoding='utf-8')
print('USER_MOTIONS=' + json.dumps(reports))
