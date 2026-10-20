import { CUSTOMERS, PETS } from '../content/world';
import { SAVE_VERSION, type ActiveEvent, type CustomerState, type GameState, type PetState, type Phase } from './types';

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
  if (value.saveVersion !== SAVE_VERSION) return null;
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
  const shop = state.shop ? { ...state.shop, stamps: state.shop.stamps ?? 0 } : null;
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
  return { ...state, customers, storyFlags, restock, shop, pets, star2: state.star2 ?? false, star2DayId: state.star2DayId ?? null };
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
