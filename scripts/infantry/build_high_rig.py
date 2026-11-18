"""Bind the original 40k candidate to the fitted Rigify and bake a hero GLB.

Run with Blender 5.2 from the repository root. The armed .blend provides
editable control actions and the rifle attachment. LOD0 provides a reference
for skin weights. The 40k mesh comes directly from the archived source GLB.
"""
import hashlib
import json
import math
import os
import struct
import sys
from collections import Counter, defaultdict
from pathlib import Path

import addon_utils
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_armed_rigify as armed
from build_armed_verify import node_trs, sample_trs, world_pose

ASSETS = ROOT / "public/assets"
SOURCE = ASSETS / "infantry-candidate/source.glb"
ARMED = Path(os.environ.get("VPULSE_RIG_OUT", ASSETS / "infantry-armed"))
OUTPUT = ASSETS / "infantry-candidate/high-rig"
HEIGHT = .48
TRIANGLES = 40_000
SOURCE_SHA = "dd369a254695aa41508a48bfff1cecd3d713bb7c846085ad3a53c2dd31a15228"


def import_normalized_source(scene):
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    added = set(scene.objects) - before
    candidates = [obj for obj in added if obj.type == "MESH"]
    assert len(candidates) == 1
    mesh = candidates[0]
    transform = mesh.matrix_world.copy()
    # Match the normalization used to fit the reference rig.
    assert min(transform.to_quaternion().angle, math.tau - transform.to_quaternion().angle) < 1e-6
    coords = [transform @ vertex.co for vertex in mesh.data.vertices]
    lo = Vector([min(p[k] for p in coords) for k in range(3)])
    hi = Vector([max(p[k] for p in coords) for k in range(3)])
    center = Vector(((lo.x + hi.x) * .5, (lo.y + hi.y) * .5, lo.z))
    scale = HEIGHT / (hi.z - lo.z)
    for vertex, point in zip(mesh.data.vertices, coords):
        vertex.co = (point - center) * scale
    mesh.parent = None
    mesh.matrix_world = Matrix.Identity(4)
    mesh.data.update()
    for node in added - {mesh}:
        bpy.data.objects.remove(node, do_unlink=True)
    mesh.data.calc_loop_triangles()
    assert len(mesh.data.loop_triangles) == TRIANGLES
    return mesh


def barycentric(point, a, b, c):
    ab, ac, ap = b - a, c - a, point - a
    dot_ab = ab.dot(ab)
    dot_ac = ac.dot(ac)
    cross = ab.dot(ac)
    denom = dot_ab * dot_ac - cross * cross
    if abs(denom) < 1e-20:
        nearest = min(range(3), key=lambda i: ((a, b, c)[i] - point).length_squared)
        return tuple(float(i == nearest) for i in range(3))
    u = (dot_ac * ap.dot(ab) - cross * ap.dot(ac)) / denom
    v = (dot_ab * ap.dot(ac) - cross * ap.dot(ab)) / denom
    coeffs = [max(0, 1 - u - v), max(0, u), max(0, v)]
    return [coef / sum(coeffs) for coef in coeffs]


