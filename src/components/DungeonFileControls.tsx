import { useRef, useState } from 'react';
import type { Dungeon } from '../model/types';
import { downloadTextFile, readTextFile } from '../persistence/fileTransfer';
import {
  dungeonFileName,
  parseDungeonFile,
  serialiseDungeon,
} from '../persistence/serialisation';
import type { SaveStatus } from '../persistence/usePersistence';
import type { EditorAction } from '../state/editor';

const STATUS_TEXT: Record<SaveStatus['state'], string> = {
  loading: 'Loading…',
  idle: 'Not saved yet',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

interface Props {
  dungeon: Dungeon;
  status: SaveStatus;
  dispatch: React.Dispatch<EditorAction>;
}

export function DungeonFileControls({ dungeon, status, dispatch }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImport = async (file: File) => {
    setImportError(null);
    const result = parseDungeonFile(await readTextFile(file));

    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    const replacing = Object.keys(dungeon.levels[0].cells).length > 0;
    if (
      replacing &&
      !window.confirm(
        `Open "${result.dungeon.name}"? The map currently open will be replaced.`,
      )
    ) {
      return;
    }

    dispatch({ type: 'loadDungeon', dungeon: result.dungeon });
  };

  const handleNew = () => {
    if (window.confirm('Start a new dungeon? Export first if you want to keep this one.')) {
      dispatch({ type: 'newDungeon' });
    }
  };

  return (
    <div className="file-controls">
      <span
        className={`save-status save-status--${status.state}`}
        title={status.message ?? undefined}
        role="status"
      >
        {STATUS_TEXT[status.state]}
      </span>

      <button type="button" onClick={handleNew}>
        New
      </button>
      <button
        type="button"
        onClick={() =>
          downloadTextFile(serialiseDungeon(dungeon), dungeonFileName(dungeon))
        }
        title="Save this dungeon to a file"
      >
        Export
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Open a dungeon file"
      >
        Import
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so choosing the same file twice still fires a change event.
          event.target.value = '';
          if (file) void handleImport(file);
        }}
      />

      {(importError || status.message) && (
        <p className="file-message" role="alert">
          {importError ?? status.message}
          <button
            type="button"
            className="file-message__dismiss"
            onClick={() => setImportError(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </p>
      )}
    </div>
  );
}
