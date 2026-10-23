import type { Dungeon, StampCategory, StampDefinition } from './types';

/**
 * The built-in stamp catalogue.
 *
 * `anchors` is the important field. Things that are physically mounted on a
 * wall in these games — keyholes, buttons, levers, alcoves — are edge-only, so
 * the editor will not let them be dropped in the middle of a square. Things
 * that occupy a square are cell-only, and a few sensibly do both.
 */

export const CATEGORY_LABELS: Record<StampCategory, string> = {
  doors: 'Doors & locks',
  mechanisms: 'Mechanisms',
  hazards: 'Hazards & movement',
  scenery: 'Scenery',
  contents: 'Contents',
  notes: 'Annotation',
  custom: 'Custom',
};

export const CATEGORY_ORDER: StampCategory[] = [
  'doors',
  'mechanisms',
  'hazards',
  'scenery',
  'contents',
  'notes',
  'custom',
];

const BRASS = '#d8a657';
const STONE = '#c7ccd6';
const DANGER = '#e05252';
const ARCANE = '#9d7cd8';
const GOLD = '#e6c04a';
const GREEN = '#6fbf73';

function define(
  id: string,
  name: string,
  category: StampCategory,
  icon: string,
  colour: string,
  anchors: StampDefinition['anchors'],
  linkable = false,
): StampDefinition {
  return { id, name, category, icon, colour, anchors, linkable, builtIn: true };
}

export const BUILT_IN_STAMPS: StampDefinition[] = [
  // Doors & locks
  define('keyhole', 'Keyhole', 'doors', 'keyhole', BRASS, ['edge']),
  define('lock', 'Lock', 'doors', 'padlock', BRASS, ['edge']),
  define('key', 'Key', 'doors', 'key', GOLD, ['cell', 'edge']),
  define('portcullis', 'Portcullis', 'doors', 'portcullis', STONE, ['edge']),

  // Mechanisms
  define('secretButton', 'Secret button', 'mechanisms', 'button', DANGER, ['edge']),
  define('button', 'Button', 'mechanisms', 'button', BRASS, ['edge']),
  define('lever', 'Lever', 'mechanisms', 'lever', BRASS, ['edge']),
  define('pressurePlate', 'Pressure plate', 'mechanisms', 'pressurePlate', BRASS, ['cell']),
  define('wheel', 'Wheel or crank', 'mechanisms', 'wheel', BRASS, ['edge']),
  define('spawner', 'Monster generator', 'mechanisms', 'spawner', DANGER, ['cell']),

  // Hazards & movement
  define('pit', 'Pit', 'hazards', 'pit', DANGER, ['cell']),
  define('trapdoor', 'Trapdoor', 'hazards', 'trapdoor', DANGER, ['cell']),
  define('teleporter', 'Teleporter', 'hazards', 'teleporter', ARCANE, ['cell'], true),
  define('spinner', 'Spinner', 'hazards', 'spinner', ARCANE, ['cell']),
  define('stairsUp', 'Stairs up', 'hazards', 'stairsUp', STONE, ['cell'], true),
  define('stairsDown', 'Stairs down', 'hazards', 'stairsDown', STONE, ['cell'], true),
  define('darkness', 'Dark zone', 'hazards', 'darkness', ARCANE, ['cell']),

  // Scenery
  define('well', 'Well', 'scenery', 'well', STONE, ['cell']),
  define('fountain', 'Fountain', 'scenery', 'fountain', STONE, ['cell']),
  define('alcove', 'Alcove', 'scenery', 'alcove', STONE, ['edge']),
  define('altar', 'Altar', 'scenery', 'altar', STONE, ['cell']),
  define('pillar', 'Pillar', 'scenery', 'pillar', STONE, ['cell']),
  define('torch', 'Torch', 'scenery', 'torch', BRASS, ['edge', 'cell']),
  define('rubble', 'Rubble', 'scenery', 'rubble', STONE, ['cell']),
  define('rune', 'Wall rune', 'scenery', 'rune', ARCANE, ['edge']),

  // Contents
  define('chest', 'Chest', 'contents', 'chest', GOLD, ['cell']),
  define('treasure', 'Treasure', 'contents', 'treasure', GOLD, ['cell']),
  define('item', 'Item', 'contents', 'item', GOLD, ['cell']),
  define('monster', 'Monster', 'contents', 'monster', DANGER, ['cell']),
  define('spyhole', 'Spy hole', 'contents', 'eye', STONE, ['edge']),

  // Annotation
  define('note', 'Note', 'notes', 'note', STONE, ['cell', 'edge']),
  define('question', 'Unresolved', 'notes', 'question', GOLD, ['cell', 'edge']),
  define('warning', 'Warning', 'notes', 'warning', DANGER, ['cell', 'edge']),
  define('done', 'Resolved', 'notes', 'done', GREEN, ['cell', 'edge']),
  define('waypoint', 'Waypoint', 'notes', 'flag', GREEN, ['cell']),
  define('marker', 'Marker', 'notes', 'star', GOLD, ['cell', 'edge']),
];

const BUILT_IN_BY_ID = new Map(BUILT_IN_STAMPS.map((stamp) => [stamp.id, stamp]));

/** Shown in place of a stamp whose definition is missing from the file. */
export const UNKNOWN_STAMP: StampDefinition = {
  id: '__unknown__',
  name: 'Unknown stamp',
  category: 'notes',
  icon: 'question',
  colour: '#8b93a1',
  anchors: ['cell', 'edge'],
  builtIn: true,
};

/**
 * Resolves a stamp id to its definition.
 *
 * An unrecognised id falls back to a neutral placeholder rather than being
 * dropped, so opening a map that used a custom stamp you no longer have still
 * shows that something is there.
 */
export function resolveStamp(
  dungeon: Pick<Dungeon, 'customStamps'>,
  stampId: string,
): StampDefinition {
  return (
    BUILT_IN_BY_ID.get(stampId) ??
    dungeon.customStamps.find((stamp) => stamp.id === stampId) ??
    UNKNOWN_STAMP
  );
}

export function allStamps(dungeon: Pick<Dungeon, 'customStamps'>): StampDefinition[] {
  return [...BUILT_IN_STAMPS, ...dungeon.customStamps];
}

export function isBuiltInStampId(stampId: string): boolean {
  return BUILT_IN_BY_ID.has(stampId);
}

export function stampAllowsAnchor(
  definition: StampDefinition,
  kind: 'cell' | 'edge',
): boolean {
  return definition.anchors.includes(kind);
}

/** Colours offered when creating a custom stamp. */
export const STAMP_COLOURS: string[] = [
  BRASS,
  GOLD,
  STONE,
  DANGER,
  ARCANE,
  GREEN,
  '#5aa9e6',
  '#e88bbd',
];