def transfer_weights(mesh, reference, rig):
    names = {group.index: group.name for group in reference.vertex_groups}
    skeleton_groups = set(armed.BODY.values())
    assert set(names.values()) <= skeleton_groups
    for name in names.values():
        mesh.vertex_groups.new(name=name)
    vertices = [vertex.co.copy() for vertex in reference.data.vertices]
    triangles = [tuple(face.vertices) for face in reference.data.polygons]
    assert all(len(triangle) == 3 for triangle in triangles)
    weights = [[(names[group.group], group.weight) for group in v.groups]
               for v in reference.data.vertices]
    assert all(parts for parts in weights)
    tree = BVHTree.FromPolygons(vertices, triangles, all_triangles=True)
    cache = {}
    counts = Counter()
    distances = []
    lost_weights = []
    for vertex in mesh.data.vertices:
        # Weld weights across render-vertex seams without changing the topology.
        key = tuple(round(value / 1e-7) for value in vertex.co)
        if key not in cache:
            nearest, _, triangle_index, separation = tree.find_nearest(vertex.co)
            assert nearest is not None and math.isfinite(separation)
            triangle = triangles[triangle_index]
            fractions = barycentric(nearest, *(vertices[index] for index in triangle))
            interpolated = defaultdict(float)
            for index, fraction in zip(triangle, fractions):
                for part, weight in weights[index]:
                    interpolated[part] += weight * fraction
            ordered = sorted(interpolated.items(), key=lambda pair: (-pair[1], pair[0]))
            kept = [(part, weight) for part, weight in ordered[:4] if weight > 1e-6]
            total = sum(weight for _, weight in kept)
            assert total > 0
            cache[key] = [(part, weight / total) for part, weight in kept]
            distances.append(separation)
            lost_weights.append(sum(weight for _, weight in ordered) - total)
        assignment = cache[key]
        counts[len(assignment)] += 1
        for part, weight in assignment:
            mesh.vertex_groups[part].add([vertex.index], weight, "REPLACE")
    assert max(distances) < .01, "Unexpected offset from the fitted reference mesh"
    assert max(lost_weights) < .025, "Reference skin needs more than four meaningful influences"
    assert all(1 <= len(v.groups) <= 4 and abs(sum(g.weight for g in v.groups) - 1) < 1e-6
               for v in mesh.data.vertices)
    modifier = mesh.modifiers.new("Rigify 40k deformation", "ARMATURE")
    modifier.object = rig
    mesh.parent = rig
    mesh.matrix_parent_inverse = Matrix.Identity(4)
    mesh.matrix_basis = Matrix.Identity(4)
    sorted_distances = sorted(distances)
    return {"vertices": len(mesh.data.vertices), "coincidentVertices": len(mesh.data.vertices) - len(cache),
            "influencesByVertex": dict(counts), "maximumDiscardedWeight": max(lost_weights),
            "transferDistanceP95GameUnits": sorted_distances[int(len(sorted_distances) * .95)],
            "transferDistanceMaxGameUnits": max(distances)}


def export_mesh(scene, compact, high, filename):
    clone = high.copy()
    clone.data = high.data.copy()
    clone.name = "DemoInfantry"
    scene.collection.objects.link(clone)
    clone.parent = compact
    for group in clone.vertex_groups:
        group.name = next(name for name, deform in armed.BODY.items() if deform == group.name)
    clone.modifiers[0].object = compact
    armed.select_active(compact)
    clone.select_set(True)
    for track in compact.animation_data.nla_tracks:
        track.mute = False
    armed.frame_set(scene, 0)
    bpy.ops.export_scene.gltf(filepath=str(filename), export_format="GLB", use_selection=True,
                              export_skins=True, export_animations=True, export_animation_mode="NLA_TRACKS",
                              export_rest_position_armature=True)
    bpy.data.objects.remove(clone, do_unlink=True)


def texture_digests(document, binary):
    material = document["materials"][0]["pbrMetallicRoughness"]
    hashes = {}
    for role in ("baseColorTexture", "metallicRoughnessTexture"):
        image = document["images"][document["textures"][material[role]["index"]]["source"]]
        view = document["bufferViews"][image["bufferView"]]
        start = view.get("byteOffset", 0)
        payload = binary[start:start + view["byteLength"]]
        hashes[role] = hashlib.sha256(payload).hexdigest()
    return hashes


def triangle_indices(document, binary, index):
    accessor = document["accessors"][index]
    view = document["bufferViews"][accessor["bufferView"]]
    fmt = {5121: "B", 5123: "H", 5125: "I"}[accessor["componentType"]]
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", struct.calcsize(fmt))
    return [struct.unpack_from("<" + fmt, binary, start + i * stride)[0] for i in range(accessor["count"])]


