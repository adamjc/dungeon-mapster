import { SCHEMA_VERSION } from './types';
import type { Dungeon, Level } from './types';

export const DEFAULT_LEVEL_WIDTH = 48;
export const DEFAULT_LEVEL_HEIGHT = 48;

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function createLevel(name: string, width = DEFAULT_LEVEL_WIDTH, height = DEFAULT_LEVEL_HEIGHT): Level {
  return { id: newId(), name, width, height, cells: {}, edges: {}, stamps: {} };
}

export function createDungeon(name = 'Untitled Dungeon'): Dungeon {
  const now = new Date().toISOString();
  return {
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    name,
    notes: '',
    levels: [createLevel('Level 1')],
    customStamps: [],
    createdAt: now,
    updatedAt: now,
  };
}

export { newId };

export function findLevel(dungeon: Dungeon, levelId: string): Level | undefined {
  return dungeon.levels.find((level) => level.id === levelId);
}

/** Replaces one level, leaving every other level object referentially intact. */
export function replaceLevel(dungeon: Dungeon, level: Level): Dungeon {
  const index = dungeon.levels.findIndex((candidate) => candidate.id === level.id);
  if (index === -1) return dungeon;
  if (dungeon.levels[index] === level) return dungeon;

  const levels = dungeon.levels.slice();
  levels[index] = level;
  return { ...dungeon, levels, updatedAt: new Date().toISOString() };
}
