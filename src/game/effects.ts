import { ADDRESS_MAP, CUSTOMERS, DECOR_MAP, ITEM_MAP, PET_MAP } from '../content/world';
import type { ActionCategory, Effects, GameState, PersonalityId } from './types';
import { isWeekend } from './time';

export function emptyEffects(): Effects {
  return {
    revenue: 0,
    cashExpense: 0,
    stockCogs: 0,
    purchases: 0,
    deposits: 0,
    miscCash: 0,
    popularity: 0,
    community: 0,
    visitors: 0,
    orders: 0,
    goodService: false,
    bonusCash: 0,
    items: [],
    pets: [],
    customers: [],
    flags: [],
    clearFlags: [],
    decor: null,
    stamps: 0,
    practiceStaff: null,
    note: '',
  };
}

export function fx(partial: Partial<Effects>): Effects {
  return { ...emptyEffects(), ...partial };
}

export function cashDelta(effects: Effects): number {
  return effects.revenue - effects.cashExpense - effects.purchases + effects.deposits + effects.miscCash + effects.bonusCash;
}

export function quoteExpense(base: number, personality: PersonalityId | null): number {
  if (personality === 'careful' && base > 0) return Math.max(0, base - 1);
  return base;
}

export function quoteRevenue(base: number, state: GameState): number {
  const addressId = state.shop?.addressId;
  const mod = addressId ? ADDRESS_MAP[addressId].revenueMod : 1;
  return Math.round(base * mod);
}

export function finishEffects(base: Effects, state: GameState, category: ActionCategory): Effects {
  const effects: Effects = {
    ...base,
    items: base.items.map((item) => ({ ...item })),
    pets: base.pets.map((pet) => ({ ...pet })),
    customers: base.customers.map((customer) => ({ ...customer })),
    flags: [...base.flags],
    clearFlags: [...base.clearFlags],
  };
  const personality = state.player?.personalityId ?? null;
  if (personality === 'kind') {
    effects.customers = effects.customers.map((customer) =>
      customer.affinity > 0 ? { ...customer, affinity: customer.affinity + 1 } : customer,
    );
  }
  effects.cashExpense = quoteExpense(effects.cashExpense, personality);
  if (personality === 'bright' && category === 'customer') effects.popularity += 1;
  if (personality === 'calm' && category === 'care') effects.community += 1;
  const addressId = state.shop?.addressId;
  if (addressId === 'oldtown' && effects.community > 0) effects.community += 1;
  if (
    addressId === 'campus' &&
    category === 'customer' &&
    state.calendar &&
    isWeekend(state.calendar) &&
    effects.popularity > 0
  ) {
    effects.popularity += 1;
  }
  if (effects.revenue > 0) effects.revenue = quoteRevenue(effects.revenue, state);
  return effects;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function describeEffects(effects: Effects): string[] {
  const lines: string[] = [];
  if (effects.revenue) lines.push(`营业额 ${signed(effects.revenue)}`);
  if (effects.cashExpense) lines.push(`耗材 ${signed(-effects.cashExpense)}`);
  if (effects.purchases) lines.push(`采购 ${signed(-effects.purchases)}`);
  if (effects.deposits) lines.push(`订金 ${signed(effects.deposits)}，还不算完成的服务`);
  if (effects.miscCash) lines.push(`其他现金 ${signed(effects.miscCash)}`);
  if (effects.stockCogs) lines.push(`库存成本 ${signed(-effects.stockCogs)}`);
  if (effects.bonusCash) lines.push(`额外奖励 ${signed(effects.bonusCash)}，不算营业额`);
  if (effects.popularity) lines.push(`人气 ${signed(effects.popularity)}`);
  if (effects.community) lines.push(`羁绊 ${signed(effects.community)}`);
  if (effects.orders) lines.push(`订单 ${signed(effects.orders)}`);
  for (const pet of effects.pets) {
    const name = PET_MAP[pet.id]?.name ?? '宠物';
    if (pet.trust) lines.push(`${name}的信任 ${signed(pet.trust)}`);
    if (pet.happiness) lines.push(`${name}的幸福 ${signed(pet.happiness)}`);
    if (pet.energy) lines.push(`${name}的精力 ${signed(pet.energy)}`);
  }
  for (const customer of effects.customers) {
    const name = CUSTOMERS[customer.id]?.name ?? '客人';
    if (customer.affinity) lines.push(`${name}的好感 ${signed(customer.affinity)}`);
    if (customer.preference) lines.push(`记下：${customer.preference}`);
    if (customer.taboo) lines.push(`记下禁忌：${customer.taboo}`);
  }
  for (const item of effects.items) {
    const name = ITEM_MAP[item.itemId]?.name ?? '物品';
    lines.push(`${name} ${signed(item.delta)}`);
  }
  if (effects.decor) lines.push(`新装饰「${DECOR_MAP[effects.decor]?.name ?? '摆件'}」`);
  if (effects.stamps) lines.push(`温暖印章 ${signed(effects.stamps)}，不是店铺金`);
  if (effects.goodService) lines.push('记入今天的良好服务，关门时经验 +10，每天最多一次');
  return lines;
}
