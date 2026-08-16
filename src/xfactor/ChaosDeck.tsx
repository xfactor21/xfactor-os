import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Archive, Boxes, Command, Crosshair, Download, ExternalLink, FileJson, FileText, Flame,
  FolderMinus, FolderPlus, Grip, Hammer, History, Image, Layers3, Link2, Music, Pin, Plus, Radio,
  RotateCcw, Save, Search, Shuffle, Sparkles, Star, TerminalSquare, Trash2, Upload, Video, X, Zap,
  Check, Code2, Eye, EyeOff, SlidersHorizontal, ArrowRightLeft
} from 'lucide-react';
import Studio from '../modules/studio';
import { loadBoards } from '../modules/studio/boards';
import TerminalRoom from '../modules/terminal';
import type { Asset, Incident, IncidentPriority, IncidentStatus, Signal, SignalType, WorkspaceState } from './domain';
import {
  event, exportWorkspace, importWorkspace, loadWorkspace, newAsset, newIncident, newLayout, newPile,
  newSignal, normalizeWorkspace, saveWorkspace, WORKSPACE_STORAGE_KEY
} from './store';
import { deleteAssetBlob, getAssetBlob, kindFromFile, putAssetBlob } from './assetStore';
import { parseCommand } from './commandGrammar';
import { SupabaseWorkspaceSyncAdapter } from './syncAdapter';
import { useAuthStore } from '../stores/authStore';
import { supabaseConfigured } from '../lib/supabase';
import './xfactor.css';

type View = 'deck' | 'piles' | 'signal' | 'vault' | 'tape' | 'terminal';
type DragState = { id: string; ox: number; oy: number; rect: DOMRect };

const assetIcon = (kind: string) => kind === 'image' ? Image : kind === 'audio' ? Music : kind === 'video' ? Video : kind === 'code' ? Code2 : kind === 'studio' ? Hammer : FileText;
const statusOrder: IncidentStatus[]=['FERAL','LIVE','BREACH','DORMANT'];
const priorityOrder: IncidentPriority[]=['LOW','MEDIUM','HIGH','CRITICAL'];

