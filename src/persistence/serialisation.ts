import { SCHEMA_VERSION } from '../model/types';
import type { Dungeon, EdgeKind, Level } from '../model/types';

/**
 * Versioned JSON import and export.
 *
 * Imported files are untrusted, so everything is validated and rebuilt into a
 * known-good shape rather than being handed to the editor as-is. Unrecognised
 * fields are dropped, and malformed files produce a message naming the problem.
 */

export const FILE_FORMAT = 'dungeon-mapper';

const MAX_DIMENSION = 512;
const CELL_KEY_PATTERN = /^-?\d+,-?\d+$/;
const EDGE_KEY_PATTERN = /^-?\d+,-?\d+,[HV]$/;
const EDGE_KINDS: readonly EdgeKind[] = ['wall', 'door', 'lockedDoor', 'secretDoor'];

export interface DungeonFile {
  format: string;
  schemaVersion: number;
  exportedAt: string;
  dungeon: Dungeon;
}

export type ParseResult =
  | { ok: true; dungeon: Dungeon }
  | { ok: false; error: string };

class InvalidFile extends Error {}

function fail(message: string): never {
  throw new InvalidFile(message);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(`${path} must be a string`);
  return value;
}

function asDimension(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(`${path} must be a whole number`);
  }
  if (value < 1 || value > MAX_DIMENSION) {
    fail(`${path} must be between 1 and ${MAX_DIMENSION}`);
  }
  return value;
}

function normaliseLevel(value: unknown, index: number): Level {
  const path = `Level ${index + 1}`;
  const raw = asRecord(value, path);

  const width = asDimension(raw.width, `${path} width`);
  const height = asDimension(raw.height, `${path} height`);

  const cells: Level['cells'] = {};
  for (const [key, cell] of Object.entries(asRecord(raw.cells ?? {}, `${path} squares`))) {
    if (!CELL_KEY_PATTERN.test(key)) {
      fail(`${path} has an invalid square reference "${key}"`);
    }
    const colour = asRecord(cell, `${path} square ${key}`).colour;
    cells[key] = typeof colour === 'string' ? { floor: true, colour } : { floor: true };
  }

  const edges: Level['edges'] = {};
  for (const [key, edge] of Object.entries(asRecord(raw.edges ?? {}, `${path} walls`))) {
    if (!EDGE_KEY_PATTERN.test(key)) {
      fail(`${path} has an invalid wall reference "${key}"`);
    }
    const kind = asRecord(edge, `${path} wall ${key}`).kind;
    if (!EDGE_KINDS.includes(kind as EdgeKind)) {
      fail(`${path} has an unknown wall type "${String(kind)}"`);
    }
    edges[key] = { kind: kind as EdgeKind };
  }

  return {
    id: asString(raw.id, `${path} id`),
    name: asString(raw.name, `${path} name`),
    width,
    height,
    cells,
    edges,
  };
}

function normaliseDungeon(value: unknown): Dungeon {
  const raw = asRecord(value, 'Dungeon');

  if (!Array.isArray(raw.levels) || raw.levels.length === 0) {
    fail('Dungeon must contain at least one level');
  }

  const levels = raw.levels.map(normaliseLevel);

  const ids = new Set(levels.map((level) => level.id));
  if (ids.size !== levels.length) fail('Two levels share the same id');

  const now = new Date().toISOString();
  return {
    id: asString(raw.id, 'Dungeon id'),
    schemaVersion: SCHEMA_VERSION,
    name: asString(raw.name, 'Dungeon name'),
    ...(typeof raw.game === 'string' ? { game: raw.game } : {}),
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    levels,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: now,
  };
}

export function serialiseDungeon(dungeon: Dungeon): string {
  const file: DungeonFile = {
    format: FILE_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    dungeon,
  };
  return JSON.stringify(file, null, 2);
}

export function parseDungeonFile(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON' };
  }

  try {
    const root = asRecord(parsed, 'File');

    // A bare dungeon object is accepted too, so hand-edited files and older
    // exports without the wrapper still load.
    const wrapped = 'dungeon' in root || 'format' in root;

    if (wrapped) {
      if (typeof root.format === 'string' && root.format !== FILE_FORMAT) {
        return { ok: false, error: 'That file was not exported by Dungeon Mapper' };
      }
      if (
        typeof root.schemaVersion === 'number' &&
        root.schemaVersion > SCHEMA_VERSION
      ) {
        return {
          ok: false,
          error:
            'That map was saved by a newer version of Dungeon Mapper. Update before opening it.',
        };
      }
    }

    return { ok: true, dungeon: normaliseDungeon(wrapped ? root.dungeon : root) };
  } catch (error) {
    if (error instanceof InvalidFile) return { ok: false, error: error.message };
    return { ok: false, error: 'That file could not be read' };
  }
}

export function dungeonFileName(dungeon: Dungeon): string {
  const slug =
    dungeon.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled';
  return `${slug}.dungeon.json`;
}
