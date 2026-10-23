import { describe, expect, it } from 'vitest';
import {
  cellsAlongLine,
  cellsInRect,
  eastEdge,
  edgeKey,
  edgeNeighbours,
  edgeWithin,
  edgesAlongLine,
  interiorEdges,
  nearestEdge,
  northEdge,
  parseEdgeKey,
  perimeterEdges,
  southEdge,
  westEdge,
} from './coords';

describe('canonical edge addressing', () => {
  it('gives neighbouring cells the same key for the wall between them', () => {
    expect(edgeKey(eastEdge(3, 7))).toBe(edgeKey(westEdge(4, 7)));
    expect(edgeKey(southEdge(3, 7))).toBe(edgeKey(northEdge(3, 8)));
  });

  it('round-trips through its string key', () => {
    const edge = { x: 12, y: -3, o: 'V' as const };
    expect(parseEdgeKey(edgeKey(edge))).toEqual(edge);
  });

  it('reports the two cells an edge separates', () => {
    expect(edgeNeighbours(northEdge(2, 5))).toEqual([
      { x: 2, y: 4 },
      { x: 2, y: 5 },
    ]);
    expect(edgeNeighbours(westEdge(2, 5))).toEqual([
      { x: 1, y: 5 },
      { x: 2, y: 5 },
    ]);
  });
});

describe('nearestEdge', () => {
  it('snaps to the closest side of the square under the pointer', () => {
    expect(nearestEdge(4.05, 4.5)).toEqual(westEdge(4, 4));
    expect(nearestEdge(4.95, 4.5)).toEqual(eastEdge(4, 4));
    expect(nearestEdge(4.5, 4.05)).toEqual(northEdge(4, 4));
    expect(nearestEdge(4.5, 4.95)).toEqual(southEdge(4, 4));
  });

  it('resolves a point near a corner to one of that corner\'s edges', () => {
    const edge = nearestEdge(6.02, 6.03);
    expect([edgeKey(westEdge(6, 6)), edgeKey(northEdge(6, 6))]).toContain(
      edgeKey(edge),
    );
  });
});

describe('edgeWithin', () => {
  it('returns an edge only when the point is close enough', () => {
    expect(edgeWithin(4.02, 4.5, 0.3)).toEqual(westEdge(4, 4));
    expect(edgeWithin(4.5, 4.5, 0.3)).toBeNull();
  });
});

describe('rectangles', () => {
  it('enumerates every cell inside, regardless of drag direction', () => {
    const forwards = cellsInRect({ x: 1, y: 1 }, { x: 3, y: 2 });
    const backwards = cellsInRect({ x: 3, y: 2 }, { x: 1, y: 1 });
    expect(forwards).toHaveLength(6);
    expect(backwards).toHaveLength(6);
    expect(new Set(backwards.map((c) => `${c.x},${c.y}`))).toEqual(
      new Set(forwards.map((c) => `${c.x},${c.y}`)),
    );
  });

  it('produces a perimeter with one edge per boundary square side', () => {
    const edges = perimeterEdges({ x: 0, y: 0 }, { x: 2, y: 1 });
    // 3 wide x 2 tall -> 3 north + 3 south + 2 west + 2 east
    expect(edges).toHaveLength(10);
    expect(new Set(edges.map(edgeKey)).size).toBe(10);
  });

  it('keeps interior and perimeter edges disjoint', () => {
    const a = { x: 2, y: 2 };
    const b = { x: 5, y: 6 };
    const perimeter = new Set(perimeterEdges(a, b).map(edgeKey));
    const interior = interiorEdges(a, b).map(edgeKey);

    expect(interior.length).toBeGreaterThan(0);
    for (const key of interior) expect(perimeter.has(key)).toBe(false);
  });

  it('has no interior edges in a single square', () => {
    expect(interiorEdges({ x: 4, y: 4 }, { x: 4, y: 4 })).toHaveLength(0);
  });
});

describe('drag sampling', () => {
  it('returns a gap-free run of cells across a fast drag', () => {
    const cells = cellsAlongLine(0.5, 0.5, 5.5, 0.5);
    expect(cells.map((c) => c.x)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('collects the edges along a straight wall drag', () => {
    const edges = edgesAlongLine(0.5, 2.0, 3.5, 2.0);
    const keys = edges.map(edgeKey);
    expect(keys).toContain(edgeKey(northEdge(0, 2)));
    expect(keys).toContain(edgeKey(northEdge(3, 2)));
  });
});
