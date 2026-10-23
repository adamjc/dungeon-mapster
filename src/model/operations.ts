import {
  cellKey,
  cellsInRect,
  edgeKey,
  edgeWithin,
  interiorEdges,
  perimeterEdges,
} from './coords';
import type { Cell, Edge, EdgeKind, Level } from './types';

/**
 * Pure editing operations.
 *
 * Every function returns a new Level when something changed, or the original
 * reference when nothing did. The editor relies on that identity check to
 * avoid pushing empty entries onto the undo stack.
 */

/** Distance, in cell units, within which a click counts as hitting an edge. */
export const EDGE_HIT_TOLERANCE = 0.3;

export function cellInBounds(level: Level, cell: Cell): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < level.width && cell.y < level.height;
}

/** An edge is valid when it borders at least one in-bounds cell. */
export function edgeInBounds(level: Level, edge: Edge): boolean {
  return edge.o === 'H'
    ? edge.x >= 0 && edge.x < level.width && edge.y >= 0 && edge.y <= level.height
    : edge.x >= 0 && edge.x <= level.width && edge.y >= 0 && edge.y < level.height;
}

export function hasFloor(level: Level, cell: Cell): boolean {
  return cellKey(cell.x, cell.y) in level.cells;
}

export function getEdge(level: Level, edge: Edge): EdgeKind | null {
  return level.edges[edgeKey(edge)]?.kind ?? null;
}

export function clampCell(level: Level, cell: Cell): Cell {
  return {
    x: Math.min(Math.max(cell.x, 0), level.width - 1),
    y: Math.min(Math.max(cell.y, 0), level.height - 1),
  };
}

export function setFloors(level: Level, cells: Cell[], present: boolean): Level {
  let cellMap: Level['cells'] | null = null;

  for (const cell of cells) {
    if (!cellInBounds(level, cell)) continue;
    const key = cellKey(cell.x, cell.y);
    const exists = key in level.cells;
    if (exists === present) continue;

    cellMap ??= { ...level.cells };
    if (present) cellMap[key] = { floor: true };
    else delete cellMap[key];
  }

  return cellMap ? { ...level, cells: cellMap } : level;
}

export function setEdges(level: Level, edges: Edge[], kind: EdgeKind | null): Level {
  let edgeMap: Level['edges'] | null = null;

  for (const edge of edges) {
    if (!edgeInBounds(level, edge)) continue;
    const key = edgeKey(edge);
    const current = level.edges[key]?.kind ?? null;
    if (current === kind) continue;

    edgeMap ??= { ...level.edges };
    if (kind) edgeMap[key] = { kind };
    else delete edgeMap[key];
  }

  return edgeMap ? { ...level, edges: edgeMap } : level;
}

/**
 * Draws a room: floors throughout, walls around the outside, and an open
 * interior.
 *
 * Doors are never overwritten. Drawing a room that abuts an existing one keeps
 * the doorway between them intact rather than sealing it with a wall, and
 * interior walls are cleared only when they are plain walls.
 */
export function drawRoom(level: Level, a: Cell, b: Cell): Level {
  const from = clampCell(level, a);
  const to = clampCell(level, b);

  let next = setFloors(level, cellsInRect(from, to), true);

  const newWalls = perimeterEdges(from, to).filter(
    (edge) => edgeInBounds(next, edge) && getEdge(next, edge) === null,
  );
  next = setEdges(next, newWalls, 'wall');

  const clearable = interiorEdges(from, to).filter(
    (edge) => getEdge(next, edge) === 'wall',
  );
  return setEdges(next, clearable, null);
}

export type EraseTarget =
  | { type: 'edge'; edge: Edge }
  | { type: 'cell'; cell: Cell }
  | null;

/**
 * Decides what an eraser click at a point (in cell units) should remove.
 *
 * A nearby wall or door wins over the floor beneath it, so erasing a wall
 * does not also strip the squares on either side of it.
 */
export function eraseTargetAt(level: Level, fx: number, fy: number): EraseTarget {
  const edge = edgeWithin(fx, fy, EDGE_HIT_TOLERANCE);
  if (edge && edgeInBounds(level, edge) && getEdge(level, edge) !== null) {
    return { type: 'edge', edge };
  }

  const cell = { x: Math.floor(fx), y: Math.floor(fy) };
  if (cellInBounds(level, cell) && hasFloor(level, cell)) {
    return { type: 'cell', cell };
  }

  return null;
}

export function applyErase(level: Level, target: EraseTarget): Level {
  if (!target) return level;
  return target.type === 'edge'
    ? setEdges(level, [target.edge], null)
    : setFloors(level, [target.cell], false);
}
