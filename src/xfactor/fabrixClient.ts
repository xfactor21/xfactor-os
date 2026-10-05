import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../lib/platform';

export const XFACTOR_FABRIX_PRODUCT_ID = 'planetx.xfactor-os';
export const XFACTOR_FABRIX_ADAPTER_VERSION = '1.0.0';
export const XFACTOR_FABRIX_CAPABILITIES = [
  'repo.project-state','filesystem.project','filesystem.asset','project.snapshot','project.evidence',
  'build.request','build.result','build.log','release.artifact','code.project','code.component',
  'website.project','website.capture','website.assets','ui.component',
  'visual.screenshot','visual.mockup-source','cli.command','automation.task',
] as const;
export type FabrixHealth={connected:boolean;hub_version?:string;adapter_version:string;transport:'desktop-required'|'disconnected'|'loopback-rc3'|'loopback-authenticated';authenticated:boolean;protocol_version?:string;hub_home?:string;error?:string};
export type FabrixProduct={product_id:string;name:string;version?:string;entry?:string;manifest?:Record<string,unknown>};
export type FabrixProductsResult={connected:boolean;products:FabrixProduct[];error?:string};
export type FabrixPublishResult={ok:boolean;mode:'rpc'|'file-drop'|'desktop-required';path?:string;status?:number;message?:string};
const webHealth=():FabrixHealth=>({connected:false,adapter_version:XFACTOR_FABRIX_ADAPTER_VERSION,transport:'desktop-required',authenticated:false,error:'fabriX Hub integration uses the xFactor.OS desktop bridge. The PWA remains standalone.'});
export async function fabrixDescribe():Promise<Record<string,unknown>>{if(!isTauri())return{product_id:XFACTOR_FABRIX_PRODUCT_ID,name:'xFactor.OS',version:'0.8.1',adapter_version:XFACTOR_FABRIX_ADAPTER_VERSION,desktop_bridge:false};return invoke<Record<string,unknown>>('fabrix_describe')}
export async function fabrixHealth():Promise<FabrixHealth>{if(!isTauri())return webHealth();return invoke<FabrixHealth>('fabrix_health')}
export async function fabrixRegisterSelf():Promise<Record<string,unknown>>{if(!isTauri())return{ok:false,supported:false,message:'Native registration requires the desktop bridge.'};return invoke<Record<string,unknown>>('fabrix_register_self')}
export async function fabrixProducts():Promise<FabrixProductsResult>{if(!isTauri())return{connected:false,products:[],error:webHealth().error};return invoke<FabrixProductsResult>('fabrix_products')}
export async function fabrixOpenProduct(productId:string):Promise<Record<string,unknown>>{if(!isTauri())throw new Error('fabriX product launch requires the desktop app.');return invoke<Record<string,unknown>>('fabrix_open_product',{productId})}
export async function fabrixLaunchHub(uri='fabrix://open'):Promise<Record<string,unknown>>{if(!isTauri())throw new Error('fabriX Hub launch requires the desktop app.');return invoke<Record<string,unknown>>('fabrix_launch_hub',{uri})}
export async function fabrixPublishProject(payload:Record<string,unknown>):Promise<FabrixPublishResult>{if(!isTauri())return{ok:false,mode:'desktop-required',message:'Project publishing requires the desktop bridge.'};return invoke<FabrixPublishResult>('fabrix_publish_project',{payload})}
export async function fabrixPublishArtifact(payload:Record<string,unknown>):Promise<FabrixPublishResult>{if(!isTauri())return{ok:false,mode:'desktop-required',message:'Artifact publishing requires the desktop bridge.'};return invoke<FabrixPublishResult>('fabrix_publish_artifact',{payload})}
export async function fabrixEntitlementStatus():Promise<Record<string,unknown>>{if(!isTauri())return{authority:'xfactor-os',registration_grants_entitlement:false,status:'delegated'};return invoke<Record<string,unknown>>('fabrix_entitlement_status')}
export async function fabrixPendingContext():Promise<Record<string,unknown>|null>{if(!isTauri())return null;return invoke<Record<string,unknown>|null>('fabrix_pending_context')}
export function fabrixCapabilityForPath(path:string):string{const ext=(path.split('.').pop()||'').toLowerCase();if(['png','jpg','jpeg','gif','webp','svg'].includes(ext))return'visual.screenshot';if(['wav','mp3','ogg','m4a','flac'].includes(ext))return'filesystem.asset';if(['html','css','js','jsx','ts','tsx','vue','svelte'].includes(ext))return'code.component';if(['json','toml','yaml','yml'].includes(ext))return'repo.project-state';return'filesystem.asset'}
