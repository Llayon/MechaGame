"""Author V-Pulse carries on the candidate Rigify rig and bake a shared atlas.

Use Blender 5.2 from the repo root. Rifle FBXs are read from the audited local
motion cache or the source folder passed after "--". The output contains only
the candidate body, its actions and compact deformation bones.
"""
import hashlib
import json
import math
import os
import struct
import sys
from pathlib import Path

import addon_utils
import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from candidate_gltf_utils import repair_export_tangents

SOURCE = Path(os.environ.get("VPULSE_RIG_SOURCE", ROOT / "public/assets/infantry-candidate/rigify-demo"))
RIFLE = ROOT / "public/assets/infantry-vpulse"
OUT = Path(os.environ.get("VPULSE_RIG_OUT", ROOT / "public/assets/infantry-armed"))
CATALOG = ROOT / "docs/infantry/motion-library/catalog.json"
MOVEMENT_FPS = 30
TO_GLTF = Matrix.Rotation(-math.pi / 2, 4, "X")
FROM_GLTF = TO_GLTF.inverted()
AXIS_Y = Vector((0, 1, 0))
# Offsets are centers of the sculpted gloves, measured in each authored hand
# frame. The hand bone heads are at the wrists and cannot stand in for grips.
PALMS = {"R": Vector((.0371, .0186, .0254)), "L": Vector((-.0369, .0180, .0239))}
BODY = {
    "root": "root", "pelvis": "DEF-pelvis", "spine": "DEF-chest", "head": "DEF-head",
}
PARENTS = {"pelvis": "root", "spine": "pelvis", "head": "spine"}
CONTROLS = ["root", "pelvis", "chest", "head"]
for side in ("L", "R"):
    for name, deform, parent in [
        ("upperarm", "upper_arm", "spine"),
        ("forearm", "forearm", f"upperarm_{side}"),
        ("hand", "hand", f"forearm_{side}"),
        ("thigh", "thigh", "pelvis"),
        ("shin", "shin", f"thigh_{side}"),
        ("foot", "foot", f"shin_{side}"),
        ("toe", "toe", f"foot_{side}"),
    ]:
        BODY[f"{name}_{side}"] = f"DEF-{deform}.{side}"
        PARENTS[f"{name}_{side}"] = parent
    CONTROLS.extend(f"{bone}.{side}" for bone in ("upper_arm_fk", "forearm_fk", "hand_fk", "thigh_fk", "shin_fk", "foot_fk", "toe"))
ARMS = {f"{bone}.{side}" for side in ("L", "R") for bone in ("upper_arm_fk", "forearm_fk", "hand_fk")}
ARM_NAMES = {"upper_arm_fk": "upper_arm", "forearm_fk": "forearm", "hand_fk": "hand"}

# Each rifle pose is placed relative to the chest in Blender rest coordinates.
# Keep the original locomotion leg layers and feet, resampled to the donor
# duration for the rifle cycles. Deviations in the donor arms and chest animate
# the weapon target. Solved glove transforms preserve the two authored grips.
POSES = {
    "idle": ((-.037, -.110, .340), 27, -10),
    "walk": ((-.034, -.101, .318), 58, -18),
    "run": ((-.035, -.104, .312), 55, -27),
    "crouch": ((-.036, -.108, .339), 45, -4),
    "crouchWalk": ((-.036, -.106, .335), 50, -9),
    "jump": ((-.033, -.104, .327), 57, 9),
    "kneel": ((-.036, -.110, .340), 28, -5),
    "fire": ((-.037, -.110, .340), 27, -10),
}


def glb(path):
    raw = path.read_bytes()
    size = struct.unpack_from("<I", raw, 12)[0]
    return json.loads(raw[20:20 + size]), raw[28 + size:]


def accessor(document, data, index, width):
    spec = document["accessors"][index]
    view = document["bufferViews"][spec["bufferView"]]
    assert spec["componentType"] == 5126
    base = view.get("byteOffset", 0) + spec.get("byteOffset", 0)
    stride = view.get("byteStride", width * 4)
    return [struct.unpack_from(f"<{width}f", data, base + i * stride) for i in range(spec["count"])]


