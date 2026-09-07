import { useEffect, useRef, useState } from 'react';
import { AnimationEngine, ANIM_PROPS } from './animation/AnimationEngine';
import type { AnimObject, AnimProp, EaseType, KeyframeClipboard } from './animation/AnimationEngine';
import Icon from '../../design-system/icons/Icon';
import type { IconName } from '../../design-system/icons/registry';

type Tool = 'select' | 'rect' | 'ellipse' | 'text' | 'bone';
const PROP_LABEL: Record<AnimProp, string> = { x: 'X', y: 'Y', rotation: 'Rotation °', scaleX: 'Scale X', scaleY: 'Scale Y', opacity: 'Opacity' };
const PX_PER_FRAME = 14;

export default function Animation({ boardId, onExit }: { boardId: string; onExit: () => void }) {
  const engineRef = useRef<AnimationEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [tick, forceTick] = useState(0);
  const bump = () => forceTick((n) => n + 1);
  const [tool, setTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exporting, setExporting] = useState<'gif' | 'sheet' | null>(null);
  const [propDraft, setPropDraft] = useState<Record<AnimProp, string> | null>(null);
  const [stageZoom, setStageZoom] = useState(1);
  const [expandedTracks, setExpandedTracks] = useState(true);
  const [clipboard, setClipboard] = useState<KeyframeClipboard | null>(null);
  const [keyDrag, setKeyDrag] = useState<{ objId: string; from: number } | null>(null);
  const dragRef = useRef<{ mode: 'move' | 'rotate'; objId: string; parentOriginX?: number; parentOriginY?: number; parentAngle?: number } | null>(null);
  const playTimerRef = useRef<number | null>(null);

  useEffect(() => {
    engineRef.current = AnimationEngine.load(boardId);
    setReady(true);
  }, [boardId]);

  const eng = engineRef.current;

  useEffect(() => {
    if (!ready || !eng) return;
    const cv = canvasRef.current, ctx = cv?.getContext('2d'); if (!cv || !ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#05080d'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (eng.doc.onionSkin) {
      const range = eng.doc.onionRange;
      for (let i = range; i >= 1; i--) if (frame - i >= 0) eng.renderFrame(ctx, frame - i, { tint: '#3aa0ff', alphaMul: 0.18 / i });
      for (let i = 1; i <= range; i++) if (frame + i < eng.doc.frameCount) eng.renderFrame(ctx, frame + i, { tint: '#ff8a3a', alphaMul: 0.18 / i });
    }
    eng.renderFrame(ctx, frame);
    if (selectedId) {
      const obj = eng.find(selectedId); if (!obj) return;
      ctx.save(); ctx.strokeStyle = obj.locked ? '#FFB000' : '#00F5FF'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      if (obj.type === 'bone') {
        const w = eng.boneWorld(obj, frame); ctx.beginPath(); ctx.arc(w.originX, w.originY, 9, 0, Math.PI * 2); ctx.moveTo(w.tipX, w.tipY); ctx.arc(w.tipX, w.tipY, 6, 0, Math.PI * 2); ctx.stroke();
      } else {
        const x = eng.getValue(obj, 'x', frame), y = eng.getValue(obj, 'y', frame), rot = eng.getValue(obj, 'rotation', frame), sx = eng.getValue(obj, 'scaleX', frame), sy = eng.getValue(obj, 'scaleY', frame);
        ctx.translate(x, y); ctx.rotate((rot * Math.PI) / 180); ctx.scale(sx || .001, sy || .001); ctx.strokeRect(-obj.w / 2 - 6, -obj.h / 2 - 6, obj.w + 12, obj.h + 12);
      }
      ctx.restore();
    }
  }, [ready, frame, selectedId, tick, eng]);

  useEffect(() => {
    if (!eng || !selectedId) return setPropDraft(null);
    const obj = eng.find(selectedId); if (!obj) return setPropDraft(null);
    const draft = { x: '', y: '', rotation: '', scaleX: '', scaleY: '', opacity: '' } as Record<AnimProp, string>;
    for (const p of ANIM_PROPS) draft[p] = String(round2(eng.getValue(obj, p, frame)));
    setPropDraft(draft);
  }, [selectedId, frame, tick, eng]);

  useEffect(() => {
    if (!isPlaying || !eng) return;
    const start = eng.doc.workStart ?? 0, end = eng.doc.workEnd ?? eng.doc.frameCount - 1;
    if (frame < start || frame > end) setFrame(start);
    playTimerRef.current = window.setInterval(() => {
      setFrame((f) => {
        const next = f + 1;
        if (next > end) { if (eng.doc.loop) return start; setIsPlaying(false); return end; }
        return next;
      });
    }, Math.round(1000 / eng.doc.fps));
    return () => { if (playTimerRef.current) window.clearInterval(playTimerRef.current); };
  }, [isPlaying, eng?.doc.fps, eng?.doc.workStart, eng?.doc.workEnd]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!eng) return;
      const target = e.target as HTMLElement | null;
      if (target?.matches('input,textarea,select,[contenteditable="true"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === 'Space') { e.preventDefault(); setIsPlaying((v) => !v); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setFrame((f) => Math.max(0, f - (e.shiftKey ? 5 : 1))); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); setFrame((f) => Math.min(eng.doc.frameCount - 1, f + (e.shiftKey ? 5 : 1))); return; }
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? eng.redo() : eng.undo(); bump(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); eng.redo(); bump(); return; }
      if (mod && e.key.toLowerCase() === 'd' && selectedId) { e.preventDefault(); const copy = eng.duplicateObject(selectedId); if (copy) setSelectedId(copy.id); bump(); return; }
      if (e.key.toLowerCase() === 'k' && selectedId) { eng.setAllKeyframes(selectedId, frame); bump(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); eng.removeObject(selectedId); setSelectedId(null); bump(); }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [eng, selectedId, frame]);

  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const cv = canvasRef.current!, rect = cv.getBoundingClientRect(); return [(e.clientX - rect.left) * (cv.width / rect.width), (e.clientY - rect.top) * (cv.height / rect.height)];
  }

  function onCanvasPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!eng) return; const [px, py] = canvasPoint(e);
    if (tool !== 'select') {
      let obj: AnimObject; if (tool === 'bone') obj = eng.addBone(px, py, null); else obj = eng.addShape(tool, px, py);
      setSelectedId(obj.id); setTool('select'); bump(); return;
    }
    const hit = eng.hitTest(px, py, frame); setSelectedId(hit?.id ?? null); if (!hit || hit.locked) return;
    (e.target as Element).setPointerCapture(e.pointerId); eng.beginLiveEdit();
    if (hit.type === 'bone' && hit.parentId) {
      const parent = eng.find(hit.parentId); if (parent) { const pw = eng.boneWorld(parent, frame); dragRef.current = { mode: 'rotate', objId: hit.id, parentOriginX: pw.tipX, parentOriginY: pw.tipY, parentAngle: pw.angle }; }
    } else dragRef.current = { mode: 'move', objId: hit.id };
  }

  function onCanvasPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current; if (!drag || !eng) return; const [px, py] = canvasPoint(e), obj = eng.find(drag.objId); if (!obj) return;
    if (drag.mode === 'move') { eng.pokeValue(drag.objId, 'x', frame, px); eng.pokeValue(drag.objId, 'y', frame, py); }
    else eng.pokeValue(drag.objId, 'rotation', frame, (Math.atan2(py - drag.parentOriginY!, px - drag.parentOriginX!) * 180) / Math.PI - (drag.parentAngle ?? 0));
    bump();
  }
  function onCanvasPointerUp() { if (!dragRef.current || !eng) return; eng.commitLiveEdit(); dragRef.current = null; bump(); }

  function commitProp(prop: AnimProp) {
    if (!eng || !selectedId || !propDraft) return; const v = parseFloat(propDraft[prop]); if (Number.isNaN(v)) return;
    const obj = eng.find(selectedId), existingEase = obj?.keys[prop].find((k) => k.frame === frame)?.ease ?? 'linear'; eng.setKeyframe(selectedId, prop, frame, v, existingEase); bump();
  }
  function setPropEase(prop: AnimProp, easeType: EaseType) { if (!eng || !selectedId || !propDraft) return; const v = parseFloat(propDraft[prop]); if (!Number.isNaN(v)) { eng.setKeyframe(selectedId, prop, frame, v, easeType); bump(); } }
  function addChildBone() { if (!eng || !selectedId) return; const p = eng.find(selectedId); if (p?.type !== 'bone') return; const child = eng.addBone(0, 0, selectedId); setSelectedId(child.id); bump(); }
  function duplicateSelected() { if (!eng || !selectedId) return; const copy = eng.duplicateObject(selectedId); if (copy) setSelectedId(copy.id); bump(); }
  function deleteSelected() { if (!eng || !selectedId) return; eng.removeObject(selectedId); setSelectedId(null); bump(); }
  function seekFromRuler(e: React.MouseEvent<HTMLDivElement>) { if (!eng) return; const rect = e.currentTarget.getBoundingClientRect(), f = Math.round((e.clientX - rect.left) / PX_PER_FRAME); setFrame(Math.max(0, Math.min(eng.doc.frameCount - 1, f))); }

  function beginKeyDrag(e: React.PointerEvent<HTMLSpanElement>, objId: string, from: number) {
    e.stopPropagation(); setSelectedId(objId); setFrame(from); setKeyDrag({ objId, from });
    const startX = e.clientX;
    const move = (ev: PointerEvent) => { const delta = Math.round((ev.clientX - startX) / PX_PER_FRAME); setFrame(Math.max(0, Math.min((eng?.doc.frameCount ?? 1) - 1, from + delta))); };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (eng) { const delta = Math.round((ev.clientX - startX) / PX_PER_FRAME), to = Math.max(0, Math.min(eng.doc.frameCount - 1, from + delta)); eng.moveKeyframesAt(objId, from, to); setFrame(to); bump(); }
      setKeyDrag(null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  }

  async function doExportGif() { if (!eng) return; setExporting('gif'); await new Promise((r) => setTimeout(r, 30)); try { downloadBlob(eng.exportGif(), 'xfactor-animation.gif'); } finally { setExporting(null); } }
  async function doExportSheet() { if (!eng) return; setExporting('sheet'); try { downloadBlob(await eng.exportSpriteSheet(), 'xfactor-animation-sheet.png'); } finally { setExporting(null); } }
  function exportDoc() { if (eng) downloadBlob(eng.exportDocument(), 'xfactor-animation.json'); }

  if (!ready || !eng) return null;
  const selected = selectedId ? eng.find(selectedId) : null, isBone = selected?.type === 'bone', isRootLike = !isBone || !selected?.parentId;
  const visibleProps: AnimProp[] = isBone ? (isRootLike ? ['x', 'y', 'rotation', 'opacity'] : ['rotation', 'opacity']) : ANIM_PROPS;
  const workStart = eng.doc.workStart ?? 0, workEnd = eng.doc.workEnd ?? eng.doc.frameCount - 1;

  return <div id="animRoot" data-testid="animation-2-root">
    <div id="animTopbar">
      <button className="chip" onClick={onExit}><Icon name="chevronLeft" size={12}/> ALL BOARDS</button>
      <div id="animToolgroup">{([['select','select','Select / Move'],['rect','rect','Add Rectangle'],['ellipse','circle','Add Ellipse'],['text','text','Add Text'],['bone','bone','Add Root Bone']] as [Tool,IconName,string][]).map(([t,icon,label]) => <span key={t} className={`tool ${tool===t?'on':''}`} onClick={()=>setTool(t)} title={label}><Icon name={icon} size={14}/></span>)}</div>
      <div id="animTopActions">
        <button className="chip" disabled={!eng.canUndo()} onClick={()=>{eng.undo();bump();}}><Icon name="undo" size={12}/> UNDO</button>
        <button className="chip" disabled={!eng.canRedo()} onClick={()=>{eng.redo();bump();}}><Icon name="redo" size={12}/> REDO</button>
        <span className={`chip small ${eng.doc.onionSkin?'on':''}`} onClick={()=>{eng.doc.onionSkin=!eng.doc.onionSkin;eng.persist();bump();}}>ONION</span>
        {eng.doc.onionSkin && <select className="chip small" value={eng.doc.onionRange} onChange={(e)=>{eng.doc.onionRange=Number(e.target.value);eng.persist();bump();}}><option value={1}>±1</option><option value={2}>±2</option><option value={3}>±3</option></select>}
        <button className="wbtn" disabled={!!exporting} onClick={doExportGif}>{exporting==='gif'?'ENCODING…':'EXPORT GIF'}</button>
        <button className="wbtn ghost" disabled={!!exporting} onClick={doExportSheet}>{exporting==='sheet'?'RENDERING…':'SPRITE SHEET'}</button>
        <button className="wbtn ghost" onClick={exportDoc}>DOC JSON</button>
      </div>
    </div>

    <div id="animBody">
      <div id="animSidebar" className="gpanel">
        <div className="toolRow" style={{justifyContent:'space-between'}}><h3>OBJECTS</h3><span className="toolHint">{eng.doc.objects.length}</span></div>
        <div className="toolCol" style={{gap:4,maxHeight:190,overflowY:'auto'}}>
          {eng.doc.objects.length===0 && <div className="rsub" style={{fontSize:9}}>Pick a tool, then click the canvas.</div>}
          {eng.doc.objects.map((o,i)=><div key={o.id} className="layer-row" onClick={()=>setSelectedId(o.id)} style={{borderColor:selectedId===o.id?'var(--cyan)':undefined,cursor:'pointer',opacity:o.visible?1:.45}}>
            <span className="lbl"><Icon name={o.type==='bone'?'bone':o.type==='rect'?'rect':o.type==='ellipse'?'circle':'text'} size={12}/> {o.name}</span>
            <span style={{display:'flex',gap:3}}>
              <button className="chip small" onClick={(e)=>{e.stopPropagation();eng.setObjectVisible(o.id,!o.visible);bump();}} title="Visibility">{o.visible?'◉':'○'}</button>
              <button className={`chip small ${o.locked?'on':''}`} onClick={(e)=>{e.stopPropagation();eng.setObjectLocked(o.id,!o.locked);bump();}} title="Lock">{o.locked?'LOCK':'FREE'}</button>
              <button className="chip small" disabled={i===0} onClick={(e)=>{e.stopPropagation();eng.moveObjectLayer(o.id,-1);bump();}}>↓</button>
              <button className="chip small" disabled={i===eng.doc.objects.length-1} onClick={(e)=>{e.stopPropagation();eng.moveObjectLayer(o.id,1);bump();}}>↑</button>
            </span>
          </div>)}
        </div>

        {selected && <>
          <h3 style={{marginTop:14}}>PROPERTIES</h3>
          <input value={selected.name} onChange={(e)=>{selected.name=e.target.value;eng.persist();bump();}} onBlur={(e)=>eng.renameObject(selected.id,e.target.value)} style={{width:'100%',marginBottom:8}}/>
          {selected.type==='text' && <div className="toolField"><label className="toolHint">Text</label><input value={selected.text??''} onChange={(e)=>{selected.text=e.target.value;eng.persist();bump();}}/></div>}
          {selected.type!=='bone' && <div className="toolRow" style={{marginBottom:8}}><label className="toolHint">Fill</label><input type="color" value={selected.fill} onChange={(e)=>{selected.fill=e.target.value;eng.persist();bump();}}/></div>}
          {propDraft && visibleProps.map((p)=>{const has=eng.hasKeyAt(selected,p,frame), ease=selected.keys[p].find((k)=>k.frame===frame)?.ease??'linear'; return <div key={p} className="toolRow" style={{alignItems:'center',gap:4,marginBottom:4}}>
            <span className="toolHint" style={{width:62}}>{PROP_LABEL[p]}</span><input type="number" step="1" value={propDraft[p]} onChange={(e)=>setPropDraft((d)=>d?{...d,[p]:e.target.value}:d)} style={{width:62}}/>
            <select className="chip small" value={ease} disabled={!has} onChange={(e)=>setPropEase(p,e.target.value as EaseType)}><option value="linear">Linear</option><option value="easeIn">Ease In</option><option value="easeOut">Ease Out</option><option value="easeInOut">Ease I/O</option></select>
            <span className={`chip small ${has?'on':''}`} onClick={()=>commitProp(p)} data-testid={`anim-key-${p}`}><Icon name="diamond" size={10} glow={has?'cyan':'none'}/></span>
            {has && <span className="chip small" onClick={()=>{eng.removeKeyframe(selected.id,p,frame);bump();}}><Icon name="close" size={10}/></span>}
          </div>})}
          <div className="toolRow" style={{gap:5,flexWrap:'wrap',marginTop:10}}>
            <button className="wbtn" onClick={()=>{eng.setAllKeyframes(selected.id,frame);bump();}}>KEY ALL (K)</button>
            <button className="wbtn ghost" onClick={duplicateSelected}>DUPLICATE</button>
            {isBone && <button className="wbtn" onClick={addChildBone}>+ CHILD BONE</button>}
            <button className="wbtn ghost" onClick={deleteSelected}>DELETE</button>
          </div>
          <div className="toolRow" style={{gap:5,marginTop:8,flexWrap:'wrap'}}>
            <button className="chip small" disabled={!eng.hasAnyKeyAt(selected,frame)} onClick={()=>setClipboard(eng.copyKeyframesAt(selected.id,frame))}>COPY KEYS</button>
            <button className="chip small" disabled={!clipboard} onClick={()=>{if(clipboard){eng.pasteKeyframesAt(selected.id,frame,clipboard);bump();}}}>PASTE KEYS</button>
            <button className="chip small" disabled={!eng.hasAnyKeyAt(selected,frame)} onClick={()=>{eng.removeAllKeyframesAt(selected.id,frame);bump();}}>CLEAR FRAME</button>
          </div>
        </>}
      </div>

      <div id="animCanvasWrap" style={{overflow:'auto'}}>
        <div style={{display:'flex',justifyContent:'flex-end',gap:5,marginBottom:6}}><button className="chip small" onClick={()=>setStageZoom((z)=>Math.max(.4,z-.1))}>−</button><span className="chip small">{Math.round(stageZoom*100)}%</span><button className="chip small" onClick={()=>setStageZoom((z)=>Math.min(1.8,z+.1))}>+</button><button className="chip small" onClick={()=>setStageZoom(1)}>100%</button></div>
        <canvas ref={canvasRef} width={eng.doc.width} height={eng.doc.height} style={{width:eng.doc.width*stageZoom,height:eng.doc.height*stageZoom}} onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp} onPointerLeave={onCanvasPointerUp}/>
      </div>
    </div>

    <div id="animTimeline">
      <div id="animPlayControls" style={{flexWrap:'wrap'}}>
        <span className="chip small" onClick={()=>setFrame(workStart)}><Icon name="skipBack" size={12}/></span><span className="chip small" onClick={()=>setFrame((f)=>Math.max(0,f-1))}><Icon name="chevronLeft" size={12}/></span><span className="chip small" onClick={()=>setIsPlaying((p)=>!p)} id="animPlayBtn"><Icon name={isPlaying?'pause':'play'} size={14}/></span><span className="chip small" onClick={()=>setFrame((f)=>Math.min(eng.doc.frameCount-1,f+1))}><Icon name="chevronRight" size={12}/></span>
        <span className={`chip small ${eng.doc.loop?'on':''}`} onClick={()=>{eng.doc.loop=!eng.doc.loop;eng.persist();bump();}}>LOOP</span>
        <select className="chip small" value={eng.doc.fps} onChange={(e)=>{eng.doc.fps=Number(e.target.value);eng.persist();bump();}}><option value={12}>12 fps</option><option value={24}>24 fps</option><option value={30}>30 fps</option><option value={60}>60 fps</option></select>
        <span className="rsub" id="animFrameCounter" style={{marginBottom:0}}>Frame {frame} / {eng.doc.frameCount-1} · {(eng.doc.frameCount/eng.doc.fps).toFixed(2)}s</span>
        <label className="toolHint">DURATION <input type="number" min={2} max={3600} value={eng.doc.frameCount} onChange={(e)=>{eng.setDuration(Number(e.target.value));setFrame((f)=>Math.min(f,Number(e.target.value)-1));bump();}} style={{width:64}}/></label>
        <label className="toolHint">IN <input type="number" min={0} max={workEnd} value={workStart} onChange={(e)=>{eng.setWorkArea(Number(e.target.value),workEnd);bump();}} style={{width:55}}/></label>
        <label className="toolHint">OUT <input type="number" min={workStart} max={eng.doc.frameCount-1} value={workEnd} onChange={(e)=>{eng.setWorkArea(workStart,Number(e.target.value));bump();}} style={{width:55}}/></label>
        <span className={`chip small ${expandedTracks?'on':''}`} onClick={()=>setExpandedTracks((v)=>!v)}>PROPERTY TRACKS</span>
      </div>

      <div id="animRulerWrap">
        <div id="animRuler" style={{width:eng.doc.frameCount*PX_PER_FRAME}} onClick={seekFromRuler}>
          <div style={{position:'absolute',left:workStart*PX_PER_FRAME,width:(workEnd-workStart+1)*PX_PER_FRAME,top:0,bottom:0,background:'rgba(255,45,120,.08)',pointerEvents:'none'}}/>
          {Array.from({length:Math.ceil(eng.doc.frameCount/5)},(_,i)=>i*5).map((f)=><span key={f} className="animRulerTick" style={{left:f*PX_PER_FRAME}}>{f}</span>)}<div id="animPlayhead" style={{left:frame*PX_PER_FRAME}}/>
        </div>
        <div id="animTracks">
          {eng.doc.objects.map((o)=><div key={o.id}>
            <div className="animTrackRow" onClick={()=>setSelectedId(o.id)} style={{width:eng.doc.frameCount*PX_PER_FRAME,opacity:o.visible?1:.45}}>
              {eng.allKeyframedFrames(o).map((f)=><span key={f} className={`animKeyDot ${o.id===selectedId?'sel':''} ${keyDrag?.objId===o.id&&keyDrag.from===f?'dragging':''}`} style={{left:f*PX_PER_FRAME}} title={`frame ${f} · drag to retime`} onPointerDown={(e)=>beginKeyDrag(e,o.id,f)}/>) }
            </div>
            {expandedTracks && o.id===selectedId && ANIM_PROPS.map((p)=><div key={p} className="animTrackRow" style={{width:eng.doc.frameCount*PX_PER_FRAME,height:16,opacity:.72}} data-testid={`anim-track-${p}`}>
              {o.keys[p].map((k)=><span key={k.frame} className="animKeyDot sel" style={{left:k.frame*PX_PER_FRAME,transform:'scale(.72)'}} title={`${PROP_LABEL[p]} · ${round2(k.value)} · ${k.ease}`} onClick={(e)=>{e.stopPropagation();setFrame(k.frame);}}/>) }
            </div>)}
          </div>)}
        </div>
      </div>
      <div className="toolHint" style={{padding:'6px 10px'}}>Space play/pause · ←/→ scrub · Shift+←/→ 5 frames · K key all properties · Ctrl/Cmd+D duplicate · drag timeline diamonds to retime.</div>
    </div>
  </div>;
}

function round2(n:number){return Math.round(n*100)/100;}
function downloadBlob(blob:Blob,filename:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}
