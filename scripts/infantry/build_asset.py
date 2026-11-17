"""Reproducible Blender rig, authored clips and rigid-transform GPU atlas.

Run with Blender --background --factory-startup --python-exit-code 1 --python this.py.
No cloud services; the original mesh, UVs and PBR maps are retained.
"""
import bpy
import json
import math
import shutil
import struct
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/infantry'
DOC = ROOT / 'docs/infantry'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / 'tripo_convert_299d1949-842a-4082-b69e-3a43beb1f36e.glb'
if not SOURCE.is_file(): raise RuntimeError('BLOCKED: missing original Tripo model')
shutil.copyfile(SOURCE, OUT / 'source.glb')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
body = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
body.name = 'TripoInfantry'
H = 0.48
scale = H / body.dimensions.z
world = body.matrix_world.copy()
normal_rotation = Matrix.Rotation(-math.pi/2, 3, 'Z') @ world.to_3x3().inverted().transposed()
source_normals = [normal_rotation @ n.vector for n in body.data.corner_normals]
# Explicitly transform source geometry once; all rig coordinates are game units.
for vertex in body.data.vertices:
    p = world @ vertex.co
    vertex.co = Vector(((p.y + 0.006928)*scale, -(p.x + 0.10)*scale, p.z*scale))
body.matrix_world = Matrix.Identity(4)
body.data.update()
body.data.normals_split_custom_set([n.normalized() for n in source_normals])
rig_data = bpy.data.armatures.new('InfantrySkeleton')
rig = bpy.data.objects.new('InfantryRig', rig_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True); body.select_set(False)
bpy.ops.object.mode_set(mode='EDIT')

def v(x,y,z): return Vector((x*H,y*H,z*H))
def bone(name, head, tail, parent=None):
    b = rig_data.edit_bones.new(name); b.head=head; b.tail=tail
    if parent: b.parent=rig_data.edit_bones[parent]
    return b

bone('pelvis',v(0,0,.53),v(0,0,.60))
bone('spine',v(0,0,.56),v(0,0,.82),'pelvis')
bone('head',v(0,0,.84),v(0,0,.98),'spine')
bone('weapon',v(0,-.16,.64),v(0,-.36,.60),'spine')
for side, sign in [('L',1),('R',-1)]:
    bone('thigh_'+side,v(sign*.105,0,.53),v(sign*.105,-.015,.32),'pelvis')
    bone('shin_'+side,v(sign*.105,-.015,.32),v(sign*.105,.012,.055),'thigh_'+side)
    bone('foot_'+side,v(sign*.105,.012,.055),v(sign*.105,-.10,.025),'shin_'+side)
    bone('upperarm_'+side,v(sign*.175,0,.79),v(sign*.19,.015,.65),'spine')
    bone('forearm_'+side,v(sign*.19,.015,.65),v(sign*.07,-.20,.61),'upperarm_'+side)
bpy.ops.object.mode_set(mode='OBJECT')
names = [b.name for b in rig.data.bones]
rest = {b.name:b.matrix_local.copy() for b in rig.data.bones}
for name in names: body.vertex_groups.new(name=name)

def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)))
    return t*t*(3-2*t)

def weights(p):
    x,y,z = p/H; side='L' if x>=0 else 'R'
    # Rigid armor cores. Blends are limited to narrow anatomical seams.
    if z>.84 and y<.10: return {'head':1}
    if z<.485:
        if z<.065: return {'foot_'+side:1}
        if z<.305: return {'shin_'+side:1}
        if z<.345:
            w=smooth(.305,.345,z); return {'thigh_'+side:w,'shin_'+side:1-w}
        if z<.455: return {'thigh_'+side:1}
        w=smooth(.455,.485,z); return {'pelvis':w,'thigh_'+side:1-w}
    # The forward rifle, sight and grip area receive a single rigid transform.
    if -y>.115 and .525<z<.76: return {'weapon':1}
    if abs(x)>.145 and .54<z<.85:
        if z>.70: return {'upperarm_'+side:1}
        return {'forearm_'+side:1}
    if z<.575: return {'pelvis':1}
    return {'spine':1}

# Quantize seam coordinates so coincident UV/normal seam vertices move together.
seam_weights={}; assignments=[]
for vertex in body.data.vertices:
    key=tuple(round(float(c),6) for c in vertex.co)
    w=seam_weights.setdefault(key,weights(vertex.co))
    w={name:weight for name,weight in w.items() if weight>1e-6}
    total=sum(w.values()); w={name:weight/total for name,weight in w.items()}
    for name,weight in w.items(): body.vertex_groups[name].add([vertex.index],weight,'REPLACE')
    assignments.append(w)
