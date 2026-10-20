import { ADDRESS_MAP, ITEM_MAP, ITEMS, LEVEL_NOTES } from '../content/world';
import type { DailyLedger, GameState, InventoryBatch, Shop } from './types';
import { dateLabel } from './time';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function emptyLedger(cashAtStart: number): DailyLedger {
  return {
    visitors: 0,
    orders: 0,
    revenue: 0,
    cogs: 0,
    purchases: 0,
    deposits: 0,
    miscCash: 0,
    wageAccrual: 0,
    rentAccrual: 0,
    utilities: 0,
    bonusCash: 0,
    goodService: false,
    settled: false,
    wagePaid: 0,
    rentPaid: 0,
    cashAtStart,
    notes: [],
    photoCaption: '',
  };
}

export function profitOf(ledger: DailyLedger): number {
  return ledger.revenue - ledger.cogs - ledger.wageAccrual - ledger.rentAccrual - ledger.utilities;
}

export function availableQty(inventory: InventoryBatch[], itemId: string, day: number): number {
  return inventory.reduce((sum, batch) => {
    if (batch.itemId !== itemId || batch.quantity <= 0) return sum;
    if (batch.expiresOn !== null && batch.expiresOn < day) return sum;
    return sum + batch.quantity;
  }, 0);
}

export function consumeItem(inventory: InventoryBatch[], itemId: string, qty: number, day: number): InventoryBatch[] | null {
  const fresh = inventory
    .map((batch, index) => ({ batch, index }))
    .filter(({ batch }) => batch.itemId === itemId && batch.quantity > 0 && (batch.expiresOn === null || batch.expiresOn >= day))
    .sort((a, b) => {
      const ae = a.batch.expiresOn ?? Number.POSITIVE_INFINITY;
      const be = b.batch.expiresOn ?? Number.POSITIVE_INFINITY;
      return ae - be;
    });
  if (fresh.reduce((sum, item) => sum + item.batch.quantity, 0) < qty) return null;
  const next = inventory.map((batch) => ({ ...batch }));
  let left = qty;
  for (const item of fresh) {
    if (left <= 0) break;
    const take = Math.min(left, next[item.index]!.quantity);
    next[item.index]!.quantity -= take;
    left -= take;
  }
  return next.filter((batch) => batch.quantity > 0);
}

export function addItem(inventory: InventoryBatch[], itemId: string, qty: number, expiresOn: number | null): InventoryBatch[] {
  if (qty <= 0) return inventory;
  return [...inventory, { itemId, quantity: qty, expiresOn }];
}

function expireInventory(state: GameState): GameState {
  const day = state.calendar?.absoluteDay ?? 0;
  const notes: string[] = [];
  const inventory = state.inventory.filter((batch) => {
    const expired = batch.expiresOn !== null && batch.expiresOn < day;
    if (expired && batch.quantity > 0) {
      const name = ITEM_MAP[batch.itemId]?.name ?? '食品';
      notes.push(`${name}过了保质期，已经取出，没有拿去卖。`);
    }
    return !expired && batch.quantity > 0;
  });
  if (!notes.length) return { ...state, inventory };
  return {
    ...state,
    inventory,
    todayNote: notes[0] ?? state.todayNote,
    dailyLedger: { ...state.dailyLedger, notes: [...state.dailyLedger.notes, ...notes] },
  };
}

