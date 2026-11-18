"""Inspect candidate motion trajectories using actual Blender FBX imports."""
import bpy, json, math
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
catalog = json.loads((ROOT / 'docs/infantry/motion-library/catalog.json').read_text())
names = ['Crouch Stop Walking.fbx', 'Crouch Walking.fbx', 'Rifle Crouch Walk.fbx',
         'Rifle Crouch Idle To Walk.fbx', 'Jump Up.fbx', 'Pistol Jump.fbx', 'Backward Jump.fbx',
         'Crouch Rapid Fire.fbx', 'Rifle Idle.fbx', 'Pistol Kneeling Idle.fbx', 'Idle Crouching.fbx']
results = []
for name in names:
    row = next(r for r in catalog['records'] if r['file'] == name)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    bpy.context.scene.render.fps = 30
    bpy.ops.import_scene.fbx(filepath=str(ROOT / row['cache']), use_image_search=False)
    rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    assert len(rigs) == 1
    rig = rigs[0]
    assert not any(o.type == 'MESH' for o in bpy.context.scene.objects)
    action = rig.animation_data.action
    begin, end = action.frame_range
    bones = {b.name.split(':')[-1]: b for b in rig.data.bones}
    rest = {n: list((rig.matrix_world @ b.matrix_local).translation) for n, b in bones.items() if n in ['Hips', 'LeftFoot', 'RightFoot']}
    samples = []
    for i in range(9):
        frame = begin + (end - begin) * i / 8
        bpy.context.scene.frame_set(math.floor(frame), subframe=frame - math.floor(frame))
        samples.append({'frame': frame, **{n: list((rig.matrix_world @ rig.pose.bones[bones[n].name].matrix).translation)
                        for n in ['Hips', 'LeftFoot', 'RightFoot', 'LeftLeg', 'RightLeg']}})
    results.append({'file': name, 'sha256': row['sha256'], 'action': action.name, 'frameRange': [begin, end],
                    'bones': len(bones), 'objectScale': list(rig.scale), 'rest': rest, 'samples': samples})
    print('INSPECTED', name, flush=True)
(ROOT / 'docs/infantry/motion-library/candidate-trajectories.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print('CANDIDATES=' + json.dumps([{'file': r['file'], 'frames': r['frameRange'],
       'hipHeight': [round(s['Hips'][2], 3) for s in r['samples']],
       'footHeight': [[round(s[n][2], 3) for n in ['LeftFoot', 'RightFoot']] for s in r['samples']]} for r in results]))