def matrix_from_glb(values):
    return Matrix([values[i:i + 4] for i in range(0, 16, 4)]).transposed()


def matrix_error(left, right):
    return max(abs(left[i][j] - right[i][j]) for i in range(4) for j in range(4))


def frame_set(scene, frame):
    whole = math.floor(frame)
    scene.frame_set(whole, subframe=frame - whole)
    bpy.context.view_layer.update()


def select_active(obj):
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def pose_matrix(rotation, translation):
    matrix = rotation.to_matrix().to_4x4()
    matrix.translation = translation
    return matrix


def orient_palm(local_palm, direction, up):
    """Map the local wrist-to-palm line and dorsal reference to the carry."""
    def basis(axis, hint):
        axis = axis.normalized()
        normal = axis.cross(hint).normalized()
        return Matrix((axis, normal.cross(axis), normal)).transposed()

    return (basis(Vector(direction), Vector(up)) @
            basis(local_palm, Vector((0, -1, 0))).inverted()).to_quaternion()


def aim_bone(head, tail, reference):
    ray = (tail - head).normalized()
    original = reference.to_quaternion()
    return pose_matrix((original @ AXIS_Y).rotation_difference(ray) @ original, head)


def elbow_position(shoulder, wrist, lengths, pole):
    one, two = lengths
    ray = wrist - shoulder
    distance = ray.length
    if not abs(one - two) < distance < one + two:
        raise ValueError(f"Unreachable rifle wrist at distance {distance}, arm {lengths}")
    axis = ray / distance
    along = (one * one - two * two + distance * distance) / (2 * distance)
    bend = (pole - axis * pole.dot(axis)).normalized()
    return shoulder + axis * along + bend * math.sqrt(max(0, one * one - along * along))


def smooth_amount(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)


def key_control(action_pose, frame, history):
    quaternion = action_pose.rotation_quaternion.copy()
    if action_pose.name in history:
        quaternion.make_compatible(history[action_pose.name])
    action_pose.rotation_quaternion = quaternion
    history[action_pose.name] = quaternion
    for channel in ("location", "rotation_quaternion", "scale"):
        action_pose.keyframe_insert(data_path=channel, frame=frame, group=action_pose.name)


def linearize(action, slot):
    channel = action.layers[0].strips[0].channelbag(slot)
    for curve in channel.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "LINEAR"


def read_donor(scene, filename, catalog, input_directory):
    record = next((entry for entry in catalog if entry["file"] == filename), None)
    cached = ROOT / record["cache"] if record and record.get("cache") else None
    path = cached if cached and cached.is_file() else input_directory / filename
    if not path.is_file():
        raise FileNotFoundError(f"Missing rifle motion {filename}: {path}")
    before = set(scene.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=str(path), use_image_search=False)
    added = set(scene.objects) - before
    donor = next(obj for obj in added if obj.type == "ARMATURE")
    action = donor.animation_data.action
    assert action and "mixamo.com" in action.name.lower(), (filename, action)
    names = {bone.name.split(":")[-1]: bone.name for bone in donor.pose.bones}
    source_bones = (
        "Spine2", "LeftHand", "RightHand", "LeftArm", "RightArm",
        "LeftForeArm", "RightForeArm",
    )
    start, end = action.frame_range
    frame_count = round(end - start)
    frames = []
    for frame in range(frame_count + 1):
        frame_set(scene, start + (end - start) * frame / frame_count)
        matrices = {name: donor.matrix_world @ donor.pose.bones[names[name]].matrix for name in source_bones}
        chest = matrices["Spine2"]
        def point(name):
            return matrices[name].translation
        frames.append({
            "chestRotation": chest.to_quaternion().normalized(),
            "right": point("RightHand") - chest.translation,
            "line": (point("LeftHand") - point("RightHand")).normalized(),
            "elbows": {side: (point(label + "ForeArm") - point(label + "Arm")).normalized()
                       for side, label in [("L", "Left"), ("R", "Right")]},
        })
    for obj in added:
        bpy.data.objects.remove(obj, do_unlink=True)
    for action in set(bpy.data.actions) - before_actions:
        bpy.data.actions.remove(action)
    return frames, {
        "sourceClip": filename, "sourceSha256": record["sha256"] if record else hashlib.sha256(path.read_bytes()).hexdigest(),
        "sourceFrames": [start, end], "source": "mixamo",
    }


