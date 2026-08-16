import { supabase, supabaseConfigured } from '../lib/supabase';
import type { WorkspaceState } from './domain';
import { normalizeWorkspace } from './store';

export interface WorkspaceSyncAdapter {
  pull(): Promise<WorkspaceState | null>;
  push(state: WorkspaceState): Promise<void>;
}

export class LocalOnlySyncAdapter implements WorkspaceSyncAdapter {
  async pull() { return null; }
  async push(_state: WorkspaceState) { /* localStorage remains authoritative */ }
}

export class SupabaseWorkspaceSyncAdapter implements WorkspaceSyncAdapter {
  private ownerId: string;

  constructor(ownerId: string) {
    this.ownerId = ownerId;
  }

  async pull(): Promise<WorkspaceState | null> {
    if (!supabaseConfigured) return null;
    const { data, error } = await supabase.from('xfactor_workspaces').select('payload').eq('owner_id',this.ownerId).maybeSingle();
    if (error) throw error;
    return normalizeWorkspace(data?.payload);
  }

  async push(state: WorkspaceState): Promise<void> {
    if (!supabaseConfigured) return;
    const clean=normalizeWorkspace(state);
    if (!clean) throw new Error('Refusing to sync an invalid xFactor.OS workspace payload.');
    const { error } = await supabase.from('xfactor_workspaces').upsert({ owner_id:this.ownerId, schema_version:clean.schemaVersion, payload:clean, updated_at:new Date().toISOString() }, { onConflict:'owner_id' });
    if (error) throw error;
  }
}