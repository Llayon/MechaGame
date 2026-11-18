"""Inventory user FBXs and cache animation-only copies without touching originals."""
import bpy, sys, json, hashlib, collections, gc
from datetime import datetime, timezone
from pathlib import Path
from io_scene_fbx import parse_fbx, encode_bin

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else Path(r'D:\Programms\Max\Assets')
DOC = ROOT / 'docs/infantry/motion-library'
CACHE = ROOT / '.tools/mixamo-user'
DOC.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)
TICKS = 46186158000

def child(element, name):
    return next((e for e in element.elems if e.id == name), None)

def properties(element):
    props = child(element, b'Properties70')
    return {p.props[0].decode(): p.props[4:] for p in props.elems} if props else {}

methods = {ord(k): v for k, v in {
    'B': 'add_bool', 'C': 'add_char', 'Z': 'add_int8', 'Y': 'add_int16', 'I': 'add_int32',
    'L': 'add_int64', 'F': 'add_float32', 'D': 'add_float64', 'S': 'add_string', 'R': 'add_bytes',
    'f': 'add_float32_array', 'd': 'add_float64_array', 'l': 'add_int64_array',
    'i': 'add_int32_array', 'b': 'add_bool_array', 'c': 'add_byte_array'}.items()}

def encoded(element):
    result = encode_bin.FBXElem(element.id)
    for kind, value in zip(element.props_type, element.props):
        getattr(result, methods[kind])(value)
    result.elems = [encoded(e) for e in element.elems]
    return result

previous = json.loads((DOC / 'catalog.json').read_text()) if (DOC / 'catalog.json').exists() else {'records': []}
previous = {r['file']: r for r in previous['records']}
started = datetime.now(timezone.utc).isoformat()
records = []
for file in sorted(SOURCE.glob('*.fbx')):
    raw = file.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    cached = CACHE / f'{sha}.fbx'
    if file.name in previous and previous[file.name]['sha256'] == sha and cached.exists() and previous[file.name].get('motionCurveSha256'):
        record = previous[file.name]
        record['animationOnlySha256'] = hashlib.sha256(cached.read_bytes()).hexdigest()
        records.append(record)
        del raw
        continue
    root, version = parse_fbx.parse(str(file))
    objects = child(root, b'Objects')
    bones = [e for e in objects.elems if e.id == b'Model' and e.props[2] == b'LimbNode']
    stacks = [e for e in objects.elems if e.id == b'AnimationStack']
    curves = [e for e in objects.elems if e.id == b'AnimationCurve']
    times = [t for curve in curves for t in child(curve, b'KeyTime').props[0]]
    links = child(root, b'Connections').elems
    model_names = {e.props[0]: e.props[1].split(b'\x00')[0] for e in objects.elems if e.id == b'Model'}
    curve_nodes = {e.props[1]: (e.props[2], e.props[3]) for e in links if len(e.props) > 3 and e.props[2] in model_names}
    curve_links = {e.props[1]: (e.props[2], e.props[3]) for e in links if len(e.props) > 3 and e.props[2] in curve_nodes}
    fingerprint = hashlib.sha256()
    channel_records = []
    for curve in curves:
        if curve.props[0] not in curve_links:
            continue  # Non-skeletal/custom-property curves are not motion identity.
        node, axis = curve_links[curve.props[0]]
        model, transform = curve_nodes[node]
        channel_records.append((model_names[model] + b'/' + transform + b'/' + axis,
                                child(curve, b'KeyTime').props[0].tobytes(),
                                child(curve, b'KeyValueFloat').props[0].tobytes()))
    for label, key_times, values in sorted(channel_records):
        fingerprint.update(label + b'\x00' + key_times + values)
    record = {'file': file.name, 'bytes': len(raw), 'sha256': sha, 'fbxVersion': version,
              'bones': len(bones), 'boneNamespace': sorted(set(b.props[1].split(b'\x00')[0].decode().split(':')[0] for b in bones)),
              'stacks': [{'name': s.props[1].split(b'\x00')[0].decode(),
                          'properties': properties(s)} for s in stacks],
              'animationCurves': len(curves), 'keyCount': len(times),
              'startSeconds': min(times) / TICKS if times else None,
              'endSeconds': max(times) / TICKS if times else None,
              'duration': (max(times) - min(times)) / TICKS if times else 0,
              'motionCurveSha256': fingerprint.hexdigest(),
              'meshObjects': sum(e.id == b'Model' and e.props[2] == b'Mesh' for e in objects.elems)}
    # Keep skeleton node attributes, all animation data and bind poses. Discard
    # donor meshes, skin clusters, materials, images and embedded media entirely.
    objects.elems[:] = [e for e in objects.elems if e.id.startswith(b'Animation') or e.id == b'Pose' or
                       (e.id == b'Model' and e.props[2] in [b'LimbNode', b'Null', b'Root']) or
                       (e.id == b'NodeAttribute' and e.props[2] == b'LimbNode')]
    retained = {e.props[0] for e in objects.elems}
    connections = child(root, b'Connections')
    connections.elems[:] = [e for e in connections.elems if e.props[1] in retained and e.props[2] in retained | {0}]
    root.elems[:] = [e for e in root.elems if e.id not in [b'Definitions', b'References']]
    path = CACHE / f'{sha}.fbx'
    if times and bones:
        encode_bin.write(str(path), encoded(root), version)
        record['animationOnlyBytes'] = path.stat().st_size
        record['animationOnlySha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        record['cache'] = path.relative_to(ROOT).as_posix()
    records.append(record)
    print('AUDITED', file.name, record['bones'], round(record['duration'], 3), record.get('animationOnlyBytes'), flush=True)
    del root, objects, curves, bones, stacks, raw, times
    gc.collect()
groups = collections.defaultdict(list)
for record in records:
    groups[record['sha256']].append(record['file'])
report = {'createdAt': started, 'sourceDirectory': str(SOURCE), 'files': len(records), 'uniqueFiles': len(groups),
          'totalSourceBytes': sum(r['bytes'] for r in records),
          'totalAnimationOnlyBytes': sum(r.get('animationOnlyBytes', 0) for r in records),
          'exactDuplicates': [names for names in groups.values() if len(names) > 1], 'records': records}
motion_groups = collections.defaultdict(list)
for record in records:
    motion_groups[record['motionCurveSha256']].append(record['file'])
report['uniqueMotions'] = len(motion_groups)
report['duplicateMotionCurves'] = [names for names in motion_groups.values() if len(names) > 1]
report['newFilesSinceSnapshot'] = sorted(p.name for p in SOURCE.glob('*.fbx') if p.name not in {r['file'] for r in records})
(DOC / 'catalog.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('MOTION_CATALOG=' + json.dumps({k: v for k, v in report.items() if k != 'records'}))
