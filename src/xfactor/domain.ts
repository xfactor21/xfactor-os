export type IncidentStatus = 'LIVE' | 'FERAL' | 'DORMANT' | 'BREACH';
export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SignalType = 'spark' | 'task' | 'note' | 'link';
export type AssetKind = 'image' | 'audio' | 'video' | 'document' | 'code' | 'link' | 'studio' | 'other';
export type AssetSource = 'reference' | 'file' | 'studio';

export interface Position { x: number; y: number; rotation: number; }

export interface Incident {
  id: string;
  name: string;
  kind: string;
  tagline: string;
  description: string;
  nextMove: string;
  heat: number;
  open: number;
  done: number;
  status: IncidentStatus;
  priority: IncidentPriority;
  tags: string[];
  pileIds: string[];
  relatedIncidentIds: string[];
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Pile {
  id: string;
  name: string;
  stamp: string;
  collapsed: boolean;
  createdAt: number;
}

export interface Signal {
  id: string;
  text: string;
  type: SignalType;
  incidentId?: string;
  pinned: boolean;
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  source: AssetSource;
  uri?: string;
  blobKey?: string;
  mime?: string;
  size?: number;
  incidentId?: string;
  tags: string[];
  favorite: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ActivityEvent {
  id: string;
  type: string;
  label: string;
  incidentId?: string;
  createdAt: number;
}

export interface SavedLayout {
  id: string;
  name: string;
  positions: Record<string, Position>;
  createdAt: number;
}

export interface WorkspaceState {
  schemaVersion: 2;
  incidents: Incident[];
  piles: Pile[];
  signals: Signal[];
  assets: Asset[];
  activity: ActivityEvent[];
  positions: Record<string, Position>;
  savedLayouts: SavedLayout[];
  selectedIncidentId?: string;
}
