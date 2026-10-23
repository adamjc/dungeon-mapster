import type { Cell, CellKey, Edge, EdgeKey, EdgeOrientation } from './types';

/**
 * Canonical edge addressing.
 *
 * An edge is identified by the cell it borders on its *north* or *west* side:
 *   { x, y, o: 'H' }  ->  north side of cell (x, y)   == south side of (x, y-1)
 *   { x, y, o: 'V' }  ->  west  side of cell (x, y)   == east  side of (x-1, y)
 *
 * Because each boundary has exactly one representation, two neighbouring cells
 * can never disagree about the wall between them.
 */

export function cellKey(x: number, y: number): CellKey {
  return `${x},${y}`;
}

export function parseCellKey(key: CellKey): Cell {
  const [x, y] = key.split(',');
  return { x: Number(x), y: Number(y) };
}

export function edgeKey(edge: Edge): EdgeKey {
  return `${edge.x},${edge.y},${edge.o}`;
}

export function parseEdgeKey(key: EdgeKey): Edge {
  const [x, y, o] = key.split(',');
  return { x: Number(x), y: Number(y), o: o as EdgeOrientation };
}

export const northEdge = (x: number, y: number): Edge => ({ x, y, o: 'H' });
export const southEdge = (x: number, y: number): Edge => ({ x, y: y + 1, o: 'H' });
export const westEdge = (x: number, y: number): Edge => ({ x, y, o: 'V' });
export const eastEdge = (x: number, y: number): Edge => ({ x: x + 1, y, o: 'V' });

/** The two cells an edge separates. Either may lie outside the level bounds. */
export function edgeNeighbours(edge: Edge): [Cell, Cell] {
  return edge.o === 'H'
    ? [{ x: edge.x, y: edge.y - 1 }, { x: edge.x, y: edge.y }]
    : [{ x: edge.x - 1, y: edge.y }, { x: edge.x, y: edge.y }];
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function sameEdge(a: Edge, b: Edge): boolean {
  return a.x === b.x && a.y === b.y && a.o === b.o;
}

/** Cell containing a point expressed in cell units (1.0 == one cell). */
export function cellAt(fx: number, fy: number): Cell {
  return { x: Math.floor(fx), y: Math.floor(fy) };
}

/**
 * Nearest edge to a point expressed in cell units.
 *
 * Wall and door tools always snap to the closest boundary rather than
 * requiring a precise hit, because edges are very thin targets.
 */
export function nearestEdge(fx: number, fy: number): Edge {
  const cx = Math.floor(fx);
  const cy = Math.floor(fy);
  const dx = fx - cx;
  const dy = fy - cy;

  const candidates: Array<{ edge: Edge; distance: number }> = [
    { edge: westEdge(cx, cy), distance: dx },
    { edge: eastEdge(cx, cy), distance: 1 - dx },
    { edge: northEdge(cx, cy), distance: dy },
    { edge: southEdge(cx, cy), distance: 1 - dy },
  ];

  return candidates.reduce((best, c) => (c.distance < best.distance ? c : best)).edge;
}

/** Distance in cell units from a point to an edge, measured perpendicularly. */
export function distanceToEdge(fx: number, fy: number, edge: Edge): number {
  return edge.o === 'H' ? Math.abs(fy - edge.y) : Math.abs(fx - edge.x);
}

/**
 * Nearest edge, but only when the point lies within `tolerance` cell units of
 * it. Used by tools that must choose between acting on an edge or on a cell.
 */
export function edgeWithin(fx: number, fy: number, tolerance: number): Edge | null {
  const edge = nearestEdge(fx, fy);
  return distanceToEdge(fx, fy, edge) <= tolerance ? edge : null;
}

/** Every cell in the rectangle spanned by two corners, inclusive. */
export function cellsInRect(a: Cell, b: Cell): Cell[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);

  const cells: Cell[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) cells.push({ x, y });
  }
  return cells;
}

/** The edges forming the outer boundary of the rectangle spanned by a and b. */
export function perimeterEdges(a: Cell, b: Cell): Edge[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);

  const edges: Edge[] = [];
  for (let x = x0; x <= x1; x++) {
    edges.push(northEdge(x, y0));
    edges.push(southEdge(x, y1));
  }
  for (let y = y0; y <= y1; y++) {
    edges.push(westEdge(x0, y));
    edges.push(eastEdge(x1, y));
  }
  return edges;
}

/** Edges strictly inside the rectangle, i.e. between two cells of the room. */
export function interiorEdges(a: Cell, b: Cell): Edge[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);

  const edges: Edge[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0 + 1; x <= x1; x++) edges.push(westEdge(x, y));
  }
  for (let y = y0 + 1; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) edges.push(northEdge(x, y));
  }
  return edges;
}

/**
 * Cells touched by a straight line between two points, in cell units.
 * Used so a fast drag paints a continuous stroke instead of leaving gaps.
 */
export function cellsAlongLine(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Cell[] {
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY)) * 3),
  );

  const seen = new Set<CellKey>();
  const cells: Cell[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cell = cellAt(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t);
    const key = cellKey(cell.x, cell.y);
    if (!seen.has(key)) {
      seen.add(key);
      cells.push(cell);
    }
  }
  return cells;
}

/** Evenly spaced sample points along a line, in cell units. */
export function pointsAlongLine(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Array<{ fx: number; fy: number }> {
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY)) * 4),
  );

  const points: Array<{ fx: number; fy: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({ fx: fromX + (toX - fromX) * t, fy: fromY + (toY - fromY) * t });
  }
  return points;
}

/** Edges nearest to a straight line between two points, in cell units. */
export function edgesAlongLine(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Edge[] {
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY)) * 4),
  );

  const seen = new Set<EdgeKey>();
  const edges: Edge[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const edge = nearestEdge(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t);
    const key = edgeKey(edge);
    if (!seen.has(key)) {
      seen.add(key);
      edges.push(edge);
    }
  }
  return edges;
}