modifier=body.modifiers.new('Infantry armature','ARMATURE'); modifier.object=rig
body.parent=rig
rig.show_in_front=True
scene=bpy.context.scene; scene.render.fps=30
C=Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
clips=[('idle',2.4,True,0),('walk',1.25,True,.22*H/(.62*1.25)),
       ('run',.82,True,.40*H/(.43*.82)),('fire',.6,True,0),
       ('crouch',1.5,False,0),('hit',.65,False,0),('death',1.9,False,0)]

def around(point,rotation): return Matrix.Translation(point) @ rotation.to_4x4() @ Matrix.Translation(-point)
def segment(name,head,tail):
    # Preserve the rest bone roll: shortest-arc rotation maps the rest axis.
    b=rig.data.bones[name]
    q=(b.tail_local-b.head_local).normalized().rotation_difference((tail-head).normalized())
    return Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-b.head_local) @ rest[name]

def pose(clip,t,duration):
    p=t/duration; wave=math.sin(p*math.tau)
    pelvis=v(0,0,.53); lean=.006*wave; roll=.006*math.cos(p*math.tau)
    if clip in ('run','walk'):
        run=clip=='run'; pelvis=v(.013*wave,0,(.485 if run else .505)+(.014 if run else .006)*math.cos(p*math.tau*2))
        lean=.075 if run else .025; roll=.012*wave
    if clip=='idle': pelvis.z+=H*.002*wave
    if clip=='crouch':
        a=smooth(0,.55,p); pelvis+=v(0,.10*a,-.18*a); lean=.15*a
    if clip=='hit': lean=-.13*math.sin(math.pi*p)*math.exp(-2*p); roll=.08*math.sin(math.tau*p)*math.exp(-2*p)
    globalD=Matrix.Identity(4)
    if clip=='death':
        a=smooth(.10,.95,p); globalD=around(v(0,0,.02),Quaternion((1,0,0),-1.5*a).to_matrix())
        pelvis+=v(0,0,-.05*math.sin(math.pi*p))
    pelvisD=globalD @ Matrix.Translation(pelvis-v(0,0,.53))
    spineD=pelvisD @ around(v(0,0,.55),Quaternion((1,0,0),lean).to_matrix()) @ around(v(0,0,.55),Quaternion((0,1,0),roll).to_matrix())
    recoil=0
    if clip=='fire':
        recoil=.009*H*math.exp(-((p*2)%1)*18)
        spineD=spineD @ Matrix.Translation((0,recoil*.45,0))
    desired={'pelvis':pelvisD@rest['pelvis'],'spine':spineD@rest['spine'],
             'head':spineD@around(v(0,0,.84),Quaternion((0,0,1),.015*wave if clip=='idle' else 0).to_matrix())@rest['head'],
             'weapon':spineD@Matrix.Translation((0,recoil,0))@rest['weapon']}
    for side,sign in [('L',1),('R',-1)]:
        hip=pelvisD@v(sign*.105,0,.53)
        ankle=v(sign*.105,.012,.055)
        footpitch=0
        if clip in ('run','walk'):
            run=clip=='run'; f=(p+(0 if sign>0 else .5))%1; stance=.43 if run else .62; stride=(.40 if run else .22)*H
            if f<stance: ankle.y+=-stride/2+stride*f/stance
            else:
                u=(f-stance)/(1-stance); ankle.y+=stride/2-stride*smooth(0,1,u)
                ankle.z+=math.sin(math.pi*u)*H*(.13 if run else .065)
                footpitch=.12*math.sin(math.tau*u)
        if clip=='death': ankle=globalD@ankle
        l1=(rig.data.bones['thigh_'+side].tail_local-rig.data.bones['thigh_'+side].head_local).length
        l2=(rig.data.bones['shin_'+side].tail_local-rig.data.bones['shin_'+side].head_local).length
        delta=ankle-hip; d=min(max(delta.length,abs(l2-l1)+.0001),l1+l2-.00001); direction=delta.normalized()
        a=(l1*l1-l2*l2+d*d)/(2*d); height=math.sqrt(max(0,l1*l1-a*a))
        bend=Vector((0,-1,0)); bend=(bend-direction*bend.dot(direction)).normalized()
        knee=hip+direction*a+bend*height
        desired['thigh_'+side]=segment('thigh_'+side,hip,knee)
        desired['shin_'+side]=segment('shin_'+side,knee,ankle)
        footD=Matrix.Translation(ankle) @ Quaternion((1,0,0),footpitch).to_matrix().to_4x4() @ Matrix.Translation(-v(sign*.105,.012,.055))
        if clip=='death': footD=globalD
        desired['foot_'+side]=footD@rest['foot_'+side]
        for part in ['upperarm_','forearm_']:
            desired[part+side]=spineD@Matrix.Translation((0,recoil,0))@rest[part+side]
    # Ground support correction, evaluated from the same weights as the armature.
    # Important during the terminal fall: keep all source equipment above the floor.
    if clip=='death':
        min_z=0
        deltas={n:desired[n]@rest[n].inverted() for n in names}
        for vertex,w in zip(body.data.vertices,assignments):
            pos=sum(((deltas[n]@vertex.co)*weight for n,weight in w.items()),Vector((0,0,0)))
            min_z=min(min_z,pos.z)
        if min_z<0:
            support=Matrix.Translation((0,0,-min_z))
            desired={n:support@m for n,m in desired.items()}
    for name in names:
        rig.pose.bones[name].rotation_mode='QUATERNION'
        rig.pose.bones[name].matrix=desired[name]
        bpy.context.view_layer.update()

