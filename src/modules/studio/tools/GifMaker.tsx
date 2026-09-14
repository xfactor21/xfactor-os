import { useEffect, useRef, useState } from 'react';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import ToolShell from './ToolShell';
import Icon from '../../../design-system/icons/Icon';

type FitMode = 'contain' | 'cover';
interface GifFrame { id: string; img: HTMLImageElement; delayMs: number; name: string }
interface GifPrefs { version: 2; loop: boolean; defaultDelay: number; outputName: string; background: string; fit: FitMode }

const safeName = (v: string) => (v.trim() || 'animation').replace(/[^a-z0-9._-]+/gi, '-');

export default function GifMaker({ boardId, onExit }: { boardId: string; onExit: () => void }) {
  const key = `xfactor-studio-gif2-${boardId}`;
  const [frames, setFrames] = useState<GifFrame[]>([]);
  const [loop, setLoop] = useState(true);
  const [defaultDelay, setDefaultDelay] = useState(200);
  const [outputName, setOutputName] = useState('animation');
  const [background, setBackground] = useState('#05080d');
  const [fit, setFit] = useState<FitMode>('contain');
  const [busy, setBusy] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [status, setStatus] = useState('ADD IMAGE FRAMES');
  const fileRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key); if (!raw) return;
      const p = JSON.parse(raw) as Partial<GifPrefs>;
      if (typeof p.loop === 'boolean') setLoop(p.loop);
      if (typeof p.defaultDelay === 'number') setDefaultDelay(Math.max(20, Math.min(5000, p.defaultDelay)));
      if (typeof p.outputName === 'string') setOutputName(p.outputName);
      if (typeof p.background === 'string') setBackground(p.background);
      if (p.fit === 'contain' || p.fit === 'cover') setFit(p.fit);
    } catch { /* defaults */ }
  }, [key]);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ version: 2, loop, defaultDelay, outputName, background, fit } satisfies GifPrefs)); } catch { /* non-critical */ }
  }, [key, loop, defaultDelay, outputName, background, fit]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        setFrames(f => [...f, { id: `${Date.now()}-${Math.random()}`, img, delayMs: defaultDelay, name: file.name }]);
        setStatus('FRAMES READY'); URL.revokeObjectURL(url);
      };
      img.onerror = () => { setStatus(`FAILED TO LOAD ${file.name}`); URL.revokeObjectURL(url); };
      img.src = url;
    });
  }
  const removeFrame = (id: string) => setFrames(f => f.filter(x => x.id !== id));
  function move(id: string, dir: -1 | 1) {
    setFrames(f => { const i=f.findIndex(x=>x.id===id), j=i+dir; if(i<0||j<0||j>=f.length)return f; const n=[...f]; [n[i],n[j]]=[n[j],n[i]]; return n; });
  }
  const setDelay = (id: string, ms: number) => setFrames(f => f.map(x => x.id===id ? {...x,delayMs:Math.max(20,Math.min(5000,ms||20))}:x));

  function drawFrame(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
    ctx.fillStyle = background; ctx.fillRect(0,0,w,h);
    const scale = fit === 'cover' ? Math.max(w/img.naturalWidth,h/img.naturalHeight) : Math.min(w/img.naturalWidth,h/img.naturalHeight);
    const dw=img.naturalWidth*scale, dh=img.naturalHeight*scale;
    ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);
  }

  useEffect(() => {
    const cv=previewCanvasRef.current; if(!cv||!frames.length)return; const ctx=cv.getContext('2d'); if(!ctx)return;
    const w=Math.max(...frames.map(f=>f.img.naturalWidth)), h=Math.max(...frames.map(f=>f.img.naturalHeight)); cv.width=w; cv.height=h;
    const frame=frames[previewIdx%frames.length]; drawFrame(ctx,frame.img,w,h);
    playTimer.current=setTimeout(()=>setPreviewIdx(i=>(i+1)%frames.length),frame.delayMs);
    return()=>{if(playTimer.current)clearTimeout(playTimer.current);};
  }, [frames, previewIdx, background, fit]);

  async function exportGif() {
    if(!frames.length)return; setBusy(true); setStatus('ENCODING GIF…');
    try {
      const w=Math.max(...frames.map(f=>f.img.naturalWidth)), h=Math.max(...frames.map(f=>f.img.naturalHeight));
      const off=document.createElement('canvas'); off.width=w; off.height=h; const ctx=off.getContext('2d'); if(!ctx)throw new Error('canvas');
      const gif=GIFEncoder();
      for(const frame of frames){ drawFrame(ctx,frame.img,w,h); const {data}=ctx.getImageData(0,0,w,h); const palette=quantize(data,256); const index=applyPalette(data,palette); gif.writeFrame(index,w,h,{palette,delay:frame.delayMs,repeat:loop?0:-1}); }
      gif.finish(); const blob=new Blob([gif.bytes() as BlobPart],{type:'image/gif'}), url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=`${safeName(outputName)}.gif`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),2500); setStatus(`EXPORTED ${frames.length} FRAMES`);
    } catch { setStatus('GIF EXPORT FAILED'); } finally { setBusy(false); }
  }

  return <ToolShell title="GIF MAKER 2.0" onExit={onExit} actions={<button className="wbtn" onClick={exportGif} disabled={busy||!frames.length}>{busy?'ENCODING…':`EXPORT GIF (${frames.length})`}</button>}>
    <div data-testid="gif-maker-2-root" className="toolRow">
      <div className="toolCol">
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e=>addFiles(e.target.files)} />
        <button className="wbtn" onClick={()=>fileRef.current?.click()}><Icon name="upload" size={13}/> ADD FRAMES</button>
        <label className="toolField">OUTPUT<input value={outputName} onChange={e=>setOutputName(e.target.value)}/></label>
        <label className="toolField">DEFAULT DELAY (MS)<input type="number" min={20} max={5000} value={defaultDelay} onChange={e=>setDefaultDelay(Math.max(20,Math.min(5000,+e.target.value||20)))}/></label>
        <label className="toolField">BACKGROUND<input type="color" value={background} onChange={e=>setBackground(e.target.value)}/></label>
        <div className="toolRow"><button className={fit==='contain'?'chip on':'chip'} onClick={()=>setFit('contain')}>CONTAIN</button><button className={fit==='cover'?'chip on':'chip'} onClick={()=>setFit('cover')}>COVER</button></div>
        <label className="toolField"><span><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/> LOOP FOREVER</span></label>
        <div className="toolHint">{status}. Frame images stay in memory for this session; reusable output/settings persist per board.</div>
        <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:380,overflowY:'auto'}}>{frames.map((f,i)=><div key={f.id} className="gpanel" style={{display:'flex',alignItems:'center',gap:8,padding:8}}>
          <img src={f.img.src} alt="" style={{width:40,height:40,objectFit:'cover'}}/><span style={{fontSize:10}}>#{i+1} {f.name}</span>
          <input type="number" min={20} max={5000} value={f.delayMs} onChange={e=>setDelay(f.id,+e.target.value)} style={{width:70}}/><span className="toolHint">ms</span><span style={{flex:1}}/>
          <button className="chip small" onClick={()=>move(f.id,-1)}><Icon name="chevronUp" size={11}/></button><button className="chip small" onClick={()=>move(f.id,1)}><Icon name="chevronDown" size={11}/></button><button className="chip small" onClick={()=>removeFrame(f.id)}><Icon name="trash" size={11}/></button>
        </div>)}</div>
      </div>
      <div className="toolCol"><div className="toolCanvasWrap">{frames.length?<canvas ref={previewCanvasRef} style={{maxWidth:'100%',height:'auto'}}/>:<div className="toolHint">Live preview appears here.</div>}</div></div>
    </div>
  </ToolShell>;
}
