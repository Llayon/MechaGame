"""Blender 5.2 CLI: non-destructive candidate LODs and real selected-to-active normals.

blender --background --factory-startup --python-exit-code 1 --python scripts/infantry/build_candidate_lods.py
"""
import bpy
import bmesh
import hashlib
import json
import math
import shutil
import struct
import sys
from pathlib import Path
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/infantry-candidate'
DOC=ROOT/'docs/infantry/candidate-lods'
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'textures').mkdir(exist_ok=True)
(DOC/'images').mkdir(parents=True,exist_ok=True)
SOURCE=Path(r'D:\Programms\Max\Assets\textured_mesh 1.glb')
if '--source' in sys.argv: SOURCE=Path(sys.argv[sys.argv.index('--source')+1])
if not SOURCE.is_file(): SOURCE=OUT/'source.glb'
if not SOURCE.is_file(): raise RuntimeError('BLOCKED: candidate source is missing')
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
if SOURCE.resolve()!=(OUT/'source.glb').resolve(): shutil.copyfile(SOURCE,OUT/'source.glb')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
high=next(o for o in bpy.context.scene.objects if o.type=='MESH')
high.name='Candidate_Source_40k'
coords=[high.matrix_world@v.co for v in high.data.vertices]
lo=Vector([min(p[k] for p in coords) for k in range(3)])
hi=Vector([max(p[k] for p in coords) for k in range(3)])
height=.48
normalization=Matrix.Scale(height/(hi.z-lo.z),4)@Matrix.Translation(-Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z)))
world=high.matrix_world.copy()
for v in high.data.vertices:v.co=normalization@world@v.co
high.matrix_world=Matrix.Identity(4)
high.data.update()
high.data.calc_loop_triangles()
original_mat=high.data.materials[0]
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8
scene.render.threads_mode='FIXED';scene.render.threads=6
scene.render.bake.use_selected_to_active=True
scene.render.bake.use_cage=True
scene.render.bake.cage_extrusion=.005
scene.render.bake.max_ray_distance=.02
scene.render.bake.normal_space='TANGENT'
scene.render.bake.normal_r='POS_X';scene.render.bake.normal_g='POS_Y';scene.render.bake.normal_b='POS_Z'
scene.render.bake.use_clear=False
scene.render.bake.margin_type='EXTEND'

def select(obj):
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj

def triangles(obj):
 obj.data.calc_loop_triangles();return len(obj.data.loop_triangles)

def repair_export_tangents(path):
 """Repair a rare zero Mikk tangent with that corner's actual UV derivative."""
 data=bytearray(path.read_bytes());length=struct.unpack_from('<I',data,12)[0]
 gltf=json.loads(data[20:20+length]);base=28+length;primitive=gltf['meshes'][0]['primitives'][0]
 def values(index):
  a=gltf['accessors'][index];view=gltf['bufferViews'][a['bufferView']]
  width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
  code={5126:'f',5123:'H',5125:'I'}[a['componentType']];size=struct.calcsize(code)
  offsets=[base+view.get('byteOffset',0)+a.get('byteOffset',0)+i*view.get('byteStride',size*width) for i in range(a['count'])]
  return [struct.unpack_from('<'+code*width,data,at) for at in offsets],offsets
 positions,_=values(primitive['attributes']['POSITION']);normals,_=values(primitive['attributes']['NORMAL'])
 uv,_=values(primitive['attributes']['TEXCOORD_0']);tangents,offsets=values(primitive['attributes']['TANGENT'])
 indices,_=values(primitive['indices']);indices=[v[0] for v in indices];repaired=0
 for vertex,tangent in enumerate(tangents):
  if Vector(tangent[:3]).length>.5:continue
  normal=Vector(normals[vertex]).normalized();replacement=None
  for i in range(0,len(indices),3):
   ids=indices[i:i+3]
   if vertex not in ids:continue
   a,b,c=[Vector(positions[j]) for j in ids];ta,tb,tc=[Vector(uv[j]) for j in ids]
   e1=b-a;e2=c-a;du1=tb-ta;du2=tc-ta;det=du1.x*du2.y-du1.y*du2.x
   if abs(det)<1e-15:continue
   s=(e1*du2.y-e2*du1.y)/det;t=(e2*du1.x-e1*du2.x)/det
   direction=s-normal*s.dot(normal)
   if direction.length<1e-10:continue
   direction.normalize();sign=-1 if normal.cross(direction).dot(t)<0 else 1
   replacement=(*direction,sign);break
  if replacement is None:raise RuntimeError('No valid UV derivative for tangent repair')
  struct.pack_into('<4f',data,offsets[vertex],*replacement);repaired+=1
 if repaired:path.write_bytes(data)
 return repaired

