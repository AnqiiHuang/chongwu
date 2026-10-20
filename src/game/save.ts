import { appearanceOk, DEFAULT_APPEARANCE, partName } from '../content/appearance';
import { CUSTOMERS, PETS } from '../content/world';
import { SAVE_VERSION, type ActiveEvent, type AddressId, type Appearance, type CustomerState, type GameState, type PetState, type Phase, type ShopStyle } from './types';

const ACCEPTED_VERSIONS = new Set([1, 2]);
const STYLES: ShopStyle[] = ['japanese_wood', 'nordic_nature', 'vintage_academy', 'modern_minimal', 'soft_industrial', 'cute_pets'];
const ADDRESSES: AddressId[] = ['residential', 'old_town', 'university', 'clinic'];
const STYLE_FROM_OLD: Record<string, ShopStyle> = {
  wood: 'japanese_wood',
  nordic: 'nordic_nature',
  academy: 'vintage_academy',
  modern: 'modern_minimal',
  workshop: 'soft_industrial',
  cute: 'cute_pets',
};
const ADDRESS_FROM_OLD: Record<string, AddressId> = {
  community: 'residential',
  oldtown: 'old_town',
  campus: 'university',
  hospital: 'clinic',
};
const LOOK_FROM_PORTRAIT: Record<string, Appearance> = {
  p1: { hairId: 'hair.chestnut_bob', topId: 'top.ivory_blouse', apronId: 'apron.sage_paw', shoesId: 'shoes.brown_boots' },
  p2: { hairId: 'hair.black_bun', topId: 'top.peach_short', apronId: 'apron.oatmeal_pockets', shoesId: 'shoes.brown_straps' },
  p3: { hairId: 'hair.brown_waves', topId: 'top.blue_stripe', apronId: 'apron.blue_flower', shoesId: 'shoes.cream_sneakers' },
  p4: { hairId: 'hair.honey_shoulder', topId: 'top.mustard_cardigan', apronId: 'apron.peach_flower', shoesId: 'shoes.slate_canvas' },
};

const PHASES: Phase[] = ['onboarding', 'open', 'event', 'result', 'summary'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

function eventOk(value: unknown): value is ActiveEvent {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.choices) || value.choices.length !== 3) return false;
  return value.choices.every((choice) => isRecord(choice) && typeof choice.id === 'string' && typeof choice.label === 'string');
}

export function validateGameState(value: unknown): GameState | null {
  if (!isRecord(value)) return null;
  if (!ACCEPTED_VERSIONS.has(value.saveVersion as number)) return null;
  if (!isInt(value.revision) || value.revision < 0) return null;
  if (typeof value.phase !== 'string' || !PHASES.includes(value.phase as Phase)) return null;
  if (!isInt(value.actionIndex) || value.actionIndex < 0 || value.actionIndex > 5) return null;
  if (!isInt(value.rngState)) return null;
  if (!isRecord(value.settings)) return null;
  if (!Array.isArray(value.inventory) || !Array.isArray(value.history) || !Array.isArray(value.settledDayIds)) return null;
  if (value.inventory.some((batch) => !isRecord(batch) || !isInt(batch.quantity) || batch.quantity < 0)) return null;
  if (value.activeEvent !== null && !eventOk(value.activeEvent)) return null;
  if (isRecord(value.shop)) {
    if (!isInt(value.shop.cash) || value.shop.cash < 0) return null;
    if (!isInt(value.shop.level) || value.shop.level < 1) return null;
    if (!isInt(value.shop.materials) || value.shop.materials < 0) return null;
    for (const key of ['popularity', 'happiness', 'community'] as const) {
      const metric = value.shop[key];
      if (!isInt(metric) || metric < 0 || metric > 100) return null;
    }
    if (!isRecord(value.pets) || !value.pets.dahuang || !value.pets.naipao || !value.pets.doubao) return null;
  } else if (value.shop !== null) {
    return null;
  }
  return value as unknown as GameState;
}

