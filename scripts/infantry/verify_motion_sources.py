"""Prove stripped FBXs retain original skeleton and sampled animation transforms."""
import bpy, json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/infantry/motion-library'
catalog = json.loads((DOC / 'catalog.json').read_text())
selection = json.loads((DOC / 'selection.json').read_text())

def inspect(path, frames):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.data.orphans_purge(do_recursive=True)
    bpy.context.scene.render.fps = 30
    bpy.ops.import_scene.fbx(filepath=str(path), use_image_search=False)
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    rest = {b.name: rig.matrix_world @ b.matrix_local for b in rig.data.bones}
    samples = []
    for frame in frames:
        bpy.context.scene.frame_set(math.floor(frame), subframe=frame - math.floor(frame))
        samples.append({b.name: (rig.matrix_world @ b.matrix).copy() for b in rig.pose.bones})
    return {'rest': rest, 'samples': samples, 'meshes': sum(o.type == 'MESH' for o in bpy.context.scene.objects)}

reports = []
for source in selection['sources']:
    clip = next(c for c in selection['clips'] if c['sourceSha256'] == source['originalSha256'])
    begin, end = clip['sourceFrames']
    frames = [begin, (begin + end) / 2, end]
    original = inspect(Path(catalog['sourceDirectory']) / source['file'], frames)
    trimmed = inspect(ROOT / source['asset'], frames)
    assert set(original['rest']) == set(trimmed['rest'])
    assert original['meshes'] > 0 and trimmed['meshes'] == 0
    rest_error = max(abs(original['rest'][n][i][j] - trimmed['rest'][n][i][j])
                     for n in original['rest'] for i in range(4) for j in range(4))
    pose_error = max(abs(a[n][i][j] - b[n][i][j]) for a, b in zip(original['samples'], trimmed['samples'])
                     for n in a for i in range(4) for j in range(4))
    assert rest_error < .0001 and pose_error < .0001, (source['file'], rest_error, pose_error)
    reports.append({'file': source['file'], 'originalMeshes': original['meshes'], 'animationOnlyMeshes': 0,
                    'bones': len(original['rest']), 'maximumRestMatrixDifference': rest_error,
                    'maximumSampledPoseMatrixDifference': pose_error, 'sampledSourceFrames': frames})
report = {'passed': True, 'blender': bpy.app.version_string, 'sources': reports,
          'scope': 'Neutral skeleton matrices and three sampled frames per source, not exhaustive visual certification'}
(DOC / 'source-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('SOURCE_VERIFY=' + json.dumps(report))