def author_carries(scene, rig, base, donors, support, right_offset, left_rest_rotation):
    arm_rest = {name: bone.matrix_local.copy() for name, bone in rig.data.bones.items()}
    # Most FK and DEF rest frames match; the rest offset also handles future
    # Rigify control orientation changes without requiring retarget guesses.
    rigify_offset = {ctrl: arm_rest[f"DEF-{ARM_NAMES[ctrl.split('.')[0]]}.{ctrl[-1]}"].inverted() @ arm_rest[ctrl]
                      for ctrl in ARMS}
    arm_lengths = {side: tuple(rig.data.bones[f"DEF-{name}.{side}"].length for name in ("upper_arm", "forearm"))
                   for side in ("L", "R")}
    clips = {}
    actions = {}
    diagnosis = {}
    for name, (origin, yaw, nose) in POSES.items():
        lower_name = "idle" if name == "fire" else name
        lower = base[lower_name]
        original = bpy.data.actions["Rigify_" + lower_name]
        source_begin, source_end = original.frame_range
        donor_frames, source_info = donors.get(name, (None, {}))
        count = len(donor_frames) - 1 if donor_frames else round(lower["duration"] * MOVEMENT_FPS)
        duration = count / MOVEMENT_FPS
        # Keep the base leg action's stride length when retiming rifle walk.
        speed = lower["movementSpeed"] * lower["duration"] / duration
        clip = {**lower, **source_info, "name": name, "duration": duration, "movementSpeed": speed,
                "loop": name not in ("jump", "fire")}
        if donor_frames:
            clip["lowerBodySource"] = lower["sourceClip"]
            clip["upperBodySource"] = source_info["sourceClip"]
        else:
            clip["upperBodySource"] = "Authored two-handed carry"
        if name == "fire":
            clip["muzzleTime"] = 4 / MOVEMENT_FPS
        clips[name] = clip
        source_frames = []
        rig.animation_data.action = original
        for frame in range(count + 1):
            # Fire keeps the tested neutral lower-body stance. The recoil is
            # entirely driven by the Rifle donor's upper-body motion.
            t = 0 if name == "fire" else frame / count
            if clip["loop"] and frame == count:
                t = 0
            frame_set(scene, source_begin + (source_end - source_begin) * t)
            source_frames.append({ctrl: rig.pose.bones[ctrl].matrix_basis.copy() for ctrl in CONTROLS})

        target = bpy.data.actions.new("VPulse_" + name)
        target.use_fake_user = True
        rig.animation_data.action = target
        history = {}
        grip_error = 0
        support_error = 0
        maximum_shift = 0
        muzzle_at_pulse = None
        for frame, controls in enumerate(source_frames):
            frame_set(scene, frame)
            for ctrl, basis in controls.items():
                rig.pose.bones[ctrl].rotation_mode = "QUATERNION"
                rig.pose.bones[ctrl].matrix_basis = basis
            bpy.context.view_layer.update()
            phase = frame / count
            carry = Vector(origin)
            # Start in the low-ready idle carry. Raise toward forward before
            # the pulse event, hold through recoil, then return to the idle pose.
            aim = smooth_amount(frame / 4) * smooth_amount((count - frame) / 15) if name == "fire" else 0
            carry += aim * Vector((-.011, -.014, .018))
            rotation = (Matrix.Rotation(math.radians(yaw - 14 * aim), 4, "Z") @
                        Matrix.Rotation(math.radians(-nose - 13 * aim), 4, "X"))
            pole_offsets = {side: Vector() for side in ("L", "R")}
            if donor_frames:
                sample = donor_frames[0 if clip["loop"] and frame == count else frame]
                neutral = donor_frames[0]
                carry += .29 * (sample["right"] - neutral["right"])
                direction_delta = neutral["line"].rotation_difference(sample["line"])
                rotation = Quaternion().slerp(direction_delta, .70).to_matrix().to_4x4() @ rotation
                chest_delta = sample["chestRotation"] @ neutral["chestRotation"].inverted()
                chest = rig.pose.bones["chest"]
                chest_pose = pose_matrix(Quaternion().slerp(chest_delta, .65) @ chest.matrix.to_quaternion(),
                                         chest.matrix.translation)
                chest.matrix = chest_pose
                bpy.context.view_layer.update()
                for side in ("L", "R"):
                    pole_offsets[side] = .45 * (sample["elbows"][side] - neutral["elbows"][side])
            else:
                weight = .006 if name == "run" else .0025
                carry.z += weight * math.sin(2 * math.tau * phase)
                rotation = Matrix.Rotation(weight * 5 * math.sin(math.tau * phase), 4, "Z") @ rotation
            chest_transform = rig.pose.bones["DEF-chest"].matrix @ arm_rest["DEF-chest"].inverted()
            weapon = chest_transform @ Matrix.Translation(carry) @ rotation @ FROM_GLTF
            shoulders = {side: rig.pose.bones[f"DEF-upper_arm.{side}"].matrix.translation.copy() for side in ("L", "R")}

            def hands():
                right = weapon @ right_offset.inverted()
                left_rot = (weapon @ TO_GLTF).to_quaternion() @ left_rest_rotation
                left = pose_matrix(left_rot, (weapon @ support) - left_rot @ PALMS["L"])
                return {"R": right, "L": left}

            start = weapon.translation.copy()
            # Move the intact weapon and both grips together to stay inside
            # the two fixed-length arm reach spheres. No arm/weapon scaling.
            for _ in range(6):
                shifted = False
                for side, hand in hands().items():
                    delta = hand.translation - shoulders[side]
                    over = delta.length - (sum(arm_lengths[side]) - .001)
                    if over > 1e-6:
                        weapon.translation -= delta.normalized() * over
                        shifted = True
                if not shifted:
                    break
            maximum_shift = max(maximum_shift, (start - weapon.translation).length)
            hand_goals = hands()
            for side, sign in (("L", 1), ("R", -1)):
                hand = hand_goals[side]
                shoulder = shoulders[side]
                start_quat = chest_transform.to_quaternion()
                pole = start_quat @ Vector((sign * .72, .08, -1)) + pole_offsets[side]
                elbow = elbow_position(shoulder, hand.translation, arm_lengths[side], pole)
                targets = {"upper_arm_fk": (shoulder, elbow), "forearm_fk": (elbow, hand.translation)}
                for stem, (head, tail) in targets.items():
                    ctrl = f"{stem}.{side}"
                    rest = arm_rest[f"DEF-{ARM_NAMES[stem]}.{side}"]
                    target_matrix = aim_bone(head, tail, chest_transform @ rest)
                    rig.pose.bones[ctrl].matrix = target_matrix @ rigify_offset[ctrl]
                    bpy.context.view_layer.update()
                ctrl = f"hand_fk.{side}"
                rig.pose.bones[ctrl].matrix = hand @ rigify_offset[ctrl]
                bpy.context.view_layer.update()
            right = rig.pose.bones["DEF-hand.R"].matrix @ right_offset
            grip_error = max(grip_error, matrix_error(right, weapon))
            if name == "fire" and frame == round(clip["muzzleTime"] * MOVEMENT_FPS):
                direction = (right.to_3x3() @ Vector((0, 0, 1))).normalized()
                muzzle_at_pulse = {
                    "yawDegrees": math.degrees(math.atan2(direction.x, -direction.y)),
                    "pitchDegrees": math.degrees(math.asin(direction.z)),
                }
            left = rig.pose.bones["DEF-hand.L"].matrix @ PALMS["L"]
            support_error = max(support_error, ((right @ support) - left).length)
            for ctrl in CONTROLS:
                key_control(rig.pose.bones[ctrl], frame, history)
        linearize(target, rig.animation_data.action_slot)
        diagnosis[name] = {
            "maxRightMountMatrixError": grip_error,
            "maxSupportPalmDistance": support_error,
            "maxReachCorrection": maximum_shift,
        }
        if muzzle_at_pulse:
            diagnosis[name]["muzzleAtPulse"] = muzzle_at_pulse
            assert abs(muzzle_at_pulse["pitchDegrees"]) < 4 and abs(muzzle_at_pulse["yawDegrees"]) < 20
        assert grip_error < .0005 and support_error < .0002, (name, diagnosis[name])
        actions[name] = target
        print(f"VPULSE CARRY {name}: {count + 1} frames, {diagnosis[name]}", flush=True)
    return list(clips.values()), actions, diagnosis


