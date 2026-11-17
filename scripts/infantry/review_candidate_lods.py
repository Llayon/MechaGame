"""Reimport exported candidate GLBs; render PBR and neutral-normal comparisons."""
import bpy, json, math, sys
from pathlib import Path
import numpy as np
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/assets/infantry-candidate';DOC=ROOT/'docs/infantry/candidate-lods'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'candidate-lods.blend'))
high=bpy.data.objects['Candidate_Source_40k']
for obj in list(bpy.context.scene.objects):
 if obj!=high:bpy.data.objects.remove(obj,do_unlink=True)
high.hide_set(False);high.hide_render=True
lods=[];roundtrip=[]
for level in range(3):
 before=set(bpy.context.scene.objects)
 bpy.ops.import_scene.gltf(filepath=str(OUT/f'infantry-candidate-lod{level}.glb'))
 obj=next(o for o in bpy.context.scene.objects if o not in before and o.type=='MESH')
 obj.name=f'Exported_LOD{level}';obj.hide_render=True
 obj.data.calc_loop_triangles()
 material=obj.data.materials[0]
 normals=[n for n in material.node_tree.nodes if n.type=='NORMAL_MAP']
 assert len(normals)==1 and normals[0].inputs['Color'].is_linked
 maps=[n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]
 unique={im.name:im for im in maps}
 positions=[obj.matrix_world@v.co for v in obj.data.vertices]
 height=max(p.z for p in positions)-min(p.z for p in positions)
 assert abs(height-.48)<.002,'Unexpected height loss'
 assert abs(min(p.z for p in positions))<.002,'Feet not grounded'
 roundtrip.append({'level':level,'meshes':1,'triangles':len(obj.data.loop_triangles),'renderVertices':len(obj.data.vertices),
  'maps':[{'name':im.name,'size':list(im.size),'colorspace':im.colorspace_settings.name} for im in unique.values()],
  'height':height,'normalMapLinked':True,'normalSpace':normals[0].space})
 lods.append(obj)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=6
scene.render.film_transparent=True
scene.world.color=(.12,.12,.12)
for pos,energy,size in [((1,-1.8,2.5),100,2),((-1,-1,1),45,1),((0,1,1.2),70,1)]:
 data=bpy.data.lights.new('Review area','AREA');data.energy=energy;data.size=size
 light=bpy.data.objects.new('Review area',data);scene.collection.objects.link(light);light.location=pos
 light.rotation_euler=(Vector((0,0,.24))-light.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Review camera');camera=bpy.data.objects.new('Review camera',data);scene.collection.objects.link(camera);scene.camera=camera
data.type='ORTHO';data.ortho_scale=.63
scene.render.resolution_x=640;scene.render.resolution_y=768;scene.render.resolution_percentage=100
objects=[high]+lods
def show(visible):
 for obj in objects:obj.hide_render=obj not in visible;obj.hide_set(False)
def render(name):
 path=DOC/'images'/(name+'.png');scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
 return mask_from(path)
def mask_from(path):
 image=bpy.data.images.load(str(path),check_existing=False)
 p=np.asarray(image.pixels[:],dtype=np.float32).reshape((-1,4));mask=p[:,3]>.5
 bpy.data.images.remove(image)
 return mask
silhouettes={}
for view,pos in [('front',(0,-1.8,.27)),('side',(1.8,0,.27)),('angle',(1.1,-1.8,.5))]:
 camera.location=pos;camera.rotation_euler=(Vector((0,0,.24))-camera.location).to_track_quat('-Z','Y').to_euler()
 masks=[]
 for index,obj in enumerate(objects):
  name=('source' if index==0 else f'lod{index-1}')+'-'+view
  show([obj]);masks.append(mask_from(DOC/'images'/(name+'.png')) if '--finish' in sys.argv else render(name))
 silhouettes[view]=[{'level':i,'intersectionOverUnion':float(np.count_nonzero(mask&masks[0])/np.count_nonzero(mask|masks[0]))} for i,mask in enumerate(masks[1:])]
# Side-by-side PBR comparison with the same camera and illumination.
show(objects);scene.render.film_transparent=False
scene.cycles.use_denoising=False
scene.render.resolution_x=2000;scene.render.resolution_y=800
data.ortho_scale=1.85
for index,obj in enumerate(objects):obj.location.x=(index-1.5)*.4
camera.location=(0,-2,.3);camera.rotation_euler=(Vector((0,0,.24))-camera.location).to_track_quat('-Z','Y').to_euler()
for index,label in enumerate(['SOURCE 40,000','LOD0 3,999','LOD1 1,999','LOD2 999']):
 font=bpy.data.curves.new(label,'FONT');font.body=label;font.align_x='CENTER';font.size=.018
 text=bpy.data.objects.new(label,font);scene.collection.objects.link(text);text.location=((index-1.5)*.4,-.01,.51);text.rotation_euler=(math.pi/2,0,0)
render('comparison')
scene.cycles.use_denoising=True
for obj in objects:obj.location.x=0
for obj in list(scene.objects):
 if obj.type=='FONT':bpy.data.objects.remove(obj,do_unlink=True)
# Isolate geometric shading: same gray material, normal map on/off/source.
scene.render.resolution_x=640;scene.render.resolution_y=768;scene.render.film_transparent=True
camera.location=(1.1,-1.8,.5);camera.rotation_euler=(Vector((0,0,.24))-camera.location).to_track_quat('-Z','Y').to_euler()
data.ortho_scale=.63
for obj,name,enabled in [(high,'clay-source',False),(lods[0],'clay-lod0-normal',True),(lods[0],'clay-lod0-flat',False)]:
 show([obj]);original=list(obj.data.materials)
 mat=bpy.data.materials.new(name);mat.use_nodes=True
 shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 shader.inputs['Base Color'].default_value=(.25,.25,.25,1);shader.inputs['Roughness'].default_value=.45
 if enabled:
  source_mat=original[0]
  source_normal=next(n for n in source_mat.node_tree.nodes if n.type=='NORMAL_MAP')
  texture=source_normal.inputs['Color'].links[0].from_node.image
  im=mat.node_tree.nodes.new('ShaderNodeTexImage');im.image=texture
  nm=mat.node_tree.nodes.new('ShaderNodeNormalMap')
  mat.node_tree.links.new(im.outputs['Color'],nm.inputs['Color']);mat.node_tree.links.new(nm.outputs['Normal'],shader.inputs['Normal'])
 obj.data.materials.clear();obj.data.materials.append(mat);render(name)
 obj.data.materials.clear()
 for m in original:obj.data.materials.append(m)
(DOC/'visual-metrics.json').write_text(json.dumps({'roundtrip':roundtrip,'silhouette':silhouettes,
 'note':'IoU measures static silhouettes only, not deformation or PBR similarity'},indent=2),encoding='utf-8')
print('CANDIDATE_REVIEW='+json.dumps({'roundtrip':roundtrip,'silhouette':silhouettes}))