export function applyMorning(state: GameState): GameState {
  if (!state.shop || !state.calendar) return state;
  if (state.restockedDayId === state.calendar.dayId) return state;
  let next = expireInventory(state);
  const day = next.calendar!.absoluteDay;
  const shop = { ...next.shop! };
  const ledger = { ...next.dailyLedger, notes: [...next.dailyLedger.notes] };
  let inventory = next.inventory.map((batch) => ({ ...batch }));
  const restock = state.restock ?? { budget: 80, paused: [] };
  let budgetLeft = restock.budget;
  const plan = ITEMS.filter((item) => item.restock).sort((a, b) => a.restock!.priority - b.restock!.priority);
  for (const item of plan) {
    const rule = item.restock!;
    if (restock.paused.includes(item.id)) continue;
    const have = availableQty(inventory, item.id, day);
    if (have >= rule.min) continue;
    const need = rule.target - have;
    const affordable = Math.min(Math.floor(shop.cash / item.price), Math.floor(budgetLeft / item.price));
    const buy = Math.min(need, affordable);
    if (buy <= 0) {
      if (rule.priority <= 2) ledger.notes.push(`${item.name}不够，今天的预算或店铺金补不上。照护会用备用口粮。`);
      continue;
    }
    const cost = buy * item.price;
    shop.cash -= cost;
    budgetLeft -= cost;
    ledger.purchases += cost;
    const expiresOn = item.perishableDays ? day + item.perishableDays : null;
    inventory = addItem(inventory, item.id, buy, expiresOn);
    ledger.notes.push(`开门时自动补了${item.name} ×${buy}。`);
  }
  for (const itemId of ['food_cat', 'food_dog'] as const) {
    const consumed = consumeItem(inventory, itemId, 1, day);
    if (consumed) {
      inventory = consumed;
    } else {
      const name = ITEMS.find((item) => item.id === itemId)?.name ?? '口粮';
      ledger.notes.push(`${name}不够，今天用了备用口粮。照护没有停。`);
    }
  }
  const pets = { ...next.pets };
  for (const id of Object.keys(pets)) {
    const pet = pets[id]!;
    pets[id] = { ...pet, energy: clamp(Math.min(90, pet.energy + 12), 0, 100) };
  }
  ledger.notes.unshift('员工已经完成喂食和清洁。');
  return {
    ...next,
    shop,
    inventory,
    pets,
    dailyLedger: ledger,
    restockedDayId: next.calendar!.dayId,
    employees: Object.fromEntries(
      Object.entries(next.employees).map(([id, employee]) => [id, { ...employee, trainedToday: false }]),
    ),
  };
}

export function grantXp(shop: Shop, amount: number): { shop: Shop; notes: string[] } {
  let xp = shop.xp + amount;
  let level = shop.level;
  const notes: string[] = [];
  while (level < 100) {
    const need = 60 + 20 * (level - 1);
    if (xp < need) break;
    xp -= need;
    level += 1;
    const note = LEVEL_NOTES[level];
    if (note) notes.push(`Lv.${level}：${note}`);
    else if (level > 10) notes.push(`Lv.${level}：经验已记下。这一级的新内容尚未开放。`);
  }
  return { shop: { ...shop, xp, level }, notes };
}

export function recomputeHappiness(pets: GameState['pets']): number {
  const present = Object.values(pets).filter((pet) => pet.present);
  if (!present.length) return 0;
  const average = present.reduce((sum, pet) => sum + pet.happiness, 0) / present.length;
  return clamp(average, 0, 100);
}

export function photoCaption(state: GameState): string {
  const weather = state.calendar?.weather;
  if (weather === 'rain') return '雨停在门外。毛巾架还在顺手的地方。';
  if (state.storyFlags.dahuang_sun_time) return '窗边的光停在大黄背上。';
  if (state.shop && state.shop.ownedDecor.includes('window_cushion')) return '奶泡的软垫上有一个刚刚压出来的坑。';
  return '门口的灯还是暖的。店里的三只都在自己的位置上。';
}

export function summaryFrom(state: GameState, ledger: DailyLedger, shop: Shop) {
  const calendar = state.calendar!;
  return {
    dayId: calendar.dayId,
    dateLabel: dateLabel(calendar),
    weather: calendar.weather,
    ledger,
    popularity: shop.popularity,
    happiness: shop.happiness,
    community: shop.community,
    level: shop.level,
    xp: shop.xp,
    cash: shop.cash,
    profit: profitOf(ledger),
    cashDelta: shop.cash - ledger.cashAtStart,
  };
}

export function rentOf(state: GameState): number {
  return state.shop ? ADDRESS_MAP[state.shop.addressId].rent : 100;
}

export function warmthScore(shop: Shop): number {
  return shop.popularity * 0.3 + shop.happiness * 0.4 + shop.community * 0.3;
}

export function star2Ready(state: GameState): boolean {
  if (!state.shop || !state.storyFlags.florist_stand) return false;
  return state.shop.happiness >= 70 && warmthScore(state.shop) >= 35;
}

export function monthTotals(history: GameState['history'], year: number, month: number) {
  const days = history.filter((item) => item.dayId.startsWith(`${year}-${month}-`));
  const sum = (pick: (item: (typeof days)[number]) => number) => days.reduce((total, item) => total + pick(item), 0);
  return {
    days: days.length,
    revenue: sum((item) => item.ledger.revenue),
    cogs: sum((item) => item.ledger.cogs),
    wages: sum((item) => item.ledger.wageAccrual),
    rent: sum((item) => item.ledger.rentAccrual),
    utilities: sum((item) => item.ledger.utilities),
    profit: sum((item) => item.profit),
    cash: sum((item) => item.cashDelta),
  };
}
