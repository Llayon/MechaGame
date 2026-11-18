"""Verify GLB playback and the RGBA16F skin atlas agree at every sample."""
import bisect
import json
import math
import os
import struct
from pathlib import Path

from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "public/assets"
OUT = Path(os.environ.get("VPULSE_RIG_OUT", ASSETS / "infantry-armed"))


def glb(path):
    raw = path.read_bytes()
    size = struct.unpack_from("<I", raw, 12)[0]
    return json.loads(raw[20:20 + size]), raw[28 + size:]


def accessor(document, binary, index, width):
    spec = document["accessors"][index]
    view = document["bufferViews"][spec["bufferView"]]
    assert spec["componentType"] == 5126
    start = view.get("byteOffset", 0) + spec.get("byteOffset", 0)
    stride = view.get("byteStride", width * 4)
    return [struct.unpack_from(f"<{width}f", binary, start + i * stride) for i in range(spec["count"])]


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


def atlas_pose(atlas, binary, frame):
    result = {}
    for i, name in enumerate(atlas["bones"]):
        x, y, z, w, tx, ty, tz, unused = struct.unpack_from("<8e", binary, (frame * len(atlas["bones"]) + i) * 16)
        assert all(math.isfinite(n) for n in (x, y, z, w, tx, ty, tz, unused))
        result[name] = Matrix.LocRotScale(Vector((tx, ty, tz)), quaternion((x, y, z, w)), Vector((1, 1, 1)))
    return result


def main():
    atlas = json.loads((OUT / "animation.json").read_text(encoding="utf-8"))
    atlas_data = (OUT / "animation.rgba16f").read_bytes()
    assert atlas["width"] == len(atlas["bones"]) * 2
    assert len(atlas_data) == atlas["heightTexels"] * atlas["width"] * 8 == atlas["byteLength"]
    rifle, _ = glb(ASSETS / "infantry-vpulse/v-pulse.glb")
    socket = next(node for node in rifle["nodes"] if node["name"] == "grip_left")
    support = matrix_from_array(socket["matrix"]).translation if "matrix" in socket else Vector(socket["translation"])
    right_mount = node_trs({"translation": atlas["weaponGrip"]["position"], "rotation": atlas["weaponGrip"]["quaternion"]})
    left_palm = Vector(atlas["supportGrip"]["position"])
    report = []
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
                time = step / atlas["fps"]
                pose = [dict(node) for node in document["nodes"]]
                for index, channel in channels:
                    pose[index][channel[0]] = sample_trs(channel, time)
                worlds = world_pose(document, pose)
                decoded = atlas_pose(atlas, atlas_data, clip["offset"] + step)
                for name, index in joints.items():
                    actual_delta = worlds[index] @ inverse_binds[name]
                    gltf_error = max(gltf_error, difference(actual_delta, decoded[name]))
                equipped = worlds[joints["hand_R"]] @ right_mount
                support_error = max(support_error, ((equipped @ support) - (worlds[joints["hand_L"]] @ left_palm)).length)
        assert gltf_error < .0018 and support_error < .0001, (lod, gltf_error, support_error)
        report.append({"lod": lod, "maxHalfFloatMatrixDifference": gltf_error, "maxExportedSupportDistance": support_error})
    print("V-Pulse packing verified: " + json.dumps(report), flush=True)
    path = OUT / "rig-verification.json"
    previous = json.loads(path.read_text(encoding="utf-8"))
    path.write_text(json.dumps({**previous, "glbAtlasPlayback": report}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
