import { describe, expect, it } from 'vitest';
import { eastEdge, northEdge, westEdge } from './coords';
import { createLevel } from './dungeon';
import { addStamp, getEdge, hasFloor, setEdges, setFloors } from './operations';
import {
  MAX_LEVEL_SIZE,
  MIN_LEVEL_SIZE,
  contentBounds,
  levelBounds,
  resizeBounds,
  resizeHandleAt,
  resizeLevel,
} from './resize';
import type { Level } from './types';

const level = () => createLevel('Test', 10, 10);

const stamped = (base: Level, x: number, y: number): Level =>
  addStamp(base, { id: 's1', stampId: 'keyhole', anchor: { kind: 'cell', x, y } });

describe('contentBounds', () => {
  it('is null for an empty level', () => {
    expect(contentBounds(level())).toBeNull();
  });

  it('covers the squares that are drawn', () => {
    const drawn = setFloors(level(), [{ x: 3, y: 4 }, { x: 6, y: 5 }], true);
    expect(contentBounds(drawn)).toEqual({ x0: 3, y0: 4, x1: 7, y1: 6 });
  });

  it('keeps a wall on the outer boundary inside the bounds', () => {
    const walled = setEdges(level(), [northEdge(2, 0)], 'wall');
    expect(contentBounds(walled)).toEqual({ x0: 2, y0: 0, x1: 3, y1: 0 });

    const west = setEdges(level(), [westEdge(0, 4)], 'wall');
    expect(contentBounds(west)).toEqual({ x0: 0, y0: 4, x1: 0, y1: 5 });
  });

  it('covers stamps as well as the map', () => {
    expect(contentBounds(stamped(level(), 8, 1))).toEqual({ x0: 8, y0: 1, x1: 9, y1: 2 });
  });
});

describe('resizeBounds', () => {
  it('snaps the dragged side to the nearest grid line', () => {
    expect(resizeBounds(level(), 'e', 12.4, 0).x1).toBe(12);
    expect(resizeBounds(level(), 'e', 12.6, 0).x1).toBe(13);
  });

  it('leaves the sides that are not being dragged alone', () => {
    expect(resizeBounds(level(), 'e', 14, 99)).toEqual({ x0: 0, y0: 0, x1: 14, y1: 10 });
    expect(resizeBounds(level(), 's', 99, 14)).toEqual({ x0: 0, y0: 0, x1: 10, y1: 14 });
  });

  it('moves both sides of a corner', () => {
    expect(resizeBounds(level(), 'se', 14, 16)).toEqual({ x0: 0, y0: 0, x1: 14, y1: 16 });
    expect(resizeBounds(level(), 'nw', -2, -3)).toEqual({ x0: -2, y0: -3, x1: 10, y1: 10 });
  });

  it('will not shrink over squares that are already drawn', () => {
    const drawn = setFloors(level(), [{ x: 7, y: 7 }], true);
    expect(resizeBounds(drawn, 'e', 4, 0).x1).toBe(8);
    expect(resizeBounds(drawn, 's', 0, 4).y1).toBe(8);
  });

  it('will not shrink over a wall on the boundary', () => {
    const walled = setEdges(level(), [eastEdge(9, 2)], 'wall');
    expect(resizeBounds(walled, 'e', 3, 0).x1).toBe(10);
  });

  it('will not shrink over a stamp', () => {
    expect(resizeBounds(stamped(level(), 2, 2), 'w', 6, 0).x0).toBe(2);
  });

  it('keeps the level within the smallest and largest size', () => {
    expect(resizeBounds(level(), 'e', 1, 0).x1).toBe(MIN_LEVEL_SIZE);
    expect(resizeBounds(level(), 'e', 9999, 0).x1).toBe(MAX_LEVEL_SIZE);
    expect(resizeBounds(level(), 'w', 9, 0).x0).toBe(10 - MIN_LEVEL_SIZE);
    expect(resizeBounds(level(), 'w', -9999, 0).x0).toBe(10 - MAX_LEVEL_SIZE);
  });
});

