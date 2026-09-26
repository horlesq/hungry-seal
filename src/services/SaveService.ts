// localStorage-backed save. Storage can be missing or throw (private mode, blocked
// cookies), so every access is guarded and the game keeps working with in-memory data.
import { defaultSave, migrateSave, recordRun, type RunRecord, type SaveData } from './saveData';

const STORAGE_KEY = 'hungry-seal-save';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export class SaveService {
  private current: SaveData;

  constructor(private readonly storage: KeyValueStorage | null = browserStorage()) {
    this.current = this.load();
  }

  get data(): Readonly<SaveData> {
    return this.current;
  }

  /** Banks a finished run and persists it. */
  recordRun(run: RunRecord): { data: SaveData; newBest: boolean } {
    const result = recordRun(this.current, run);
    this.current = result.data;
    this.persist();
    return result;
  }

  private load(): SaveData {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      return raw ? migrateSave(JSON.parse(raw)) : defaultSave();
    } catch {
      return defaultSave();
    }
  }

  private persist(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.current));
    } catch {
      // Quota or privacy mode: keep playing with in-memory data.
    }
  }
}

export const saves = new SaveService();
