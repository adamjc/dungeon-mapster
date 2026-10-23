import { useCallback, useEffect, useReducer, useState } from 'react';
import { DungeonFileControls } from './components/DungeonFileControls';
import { MapCanvas } from './components/MapCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { StatusBar } from './components/StatusBar';
import { StampPalette } from './components/StampPalette';
import { TOOL_SHORTCUTS, Toolbar } from './components/Toolbar';
import type { Cell, Dungeon } from './model/types';
import { usePersistence } from './persistence/usePersistence';
import { createInitialState, editorReducer } from './state/editor';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export function App() {
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialState);
  const [hoveredCell, setHoveredCell] = useState<Cell | null>(null);

  const handleLoaded = useCallback((dungeon: Dungeon) => {
    dispatch({ type: 'loadDungeon', dungeon });
  }, []);

  const { status } = usePersistence({ dungeon: state.dungeon, onLoaded: handleLoaded });

  const handleHoverChange = useCallback((cell: Cell | null) => {
    setHoveredCell((current) => {
      if (current === cell) return current;
      if (current && cell && current.x === cell.x && current.y === cell.y) {
        return current;
      }
      return cell;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault();
        dispatch({ type: 'redo' });
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === 'Escape') {
        dispatch({ type: 'select', selection: null });
        return;
      }

      const tool = TOOL_SHORTCUTS[key];
      if (tool) {
        event.preventDefault();
        dispatch({ type: 'setTool', tool });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app">
      <header className="top-bar">
        <input
          className="dungeon-name"
          value={state.dungeon.name}
          onChange={(event) =>
            dispatch({ type: 'renameDungeon', name: event.target.value })
          }
          aria-label="Dungeon name"
        />
        <div className="top-bar__actions">
          <button
            type="button"
            onClick={() => dispatch({ type: 'undo' })}
            disabled={state.past.length === 0}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'redo' })}
            disabled={state.future.length === 0}
            title="Redo (Ctrl+Shift+Z)"
          >
            Redo
          </button>
          <DungeonFileControls
            dungeon={state.dungeon}
            status={status}
            dispatch={dispatch}
          />
        </div>
      </header>

      <div className="workspace">
        <Toolbar
          tool={state.tool}
          onSelect={(tool) => dispatch({ type: 'setTool', tool })}
        />
        {state.tool === 'stamp' && <StampPalette state={state} dispatch={dispatch} />}
        <MapCanvas state={state} dispatch={dispatch} onHoverChange={handleHoverChange} />
        <PropertiesPanel state={state} dispatch={dispatch} />
      </div>

      <StatusBar state={state} dispatch={dispatch} hoveredCell={hoveredCell} />
    </div>
  );
}