def components(mesh):
 adjacency=[[] for _ in mesh.vertices]
 for e in mesh.edges:
  a,b=e.vertices;adjacency[a].append(b);adjacency[b].append(a)
 seen=set();count=0
 for v in mesh.vertices:
  if v.index in seen:continue
  count+=1;stack=[v.index];seen.add(v.index)
  while stack:
   for j in adjacency[stack.pop()]:
    if j not in seen:seen.add(j);stack.append(j)
 return count

def tree(obj):
 return BVHTree.FromPolygons([v.co for v in obj.data.vertices],[list(p.vertices) for p in obj.data.polygons],all_triangles=True)

high_tree=tree(high)
texture_cache={}
def resized(image,size):
 key=(image.name,size)
 if key in texture_cache:return texture_cache[key]
 copy=image.copy();copy.name=f'{image.name}_{size}';copy.scale(size,size)
 role='basecolor' if image.colorspace_settings.name=='sRGB' else 'metallic-roughness'
 suffix='jpg' if role=='basecolor' else 'png'
 copy.filepath_raw=str(OUT/'textures'/f'{role}-{size}.{suffix}');copy.file_format='JPEG' if suffix=='jpg' else 'PNG'
 copy.save(quality=95)
 # Image.copy retains the original packed bytes even after resizing its pixels.
 # Reload the saved PNG so glTF's packed-image fast path embeds the new resolution.
 prepared=bpy.data.images.load(copy.filepath_raw,check_existing=False)
 prepared.colorspace_settings.name=image.colorspace_settings.name;prepared.pack()
 bpy.data.images.remove(copy)
 texture_cache[key]=prepared
 return prepared

records=[];lods=[]
report={'schemaVersion':1,'sourceSha256':source_hash,'blender':bpy.app.version_string,
 'source':{'triangles':triangles(high),'vertices':len(high.data.vertices),'components':components(high.data),
 'originalDimensionsBlenderXYZ':list(hi-lo),'hasRig':False},
 'normalization':{'heightGameUnits':height,'metersPerUnit':3.75,'heightMeters':1.8,'gltfForward':'+Z','gltfUp':'+Y','grounded':True},
 'method':'weld coincident seam vertices; quadric collapse decimation; per-LOD selected-to-active tangent normal bake',
 'bake':{'normalSpace':'tangent OpenGL +Y','cageExtrusion':.005,'maxRayDistance':.02,'floatRenderTargetRequired':False},
 'lods':records,'limitations':['Static A-pose assets only; no rig or animation included',
 'Decimation does not produce animation-ready joint loops; deformation QA remains required',
 'Normal maps transfer existing geometric shading, not relief inferred from painted colors',
 'LODs carry their own normals and must not interchange normal maps']}

