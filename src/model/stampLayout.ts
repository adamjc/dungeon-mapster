import { cellKey, edgeKey } from './coords';
import type { Edge, Facing, Level, StampAnchor, StampInstance } from './types';

/**
 * Stamp layout.
 *
 * Rendering and hit-testing both read their positions from here. If they each
 * worked out their own geometry they would eventually disagree, and clicking a
 * symbol would select something else.
 *
 * All positions are in cell units, so the caller decides the pixel scale.
 */

export interface StampPlacement {
  stamp: StampInstance;
  cx: number;
  cy: number;
  size: number;
}

export interface OverflowBadge {
  cx: number;
  cy: number;
  size: number;
  count: number;
  anchorKey: string;
}

export interface StampLayout {
  placements: StampPlacement[];
  overflow: OverflowBadge[];
}

/** Beyond this many stamps in one square, the rest collapse into a badge. */
const MAX_VISIBLE_PER_CELL = 4;

/** How far a wall-mounted stamp sits from its wall, in cell units. */
const EDGE_INSET = 0.26;

const CELL_SLOTS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.3, 0.5],
    [0.7, 0.5],
  ],
  3: [
    [0.3, 0.32],
    [0.7, 0.32],
    [0.5, 0.72],
  ],
  4: [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.3, 0.7],
    [0.7, 0.7],
  ],
};

const CELL_SIZES: Record<number, number> = { 1: 0.62, 2: 0.44, 3: 0.4, 4: 0.4 };

const EDGE_SIZE_SINGLE = 0.4;
const EDGE_SIZE_CROWDED = 0.32;

export function anchorKey(anchor: StampAnchor): string {
  return anchor.kind === 'cell'
    ? `c:${cellKey(anchor.x, anchor.y)}`
    : `e:${edgeKey(anchor)}:${anchor.facing}`;
}

/** The square a wall-mounted stamp is seen from. */
export function facingCell(anchor: Extract<StampAnchor, { kind: 'edge' }>) {
  switch (anchor.facing) {
    case 'north':
      return { x: anchor.x, y: anchor.y - 1 };
    case 'south':
      return { x: anchor.x, y: anchor.y };
    case 'west':
      return { x: anchor.x - 1, y: anchor.y };
    case 'east':
      return { x: anchor.x, y: anchor.y };
  }
}

/**
 * Which side of a wall a click landed on, so a stamp faces the square the
 * user was pointing at.
 */
export function facingFromPoint(edge: Edge, fx: number, fy: number): Facing {
  if (edge.o === 'H') return fy < edge.y ? 'north' : 'south';
  return fx < edge.x ? 'west' : 'east';
}

export function facingsFor(edge: Edge): Facing[] {
  return edge.o === 'H' ? ['north', 'south'] : ['west', 'east'];
}

function byId(a: StampInstance, b: StampInstance): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function layoutStamps(level: Level): StampLayout {
  const groups = new Map<string, StampInstance[]>();

  for (const stamp of Object.values(level.stamps)) {
    const key = anchorKey(stamp.anchor);
    const group = groups.get(key);
    if (group) group.push(stamp);
    else groups.set(key, [stamp]);
  }

  const placements: StampPlacement[] = [];
  const overflow: OverflowBadge[] = [];

  for (const [key, group] of groups) {
    // Sorted so that layout is stable between renders rather than following
    // whatever order the stamps happen to be stored in.
    group.sort(byId);
    const anchor = group[0].anchor;

    if (anchor.kind === 'cell') {
      layoutCellGroup(anchor, group, key, placements, overflow);
    } else {
      layoutEdgeGroup(anchor, group, placements);
    }
  }

  return { placements, overflow };
}

function layoutCellGroup(
  anchor: Extract<StampAnchor, { kind: 'cell' }>,
  group: StampInstance[],
  key: string,
  placements: StampPlacement[],
  overflow: OverflowBadge[],
): void {
  const crowded = group.length > MAX_VISIBLE_PER_CELL;
  const visible = crowded ? group.slice(0, 3) : group;
  const slotCount = crowded ? 4 : visible.length;
  const slots = CELL_SLOTS[slotCount];
  const size = CELL_SIZES[slotCount];

  visible.forEach((stamp, index) => {
    const [ox, oy] = slots[index];
    placements.push({ stamp, cx: anchor.x + ox, cy: anchor.y + oy, size });
  });

  if (crowded) {
    const [ox, oy] = slots[3];
    overflow.push({
      cx: anchor.x + ox,
      cy: anchor.y + oy,
      size,
      count: group.length - 3,
      anchorKey: key,
    });
  }
}

function layoutEdgeGroup(
  anchor: Extract<StampAnchor, { kind: 'edge' }>,
  group: StampInstance[],
  placements: StampPlacement[],
): void {
  const size = group.length === 1 ? EDGE_SIZE_SINGLE : EDGE_SIZE_CROWDED;
  const horizontal = anchor.o === 'H';
  const inset =
    anchor.facing === 'north' || anchor.facing === 'west' ? -EDGE_INSET : EDGE_INSET;

  group.forEach((stamp, index) => {
    // Several stamps on one wall face spread out along it rather than stacking.
    const along = (index + 1) / (group.length + 1);
    placements.push({
      stamp,
      cx: horizontal ? anchor.x + along : anchor.x + inset,
      cy: horizontal ? anchor.y + inset : anchor.y + along,
      size,
    });
  });
}

/**
 * Where a single stamp would sit at an anchor, used to preview a placement
 * before it exists. Shares the constants used by the real layout so the
 * preview appears exactly where the stamp will land.
 */
export function soloPlacement(anchor: StampAnchor): {
  cx: number;
  cy: number;
  size: number;
} {
  if (anchor.kind === 'cell') {
    return { cx: anchor.x + 0.5, cy: anchor.y + 0.5, size: CELL_SIZES[1] };
  }

  const horizontal = anchor.o === 'H';
  const inset =
    anchor.facing === 'north' || anchor.facing === 'west' ? -EDGE_INSET : EDGE_INSET;

  return {
    cx: horizontal ? anchor.x + 0.5 : anchor.x + inset,
    cy: horizontal ? anchor.y + inset : anchor.y + 0.5,
    size: EDGE_SIZE_SINGLE,
  };
}

/**
 * The stamp drawn at a point, if any. Uses the same geometry as rendering, so
 * what you click is what you see.
 */
export function stampAtPoint(
  layout: StampLayout,
  fx: number,
  fy: number,
): StampInstance | null {
  let best: StampInstance | null = null;
  let bestDistance = Infinity;

  for (const placement of layout.placements) {
    const reach = placement.size * 0.62;
    const dx = Math.abs(fx - placement.cx);
    const dy = Math.abs(fy - placement.cy);
    if (dx > reach || dy > reach) continue;

    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = placement.stamp;
    }
  }

  return best;
}
