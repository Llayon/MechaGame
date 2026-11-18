"""Rig all prepared candidate LODs; author in-place locomotion for one playable hero."""
import bpy, json, math, hashlib, sys
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
sys.path.insert(0,str(Path(__file__).resolve().parent))
from candidate_gltf_utils import repair_export_tangents
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'public/assets/infantry-candidate';OUT=SOURCE/'demo';OUT.mkdir(exist_ok=True)
DOC=ROOT/'docs/infantry/playground';DOC.mkdir(parents=True,exist_ok=True)
H=.48
def v(x,y,z):return Vector((x*H,y*H,z*H))
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def around(point,q):return Matrix.Translation(point)@q.to_matrix().to_4x4()@Matrix.Translation(-point)
clips=[('idle',72,True,0),('walk',25,True,.36),('run',21,True,3.2/3.75),
       ('crouch',60,True,0),('crouchWalk',36,True,.8/3.75),('jump',21,False,0)]
reports=[]
for level in range(3):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
 bpy.ops.import_scene.gltf(filepath=str(SOURCE/f'infantry-candidate-lod{level}.glb'))
 body=next(o for o in bpy.context.scene.objects if o.type=='MESH');body.name='DemoInfantry'
 points=[body.matrix_world@vertex.co for vertex in body.data.vertices]
 lo=min(p.z for p in points);scale=H/(max(p.z for p in points)-lo)
 transform=Matrix.Scale(scale,4)@Matrix.Translation((0,0,-lo))@body.matrix_world
 normals=[transform.to_3x3().inverted().transposed()@n.vector for n in body.data.corner_normals]
 for vertex in body.data.vertices:vertex.co=transform@vertex.co
 body.matrix_world=Matrix.Identity(4);body.data.update()
 body.data.normals_split_custom_set([n.normalized() for n in normals])
 rig_data=bpy.data.armatures.new('CandidateSkeleton');rig=bpy.data.objects.new('DemoRig',rig_data)
 bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig
 rig.select_set(True);body.select_set(False);bpy.ops.object.mode_set(mode='EDIT')
 def bone(name,head,tail,parent=None):
  b=rig_data.edit_bones.new(name);b.head=head;b.tail=tail
  if parent:b.parent=rig_data.edit_bones[parent]
 bone('root',v(0,0,0),v(0,0,.10))
 bone('pelvis',v(0,0,.51),v(0,0,.59),'root')
 bone('spine',v(0,0,.55),v(0,0,.83),'pelvis')
 bone('head',v(0,-.015,.84),v(0,-.015,.98),'spine')
 for side,sign in [('L',1),('R',-1)]:
  bone('thigh_'+side,v(sign*.095,0,.51),v(sign*.10,-.012,.30),'pelvis')
  bone('shin_'+side,v(sign*.10,-.012,.30),v(sign*.105,.015,.065),'thigh_'+side)
  bone('foot_'+side,v(sign*.105,.015,.065),v(sign*.105,-.095,.025),'shin_'+side)
  bone('upperarm_'+side,v(sign*.18,0,.79),v(sign*.265,0,.655),'spine')
  bone('forearm_'+side,v(sign*.265,0,.655),v(sign*.32,-.01,.53),'upperarm_'+side)
 bpy.ops.object.mode_set(mode='OBJECT')
 names=[b.name for b in rig.data.bones];rest={b.name:b.matrix_local.copy() for b in rig.data.bones}
 for name in names:body.vertex_groups.new(name=name)
 def weights(point):
  x,y,z=point/H;side='L' if x>=0 else 'R'
  if .725<z<.87 and .13<abs(x)<.27:return {'spine':1}
  if .465<z<.87 and y<.105 and abs(x)>.15+.22*(.79-z):
   w=smooth(.635,.67,z)
   if w<.001:return {'forearm_'+side:1}
   if w>.999:return {'upperarm_'+side:1}
   return {'upperarm_'+side:w,'forearm_'+side:1-w}
  if z>.84 and y<.075 and abs(x)<.15:return {'head':1}
  if z<.485:
   if z<.095:return {'foot_'+side:1}
   if z<.275:return {'shin_'+side:1}
   if z<.315:
    w=smooth(.275,.315,z);return {'thigh_'+side:w,'shin_'+side:1-w}
   if z<.46:return {'thigh_'+side:1}
   w=smooth(.46,.485,z);return {'pelvis':w,'thigh_'+side:1-w}
  if z<.575:return {'pelvis':1}
  return {'spine':1}
 seam={};assignments=[]
 for vertex in body.data.vertices:
  key=tuple(round(float(c),6) for c in vertex.co)
  w=seam.setdefault(key,weights(vertex.co));w={name:weight for name,weight in w.items() if weight>1e-6}
  total=sum(w.values());w={name:weight/total for name,weight in w.items()}
  for name,weight in w.items():body.vertex_groups[name].add([vertex.index],weight,'REPLACE')
  assignments.append(w)
 modifier=body.modifiers.new('Candidate skeletal animation','ARMATURE');modifier.object=rig;body.parent=rig
 scene=bpy.context.scene;scene.render.fps=30
 def segment(name,head,tail):
  b=rig.data.bones[name];q=(b.tail_local-b.head_local).normalized().rotation_difference((tail-head).normalized())
  return Matrix.Translation(head)@q.to_matrix().to_4x4()@Matrix.Translation(-b.head_local)@rest[name]
 def pose(name,t,duration,speed):
  p=t/duration;wave=math.sin(p*math.tau);moving=name in ['walk','run','crouchWalk'];crouch=name in ['crouch','crouchWalk']
  pelvis=v(0,0,.51+.002*wave);lean=.003*wave;roll=0
  if moving:
   pelvis=v(.012*wave,.025 if crouch else 0,(.365 if crouch else .455 if name=='run' else .47)+(.008 if name=='run' else .004)*math.cos(p*math.tau*2))
   lean=.17 if crouch else .10 if name=='run' else .025;roll=.018*wave
  elif crouch:pelvis=v(0,.035,.365+.002*wave);lean=.17
  if name=='jump':pelvis=v(0,0,.485);lean=.07
  pelvisD=Matrix.Translation(pelvis-v(0,0,.51))
  spineD=pelvisD@around(v(0,0,.55),Quaternion((1,0,0),lean))@around(v(0,0,.55),Quaternion((0,1,0),roll))
  desired={'root':rest['root'],'pelvis':pelvisD@rest['pelvis'],'spine':spineD@rest['spine'],
    'head':spineD@rest['head']}
  for side,sign in [('L',1),('R',-1)]:
   hip=pelvisD@v(sign*.095,0,.51);ankle=v(sign*.105,.015,.065);pitch=0
   if moving:
    ankle.y=0
    f=(p+(0 if sign>0 else .5))%1;stance=.31 if name=='run' else .65 if crouch else .54
    stride=speed*duration*stance
    if f<stance:ankle.y+=-stride/2+stride*f/stance
    else:
     u=(f-stance)/(1-stance);ankle.y+=stride/2-stride*smooth(0,1,u)
     ankle.z+=H*math.sin(math.pi*u)*(.11 if name=='run' else .05 if crouch else .065)
     pitch=.18*math.sin(math.tau*u)
   if name=='jump':ankle.z+=H*.07*math.sin(math.pi*p);ankle.y+=H*.025*math.sin(math.pi*p)
   l1=(rig.data.bones['thigh_'+side].tail_local-rig.data.bones['thigh_'+side].head_local).length
   l2=(rig.data.bones['shin_'+side].tail_local-rig.data.bones['shin_'+side].head_local).length
   if moving and (ankle-hip).length>l1+l2+.0005:raise RuntimeError(f'Unreachable {name} foot at {p}: {(ankle-hip).length} > {l1+l2}')
   delta=ankle-hip;distance=min(max(delta.length,abs(l2-l1)+1e-5),l1+l2-1e-5);direction=delta.normalized()
   a=(l1*l1-l2*l2+distance*distance)/(2*distance);height=math.sqrt(max(0,l1*l1-a*a))
   bend=Vector((0,-1,0));bend=(bend-direction*bend.dot(direction)).normalized();knee=hip+direction*a+bend*height
   desired['thigh_'+side]=segment('thigh_'+side,hip,knee);desired['shin_'+side]=segment('shin_'+side,knee,ankle)
   desired['foot_'+side]=Matrix.Translation(ankle)@Quaternion((1,0,0),pitch).to_matrix().to_4x4()@Matrix.Translation(-v(sign*.105,.015,.065))@rest['foot_'+side]
   shoulder=v(sign*.18,0,.79);rest_elbow=v(sign*.265,0,.655)
   swing=(.48 if name=='run' else .25 if moving else .015)*math.cos(p*math.tau)*sign
   upperD=spineD@around(shoulder,Quaternion((1,0,0),swing))@around(shoulder,Quaternion((0,1,0),sign*.45))
   desired['upperarm_'+side]=upperD@rest['upperarm_'+side]
   flex=.95 if name=='run' else .55 if crouch else .4 if moving else .18
   if name=='jump':flex=.65
   desired['forearm_'+side]=upperD@around(rest_elbow,Quaternion((1,0,0),-flex))@rest['forearm_'+side]
  for name in names:
   pb=rig.pose.bones[name];pb.rotation_mode='QUATERNION';pb.matrix=desired[name];bpy.context.view_layer.update()
 for name,frames,loop,speed in clips:
  action=bpy.data.actions.new(name);rig.animation_data_create();rig.animation_data.action=action
  duration=frames/30
  for frame in range(frames+1):
   scene.frame_set(frame);pose(name,frame/30,duration,speed)
   for pb in rig.pose.bones:
    for field in ['location','rotation_quaternion','scale']:pb.keyframe_insert(data_path=field,frame=frame)
  rig.animation_data.action=None;track=rig.animation_data.nla_tracks.new();track.name=name
  strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=frames;track.mute=True
 for track in rig.animation_data.nla_tracks:track.mute=False
 scene.frame_set(0);bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
 path=OUT/f'infantry-demo-lod{level}.glb'
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_tangents=True,
  export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True)
 repaired=repair_export_tangents(path)
 for track in rig.animation_data.nla_tracks:track.mute=True
 rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(0)
 if level==0:
  bpy.context.preferences.filepaths.save_version=0
  bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'infantry-demo-rig.blend'))
 reports.append({'level':level,'glb':path.name,'bytes':path.stat().st_size,'bones':len(names),'triangles':len(body.data.polygons),
  'repairedTangents':repaired,'sourceSha256':hashlib.sha256((SOURCE/f'infantry-candidate-lod{level}.glb').read_bytes()).hexdigest()})
manifest={'schemaVersion':1,'height':H,'metersPerUnit':3.75,'forward':'+Z','clips':[{'name':n,'duration':f/30,'loop':loop,'movementSpeed':speed} for n,f,loop,speed in clips],'lods':reports,
 'notes':['Single controlled hero uses one active AnimationMixer; no crowd CPU skeleton animation','Source static LODs and the original Tripo lab are unchanged','Rigid armor cores with narrow joint blends; motion is a demo study, not final combat animation']}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(DOC/'rig-metrics.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('DEMO_RIG='+json.dumps(manifest))
