import { describe, expect, it } from 'vitest';
import { eastEdge, northEdge } from '../model/coords';
import { createDungeon, createLevel } from '../model/dungeon';
import { addStamp, drawRoom, setEdges } from '../model/operations';
import { SCHEMA_VERSION } from '../model/types';
import type { Dungeon } from '../model/types';
import {
  dungeonFileName,
  parseDungeonFile,
  parseDungeonValue,
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

describe('stamps', () => {
  function stamped(): Dungeon {
    const dungeon = createDungeon('Stamped');
    let level = drawRoom(dungeon.levels[0], { x: 1, y: 1 }, { x: 5, y: 5 });
    level = addStamp(level, {
      id: 'st-1',
      stampId: 'keyhole',
      anchor: { kind: 'edge', x: 1, y: 2, o: 'V', facing: 'east' },
      label: 'Iron key',
      note: 'Needs the key from level 2',
      colour: '#5aa9e6',
    });
    level = addStamp(level, {
      id: 'st-2',
      stampId: 'stairsDown',
      anchor: { kind: 'cell', x: 3, y: 3 },
      linkedLevelId: 'other-level',
    });

    return {
      ...dungeon,
      levels: [level],
      customStamps: [
        {
          id: 'custom-1',
          name: 'Blue rune',
          category: 'custom',
          icon: 'rune',
          colour: '#5aa9e6',
          anchors: ['edge'],
          linkable: false,
          builtIn: false,
        },
      ],
    };
  }

  it('carries stamps and their details through a round trip', () => {
    const original = stamped();
    const restored = expectOk(parseDungeonFile(serialiseDungeon(original)));

    expect(restored.levels[0].stamps).toEqual(original.levels[0].stamps);
  });

  it('carries custom stamp definitions inside the file', () => {
    const restored = expectOk(parseDungeonFile(serialiseDungeon(stamped())));
    expect(restored.customStamps).toHaveLength(1);
    expect(restored.customStamps[0].name).toBe('Blue rune');
    expect(restored.customStamps[0].builtIn).toBe(false);
  });

  it('rejects a facing that its wall cannot have', () => {
    const file = stamped();
    const broken = {
      ...file,
      levels: [
        {
          ...file.levels[0],
          stamps: {
            bad: {
              id: 'bad',
              stampId: 'keyhole',
              // A horizontal wall cannot be seen from the east.
              anchor: { kind: 'edge', x: 1, y: 1, o: 'H', facing: 'east' },
            },
          },
        },
      ],
    };

    const result = parseDungeonFile(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/faces "east"/i);
  });

  it('rejects an unknown facing', () => {
    const result = parseDungeonFile(
      '{"id":"a","name":"x","levels":[{"id":"l","name":"n","width":4,"height":4,"stamps":{"s":{"stampId":"pit","anchor":{"kind":"edge","x":1,"y":1,"o":"H","facing":"up"}}}}]}',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid facing/i);
  });

  it('rejects a stamp that is neither in a square nor on a wall', () => {
    const result = parseDungeonFile(
      '{"id":"a","name":"x","levels":[{"id":"l","name":"n","width":4,"height":4,"stamps":{"s":{"stampId":"pit","anchor":{"kind":"ceiling","x":1,"y":1}}}}]}',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/square or on a wall/i);
  });

  it('rejects a custom stamp with no way to place it', () => {
    const result = parseDungeonFile(
      '{"id":"a","name":"x","customStamps":[{"id":"c","name":"n","category":"custom","icon":"rune","colour":"#fff","anchors":[]}],"levels":[{"id":"l","name":"n","width":4,"height":4}]}',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least one placement/i);
  });

  it('rejects duplicate custom stamp ids', () => {
    const one =
      '{"id":"c","name":"n","category":"custom","icon":"rune","colour":"#fff","anchors":["cell"]}';
    const result = parseDungeonFile(
      `{"id":"a","name":"x","customStamps":[${one},${one}],"levels":[{"id":"l","name":"n","width":4,"height":4}]}`,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/same id/i);
  });

  it('never trusts an imported stamp to be a built-in one', () => {
    const restored = expectOk(
      parseDungeonFile(
        '{"id":"a","name":"x","customStamps":[{"id":"c","name":"n","category":"custom","icon":"rune","colour":"#fff","anchors":["cell"],"builtIn":true}],"levels":[{"id":"l","name":"n","width":4,"height":4}]}',
      ),
    );
    expect(restored.customStamps[0].builtIn).toBe(false);
  });

  it('opens a version 1 file that predates stamps', () => {
    const legacy = {
      format: 'dungeon-mapper',
      schemaVersion: 1,
      dungeon: {
        id: 'old',
        name: 'Old Map',
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        levels: [
          {
            id: 'l1',
            name: 'Level 1',
            width: 32,
            height: 32,
            cells: { '1,1': { floor: true } },
            edges: { '1,1,H': { kind: 'wall' } },
          },
        ],
      },
    };

    const restored = expectOk(parseDungeonFile(JSON.stringify(legacy)));
    expect(restored.schemaVersion).toBe(SCHEMA_VERSION);
    expect(restored.levels[0].stamps).toEqual({});
    expect(restored.customStamps).toEqual([]);
    expect(restored.levels[0].cells['1,1']).toEqual({ floor: true });
  });
});

describe('reading stored maps', () => {
  it('migrates a map saved before stamps existed', () => {
    // Exactly what the previous release wrote to local storage: no `stamps` on
    // the level and no `customStamps` on the dungeon.
    const stored = {
      id: 'old',
      schemaVersion: 1,
      name: 'Saved Before Stamps',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      levels: [
        {
          id: 'l1',
          name: 'Level 1',
          width: 48,
          height: 48,
          cells: { '2,2': { floor: true } },
          edges: { '2,2,V': { kind: 'door' } },
        },
      ],
    };

    const result = parseDungeonValue(stored);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.dungeon.levels[0].stamps).toEqual({});
    expect(result.dungeon.customStamps).toEqual([]);
    expect(result.dungeon.levels[0].edges['2,2,V']).toEqual({ kind: 'door' });
    expect(result.dungeon.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('reports a stored map it cannot make sense of', () => {
    const result = parseDungeonValue({ id: 'x', name: 'y', levels: 'not a list' });
    expect(result.ok).toBe(false);
  });

  it('round-trips a current map through storage unchanged', () => {
    const dungeon = createDungeon('Round Trip');
    const result = parseDungeonValue(JSON.parse(JSON.stringify(dungeon)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dungeon.levels[0].stamps).toEqual({});
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
