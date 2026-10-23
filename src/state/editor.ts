import { createDungeon, createLevel, replaceLevel } from '../model/dungeon';
import type { Cell, Dungeon, Level, Selection, Tool } from '../model/types';

export interface ViewTransform {
  /** Screen-space offset of the level origin, in pixels. */
  tx: number;
  ty: number;
  scale: number;
}

export interface EditorState {
  dungeon: Dungeon;
  activeLevelId: string;
  tool: Tool;
  selection: Selection;
  view: ViewTransform;
  past: Dungeon[];
  future: Dungeon[];
  /**
   * Dungeon snapshot taken when a drag began. A whole drag collapses into one
   * undo entry, so dragging out a corridor is undone in a single step.
   */
  strokeBase: Dungeon | null;
  rectPreview: { a: Cell; b: Cell } | null;
}

export type EditorAction =
  | { type: 'setTool'; tool: Tool }
  | { type: 'select'; selection: Selection }
  | { type: 'setView'; view: ViewTransform }
  | { type: 'beginStroke' }
  | { type: 'previewLevel'; level: Level }
  | { type: 'endStroke' }
  | { type: 'commitLevel'; level: Level }
  | { type: 'setRectPreview'; rect: { a: Cell; b: Cell } | null }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'renameDungeon'; name: string }
  | { type: 'addLevel' }
  | { type: 'selectLevel'; levelId: string }
  | { type: 'renameLevel'; levelId: string; name: string }
  | { type: 'deleteLevel'; levelId: string };

const MAX_HISTORY = 200;

export function createInitialState(): EditorState {
  const dungeon = createDungeon();
  return {
    dungeon,
    activeLevelId: dungeon.levels[0].id,
    tool: 'floor',
    selection: null,
    view: { tx: 48, ty: 48, scale: 1 },
    past: [],
    future: [],
    strokeBase: null,
    rectPreview: null,
  };
}

export function activeLevel(state: EditorState): Level {
  return (
    state.dungeon.levels.find((level) => level.id === state.activeLevelId) ??
    state.dungeon.levels[0]
  );
}

function pushHistory(state: EditorState, previous: Dungeon, next: Dungeon): EditorState {
  if (previous === next) return state;
  const past = [...state.past, previous];
  if (past.length > MAX_HISTORY) past.shift();
  return { ...state, dungeon: next, past, future: [] };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'setTool':
      return { ...state, tool: action.tool, rectPreview: null };

    case 'select':
      return { ...state, selection: action.selection };

    case 'setView':
      return { ...state, view: action.view };

    case 'beginStroke':
      return { ...state, strokeBase: state.dungeon };

    case 'previewLevel':
      return { ...state, dungeon: replaceLevel(state.dungeon, action.level) };

    case 'endStroke': {
      const base = state.strokeBase;
      if (!base || base === state.dungeon) return { ...state, strokeBase: null };
      const past = [...state.past, base];
      if (past.length > MAX_HISTORY) past.shift();
      return { ...state, past, future: [], strokeBase: null };
    }

    case 'commitLevel':
      return pushHistory(state, state.dungeon, replaceLevel(state.dungeon, action.level));

    case 'setRectPreview':
      return { ...state, rectPreview: action.rect };

    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        dungeon: previous,
        past: state.past.slice(0, -1),
        future: [state.dungeon, ...state.future],
        ...reconcileActiveLevel(previous, state.activeLevelId),
      };
    }

    case 'redo': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        dungeon: next,
        past: [...state.past, state.dungeon],
        future: state.future.slice(1),
        ...reconcileActiveLevel(next, state.activeLevelId),
      };
    }

    case 'renameDungeon':
      return pushHistory(state, state.dungeon, {
        ...state.dungeon,
        name: action.name,
        updatedAt: new Date().toISOString(),
      });

    case 'addLevel': {
      const level = createLevel(`Level ${state.dungeon.levels.length + 1}`);
      const next: Dungeon = {
        ...state.dungeon,
        levels: [...state.dungeon.levels, level],
        updatedAt: new Date().toISOString(),
      };
      return {
        ...pushHistory(state, state.dungeon, next),
        activeLevelId: level.id,
        selection: null,
      };
    }

    case 'selectLevel':
      return { ...state, activeLevelId: action.levelId, selection: null };

    case 'renameLevel': {
      const level = state.dungeon.levels.find((l) => l.id === action.levelId);
      if (!level || level.name === action.name) return state;
      return pushHistory(
        state,
        state.dungeon,
        replaceLevel(state.dungeon, { ...level, name: action.name }),
      );
    }

    case 'deleteLevel': {
      if (state.dungeon.levels.length <= 1) return state;
      const levels = state.dungeon.levels.filter((l) => l.id !== action.levelId);
      if (levels.length === state.dungeon.levels.length) return state;

      const next: Dungeon = {
        ...state.dungeon,
        levels,
        updatedAt: new Date().toISOString(),
      };
      const committed = pushHistory(state, state.dungeon, next);
      return {
        ...committed,
        activeLevelId: levels.some((l) => l.id === state.activeLevelId)
          ? state.activeLevelId
          : levels[0].id,
        selection: null,
      };
    }

    default:
      return state;
  }
}

/**
 * Undo may restore a dungeon in which the active level no longer exists, for
 * example when undoing "add level". Fall back to the first level rather than
 * leaving the editor pointing at nothing.
 */
function reconcileActiveLevel(
  dungeon: Dungeon,
  activeLevelId: string,
): Partial<EditorState> {
  return dungeon.levels.some((level) => level.id === activeLevelId)
    ? {}
    : { activeLevelId: dungeon.levels[0].id, selection: null };
}
