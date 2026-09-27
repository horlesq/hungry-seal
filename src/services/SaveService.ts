// localStorage-backed save. Storage can be missing or throw (private mode, blocked
// cookies), so every access is guarded and the game keeps working with in-memory data.
import type { SkinId } from '../config/skins';
import type { UpgradeId } from '../config/upgrades';
import {
  defaultSave,
  equipSkin,
  migrateSave,
  purchase,
  purchaseSkin,
  recordRun,
  type RunRecord,
  type SaveData,
} from './saveData';

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

  /** Buys the next level of an upgrade. Returns false if maxed or unaffordable. */
  buyUpgrade(id: UpgradeId): boolean {
    const next = purchase(this.current, id);
    if (!next) return false;
    this.current = next;
    this.persist();
    return true;
  }

  /** Buys (and wears) a skin. Returns false if owned already or unaffordable. */
  buySkin(id: SkinId): boolean {
    return this.apply(purchaseSkin(this.current, id));
  }

  /** Wears an owned skin. Returns false if it isn't owned. */
  equipSkin(id: SkinId): boolean {
    return this.apply(equipSkin(this.current, id));
  }

  setMuted(muted: boolean): void {
    this.current = { ...this.current, settings: { ...this.current.settings, muted } };
    this.persist();
  }

  completeTutorial(): void {
    if (this.current.tutorialDone) return;
    this.current = { ...this.current, tutorialDone: true };
    this.persist();
  }

  private apply(next: SaveData | null): boolean {
    if (!next) return false;
    this.current = next;
    this.persist();
    return true;
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
