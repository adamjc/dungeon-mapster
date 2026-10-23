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

export const SCHEMA_VERSION = 1;

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

export interface Level {
  id: string;
  name: string;
  width: number;
  height: number;
  cells: Record<CellKey, CellData>;
  edges: Record<EdgeKey, EdgeData>;
}

export interface Dungeon {
  id: string;
  schemaVersion: number;
  name: string;
  game?: string;
  notes: string;
  levels: Level[];
  createdAt: string;
  updatedAt: string;
}

export type Selection =
  | { type: 'cell'; cell: Cell }
  | { type: 'edge'; edge: Edge }
  | null;

export type Tool =
  | 'select'
  | 'pan'
  | 'floor'
  | 'rectangle'
  | 'wall'
  | 'door'
  | 'eraser';
