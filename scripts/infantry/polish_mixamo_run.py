"""Redistribute abrupt run support lifts and keep boot soles above the floor.

Run in Blender background with ``--python polish_mixamo_run.py -- INPUT OUTPUT``.
Both paths are Mixamo demo asset directories. Use an unpolished retarget as input.
Use --boot-floor on the polished result to fit local ankle lift at the Run keys.
"""

import argparse
import json
import math
import struct
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_armed_verify import accessor, difference, glb, quaternion, sample_trs, world_pose


FPS = 30
FLOOR_SAMPLES_PER_KEY = 32
FLOOR_MARGIN = .00006
SIDES = ('L', 'R')


def smooth_lift(values):
    """The last sample duplicates the first; omit it when wrapping taps."""
    cycle = values[:-1]
    weights = (1, 4, 6, 4, 1)
    for _ in range(2):
        cycle = [sum(weight * cycle[(frame + offset - 2) % len(cycle)]
                     for offset, weight in enumerate(weights)) / 16
                 for frame in range(len(cycle))]
    return [*cycle, cycle[0]]


def solve_leg(old, pose, side, foot_goal=None):
    thigh, shin, foot = (f'{bone}_{side}' for bone in ('thigh', 'shin', 'foot'))
    hip = pose[thigh].translation
    old_hip, old_knee, old_ankle = (old[bone].translation for bone in (thigh, shin, foot))
    foot_goal = old[foot] if foot_goal is None else foot_goal
    ankle = foot_goal.translation
    upper, lower = (old_knee - old_hip).length, (old_ankle - old_knee).length
    axis = ankle - hip
    reach = axis.length
    if not abs(upper - lower) + 1e-6 < reach < upper + lower - 1e-6:
        raise ValueError(f'Run support redistribution exceeds {side} leg reach: {reach}')
    direction = axis.normalized()
    pole = old_knee - old_hip
    bend = (pole - direction * pole.dot(direction)).normalized()
    along = (upper ** 2 - lower ** 2 + reach ** 2) / (2 * reach)
    knee = hip + direction * along + bend * math.sqrt(max(0, upper ** 2 - along ** 2))

    for bone, position, old_axis, new_axis in (
        (thigh, hip, old_knee - old_hip, knee - hip),
        (shin, knee, old_ankle - old_knee, ankle - knee),
    ):
        _, rotation, scale = old[bone].decompose()
        swing = old_axis.normalized().rotation_difference(new_axis.normalized())
        pose[bone] = Matrix.LocRotScale(position, swing @ rotation, scale)
    pose[foot] = foot_goal.copy()


def close_forearm_loops(frames):
    window = 4
    last = len(frames) - 1
    assert last > 2 * window
    for side in ('L', 'R'):
        parent, child = f'upperarm_{side}', f'forearm_{side}'
        first_rotation = (frames[0][parent].inverted() @ frames[0][child]).to_quaternion()
        last_rotation = (frames[last][parent].inverted() @ frames[last][child]).to_quaternion()
        seam = first_rotation.slerp(last_rotation, .5)
        for offset in range(window):
            phase = 1 - offset / window
            weight = phase ** 2 * (3 - 2 * phase)
            for frame, endpoint in ((offset, first_rotation), (last - offset, last_rotation)):
                pose = frames[frame]
                position, rotation, scale = (pose[parent].inverted() @ pose[child]).decompose()
                correction = endpoint.slerp(seam, weight)
                pose[child] = pose[parent] @ Matrix.LocRotScale(position, rotation @ endpoint.inverted() @ correction, scale)


def polish(frames, up, close_forearms):
    baseline = min(pose['root'].translation.dot(up) for pose in frames)
    lift = [pose['root'].translation.dot(up) - baseline for pose in frames]
    assert abs(lift[0] - lift[-1]) < 1e-5
    smoothed = smooth_lift(lift)
    result = []
    for old, before, after in zip(frames, lift, smoothed):
        # The game controller moves the root. Keep the softened lift on the
        # body and absorb the difference in the legs at their original lengths.
        shift = Matrix.Translation(up * (after - before))
        pose = {name: shift @ matrix for name, matrix in old.items()}
        pose['root'] = Matrix.Translation(-up * before) @ old['root']
        for side in ('L', 'R'):
            solve_leg(old, pose, side)
        result.append(pose)
    if close_forearms:
        close_forearm_loops(result)
    return result


def run_channels(document, binary):
    clip = next(animation for animation in document['animations'] if animation['name'] == 'run')
    channels = []
    for channel in clip['channels']:
        index = channel['target']['node']
        field = channel['target']['path']
        sampler = clip['samplers'][channel['sampler']]
        width = 4 if field == 'rotation' else 3
        times = [value[0] for value in accessor(document, binary, sampler['input'], 1)]
        values = accessor(document, binary, sampler['output'], width)
        channels.append((index, sampler, (field, sampler.get('interpolation', 'LINEAR'), times, values)))
    return clip, channels


