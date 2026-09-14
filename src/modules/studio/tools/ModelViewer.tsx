import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls, Stage, useGLTF } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import ToolShell from './ToolShell';
import Icon from '../../../design-system/icons/Icon';

type Prefs={version:2;background:string;autoRotate:boolean;showGrid:boolean;stageIntensity:number};
function Model({url}:{url:string}){const {scene}=useGLTF(url);return <primitive object={scene}/>;}

export default function ModelViewer({boardId,onExit}:{boardId:string;onExit:()=>void}){
 const key=`xfactor-studio-modelviewer2-${boardId}`;
 const [url,setUrl]=useState<string|null>(null),[fileName,setFileName]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
 const [background,setBackground]=useState('#05080d'),[autoRotate,setAutoRotate]=useState(false),[showGrid,setShowGrid]=useState(true),[stageIntensity,setStageIntensity]=useState(.6);
 const objectUrlRef=useRef<string|null>(null), controlsRef=useRef<OrbitControlsImpl|null>(null);
 useEffect(()=>{try{const raw=localStorage.getItem(key);if(!raw)return;const p=JSON.parse(raw) as Partial<Prefs>;if(typeof p.background==='string')setBackground(p.background);if(typeof p.autoRotate==='boolean')setAutoRotate(p.autoRotate);if(typeof p.showGrid==='boolean')setShowGrid(p.showGrid);if(typeof p.stageIntensity==='number')setStageIntensity(Math.max(0,Math.min(2,p.stageIntensity)));}catch{/*defaults*/}},[key]);
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify({version:2,background,autoRotate,showGrid,stageIntensity} satisfies Prefs));}catch{/*non-critical*/}},[key,background,autoRotate,showGrid,stageIntensity]);
 useEffect(()=>()=>{if(objectUrlRef.current)URL.revokeObjectURL(objectUrlRef.current);},[]);
 function onFile(file:File|null){if(!file)return;setError(null);if(!/\.(glb|gltf)$/i.test(file.name)){setError('Use a .glb or self-contained .gltf file.');return;}if(objectUrlRef.current)URL.revokeObjectURL(objectUrlRef.current);const next=URL.createObjectURL(file);objectUrlRef.current=next;setUrl(next);setFileName(file.name);}
 return <ToolShell title="3D MODEL VIEWER 2.0" onExit={onExit}><div data-testid="model-viewer-2-root" className="toolCol">
  <div className="toolRow"><label className="toolDrop">{fileName?`LOADED: ${fileName}`:'UPLOAD .GLB / .GLTF'}<input type="file" accept=".glb,.gltf" hidden onChange={e=>onFile(e.target.files?.[0]??null)}/></label><button className="chip" onClick={()=>controlsRef.current?.reset()} disabled={!url}>RESET VIEW</button>{error&&<span className="toolHint" style={{color:'var(--magenta)'}}>{error}</span>}</div>
  <div className="toolRow"><label className="toolField">BACKGROUND<input type="color" value={background} onChange={e=>setBackground(e.target.value)}/></label><label className="toolField">LIGHT {stageIntensity.toFixed(1)}<input type="range" min={0} max={2} step={.1} value={stageIntensity} onChange={e=>setStageIntensity(+e.target.value)}/></label><label className="toolField"><span><input type="checkbox" checked={autoRotate} onChange={e=>setAutoRotate(e.target.checked)}/> AUTO ROTATE</span></label><label className="toolField"><span><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/> GRID</span></label></div>
  <div className="toolCanvasWrap" style={{width:'100%',maxWidth:760,height:500,marginTop:10,background}}>{url?<Canvas camera={{position:[3,2,5],fov:45}} dpr={[1,2]} gl={{preserveDrawingBuffer:true}}><color attach="background" args={[background]}/><Suspense fallback={null}><Stage environment="city" intensity={stageIntensity}><Model url={url}/></Stage></Suspense>{showGrid&&<Grid position={[0,-1,0]} args={[10,10]} cellSize={.5} sectionSize={2} fadeDistance={20}/>}<OrbitControls ref={controlsRef} makeDefault enableDamping autoRotate={autoRotate}/></Canvas>:<div className="toolHint" style={{display:'flex',height:'100%',alignItems:'center',justifyContent:'center',gap:6}}><Icon name="hexagon" size={14}/>Upload a model — drag to orbit, wheel to zoom, right-drag to pan.</div>}</div>
  <div className="toolHint">Viewer settings persist per board. Uploaded model binaries are intentionally session-only; this tool previews models and does not claim editing/export capabilities.</div>
 </div></ToolShell>;
}
