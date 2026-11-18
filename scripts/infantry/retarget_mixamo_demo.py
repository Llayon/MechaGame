"""Retarget real Mixamo motion onto the existing candidate rig; keep all art/LODs.

The cache is fetched by fetch_mixamo_source.mjs. Only available real clips are
labelled Mixamo; unsupported states retain explicitly labelled prototype clips.
"""
import bpy, json, math, sys, hashlib
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
sys.path.insert(0,str(Path(__file__).resolve().parent))
from candidate_gltf_utils import repair_export_tangents
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'public/assets/infantry-candidate/demo'
OUT=ROOT/'public/assets/infantry-candidate/mixamo-demo';OUT.mkdir(exist_ok=True)
DOC=ROOT/'docs/infantry/playground/mixamo';DOC.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'.tools/mixamo/Xbot.glb'
if not SOURCE.is_file():raise RuntimeError('Run node scripts/infantry/fetch_mixamo_source.mjs first')
source_info=json.loads((SOURCE.parent/'source.json').read_text())
base_manifest=json.loads((BASE/'manifest.json').read_text())
H=.48
def v(x,y,z):return Vector((x*H,y*H,z*H))
mapping={'pelvis':'Hips','spine':'Spine2','head':'Head',
 'upperarm_L':'LeftArm','forearm_L':'LeftForeArm','upperarm_R':'RightArm','forearm_R':'RightForeArm',
 'thigh_L':'LeftUpLeg','shin_L':'LeftLeg','foot_L':'LeftFoot','thigh_R':'RightUpLeg','shin_R':'RightLeg','foot_R':'RightFoot'}
ends={'Hips':'Spine','Spine2':'Neck','Head':'HeadTop_End','LeftArm':'LeftForeArm','LeftForeArm':'LeftHand',
 'RightArm':'RightForeArm','RightForeArm':'RightHand','LeftUpLeg':'LeftLeg','LeftLeg':'LeftFoot','LeftFoot':'LeftToeBase',
 'RightUpLeg':'RightLeg','RightLeg':'RightFoot','RightFoot':'RightToeBase'}
