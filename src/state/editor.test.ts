import { describe, expect, it } from 'vitest';
import { eastEdge } from '../model/coords';
import { setEdges, setFloors, hasFloor, getEdge } from '../model/operations';
import { activeLevel, createInitialState, editorReducer } from './editor';
import type { EditorAction, EditorState } from './editor';

function run(state: EditorState, ...actions: EditorAction[]): EditorState {
  return actions.reduce(editorReducer, state);
}

function paint(state: EditorState, x: number, y: number): EditorState {
  const level = setFloors(activeLevel(state), [{ x, y }], true);
  return editorReducer(state, { type: 'commitLevel', level });
}

describe('undo and redo', () => {
  it('restores the previous map and replays it again', () => {
    const start = createInitialState();
    const painted = paint(start, 2, 2);
    expect(hasFloor(activeLevel(painted), { x: 2, y: 2 })).toBe(true);

    const undone = editorReducer(painted, { type: 'undo' });
    expect(hasFloor(activeLevel(undone), { x: 2, y: 2 })).toBe(false);

    const redone = editorReducer(undone, { type: 'redo' });
    expect(hasFloor(activeLevel(redone), { x: 2, y: 2 })).toBe(true);
  });

  it('does nothing when there is no history', () => {
    const start = createInitialState();
    expect(editorReducer(start, { type: 'undo' })).toBe(start);
    expect(editorReducer(start, { type: 'redo' })).toBe(start);
  });

  it('discards the redo stack once a new edit is made', () => {
    let state = paint(createInitialState(), 1, 1);
    state = editorReducer(state, { type: 'undo' });
    expect(state.future).toHaveLength(1);

    state = paint(state, 5, 5);
    expect(state.future).toHaveLength(0);
  });

  it('ignores edits that change nothing', () => {
    const start = paint(createInitialState(), 3, 3);
    const again = paint(start, 3, 3);
    expect(again.past).toHaveLength(start.past.length);
  });
});

describe('strokes', () => {
  it('collapses a whole drag into a single undo step', () => {
    let state: EditorState = createInitialState();
    state = editorReducer(state, { type: 'beginStroke' });

    let level = activeLevel(state);
    for (let x = 0; x < 6; x++) {
      level = setFloors(level, [{ x, y: 4 }], true);
      state = editorReducer(state, { type: 'previewLevel', level });
    }
    state = editorReducer(state, { type: 'endStroke' });

    expect(state.past).toHaveLength(1);
    expect(hasFloor(activeLevel(state), { x: 5, y: 4 })).toBe(true);

    state = editorReducer(state, { type: 'undo' });
    for (let x = 0; x < 6; x++) {
      expect(hasFloor(activeLevel(state), { x, y: 4 })).toBe(false);
    }
  });

  it('adds no history when a drag changed nothing', () => {
    let state = run(createInitialState(), { type: 'beginStroke' });
    state = editorReducer(state, { type: 'endStroke' });
    expect(state.past).toHaveLength(0);
    expect(state.strokeBase).toBeNull();
  });
});

describe('levels', () => {
  it('adds a level and makes it active', () => {
    const state = editorReducer(createInitialState(), { type: 'addLevel' });
    expect(state.dungeon.levels).toHaveLength(2);
    expect(state.activeLevelId).toBe(state.dungeon.levels[1].id);
  });

  it('keeps each level independent', () => {
    let state = paint(createInitialState(), 1, 1);
    const firstId = state.activeLevelId;

    state = editorReducer(state, { type: 'addLevel' });
    state = paint(state, 7, 7);

    expect(hasFloor(activeLevel(state), { x: 1, y: 1 })).toBe(false);
    expect(hasFloor(activeLevel(state), { x: 7, y: 7 })).toBe(true);

    state = editorReducer(state, { type: 'selectLevel', levelId: firstId });
    expect(hasFloor(activeLevel(state), { x: 1, y: 1 })).toBe(true);
    expect(hasFloor(activeLevel(state), { x: 7, y: 7 })).toBe(false);
  });

  it('refuses to delete the last remaining level', () => {
    const state = createInitialState();
    expect(
      editorReducer(state, { type: 'deleteLevel', levelId: state.activeLevelId }),
    ).toBe(state);
  });

  it('restores a deleted level on undo', () => {
    let state = editorReducer(createInitialState(), { type: 'addLevel' });
    const doomed = state.activeLevelId;

    state = editorReducer(state, { type: 'deleteLevel', levelId: doomed });
    expect(state.dungeon.levels).toHaveLength(1);
    expect(state.activeLevelId).not.toBe(doomed);

    state = editorReducer(state, { type: 'undo' });
    expect(state.dungeon.levels).toHaveLength(2);
  });

  it('falls back to a valid level when undo removes the active one', () => {
    let state = editorReducer(createInitialState(), { type: 'addLevel' });
    const addedId = state.activeLevelId;

    state = editorReducer(state, { type: 'undo' });
    expect(state.activeLevelId).not.toBe(addedId);
    expect(activeLevel(state)).toBeDefined();
  });

  it('edits only the active level', () => {
    let state = editorReducer(createInitialState(), { type: 'addLevel' });
    const level = setEdges(activeLevel(state), [eastEdge(2, 2)], 'door');
    state = editorReducer(state, { type: 'commitLevel', level });

    expect(getEdge(state.dungeon.levels[1], eastEdge(2, 2))).toBe('door');
    expect(getEdge(state.dungeon.levels[0], eastEdge(2, 2))).toBeNull();
  });
});
