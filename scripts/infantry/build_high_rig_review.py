"""Render the original 40k rig for a visual weight and grip check."""
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public/assets/infantry-candidate/high-rig/infantry-high.blend"
OUTPUT = ROOT / "docs/infantry/high-rig/images"
OUTPUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
rig = bpy.data.objects["Infantry_Rigify"]
scene.render.engine = "CYCLES"
scene.cycles.samples = 12
scene.cycles.use_denoising = True
scene.render.threads_mode = "FIXED"
scene.render.threads = 4
scene.render.resolution_x, scene.render.resolution_y = (544, 704)
scene.render.resolution_percentage = 100
scene.world.color = (.12, .12, .12)

for position, power, size in [((1, -1.5, 2), 100, 2), ((-1, -1, 1), 50, 1), ((0, 1, 1), 70, 1)]:
    data = bpy.data.lights.new("Review light", "AREA")
    data.energy, data.size = power, size
    light = bpy.data.objects.new("Review light", data)
    scene.collection.objects.link(light)
    light.location = position
    light.rotation_euler = (Vector((0, 0, .24)) - light.location).to_track_quat("-Z", "Y").to_euler()

data = bpy.data.cameras.new("Review camera")
camera = bpy.data.objects.new("Review camera", data)
scene.collection.objects.link(camera)
scene.camera = camera
data.type, data.ortho_scale = "ORTHO", .61

for name, clip, frame, view in [
    ("idle", "idle", 12, (.78, -1.2, .48)),
    ("run", "run", 5, (1.18, -.32, .42)),
    ("grip", "fire", 4, (-.78, -1.2, .48)),
]:
    rig.animation_data.action = bpy.data.actions["VPulse_" + clip]
    scene.frame_set(frame)
    camera.location = view
    camera.rotation_euler = (Vector((0, -.015, .234)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(OUTPUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
