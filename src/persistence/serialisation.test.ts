import { describe, expect, it } from 'vitest';
import { eastEdge, northEdge } from '../model/coords';
import { createDungeon, createLevel } from '../model/dungeon';
import { drawRoom, setEdges } from '../model/operations';
import { SCHEMA_VERSION } from '../model/types';
import type { Dungeon } from '../model/types';
import {
  dungeonFileName,
  parseDungeonFile,
  serialiseDungeon,
} from './serialisation';

function sampleDungeon(): Dungeon {
  const dungeon = createDungeon('Chaos Strikes Back');
  const level = drawRoom(dungeon.levels[0], { x: 1, y: 1 }, { x: 4, y: 4 });
  const withDoor = setEdges(level, [eastEdge(4, 2)], 'door');

  return {
    ...dungeon,
    game: 'Dungeon Master II',
    notes: 'Mind the pits',
    levels: [withDoor, createLevel('Level 2')],
  };
}

function expectOk(result: ReturnType<typeof parseDungeonFile>) {
  if (!result.ok) throw new Error(`Expected success, got: ${result.error}`);
  return result.dungeon;
}

describe('round trip', () => {
  it('preserves the whole dungeon through export and import', () => {
    const original = sampleDungeon();
    const restored = expectOk(parseDungeonFile(serialiseDungeon(original)));

    expect(restored.id).toBe(original.id);
    expect(restored.name).toBe('Chaos Strikes Back');
    expect(restored.game).toBe('Dungeon Master II');
    expect(restored.notes).toBe('Mind the pits');
    expect(restored.levels).toHaveLength(2);
    expect(restored.levels[0].cells).toEqual(original.levels[0].cells);
    expect(restored.levels[0].edges).toEqual(original.levels[0].edges);
    expect(restored.levels[1].name).toBe('Level 2');
  });

  it('keeps every door type intact', () => {
    const dungeon = createDungeon();
    const level = setEdges(
      setEdges(
        setEdges(dungeon.levels[0], [northEdge(1, 1)], 'door'),
        [northEdge(2, 1)],
        'lockedDoor',
      ),
      [northEdge(3, 1)],
      'secretDoor',
    );

    const restored = expectOk(
      parseDungeonFile(serialiseDungeon({ ...dungeon, levels: [level] })),
    );
    expect(restored.levels[0].edges).toEqual(level.edges);
  });

  it('writes a versioned, identifiable file', () => {
    const file = JSON.parse(serialiseDungeon(sampleDungeon()));
    expect(file.format).toBe('dungeon-mapper');
    expect(file.schemaVersion).toBe(SCHEMA_VERSION);
    expect(typeof file.exportedAt).toBe('string');
  });
});

describe('rejecting bad files', () => {
  const cases: Array<[string, string, RegExp]> = [
    ['not JSON at all', 'this is not json', /not valid JSON/i],
    ['a JSON array', '[]', /must be an object/i],
    ['no levels', '{"id":"a","name":"x","levels":[]}', /at least one level/i],
    [
      'a missing name',
      '{"id":"a","levels":[{"id":"l","name":"n","width":4,"height":4}]}',
      /name must be a string/i,
    ],
    [
      'a bad square reference',
      '{"id":"a","name":"x","levels":[{"id":"l","name":"n","width":4,"height":4,"cells":{"oops":{"floor":true}},"edges":{}}]}',
      /invalid square reference/i,
    ],
    [
      'a bad wall reference',
      '{"id":"a","name":"x","levels":[{"id":"l","name":"n","width":4,"height":4,"cells":{},"edges":{"1,1,Z":{"kind":"wall"}}}]}',
      /invalid wall reference/i,
    ],
    [
      'an unknown wall type',
      '{"id":"a","name":"x","levels":[{"id":"l","name":"n","width":4,"height":4,"cells":{},"edges":{"1,1,H":{"kind":"portcullis"}}}]}',
      /unknown wall type/i,
    ],
    [
      'an absurd level size',
      '{"id":"a","name":"x","levels":[{"id":"l","name":"n","width":99999,"height":4,"cells":{},"edges":{}}]}',
      /between 1 and 512/i,
    ],
    [
      'a non-integer size',
      '{"id":"a","name":"x","levels":[{"id":"l","name":"n","width":4.5,"height":4,"cells":{},"edges":{}}]}',
      /whole number/i,
    ],
    [
      'duplicate level ids',
      '{"id":"a","name":"x","levels":[{"id":"same","name":"n","width":4,"height":4,"cells":{},"edges":{}},{"id":"same","name":"m","width":4,"height":4,"cells":{},"edges":{}}]}',
      /same id/i,
    ],
  ];

  it.each(cases)('rejects %s with a useful message', (_label, text, pattern) => {
    const result = parseDungeonFile(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(pattern);
  });

  it('refuses a file from a newer schema version', () => {
    const result = parseDungeonFile(
      JSON.stringify({
        format: 'dungeon-mapper',
        schemaVersion: SCHEMA_VERSION + 1,
        dungeon: sampleDungeon(),
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version/i);
  });

  it('refuses a file exported by something else', () => {
    const result = parseDungeonFile('{"format":"some-other-tool","dungeon":{}}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not exported by/i);
  });
});

describe('tolerant parsing', () => {
  it('accepts a bare dungeon object without the file wrapper', () => {
    const dungeon = sampleDungeon();
    const restored = expectOk(parseDungeonFile(JSON.stringify(dungeon)));
    expect(restored.name).toBe('Chaos Strikes Back');
    expect(restored.levels).toHaveLength(2);
  });

  it('fills in optional fields that are absent', () => {
    const restored = expectOk(
      parseDungeonFile(
        '{"id":"a","name":"x","levels":[{"id":"l","name":"n","width":4,"height":4}]}',
      ),
    );
    expect(restored.notes).toBe('');
    expect(restored.levels[0].cells).toEqual({});
    expect(restored.levels[0].edges).toEqual({});
  });

  it('drops unrecognised fields rather than trusting them', () => {
    const restored = expectOk(
      parseDungeonFile(
        '{"id":"a","name":"x","malicious":true,"levels":[{"id":"l","name":"n","width":4,"height":4,"cells":{"1,1":{"floor":true,"evil":1}},"edges":{}}]}',
      ),
    );
    expect(restored).not.toHaveProperty('malicious');
    expect(restored.levels[0].cells['1,1']).toEqual({ floor: true });
  });

  it('ignores a prototype-polluting square key', () => {
    const result = parseDungeonFile(
      '{"id":"a","name":"x","levels":[{"id":"l","name":"n","width":4,"height":4,"cells":{"__proto__":{"floor":true}},"edges":{}}]}',
    );
    expect(result.ok).toBe(false);
    expect(({} as Record<string, unknown>).floor).toBeUndefined();
  });

  it('always stamps the current schema version on import', () => {
    const restored = expectOk(
      parseDungeonFile(
        '{"id":"a","name":"x","schemaVersion":0,"levels":[{"id":"l","name":"n","width":4,"height":4}]}',
      ),
    );
    expect(restored.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('file names', () => {
  it('slugifies the dungeon name', () => {
    expect(dungeonFileName({ ...createDungeon('Eye of the Beholder II') })).toBe(
      'eye-of-the-beholder-ii.dungeon.json',
    );
  });

  it('falls back when the name has nothing usable', () => {
    expect(dungeonFileName({ ...createDungeon('***') })).toBe(
      'untitled.dungeon.json',
    );
  });
});
