import { describe, expect, it } from 'vitest';
import { eastEdge, northEdge, westEdge } from './coords';
import { createLevel } from './dungeon';
import {
  addStamp,
  applyErase,
  cellStamp,
  drawRoom,
  edgeStamp,
  eraseTargetAt,
  removeStamp,
  setEdges,
  setFloorsAndClean,
  stampAnchorAt,
  updateStamp,
} from './operations';
import { BUILT_IN_STAMPS, resolveStamp, UNKNOWN_STAMP } from './stamps';
import { ICONS } from './icons';
import type { Level } from './types';

const level = () => createLevel('Test', 12, 12);

describe('stamp editing', () => {
  it('adds, updates and removes a stamp', () => {
    let next = addStamp(level(), cellStamp('pit', { x: 2, y: 2 }, 's1'));
    expect(next.stamps.s1.stampId).toBe('pit');

    next = updateStamp(next, 's1', { label: 'Deep', note: 'Took a fall here' });
    expect(next.stamps.s1.label).toBe('Deep');
    expect(next.stamps.s1.note).toBe('Took a fall here');

    next = removeStamp(next, 's1');
    expect(next.stamps.s1).toBeUndefined();
  });

  it('drops optional fields that are cleared rather than storing empty text', () => {
    let next = addStamp(level(), cellStamp('pit', { x: 1, y: 1 }, 's1'));
    next = updateStamp(next, 's1', { label: 'temp', colour: '#fff' });
    next = updateStamp(next, 's1', { label: '', colour: undefined });

    expect('label' in next.stamps.s1).toBe(false);
    expect('colour' in next.stamps.s1).toBe(false);
  });

  it('ignores edits to a stamp that is not there', () => {
    const base = level();
    expect(updateStamp(base, 'missing', { label: 'x' })).toBe(base);
    expect(removeStamp(base, 'missing')).toBe(base);
  });

  it('changes which side of a wall a stamp faces', () => {
    let next = addStamp(level(), edgeStamp('keyhole', northEdge(3, 3), 'north', 's1'));
    const anchor = next.stamps.s1.anchor;
    if (anchor.kind !== 'edge') throw new Error('expected a wall anchor');

    next = updateStamp(next, 's1', { anchor: { ...anchor, facing: 'south' } });
    const updated = next.stamps.s1.anchor;
    expect(updated.kind === 'edge' && updated.facing).toBe('south');
  });
});

describe('choosing where a stamp lands', () => {
  const wallOnly = { anchors: ['edge'] as const };
  const cellOnly = { anchors: ['cell'] as const };
  const either = { anchors: ['cell', 'edge'] as const };

  it('snaps a wall-mounted stamp to the nearest wall, even mid-square', () => {
    const anchor = stampAnchorAt(level(), { anchors: [...wallOnly.anchors] }, 5.5, 5.45);
    expect(anchor?.kind).toBe('edge');
  });

  it('never puts a wall-mounted stamp in the middle of a square', () => {
    for (const [fx, fy] of [
      [5.5, 5.5],
      [2.1, 7.9],
      [0.5, 0.5],
    ]) {
      expect(stampAnchorAt(level(), { anchors: ['edge'] }, fx, fy)?.kind).toBe('edge');
    }
  });

  it('keeps a square-only stamp off the walls', () => {
    const anchor = stampAnchorAt(level(), { anchors: [...cellOnly.anchors] }, 4.02, 4.5);
    expect(anchor).toEqual({ kind: 'cell', x: 4, y: 4 });
  });

  it('attaches a flexible stamp to a wall only when the pointer is near one', () => {
    const near = stampAnchorAt(level(), { anchors: [...either.anchors] }, 4.03, 4.5);
    const middle = stampAnchorAt(level(), { anchors: [...either.anchors] }, 4.5, 4.5);

    expect(near?.kind).toBe('edge');
    expect(middle).toEqual({ kind: 'cell', x: 4, y: 4 });
  });

  it('refuses a placement outside the level', () => {
    expect(stampAnchorAt(level(), { anchors: ['cell'] }, -1.5, 3)).toBeNull();
    expect(stampAnchorAt(level(), { anchors: ['cell'] }, 3, 99)).toBeNull();
  });

  it('faces the stamp toward the square that was clicked', () => {
    const anchor = stampAnchorAt(level(), { anchors: ['edge'] }, 4.4, 4.5);
    expect(anchor).toEqual({ kind: 'edge', x: 4, y: 4, o: 'V', facing: 'east' });
  });
});

