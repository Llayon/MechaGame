"""GLB tangent validation shared by candidate asset builders."""
import json
import struct
from mathutils import Vector

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