metadata=[];reports=[]
def sample_frame(frame):bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame));bpy.context.view_layer.update()
for level in range(3):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
 scene=bpy.context.scene;scene.render.fps=30
 bpy.ops.import_scene.gltf(filepath=str(BASE/f'infantry-demo-lod{level}.glb'))
 target=next(o for o in scene.objects if o.type=='ARMATURE');body=next(o for o in scene.objects if o.type=='MESH');body.name='DemoInfantry'
 target_objects=set(scene.objects)
 target_actions={a.name:a for a in bpy.data.actions}
 for track in target.animation_data.nla_tracks:track.mute=True
 target.animation_data.action=None
 rest={b.name:target.matrix_world@b.matrix_local for b in target.data.bones};heads={n:m.translation.copy() for n,m in rest.items()}
 target_axis={}
 for name in mapping:
  if name.startswith('thigh_'):end=heads[name.replace('thigh_','shin_')]
  elif name.startswith('shin_'):end=heads[name.replace('shin_','foot_')]
  elif name.startswith('upperarm_'):end=heads[name.replace('upperarm_','forearm_')]
  elif name.startswith('forearm_'):end=v((1 if name.endswith('_L') else -1)*.32,-.01,.53)
  elif name.startswith('foot_'):end=v((1 if name.endswith('_L') else -1)*.105,-.095,.025)
  else:end=heads[name]+Vector((0,0,.1))
  target_axis[name]=(end-heads[name]).normalized()
 bpy.ops.import_scene.gltf(filepath=str(SOURCE))
 donor=next(o for o in scene.objects if o.type=='ARMATURE' and o not in target_objects)
 donor_objects=set(scene.objects)-target_objects
 donor_actions={a.name.split('.')[0]:a for a in bpy.data.actions if a not in target_actions.values()}
 for track in donor.animation_data.nla_tracks:track.mute=True
 donor.animation_data.action=None
 source_bones={b.name.split(':')[-1]:b for b in donor.data.bones}
 source_rest={n:donor.matrix_world@b.matrix_local for n,b in source_bones.items()}
 source_heads={n:m.translation.copy() for n,m in source_rest.items()}
 # Bone tails in imported glTF may be display-only: use actual child joints.
 alignment={}
 for name,src in mapping.items():
  axis=(source_heads[ends[src]]-source_heads[src]).normalized()
  alignment[name]=target_axis[name].rotation_difference(axis).to_matrix().to_4x4() if name.startswith(('upperarm_','forearm_','thigh_','shin_')) else Matrix.Identity(4)
 lengths={}
 for side,prefix in [('L','Left'),('R','Right')]:
  lengths[side]=((heads['shin_'+side]-heads['thigh_'+side]).length,(heads['foot_'+side]-heads['shin_'+side]).length)
 scale=sum(lengths['L'])/((source_heads['LeftLeg']-source_heads['LeftUpLeg']).length+(source_heads['LeftFoot']-source_heads['LeftLeg']).length)
 pose_inv=target.matrix_world.inverted();clip_records=[]
 for name in ['idle','walk','run']:
  action_source=donor_actions[name];donor.animation_data.action=action_source
  begin,end=action_source.frame_range;duration=(end-begin)/30;frames=round(duration*30);duration=frames/30
  action=bpy.data.actions.new('Mixamo_'+name);target.animation_data.action=action
  sample_frame(begin)
  root_first=(donor.matrix_world@donor.pose.bones[source_bones['Hips'].name].matrix).translation
  sample_frame(end)
  root_last=(donor.matrix_world@donor.pose.bones[source_bones['Hips'].name].matrix).translation
  root_drift=root_last-root_first;root_drift.z=0
  root_offset=root_first-source_heads['Hips'];root_offset.z=0
  contacts=[];min_ground=1;max_ground=-1
  for frame in range(frames+1):
   phase=frame/frames;sample_frame(begin+(end-begin)*phase)
   source_pose={n:donor.matrix_world@donor.pose.bones[b.name].matrix for n,b in source_bones.items()}
   source_delta={n:source_pose[n].to_quaternion()@source_rest[n].to_quaternion().inverted() for n in source_bones}
   rotations={n:source_delta[s].to_matrix().to_4x4()@alignment[n]@rest[n] for n,s in mapping.items()}
   root_motion=root_offset+root_drift*phase
   pelvis=heads['pelvis']+(source_pose['Hips'].translation-source_heads['Hips']-root_motion)*scale
   pelvisD=Matrix.Translation(pelvis)@source_delta['Hips'].to_matrix().to_4x4()@Matrix.Translation(-heads['pelvis'])
   hips={side:pelvisD@heads['thigh_'+side] for side in ['L','R']}
   ankles={side:heads['foot_'+side]+(source_pose[prefix+'Foot'].translation-source_heads[prefix+'Foot']-root_motion)*scale for side,prefix in [('L','Left'),('R','Right')]}
   # Preserve the mapped end-effectors. Lower the pelvis only if proportions
   # would otherwise demand an impossible fully extended leg.
   reach_shift=0
   for side in ['L','R']:
    difference=hips[side]-ankles[side];horizontal=difference.x*difference.x+difference.y*difference.y
    max_height=math.sqrt(max(0,(sum(lengths[side])-.0001)**2-horizontal))
    reach_shift=max(reach_shift,difference.z-max_height)
   if reach_shift>0:
    correction=Matrix.Translation((0,0,-reach_shift));pelvisD=correction@pelvisD;pelvis.z-=reach_shift
    hips={side:correction@hip for side,hip in hips.items()}
   desired={'root':rest['root'].copy(),'pelvis':rotations['pelvis'].copy()};desired['pelvis'].translation=pelvis
   spineD=Matrix.Translation(pelvisD@heads['spine'])@rotations['spine'].to_quaternion().to_matrix().to_4x4()@rest['spine'].to_quaternion().inverted().to_matrix().to_4x4()@Matrix.Translation(-heads['spine'])
   desired['spine']=rotations['spine'].copy();desired['spine'].translation=pelvisD@heads['spine']
   desired['head']=rotations['head'].copy();desired['head'].translation=spineD@heads['head']
   for side,prefix in [('L','Left'),('R','Right')]:
    hip=hips[side];ankle=ankles[side];l1,l2=lengths[side];delta=ankle-hip;distance=min(max(delta.length,abs(l2-l1)+1e-5),l1+l2-1e-5);direction=delta.normalized()
    a=(l1*l1-l2*l2+distance*distance)/(2*distance);height=math.sqrt(max(0,l1*l1-a*a))
    sh=source_pose[prefix+'UpLeg'].translation;sk=source_pose[prefix+'Leg'].translation;sf=source_pose[prefix+'Foot'].translation
    source_axis=(sf-sh).normalized();bend=sk-sh-source_axis*(sk-sh).dot(source_axis)
    if bend.length<1e-5:bend=Vector((0,-1,0))
    bend=(bend-direction*bend.dot(direction)).normalized();knee=hip+direction*a+bend*height
    for bone,head,tail in [('thigh_'+side,hip,knee),('shin_'+side,knee,ankle)]:
     rotation=rotations[bone].to_quaternion();predicted=rotation@Vector((0,1,0))
     align=predicted.rotation_difference((tail-head).normalized())
     desired[bone]=(align@rotation).to_matrix().to_4x4();desired[bone].translation=head
    desired['foot_'+side]=rotations['foot_'+side].copy();desired['foot_'+side].translation=ankle
    shoulder=spineD@heads['upperarm_'+side]
    desired['upperarm_'+side]=rotations['upperarm_'+side].copy();desired['upperarm_'+side].translation=shoulder
    length=(heads['forearm_'+side]-heads['upperarm_'+side]).length
    elbow=shoulder+desired['upperarm_'+side].to_quaternion()@Vector((0,length,0))
    desired['forearm_'+side]=rotations['forearm_'+side].copy();desired['forearm_'+side].translation=elbow
   # Retargeted shoe geometry differs from Xbot. Apply only vertical support,
   # retaining the source's airborne phases rather than pinning every frame.
   deltas={n:desired[n]@rest[n].inverted() for n in rest}
   low=1
   for vertex in body.data.vertices:
    if vertex.co.z>H*.12:continue
    p=sum(((deltas[target.data.bones[g.group].name]@vertex.co)*g.weight for g in vertex.groups),Vector())
    low=min(low,p.z)
   if low<0:
    support=Matrix.Translation((0,0,-low));desired={n:support@m for n,m in desired.items()}
   min_ground=min(min_ground,low);max_ground=max(max_ground,low)
   for bone in target.data.bones:
    pb=target.pose.bones[bone.name];pb.rotation_mode='QUATERNION';pb.matrix=pose_inv@desired[bone.name];bpy.context.view_layer.update()
    for field in ['location','rotation_quaternion','scale']:pb.keyframe_insert(data_path=field,frame=frame)
   contacts.append({side:list(desired['foot_'+side].translation) for side in ['L','R']}|{'sourceZ':{side:source_pose[prefix+'Foot'].translation.z for side,prefix in [('L','Left'),('R','Right')]}})
  target.animation_data.action=None
  # Estimate in-place speed from low foot samples moving backward in stance.
  speeds=[]
  if name!='idle':
   for i in range(1,len(contacts)-1):
    for side in ['L','R']:
     if contacts[i]['sourceZ'][side]<source_heads[('Left' if side=='L' else 'Right')+'Foot'].z+.04:
      velocity=(contacts[i+1][side][1]-contacts[i-1][side][1])*15
      if velocity>.03:speeds.append(velocity)
  speeds.sort();speed=speeds[len(speeds)//2] if speeds else 0
  if name!='idle' and speed<=0:raise RuntimeError(f'Could not derive Mixamo {name} locomotion speed: {contacts[:3]}')
  track=next(t for t in target.animation_data.nla_tracks if t.name==name)
  for strip in list(track.strips):track.strips.remove(strip)
  strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=frames;track.mute=True
  clip_records.append({'name':name,'duration':duration,'loop':True,'movementSpeed':speed,'source':'mixamo',
   'sourceClip':name,'sourceSha256':source_info['sha256'],'retargetScale':scale,'groundMinBeforeCorrection':min_ground,'groundMaxBeforeCorrection':max_ground})
 # The other three states remain explicitly attributed prototypes until actual
 # user-selected Mixamo FBXs are supplied; do not silently relabel them.
 for clip in base_manifest['clips']:
  if clip['name'] not in ['idle','walk','run']:clip_records.append({**clip,'source':'prototype','pendingMixamo':True})
 for obj in donor_objects:bpy.data.objects.remove(obj,do_unlink=True)
 for action in donor_actions.values():
  if action.name in bpy.data.actions:bpy.data.actions.remove(action)
 for track in target.animation_data.nla_tracks:track.mute=False
 target.animation_data.action=None;sample_frame(0)
 bpy.ops.object.select_all(action='DESELECT');target.select_set(True);body.select_set(True);bpy.context.view_layer.objects.active=target
 path=OUT/f'infantry-demo-lod{level}.glb'
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_tangents=True,export_animations=True,export_skins=True,export_animation_mode='NLA_TRACKS')
 repaired=repair_export_tangents(path)
 for track in target.animation_data.nla_tracks:track.mute=True
 target.animation_data.action=next(t.strips[0].action for t in target.animation_data.nla_tracks if t.name=='run');sample_frame(0)
 if level==0:
  bpy.data.orphans_purge(do_recursive=True)
  bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'infantry-mixamo-rig.blend'))
 reports.append({'level':level,'glb':path.name,'bytes':path.stat().st_size,'repairedTangents':repaired})
 if level==0:metadata=clip_records
manifest={**base_manifest,'clips':metadata,'lods':reports,'animationSource':'mixamo-retargeted-core','mixamoSource':source_info,
 'pendingMixamoClips':['crouch','crouchWalk','jump'],'notes':['Only idle/walk/run currently use real Mixamo data; other clips are explicitly labelled prototypes','Only donor animation and bone transforms are used; donor character geometry is removed']}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(DOC/'retarget-metrics.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('MIXAMO_RETARGET='+json.dumps(manifest))
