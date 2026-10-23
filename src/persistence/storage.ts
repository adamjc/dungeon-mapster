import type { Dungeon } from '../model/types';
import { parseDungeonValue } from './serialisation';

/**
 * Local persistence in IndexedDB.
 *
 * The store is keyed by dungeon id with a separate pointer to the current
 * dungeon, so adding a full dungeon library later does not require a schema
 * change or a migration.
 */

const DB_NAME = 'dungeon-mapper';
const DB_VERSION = 1;
const DUNGEON_STORE = 'dungeons';
const META_STORE = 'meta';
const CURRENT_KEY = 'currentDungeonId';

export class StorageUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Local storage is unavailable in this browser');
    this.name = 'StorageUnavailableError';
    this.cause = cause;
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageUnavailableError());
      return;
    }

    const open = indexedDB.open(DB_NAME, DB_VERSION);

    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(DUNGEON_STORE)) {
        db.createObjectStore(DUNGEON_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };

    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(new StorageUnavailableError(open.error));
    open.onblocked = () => reject(new StorageUnavailableError());
  }).catch((error: unknown) => {
    // Clear the cached promise so a later attempt can retry rather than
    // repeating a one-off failure forever.
    databasePromise = null;
    throw error;
  });

  return databasePromise;
}

export async function saveDungeon(dungeon: Dungeon): Promise<void> {
  const db = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([DUNGEON_STORE, META_STORE], 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    transaction.objectStore(DUNGEON_STORE).put(dungeon);
    transaction.objectStore(META_STORE).put(dungeon.id, CURRENT_KEY);
  });
}

export class CorruptStoredDungeonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorruptStoredDungeonError';
  }
}

export async function loadCurrentDungeon(): Promise<Dungeon | null> {
  const db = await openDatabase();
  const transaction = db.transaction([DUNGEON_STORE, META_STORE], 'readonly');

  const id = await request<string | undefined>(
    transaction.objectStore(META_STORE).get(CURRENT_KEY),
  );
  if (!id) return null;

  const stored = await request<unknown>(transaction.objectStore(DUNGEON_STORE).get(id));
  if (!stored) return null;

  // Stored maps may predate the current schema, so they are validated and
  // migrated on the way in rather than being trusted as-is.
  const result = parseDungeonValue(stored);
  if (!result.ok) throw new CorruptStoredDungeonError(result.error);

  return result.dungeon;
}