describe('eraser precedence', () => {
  function sample(): Level {
    let next = drawRoom(level(), { x: 1, y: 1 }, { x: 5, y: 5 });
    next = addStamp(next, cellStamp('pit', { x: 3, y: 3 }, 'floorStamp'));
    next = addStamp(next, edgeStamp('keyhole', westEdge(1, 2), 'east', 'wallStamp'));
    return next;
  }

  it('removes a stamp before the wall behind it', () => {
    const next = sample();
    // The keyhole hangs just inside the room, in front of the west wall.
    const target = eraseTargetAt(next, 1.26, 2.5);
    expect(target).toEqual({ type: 'stamp', stampId: 'wallStamp' });

    const erased = applyErase(next, target);
    expect(erased.stamps.wallStamp).toBeUndefined();
    expect(erased.edges).toEqual(next.edges);
  });

  it('removes a stamp before the floor beneath it', () => {
    const next = sample();
    const target = eraseTargetAt(next, 3.5, 3.5);
    expect(target).toEqual({ type: 'stamp', stampId: 'floorStamp' });

    const erased = applyErase(next, target);
    expect(erased.cells['3,3']).toBeDefined();
  });

  it('still reaches the wall when no stamp is in the way', () => {
    const next = sample();
    // The room's east wall, away from either stamp.
    const target = eraseTargetAt(next, 6.0, 4.5);
    expect(target).toEqual({ type: 'edge', edge: eastEdge(5, 4) });
  });

  it('still reaches the floor on a bare square', () => {
    const next = sample();
    expect(eraseTargetAt(next, 4.5, 2.5)).toEqual({
      type: 'cell',
      cell: { x: 4, y: 2 },
    });
  });
});

describe('clearing a square', () => {
  it('takes its stamps with it rather than leaving them floating', () => {
    let next = drawRoom(level(), { x: 1, y: 1 }, { x: 4, y: 4 });
    next = addStamp(next, cellStamp('pit', { x: 2, y: 2 }, 'inside'));
    next = addStamp(next, cellStamp('chest', { x: 3, y: 3 }, 'elsewhere'));

    const cleared = setFloorsAndClean(next, [{ x: 2, y: 2 }], false);
    expect(cleared.stamps.inside).toBeUndefined();
    expect(cleared.stamps.elsewhere).toBeDefined();
  });

  it('leaves wall stamps alone, since the wall survives', () => {
    let next = drawRoom(level(), { x: 1, y: 1 }, { x: 4, y: 4 });
    next = addStamp(next, edgeStamp('keyhole', westEdge(1, 1), 'east', 'onWall'));

    const cleared = setFloorsAndClean(next, [{ x: 1, y: 1 }], false);
    expect(cleared.stamps.onWall).toBeDefined();
  });

  it('does nothing when painting floor in', () => {
    const next = addStamp(level(), cellStamp('pit', { x: 2, y: 2 }, 'keep'));
    const painted = setFloorsAndClean(next, [{ x: 2, y: 2 }], true);
    expect(painted.stamps.keep).toBeDefined();
  });
});

describe('the built-in catalogue', () => {
  it('gives every stamp an icon that exists', () => {
    for (const stamp of BUILT_IN_STAMPS) {
      expect(ICONS[stamp.icon], `${stamp.id} uses missing icon ${stamp.icon}`).toBeDefined();
    }
  });

  it('gives every stamp at least one way to be placed', () => {
    for (const stamp of BUILT_IN_STAMPS) {
      expect(stamp.anchors.length).toBeGreaterThan(0);
    }
  });

  it('uses unique ids', () => {
    const ids = BUILT_IN_STAMPS.map((stamp) => stamp.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mounts keyholes, buttons and levers on walls only', () => {
    for (const id of ['keyhole', 'secretButton', 'lever', 'alcove']) {
      const stamp = BUILT_IN_STAMPS.find((candidate) => candidate.id === id);
      expect(stamp?.anchors, `${id} should be wall-only`).toEqual(['edge']);
    }
  });

  it('falls back to a placeholder for a stamp it does not know', () => {
    const dungeon = { customStamps: [] };
    expect(resolveStamp(dungeon, 'nonsense')).toBe(UNKNOWN_STAMP);
    expect(resolveStamp(dungeon, 'keyhole').name).toBe('Keyhole');
  });

  it('finds a custom stamp carried by the dungeon', () => {
    const custom = {
      id: 'custom-1',
      name: 'Blue rune',
      category: 'custom' as const,
      icon: 'rune',
      colour: '#5aa9e6',
      anchors: ['edge' as const],
      builtIn: false,
    };
    expect(resolveStamp({ customStamps: [custom] }, 'custom-1').name).toBe('Blue rune');
  });
});

describe('rooms and stamps together', () => {
  it('leaves stamps alone when a room is drawn over them', () => {
    let next = addStamp(level(), cellStamp('pit', { x: 3, y: 3 }, 'keep'));
    next = setEdges(next, [eastEdge(3, 3)], 'door');
    next = drawRoom(next, { x: 2, y: 2 }, { x: 6, y: 6 });

    expect(next.stamps.keep).toBeDefined();
  });
});
