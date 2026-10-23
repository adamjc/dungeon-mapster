import type { Cell } from '../model/types';
import { activeLevel } from '../state/editor';
import type { EditorAction, EditorState } from '../state/editor';

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  hoveredCell: Cell | null;
}

export function StatusBar({ state, dispatch, hoveredCell }: Props) {
  const level = activeLevel(state);

  const renameLevel = () => {
    const name = window.prompt('Level name', level.name);
    if (name && name.trim()) {
      dispatch({ type: 'renameLevel', levelId: level.id, name: name.trim() });
    }
  };

  const deleteLevel = () => {
    if (state.dungeon.levels.length <= 1) return;
    if (!window.confirm(`Delete "${level.name}"? This can be undone with Ctrl+Z.`)) {
      return;
    }
    dispatch({ type: 'deleteLevel', levelId: level.id });
  };

  return (
    <footer className="status-bar">
      <div className="status-bar__group">
        <label className="field field--inline">
          <span>Level</span>
          <select
            value={level.id}
            onChange={(event) =>
              dispatch({ type: 'selectLevel', levelId: event.target.value })
            }
          >
            {state.dungeon.levels.map((candidate, index) => (
              <option key={candidate.id} value={candidate.id}>
                {index + 1}: {candidate.name}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={() => dispatch({ type: 'addLevel' })}>
          Add level
        </button>
        <button type="button" onClick={renameLevel}>
          Rename
        </button>
        <button
          type="button"
          onClick={deleteLevel}
          disabled={state.dungeon.levels.length <= 1}
        >
          Delete
        </button>
      </div>

      <div className="status-bar__group status-bar__group--right">
        <span className="readout">
          {hoveredCell ? `${hoveredCell.x}, ${hoveredCell.y}` : '—'}
        </span>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'setView',
              view: { ...state.view, scale: Math.max(0.3, state.view.scale / 1.25) },
            })
          }
          title="Zoom out"
        >
          −
        </button>
        <span className="readout">{Math.round(state.view.scale * 100)}%</span>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'setView',
              view: { ...state.view, scale: Math.min(4, state.view.scale * 1.25) },
            })
          }
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({ type: 'setView', view: { tx: 48, ty: 48, scale: 1 } })
          }
          title="Reset the view"
        >
          Reset
        </button>
      </div>
    </footer>
  );
}
