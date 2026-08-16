import type { StudioBoard, StudioMode } from './types';

const BOARDS_KEY = 'xfactor-studio-boards-v1';
const LEGACY_BOARDS_KEY = 'xos-studio-boards-v1';

let idc = 100;
const nid = () => `board-${Date.now().toString(36)}-${++idc}`;

export function loadBoards(): StudioBoard[] {
  try {
    const raw = localStorage.getItem(BOARDS_KEY) ?? localStorage.getItem(LEGACY_BOARDS_KEY);
    if (raw) {
      const boards = JSON.parse(raw) as StudioBoard[];
      if (!localStorage.getItem(BOARDS_KEY)) localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
      return boards;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return [];
}

function saveBoards(boards: StudioBoard[]) {
  localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
}

function announce(action: 'create'|'update'|'delete', board?: StudioBoard, boardId?: string) {
  window.dispatchEvent(new CustomEvent('xfactor:studio-board',{detail:{action,board,boardId}}));
}

export function createBoard(name: string, mode: StudioMode): StudioBoard {
  const now = new Date().toISOString();
  const board: StudioBoard = { id: nid(), name: name.trim() || 'Untitled', mode, createdAt: now, updatedAt: now };
  const boards = loadBoards();
  boards.unshift(board);
  saveBoards(boards);
  announce('create', board);
  return board;
}

export function touchBoard(id: string) {
  const boards = loadBoards();
  const b = boards.find((x) => x.id === id);
  if (b) {
    b.updatedAt = new Date().toISOString();
    saveBoards(boards);
    announce('update', b);
  }
}

export function renameBoard(id: string, name: string) {
  const boards = loadBoards();
  const b = boards.find((x) => x.id === id);
  if (b) {
    b.name = name.trim() || b.name;
    b.updatedAt = new Date().toISOString();
    saveBoards(boards);
    announce('update', b);
  }
}

export function deleteBoard(id: string) {
  saveBoards(loadBoards().filter((b) => b.id !== id));
  announce('delete', undefined, id);
  try {
    localStorage.removeItem(`xos-studio-draw-${id}`);
    localStorage.removeItem(`xos-studio-wf-${id}`);
    localStorage.removeItem(`xos-studio-anim-${id}`);
  } catch {
    /* ignore */
  }
}