def sample_pose(document, channels, seconds):
    properties = [dict(node) for node in document['nodes']]
    for index, _, channel in channels:
        properties[index][channel[0]] = sample_trs(channel, seconds)
    return world_pose(document, properties)


def boot_heights(document, binary, duration):
    """Sample the exact skinned boot surface with hierarchical glTF playback."""
    _, channels = run_channels(document, binary)
    skin = document['skins'][0]
    joint_nodes = skin['joints']
    joint_names = [document['nodes'][index]['name'] for index in joint_nodes]
    inverse_binds = np.asarray(accessor(document, binary, skin['inverseBindMatrices'], 16)).reshape(-1, 4, 4)
    inverse_binds = inverse_binds.transpose(0, 2, 1)
    attrs = document['meshes'][0]['primitives'][0]['attributes']
    positions = np.asarray(accessor(document, binary, attrs['POSITION'], 3))
    weights = np.asarray(accessor(document, binary, attrs['WEIGHTS_0'], 4))
    joint_indices = np.asarray(accessor(document, binary, attrs['JOINTS_0'], 4))
    membership = joint_indices[np.arange(len(positions)), weights.argmax(axis=1)]
    vertices = np.c_[positions, np.ones(len(positions))]
    soles = []
    for side in SIDES:
        # Limit the hull to the bottom of the bind-pose leg. The selected
        # vertices still retain all influences when evaluated below.
        bones = [i for i, name in enumerate(joint_names) if name in
                 (f'foot_{side}', f'shin_{side}', f'toe_{side}')]
        select = (positions[:, 1] <= .10) & np.isin(membership, bones)
        assert select.any(), side
        soles.append((vertices[select], weights[select], joint_indices[select]))

    sample_rate = FPS * FLOOR_SAMPLES_PER_KEY
    heights = []
    for sample in range(round(duration * sample_rate) + 1):
        pose = sample_pose(document, channels, sample / sample_rate)
        skin_y = (np.asarray([pose[index] for index in joint_nodes]) @ inverse_binds)[:, 1]
        heights.append([np.einsum('nji,ni,nj->n', skin_y[joints], points, influence).min()
                        for points, influence, joints in soles])
    return np.asarray(heights)


def fit_boot_lift(paths, duration):
    clearance = np.minimum.reduce([boot_heights(*glb(path), duration) for path in paths])
    count = round(duration * FPS)
    lift = np.zeros((count, len(SIDES)))
    for frame in range(count):
        begin = frame * FLOOR_SAMPLES_PER_KEY
        end = begin + FLOOR_SAMPLES_PER_KEY + 1
        needed = np.maximum(0, FLOOR_MARGIN - clearance[begin:end].min(axis=0))
        # Raise both bounding keys of each dipping interval. The remaining
        # interpolation difference is checked against the exported mesh.
        for key in (frame, (frame + 1) % count):
            lift[key] = np.maximum(lift[key], needed)
    base = lift.copy()
    for distance, weight in ((1, .35), (2, .08)):
        lift = np.maximum(lift, weight * np.roll(base, distance, axis=0))
        lift = np.maximum(lift, weight * np.roll(base, -distance, axis=0))
    return np.vstack((lift, lift[0]))


def apply_boot_lift(frames, up, lift):
    result = []
    for old, heights in zip(frames, lift):
        pose = {name: matrix.copy() for name, matrix in old.items()}
        for side, height in zip(SIDES, heights):
            if height > 0:
                foot = Matrix.Translation(up * height) @ old[f'foot_{side}']
                solve_leg(old, pose, side, foot)
        result.append(pose)
    return result


