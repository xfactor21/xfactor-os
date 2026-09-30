import type { Pile, SpatialBundle, SpatialEntityKind, WorkspaceState } from './domain';

const COLORS = ['#ff2aa3','#20d9ff','#9b5cff','#ff8a3d','#7df9b6','#ffd166'];
const MATERIALS = ['plasma','crystal','metal','wood','stone','cloud'] as const;

function uid(){ return crypto.randomUUID(); }

function labelFor(kind: SpatialEntityKind, ordinal: number) {
  const stem = kind === 'incident' ? 'IMPACT' : kind === 'signal' ? 'SIGNAL' : kind === 'asset' ? 'VAULT' : 'LAB';
  return `${stem} BUNDLE ${String(ordinal).padStart(2,'0')}`;
}

function contains(bundle: SpatialBundle, kind: SpatialEntityKind, id: string) {
  return bundle.members.some(member => member.kind === kind && member.id === id);
}

export function bundleForEntity(state: WorkspaceState, kind: SpatialEntityKind, id: string) {
  return state.spatialBundles.find(bundle => contains(bundle, kind, id));
}

export function linkSpatialEntities(
  state: WorkspaceState,
  kind: SpatialEntityKind,
  firstId: string,
  secondId: string,
): WorkspaceState {
  if (!firstId || !secondId || firstId === secondId) return state;
  const first = bundleForEntity(state, kind, firstId);
  const second = bundleForEntity(state, kind, secondId);
  const now = Date.now();

  let bundles = [...state.spatialBundles];
  let target: SpatialBundle;

  if (first && second && first.id === second.id) return state;

  if (first && second) {
    const mergedMembers = [...first.members];
    for (const member of second.members) {
      if (!mergedMembers.some(existing => existing.kind === member.kind && existing.id === member.id)) mergedMembers.push(member);
    }
    target = {...first, members: mergedMembers, updatedAt: now};
    bundles = bundles.filter(bundle => bundle.id !== second.id).map(bundle => bundle.id === first.id ? target : bundle);
  } else if (first || second) {
    const existing = first ?? second!;
    const newMember = { kind, id: first ? secondId : firstId };
    target = {
      ...existing,
      members: existing.members.some(member => member.kind === newMember.kind && member.id === newMember.id)
        ? existing.members
        : [...existing.members, newMember],
      updatedAt: now,
    };
    bundles = bundles.map(bundle => bundle.id === target.id ? target : bundle);
  } else {
    const ordinal = state.spatialBundles.length + 1;
    target = {
      id: uid(),
      name: labelFor(kind, ordinal),
      color: COLORS[(ordinal - 1) % COLORS.length],
      material: MATERIALS[(ordinal - 1) % MATERIALS.length],
      members: [{kind,id:firstId},{kind,id:secondId}],
      createdAt: now,
      updatedAt: now,
    };
    bundles = [target, ...bundles];
  }

  let piles = state.piles;
  let incidents = state.incidents;
  if (kind === 'incident') {
    const incidentIds = target.members.filter(member => member.kind === 'incident').map(member => member.id);
    let pile = state.piles.find(item => item.id === target.pileId);
    if (!pile) {
      pile = {
        id: uid(),
        name: target.name,
        stamp: 'PLASMA BUNDLE',
        collapsed: false,
        createdAt: now,
      } satisfies Pile;
      target = {...target,pileId:pile.id};
      bundles = bundles.map(bundle => bundle.id === target.id ? target : bundle);
      piles = [pile, ...state.piles];
    }
    incidents = state.incidents.map(incident => incidentIds.includes(incident.id) && !incident.pileIds.includes(pile!.id)
      ? {...incident,pileIds:[...incident.pileIds,pile!.id],updatedAt:now}
      : incident);
  }

  return {
    ...state,
    incidents,
    piles,
    spatialBundles: bundles,
    activity: [{
      id: uid(),
      type: 'spatial-bundle',
      label: `Plasma linked ${kind} items into ${target.name}`,
      createdAt: now,
    }, ...state.activity],
  };
}

export function bundleBadge(state: WorkspaceState, kind: SpatialEntityKind, id: string) {
  const bundle = bundleForEntity(state, kind, id);
  return bundle ? {name:bundle.name,color:bundle.color,material:bundle.material} : undefined;
}