def compare_surface(original, original_binary, exported, exported_binary):
    # The glTF exporter may split vertices when skin weights change at corners.
    # Compare indexed triangle corners, independent of exporter vertex ordering.
    meshes = [doc["meshes"][0]["primitives"][0] for doc in (original, exported)]
    coordinates, uvs, normals, indices = [], [], [], []
    for doc, binary, mesh in zip((original, exported), (original_binary, exported_binary), meshes):
        attributes = mesh["attributes"]
        coordinates.append([Vector(v) for v in armed.accessor(doc, binary, attributes["POSITION"], 3)])
        uvs.append(armed.accessor(doc, binary, attributes["TEXCOORD_0"], 2))
        normals.append(armed.accessor(doc, binary, attributes["NORMAL"], 3))
        indices.append(triangle_indices(doc, binary, mesh["indices"]))
    old_positions, new_positions = coordinates
    low = Vector([min(p[i] for p in old_positions) for i in range(3)])
    high = Vector([max(p[i] for p in old_positions) for i in range(3)])
    center = Vector(((low.x + high.x) * .5, low.y, (low.z + high.z) * .5))
    scale = HEIGHT / (high.y - low.y)
    normalized = [(point - center) * scale for point in old_positions]
    tree = KDTree(len(normalized))
    for i, point in enumerate(normalized):
        tree.insert(point, i)
    tree.balance()
    aliases = {}
    original_keys = []
    for point, uv in zip(normalized, uvs[0]):
        corner = tuple(point) + uv
        original_keys.append(aliases.setdefault(corner, len(aliases)))
    mapping = []
    position_error, uv_error, normal_error = 0, 0, 0
    for point, uv, normal in zip(new_positions, uvs[1], normals[1]):
        matched = [(coord, i, distance) for coord, i, distance in tree.find_range(point, 3e-7)
                   if max(abs(a - b) for a, b in zip(uv, uvs[0][i])) < 3e-7]
        assert matched, (point, uv)
        _, closest, error = min(matched, key=lambda hit: sum((a - b) ** 2 for a, b in zip(uv, uvs[0][hit[1]]))
                                                    + hit[2] ** 2)
        candidates = [normals[0][i] for _, i, _ in matched if original_keys[i] == original_keys[closest]]
        normal_error = max(normal_error, min((Vector(n) - Vector(normal)).length for n in candidates))
        position_error = max(position_error, error)
        uv_error = max(uv_error, max(abs(a - b) for a, b in zip(uv, uvs[0][closest])))
        mapping.append(original_keys[closest])

    def triangle_multiset(buffer, keys):
        triangles = Counter()
        for offset in range(0, len(buffer), 3):
            a, b, c = (keys[vertex] for vertex in buffer[offset:offset + 3])
            triangles[min((a, b, c), (b, c, a), (c, a, b))] += 1
        return triangles

    assert triangle_multiset(indices[0], original_keys) == triangle_multiset(indices[1], mapping)
    # Blender encodes custom split normals in its mesh representation. A
    # GLB round trip can shift their direction slightly without changing faces.
    assert normal_error < .01, f"Source normal mismatch: {normal_error}"
    return {"triangleCornersPreserved": TRIANGLES * 3, "maxNormalizedPositionError": position_error,
            "maxUVError": uv_error, "maxNormalVectorError": normal_error,
            "maxNormalAngleDegrees": math.degrees(2 * math.asin(normal_error / 2))}


def animation_channels(document, binary, animation):
    result = []
    for channel in animation["channels"]:
        target = channel["target"]
        prop = target["path"]
        sample = animation["samplers"][channel["sampler"]]
        times = [item[0] for item in armed.accessor(document, binary, sample["input"], 1)]
        values = armed.accessor(document, binary, sample["output"], 4 if prop == "rotation" else 3)
        result.append((target["node"], (prop, sample.get("interpolation", "LINEAR"), times, values)))
    return result


