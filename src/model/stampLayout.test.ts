import { describe, expect, it } from 'vitest';
import { eastEdge, northEdge, southEdge, westEdge } from './coords';
import { createLevel } from './dungeon';
import { addStamp, cellStamp, edgeStamp } from './operations';
import {
  anchorKey,
  facingCell,
  facingFromPoint,
  facingsFor,
  layoutStamps,
  soloPlacement,
  stampAtPoint,
} from './stampLayout';
import type { Level, StampInstance } from './types';

function withStamps(...stamps: StampInstance[]): Level {
  return stamps.reduce(addStamp, createLevel('Test', 16, 16));
}

describe('facing', () => {
  it('faces the side of the wall the pointer was on', () => {
    expect(facingFromPoint(northEdge(4, 4), 4.5, 3.8)).toBe('north');
    expect(facingFromPoint(northEdge(4, 4), 4.5, 4.2)).toBe('south');
    expect(facingFromPoint(westEdge(4, 4), 3.8, 4.5)).toBe('west');
    expect(facingFromPoint(westEdge(4, 4), 4.2, 4.5)).toBe('east');
  });

  it('offers only the facings a wall can have', () => {
    expect(facingsFor(northEdge(2, 2))).toEqual(['north', 'south']);
    expect(facingsFor(westEdge(2, 2))).toEqual(['west', 'east']);
  });

  it('resolves which square a wall stamp is seen from', () => {
    // The wall between (3,3) and (3,4) is the north edge of (3,4).
    expect(facingCell({ kind: 'edge', x: 3, y: 4, o: 'H', facing: 'north' })).toEqual({
      x: 3,
      y: 3,
    });
    expect(facingCell({ kind: 'edge', x: 3, y: 4, o: 'H', facing: 'south' })).toEqual({
      x: 3,
      y: 4,
    });
    expect(facingCell({ kind: 'edge', x: 3, y: 4, o: 'V', facing: 'west' })).toEqual({
      x: 2,
      y: 4,
    });
  });

  it('treats the two faces of one wall as different places', () => {
    const north = anchorKey({ kind: 'edge', x: 2, y: 2, o: 'H', facing: 'north' });
    const south = anchorKey({ kind: 'edge', x: 2, y: 2, o: 'H', facing: 'south' });
    expect(north).not.toBe(south);
  });
});

describe('cell layout', () => {
  it('centres a lone stamp', () => {
    const level = withStamps(cellStamp('pit', { x: 3, y: 4 }, 's1'));
    const [placement] = layoutStamps(level).placements;
    expect(placement.cx).toBeCloseTo(3.5);
    expect(placement.cy).toBeCloseTo(4.5);
  });

  it('spreads several stamps out without overlapping', () => {
    const level = withStamps(
      cellStamp('pit', { x: 1, y: 1 }, 'a'),
      cellStamp('chest', { x: 1, y: 1 }, 'b'),
      cellStamp('well', { x: 1, y: 1 }, 'c'),
      cellStamp('altar', { x: 1, y: 1 }, 'd'),
    );
    const { placements, overflow } = layoutStamps(level);

    expect(placements).toHaveLength(4);
    expect(overflow).toHaveLength(0);

    const positions = new Set(
      placements.map((p) => `${p.cx.toFixed(2)},${p.cy.toFixed(2)}`),
    );
    expect(positions.size).toBe(4);
  });

  it('collapses a crowded square into a badge', () => {
    const level = withStamps(
      ...['a', 'b', 'c', 'd', 'e', 'f'].map((id) =>
        cellStamp('pit', { x: 2, y: 2 }, id),
      ),
    );
    const { placements, overflow } = layoutStamps(level);

    expect(placements).toHaveLength(3);
    expect(overflow).toHaveLength(1);
    expect(overflow[0].count).toBe(3);
  });

  it('lays out identically however the stamps were stored', () => {
    const forwards = withStamps(
      cellStamp('pit', { x: 1, y: 1 }, 'a'),
      cellStamp('chest', { x: 1, y: 1 }, 'b'),
    );
    const backwards = withStamps(
      cellStamp('chest', { x: 1, y: 1 }, 'b'),
      cellStamp('pit', { x: 1, y: 1 }, 'a'),
    );

    const describe_ = (level: Level) =>
      layoutStamps(level)
        .placements.map((p) => `${p.stamp.id}@${p.cx},${p.cy}`)
        .sort();

    expect(describe_(forwards)).toEqual(describe_(backwards));
  });
});

