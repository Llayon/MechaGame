"""Verify GLB playback and the RGBA16F skin atlas agree at every sample."""
import bisect
import json
import math
import os
import struct
import sys
from pathlib import Path

from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "public/assets"
OUT = Path(os.environ.get("VPULSE_RIG_OUT", ASSETS / "infantry-armed"))
RUN_PHASE_INTERVALS = 1024
# Leave room for GPU float32 arithmetic when classifying contact at y = 0.
FLOOR_TOLERANCE = 1e-6


def glb(path):
    raw = path.read_bytes()
    size = struct.unpack_from("<I", raw, 12)[0]
    return json.loads(raw[20:20 + size]), raw[28 + size:]


def accessor(document, binary, index, width):
    spec = document["accessors"][index]
    view = document["bufferViews"][spec["bufferView"]]
    value_type = {5121: "B", 5123: "H", 5126: "f"}[spec["componentType"]]
    start = view.get("byteOffset", 0) + spec.get("byteOffset", 0)
    unpacker = struct.Struct(f"<{width}{value_type}")
    stride = view.get("byteStride", unpacker.size)
    assert not spec.get("normalized", False), "Expected raw joint indices or floating-point weights"
    return [unpacker.unpack_from(binary, start + i * stride) for i in range(spec["count"])]


def matrix_from_array(values):
    return Matrix([values[i:i + 4] for i in range(0, 16, 4)]).transposed()


def quaternion(values):
    x, y, z, w = values
    return Quaternion((w, x, y, z)).normalized()


def node_trs(values):
    return Matrix.LocRotScale(
        Vector(values.get("translation", (0, 0, 0))),
        quaternion(values.get("rotation", (0, 0, 0, 1))),
        Vector(values.get("scale", (1, 1, 1))),
    )


def difference(a, b):
    return max(abs(a[i][j] - b[i][j]) for i in range(4) for j in range(4))


def sample_trs(channel, seconds):
    prop, interpolation, times, values = channel
    high = bisect.bisect_left(times, seconds)
    if high <= 0 or len(times) == 1:
        return values[0]
    if high >= len(times):
        return values[-1]
    low = high - 1
    if interpolation == "STEP":
        return values[low]
    assert interpolation == "LINEAR"
    phase = (seconds - times[low]) / (times[high] - times[low])
    if prop == "rotation":
        q = quaternion(values[low]).slerp(quaternion(values[high]), phase)
        return (q.x, q.y, q.z, q.w)
    return Vector(values[low]).lerp(Vector(values[high]), phase)


def world_pose(document, properties):
    worlds = {}

    def visit(index, parent):
        node = document["nodes"][index]
        local = matrix_from_array(node["matrix"]) if "matrix" in node else node_trs(properties[index])
        worlds[index] = parent @ local
        for child in node.get("children", []):
            visit(child, worlds[index])

    for root in document["scenes"][document.get("scene", 0)]["nodes"]:
        visit(root, Matrix.Identity(4))
    return worlds


def animation_worlds(document, channels, seconds):
    properties = [dict(node) for node in document["nodes"]]
    for index, channel in channels:
        properties[index][channel[0]] = sample_trs(channel, seconds)
    return world_pose(document, properties)


def atlas_row(atlas, binary, frame):
    result = {}
    for i, name in enumerate(atlas["bones"]):
        x, y, z, w, tx, ty, tz, unused = struct.unpack_from("<8e", binary, (frame * len(atlas["bones"]) + i) * 16)
        assert all(math.isfinite(n) for n in (x, y, z, w, tx, ty, tz, unused))
        # Keep the half-float quaternion raw until after interpolation, just as infantryBone does.
        result[name] = (Quaternion((w, x, y, z)), Vector((tx, ty, tz)))
    return result


def atlas_pose(rows, frame):
    first = int(frame)
    second = min(first + 1, len(rows) - 1)
    amount = frame - first
    result = {}
    for name, (qa, ta) in rows[first].items():
        qb, tb = rows[second][name]
        if qa.dot(qb) < 0:
            qb = -qb
        q = (qa * (1 - amount) + qb * amount).normalized()
        result[name] = Matrix.LocRotScale(ta.lerp(tb, amount), q, Vector((1, 1, 1)))
    return result


def boot_vertices(document, binary, primitive, skin):
    attributes = primitive["attributes"]
    positions = accessor(document, binary, attributes["POSITION"], 3)
    weights = accessor(document, binary, attributes["WEIGHTS_0"], 4)
    indices = accessor(document, binary, attributes["JOINTS_0"], 4)
    names = [document["nodes"][joint]["name"] for joint in skin["joints"]]
    # A wider band than the sole itself also picks up the toe and heel as the boot rolls.
    return [(point, [(names[j], w) for j, w in zip(joints, values) if w > .00001])
            for point, joints, values in zip(positions, indices, weights) if point[1] <= .10]


def minimum_boot_height(vertices, transforms):
    y_rows = {name: tuple(delta[1]) for name, delta in transforms.items()}
    minimum = math.inf
    for (x, y, z), influences in vertices:
        height = 0
        for name, weight in influences:
            a, b, c, translation = y_rows[name]
            height += (a * x + b * y + c * z + translation) * weight
        minimum = min(minimum, height)
    return minimum


