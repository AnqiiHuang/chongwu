import { parseGame, serializeGame } from '../game/save';
import type { GameState } from '../game/types';

export const SAVE_KEY = 'chongwu.save.v1';
export const BACKUP_KEY = 'chongwu.save.backup';
export const AD_KEY = 'chongwu.ad.v1';

export interface Kv {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadResult {
  state: GameState;
  source: 'primary' | 'backup';
}

export function loadGame(storage: Kv): LoadResult | null {
  const primary = storage.getItem(SAVE_KEY);
  const parsed = primary ? parseGame(primary) : null;
  if (parsed) return { state: parsed, source: 'primary' };
  const backup = storage.getItem(BACKUP_KEY);
  const restored = backup ? parseGame(backup) : null;
  if (restored) return { state: restored, source: 'backup' };
  return null;
}

export function persistGame(storage: Kv, state: GameState): { ok: true } | { ok: false; error: string } {
  try {
    const current = storage.getItem(SAVE_KEY);
    if (current && parseGame(current)) storage.setItem(BACKUP_KEY, current);
    storage.setItem(SAVE_KEY, serializeGame(state));
    const written = storage.getItem(SAVE_KEY);
    if (!written || !parseGame(written)) return { ok: false, error: '存档写完后读不回来。当前进度还在这一页，请先导出。' };
    return { ok: true };
  } catch {
    return { ok: false, error: '这个浏览器写不进存档。进度还在这一页，请马上导出，别刷新。' };
  }
}

export function readBackup(storage: Kv): GameState | null {
  const raw = storage.getItem(BACKUP_KEY);
  return raw ? parseGame(raw) : null;
}