atlas=[]; manifest=[]; frame_offset=0
for name,duration,loop,speed in clips:
    frames=max(2,round(duration*30)); duration=frames/30
    if name in ('walk','run'):
        speed=(.40 if name=='run' else .22)*H/((.43 if name=='run' else .62)*duration)
    action=bpy.data.actions.new(name); rig.animation_data_create(); rig.animation_data.action=action
    for frame in range(frames+1):
        scene.frame_set(frame)
        pose(name,frame/30,duration)
        for b in rig.pose.bones:
            b.keyframe_insert(data_path='location',frame=frame)
            b.keyframe_insert(data_path='rotation_quaternion',frame=frame)
            b.keyframe_insert(data_path='scale',frame=frame)
    # Export as named NLA tracks, one clip per action.
    rig.animation_data.action=None
    track=rig.animation_data.nla_tracks.new(); track.name=name
    strip=track.strips.new(name,0,action); strip.action_frame_start=0; strip.action_frame_end=frames
    track.mute=True
    rig.animation_data.action=action
    lo=Vector((1e9,1e9,1e9)); hi=-lo
    for frame in range(frames+1):
        scene.frame_set(frame); bpy.context.view_layer.update()
        for bone_name in names:
            delta=C @ (rig.pose.bones[bone_name].matrix @ rest[bone_name].inverted()) @ C.inverted()
            q=delta.to_quaternion().normalized(); tr=delta.translation
            atlas.extend([q.x,q.y,q.z,q.w,tr.x,tr.y,tr.z,0])
        evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        for vertex in evaluated.data.vertices:
            p3=C@vertex.co
            for axis in range(3): lo[axis]=min(lo[axis],p3[axis]); hi[axis]=max(hi[axis],p3[axis])
    manifest.append({'name':name,'duration':duration,'frames':frames+1,'offset':frame_offset,
                     'loop':loop,'movementSpeed':speed,'bounds':{'min':list(lo),'max':list(hi)}})
    frame_offset+=frames+1
    rig.animation_data.action=None

# RGBA16F, two texels per bone, one row per animation frame. No float render target.
with (OUT/'animation.rgba16f').open('wb') as f:
    for value in atlas: f.write(struct.pack('<e',value))
metadata={'schemaVersion':1,'method':'baked-rigid-bone-texture','fps':30,'height':H,
          'metersPerUnit':3.75,'forward':'+Z','bones':names,'width':len(names)*2,
          'heightTexels':frame_offset,'format':'RGBA16F','clips':manifest,
          'byteLength':len(atlas)*2,'sourceSha256':__import__('hashlib').sha256(SOURCE.read_bytes()).hexdigest()}
(OUT/'animation.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
(DOC/'vertex-segmentation.json').write_text(json.dumps({'bones':names,'weights':assignments},indent=2),encoding='utf-8')
for track in rig.animation_data.nla_tracks: track.mute=False
scene.frame_set(0)
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'infantry-rigged.glb'),use_selection=True,export_format='GLB',
                          export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True)
for track in rig.animation_data.nla_tracks: track.mute=True
rig.animation_data.action=bpy.data.actions.get('idle'); scene.frame_set(0)
scene.frame_start=0;scene.frame_end=71
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'infantry-work.blend'))
print('INFANTRY_ASSET='+json.dumps({'bones':len(names),'clips':manifest,'atlas_bytes':len(atlas)*2}))