def new_compact(scene, rig):
    data = bpy.data.armatures.new("V-Pulse game skeleton")
    compact = bpy.data.objects.new("Infantry_Export", data)
    scene.collection.objects.link(compact)
    select_active(compact)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, deform in BODY.items():
        bone = data.edit_bones.new(name)
        bone.length = rig.data.bones[deform].length
        bone.matrix = rig.data.bones[deform].matrix_local
        if name in PARENTS:
            bone.parent = data.edit_bones[PARENTS[name]]
    bpy.ops.object.mode_set(mode="OBJECT")
    compact.animation_data_create()
    for bone in compact.pose.bones:
        bone.rotation_mode = "QUATERNION"
    return compact


def bake_actions(scene, rig, compact, clips, actions, source_mesh):
    atlas = bytearray()
    report = []
    rests = {name: compact.data.bones[name].matrix_local.inverted() for name in BODY}
    frame_offset = 0
    maximum_rigid_error = 0
    # Only evaluate the visible review LOD for clip culling bounds. The GPU
    # batch adds its own margin for the lower body LOD and the separate rifle.
    for clip in clips:
        name = clip["name"]
        count = round(clip["duration"] * MOVEMENT_FPS)
        rig.animation_data.action = actions[name]
        action = bpy.data.actions.new("Export_" + name)
        compact.animation_data.action = action
        previous = {}
        lower = Vector((math.inf, math.inf, math.inf))
        upper = Vector((-math.inf, -math.inf, -math.inf))
        for frame in range(count + 1):
            frame_set(scene, frame)
            pose = {bone: rig.pose.bones[deform].matrix.copy() for bone, deform in BODY.items()}
            for bone, matrix in pose.items():
                compact.pose.bones[bone].matrix = matrix
                bpy.context.view_layer.update()
                key_control(compact.pose.bones[bone], frame, previous)
                relative = TO_GLTF @ matrix @ rests[bone] @ FROM_GLTF
                q = relative.to_quaternion().normalized()
                t = relative.translation
                rigid_error = matrix_error(relative, pose_matrix(q, t))
                maximum_rigid_error = max(maximum_rigid_error, rigid_error)
                atlas.extend(struct.pack("<8e", q.x, q.y, q.z, q.w, t.x, t.y, t.z, 0))
            obj = source_mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
            for corner in obj.bound_box:
                point = TO_GLTF @ Vector(corner)
                for axis in range(3):
                    lower[axis] = min(lower[axis], point[axis])
                    upper[axis] = max(upper[axis], point[axis])
        linearize(action, compact.animation_data.action_slot)
        compact.animation_data.action = None
        track = compact.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 0, action)
        strip.action_frame_start = 0
        strip.action_frame_end = count
        track.mute = True
        report.append({**clip, "frames": count + 1, "offset": frame_offset,
                       "bounds": {"min": list(lower), "max": list(upper)}})
        frame_offset += count + 1
    assert maximum_rigid_error < .0002, maximum_rigid_error
    return atlas, report, frame_offset, maximum_rigid_error


