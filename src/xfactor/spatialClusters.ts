import type { SpatialCluster, SpatialEntityKind, WorkspaceState } from './domain';

const COLORS=['#ff2aa3','#20d9ff','#9b5cff','#ff9f43','#68f0ae','#f25f5c','#ffd166'];
const MATERIALS: SpatialCluster['matterMaterial'][]=['plasma','crystal','metal','wood','stone','cloud'];

function hash(value:string){
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
  return Math.abs(h);
}

export function clusterFor(state:WorkspaceState,kind:SpatialEntityKind,id:string){
  return state.spatialClusters.find(cluster=>cluster.kind===kind&&cluster.memberIds.includes(id));
}

export function createOrMergeSpatialCluster(
  state:WorkspaceState,
  kind:SpatialEntityKind,
  a:string,
  b:string,
  options:{name?:string; pileId?:string}={},
):{clusters:SpatialCluster[];cluster:SpatialCluster;created:boolean}{
  const now=Date.now();
  const left=state.spatialClusters.find(c=>c.kind===kind&&c.memberIds.includes(a));
  const right=state.spatialClusters.find(c=>c.kind===kind&&c.memberIds.includes(b));
  if(left&&right&&left.id===right.id) return {clusters:state.spatialClusters,cluster:left,created:false};

  if(left&&right){
    const merged:{[K in keyof SpatialCluster]:SpatialCluster[K]}={
      ...left,
      memberIds:[...new Set([...left.memberIds,...right.memberIds])],
      updatedAt:now,
      name:left.name||right.name,
      pileId:left.pileId||right.pileId,
    };
    return {clusters:state.spatialClusters.filter(c=>c.id!==right.id).map(c=>c.id===left.id?merged:c),cluster:merged,created:false};
  }

  if(left||right){
    const existing=(left||right)!;
    const merged={...existing,memberIds:[...new Set([...existing.memberIds,a,b])],updatedAt:now,pileId:existing.pileId||options.pileId};
    return {clusters:state.spatialClusters.map(c=>c.id===existing.id?merged:c),cluster:merged,created:false};
  }

  const id=crypto.randomUUID();
  const n=state.spatialClusters.filter(c=>c.kind===kind).length+1;
  const h=hash(id);
  const cluster:SpatialCluster={
    id,
    kind,
    name:options.name||`BUNDLE ${String(n).padStart(2,'0')}`,
    color:COLORS[h%COLORS.length],
    matterMaterial:MATERIALS[h%MATERIALS.length],
    memberIds:[a,b],
    pileId:options.pileId,
    createdAt:now,
    updatedAt:now,
  };
  return {clusters:[cluster,...state.spatialClusters],cluster,created:true};
}

export function removeFromSpatialCluster(state:WorkspaceState,kind:SpatialEntityKind,id:string):SpatialCluster[]{
  return state.spatialClusters.flatMap(cluster=>{
    if(cluster.kind!==kind||!cluster.memberIds.includes(id))return [cluster];
    const memberIds=cluster.memberIds.filter(member=>member!==id);
    return memberIds.length>=2?[{...cluster,memberIds,updatedAt:Date.now()}]:[];
  });
}
