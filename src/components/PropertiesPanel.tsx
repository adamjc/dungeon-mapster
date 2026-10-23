import { cellKey, edgeKey } from '../model/coords';
import {
  removeStamp,
  setEdges,
  setFloors,
  setFloorsAndClean,
  updateStamp,
} from '../model/operations';
import { facingsFor } from '../model/stampLayout';
import { resolveStamp, STAMP_COLOURS } from '../model/stamps';
import type { EdgeKind, Facing, Level, StampInstance } from '../model/types';
import { activeLevel } from '../state/editor';
import type { EditorAction, EditorState } from '../state/editor';
import { Icon } from './StampIcon';

const EDGE_KINDS: Array<{ id: EdgeKind; label: string }> = [
  { id: 'wall', label: 'Wall' },
  { id: 'door', label: 'Door' },
  { id: 'lockedDoor', label: 'Locked door' },
  { id: 'secretDoor', label: 'Secret door' },
];

const FACING_LABELS: Record<Facing, string> = {
  north: 'From the north',
  south: 'From the south',
  east: 'From the east',
  west: 'From the west',
};

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export function PropertiesPanel({ state, dispatch }: Props) {
  const level = activeLevel(state);
  const selection = state.selection;

  if (selection?.type === 'stamp') {
    const stamp = level.stamps[selection.stampId];
    // A selected stamp can disappear, for example when an undo removes it.
    if (stamp) {
      return (
        <StampProperties state={state} dispatch={dispatch} level={level} stamp={stamp} />
      );
    }
  }

  if (selection?.type === 'cell') {
    const key = cellKey(selection.cell.x, selection.cell.y);
    const mapped = key in level.cells;

    return (
      <aside className="panel" aria-label="Properties">
        <h2>Square</h2>
        <p className="coords">
          {selection.cell.x}, {selection.cell.y}
        </p>
        <p className="hint">{mapped ? 'Mapped floor' : 'Unmapped'}</p>
        <button
          type="button"
          className="panel-button"
          onClick={() =>
            dispatch({
              type: 'commitLevel',
              level: mapped
                ? setFloorsAndClean(level, [selection.cell], false)
                : setFloors(level, [selection.cell], true),
            })
          }
        >
          {mapped ? 'Clear floor' : 'Mark as floor'}
        </button>
      </aside>
    );
  }

  if (selection?.type === 'edge') {
    const kind = level.edges[edgeKey(selection.edge)]?.kind ?? null;

    return (
      <aside className="panel" aria-label="Properties">
        <h2>{selection.edge.o === 'H' ? 'Horizontal edge' : 'Vertical edge'}</h2>
        <p className="coords">
          {selection.edge.x}, {selection.edge.y}
        </p>

        <label className="field">
          <span>Type</span>
          <select
            value={kind ?? 'none'}
            onChange={(event) => {
              const value = event.target.value;
              dispatch({
                type: 'commitLevel',
                level: setEdges(
                  level,
                  [selection.edge],
                  value === 'none' ? null : (value as EdgeKind),
                ),
              });
            }}
          >
            <option value="none">Open (no wall)</option>
            {EDGE_KINDS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </aside>
    );
  }

  return <LevelProperties level={level} />;
}

function LevelProperties({ level }: { level: Level }) {
  const doorCount = Object.values(level.edges).filter(
    (edge) => edge.kind !== 'wall',
  ).length;

  return (
    <aside className="panel" aria-label="Properties">
      <h2>{level.name}</h2>
      <dl className="stats">
        <div>
          <dt>Size</dt>
          <dd>
            {level.width} × {level.height}
          </dd>
        </div>
        <div>
          <dt>Mapped squares</dt>
          <dd>{Object.keys(level.cells).length}</dd>
        </div>
        <div>
          <dt>Walls</dt>
          <dd>{Object.keys(level.edges).length - doorCount}</dd>
        </div>
        <div>
          <dt>Doorways</dt>
          <dd>{doorCount}</dd>
        </div>
        <div>
          <dt>Stamps</dt>
          <dd>{Object.keys(level.stamps).length}</dd>
        </div>
      </dl>
      <p className="hint">
        Choose the Select tool and click a square, wall, door or stamp to edit it.
      </p>
    </aside>
  );
}

function StampProperties({
  state,
  dispatch,
  level,
  stamp,
}: {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  level: Level;
  stamp: StampInstance;
}) {
  const definition = resolveStamp(state.dungeon, stamp.stampId);

  const change = (changes: Partial<Omit<StampInstance, 'id'>>) =>
    dispatch({ type: 'commitLevel', level: updateStamp(level, stamp.id, changes) });

  const otherLevels = state.dungeon.levels.filter(
    (candidate) => candidate.id !== level.id,
  );

  return (
    <aside className="panel" aria-label="Properties">
      <h2 className="panel-title">
        <Icon
          icon={definition.icon}
          colour={stamp.colour ?? definition.colour}
          size={20}
        />
        {definition.name}
      </h2>

      <p className="coords">
        {stamp.anchor.kind === 'cell'
          ? `Square ${stamp.anchor.x}, ${stamp.anchor.y}`
          : `Wall ${stamp.anchor.x}, ${stamp.anchor.y}`}
      </p>

      {stamp.anchor.kind === 'edge' && (
        <label className="field">
          <span>Seen from</span>
          <select
            value={stamp.anchor.facing}
            onChange={(event) => {
              const anchor = stamp.anchor;
              if (anchor.kind !== 'edge') return;
              change({ anchor: { ...anchor, facing: event.target.value as Facing } });
            }}
          >
            {facingsFor({
              x: stamp.anchor.x,
              y: stamp.anchor.y,
              o: stamp.anchor.o,
            }).map((facing) => (
              <option key={facing} value={facing}>
                {FACING_LABELS[facing]}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span>Label</span>
        <input
          type="text"
          value={stamp.label ?? ''}
          placeholder="Shown beside the symbol"
          onChange={(event) => change({ label: event.target.value })}
        />
      </label>

      <label className="field">
        <span>Note</span>
        <textarea
          rows={4}
          value={stamp.note ?? ''}
          placeholder="What did you find here?"
          onChange={(event) => change({ note: event.target.value })}
        />
      </label>

      {definition.linkable && otherLevels.length > 0 && (
        <label className="field">
          <span>Leads to</span>
          <select
            value={stamp.linkedLevelId ?? ''}
            onChange={(event) => change({ linkedLevelId: event.target.value })}
          >
            <option value="">Nowhere yet</option>
            {otherLevels.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {stamp.linkedLevelId && (
        <button
          type="button"
          className="panel-button"
          onClick={() => {
            const levelId = stamp.linkedLevelId;
            if (levelId) dispatch({ type: 'selectLevel', levelId });
          }}
        >
          Go to linked level
        </button>
      )}

      <div className="field">
        <span>Colour</span>
        <div className="swatches">
          <button
            type="button"
            className={`swatch swatch--auto${stamp.colour ? '' : ' swatch--active'}`}
            onClick={() => change({ colour: undefined })}
            title="Use the stamp's own colour"
          >
            Auto
          </button>
          {STAMP_COLOURS.map((colour) => (
            <button
              key={colour}
              type="button"
              className={`swatch${stamp.colour === colour ? ' swatch--active' : ''}`}
              style={{ background: colour }}
              onClick={() => change({ colour })}
              aria-label={`Colour ${colour}`}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        className="panel-button panel-button--danger"
        onClick={() => {
          dispatch({ type: 'commitLevel', level: removeStamp(level, stamp.id) });
          dispatch({ type: 'select', selection: null });
        }}
      >
        Delete stamp
      </button>
    </aside>
  );
}