def run_floor(atlas, rows, clip, document, channels, joints, inverse_binds, vertices):
    playback = {name: {"minimumUnits": math.inf, "phaseAtMinimum": 0, "penetratingSamples": 0}
                for name in ("gltf", "gpuAtlas")}
    for step in range(RUN_PHASE_INTERVALS + 1):
        phase = step / RUN_PHASE_INTERVALS
        worlds = animation_worlds(document, channels, phase * clip["duration"])
        gltf = {name: worlds[index] @ inverse_binds[name] for name, index in joints.items()}
        gpu = atlas_pose(rows, phase * (len(rows) - 1))
        for name, transforms in (("gltf", gltf), ("gpuAtlas", gpu)):
            sample = playback[name]
            height = minimum_boot_height(vertices, transforms)
            if height < sample["minimumUnits"]:
                sample["minimumUnits"] = height
                sample["phaseAtMinimum"] = phase
            if height < -FLOOR_TOLERANCE:
                sample["penetratingSamples"] += 1
    for sample in playback.values():
        sample["minimumMillimeters"] = sample["minimumUnits"] * atlas["metersPerUnit"] * 1000
    return {"samples": RUN_PHASE_INTERVALS + 1, "bootVertices": len(vertices), "groundY": 0,
            "toleranceUnits": FLOOR_TOLERANCE, **playback}


def main():
    atlas = json.loads((OUT / "animation.json").read_text(encoding="utf-8"))
    atlas_data = (OUT / "animation.rgba16f").read_bytes()
    assert atlas["width"] == len(atlas["bones"]) * 2
    assert len(atlas_data) == atlas["heightTexels"] * atlas["width"] * 8 == atlas["byteLength"]
    clip_rows = {clip["name"]: [atlas_row(atlas, atlas_data, clip["offset"] + step)
                               for step in range(clip["frames"])] for clip in atlas["clips"]}
    rifle, _ = glb(ASSETS / "infantry-vpulse/v-pulse.glb")
    socket = next(node for node in rifle["nodes"] if node["name"] == "grip_left")
    support = matrix_from_array(socket["matrix"]).translation if "matrix" in socket else Vector(socket["translation"])
    right_mount = node_trs({"translation": atlas["weaponGrip"]["position"], "rotation": atlas["weaponGrip"]["quaternion"]})
    left_palm = Vector(atlas["supportGrip"]["position"])
    report = []
    floor_report = []
    for lod, count in enumerate((3999, 1999, 999)):
        document, binary = glb(OUT / f"infantry-demo-lod{lod}.glb")
        assert len(document["meshes"]) == len(document["skins"]) == 1
        skin = document["skins"][0]
        primitive = document["meshes"][0]["primitives"][0]
        assert document["accessors"][primitive["indices"]]["count"] == count * 3
        inverse_binds = {}
        joints = {}
        for joint, values in zip(skin["joints"], accessor(document, binary, skin["inverseBindMatrices"], 16)):
            name = document["nodes"][joint]["name"]
            joints[name] = joint
            inverse_binds[name] = matrix_from_array(values)
        assert set(joints) == set(atlas["bones"]) and len(joints) == 18
        gltf_error = 0
        support_error = 0
        for clip in atlas["clips"]:
            rows = clip_rows[clip["name"]]
            animation = next(clip_data for clip_data in document["animations"] if clip_data["name"] == clip["name"])
            channels = []
            for channel in animation["channels"]:
                target = channel["target"]
                prop = target["path"]
                sampler = animation["samplers"][channel["sampler"]]
                times = [value[0] for value in accessor(document, binary, sampler["input"], 1)]
                values = accessor(document, binary, sampler["output"], 4 if prop == "rotation" else 3)
                channels.append((target["node"], (prop, sampler.get("interpolation", "LINEAR"), times, values)))
            end = max(channel[1][2][-1] for channel in channels)
            assert math.isclose(end, clip["duration"], abs_tol=1e-5), (clip["name"], end)
            for step in range(clip["frames"]):
                time = clip["duration"] * step / (clip["frames"] - 1) if clip["frames"] > 1 else 0
                worlds = animation_worlds(document, channels, time)
                decoded = atlas_pose(rows, step)
                for name, index in joints.items():
                    actual_delta = worlds[index] @ inverse_binds[name]
                    gltf_error = max(gltf_error, difference(actual_delta, decoded[name]))
                equipped = worlds[joints["hand_R"]] @ right_mount
                support_error = max(support_error, ((equipped @ support) - (worlds[joints["hand_L"]] @ left_palm)).length)
            if clip["name"] == "run":
                boots = boot_vertices(document, binary, primitive, skin)
                floor = run_floor(atlas, rows, clip, document, channels, joints, inverse_binds, boots)
                floor_report.append({"lod": lod, **floor})
        assert gltf_error < .0018 and support_error < .0001, (lod, gltf_error, support_error)
        report.append({"lod": lod, "maxHalfFloatMatrixDifference": gltf_error, "maxExportedSupportDistance": support_error})
    print("V-Pulse packing verified: " + json.dumps(report), flush=True)
    print("V-Pulse Run boot clearance: " + json.dumps(floor_report), flush=True)
    if "--require-run-clearance" in sys.argv:
        if len(floor_report) != 3:
            raise AssertionError("Run floor check requires a Run clip on all three LODs")
        penetrations = [(entry["lod"], mode, round(entry[mode]["minimumMillimeters"], 3))
                        for entry in floor_report for mode in ("gltf", "gpuAtlas")
                        if entry[mode]["penetratingSamples"] > 0]
        assert not penetrations, f"Run floor penetrations (LOD, playback, mm): {penetrations}"
    path = OUT / "rig-verification.json"
    previous = json.loads(path.read_text(encoding="utf-8"))
    path.write_text(json.dumps({**previous, "glbAtlasPlayback": report, "runBootClearance": floor_report}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
