import { cellKey, edgeKey } from '../model/coords';
import { setEdges, setFloors } from '../model/operations';
import type { EdgeKind } from '../model/types';
import { activeLevel } from '../state/editor';
import type { EditorAction, EditorState } from '../state/editor';

const EDGE_KINDS: Array<{ id: EdgeKind; label: string }> = [
  { id: 'wall', label: 'Wall' },
  { id: 'door', label: 'Door' },
  { id: 'lockedDoor', label: 'Locked door' },
  { id: 'secretDoor', label: 'Secret door' },
];

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export function PropertiesPanel({ state, dispatch }: Props) {
  const level = activeLevel(state);
  const selection = state.selection;

  if (!selection) {
    const floorCount = Object.keys(level.cells).length;
    const doorCount = Object.values(level.edges).filter((edge) =>
      edge.kind !== 'wall',
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
            <dd>{floorCount}</dd>
          </div>
          <div>
            <dt>Walls</dt>
            <dd>{Object.keys(level.edges).length - doorCount}</dd>
          </div>
          <div>
            <dt>Doorways</dt>
            <dd>{doorCount}</dd>
          </div>
        </dl>
        <p className="hint">
          Choose the Select tool and click a square, wall or door to edit it.
        </p>
      </aside>
    );
  }

  if (selection.type === 'cell') {
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
              level: setFloors(level, [selection.cell], !mapped),
            })
          }
        >
          {mapped ? 'Clear floor' : 'Mark as floor'}
        </button>
      </aside>
    );
  }

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
