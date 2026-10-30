import { cellKey, edgeKey, parseCellKey, parseEdgeKey } from './coords';
import type { Level, StampAnchor } from './types';

/**
 * Resizing a level by dragging its boundary.
 *
 * A level always starts at (0, 0), so growing or shrinking the north or west
 * side moves the origin: every square, wall and stamp shifts by the same
 * amount to stay where the mapper drew it. `resizeBounds` works out the new
 * extent for a drag and `resizeLevel` applies it.
 */

export const MIN_LEVEL_SIZE = 4;
/** Matches the limit the file format accepts, so a resized level still exports. */
export const MAX_LEVEL_SIZE = 512;

/** Which part of the boundary a drag is moving. */
export type ResizeSide = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

/**
 * A rectangle in a level's own coordinates, covering [x0, x1) by [y0, y1).
 * The level as it stands is always { x0: 0, y0: 0, x1: width, y1: height }.
 */
export interface LevelBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function levelBounds(level: Level): LevelBounds {
  return { x0: 0, y0: 0, x1: level.width, y1: level.height };
}

export function boundsEqual(a: LevelBounds, b: LevelBounds): boolean {
  return a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/**
 * The smallest extent that still holds everything drawn on the level, or null
 * when the level is empty.
 *
 * A wall on the north side of row 0 needs the boundary to stay at y = 0, so
 * edges contribute their line rather than a square.
 */
export function contentBounds(level: Level): LevelBounds | null {
  let bounds: LevelBounds | null = null;

  const extend = (x0: number, y0: number, x1: number, y1: number) => {
    bounds = bounds
      ? {
          x0: Math.min(bounds.x0, x0),
          y0: Math.min(bounds.y0, y0),
          x1: Math.max(bounds.x1, x1),
          y1: Math.max(bounds.y1, y1),
        }
      : { x0, y0, x1, y1 };
  };

  const extendCell = (x: number, y: number) => extend(x, y, x + 1, y + 1);
  const extendEdge = (x: number, y: number, o: 'H' | 'V') =>
    o === 'H' ? extend(x, y, x + 1, y) : extend(x, y, x, y + 1);

  for (const key of Object.keys(level.cells)) {
    const cell = parseCellKey(key);
    extendCell(cell.x, cell.y);
  }

  for (const key of Object.keys(level.edges)) {
    const edge = parseEdgeKey(key);
    extendEdge(edge.x, edge.y, edge.o);
  }

  for (const stamp of Object.values(level.stamps)) {
    const anchor = stamp.anchor;
    if (anchor.kind === 'cell') extendCell(anchor.x, anchor.y);
    else extendEdge(anchor.x, anchor.y, anchor.o);
  }

  return bounds;
}

/**
 * The extent a drag produces, clamped so the level keeps a sane size and never
 * shrinks over anything already drawn.
 *
 * `fx` and `fy` are the pointer position in cell units, measured against the
 * level as it was when the drag began. Boundaries sit on grid lines, so the
 * pointer snaps to the nearest one.
 */
export function resizeBounds(
  level: Level,
  side: ResizeSide,
  fx: number,
  fy: number,
): LevelBounds {
  const next = levelBounds(level);
  const content = contentBounds(level);
  const keepX0 = content ? content.x0 : Infinity;
  const keepY0 = content ? content.y0 : Infinity;
  const keepX1 = content ? content.x1 : -Infinity;
  const keepY1 = content ? content.y1 : -Infinity;

  if (side.includes('w')) {
    next.x0 = clamp(
      Math.round(fx),
      next.x1 - MAX_LEVEL_SIZE,
      Math.min(keepX0, next.x1 - MIN_LEVEL_SIZE),
    );
  }
  if (side.includes('e')) {
    next.x1 = clamp(
      Math.round(fx),
      Math.max(keepX1, next.x0 + MIN_LEVEL_SIZE),
      next.x0 + MAX_LEVEL_SIZE,
    );
  }
  if (side.includes('n')) {
    next.y0 = clamp(
      Math.round(fy),
      next.y1 - MAX_LEVEL_SIZE,
      Math.min(keepY0, next.y1 - MIN_LEVEL_SIZE),
    );
  }
  if (side.includes('s')) {
    next.y1 = clamp(
      Math.round(fy),
      Math.max(keepY1, next.y0 + MIN_LEVEL_SIZE),
      next.y0 + MAX_LEVEL_SIZE,
    );
  }

  return next;
}

function shiftAnchor(anchor: StampAnchor, dx: number, dy: number): StampAnchor {
  return { ...anchor, x: anchor.x + dx, y: anchor.y + dy };
}

/**
 * Applies a new extent, translating the map so it keeps its place relative to
 * the new origin. Nothing is discarded: callers clamp with `resizeBounds` so a
 * shrink can never cut into the map.
 */
export function resizeLevel(level: Level, bounds: LevelBounds): Level {
  const width = bounds.x1 - bounds.x0;
  const height = bounds.y1 - bounds.y0;
  if (width < 1 || height < 1) return level;
  if (boundsEqual(bounds, levelBounds(level))) return level;

  const dx = -bounds.x0;
  const dy = -bounds.y0;
  if (dx === 0 && dy === 0) return { ...level, width, height };

  const cells: Level['cells'] = {};
  for (const [key, data] of Object.entries(level.cells)) {
    const cell = parseCellKey(key);
    cells[cellKey(cell.x + dx, cell.y + dy)] = data;
  }

  const edges: Level['edges'] = {};
  for (const [key, data] of Object.entries(level.edges)) {
    const edge = parseEdgeKey(key);
    edges[edgeKey({ x: edge.x + dx, y: edge.y + dy, o: edge.o })] = data;
  }

  const stamps: Level['stamps'] = {};
  for (const [id, stamp] of Object.entries(level.stamps)) {
    stamps[id] = { ...stamp, anchor: shiftAnchor(stamp.anchor, dx, dy) };
  }

  return { ...level, width, height, cells, edges, stamps };
}

/**
 * The handle under a pointer at (fx, fy) in cell units, or null when the
 * pointer is not on the boundary.
 *
 * The grab zone reaches further outside the level than inside it, so drawing
 * along the outermost squares is not interrupted by the handles.
 */
export function resizeHandleAt(
  level: Level,
  fx: number,
  fy: number,
  outside: number,
  inside: number,
): ResizeSide | null {
  if (fx < -outside || fx > level.width + outside) return null;
  if (fy < -outside || fy > level.height + outside) return null;

  const west = fx <= inside;
  const east = fx >= level.width - inside;
  const north = fy <= inside;
  const south = fy >= level.height - inside;

  const vertical = north ? 'n' : south ? 's' : '';
  const horizontal = west ? 'w' : east ? 'e' : '';
  const side = `${vertical}${horizontal}`;

  return side === '' ? null : (side as ResizeSide);
}

export function resizeCursor(side: ResizeSide): string {
  if (side === 'n' || side === 's') return 'ns-resize';
  if (side === 'e' || side === 'w') return 'ew-resize';
  return side === 'nw' || side === 'se' ? 'nwse-resize' : 'nesw-resize';
}