def export_bodies(scene, compact, meshes):
    groups = {deform: bone for bone, deform in BODY.items()}
    lods = []
    for level, source in enumerate(meshes):
        mesh = source.copy()
        mesh.data = source.data.copy()
        mesh.name = "DemoInfantry"
        scene.collection.objects.link(mesh)
        mesh.parent = compact
        mesh.hide_set(False)
        mesh.hide_render = False
        for group in mesh.vertex_groups:
            group.name = groups[group.name]
        mesh.modifiers[0].object = compact
        select_active(compact)
        mesh.select_set(True)
        for track in compact.animation_data.nla_tracks:
            track.mute = False
        frame_set(scene, 0)
        path = OUT / f"infantry-demo-lod{level}.glb"
        bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True,
                                  export_tangents=True, export_skins=True, export_animations=True,
                                  export_animation_mode="NLA_TRACKS", export_rest_position_armature=True)
        repaired = repair_export_tangents(path)
        for track in compact.animation_data.nla_tracks:
            track.mute = True
        lods.append({"level": level, "glb": path.name, "bytes": path.stat().st_size,
                     "triangles": len(mesh.data.polygons), "bones": len(BODY), "repairedTangents": repaired})
        bpy.data.objects.remove(mesh, do_unlink=True)
    return lods