function relative(ts:number) {
  const sec = Math.max(1, Math.floor((Date.now()-ts)/1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec/60)}m`;
  if (sec < 86400) return `${Math.floor(sec/3600)}h`;
  return `${Math.floor(sec/86400)}d`;
}
function clonePositions<T>(value:T):T { return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)) as T; }
function downloadText(name:string,text:string,type='application/json') { const url=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500); }
function safeUrl(value?:string){try{return value?new URL(value).toString():undefined}catch{return undefined}}

export default function ChaosDeck() {
  const [ws, setWs] = useState<WorkspaceState>(() => loadWorkspace());
  const [view, setView] = useState<View>('deck');
  const [studio, setStudio] = useState(false);
  const [palette, setPalette] = useState(false);
  const [account, setAccount] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [signalQuery, setSignalQuery] = useState('');
  const [vaultQuery, setVaultQuery] = useState('');
  const [vaultArchived, setVaultArchived] = useState(false);
  const [capture, setCapture] = useState('');
  const [signalStrength, setSignalStrength] = useState(86);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => ws.selectedIncidentId ? [ws.selectedIncidentId] : []);
  const [assetDraft, setAssetDraft] = useState('');
  const [persistenceError, setPersistenceError] = useState(false);
  const [cloudError, setCloudError] = useState(false);
  const [notice,setNotice]=useState<string>();
  const drag = useRef<DragState | null>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const importRef=useRef<HTMLInputElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const syncReady = useRef(false);
  const syncTimer = useRef<number | null>(null);
  const authUser = useAuthStore(s => s.user);
  const initAuth = useAuthStore(s => s.init);

  useEffect(() => { setPersistenceError(!saveWorkspace(ws)); }, [ws]);
  useEffect(() => { if(!notice)return; const t=window.setTimeout(()=>setNotice(undefined),2600);return()=>window.clearTimeout(t); },[notice]);
  useEffect(() => {
    const id=ws.selectedIncidentId;
    setSelectedIds(prev => id ? (prev.includes(id) ? prev : [id]) : (prev.length ? [] : prev));
  }, [ws.selectedIncidentId]);
  useEffect(() => { void initAuth(); }, [initAuth]);
  useEffect(() => {
    syncReady.current = false;
    if (!authUser) return;
    const adapter = new SupabaseWorkspaceSyncAdapter(authUser.id);
    void adapter.pull().then(remote => {
      setCloudError(false);
      if (remote) setWs(local => {
        const localClock = Math.max(0,...local.incidents.map(i=>i.updatedAt),...local.activity.map(a=>a.createdAt));
        const remoteClock = Math.max(0,...remote.incidents.map(i=>i.updatedAt),...remote.activity.map(a=>a.createdAt));
        return remoteClock > localClock ? remote : local;
      });
    }).catch(err => { setCloudError(true); console.warn('xFactor.OS cloud pull unavailable',err); }).finally(()=>{ syncReady.current=true; });
  }, [authUser?.id]);
  useEffect(() => {
    if (!authUser || !syncReady.current) return;
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      void new SupabaseWorkspaceSyncAdapter(authUser.id).push(ws).then(()=>setCloudError(false)).catch(err => { setCloudError(true); console.warn('xFactor.OS cloud push unavailable',err); });
    }, 900);
    return () => { if (syncTimer.current) window.clearTimeout(syncTimer.current); };
  }, [ws, authUser]);
  useEffect(() => {
    const refresh = () => setWs(loadWorkspace());
    const onStorage = (storageEvent: StorageEvent) => { if (storageEvent.key === WORKSPACE_STORAGE_KEY) refresh(); };
    let channel: BroadcastChannel | null = null;
    try { channel = new BroadcastChannel('xfactor-os-workspace'); channel.onmessage = refresh; } catch { /* enhancement only */ }
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); channel?.close(); };
  }, []);
  useEffect(()=>{
    const boards=loadBoards();
    if(!boards.length)return;
    setWs(prev=>{
      const existingUris=new Set(prev.assets.filter(a=>a.source==='studio').map(a=>a.uri));
      const additions=boards.filter(b=>!existingUris.has(`studio://${b.id}`)).map(b=>newAsset(b.name,'studio',`studio://${b.id}`,undefined,'studio'));
      return additions.length?{...prev,assets:[...additions,...prev.assets]}:prev;
    });
  },[]);
  useEffect(() => {
    const onStudio=(ev:Event)=>{
      const detail=(ev as CustomEvent<{action:string;board?:{id:string;name:string;mode:string};boardId?:string}>).detail;
      if(!detail)return;
      setWs(prev=>{
        if(detail.action==='delete'&&detail.boardId){return {...prev,assets:prev.assets.filter(a=>a.uri!==`studio://${detail.boardId}`),activity:[event('studio','Removed a Design Lab document'),...prev.activity]};}
        const board=detail.board;if(!board)return prev;
        const uri=`studio://${board.id}`;
        const existing=prev.assets.find(a=>a.uri===uri);
        if(existing)return {...prev,assets:prev.assets.map(a=>a.id===existing.id?{...a,name:board.name,kind:'studio',source:'studio',updatedAt:Date.now()}:a)};
        const asset=newAsset(board.name,'studio',uri,prev.selectedIncidentId,'studio');
        return {...prev,assets:[asset,...prev.assets],activity:[event('studio',`Design Lab document: ${board.name}`,prev.selectedIncidentId),...prev.activity]};
      });
    };
    window.addEventListener('xfactor:studio-board',onStudio as EventListener);
    return()=>window.removeEventListener('xfactor:studio-board',onStudio as EventListener);
  },[]);
  useEffect(() => {
    const timer = window.setInterval(() => setSignalStrength(v => Math.max(73, Math.min(99, v + (Math.random() > .5 ? 1 : -1)))), 2200);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(v => !v); setPaletteQuery(''); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setView('signal'); }
      if (e.key === 'Escape') { setPalette(false); setStudio(false); setAccount(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.clearInterval(timer); window.removeEventListener('keydown', onKey); };
  }, []);

  const selected = selectedIds[0];
  const chosen = useMemo(() => ws.incidents.find(s => s.id === selected) ?? ws.incidents.find(i=>!i.archived), [ws.incidents, selected]);
  const visibleIncidents=useMemo(()=>ws.incidents.filter(i=>!i.archived),[ws.incidents]);

  function patch(recipe:(draft:WorkspaceState)=>WorkspaceState) { setWs(prev => normalizeWorkspace(recipe(prev)) ?? prev); }
  function record(label:string,type='system',incidentId?:string){patch(p=>({...p,activity:[event(type,label,incidentId),...p.activity]}));}
  function selectIncident(id:string, additive=false) {
    setSelectedIds(prev => additive ? (prev.includes(id) ? prev.filter(x=>x!==id) : [id,...prev]) : [id]);
    patch(p => ({...p, selectedIncidentId:id}));
  }
  function pointerDown(e:React.PointerEvent,id:string) {
    const floor = floorRef.current; if (!floor) return;
    drag.current = {id,ox:e.clientX,oy:e.clientY,rect:floor.getBoundingClientRect()};
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    selectIncident(id,e.shiftKey);
  }
  function pointerMove(e:React.PointerEvent) {
    const d = drag.current; if (!d) return;
    const dx=((e.clientX-d.ox)/d.rect.width)*100, dy=((e.clientY-d.oy)/d.rect.height)*100;
    d.ox=e.clientX; d.oy=e.clientY;
    patch(p => ({...p,positions:{...p.positions,[d.id]:{...(p.positions[d.id]??{x:20,y:20,rotation:0}),x:Math.max(0,Math.min(82,(p.positions[d.id]?.x??20)+dx)),y:Math.max(0,Math.min(80,(p.positions[d.id]?.y??20)+dy))}}}));
  }
  function scatter() {
    patch(p => ({...p, positions:Object.fromEntries(visibleIncidents.map((s,i)=>[s.id,{x:4+Math.random()*72,y:4+Math.random()*68,rotation:-5+Math.random()*10+i*.12}])), activity:[event('layout','RIOT MODE scattered the Floor'),...p.activity]}));
  }
  function organize() {
    patch(p => ({...p, positions:Object.fromEntries(visibleIncidents.map((s,i)=>[s.id,{x:5+(i%3)*31,y:8+Math.floor(i/3)*36,rotation:0}])), activity:[event('layout','STACK IT restored deterministic order'),...p.activity]}));
  }
  function saveLayout() {
    const name=`DAMAGE ${ws.savedLayouts.length+1}`;
    patch(p=>({...p,savedLayouts:[newLayout(name,p.positions),...p.savedLayouts],activity:[event('layout',`Saved ${name}`),...p.activity]}));
    setNotice(`${name} SAVED`);
  }
  function restoreLayout(id:string) {
    const layout=ws.savedLayouts.find(l=>l.id===id); if(!layout)return;
    patch(p=>({...p,positions:clonePositions(layout.positions),activity:[event('layout',`Restored ${layout.name}`),...p.activity]}));
  }
  function deleteLayout(id:string){patch(p=>({...p,savedLayouts:p.savedLayouts.filter(l=>l.id!==id)}));}
  function addIncident(name?:string) {
    const incident=newIncident(name);
    patch(p=>({...p,incidents:[...p.incidents,incident],positions:{...p.positions,[incident.id]:{x:34,y:24,rotation:-1.4}},selectedIncidentId:incident.id,activity:[event('incident',`Created ${incident.name}`,incident.id),...p.activity]}));
    setSelectedIds([incident.id]); setView('deck');
  }
  function updateIncident(id:string, changes:Partial<Incident>) {
    patch(p=>({...p,incidents:p.incidents.map(i=>i.id===id?{...i,...changes,updatedAt:Date.now()}:i),activity:[event('incident','Updated incident',id),...p.activity]}));
  }
  function archiveIncident(id:string) {
    patch(p=>({...p,incidents:p.incidents.map(i=>i.id===id?{...i,archived:true,updatedAt:Date.now()}:i),selectedIncidentId:p.selectedIncidentId===id?undefined:p.selectedIncidentId,activity:[event('incident','Archived incident',id),...p.activity]}));
    setSelectedIds(prev=>prev.filter(x=>x!==id));
  }
  function removeIncident(id:string) {
    patch(p=>({...p,incidents:p.incidents.filter(i=>i.id!==id).map(i=>({...i,relatedIncidentIds:i.relatedIncidentIds.filter(r=>r!==id)})),positions:Object.fromEntries(Object.entries(p.positions).filter(([k])=>k!==id)),signals:p.signals.map(s=>s.incidentId===id?{...s,incidentId:undefined,updatedAt:Date.now()}:s),assets:p.assets.map(a=>a.incidentId===id?{...a,incidentId:undefined,updatedAt:Date.now()}:a),selectedIncidentId:p.selectedIncidentId===id?undefined:p.selectedIncidentId,activity:[event('incident','Permanently removed an incident'),...p.activity]}));
    setSelectedIds(prev=>prev.filter(x=>x!==id));
  }
  function addCapture(type:SignalType='spark',textOverride?:string) {
    const text=(textOverride??capture).trim(); if(!text)return;
    const incidentId=selectedIds.length===1?selectedIds[0]:undefined;
    patch(p=>({...p,signals:[newSignal(text,type,incidentId),...p.signals],activity:[event('signal',`Captured ${type}${incidentId?' into incident':''}`,incidentId),...p.activity]}));
    if(!textOverride)setCapture('');
  }
  function updateSignal(id:string,changes:Partial<Signal>){patch(p=>({...p,signals:p.signals.map(s=>s.id===id?{...s,...changes,updatedAt:Date.now()}:s)}));}
  function createPileFromSelection() {
    if(!selectedIds.length)return;
    const pile=newPile(selectedIds.length>1?'SELECTED DAMAGE':'NEW PILE');
    patch(p=>({...p,piles:[pile,...p.piles],incidents:p.incidents.map(i=>selectedIds.includes(i.id)&&!i.pileIds.includes(pile.id)?{...i,pileIds:[...i.pileIds,pile.id]}:i),activity:[event('pile',`Created ${pile.name} with ${selectedIds.length} incident(s)`),...p.activity]}));
    setView('piles');
  }
  function togglePile(id:string) { patch(p=>({...p,piles:p.piles.map(x=>x.id===id?{...x,collapsed:!x.collapsed}:x)})); }
  function removePile(id:string) { patch(p=>({...p,piles:p.piles.filter(x=>x.id!==id),incidents:p.incidents.map(i=>({...i,pileIds:i.pileIds.filter(x=>x!==id)})),activity:[event('pile','Removed pile'),...p.activity]})); }
  function toggleIncidentPile(incidentId:string,pileId:string){patch(p=>({...p,incidents:p.incidents.map(i=>i.id===incidentId?{...i,pileIds:i.pileIds.includes(pileId)?i.pileIds.filter(x=>x!==pileId):[...i.pileIds,pileId],updatedAt:Date.now()}:i)}));}
  function addAssetDraft() {
    const name=assetDraft.trim(); if(!name)return;
    const url=safeUrl(name); const kind = url ? 'link' : 'other';
    patch(p=>({...p,assets:[newAsset(name,kind,url,chosen?.id,'reference'),...p.assets],activity:[event('asset',`Vaulted ${name}`,chosen?.id),...p.activity]}));
    setAssetDraft('');
  }
  async function ingestFiles(files:FileList|null){
    if(!files?.length)return;
    for(const file of Array.from(files)){
      const id=crypto.randomUUID(), blobKey=`file-${id}`;
      try{
        await putAssetBlob(blobKey,file);
        const asset=newAsset(file.name,kindFromFile(file),undefined,chosen?.id,'file');
        asset.id=id;asset.blobKey=blobKey;asset.mime=file.type;asset.size=file.size;
        patch(p=>({...p,assets:[asset,...p.assets],activity:[event('asset',`Imported file ${file.name}`,chosen?.id),...p.activity]}));
      }catch(err){console.error(err);setNotice(`COULD NOT VAULT ${file.name}`);}
    }
    if(fileRef.current)fileRef.current.value='';
  }
  async function deleteAsset(asset:Asset){if(asset.blobKey)try{await deleteAssetBlob(asset.blobKey)}catch{/* metadata removal still works */}patch(p=>({...p,assets:p.assets.filter(a=>a.id!==asset.id),activity:[event('asset',`Removed ${asset.name}`,asset.incidentId),...p.activity]}));}
  function exportBackup(){downloadText(`xfactor-os-backup-${new Date().toISOString().slice(0,10)}.json`,exportWorkspace(ws));record('Exported workspace backup','backup');}
  async function importBackup(file?:File){if(!file)return;const restored=importWorkspace(await file.text());if(!restored){setNotice('BACKUP REJECTED — INVALID WORKSPACE');return;}setWs(restored);setSelectedIds(restored.selectedIncidentId?[restored.selectedIncidentId]:[]);setNotice('WORKSPACE RESTORED');if(importRef.current)importRef.current.value='';}
  function toggleRelation(a:string,b:string){if(a===b)return;patch(p=>({...p,incidents:p.incidents.map(i=>{if(i.id!==a&&i.id!==b)return i;const other=i.id===a?b:a;return {...i,relatedIncidentIds:i.relatedIncidentIds.includes(other)?i.relatedIncidentIds.filter(x=>x!==other):[...i.relatedIncidentIds,other],updatedAt:Date.now()};}),activity:[event('relation','Changed incident relation',a),...p.activity]}));}

  const entityResults = useMemo(() => {
    const q=paletteQuery.trim().toLowerCase(); if(q.length<2)return [];
    const incidents=ws.incidents.filter(i=>`${i.name} ${i.kind} ${i.tags.join(' ')} ${i.description}`.toLowerCase().includes(q)).slice(0,5).map(i=>({id:i.id,label:i.name,kind:'INCIDENT' as const}));
    const signals=ws.signals.filter(i=>i.text.toLowerCase().includes(q)).slice(0,4).map(i=>({id:i.id,label:i.text,kind:'SIGNAL' as const,incidentId:i.incidentId}));
    const assets=ws.assets.filter(i=>`${i.name} ${i.tags.join(' ')}`.toLowerCase().includes(q)).slice(0,4).map(i=>({id:i.id,label:i.name,kind:'ASSET' as const,incidentId:i.incidentId}));
    return [...incidents,...signals,...assets];
  },[paletteQuery,ws.incidents,ws.signals,ws.assets]);
  function openEntity(result:{id:string;kind:'INCIDENT'|'SIGNAL'|'ASSET';incidentId?:string}) { setPalette(false); if(result.kind==='INCIDENT'){selectIncident(result.id);setView('deck');return;} if(result.incidentId) selectIncident(result.incidentId); setView(result.kind==='SIGNAL'?'signal':'vault'); }
  function command(label:string) {
    setPalette(false);
    if(label==='New incident') addIncident();
    if(label==='Riot Mode') { setView('deck'); scatter(); }
    if(label==='Stack It') { setView('deck'); organize(); }
    if(label==='Design Lab') setStudio(true);
    if(label==='Signal') setView('signal');
    if(label==='Vault') setView('vault');
    if(label==='Piles') setView('piles');
    if(label==='Tape') setView('tape');
    if(label==='Floor') setView('deck');
    if(label==='Terminal') setView('terminal');
    if(label==='Create pile') createPileFromSelection();
    if(label==='Backup workspace') exportBackup();
    if(label==='Restore workspace') importRef.current?.click();
  }
  function runPaletteInput() {
    const parsed=parseCommand(paletteQuery);
    if(parsed.type==='riot') return command('Riot Mode');
    if(parsed.type==='stack') return command('Stack It');
    if(parsed.type==='open') return command(parsed.target==='lab'?'Design Lab':parsed.target==='floor'?'Floor':parsed.target[0].toUpperCase()+parsed.target.slice(1));
    if(parsed.type==='new-incident'){addIncident(parsed.name);setPalette(false);return;}
    if(parsed.type==='capture'){addCapture(parsed.signalType,parsed.text);setPalette(false);setPaletteQuery('');setView('signal');return;}
    if(parsed.type==='search'){setPaletteQuery(parsed.query);return;}
    if(entityResults[0])return openEntity(entityResults[0]);
    const first=commands[0]; if(first)command(first.label);
  }
  const commands = [
    {label:'New incident',hint:'CREATE',icon:Plus},{label:'Riot Mode',hint:'LAYOUT',icon:Shuffle},{label:'Stack It',hint:'LAYOUT',icon:Layers3},
    {label:'Create pile',hint:'ORGANIZE',icon:FolderPlus},{label:'Signal',hint:'OPEN',icon:Radio},{label:'Piles',hint:'OPEN',icon:Boxes},{label:'Vault',hint:'OPEN',icon:Archive},{label:'Tape',hint:'OPEN',icon:History},{label:'Terminal',hint:'OPEN',icon:TerminalSquare},{label:'Design Lab',hint:'OPEN',icon:Hammer},
    {label:'Backup workspace',hint:'EXPORT',icon:Download},{label:'Restore workspace',hint:'IMPORT',icon:Upload},
  ].filter(c=>c.label.toLowerCase().includes(paletteQuery.toLowerCase()));

  if (studio) return <div className="xf-studio-shell"><button className="xf-studio-exit" onClick={()=>setStudio(false)}><X size={15}/> EXIT LAB</button><Studio active /></div>;

  return <div className="xf-root">
    <div className="xf-noise"/><div className="xf-scan"/>
    {persistenceError&&<div className="xf-system-alert fatal">LOCAL STORAGE IS UNAVAILABLE — WORKSPACE METADATA MAY NOT SURVIVE A RELOAD.</div>}
    {cloudError&&<div className="xf-system-alert">CLOUD SYNC IS OFFLINE — LOCAL WORK CONTINUES SAFELY.</div>}
    {notice&&<div className="xf-toast">{notice}</div>}
    <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={e=>void importBackup(e.target.files?.[0])}/>
    <input ref={fileRef} type="file" multiple hidden onChange={e=>void ingestFiles(e.target.files)}/>
    <header className="xf-topbar">
      <div className="xf-brand"><img src="/xfactor-mask.jpeg"/><div><b>xFACTOR.OS</b><span>// CONTROLLED CHAOS SYSTEM</span></div></div>
      <div className="xf-top-status"><span><Radio size={12}/> SIGNAL {signalStrength}%</span><span><Activity size={12}/> {ws.activity.length} EVENTS</span><span className="hot"><Flame size={12}/> {visibleIncidents.filter(i=>i.heat>80).length} HOT</span></div>
      <button className="xf-account-btn" onClick={()=>setAccount(true)}>{authUser?authUser.email?.split('@')[0]:'LOCAL'}<span>{authUser?'SYNCED':supabaseConfigured?'SIGN IN':'OFFLINE'}</span></button>
      <button className="xf-command" onClick={()=>setPalette(true)}><Command size={14}/> COMMAND <kbd>CTRL K</kbd></button>
    </header>

    <aside className="xf-rail">
      <button className={`rail-x ${view==='deck'?'active':''}`} onClick={()=>setView('deck')}><span>×</span><small>FLOOR</small></button>
      <button className={`rail-x ${view==='piles'?'active':''}`} onClick={()=>setView('piles')}><Boxes/><small>PILES</small></button>
      <button className={`rail-x ${view==='signal'?'active':''}`} onClick={()=>setView('signal')}><Radio/><small>SIGNAL</small></button>
      <button className="rail-x" onClick={()=>setStudio(true)}><Hammer/><small>LAB</small></button>
      <button className={`rail-x ${view==='vault'?'active':''}`} onClick={()=>setView('vault')}><Archive/><small>VAULT</small></button>
      <button className={`rail-x ${view==='tape'?'active':''}`} onClick={()=>setView('tape')}><History/><small>TAPE</small></button>
      <div className="rail-grow"/><button className={`rail-x ${view==='terminal'?'active':''}`} onClick={()=>setView('terminal')}><TerminalSquare/><small>TERM</small></button><div className="rail-mark">X<br/><i>21</i></div>
    </aside>

    <main className="xf-main">
      {view==='deck' && <>
        <section className="xf-floor-panel">
          <div className="xf-section-head"><div><span className="kicker">THE FLOOR //</span><h1>EVERYTHING, EVERYWHERE.</h1><p>The studio after an explosion — except every piece knows exactly where it belongs.</p></div>
            <div className="xf-floor-actions"><button onClick={saveLayout}><Save size={14}/> SAVE DAMAGE</button><button onClick={organize}><Layers3 size={14}/> STACK IT</button><button onClick={scatter}><Shuffle size={14}/> RIOT MODE</button><button className="pink" onClick={()=>addIncident()}><Plus size={14}/> THROW SOMETHING IN</button></div>
          </div>
          {ws.savedLayouts.length>0 && <div className="xf-layout-strip"><span>SAVED DAMAGE:</span>{ws.savedLayouts.slice(0,8).map(l=><div className="saved-layout" key={l.id}><button onClick={()=>restoreLayout(l.id)}>{l.name}</button><button title="Forget layout" onClick={()=>deleteLayout(l.id)}><X size={10}/></button></div>)}</div>}
          <div className="xf-floor" ref={floorRef} onPointerMove={pointerMove} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}>
            <div className="tape tape-a">DO NOT CLEAN THIS UP</div><div className="tape tape-b">SYSTEM ≠ ORDER</div>
            {visibleIncidents.length===0 && <div className="xf-first-run"><span>FIRST IMPACT //</span><h2>YOUR FLOOR IS EMPTY.</h2><p>Throw in a project, obsession, experiment, or problem. It becomes an Incident you can drag, pile, capture into, and tear apart without losing the underlying structure.</p><button onClick={()=>addIncident()}><Plus size={14}/> THROW IN YOUR FIRST INCIDENT</button><small>HOTWIRE captures thoughts instantly. CTRL/CMD + K opens the Command Deck.</small></div>}
            {visibleIncidents.map(s=>{const pos=ws.positions[s.id]??{x:20,y:20,rotation:0};const tasks=ws.signals.filter(sig=>sig.incidentId===s.id&&sig.type==='task');const open=tasks.filter(t=>!t.done).length;const done=tasks.filter(t=>t.done).length;return <article key={s.id} className={`xf-shard ${selectedIds.includes(s.id)?'selected':''} status-${s.status.toLowerCase()} priority-${s.priority.toLowerCase()}`} style={{left:`${pos.x}%`,top:`${pos.y}%`,transform:`rotate(${pos.rotation}deg)`}} onPointerDown={e=>pointerDown(e,s.id)}>
              <div className="shard-pin"/><div className="shard-top"><span>{s.kind}</span><Grip size={15}/></div><h2>{s.name}</h2><p>{s.tagline}</p><div className="shard-meter"><i style={{width:`${s.heat}%`}}/></div><footer><b>{s.status}</b><span>{open} OPEN</span><span>{done} DONE</span>{s.pileIds.length>0&&<span>{s.pileIds.length} PILE</span>}</footer>
            </article>})}
            <svg className="xf-scribble" viewBox="0 0 1000 600" preserveAspectRatio="none"><path d="M74 380 C190 250 248 520 420 365 S690 210 895 360"/><path d="M520 80 C580 170 480 230 640 270"/></svg>
          </div>
        </section>
        <section className="xf-lower-grid"><Blackbox chosen={chosen} ws={ws} onChange={updateIncident} onArchive={archiveIncident} onDelete={removeIncident} onSignal={updateSignal} onAddSignal={(type,text)=>addCapture(type,text)} onToggleRelation={toggleRelation}/><SignalMini ws={ws}/></section>
      </>}

      {view==='piles' && <section className="xf-page"><div className="xf-section-head"><div><span className="kicker">PILES //</span><h1>ORGANIZED DISORGANIZATION.</h1><p>Collections can overlap. Membership never replaces the underlying Incident.</p></div><button className="xf-big-action" onClick={createPileFromSelection}><FolderPlus size={15}/> PILE SELECTED ({selectedIds.length})</button></div>
        <div className="pile-grid">{ws.piles.length===0?<Empty label="NO PILES YET" detail="Shift-click multiple incidents on The Floor, then pile them together."/>:ws.piles.map(p=><article className="pile-card" key={p.id}><div className="pile-stamp">{p.stamp}</div><div className="pile-head"><h2 contentEditable suppressContentEditableWarning onBlur={e=>patch(w=>({...w,piles:w.piles.map(x=>x.id===p.id?{...x,name:e.currentTarget.textContent||x.name}:x)}))}>{p.name}</h2><button onClick={()=>removePile(p.id)}><Trash2 size={13}/></button></div><div className="pile-count">{ws.incidents.filter(i=>i.pileIds.includes(p.id)&&!i.archived).length} INCIDENTS</div><button className="pile-toggle" onClick={()=>togglePile(p.id)}>{p.collapsed?'EXPLODE PILE':'COLLAPSE PILE'}</button>{!p.collapsed&&<div className="pile-members">{ws.incidents.filter(i=>i.pileIds.includes(p.id)&&!i.archived).map(i=><div className="pile-member" key={i.id}><button onClick={()=>{selectIncident(i.id);setView('deck')}}>{i.name}</button><button title="Remove from pile" onClick={()=>toggleIncidentPile(i.id,p.id)}><FolderMinus size={12}/></button></div>)}</div>}</article>)}</div>
      </section>}

      {view==='signal' && <section className="xf-page"><div className="xf-section-head"><div><span className="kicker">SIGNAL //</span><h1>DON'T ORGANIZE IT YET.</h1><p>Capture first. Route, convert, pin, and finish it when the thought survives contact with reality.</p></div></div><div className="signal-toolbar"><Search size={14}/><input value={signalQuery} placeholder="FILTER THE LEAK..." onChange={e=>setSignalQuery(e.target.value)}/><span>{ws.signals.length} TOTAL</span></div><div className="signal-full">{ws.signals.filter(s=>!signalQuery||`${s.text} ${s.type}`.toLowerCase().includes(signalQuery.toLowerCase())).map(s=><article className={`signal-row signal-row-full ${s.done?'done':''}`} key={s.id}><button onClick={()=>updateSignal(s.id,{done:!s.done})}>{s.done?<Check size={14}/>:<span className={`sig-dot ${s.type}`}/>}</button><div className="signal-body"><small>{s.type.toUpperCase()} · {relative(s.createdAt)} AGO</small><textarea value={s.text} onChange={e=>updateSignal(s.id,{text:e.target.value})}/><div className="signal-routing"><select value={s.type} onChange={e=>updateSignal(s.id,{type:e.target.value as SignalType})}><option value="spark">SPARK</option><option value="task">TASK</option><option value="note">NOTE</option><option value="link">LINK</option></select><select value={s.incidentId??''} onChange={e=>updateSignal(s.id,{incidentId:e.target.value||undefined})}><option value="">UNROUTED</option>{visibleIncidents.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div></div><button className={s.pinned?'active-icon':''} onClick={()=>updateSignal(s.id,{pinned:!s.pinned})}><Pin size={13}/></button><button onClick={()=>patch(p=>({...p,signals:p.signals.filter(x=>x.id!==s.id),activity:[event('signal','Removed signal',s.incidentId),...p.activity]}))}><Trash2 size={13}/></button></article>)}{ws.signals.length===0&&<Empty label="NO SIGNAL YET" detail="Use Hotwire below. Capture anything before your brain talks you out of it."/>}</div></section>}

      {view==='vault' && <section className="xf-page"><div className="xf-section-head"><div><span className="kicker">BLACK VAULT //</span><h1>BURY IT WITH COORDINATES.</h1><p>Files, links, Design Lab documents, and references stay attached to the work that made them matter.</p></div><div className="xf-floor-actions"><button onClick={()=>fileRef.current?.click()}><Upload size={14}/> IMPORT FILES</button><button onClick={()=>setVaultArchived(v=>!v)}>{vaultArchived?<Eye size={14}/>:<EyeOff size={14}/>} {vaultArchived?'ACTIVE':'ARCHIVED'}</button></div></div><div className="vault-search"><Search size={14}/><input value={vaultQuery} onChange={e=>setVaultQuery(e.target.value)} placeholder="SEARCH THE VAULT..."/></div><div className="vault-add"><Archive size={15}/><input value={assetDraft} onChange={e=>setAssetDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addAssetDraft()}} placeholder="PASTE A URL OR NAME A REFERENCE..."/><button onClick={addAssetDraft}>VAULT IT</button></div><div className="vault-grid">{ws.assets.filter(a=>a.archived===vaultArchived).filter(a=>!vaultQuery||`${a.name} ${a.kind} ${a.tags.join(' ')}`.toLowerCase().includes(vaultQuery.toLowerCase())).length===0?<Empty label={vaultArchived?'NO ARCHIVED ASSETS':'VAULT IS EMPTY'} detail="Import files, paste a URL, or create something in Design Lab."/>:ws.assets.filter(a=>a.archived===vaultArchived).filter(a=>!vaultQuery||`${a.name} ${a.kind} ${a.tags.join(' ')}`.toLowerCase().includes(vaultQuery.toLowerCase())).map(a=><AssetCard key={a.id} asset={a} incidentName={ws.incidents.find(i=>i.id===a.incidentId)?.name} onPatch={changes=>patch(p=>({...p,assets:p.assets.map(x=>x.id===a.id?{...x,...changes,updatedAt:Date.now()}:x)}))} onDelete={()=>void deleteAsset(a)} onStudio={()=>setStudio(true)}/>)}</div></section>}

      {view==='tape' && <section className="xf-page"><div className="xf-section-head"><div><span className="kicker">TAPE //</span><h1>THE MESS HAS A MEMORY.</h1><p>Append-only operational history. Nothing here controls the data; it tells you what happened to it.</p></div><div className="xf-floor-actions"><button onClick={exportBackup}><Download size={14}/> BACKUP WORKSPACE</button><button onClick={()=>importRef.current?.click()}><Upload size={14}/> RESTORE BACKUP</button></div></div><div className="tape-ledger">{ws.activity.length===0?<Empty label="NO TAPE YET" detail="Your actions will start leaving a trail here."/>:ws.activity.map(a=><article key={a.id}><span>{relative(a.createdAt)} AGO</span><b>{a.type.toUpperCase()}</b><p>{a.label}</p><small>{a.incidentId?ws.incidents.find(i=>i.id===a.incidentId)?.name??'FORMER INCIDENT':'SYSTEM'}</small></article>)}</div></section>}

      {view==='terminal' && <section className="xf-page xf-terminal-page"><div className="xf-section-head"><div><span className="kicker">TERM //</span><h1>POWER TOOLS, NO TRAINING WHEELS.</h1><p>The inherited runtime stack is mounted directly here: Node, Python, Ruby, PHP, and Go where the browser/platform supports them.</p></div></div><div className="xf-terminal-runtime"><TerminalRoom active /></div></section>}
    </main>

    <div className="xf-hotwire"><Zap size={15}/><b>HOTWIRE</b><input value={capture} onChange={e=>setCapture(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addCapture('spark')}} placeholder={chosen?`THROW A THOUGHT INTO ${chosen.name}...`:'THROW A THOUGHT INTO THE SYSTEM...'}/><button onClick={()=>addCapture('task')}>TASK</button><button onClick={()=>addCapture('note')}>NOTE</button><button onClick={()=>addCapture('link')}><Link2 size={11}/></button><button onClick={()=>addCapture('spark')}>BURN IT IN</button></div>

    {account&&<AccountPanel onClose={()=>setAccount(false)}/>}
    {palette&&<div className="xf-palette-backdrop" onMouseDown={()=>setPalette(false)}><div className="xf-palette" onMouseDown={e=>e.stopPropagation()}><div className="palette-input"><Search size={18}/><input autoFocus value={paletteQuery} onChange={e=>setPaletteQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')runPaletteInput()}} placeholder="TYPE WHAT YOU WANT TO DO..."/><kbd>ESC</kbd></div>{commands.map(c=><button className="palette-row" key={c.label} onClick={()=>command(c.label)}><c.icon/>{c.label}<span>{c.hint}</span></button>)}{entityResults.length>0&&<div className="palette-divider">FOUND IN THE MESS</div>}{entityResults.map(r=><button className="palette-row entity" key={`${r.kind}-${r.id}`} onClick={()=>openEntity(r)}><Crosshair/>{r.label}<span>{r.kind}</span></button>)}<div className="palette-foot">TRY: “NEW PROJECT MONSTER X”, “TASK SHIP THE BUILD”, “OPEN VAULT”, “FIND AUDIO”</div></div></div>}
  </div>;
}

function Blackbox({chosen,ws,onChange,onArchive,onDelete,onSignal,onAddSignal,onToggleRelation}:{chosen?:Incident;ws:WorkspaceState;onChange:(id:string,c:Partial<Incident>)=>void;onArchive:(id:string)=>void;onDelete:(id:string)=>void;onSignal:(id:string,c:Partial<Signal>)=>void;onAddSignal:(type:SignalType,text:string)=>void;onToggleRelation:(a:string,b:string)=>void}) {
  const [draft,setDraft]=useState('');
  if(!chosen)return <div className="xf-blackbox"><Empty label="NO INCIDENT SELECTED" detail="Throw something onto the Floor."/></div>;
  const signals=ws.signals.filter(s=>s.incidentId===chosen.id); const tasks=signals.filter(s=>s.type==='task');const open=tasks.filter(s=>!s.done).length;const done=tasks.filter(s=>s.done).length;const activity=ws.activity.filter(a=>a.incidentId===chosen.id).slice(0,6);
  const next=chosen.nextMove||tasks.find(s=>!s.done)?.text||'Ship one thing that makes the project impossible to ignore.';
  return <div className="xf-blackbox"><div className="panel-title"><Crosshair size={15}/> BLACKBOX // CURRENT INCIDENT <span>{chosen.status}</span></div><div className="incident-title"><div><input className="blackbox-kind" value={chosen.kind} onChange={e=>onChange(chosen.id,{kind:e.target.value})}/><input className="blackbox-name" value={chosen.name} onChange={e=>onChange(chosen.id,{name:e.target.value})}/></div><div className="blackbox-actions"><button title="Archive incident" onClick={()=>onArchive(chosen.id)}><Archive size={14}/></button><button title="Delete permanently" onClick={()=>{if(confirm(`Permanently delete ${chosen.name}? Signals and assets will be unassigned.`))onDelete(chosen.id)}}><Trash2 size={14}/></button></div></div>
    <textarea className="blackbox-tagline" value={chosen.tagline} onChange={e=>onChange(chosen.id,{tagline:e.target.value})}/><textarea className="blackbox-description" value={chosen.description} onChange={e=>onChange(chosen.id,{description:e.target.value})} placeholder="WHAT IS THIS? WHY DOES IT EXIST?"/>
    <div className="incident-stats"><div><b>{chosen.heat}%</b><span>HEAT</span></div><div><b>{open}</b><span>OPEN LOOPS</span></div><div><b>{done}</b><span>BODIES BURIED</span></div></div>
    <div className="blackbox-controls"><label>STATUS<select value={chosen.status} onChange={e=>onChange(chosen.id,{status:e.target.value as IncidentStatus})}>{statusOrder.map(s=><option key={s}>{s}</option>)}</select></label><label>PRIORITY<select value={chosen.priority} onChange={e=>onChange(chosen.id,{priority:e.target.value as IncidentPriority})}>{priorityOrder.map(s=><option key={s}>{s}</option>)}</select></label><label>HEAT<input type="range" min="0" max="100" value={chosen.heat} onChange={e=>onChange(chosen.id,{heat:Number(e.target.value)})}/></label></div>
    <div className="tag-editor"><SlidersHorizontal size={12}/><input value={chosen.tags.join(', ')} onChange={e=>onChange(chosen.id,{tags:e.target.value.split(',').map(t=>t.trim().replace(/^#/,'')).filter(Boolean).slice(0,30)})} placeholder="tags, comma, separated"/></div>
    <div className="directive"><Zap size={16}/><div><small>NEXT VIOLENTLY OBVIOUS MOVE</small><input value={chosen.nextMove} onChange={e=>onChange(chosen.id,{nextMove:e.target.value})} placeholder={next}/></div></div>
    <div className="blackbox-capture"><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&draft.trim()){onAddSignal('task',draft.trim());setDraft('')}}} placeholder="ADD AN OPEN LOOP..."/><button onClick={()=>{if(draft.trim()){onAddSignal('task',draft.trim());setDraft('')}}}><Plus size={12}/> LOOP</button></div>
    {tasks.length>0&&<div className="blackbox-loops">{tasks.slice(0,6).map(t=><button className={t.done?'done':''} key={t.id} onClick={()=>onSignal(t.id,{done:!t.done})}>{t.done?<Check size={11}/>:<span/>}{t.text}</button>)}</div>}
    <div className="blackbox-relations"><small>RELATED DAMAGE</small><div>{ws.incidents.filter(i=>i.id!==chosen.id&&!i.archived).slice(0,12).map(i=><button className={chosen.relatedIncidentIds.includes(i.id)?'active':''} key={i.id} onClick={()=>onToggleRelation(chosen.id,i.id)}><ArrowRightLeft size={10}/>{i.name}</button>)}</div></div>
    {activity.length>0&&<div className="blackbox-tape">{activity.map(a=><span key={a.id}>{relative(a.createdAt)} AGO // {a.label}</span>)}</div>}</div>;
}

function SignalMini({ws}:{ws:WorkspaceState}) { return <div className="xf-feed"><div className="panel-title"><Radio size={15}/> SIGNAL LEAK <span>{ws.signals.length} CAPTURES</span></div><div className="feed-list">{ws.signals.slice(0,8).map(c=><div className={`feed-item ${c.type}`} key={c.id}><i/><div><small>{c.type.toUpperCase()} // {relative(c.createdAt)} AGO</small><p>{c.text}</p></div></div>)}{ws.signals.length===0&&<Empty label="NO LEAK" detail="Hotwire is waiting."/>}</div></div>; }

function AssetCard({asset,incidentName,onPatch,onDelete,onStudio}:{asset:Asset;incidentName?:string;onPatch:(changes:Partial<Asset>)=>void;onDelete:()=>void;onStudio:()=>void}){
  const I=assetIcon(asset.kind);const [blobUrl,setBlobUrl]=useState<string>();
  useEffect(()=>{let current:string|undefined; if(!asset.blobKey)return;void getAssetBlob(asset.blobKey).then(blob=>{if(!blob)return;current=URL.createObjectURL(blob);setBlobUrl(current)}).catch(()=>{});return()=>{if(current)URL.revokeObjectURL(current)}},[asset.blobKey]);
  const href=asset.source==='file'?blobUrl:asset.source==='studio'?undefined:safeUrl(asset.uri);
  function open(){if(asset.source==='studio'){onStudio();return;}if(href)window.open(href,'_blank','noopener,noreferrer');}
  function save(){if(!blobUrl)return;const a=document.createElement('a');a.href=blobUrl;a.download=asset.name;a.click();}
  return <article className={`asset-card source-${asset.source}`}><div className="asset-preview">{asset.kind==='image'&&blobUrl?<img src={blobUrl} alt=""/>:asset.kind==='audio'&&blobUrl?<audio controls src={blobUrl}/>:asset.kind==='video'&&blobUrl?<video controls src={blobUrl}/>:<I/>}</div><small>{asset.kind.toUpperCase()} · {asset.source.toUpperCase()}</small><h3>{asset.name}</h3><p>{incidentName??'UNASSIGNED'}{asset.size?` · ${(asset.size/1024/1024).toFixed(asset.size>1024*1024?1:2)} MB`:''}</p><div className="asset-actions"><button title="Favorite" onClick={()=>onPatch({favorite:!asset.favorite})}><Star size={13} fill={asset.favorite?'currentColor':'none'}/></button>{(href||asset.source==='studio')&&<button title="Open" onClick={open}><ExternalLink size={13}/></button>}{blobUrl&&<button title="Download" onClick={save}><Download size={13}/></button>}<button title={asset.archived?'Restore':'Archive'} onClick={()=>onPatch({archived:!asset.archived})}><Archive size={13}/></button><button title="Delete" onClick={onDelete}><Trash2 size={13}/></button></div></article>;
}

function Empty({label,detail}:{label:string;detail:string}) { return <div className="xf-empty"><Sparkles size={22}/><b>{label}</b><p>{detail}</p></div>; }


function AccountPanel({onClose}:{onClose:()=>void}){
  const user=useAuthStore(s=>s.user);const status=useAuthStore(s=>s.status);const signIn=useAuthStore(s=>s.signInWithPassword);const signUp=useAuthStore(s=>s.signUpWithPassword);const magic=useAuthStore(s=>s.sendMagicLink);const signOut=useAuthStore(s=>s.signOut);
  const [mode,setMode]=useState<'signin'|'signup'|'magic'>('signin');const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[message,setMessage]=useState('');const[busy,setBusy]=useState(false);
  async function submit(){if(!email.trim())return setMessage('ENTER AN EMAIL ADDRESS.');setBusy(true);setMessage('');try{if(mode==='magic'){const r=await magic(email.trim());setMessage(r.error??'MAGIC LINK SENT.');}else if(mode==='signin'){const r=await signIn(email.trim(),password);setMessage(r.error??'SIGNED IN.');}else{const r=await signUp(email.trim(),password);setMessage(r.error??(r.needsConfirmation?'CHECK YOUR EMAIL TO CONFIRM.':'ACCOUNT CREATED.'));}}finally{setBusy(false)}}
  return <div className="xf-palette-backdrop account-backdrop" onMouseDown={onClose}><section className="xf-account-panel" onMouseDown={e=>e.stopPropagation()}><button className="account-close" onClick={onClose}><X size={14}/></button><span>ACCOUNT // CLOUD MIRROR</span><h2>{supabaseConfigured?'LOCAL-FIRST. CLOUD WHEN YOU WANT IT.':'THIS BUILD IS LOCAL-ONLY.'}</h2><p>Your browser/device remains authoritative. Signing in mirrors workspace metadata to the configured xFactor.OS Supabase project; Vault file blobs remain local to this device.</p>{!supabaseConfigured?<div className="account-offline">No cloud endpoint is configured for this deployment. Nothing is broken and no data leaves this device.</div>:user?<div className="account-user"><b>{user.email}</b><small>{status.toUpperCase()} · WORKSPACE METADATA SYNC ENABLED</small><button onClick={()=>void signOut()}>SIGN OUT</button></div>:<><div className="account-tabs"><button className={mode==='signin'?'active':''} onClick={()=>setMode('signin')}>SIGN IN</button><button className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>CREATE</button><button className={mode==='magic'?'active':''} onClick={()=>setMode('magic')}>MAGIC LINK</button></div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="EMAIL"/>{mode!=='magic'&&<input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void submit()}} placeholder="PASSWORD"/>}<button className="account-submit" disabled={busy} onClick={()=>void submit()}>{busy?'WORKING...':mode==='signin'?'SIGN IN':mode==='signup'?'CREATE ACCOUNT':'SEND LINK'}</button>{message&&<div className="account-message">{message}</div>}</>}</section></div>;
}