function blankCustomer(id: string, current?: Partial<CustomerState>): CustomerState {
  return {
    id,
    visits: current?.visits ?? 0,
    affinity: current?.affinity ?? 0,
    lastPurchase: current?.lastPurchase ?? null,
    preferences: Array.isArray(current?.preferences) ? current.preferences.filter((item) => typeof item === 'string') : [],
    taboo: current?.taboo ?? null,
    goodStreak: current?.goodStreak ?? 0,
    met: current?.met ?? false,
  };
}

export function normalizeGameState(state: GameState): GameState {
  const customers: Record<string, CustomerState> = {};
  for (const id of Object.keys(CUSTOMERS)) {
    customers[id] = blankCustomer(id, state.customers?.[id]);
  }
  const storyFlags = { ...state.storyFlags };
  if (customers.he_fang?.met && !storyFlags.florist_met) storyFlags.florist_met = true;
  const budget = state.restock?.budget;
  const restock = {
    budget: typeof budget === 'number' && Number.isFinite(budget) ? Math.max(0, Math.min(400, Math.round(budget))) : 80,
    paused: Array.isArray(state.restock?.paused) ? state.restock.paused.filter((id) => typeof id === 'string') : [],
  };
  let migrationNote: string | null = null;
  const shop = state.shop ? { ...state.shop, stamps: state.shop.stamps ?? 0 } : null;
  if (shop) {
    const styleKey = String(shop.style);
    const style = STYLES.includes(shop.style) ? shop.style : STYLE_FROM_OLD[styleKey];
    if (style) shop.style = style;
    else {
      shop.style = 'japanese_wood';
      migrationNote = '原来的装修认不出来，已先用日系原木。进度、余额和故事都还在。';
    }
    const addressKey = String(shop.addressId);
    const address = ADDRESSES.includes(shop.addressId) ? shop.addressId : ADDRESS_FROM_OLD[addressKey];
    if (address) shop.addressId = address;
    else {
      shop.addressId = 'old_town';
      migrationNote = '原来的店址认不出来，已先记成老城区。进度没有被清空。';
    }
  }
  const player = state.player ? { ...state.player } : null;
  if (player) {
    const knownLook = appearanceOk(player.appearance);
    player.appearance = knownLook ? player.appearance : LOOK_FROM_PORTRAIT[player.portraitId] ?? { ...DEFAULT_APPEARANCE };
    if (!knownLook && !LOOK_FROM_PORTRAIT[player.portraitId]) {
      migrationNote = '原来的头像对不上新的换装，已先换成默认穿搭。名字和性格还在，可以免费再改。';
    }
    player.hair = partName(player.appearance.hairId);
    player.outfit = `${partName(player.appearance.topId)}，${partName(player.appearance.apronId)}，${partName(player.appearance.shoesId)}`;
  }
  const resident = new Set(['dahuang', 'naipao', 'doubao']);
  let pets = state.pets;
  if (state.shop) {
    const nextPets: Record<string, PetState> = {};
    for (const pet of PETS) {
      const current = state.pets?.[pet.id];
      const care = current?.care === 'watch' || current?.care === 'hospital' ? current.care : 'ok';
      nextPets[pet.id] = {
        id: pet.id,
        happiness: current?.happiness ?? 48,
        energy: current?.energy ?? 70,
        trust: current?.trust ?? 10,
        care,
        present: current?.present ?? resident.has(pet.id),
      };
    }
    pets = nextPets;
    if ((state.calendar && state.calendar.absoluteDay > 1) || state.scriptStep >= 2) storyFlags.dahuang_met = true;
  }
  return {
    ...state,
    saveVersion: SAVE_VERSION,
    customers,
    storyFlags,
    restock,
    shop,
    pets,
    player,
    settings: { ...state.settings, replayIntro: state.settings?.replayIntro ?? false },
    notice: state.notice ?? migrationNote,
    star2: state.star2 ?? false,
    star2DayId: state.star2DayId ?? null,
  };
}

export function serializeGame(state: GameState): string {
  return JSON.stringify(state);
}

export function parseGame(raw: string): GameState | null {
  try {
    const validated = validateGameState(JSON.parse(raw) as unknown);
    return validated ? normalizeGameState(validated) : null;
  } catch {
    return null;
  }
}
