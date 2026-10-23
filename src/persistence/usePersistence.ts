import { useEffect, useRef, useState } from 'react';
import type { Dungeon } from '../model/types';
import { loadCurrentDungeon, saveDungeon } from './storage';

export type SaveState = 'loading' | 'idle' | 'saving' | 'saved' | 'error';

export interface SaveStatus {
  state: SaveState;
  message?: string;
}

const AUTOSAVE_DELAY_MS = 600;

interface Options {
  dungeon: Dungeon;
  onLoaded: (dungeon: Dungeon) => void;
}

/**
 * Autosaves the dungeon to local storage and restores it on startup.
 *
 * Saving is debounced so that a long drawing drag results in one write rather
 * than one per frame, and is suppressed until the initial load finishes so a
 * blank starting map cannot overwrite stored work.
 */
export function usePersistence({ dungeon, onLoaded }: Options) {
  const [status, setStatus] = useState<SaveStatus>({ state: 'loading' });

  const hydratedRef = useRef(false);
  const lastSavedRef = useRef<Dungeon | null>(null);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    let cancelled = false;

    loadCurrentDungeon()
      .then((stored) => {
        if (cancelled) return;
        if (stored) {
          lastSavedRef.current = stored;
          onLoadedRef.current(stored);
        }
        hydratedRef.current = true;
        setStatus({ state: stored ? 'saved' : 'idle' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Without storage the editor still works; only autosave is lost.
        hydratedRef.current = true;
        setStatus({
          state: 'error',
          message:
            error instanceof Error && error.name === 'StorageUnavailableError'
              ? 'Autosave is unavailable in this browser. Export to a file to keep your map.'
              : 'Could not read saved maps',
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (lastSavedRef.current === dungeon) return;

    setStatus({ state: 'saving' });
    const timer = window.setTimeout(() => {
      saveDungeon(dungeon)
        .then(() => {
          lastSavedRef.current = dungeon;
          setStatus({ state: 'saved' });
        })
        .catch(() => {
          setStatus({ state: 'error', message: 'Could not save. Export to a file.' });
        });
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [dungeon]);

  return { status };
}
