import bpy, sys, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];mixamo='--mixamo' in sys.argv
OUT=ROOT/('docs/infantry/playground/mixamo/images' if mixamo else 'docs/infantry/playground/images');OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/('public/assets/infantry-candidate/mixamo-demo/infantry-mixamo-rig.blend' if mixamo else 'public/assets/infantry-candidate/demo/infantry-demo-rig.blend')))
scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE')
for track in rig.animation_data.nla_tracks:track.mute=True
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=480;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.world.color=(.12,.12,.12)
for pos,energy,size in [((1,-1.5,2),100,2),((-1,-1,1),50,1),((0,1,1),70,1)]:
 data=bpy.data.lights.new('Preview','AREA');data.energy=energy;data.size=size
 light=bpy.data.objects.new('Preview',data);scene.collection.objects.link(light);light.location=pos;light.rotation_euler=(Vector((0,0,.24))-light.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Preview');camera=bpy.data.objects.new('Preview',data);scene.collection.objects.link(camera);scene.camera=camera
data.type='ORTHO';data.ortho_scale=.55;camera.location=(.65,-1.2,.43);camera.rotation_euler=(Vector((0,0,.24))-camera.location).to_track_quat('-Z','Y').to_euler()
for name,frame in [('idle',0),('run',4),('run',10),('walk',7),('crouch',0),('jump',10)]:
 rig.animation_data.action=next(t.strips[0].action for t in rig.animation_data.nla_tracks if t.name==name);scene.frame_set(frame)
 scene.render.filepath=str(OUT/f'{name}-{frame}.png');bpy.ops.render.render(write_still=True)