describe('wall layout', () => {
  it('sits a stamp inside the square it faces', () => {
    const north = withStamps(edgeStamp('keyhole', northEdge(5, 5), 'north', 's'));
    const south = withStamps(edgeStamp('keyhole', northEdge(5, 5), 'south', 's'));

    const [a] = layoutStamps(north).placements;
    const [b] = layoutStamps(south).placements;

    expect(a.cy).toBeLessThan(5);
    expect(b.cy).toBeGreaterThan(5);
    expect(a.cx).toBeCloseTo(5.5);
    expect(b.cx).toBeCloseTo(5.5);
  });

  it('keeps the two faces of one wall apart', () => {
    const level = withStamps(
      edgeStamp('keyhole', westEdge(5, 5), 'west', 'a'),
      edgeStamp('button', westEdge(5, 5), 'east', 'b'),
    );
    const { placements } = layoutStamps(level);
    expect(placements).toHaveLength(2);
    expect(placements[0].cx).not.toBeCloseTo(placements[1].cx);
  });

  it('spreads several stamps along one wall face', () => {
    const level = withStamps(
      edgeStamp('keyhole', southEdge(3, 3), 'south', 'a'),
      edgeStamp('button', southEdge(3, 3), 'south', 'b'),
    );
    const { placements } = layoutStamps(level);
    expect(placements[0].cx).not.toBeCloseTo(placements[1].cx);
    expect(placements[0].cy).toBeCloseTo(placements[1].cy);
  });
});

describe('hit-testing agrees with layout', () => {
  it('finds every stamp at the point it is drawn', () => {
    const level = withStamps(
      cellStamp('pit', { x: 2, y: 2 }, 'a'),
      cellStamp('chest', { x: 2, y: 2 }, 'b'),
      cellStamp('well', { x: 2, y: 2 }, 'c'),
      edgeStamp('keyhole', eastEdge(6, 6), 'east', 'd'),
      edgeStamp('lever', northEdge(8, 8), 'north', 'e'),
    );
    const layout = layoutStamps(level);

    for (const placement of layout.placements) {
      const hit = stampAtPoint(layout, placement.cx, placement.cy);
      expect(hit?.id).toBe(placement.stamp.id);
    }
  });

  it('returns nothing on empty space', () => {
    const level = withStamps(cellStamp('pit', { x: 2, y: 2 }, 'a'));
    expect(stampAtPoint(layoutStamps(level), 9.5, 9.5)).toBeNull();
  });

  it('previews a placement where the stamp will actually land', () => {
    const anchors = [
      { kind: 'cell' as const, x: 4, y: 7 },
      { kind: 'edge' as const, x: 4, y: 7, o: 'H' as const, facing: 'north' as const },
      { kind: 'edge' as const, x: 4, y: 7, o: 'V' as const, facing: 'east' as const },
    ];

    for (const anchor of anchors) {
      const preview = soloPlacement(anchor);
      const stamp: StampInstance = { id: 'solo', stampId: 'pit', anchor };
      const [actual] = layoutStamps(withStamps(stamp)).placements;

      expect(preview.cx).toBeCloseTo(actual.cx);
      expect(preview.cy).toBeCloseTo(actual.cy);
      expect(preview.size).toBeCloseTo(actual.size);
    }
  });
});
