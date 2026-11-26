import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SectorId } from '../map/sectors';

import { mapStartup } from '../map/mapStartup';
export const lastStage = 11;
const sectors = ['airfield', 'crossing', 'refinery', 'citadel'] as const;
let geometry: THREE.BufferGeometry[] | undefined;
const material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
export const landmarksReady = () => geometry !== undefined;

export async function loadLandmarks(signal: AbortSignal) {
  if (!mapStartup.landmarks || geometry) return;
  const [response, image] = await Promise.all([
    fetch(import.meta.env.BASE_URL + 'landmarks.bin.gz', {signal}),
    fetch(import.meta.env.BASE_URL + 'landmark-color.webp', {signal}).then(async r => {
      if (!r.ok) throw Error('Landmark colors unavailable');
      return createImageBitmap(await r.blob(), {imageOrientation:'flipY',colorSpaceConversion:'none'});
    })
  ]);
  if (!response.ok || !response.body) throw Error('Landmark preview unavailable');
  const bytes = await response.arrayBuffer();
  const signature = new Uint8Array(bytes, 0, 2);
  const data = signature[0] === 0x1f && signature[1] === 0x8b
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    : bytes;
  const view = new DataView(data);
  let at = 0;
  const count = () => {const n = view.getUint32(at,true); at+=4; return n;};
  const groups = sectors.map(() => {
    const vertices=count(), indices=count();
    const positions=new Float32Array(vertices*3), colors=new Uint8Array(vertices*3);
    for(let v=0;v<vertices*3;v++){positions[v]=view.getInt16(at,true)/32;at+=2;}
    colors.set(new Uint8Array(data,at,vertices*3));at+=vertices*3;
    const faces=new Uint32Array(indices);
    for(let i=0;i<indices;i++) faces[i]=count();
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(positions,3));
    g.setAttribute('color',new THREE.BufferAttribute(colors,3,true));
    g.setIndex(new THREE.BufferAttribute(faces,1));
    g.computeVertexNormals();
    const normals=g.getAttribute('normal');
    const uv=new Float32Array(vertices*2);
    for(let i=0;i<vertices;i++){
      if(normals.getY(i)>.58){
        uv[i*2]=.5+positions[i*3]/400;
        uv[i*2+1]=.5-positions[i*3+2]/400;
        colors.fill(255,i*3,i*3+3);
      } else {
        uv[i*2]=.006; uv[i*2+1]=.994;
        for(let c=0;c<3;c++) colors[i*3+c]=Math.round(colors[i*3+c]*.56);
      }
    }
    g.deleteAttribute('normal');
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    g.computeBoundingSphere();
    return g;
  });
  if (!signal.aborted) {
    const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
    material.map=texture;material.needsUpdate=true;geometry=groups;
  } else {image.close();groups.forEach(g=>g.dispose());}
}

export function LandmarkMeshes({stage, keepCrossing, select}:{stage:number;keepCrossing:boolean;select:(v:SectorId)=>void}) {
  return <group name="overview-landmarks" dispose={null}>{geometry?.map((g,i)=>(stage < i+1 || (keepCrossing && sectors[i] === 'crossing')) &&
    <mesh key={i} geometry={g} material={material} onClick={e=>{e.stopPropagation();select(sectors[i]);}} />
  )}</group>;
}

export function StageDriver({stage,advance,paused,limit=lastStage}:{stage:number;advance:()=>void;paused:boolean;limit?:number}) {
  const invalidate=useThree(s=>s.invalidate);
  useEffect(()=>{
    if (paused || stage>=limit) return;
    let id=0, timer=0;
    // Each layer must have a chance to reach the screen before queuing another.
    id=requestAnimationFrame(()=>{invalidate(); id=requestAnimationFrame(()=>{
      const schedule = () => {
        const firstDraw=performance.getEntriesByName('overview-first-draw')[0];
        if(stage===0 && !firstDraw){invalidate();id=requestAnimationFrame(schedule);return;}
        const delay=stage===0 ? Math.max(90, firstDraw.startTime+450-performance.now()) : 90;
        timer=window.setTimeout(advance,delay);
      };
      id=requestAnimationFrame(schedule);
    });});
    return ()=>{cancelAnimationFrame(id);clearTimeout(timer);};
  },[stage,advance,paused,invalidate,limit]);
  return null;
}
