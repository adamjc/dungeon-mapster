import { SCHEMA_VERSION } from '../model/types';
import type {
  Dungeon,
  EdgeKind,
  Facing,
  Level,
  StampAnchor,
  StampAnchorKind,
  StampCategory,
  StampDefinition,
  StampInstance,
} from '../model/types';

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
const FACINGS: readonly Facing[] = ['north', 'south', 'east', 'west'];
const ANCHOR_KINDS: readonly StampAnchorKind[] = ['cell', 'edge'];
const CATEGORIES: readonly StampCategory[] = [
  'doors',
  'mechanisms',
  'hazards',
  'scenery',
  'contents',
  'notes',
  'custom',
];
const MAX_TEXT = 2000;

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

function asCoordinate(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(`${path} must be a whole number`);
  }
  if (Math.abs(value) > MAX_DIMENSION) fail(`${path} is out of range`);
  return value;
}

function optionalText(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const text = asString(value, path);
  return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
}

function normaliseAnchor(value: unknown, path: string): StampAnchor {
  const raw = asRecord(value, path);

  if (raw.kind === 'cell') {
    return {
      kind: 'cell',
      x: asCoordinate(raw.x, `${path} x`),
      y: asCoordinate(raw.y, `${path} y`),
    };
  }

  if (raw.kind === 'edge') {
    if (raw.o !== 'H' && raw.o !== 'V') {
      fail(`${path} has an invalid wall orientation`);
    }
    if (!FACINGS.includes(raw.facing as Facing)) {
      fail(`${path} has an invalid facing "${String(raw.facing)}"`);
    }

    const facing = raw.facing as Facing;
    const horizontal = raw.o === 'H';
    // A horizontal wall can only be seen from the north or south, and a
    // vertical one only from the east or west.
    const valid = horizontal
      ? facing === 'north' || facing === 'south'
      : facing === 'east' || facing === 'west';
    if (!valid) fail(`${path} faces "${facing}", which that wall cannot`);

    return {
      kind: 'edge',
      x: asCoordinate(raw.x, `${path} x`),
      y: asCoordinate(raw.y, `${path} y`),
      o: raw.o,
      facing,
    };
  }

  fail(`${path} must sit in a square or on a wall`);
}

function normaliseStamp(value: unknown, key: string, path: string): StampInstance {
  const raw = asRecord(value, path);

  const stamp: StampInstance = {
    id: key,
    stampId: asString(raw.stampId, `${path} type`),
    anchor: normaliseAnchor(raw.anchor, `${path} position`),
  };

  const label = optionalText(raw.label, `${path} label`);
  const note = optionalText(raw.note, `${path} note`);
  const colour = optionalText(raw.colour, `${path} colour`);
  const linkedLevelId = optionalText(raw.linkedLevelId, `${path} link`);

  if (label) stamp.label = label;
  if (note) stamp.note = note;
  if (colour) stamp.colour = colour;
  if (linkedLevelId) stamp.linkedLevelId = linkedLevelId;

  return stamp;
}

function normaliseCustomStamp(value: unknown, index: number): StampDefinition {
  const path = `Custom stamp ${index + 1}`;
  const raw = asRecord(value, path);

  if (!CATEGORIES.includes(raw.category as StampCategory)) {
    fail(`${path} has an unknown category "${String(raw.category)}"`);
  }

  if (!Array.isArray(raw.anchors) || raw.anchors.length === 0) {
    fail(`${path} must allow at least one placement`);
  }
  const anchors = raw.anchors.map((anchor) => {
    if (!ANCHOR_KINDS.includes(anchor as StampAnchorKind)) {
      fail(`${path} has an invalid placement "${String(anchor)}"`);
    }
    return anchor as StampAnchorKind;
  });

  return {
    id: asString(raw.id, `${path} id`),
    name: asString(raw.name, `${path} name`),
    category: raw.category as StampCategory,
    icon: asString(raw.icon, `${path} icon`),
    colour: asString(raw.colour, `${path} colour`),
    anchors: [...new Set(anchors)],
    linkable: raw.linkable === true,
    builtIn: false,
  };
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

  const stamps: Level['stamps'] = {};
  for (const [key, stamp] of Object.entries(
    asRecord(raw.stamps ?? {}, `${path} stamps`),
  )) {
    stamps[key] = normaliseStamp(stamp, key, `${path} stamp`);
  }

  return {
    id: asString(raw.id, `${path} id`),
    name: asString(raw.name, `${path} name`),
    width,
    height,
    cells,
    edges,
    stamps,
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

  const customRaw = raw.customStamps;
  if (customRaw !== undefined && !Array.isArray(customRaw)) {
    fail('Custom stamps must be a list');
  }
  const customStamps = (customRaw ?? []).map(normaliseCustomStamp);

  const customIds = new Set(customStamps.map((stamp) => stamp.id));
  if (customIds.size !== customStamps.length) {
    fail('Two custom stamps share the same id');
  }

  const now = new Date().toISOString();
  return {
    id: asString(raw.id, 'Dungeon id'),
    schemaVersion: SCHEMA_VERSION,
    name: asString(raw.name, 'Dungeon name'),
    ...(typeof raw.game === 'string' ? { game: raw.game } : {}),
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    levels,
    customStamps,
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

/**
 * Validates and migrates an already-decoded dungeon, such as one read back
 * from local storage.
 *
 * Stored data is not automatically trustworthy: it may have been written by an
 * older version of the app with a different shape. Running it through the same
 * normalisation as imported files means a map saved before a schema change
 * still opens, with any missing fields filled in.
 */
export function parseDungeonValue(value: unknown): ParseResult {
  try {
    return { ok: true, dungeon: normaliseDungeon(value) };
  } catch (error) {
    if (error instanceof InvalidFile) return { ok: false, error: error.message };
    return { ok: false, error: 'That map could not be read' };
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
