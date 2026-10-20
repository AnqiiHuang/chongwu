import { appearanceOk, DEFAULT_APPEARANCE } from '../content/appearance';
import { isHireId } from './roster';
import { charLength } from './initial';
import type { AddressId, CreateStep, OnboardingDraft, PersonalityId, ShopStyle } from './types';

export const DRAFT_KEY = 'chongwu.draft.v1';
export const SHELL_KEY = 'chongwu.shell.v1';

const STEPS: CreateStep[] = ['SHOP_NAME', 'INTERIOR', 'LOCATION', 'OWNER', 'STAFF'];
const STYLES: ShopStyle[] = ['japanese_wood', 'nordic_nature', 'vintage_academy', 'modern_minimal', 'soft_industrial', 'cute_pets'];
const ADDRESSES: AddressId[] = ['residential', 'old_town', 'university', 'clinic'];
const PERSONALITIES: PersonalityId[] = ['kind', 'careful', 'bright', 'calm'];

export function emptyDraft(): OnboardingDraft {
  return {
    schemaVersion: 1,
    step: 'SHOP_NAME',
    shopName: '',
    styleId: null,
    locationId: null,
    ownerName: '祁见禾',
    personalityId: 'kind',
    appearance: { ...DEFAULT_APPEARANCE },
    selectedEmployeeIds: [],
  };
}

export function shopNameError(name: string): string | null {
  const length = charLength(name);
  if (length < 2 || length > 12) return '店名去掉首尾空格后，需要 2 到 12 个字。';
  return null;
}

export function ownerNameError(name: string): string | null {
  const length = charLength(name);
  if (length < 2 || length > 8) return '店主名字用 2 到 8 个字。';
  return null;
}

export function hireError(ids: string[]): string | null {
  const unique = [...new Set(ids)];
  if (unique.length !== 2 || unique.some((id) => !isHireId(id))) return '请正好选择两位不同的店员。';
  return null;
}

function isStep(value: unknown): value is CreateStep {
  return typeof value === 'string' && STEPS.includes(value as CreateStep);
}

export function parseDraft(raw: string | null): OnboardingDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OnboardingDraft>;
    if (!value || value.schemaVersion !== 1 || !isStep(value.step)) return null;
    const draft = emptyDraft();
    draft.step = value.step;
    draft.shopName = typeof value.shopName === 'string' ? value.shopName : '';
    draft.styleId = STYLES.includes(value.styleId as ShopStyle) ? (value.styleId as ShopStyle) : null;
    draft.locationId = ADDRESSES.includes(value.locationId as AddressId) ? (value.locationId as AddressId) : null;
    draft.ownerName = typeof value.ownerName === 'string' && value.ownerName ? value.ownerName : draft.ownerName;
    draft.personalityId = PERSONALITIES.includes(value.personalityId as PersonalityId) ? (value.personalityId as PersonalityId) : 'kind';
    draft.appearance = appearanceOk(value.appearance) ? value.appearance : { ...DEFAULT_APPEARANCE };
    draft.selectedEmployeeIds = Array.isArray(value.selectedEmployeeIds)
      ? value.selectedEmployeeIds.filter((id): id is string => typeof id === 'string' && isHireId(id)).slice(0, 2)
      : [];
    return draft;
  } catch {
    return null;
  }
}

export function draftHasProgress(draft: OnboardingDraft | null): boolean {
  if (!draft) return false;
  return draft.step !== 'SHOP_NAME' || charLength(draft.shopName) > 0 || !!draft.styleId || !!draft.locationId || draft.selectedEmployeeIds.length > 0;
}

export interface ShellPref {
  introSeen: boolean;
  replay: boolean;
  reduceMotion: boolean;
}

export function readShell(storage: Pick<Storage, 'getItem'>): ShellPref {
  try {
    const parsed = JSON.parse(storage.getItem(SHELL_KEY) ?? '') as Partial<ShellPref>;
    return {
      introSeen: !!parsed.introSeen,
      replay: !!parsed.replay,
      reduceMotion: !!parsed.reduceMotion,
    };
  } catch {
    return { introSeen: false, replay: false, reduceMotion: false };
  }
}

export function writeShell(storage: Pick<Storage, 'setItem'>, pref: ShellPref): void {
  try {
    storage.setItem(SHELL_KEY, JSON.stringify(pref));
  } catch {
    // 壳层偏好写失败时，正式存档不受影响。
  }
}