def append_accessor(document, binary, samples):
    width = len(samples[0])
    view = len(document['bufferViews'])
    document['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(samples) * width * 4})
    for sample in samples:
        binary.extend(struct.pack(f'<{width}f', *sample))
    result = len(document['accessors'])
    document['accessors'].append({'bufferView': view, 'componentType': 5126, 'count': len(samples),
                                  'type': {1: 'SCALAR', 3: 'VEC3', 4: 'VEC4'}[width]})
    return result


def write_glb(path, document, binary):
    document['buffers'][0]['byteLength'] = len(binary)
    data = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    data += b' ' * (-len(data) % 4)
    header = struct.pack('<4sIIII', b'glTF', 2, 28 + len(data) + len(binary), len(data), 0x4e4f534a)
    path.write_bytes(header + data + struct.pack('<II', len(binary), 0x004e4942) + binary)


def polish_glb(source, target, duration, close_forearms, boot_lift=None):
    document, original_binary = glb(source)
    clip, channels = run_channels(document, original_binary)
    input_floor = boot_heights(document, original_binary, duration).min(axis=0) if boot_lift is not None else None
    indices = {document['nodes'][index]['name']: index for index in document['skins'][0]['joints']}
    parent_index = {child: parent for parent, node in enumerate(document['nodes']) for child in node.get('children', [])}
    times = [frame / FPS for frame in range(round(duration * FPS) + 1)]
    up = Vector((0, 1, 0))
    worlds = [sample_pose(document, channels, time) for time in times]
    before = [{name: world[index] for name, index in indices.items()} for world in worlds]
    after = (polish(before, up, close_forearms) if boot_lift is None
             else apply_boot_lift(before, up, boot_lift))
    for world, pose in zip(worlds, after):
        world.update({index: pose[name] for name, index in indices.items()})

    binary = bytearray(original_binary)
    updated = []
    time_accessor = None
    for index, source_sampler, channel in channels:
        if boot_lift is not None and not document['nodes'][index]['name'].startswith(('thigh_', 'shin_', 'foot_')):
            updated.append(source_sampler)
            continue
        field = channel[0]
        components = []
        for world in worlds:
            position, rotation, scale = (world[parent_index[index]].inverted() @ world[index]).decompose()
            if field == 'rotation':
                if components and quaternion(components[-1]).dot(rotation) < 0:
                    rotation.negate()
                components.append((rotation.x, rotation.y, rotation.z, rotation.w))
            else:
                components.append(tuple(position if field == 'translation' else scale))
        prior = [sample_trs(channel, time) for time in times]
        if field == 'rotation':
            modified = any(min((Vector(a) - Vector(b)).length, (Vector(a) + Vector(b)).length) > 1e-5
                           for a, b in zip(components, prior))
        else:
            modified = any((Vector(a) - Vector(b)).length > 1e-5 for a, b in zip(components, prior))
        if modified:
            if time_accessor is None:
                time_accessor = append_accessor(document, binary, [(time,) for time in times])
                document['accessors'][time_accessor].update({'min': [0], 'max': [times[-1]]})
            new_sampler = {'input': time_accessor, 'output': append_accessor(document, binary, components),
                           'interpolation': 'LINEAR'}
        else:
            new_sampler = source_sampler
        updated.append(new_sampler)
    # One sampler per target keeps pre-existing compressed constant accessors
    # and texture/mesh buffer views untouched, even when samplers were shared.
    clip['samplers'] = updated
    for index, channel in enumerate(clip['channels']):
        channel['sampler'] = index
    write_glb(target, document, binary)

    exported, packed = glb(target)
    _, exported_channels = run_channels(exported, packed)
    readback = [{name: pose[index] for name, index in indices.items()}
                for pose in (sample_pose(exported, exported_channels, time) for time in times)]
    maximum_error = max(difference(wanted[name], actual[name])
                        for wanted, actual in zip(after, readback) for name in indices)
    assert maximum_error < 2e-5, maximum_error
    if boot_lift is not None:
        output_floor = boot_heights(exported, packed, duration).min(axis=0)
        assert output_floor.min() > 0, (target.name, output_floor.tolist())
        return {'minSoleHeightBeforeUnits': input_floor.tolist(), 'minSoleHeightAfterUnits': output_floor.tolist(),
                'maximumExportTransformDifference': maximum_error}
    foot_error = 0
    for frame in range(4 * (len(times) - 1) + 1):
        time = frame / (4 * FPS)
        old = sample_pose(document, channels, time)
        new = sample_pose(exported, exported_channels, time)
        for side in ('L', 'R'):
            index = indices[f'foot_{side}']
            foot_error = max(foot_error, (old[index].translation - new[index].translation).length)

    def peak_vertical_acceleration(poses, bone):
        height = [pose[bone].translation.dot(up) for pose in poses[:-1]]
        return max(abs(height[(i + 1) % len(height)] - 2 * y + height[i - 1]) * FPS ** 2
                   for i, y in enumerate(height))

    def forearm_seam(poses):
        angles = []
        for side in ('L', 'R'):
            first = poses[0][f'forearm_{side}'].to_quaternion()
            last = poses[-1][f'forearm_{side}'].to_quaternion()
            angles.append(math.degrees(2 * math.acos(min(1.0, abs(first.dot(last))))))
        return max(angles)

    metrics = {'rootPeakVerticalAccelerationBefore': peak_vertical_acceleration(before, 'root'),
               'rootPeakVerticalAccelerationAfter': peak_vertical_acceleration(readback, 'root'),
               'pelvisPeakVerticalAccelerationBefore': peak_vertical_acceleration(before, 'pelvis'),
               'pelvisPeakVerticalAccelerationAfter': peak_vertical_acceleration(readback, 'pelvis')}
    if close_forearms:
        metrics.update({'maximumForearmSeamBeforeDegrees': forearm_seam(before),
                        'maximumForearmSeamAfterDegrees': forearm_seam(readback)})
    return {**metrics, 'maxBootOriginChangeAt120HzUnits': foot_error,
            'maximumExportTransformDifference': maximum_error}


def polish_blend(source, target, duration, close_forearms, boot_lift=None):
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    rig = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
    animation = rig.animation_data
    track = next(track for track in animation.nla_tracks if track.name == 'run')
    action = track.strips[0].action
    previous_action = animation.action
    track_mutes = [item.mute for item in animation.nla_tracks]
    for item in animation.nla_tracks:
        item.mute = True
    animation.action = action
    start = round(action.frame_range[0])
    times = range(start, start + round(duration * FPS) + 1)
    original = []
    for frame in times:
        scene.frame_set(frame)
        original.append({bone.name: rig.matrix_world @ bone.matrix for bone in rig.pose.bones})
    up = Vector((0, 0, 1))
    corrected = (polish(original, up, close_forearms) if boot_lift is None
                 else apply_boot_lift(original, up, boot_lift))
    inverse = rig.matrix_world.inverted()
    rotations = {}
    for frame, pose in zip(times, corrected):
        scene.frame_set(frame)
        for bone in rig.pose.bones:
            if boot_lift is not None and not bone.name.startswith(('thigh_', 'shin_', 'foot_')):
                continue
            bone.matrix = inverse @ pose[bone.name]
            if boot_lift is not None:
                rotation = bone.rotation_quaternion.copy()
                if bone.name in rotations:
                    rotation.make_compatible(rotations[bone.name])
                    bone.rotation_quaternion = rotation
                rotations[bone.name] = rotation.copy()
            bpy.context.view_layer.update()
            for field in ('location', 'rotation_quaternion', 'scale'):
                bone.keyframe_insert(data_path=field, frame=frame, group=bone.name)
    for frame, pose in zip(times, corrected):
        scene.frame_set(frame)
        maximum_error = max(difference(rig.matrix_world @ bone.matrix, pose[bone.name]) for bone in rig.pose.bones)
        assert maximum_error < 2e-5, (frame, maximum_error)
    for item, mute in zip(animation.nla_tracks, track_mutes):
        item.mute = mute
    animation.action = previous_action
    scene.frame_set(start)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(target))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--armed-donor', action='store_true', help='Polish support only for the rifle carry bake.')
    parser.add_argument('--boot-floor', action='store_true', help='Add boot floor correction to a polished Run.')
    parser.add_argument('--support-reference', action='append', default=[], type=Path,
                        help='Additional baseline GLB whose boot surface should inform the correction.')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    if args.input.resolve() == args.output.resolve():
        raise ValueError('Use a separate output directory to preserve the unpolished source.')
    manifest = json.loads((args.input / 'manifest.json').read_text(encoding='utf-8'))
    run = next(clip for clip in manifest['clips'] if clip['name'] == 'run')
    if args.boot_floor:
        if not run.get('motionPolish') or run.get('bootFloor'):
            raise ValueError('Boot floor correction needs a Run with the body polish already applied.')
    elif run.get('motionPolish'):
        raise ValueError('Input is already polished.')
    args.output.mkdir(parents=True, exist_ok=True)
    baselines = [args.input / lod['glb'] for lod in manifest['lods']]
    boot_lift = fit_boot_lift(baselines + args.support_reference, run['duration']) if args.boot_floor else None
    reports = []
    for lod in manifest['lods']:
        name = lod['glb']
        reports.append(polish_glb(args.input / name, args.output / name, run['duration'], not args.armed_donor, boot_lift))
        lod['bytes'] = (args.output / name).stat().st_size
    name = 'infantry-mixamo-rig.blend'
    polish_blend(args.input / name, args.output / name, run['duration'], not args.armed_donor, boot_lift)
    if args.boot_floor:
        key = 'bootFloor'
        run[key] = {'method': 'circular-boot-sole-clearance-v1', 'fps': FPS, 'auditHz': FPS * FLOOR_SAMPLES_PER_KEY,
                    'maximumAnkleLiftUnits': boot_lift.max(axis=0).tolist(), 'lods': reports}
    else:
        key = 'motionPolish'
        method = ('circular-support-lift-and-locked-boot-targets-v1' if args.armed_donor
                  else 'circular-support-lift-and-forearm-loop-closure-v1')
        run[key] = {'method': method, 'fps': FPS, 'lod0': reports[0]}
    (args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps(run[key], indent=2), flush=True)


if __name__ == '__main__':
    main()
