import { describe, expect, it } from 'vitest';
import { eastEdge, northEdge, southEdge, westEdge } from './coords';
import { createLevel } from './dungeon';
import {
  applyErase,
  drawRoom,
  eraseTargetAt,
  getEdge,
  hasFloor,
  setEdges,
  setFloors,
} from './operations';

const level = () => createLevel('Test', 10, 10);

describe('setFloors', () => {
  it('adds and removes floor squares', () => {
    const painted = setFloors(level(), [{ x: 1, y: 1 }], true);
    expect(hasFloor(painted, { x: 1, y: 1 })).toBe(true);

    const cleared = setFloors(painted, [{ x: 1, y: 1 }], false);
    expect(hasFloor(cleared, { x: 1, y: 1 })).toBe(false);
  });

  it('ignores squares outside the level', () => {
    const base = level();
    const result = setFloors(base, [{ x: -1, y: 0 }, { x: 10, y: 0 }], true);
    expect(result).toBe(base);
  });

  it('returns the same object when nothing changes', () => {
    const painted = setFloors(level(), [{ x: 2, y: 2 }], true);
    expect(setFloors(painted, [{ x: 2, y: 2 }], true)).toBe(painted);
  });
});

describe('setEdges', () => {
  it('writes a wall that both neighbouring squares agree on', () => {
    const walled = setEdges(level(), [eastEdge(1, 1)], 'wall');
    expect(getEdge(walled, eastEdge(1, 1))).toBe('wall');
    expect(getEdge(walled, westEdge(2, 1))).toBe('wall');
  });

  it('allows the outer boundary of the level', () => {
    const walled = setEdges(level(), [westEdge(0, 0), eastEdge(9, 9)], 'wall');
    expect(getEdge(walled, westEdge(0, 0))).toBe('wall');
    expect(getEdge(walled, eastEdge(9, 9))).toBe('wall');
  });

  it('rejects edges beyond the boundary', () => {
    const base = level();
    expect(setEdges(base, [westEdge(-1, 0)], 'wall')).toBe(base);
    expect(setEdges(base, [northEdge(0, 11)], 'wall')).toBe(base);
  });
});

describe('drawRoom', () => {
  it('fills the floor and walls the perimeter', () => {
    const room = drawRoom(level(), { x: 1, y: 1 }, { x: 3, y: 3 });

    expect(hasFloor(room, { x: 2, y: 2 })).toBe(true);
    expect(hasFloor(room, { x: 0, y: 0 })).toBe(false);
    expect(getEdge(room, northEdge(1, 1))).toBe('wall');
    expect(getEdge(room, southEdge(3, 3))).toBe('wall');
    expect(getEdge(room, westEdge(1, 2))).toBe('wall');
  });

  it('leaves the interior open', () => {
    const room = drawRoom(level(), { x: 1, y: 1 }, { x: 3, y: 3 });
    expect(getEdge(room, eastEdge(1, 1))).toBeNull();
    expect(getEdge(room, southEdge(2, 1))).toBeNull();
  });

  it('clears plain interior walls when a room is drawn over them', () => {
    let next = setEdges(level(), [eastEdge(1, 1)], 'wall');
    next = drawRoom(next, { x: 1, y: 1 }, { x: 3, y: 3 });
    expect(getEdge(next, eastEdge(1, 1))).toBeNull();
  });

  it('never replaces an existing door with a wall', () => {
    let next = setEdges(level(), [westEdge(1, 2)], 'door');
    next = drawRoom(next, { x: 1, y: 1 }, { x: 3, y: 3 });
    expect(getEdge(next, westEdge(1, 2))).toBe('door');
  });

  it('keeps interior doors so adjoining rooms stay connected', () => {
    let next = setEdges(level(), [eastEdge(1, 1)], 'door');
    next = drawRoom(next, { x: 1, y: 1 }, { x: 3, y: 3 });
    expect(getEdge(next, eastEdge(1, 1))).toBe('door');
  });

  it('clips to the level bounds', () => {
    const room = drawRoom(level(), { x: -5, y: -5 }, { x: 2, y: 2 });
    expect(hasFloor(room, { x: 0, y: 0 })).toBe(true);
    expect(Object.keys(room.cells)).toHaveLength(9);
  });

  it('works in any drag direction', () => {
    const forwards = drawRoom(level(), { x: 1, y: 1 }, { x: 3, y: 3 });
    const backwards = drawRoom(level(), { x: 3, y: 3 }, { x: 1, y: 1 });
    expect(Object.keys(backwards.cells).sort()).toEqual(
      Object.keys(forwards.cells).sort(),
    );
    expect(Object.keys(backwards.edges).sort()).toEqual(
      Object.keys(forwards.edges).sort(),
    );
  });
});

describe('eraser targeting', () => {
  const room = drawRoom(level(), { x: 1, y: 1 }, { x: 3, y: 3 });

  it('removes a wall rather than the floor beside it', () => {
    const target = eraseTargetAt(room, 1.0, 1.5);
    expect(target).toEqual({ type: 'edge', edge: westEdge(1, 1) });

    const erased = applyErase(room, target);
    expect(getEdge(erased, westEdge(1, 1))).toBeNull();
    expect(hasFloor(erased, { x: 1, y: 1 })).toBe(true);
  });

  it('removes the floor when the pointer is away from any wall', () => {
    const target = eraseTargetAt(room, 2.5, 2.5);
    expect(target).toEqual({ type: 'cell', cell: { x: 2, y: 2 } });
    expect(hasFloor(applyErase(room, target), { x: 2, y: 2 })).toBe(false);
  });

  it('ignores edges that hold nothing', () => {
    const target = eraseTargetAt(room, 2.0, 2.5);
    expect(target).toEqual({ type: 'cell', cell: { x: 2, y: 2 } });
  });

  it('does nothing on empty space', () => {
    const base = level();
    expect(eraseTargetAt(base, 5.5, 5.5)).toBeNull();
    expect(applyErase(base, null)).toBe(base);
  });
});