def bind_matrices(path):
    document, binary = glb(path)
    skin = document["skins"][0]
    result = {}
    for joint, values in zip(skin["joints"], accessor(document, binary, skin["inverseBindMatrices"], 16)):
        result[document["nodes"][joint]["name"]] = matrix_from_glb(values)
    assert set(result) == set(BODY)
    return result


def attachment_metadata(clip_file, rig, right_offset):
    binds = bind_matrices(clip_file)
    right = binds["hand_R"] @ TO_GLTF @ rig.data.bones["DEF-hand.R"].matrix_local @ right_offset
    left = binds["hand_L"] @ (TO_GLTF @ (rig.data.bones["DEF-hand.L"].matrix_local @ PALMS["L"]))
    q = right.to_quaternion().normalized()
    return {"position": list(right.translation), "quaternion": [q.x, q.y, q.z, q.w]}, {"position": list(left)}


def weapon_support():
    document, _ = glb(RIFLE / "v-pulse.glb")
    node = next(node for node in document["nodes"] if node["name"] == "grip_left")
    return matrix_from_glb(node["matrix"]).translation if "matrix" in node else Vector(node["translation"])


def attach_review_rifle(scene, rig, right_offset):
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(RIFLE / "v-pulse.glb"))
    added = set(scene.objects) - before
    mounts = [obj for obj in added if obj.parent not in added]
    assert len(mounts) >= 1
    mount = bpy.data.objects.new("V-Pulse Mount", None)
    scene.collection.objects.link(mount)
    mount.parent = rig
    mount.parent_type = "BONE"
    mount.parent_bone = "DEF-hand.R"
    # Bone parenting includes its tail translation. Offset it once here so
    # Blender preview uses exactly the same attachment as runtime.
    length = rig.data.bones["DEF-hand.R"].length
    mount.matrix_parent_inverse = Matrix.Translation((0, -length, 0))
    mount.matrix_basis = right_offset @ TO_GLTF
    for root in mounts:
        local = root.matrix_world.copy()
        root.parent = mount
        root.matrix_parent_inverse = Matrix.Identity(4)
        root.matrix_basis = local
    bpy.context.view_layer.update()
    expected = rig.pose.bones["DEF-hand.R"].matrix @ right_offset @ TO_GLTF
    assert matrix_error(mount.matrix_world, expected) < .0001


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    source_directory = Path(sys.argv[sys.argv.index("--") + 1]) if "--" in sys.argv else ROOT.parent / "Assets"
    addon_utils.enable("rigify", default_set=True, persistent=False)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE / "infantry-rigify.blend"))
    rig = bpy.data.objects["Infantry_Rigify"]
    scene = bpy.context.scene
    scene.render.fps = MOVEMENT_FPS
    select_active(rig)
    assert matrix_error(rig.matrix_world, Matrix.Identity(4)) < 1e-5
    meshes = [bpy.data.objects[f"Infantry_LOD{level}"] for level in range(3)]
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    source = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    base = {clip["name"]: clip for clip in source["clips"]}
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))["records"]
    donors = {name: read_donor(scene, filename, catalog, source_directory) for name, filename in
              [("idle", "Rifle Aiming Idle.fbx"), ("walk", "Rifle Walk.fbx"), ("fire", "Firing Rifle.fbx")]}
    for side in ("L", "R"):
        for limb in ("upper_arm_parent", "thigh_parent"):
            rig.pose.bones[f"{limb}.{side}"]["IK_FK"] = 1.0
    support = weapon_support()
    right = orient_palm(PALMS["R"], (.40, -.80, .28), (0, 0, 1))
    left = orient_palm(PALMS["L"], (-.38, -.82, .35), (0, 0, -1))
    right_offset = Matrix.Translation(PALMS["R"]) @ right.inverted().to_matrix().to_4x4() @ FROM_GLTF
    clips, actions, diagnosis = author_carries(scene, rig, base, donors, support, right_offset, left)
    compact = new_compact(scene, rig)
    binary, atlas_clips, rows, rigidity = bake_actions(scene, rig, compact, clips, actions, meshes[0])
    lods = export_bodies(scene, compact, meshes)
    grip, support_grip = attachment_metadata(OUT / "infantry-demo-lod2.glb", rig, right_offset)
    for level in (0, 1):
        current_grip, current_support = attachment_metadata(OUT / f"infantry-demo-lod{level}.glb", rig, right_offset)
        for field in grip:
            assert max(abs(a - b) for a, b in zip(grip[field], current_grip[field])) < 1e-6
        assert max(abs(a - b) for a, b in zip(support_grip["position"], current_support["position"])) < 1e-6
    atlas = {"schemaVersion": 1, "method": "baked-rigid-bone-texture", "fps": MOVEMENT_FPS,
             "height": source["height"], "metersPerUnit": source["metersPerUnit"], "forward": source["forward"],
             "weaponGrip": grip, "supportGrip": support_grip,
             "bones": list(BODY), "width": len(BODY) * 2, "heightTexels": rows, "format": "RGBA16F",
             "clips": atlas_clips, "byteLength": len(binary),
             "sourceSha256": hashlib.sha256((SOURCE / "infantry-demo-lod2.glb").read_bytes()).hexdigest()}
    (OUT / "animation.rgba16f").write_bytes(binary)
    (OUT / "animation.json").write_text(json.dumps(atlas, indent=2), encoding="utf-8")
    manifest = {**source, "clips": clips, "lods": lods, "weaponGrip": grip, "supportGrip": support_grip,
                "gpuAtlasBaked": True, "authoringFile": "infantry-vpulse.blend",
                "notes": ["Rifle donor upper motion is combined with validated Mixamo lower-body contacts.",
                          "Run, crouch, crouchWalk, jump and kneel use authored two-handed upper-body carries.",
                          "One shared rigid rifle follows the right palm. Left palm follows its support point.",
                          "Rifle geometry is loaded separately from the compact body meshes."]}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    bpy.data.objects.remove(compact, do_unlink=True)
    rig.animation_data.action = actions["idle"]
    scene.frame_start, scene.frame_end = 0, round(clips[0]["duration"] * MOVEMENT_FPS)
    frame_set(scene, 0)
    attach_review_rifle(scene, rig, right_offset)
    select_active(rig)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "infantry-vpulse.blend"))
    metrics = {"rightAndLeftGrip": diagnosis, "maxNonRigidSkinMatrixError": rigidity,
               "rows": rows, "atlasBytes": len(binary), "lods": lods}
    (OUT / "rig-verification.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print("VPULSE ASSETS " + json.dumps(metrics), flush=True)


if __name__ == "__main__":
    main()