describe('resizeLevel', () => {
  it('grows the east and south sides without touching the map', () => {
    const drawn = setFloors(level(), [{ x: 1, y: 1 }], true);
    const bigger = resizeLevel(drawn, { x0: 0, y0: 0, x1: 16, y1: 20 });

    expect(bigger.width).toBe(16);
    expect(bigger.height).toBe(20);
    expect(hasFloor(bigger, { x: 1, y: 1 })).toBe(true);
  });

  it('shifts the map when the origin moves', () => {
    let drawn = setFloors(level(), [{ x: 1, y: 1 }], true);
    drawn = setEdges(drawn, [northEdge(1, 1)], 'wall');
    drawn = stamped(drawn, 1, 1);

    const grown = resizeLevel(drawn, { x0: -3, y0: -2, x1: 10, y1: 10 });

    expect(grown.width).toBe(13);
    expect(grown.height).toBe(12);
    expect(hasFloor(grown, { x: 4, y: 3 })).toBe(true);
    expect(hasFloor(grown, { x: 1, y: 1 })).toBe(false);
    expect(getEdge(grown, northEdge(4, 3))).toBe('wall');
    expect(grown.stamps.s1.anchor).toMatchObject({ kind: 'cell', x: 4, y: 3 });
  });

  it('returns the same level when the extent is unchanged', () => {
    const base = level();
    expect(resizeLevel(base, levelBounds(base))).toBe(base);
  });

  it('refuses an empty extent', () => {
    const base = level();
    expect(resizeLevel(base, { x0: 4, y0: 0, x1: 4, y1: 10 })).toBe(base);
  });

  it('keeps every square when a clamped shrink is applied', () => {
    const drawn = setFloors(level(), [{ x: 2, y: 2 }, { x: 8, y: 8 }], true);
    const bounds = resizeBounds(drawn, 'nw', 5, 5);
    const shrunk = resizeLevel(drawn, bounds);

    expect(shrunk.width).toBe(8);
    expect(shrunk.height).toBe(8);
    expect(hasFloor(shrunk, { x: 0, y: 0 })).toBe(true);
    expect(hasFloor(shrunk, { x: 6, y: 6 })).toBe(true);
  });
});

describe('resizeHandleAt', () => {
  const base = level();

  it('finds the side the pointer is on', () => {
    expect(resizeHandleAt(base, 5, -0.2, 0.5, 0.1)).toBe('n');
    expect(resizeHandleAt(base, 5, 10.2, 0.5, 0.1)).toBe('s');
    expect(resizeHandleAt(base, -0.2, 5, 0.5, 0.1)).toBe('w');
    expect(resizeHandleAt(base, 10.2, 5, 0.5, 0.1)).toBe('e');
  });

  it('finds the corners', () => {
    expect(resizeHandleAt(base, -0.2, -0.2, 0.5, 0.1)).toBe('nw');
    expect(resizeHandleAt(base, 10.2, -0.2, 0.5, 0.1)).toBe('ne');
    expect(resizeHandleAt(base, -0.2, 10.2, 0.5, 0.1)).toBe('sw');
    expect(resizeHandleAt(base, 10.2, 10.2, 0.5, 0.1)).toBe('se');
  });

  it('ignores the middle of the map and points well outside it', () => {
    expect(resizeHandleAt(base, 5, 5, 0.5, 0.1)).toBeNull();
    expect(resizeHandleAt(base, 5, -2, 0.5, 0.1)).toBeNull();
    expect(resizeHandleAt(base, -2, -2, 0.5, 0.1)).toBeNull();
  });

  it('reaches further outside the level than inside it', () => {
    expect(resizeHandleAt(base, 5, -0.4, 0.5, 0.1)).toBe('n');
    expect(resizeHandleAt(base, 5, 0.4, 0.5, 0.1)).toBeNull();
  });
});
