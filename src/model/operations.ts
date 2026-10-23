import {
  cellKey,
  cellsInRect,
  edgeKey,
  edgeWithin,
  interiorEdges,
  nearestEdge,
  perimeterEdges,
} from './coords';
import { facingFromPoint, layoutStamps, stampAtPoint } from './stampLayout';
import type {
  Cell,
  Edge,
  EdgeKind,
  Facing,
  Level,
  StampAnchor,
  StampDefinition,
  StampInstance,
} from './types';

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
  | { type: 'stamp'; stampId: string }
  | { type: 'edge'; edge: Edge }
  | { type: 'cell'; cell: Cell }
  | null;

/**
 * Decides what an eraser click at a point (in cell units) should remove.
 *
 * Targets are considered in the order they are drawn: a stamp sits on top of a
 * wall, and a wall sits on top of the floor. Erasing a wall therefore does not
 * also strip the squares on either side of it.
 */
export function eraseTargetAt(level: Level, fx: number, fy: number): EraseTarget {
  const stamp = stampAtPoint(layoutStamps(level), fx, fy);
  if (stamp) return { type: 'stamp', stampId: stamp.id };

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
  if (target.type === 'stamp') return removeStamp(level, target.stampId);
  return target.type === 'edge'
    ? setEdges(level, [target.edge], null)
    : setFloorsAndClean(level, [target.cell], false);
}

/**
 * Removing a square also removes anything stamped in it, so erasing a mapped
 * square does not leave orphaned symbols floating over blank space.
 */
export function setFloorsAndClean(level: Level, cells: Cell[], present: boolean): Level {
  const next = setFloors(level, cells, present);
  if (present || next === level) return next;

  const removed = new Set(cells.map((cell) => cellKey(cell.x, cell.y)));
  const orphaned = Object.values(next.stamps).filter(
    (stamp) =>
      stamp.anchor.kind === 'cell' &&
      removed.has(cellKey(stamp.anchor.x, stamp.anchor.y)),
  );

  return orphaned.length > 0
    ? removeStamps(
        next,
        orphaned.map((stamp) => stamp.id),
      )
    : next;
}

export function addStamp(level: Level, stamp: StampInstance): Level {
  return { ...level, stamps: { ...level.stamps, [stamp.id]: stamp } };
}

export function updateStamp(
  level: Level,
  stampId: string,
  changes: Partial<Omit<StampInstance, 'id'>>,
): Level {
  const existing = level.stamps[stampId];
  if (!existing) return level;

  const next: StampInstance = { ...existing, ...changes };

  // Optional fields are dropped when cleared, so empty strings do not
  // accumulate in saved files.
  for (const key of ['label', 'note', 'colour', 'linkedLevelId'] as const) {
    if (next[key] === '' || next[key] === undefined) delete next[key];
  }

  return { ...level, stamps: { ...level.stamps, [stampId]: next } };
}

export function removeStamp(level: Level, stampId: string): Level {
  if (!(stampId in level.stamps)) return level;
  const stamps = { ...level.stamps };
  delete stamps[stampId];
  return { ...level, stamps };
}

export function removeStamps(level: Level, stampIds: string[]): Level {
  const present = stampIds.filter((id) => id in level.stamps);
  if (present.length === 0) return level;

  const stamps = { ...level.stamps };
  for (const id of present) delete stamps[id];
  return { ...level, stamps };
}

/** Builds a stamp anchored to a square. */
export function cellStamp(stampId: string, cell: Cell, id: string): StampInstance {
  return { id, stampId, anchor: { kind: 'cell', x: cell.x, y: cell.y } };
}

/** Builds a stamp mounted on one face of a wall. */
export function edgeStamp(
  stampId: string,
  edge: Edge,
  facing: Facing,
  id: string,
): StampInstance {
  return {
    id,
    stampId,
    anchor: { kind: 'edge', x: edge.x, y: edge.y, o: edge.o, facing },
  };
}

/**
 * Where a stamp would land for a pointer at (fx, fy), honouring the anchors
 * its definition allows.
 *
 * A stamp that can only go on a wall snaps to the nearest one, since wall
 * faces are thin targets. A stamp that can go either way only attaches to a
 * wall when the pointer is genuinely close to it, so the common case of
 * dropping something in the middle of a square still works.
 */
export function stampAnchorAt(
  level: Level,
  definition: Pick<StampDefinition, 'anchors'>,
  fx: number,
  fy: number,
): StampAnchor | null {
  const canCell = definition.anchors.includes('cell');
  const canEdge = definition.anchors.includes('edge');

  if (canEdge) {
    const edge = canCell ? edgeWithin(fx, fy, EDGE_HIT_TOLERANCE) : nearestEdge(fx, fy);
    if (edge && edgeInBounds(level, edge)) {
      return {
        kind: 'edge',
        x: edge.x,
        y: edge.y,
        o: edge.o,
        facing: facingFromPoint(edge, fx, fy),
      };
    }
  }

  if (canCell) {
    const cell = { x: Math.floor(fx), y: Math.floor(fy) };
    if (cellInBounds(level, cell)) return { kind: 'cell', x: cell.x, y: cell.y };
  }

  return null;
}