def verify_export(filename, manifest):
    document, binary = armed.glb(filename)
    original, original_binary = armed.glb(SOURCE)
    assert len(document["meshes"]) == len(document["skins"]) == len(document["materials"]) == 1
    assert len(document["meshes"][0]["primitives"]) == 1
    primitive = document["meshes"][0]["primitives"][0]
    assert document["accessors"][primitive["indices"]]["count"] == TRIANGLES * 3
    position = document["accessors"][primitive["attributes"]["POSITION"]]
    assert abs(position["max"][1] - HEIGHT) < 1e-6 and abs(position["min"][1]) < 1e-6
    maps = texture_digests(document, binary)
    assert maps == texture_digests(original, original_binary), "Original material contents changed"
    surface = compare_surface(original, original_binary, document, binary)
    bind = armed.bind_matrices(filename)
    reference_bind = armed.bind_matrices(ARMED / "infantry-demo-lod0.glb")
    bind_error = max(armed.matrix_error(bind[n], reference_bind[n]) for n in bind)
    assert bind_error < 1e-5
    skin = document["skins"][0]
    joints = {document["nodes"][index]["name"]: index for index in skin["joints"]}
    right = manifest["weaponGrip"]
    right_mount = node_trs({"translation": right["position"], "rotation": right["quaternion"]})
    left_palm = Vector(manifest["supportGrip"]["position"])
    support = armed.weapon_support()
    max_gap = 0
    samples = 0
    assert set(animation["name"] for animation in document["animations"]) == set(
        clip["name"] for clip in manifest["clips"])
    for clip in manifest["clips"]:
        animation = next(candidate for candidate in document["animations"] if candidate["name"] == clip["name"])
        channels = animation_channels(document, binary, animation)
        start = min(channel[1][2][0] for channel in channels)
        end = max(channel[1][2][-1] for channel in channels)
        assert abs(start) < 1e-6 and abs(end - clip["duration"]) < 1e-5
        frames = round(clip["duration"] * armed.MOVEMENT_FPS)
        for frame in range(frames + 1):
            seconds = frame / armed.MOVEMENT_FPS
            properties = [dict(node) for node in document["nodes"]]
            for index, channel in channels:
                properties[index][channel[0]] = sample_trs(channel, seconds)
            nodes = world_pose(document, properties)
            actual_grip = nodes[joints["hand_R"]] @ right_mount @ support
            actual_palm = nodes[joints["hand_L"]] @ left_palm
            max_gap = max(max_gap, (actual_grip - actual_palm).length)
            samples += 1
    assert max_gap < .0001
    return {"triangles": TRIANGLES, "vertices": position["count"], "bones": len(bind),
            "gameHeight": position["max"][1] - position["min"][1],
            "textureSha256": maps, "maximumBindMatrixDifference": bind_error,
            "checkedFrames": samples, "maximumSupportGapGameUnits": max_gap, "surface": surface}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA
    addon_utils.enable("rigify", default_set=True, persistent=False)
    bpy.ops.wm.open_mainfile(filepath=str(ARMED / "infantry-vpulse.blend"))
    scene = bpy.context.scene
    rig = bpy.data.objects["Infantry_Rigify"]
    scene.render.fps = armed.MOVEMENT_FPS
    armed.select_active(rig)
    reference = bpy.data.objects["Infantry_LOD0"]
    high = import_normalized_source(scene)
    high.name = "Infantry_Source_40k"
    transfer = transfer_weights(high, reference, rig)
    source_manifest = json.loads((ARMED / "manifest.json").read_text(encoding="utf-8"))
    clips = source_manifest["clips"]
    actions = {clip["name"]: bpy.data.actions["VPulse_" + clip["name"]] for clip in clips}
    compact = armed.new_compact(scene, rig)
    armed.bake_actions(scene, rig, compact, clips, actions, reference)
    filename = OUTPUT / "infantry-high.glb"
    export_mesh(scene, compact, high, filename)
    report = verify_export(filename, source_manifest)
    for obj in [compact] + [bpy.data.objects[f"Infantry_LOD{level}"] for level in range(3)]:
        bpy.data.objects.remove(obj, do_unlink=True)
    rig.animation_data.action = actions["idle"]
    scene.frame_start, scene.frame_end = 0, round(clips[0]["duration"] * armed.MOVEMENT_FPS)
    armed.frame_set(scene, 0)
    armed.select_active(rig)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.outliner.orphans_purge(do_recursive=True)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / "infantry-high.blend"))
    manifest = {
        "schemaVersion": 1, "height": HEIGHT, "metersPerUnit": 3.75, "forward": "+Z",
        "weaponGrip": source_manifest["weaponGrip"], "supportGrip": source_manifest["supportGrip"],
        "clips": clips, "model": filename.name, "authoringFile": "infantry-high.blend",
        "sourceSha256": SOURCE_SHA, "triangles": TRIANGLES, "bones": len(armed.BODY),
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (OUTPUT / "rig-verification.json").write_text(json.dumps({
        **report, "weightTransfer": transfer, "sourceSha256": SOURCE_SHA,
        "controlBones": len(rig.data.bones), "bytes": filename.stat().st_size,
        "armedReferenceSha256": hashlib.sha256((ARMED / "infantry-demo-lod0.glb").read_bytes()).hexdigest(),
    }, indent=2), encoding="utf-8")
    print("HIGH RIG VERIFIED", json.dumps({**report, "weightTransfer": transfer}), flush=True)


if __name__ == "__main__":
    main()
