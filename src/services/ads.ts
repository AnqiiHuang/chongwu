import type { AdPlacement, AdResult } from '../game/types';

export interface AdService {
  showRewarded(placement: AdPlacement, requestId: string): Promise<AdResult>;
  showInterstitial(placement: AdPlacement): Promise<'shown' | 'skipped'>;
}

export interface AdFrequency {
  localDate: string;
  rewardedCount: number;
  lastRewardedAt: number;
  foregroundMs: number;
  seenGameDayIds: string[];
}

export const interstitialEnabled = false;

export function emptyAdFrequency(now = Date.now()): AdFrequency {
  return { localDate: localDate(now), rewardedCount: 0, lastRewardedAt: 0, foregroundMs: 0, seenGameDayIds: [] };
}

export function localDate(now: number): string {
  const date = new Date(now);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function normalizeFrequency(freq: AdFrequency, now: number): AdFrequency {
  const today = localDate(now);
  if (freq.localDate === today) return freq;
  return { ...freq, localDate: today, rewardedCount: 0 };
}

export function rememberGameDay(freq: AdFrequency, gameDayId: string, now: number): AdFrequency {
  const next = normalizeFrequency(freq, now);
  if (next.seenGameDayIds.includes(gameDayId)) return next;
  return { ...next, seenGameDayIds: [...next.seenGameDayIds, gameDayId].slice(-40) };
}

/** 正式广告要同时越过前 3 个游戏日和 10 分钟前台时间。测试替身不走这条。 */
export function realAdsAllowed(freq: AdFrequency): boolean {
  return freq.seenGameDayIds.length > 3 && freq.foregroundMs >= 10 * 60 * 1000;
}

export function shouldShowRewardEntry(isDev: boolean, hasRealSdk: boolean): boolean {
  if (isDev) return true;
  return hasRealSdk;
}

export function canStartRewarded(freq: AdFrequency, now: number): { ok: true } | { ok: false; reason: string } {
  const current = normalizeFrequency(freq, now);
  if (current.rewardedCount >= 4) return { ok: false, reason: '今天的激励广告次数已经用完。不看也不影响营业。' };
  if (current.lastRewardedAt > 0 && now - current.lastRewardedAt < 3 * 60 * 1000) {
    return { ok: false, reason: '距离上次领到奖励还不到 3 分钟。可以先继续玩游戏。' };
  }
  return { ok: true };
}

export function noteRewarded(freq: AdFrequency, now: number): AdFrequency {
  const current = normalizeFrequency(freq, now);
  return { ...current, rewardedCount: current.rewardedCount + 1, lastRewardedAt: now };
}

export function createRequestId(): string {
  return `ad-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type Waiter = (result: AdResult) => void;

const waiters = new Map<string, Waiter>();
const listeners = new Set<(pending: { placement: AdPlacement; requestId: string } | null) => void>();

export function subscribeAdPrompt(listener: (pending: { placement: AdPlacement; requestId: string } | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resolveDevAd(requestId: string, result: AdResult): void {
  const waiter = waiters.get(requestId);
  waiters.delete(requestId);
  listeners.forEach((listener) => listener(null));
  waiter?.(result);
}

export const devAdService: AdService = {
  showRewarded(placement, requestId) {
    return new Promise((resolve) => {
      waiters.set(requestId, resolve);
      listeners.forEach((listener) => listener({ placement, requestId }));
    });
  },
  showInterstitial() {
    return Promise.resolve(interstitialEnabled ? 'shown' : 'skipped');
  },
};

export const hiddenAdService: AdService = {
  async showRewarded() {
    return 'unavailable';
  },
  async showInterstitial() {
    return 'skipped';
  },
};

export function adServiceFor(isDev: boolean): AdService {
  return isDev ? devAdService : hiddenAdService;
}
