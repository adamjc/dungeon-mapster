/**
 * Core dungeon data model.
 *
 * Two anchor spaces exist on the map:
 *  - Cells: the squares a party stands in. Addressed by integer (x, y).
 *  - Edges: the boundaries between squares, where walls and doors live.
 *
 * Every edge is shared by exactly two cells, so it is stored once in a
 * canonical form to prevent neighbouring cells disagreeing about the wall
 * between them. See `coords.ts` for the canonical encoding.
 */

export const SCHEMA_VERSION = 2;

export type CellKey = string;
export type EdgeKey = string;

/** 'H' edges run east-west; 'V' edges run north-south. */
export type EdgeOrientation = 'H' | 'V';

export interface Cell {
  x: number;
  y: number;
}

export interface Edge {
  x: number;
  y: number;
  o: EdgeOrientation;
}

export type EdgeKind = 'wall' | 'door' | 'lockedDoor' | 'secretDoor';

export interface EdgeData {
  kind: EdgeKind;
}

export interface CellData {
  floor: true;
  /** Optional per-cell tint, used later for zones and keyed areas. */
  colour?: string;
}

/**
 * Stamps are the symbols placed on a map: keyholes, buttons, pits, stairs,
 * notes and so on.
 *
 * A stamp sits either in a square or on a wall face. The wall case matters:
 * in these games keyholes, buttons and levers are mounted on a wall and are
 * only visible from one side, so an edge stamp also records which way it
 * faces.
 */

export type StampAnchorKind = 'cell' | 'edge';

/** The compass direction a wall-mounted stamp faces, i.e. where it is seen from. */
export type Facing = 'north' | 'south' | 'east' | 'west';

export type StampAnchor =
  | { kind: 'cell'; x: number; y: number }
  | { kind: 'edge'; x: number; y: number; o: EdgeOrientation; facing: Facing };

export type StampCategory =
  | 'doors'
  | 'mechanisms'
  | 'hazards'
  | 'scenery'
  | 'contents'
  | 'notes'
  | 'custom';

export interface StampDefinition {
  id: string;
  name: string;
  category: StampCategory;
  /** Key into the bundled icon set. */
  icon: string;
  colour: string;
  /** Which anchors this stamp may use. */
  anchors: StampAnchorKind[];
  /** Whether this stamp can point at another level, as stairs do. */
  linkable?: boolean;
  builtIn: boolean;
}

export interface StampInstance {
  id: string;
  stampId: string;
  anchor: StampAnchor;
  /** Short text drawn beside the symbol. */
  label?: string;
  /** Longer text, shown in the properties panel. */
  note?: string;
  colour?: string;
  linkedLevelId?: string;
}

export interface Level {
  id: string;
  name: string;
  width: number;
  height: number;
  cells: Record<CellKey, CellData>;
  edges: Record<EdgeKey, EdgeData>;
  stamps: Record<string, StampInstance>;
}

export interface Dungeon {
  id: string;
  schemaVersion: number;
  name: string;
  game?: string;
  notes: string;
  levels: Level[];
  /**
   * Custom stamps belong to the dungeon rather than the browser, so an
   * exported map always carries the definitions it needs to render.
   */
  customStamps: StampDefinition[];
  createdAt: string;
  updatedAt: string;
}

export type Selection =
  | { type: 'cell'; cell: Cell }
  | { type: 'edge'; edge: Edge }
  | { type: 'stamp'; stampId: string }
  | null;

export type Tool =
  | 'select'
  | 'pan'
  | 'floor'
  | 'rectangle'
  | 'wall'
  | 'door'
  | 'stamp'
  | 'eraser';