for level,target,size in [(0,4000,1024),(1,2000,512),(2,1000,256)]:
 low=high.copy();low.data=high.data.copy();bpy.context.collection.objects.link(low)
 low.name=f'Candidate_LOD{level}'
 select(low)
 bm=bmesh.new();bm.from_mesh(low.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=height*1e-6)
 bm.to_mesh(low.data);bm.free();low.data.update()
 welded_vertices=len(low.data.vertices)
 modifier=low.modifiers.new('Geometry reduction','DECIMATE');modifier.decimate_type='COLLAPSE'
 modifier.ratio=target/triangles(low);modifier.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=modifier.name)
 low.data.validate(clean_customdata=True)
 low.data.update()
 # Recompute the low-poly shading basis after topology changes. The original
 # split normals belong to the 40k topology; the bake restores its shading.
 low.data.normals_split_custom_set([(0.0,0.0,0.0)]*len(low.data.loops))
 low.data.update()
 # Collapsing a UV seam can leave a triangle with zero UV area. Give only
 # those faces a subpixel patch around their existing UV center; otherwise
 # MikkTSpace exports a zero tangent and normal mapping is undefined there.
 uv=low.data.uv_layers.active.data
 repaired_uv=0
 for face in low.data.polygons:
  ids=list(face.loop_indices)
  a,b,c=[uv[i].uv.copy() for i in ids]
  if abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))>=1e-12:continue
  points=[low.data.vertices[low.data.loops[i].vertex_index].co for i in ids]
  center=sum(points,Vector())/3
  u=(points[1]-points[0]).normalized();v=face.normal.cross(u).normalized()
  span=max((point-center).length for point in points)
  uv_center=(a+b+c)/3
  for i,point in zip(ids,points):uv[i].uv=uv_center+Vector(((point-center).dot(u),(point-center).dot(v)))*(1e-4/max(span,1e-8))
  repaired_uv+=1
 low.data.update()
 material=original_mat.copy();material.name=f'Candidate_PBR_LOD{level}'
 low.data.materials.clear();low.data.materials.append(material)
 for n in material.node_tree.nodes:
  if n.type=='TEX_IMAGE' and n.image:n.image=resized(n.image,size)
 normal=bpy.data.images.new(f'Candidate_Normal_LOD{level}',width=size,height=size,alpha=False,is_data=True)
 normal.generated_color=(.5,.5,1,1);normal.colorspace_settings.name='Non-Color'
 node=material.node_tree.nodes.new('ShaderNodeTexImage');node.name='Baked tangent normal';node.image=normal
 for n in material.node_tree.nodes:n.select=False
 node.select=True;material.node_tree.nodes.active=node
 for obj in [high]+lods:obj.hide_render=True;obj.hide_set(True)
 high.hide_render=False;high.hide_set(False);low.hide_render=False;low.hide_set(False)
 select(low);high.select_set(True)
 scene.render.bake.margin=8 if size==1024 else 4
 print(f'BAKING LOD{level}: {triangles(low)} triangles, {size}px',flush=True)
 bpy.ops.object.bake(type='NORMAL')
 pixels=np.asarray(normal.pixels[:],dtype=np.float32).reshape((-1,4))
 assert np.isfinite(pixels).all()
 nonflat=np.count_nonzero(np.linalg.norm(pixels[:,:3]-np.array([.5,.5,1]),axis=1)>.03)
 assert nonflat>size*size*.01,'Bake is unexpectedly flat'
 normal.filepath_raw=str(OUT/'textures'/f'normal-lod{level}-{size}.png');normal.file_format='PNG';normal.save();normal.pack()
 map_node=material.node_tree.nodes.new('ShaderNodeNormalMap');map_node.space='TANGENT';map_node.inputs['Strength'].default_value=1
 material.node_tree.links.new(node.outputs['Color'],map_node.inputs['Color'])
 shader=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 material.node_tree.links.new(map_node.outputs['Normal'],shader.inputs['Normal'])
 low_tree=tree(low)
 to_source=np.array([high_tree.find_nearest(v.co)[3] for v in low.data.vertices])
 step=max(1,len(high.data.vertices)//5000)
 from_source=np.array([low_tree.find_nearest(high.data.vertices[i].co)[3] for i in range(0,len(high.data.vertices),step)])
 stats=lambda a:{'p50Meters':float(np.percentile(a,50)*3.75),'p95Meters':float(np.percentile(a,95)*3.75),
                  'p99Meters':float(np.percentile(a,99)*3.75),'maxMeters':float(np.max(a)*3.75)}
 record={'level':level,'targetTriangles':target,'triangles':triangles(low),'vertices':len(low.data.vertices),
 'weldedSourceVertices':welded_vertices,'components':components(low.data),'materials':len(low.data.materials),
 'uvLayers':len(low.data.uv_layers),'repairedDegenerateUvFaces':repaired_uv,'textureResolution':size,'normalNonflatPixels':int(nonflat),
 'geometryReduction':triangles(high)/triangles(low),'surfaceErrorLowToSource':stats(to_source),
 'surfaceErrorSourceToLow':stats(from_source),'normalMap':f'textures/normal-lod{level}-{size}.png'}
 select(low)
 low.data.validate(clean_customdata=True)
 filepath=OUT/f'infantry-candidate-lod{level}.glb'
 bpy.ops.export_scene.gltf(filepath=str(filepath),export_format='GLB',use_selection=True,export_yup=True,
  export_animations=False,export_tangents=True,export_materials='EXPORT')
 record['repairedExportTangents']=repair_export_tangents(filepath)
 record['glb']=filepath.name;record['glbBytes']=filepath.stat().st_size
 records.append(record);lods.append(low)
 high.hide_render=True;high.hide_set(True)
 low.hide_render=True;low.hide_set(True)
 (DOC/'metrics.json').write_text(json.dumps(report,indent=2),encoding='utf-8')

# Preserve a complete reproducible working file including original geometry and maps.
for obj in [high]+lods:obj.hide_render=True;obj.hide_set(True)
lods[0].hide_set(False);lods[0].hide_render=False
select(lods[0]);scene.render.bake.use_selected_to_active=False
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'candidate-lods.blend'))
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
print('CANDIDATE_LODS='+json.dumps(report),flush=True)
