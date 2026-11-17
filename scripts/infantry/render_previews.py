"""Render actual rig poses and optional short loop videos (requires ffmpeg)."""
import bpy
import json
import math
from pathlib import Path
import subprocess
import sys
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/infantry/animations'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'public/assets/infantry/infantry-work.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['InfantryRig']
for track in rig.animation_data.nla_tracks:track.mute=True
scene.world.color=(.15,.15,.15)
scene.render.resolution_x=480;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.fps=30
for pos,energy,size in [((1,-1.5,2),100,2),((-1,-.6,1),55,1),((0,1,1.5),90,1)]:
    data=bpy.data.lights.new('Preview light','AREA');data.energy=energy;data.size=size
    obj=bpy.data.objects.new('Preview light',data);scene.collection.objects.link(obj);obj.location=pos
    obj.rotation_euler=(Vector((0,0,.25))-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001));floor=bpy.context.object
mat=bpy.data.materials.new('Preview floor');mat.diffuse_color=(.12,.13,.14,1);floor.data.materials.append(mat)
mat.use_nodes=True
next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'].default_value=(.12,.13,.14,1)
data=bpy.data.cameras.new('Preview camera');camera=bpy.data.objects.new('Preview camera',data)
scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=.65
camera.location=(.65,-1.2,.55);camera.rotation_euler=(Vector((0,-.005,.245))-camera.location).to_track_quat('-Z','Y').to_euler()
metadata=json.loads((ROOT/'public/assets/infantry/animation.json').read_text())
for clip in metadata['clips']:
    if '--clip' in sys.argv and clip['name']!=sys.argv[sys.argv.index('--clip')+1]: continue
    rig.animation_data.action=bpy.data.actions[clip['name']]
    if '--video' in sys.argv and clip['name'] in ['run','idle','fire']:
        dest=OUT/clip['name'];dest.mkdir(exist_ok=True)
        for frame in range(clip['frames']-1):
            scene.frame_set(frame);scene.render.filepath=str(dest/f'{frame:04}.png');bpy.ops.render.render(write_still=True)
        subprocess.run(['ffmpeg','-y','-threads','2','-framerate','30','-i',str(dest/'%04d.png'),'-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-crf','20',str(OUT/(clip['name']+'.mp4'))],check=True,capture_output=True)
    else:
        for fraction in [0,.25,.5,.75,1]:
            scene.frame_set(round((clip['frames']-1)*fraction))
            if clip['name']=='death':
                evaluated=bpy.data.objects['TripoInfantry'].evaluated_get(bpy.context.evaluated_depsgraph_get())
                lo=Vector([min(vertex.co[k] for vertex in evaluated.data.vertices) for k in range(3)])
                hi=Vector([max(vertex.co[k] for vertex in evaluated.data.vertices) for k in range(3)])
                center=(lo+hi)/2
                camera.location=center+Vector((.65,-1.2,.305))
                camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
                data.ortho_scale=.75
            scene.render.filepath=str(OUT/f"{clip['name']}-{fraction:.2f}.png")
            bpy.ops.render.render(write_still=True)
