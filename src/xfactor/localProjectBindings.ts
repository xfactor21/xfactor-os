export interface LocalProjectBinding {
  incidentId: string;
  rootPath: string;
  name: string;
  boundAt: number;
  updatedAt: number;
}

const KEY = 'xfactor-workbench-local-project-bindings-v1';

function isBinding(value: unknown): value is LocalProjectBinding {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LocalProjectBinding>;
  return typeof item.incidentId === 'string' && Boolean(item.incidentId)
    && typeof item.rootPath === 'string' && Boolean(item.rootPath)
    && typeof item.name === 'string' && Boolean(item.name)
    && typeof item.boundAt === 'number' && Number.isFinite(item.boundAt)
    && typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt);
}

export function loadLocalProjectBindings(): Record<string, LocalProjectBinding> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => isBinding(value))
        .map(([incidentId, value]) => [incidentId, value as LocalProjectBinding]),
    );
  } catch {
    return {};
  }
}

export function getLocalProjectBinding(incidentId?: string): LocalProjectBinding | undefined {
  if (!incidentId) return undefined;
  return loadLocalProjectBindings()[incidentId];
}

export function bindLocalProject(incidentId: string, rootPath: string): LocalProjectBinding {
  const bindings = loadLocalProjectBindings();
  const now = Date.now();
  const previous = bindings[incidentId];
  const name = rootPath.split(/[/\\]/).filter(Boolean).pop() || rootPath;
  const binding: LocalProjectBinding = {
    incidentId,
    rootPath,
    name,
    boundAt: previous?.boundAt ?? now,
    updatedAt: now,
  };
  bindings[incidentId] = binding;
  localStorage.setItem(KEY, JSON.stringify(bindings));
  return binding;
}

export function unbindLocalProject(incidentId: string): void {
  const bindings = loadLocalProjectBindings();
  delete bindings[incidentId];
  localStorage.setItem(KEY, JSON.stringify(bindings));
}
