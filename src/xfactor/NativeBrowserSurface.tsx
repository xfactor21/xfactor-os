import { useEffect, useRef } from 'react';
import { Globe2 } from 'lucide-react';
import { isTauri } from '../lib/platform';

async function invokeNative<T>(command:string,args:Record<string,unknown>={}):Promise<T>{
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command,args);
}

export async function nativeBrowserNavigate(url:string){ return invokeNative<void>('browser_surface_navigate',{url}); }
export async function nativeBrowserBack(){ return invokeNative<void>('browser_surface_back'); }
export async function nativeBrowserForward(){ return invokeNative<void>('browser_surface_forward'); }
export async function nativeBrowserReload(){ return invokeNative<void>('browser_surface_reload'); }

export default function NativeBrowserSurface({
  url,
  host,
  onNavigation,
  onStatus,
}:{
  url:string;
  host:string;
  onNavigation:(url:string)=>void;
  onStatus:(status:string)=>void;
}){
  const bedRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if(!isTauri())return;
    let dead=false;
    let unlistenNav:(()=>void)|undefined;
    let unlistenPopup:(()=>void)|undefined;
    let observer:ResizeObserver|undefined;

    const syncBounds=async()=>{
      const rect=bedRef.current?.getBoundingClientRect();
      if(!rect||rect.width<80||rect.height<80)return;
      await invokeNative<void>('browser_surface_set_bounds',{
        x:rect.left,y:rect.top,width:rect.width,height:rect.height,
      });
    };

    const boot=async()=>{
      try{
        const { listen }=await import('@tauri-apps/api/event');
        unlistenNav=await listen<string>('xfactor-browser:navigation',event=>{
          if(dead||!event.payload)return;
          onNavigation(event.payload);
          onStatus('NATIVE PAGE READY');
        });
        unlistenPopup=await listen<string>('xfactor-browser:new-window',event=>{
          if(dead||!event.payload)return;
          onNavigation(event.payload);
          onStatus('POPUP ROUTED INTO xBROWSER');
          void nativeBrowserNavigate(event.payload);
        });

        const rect=bedRef.current?.getBoundingClientRect();
        if(!rect)throw new Error('Browser surface is not mounted.');
        await invokeNative<void>('browser_surface_open',{
          url,x:rect.left,y:rect.top,width:rect.width,height:rect.height,
        });
        if(dead)return;
        onStatus('NATIVE WEBVIEW READY');

        observer=new ResizeObserver(()=>{void syncBounds().catch(()=>{});});
        observer.observe(bedRef.current!);
        window.addEventListener('resize',syncBounds);
        window.addEventListener('scroll',syncBounds,true);
      }catch(err){
        if(!dead)onStatus('NATIVE BROWSER FAILED: '+(err instanceof Error?err.message:String(err)));
      }
    };
    void boot();

    return()=>{
      dead=true;
      observer?.disconnect();
      unlistenNav?.();
      unlistenPopup?.();
      window.removeEventListener('resize',syncBounds);
      window.removeEventListener('scroll',syncBounds,true);
      void invokeNative<void>('browser_surface_close').catch(()=>{});
    };
  // BrowserRoom owns navigation after initial mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  return <div ref={bedRef} className="m7-native-browser-bed">
    <Globe2/>
    <b>NATIVE xBROWSER SURFACE</b>
    <span>{host}</span>
    <small>REMOTE PAGE RUNS IN AN ISOLATED CHILD WEBVIEW ABOVE THIS BED.</small>
  </div>;
}
