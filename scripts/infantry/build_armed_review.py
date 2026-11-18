"""Render the authored V-Pulse armature for grip and carry review."""
import sys
import os
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(os.environ.get("VPULSE_REVIEW_OUT", ROOT / "docs/infantry/vpulse/blender"))
OUTPUT.mkdir(parents=True, exist_ok=True)
source = Path(os.environ.get("VPULSE_RIG_OUT", ROOT / "public/assets/infantry-armed"))
bpy.ops.wm.open_mainfile(filepath=str(source / "infantry-vpulse.blend"))
scene = bpy.context.scene
rig = bpy.data.objects["Infantry_Rigify"]
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.threads_mode = "FIXED"
scene.render.threads = 4
scene.render.resolution_x, scene.render.resolution_y = (544, 704)
scene.render.resolution_percentage = 100
scene.world.color = (.12, .12, .12)

for position, energy, size in [((1, -1.5, 2), 100, 2), ((-1, -1, 1), 50, 1), ((0, 1, 1), 70, 1)]:
    data = bpy.data.lights.new("Review light", "AREA")
    data.energy, data.size = energy, size
    light = bpy.data.objects.new("Review light", data)
    scene.collection.objects.link(light)
    light.location = position
    light.rotation_euler = (Vector((0, 0, .24)) - light.location).to_track_quat("-Z", "Y").to_euler()

data = bpy.data.cameras.new("Review camera")
camera = bpy.data.objects.new("Review camera", data)
scene.collection.objects.link(camera)
scene.camera = camera
data.type, data.ortho_scale = "ORTHO", .58
poses = {"idle": ("idle", 12), "walk": ("walk", 10), "run": ("run", 5),
         "crouch": ("crouch", 0), "fire": ("fire", 4), "jump": ("jump", 12),
         "fire-support": ("fire", 4), "walk-support": ("walk", 10)}
selected = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(poses)
for name in selected:
    clip, frame = poses[name]
    rig.animation_data.action = bpy.data.actions["VPulse_" + clip]
    scene.frame_set(frame)
    camera.location = (.78 if name.endswith("-support") else -.78, -1.20, .48)
    camera.rotation_euler = (Vector((0, -.025, .234)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(OUTPUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
