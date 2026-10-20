import { appearanceOk, partName } from '../content/appearance';
import { DAY1_SCRIPT, refreshOffers } from '../content/events';
import { INTERIOR_MAP } from '../content/interiors';
import { ADDRESS_MAP, DECOR_MAP, ITEM_MAP, PERSONALITIES, TRAIN_COSTS } from '../content/world';
import { hireError, ownerNameError, shopNameError } from './draft';
import { cashDelta } from './effects';
import {
  addItem,
  applyMorning,
  availableQty,
  clamp,
  consumeItem,
  emptyLedger,
  grantXp,
  photoCaption,
  profitOf,
  recomputeHappiness,
  rentOf,
  star2Ready,
  summaryFrom,
} from './economy';
import { createNewGame, diaryLine, initialCustomers, initialEmployees, initialInventory, initialPets } from './initial';
import { dailyWage, morningCrew } from './roster';
import { rollInt } from './rng';
import { isOpeningDay, makeCalendar, nextDate, onDuty, timeLabel } from './time';
import { SAVE_VERSION, type Action, type Effects, type GameState, type OnboardingDraft, type Shop, type Weather } from './types';

function bump(state: GameState, patch: Partial<GameState>): GameState {
  return { ...state, ...patch, revision: state.revision + 1 };
}

function pushLog(list: string[], line: string): string[] {
  return [line, ...list].slice(0, 6);
}

function rollWeather(rngState: number): { weather: Weather; rngState: number } {
  const rolled = rollInt(rngState, 10);
  const weather = rolled.index < 5 ? 'sunny' : rolled.index < 8 ? 'cloudy' : 'rain';
  return { weather, rngState: rolled.next };
}

function grantDecor(shop: Shop, decorId: string): Shop {
  if (!decorId || shop.ownedDecor.includes(decorId) || !DECOR_MAP[decorId]) return shop;
  const decor = DECOR_MAP[decorId];
  return {
    ...shop,
    ownedDecor: [...shop.ownedDecor, decorId],
    equipped: decor && !shop.equipped[decor.slot] ? { ...shop.equipped, [decor.slot]: decorId } : shop.equipped,
  };
}

function applyEffects(state: GameState, effects: Effects): { ok: true; state: GameState } | { ok: false } {
  if (!state.shop || !state.calendar) return { ok: false };
  const delta = cashDelta(effects);
  if (state.shop.cash + delta < 0) return { ok: false };
  const day = state.calendar.absoluteDay;
  let inventory = state.inventory.map((batch) => ({ ...batch }));
  for (const item of effects.items) {
    if (item.delta < 0) {
      if (availableQty(inventory, item.itemId, day) < -item.delta) return { ok: false };
      const consumed = consumeItem(inventory, item.itemId, -item.delta, day);
      if (!consumed) return { ok: false };
      inventory = consumed;
    } else {
      inventory = addItem(inventory, item.itemId, item.delta, null);
    }
  }
  const pets = { ...state.pets };
  for (const change of effects.pets) {
    const pet = pets[change.id];
    if (!pet) continue;
    pets[change.id] = {
      ...pet,
      trust: clamp(pet.trust + change.trust, 0, 100),
      happiness: clamp(pet.happiness + change.happiness, 0, 100),
      energy: clamp(pet.energy + change.energy, 0, 100),
    };
  }
  const customers = { ...state.customers };
  for (const change of effects.customers) {
    const current = customers[change.id] ?? {
      id: change.id,
      visits: 0,
      affinity: 0,
      lastPurchase: null,
      preferences: [],
      taboo: null,
      goodStreak: 0,
      met: false,
    };
    const preferences =
      change.preference && !current.preferences.includes(change.preference)
        ? [...current.preferences, change.preference]
        : current.preferences;
    const goodStreak = change.visits > 0 ? (effects.goodService ? (current.goodStreak ?? 0) + 1 : 0) : (current.goodStreak ?? 0);
    customers[change.id] = {
      ...current,
      met: current.met || change.meet,
      visits: current.visits + change.visits,
      affinity: clamp(current.affinity + change.affinity, 0, 100),
      lastPurchase: change.lastPurchase ?? current.lastPurchase,
      preferences,
      taboo: change.taboo ?? current.taboo ?? null,
      goodStreak,
    };
  }
  const storyFlags = { ...state.storyFlags };
  for (const flag of effects.flags) storyFlags[flag] = true;
  for (const flag of effects.clearFlags) delete storyFlags[flag];
  let shop: Shop = {
    ...state.shop,
    cash: state.shop.cash + delta,
    popularity: clamp(state.shop.popularity + effects.popularity, 0, 100),
    community: clamp(state.shop.community + effects.community, 0, 100),
    stamps: (state.shop.stamps ?? 0) + (effects.stamps ?? 0),
  };
  const employees = { ...state.employees };
  if (effects.practiceStaff && employees[effects.practiceStaff]) {
    const current = employees[effects.practiceStaff]!;
    const practice = (current.practice ?? 0) + 1;
    let skill = current.skill ?? 0;
    if (practice >= 4) skill = Math.max(skill, 1);
    if (practice >= 8) skill = Math.max(skill, 2);
    if (practice >= 12) skill = Math.max(skill, 3);
    employees[effects.practiceStaff] = { ...current, practice, skill };
  }
  for (const [flag, id] of [['wuyun_arrived', 'wuyun'], ['zhima_arrived', 'zhima'], ['nuomi_arrived', 'nuomi']] as const) {
    if (storyFlags[flag] && pets[id]) pets[id] = { ...pets[id]!, present: true };
  }
  if (storyFlags.wuyun_adopted && pets.wuyun) pets.wuyun = { ...pets.wuyun, present: false };
  shop = { ...shop, happiness: recomputeHappiness(pets) };
  const extraNotes: string[] = [];
  if (effects.decor) shop = grantDecor(shop, effects.decor);
  for (const customer of Object.values(customers)) {
    if (customer.goodStreak === 3 && !shop.ownedDecor.includes('thank_card')) {
      shop = grantDecor(shop, 'thank_card');
      extraNotes.push('连续三次良好接待，得到一张感谢小卡片。');
    }
    if (customer.goodStreak === 5 && !storyFlags.memory_photo) {
      shop = { ...shop, stamps: shop.stamps + 1 };
      storyFlags.memory_photo = true;
      extraNotes.push('连续五次良好接待，手账里多了一枚温暖印章。');
    }
  }
  const ledger = {
    ...state.dailyLedger,
    revenue: state.dailyLedger.revenue + effects.revenue,
    cogs: state.dailyLedger.cogs + effects.cashExpense + effects.stockCogs,
    purchases: state.dailyLedger.purchases + effects.purchases,
    deposits: state.dailyLedger.deposits + effects.deposits,
    miscCash: state.dailyLedger.miscCash + effects.miscCash,
    visitors: state.dailyLedger.visitors + effects.visitors,
    orders: state.dailyLedger.orders + effects.orders,
    bonusCash: state.dailyLedger.bonusCash + effects.bonusCash,
    goodService: state.dailyLedger.goodService || effects.goodService,
    notes: [...state.dailyLedger.notes, ...(effects.note ? [effects.note] : []), ...extraNotes],
  };
  const metricLog = {
    popularity: effects.popularity ? pushLog(state.metricLog.popularity, effects.note || '接待让店里多被人知道了一点。') : state.metricLog.popularity,
    happiness: effects.pets.some((pet) => pet.happiness) ? pushLog(state.metricLog.happiness, effects.note || '有宠物的状态变好了。') : state.metricLog.happiness,
    community: effects.community ? pushLog(state.metricLog.community, effects.note || '和街坊的关系近了一点。') : state.metricLog.community,
  };
  return {
    ok: true,
    state: {
      ...state,
      shop,
      pets,
      customers,
      employees,
      inventory,
      storyFlags,
      dailyLedger: ledger,
      metricLog,
      todayNote: effects.note || state.todayNote,
    },
  };
}

function settle(state: GameState): GameState {
  if (!state.shop || !state.calendar) return state;
  if (state.dailyLedger.settled || state.settledDayIds.includes(state.calendar.dayId)) return state;
  let shop: Shop = { ...state.shop };
  const utilitiesPlanned = 60;
  const utilPaid = Math.min(shop.cash, utilitiesPlanned);
  shop.cash -= utilPaid;
  const wage = dailyWage(state.employees);
  const rent = rentOf(state);
  shop.wagePayable += wage;
  shop.rentPayable += rent;
  let wagePaid = 0;
  let rentPaid = 0;
  if (state.calendar.day === 15) {
    wagePaid = Math.min(shop.cash, shop.wagePayable);
    shop.cash -= wagePaid;
    shop.wagePayable -= wagePaid;
  }
  if (state.calendar.day === 30) {
    rentPaid = Math.min(shop.cash, shop.rentPayable);
    shop.cash -= rentPaid;
    shop.rentPayable -= rentPaid;
  }
  let levelNote = state.levelNote;
  if (state.dailyLedger.goodService) {
    const granted = grantXp(shop, 10);
    shop = granted.shop;
    if (granted.notes.length) levelNote = granted.notes.join(' ');
  }
  const ledger = {
    ...state.dailyLedger,
    wageAccrual: wage,
    rentAccrual: rent,
    utilities: utilPaid,
    settled: true,
    wagePaid,
    rentPaid,
    photoCaption: photoCaption(state),
    notes:
      utilPaid < utilitiesPlanned
        ? [...state.dailyLedger.notes, '店铺金不够付清水电，已付能付的部分。照护没有因此停下。']
        : state.dailyLedger.notes,
  };
  const summary = summaryFrom({ ...state, shop }, ledger, shop);
  const earnedStar2 = star2Ready({ ...state, shop });
  return bump(state, {
    shop,
    dailyLedger: ledger,
    settledDayIds: [...state.settledDayIds, state.calendar.dayId],
    history: [...state.history, summary],
    phase: 'summary',
    levelNote,
    star1: state.star1 || isOpeningDay(state.calendar),
    star2: state.star2 || earnedStar2,
    star2DayId: state.star2 ? state.star2DayId : earnedStar2 ? state.calendar.dayId : state.star2DayId,
    notice:
      state.calendar.day === 30
        ? '这个月的账可以在手账里看。利润和现金是分开的。明天还可以继续开门。'
        : null,
  });
}

function openDay(state: GameState, calendar: NonNullable<GameState['calendar']>, rngState: number): GameState {
  let next: GameState = {
    ...state,
    rngState,
    calendar,
    phase: 'open',
    actionIndex: 0,
    activeEvent: null,
    prepared: {},
    checkedInPets: [],
    pendingAd: null,
    notice: null,
    levelNote: null,
    restockedDayId: null,
    dailyLedger: emptyLedger(state.shop?.cash ?? 0),
  };
  next = applyMorning(next);
  next = refreshOffers(next);
  const hint = isOpeningDay(calendar) ? DAY1_SCRIPT[next.scriptStep]?.hint : null;
  const weatherNote =
    calendar.weather === 'rain' ? '今天有小雨。进门的爪子可能会带水，毛巾在架子上。' : `${morningCrew(state)}`;
  const storyBits = [
    next.storyFlags.florist_met && !next.storyFlags.florist_stand ? '花店和布丁' : '',
    next.storyFlags.dahuang_met && !next.storyFlags.sun_plate ? '大黄的窗边' : '',
    next.storyFlags.florist_stand && !next.storyFlags.cloud_photo ? '乌云的新家' : '',
  ].filter(Boolean);
  const storyNote = !hint && storyBits.length ? `${storyBits.join('、')}还没写完，对应的入口一天会接到一段。` : '';
  next = { ...next, todayNote: hint ? `${hint}${weatherNote}` : `${weatherNote}${storyNote}` };
  return bump(next, {});
}

function beginShop(state: GameState, draft: OnboardingDraft): GameState {
  if (state.shop) return state;
  const shopName = draft.shopName.trim();
  const ownerName = draft.ownerName.trim();
  const nameProblem = shopNameError(shopName);
  const ownerProblem = ownerNameError(ownerName);
  const staffProblem = hireError(draft.selectedEmployeeIds);
  if (nameProblem || ownerProblem || staffProblem || !draft.styleId || !INTERIOR_MAP[draft.styleId] || !draft.locationId || !ADDRESS_MAP[draft.locationId]) {
    return bump(state, { notice: nameProblem ?? ownerProblem ?? staffProblem ?? '装修和店址都要选定，才会开门。' });
  }
  if (!draft.personalityId || !PERSONALITIES.some((item) => item.id === draft.personalityId) || !appearanceOk(draft.appearance)) {
    return bump(state, { notice: '店主的性格和穿搭还没定好。' });
  }
  const weather = rollWeather(state.rngState);
  const calendar = makeCalendar(1, 3, 1, weather.weather);
  const pets = initialPets();
  const employees = initialEmployees(draft.selectedEmployeeIds);
  const shop: Shop = {
    name: shopName,
    style: draft.styleId,
    addressId: draft.locationId,
    cash: 20000,
    materials: 0,
    popularity: 18,
    happiness: recomputeHappiness(pets),
    community: 12,
    level: 1,
    xp: 0,
    equipped: { window: null, door: null, carpet: null, shelf: null, wall: 'price_board' },
    ownedDecor: ['price_board'],
    warmLight: false,
    wagePayable: 0,
    rentPayable: 0,
    stamps: 0,
  };
  const started: GameState = {
    ...state,
    rngState: weather.rngState,
    onboardingStep: 'staff',
    draft: { shopName, style: draft.styleId, addressId: draft.locationId },
    player: {
      name: ownerName,
      age: 22,
      gender: 'female',
      heightCm: state.player?.heightCm ?? 165,
      portraitId: 'custom',
      personalityId: draft.personalityId,
      hair: partName(draft.appearance.hairId),
      outfit: `${partName(draft.appearance.topId)}，${partName(draft.appearance.apronId)}，${partName(draft.appearance.shoesId)}`,
      appearance: draft.appearance,
    },
    shop,
    pets,
    customers: initialCustomers(),
    employees,
    inventory: initialInventory(calendar.absoluteDay),
    metricLog: {
      popularity: ['新店开张，街坊还在观望。'],
      happiness: ['在店的人会做基础喂食，陪伴要你自己选。'],
      community: ['你和这条街还不熟。'],
    },
  };
  return openDay(started, calendar, weather.rngState);
}

function choose(state: GameState, choiceId: string): GameState {
  if (state.phase !== 'event' || !state.activeEvent || state.activeEvent.submitted || state.actionIndex >= 5) return state;
  const choice = state.activeEvent.choices.find((item) => item.id === choiceId);
  if (!choice || choice.disabledReason) return state;
  const applied = applyEffects(state, choice.effects);
  if (!applied.ok || !applied.state.shop) {
    return bump(state, { notice: '店铺金或库存不够，这次没有扣行动，也没有扣款。' });
  }
  const xp = grantXp(applied.state.shop, 6);
  const category = state.activeEvent.category;
  const prepared = { ...state.prepared };
  delete prepared[category];
  return bump(applied.state, {
    shop: xp.shop,
    phase: 'result',
    actionIndex: state.actionIndex + 1,
    scriptStep: isOpeningDay(state.calendar) ? state.scriptStep + 1 : state.scriptStep,
    prepared,
    levelNote: xp.notes[0] ?? state.levelNote,
    notice: null,
    activeEvent: {
      ...state.activeEvent,
      submitted: true,
      timeLabel: timeLabel(state.actionIndex),
      result: { choiceId, text: choice.resultText, changes: choice.changes },
    },
  });
}

function resolveAd(state: GameState, result: Extract<Action, { type: 'RESOLVE_AD' }>['result']): GameState {
  if (!state.pendingAd || !state.shop) return state;
  const pending = state.pendingAd;
  if (state.rewardClaims[pending.requestId]) {
    return bump(state, { pendingAd: null, notice: '这次测试已经处理过，不会再发一次。' });
  }
  const baseClaim = {
    requestId: pending.requestId,
    placement: pending.placement,
    granted: false,
    gameDayId: pending.gameDayId,
  };
  if (result !== 'rewarded') {
    const notice =
      result === 'closed'
        ? '提前关闭了。没有发放奖励，也没有扣店铺金或行动。'
        : result === 'unavailable'
          ? '没有可展示的广告。关门和开门都不会被卡住。'
          : '广告测试失败了。没有发放奖励，游戏照常继续。';
    return bump(state, {
      pendingAd: null,
      rewardClaims: { ...state.rewardClaims, [pending.requestId]: baseClaim },
      notice,
    });
  }
  if (state.adGrantedDays[pending.gameDayId]?.[pending.placement]) {
    return bump(state, {
      pendingAd: null,
      rewardClaims: { ...state.rewardClaims, [pending.requestId]: baseClaim },
      notice: '今天的这一项已经领过，不会重复发放。',
    });
  }
  let shop: Shop = { ...state.shop };
  let ledger = { ...state.dailyLedger };
  if (pending.placement === 'day_end_bonus') {
    shop = { ...shop, cash: shop.cash + 80 };
    ledger = { ...ledger, bonusCash: ledger.bonusCash + 80 };
  } else if (pending.placement === 'decor_materials') {
    shop = { ...shop, materials: shop.materials + 3 };
  } else {
    return bump(state, {
      pendingAd: null,
      rewardClaims: { ...state.rewardClaims, [pending.requestId]: baseClaim },
      notice: '这个位置没有奖励。',
    });
  }
  const history = state.history.map((item, index) =>
    index === state.history.length - 1 && item.dayId === pending.gameDayId
      ? { ...item, ledger, cash: shop.cash, cashDelta: shop.cash - ledger.cashAtStart, profit: profitOf(ledger) }
      : item,
  );
  return bump(state, {
    shop,
    dailyLedger: ledger,
    history,
    pendingAd: null,
    rewardClaims: { ...state.rewardClaims, [pending.requestId]: { ...baseClaim, granted: true } },
    adGrantedDays: {
      ...state.adGrantedDays,
      [pending.gameDayId]: { ...state.adGrantedDays[pending.gameDayId], [pending.placement]: true },
    },
    notice: '测试奖励已记下。这不是真实广告收入，不算营业额，也不加经验或行动。',
  });
}

function trainEmployee(state: GameState, employeeId: string): GameState {
  if (!state.shop || !state.calendar || state.phase !== 'open' || state.actionIndex >= 5) {
    return bump(state, { notice: '现在不能培训。先把眼前的事做完，培训会用掉 1 次行动。' });
  }
  if (state.shop.level < 5) return bump(state, { notice: '到 Lv.5 才能培训。现在点它不会扣行动，也不会扣店铺金。' });
  const employee = state.employees[employeeId];
  if (!employee) return state;
  if (!onDuty(employeeId, state.actionIndex)) {
    return bump(state, { notice: '这个时段人不在店里。等上班再培训，这次不扣行动。' });
  }
  if (employee.trainedToday) return bump(state, { notice: '今天已经培训过这位员工。同一天不再同时做特殊服务。' });
  if (employee.skill >= 3) return bump(state, { notice: '这一阶段的熟练已经够了。' });
  const cost = TRAIN_COSTS[employee.skill] ?? 1500;
  if (state.shop.cash < cost) return bump(state, { notice: `店铺金不够支付培训，还差 ${cost - state.shop.cash}。` });
  const paid: Shop = { ...state.shop, cash: state.shop.cash - cost };
  const xp = grantXp(paid, 6);
  const employees = {
    ...state.employees,
    [employeeId]: { ...employee, skill: employee.skill + 1, trainedToday: true },
  };
  const next = bump(state, {
    shop: xp.shop,
    employees,
    actionIndex: state.actionIndex + 1,
    levelNote: xp.notes[0] ?? state.levelNote,
    dailyLedger: {
      ...state.dailyLedger,
      cogs: state.dailyLedger.cogs + cost,
    },
    notice: `培训完成，花了 ${cost} 店铺金，用掉 1 次行动。今天不再请这位员工做特殊服务。`,
  });
  if (next.actionIndex >= 5) return settle(next);
  return next;
}

function canManage(state: GameState): string | null {
  if (!state.shop || !state.calendar) return '店还没开张。';
  if (state.phase === 'event' || state.phase === 'result' || state.phase === 'onboarding') return '先把眼前的事做完。补货和布置都不消耗行动。';
  return null;
}

function buyItem(state: GameState, itemId: string): GameState {
  const blocked = canManage(state);
  if (blocked || !state.shop || !state.calendar) return blocked ? bump(state, { notice: blocked }) : state;
  const item = ITEM_MAP[itemId];
  if (!item) return state;
  if (state.shop.cash < item.price) {
    return bump(state, { notice: `店铺金不够买${item.name}，还差 ${item.price - state.shop.cash}。` });
  }
  const expiresOn = item.perishableDays ? state.calendar.absoluteDay + item.perishableDays : null;
  return bump(state, {
    shop: { ...state.shop, cash: state.shop.cash - item.price },
    inventory: addItem(state.inventory, item.id, 1, expiresOn),
    dailyLedger: { ...state.dailyLedger, purchases: state.dailyLedger.purchases + item.price },
    notice: `买了${item.name}。这是采购，不算客人的订单，也不消耗行动。`,
  });
}

function buyDecor(state: GameState, decorId: string): GameState {
  const blocked = canManage(state);
  if (blocked || !state.shop) return blocked ? bump(state, { notice: blocked }) : state;
  const decor = DECOR_MAP[decorId];
  if (!decor || decor.price <= 0) return bump(state, { notice: '这件不能直接购买。故事或接待送到的，会自己出现。' });
  if (state.shop.ownedDecor.includes(decorId)) return bump(state, { notice: '已经有这件了。换到位置上不会再收费。' });
  if (state.shop.level < decor.level) return bump(state, { notice: `到 Lv.${decor.level} 才能买${decor.name}。` });
  if (state.shop.cash < decor.price) return bump(state, { notice: `店铺金不够买${decor.name}，还差 ${decor.price - state.shop.cash}。` });
  const paid: Shop = { ...state.shop, cash: state.shop.cash - decor.price };
  return bump(state, {
    shop: grantDecor(paid, decorId),
    dailyLedger: { ...state.dailyLedger, purchases: state.dailyLedger.purchases + decor.price },
    notice: `买下了${decor.name}。之后再换位置，不会重复付钱。`,
  });
}

function setRestock(state: GameState, action: Extract<Action, { type: 'SET_RESTOCK' }>): GameState {
  const blocked = canManage(state);
  if (blocked) return bump(state, { notice: blocked });
  const current = state.restock ?? { budget: 80, paused: [] };
  if (action.itemId) {
    const item = ITEM_MAP[action.itemId];
    if (!item?.restock) return bump(state, { notice: `${item?.name ?? '这件'}不在自动补货里，需要时再手动买。` });
    const paused = current.paused.includes(action.itemId)
      ? current.paused.filter((id) => id !== action.itemId)
      : [...current.paused, action.itemId];
    return bump(state, { restock: { ...current, paused }, notice: null });
  }
  if (action.budget === undefined) return state;
  return bump(state, { restock: { ...current, budget: clamp(action.budget, 0, 400) }, notice: null });
}

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'BEGIN_SHOP':
      return beginShop(state, action.draft);
    case 'OPEN_CATEGORY': {
      if (state.phase !== 'open' || state.actionIndex >= 5 || !state.calendar) return state;
      if (isOpeningDay(state.calendar)) {
        const step = DAY1_SCRIPT[state.scriptStep];
        if (!step) return state;
        if (step.category !== action.category) return bump(state, { notice: `${step.hint}这一步不消耗行动。` });
      }
      const event = state.prepared[action.category];
      if (!event) return bump(state, { notice: '这一项暂时没有合适的事。可以看看别的入口。' });
      const prepared = { ...state.prepared };
      delete prepared[action.category];
      return bump(state, { phase: 'event', prepared, activeEvent: event, notice: null });
    }
    case 'CANCEL_EVENT': {
      if (state.phase !== 'event' || !state.activeEvent || state.activeEvent.submitted) return state;
      return bump(state, {
        phase: 'open',
        activeEvent: null,
        prepared: { ...state.prepared, [state.activeEvent.category]: state.activeEvent },
        notice: null,
      });
    }
    case 'CHOOSE':
      return choose(state, action.choiceId);
    case 'CONTINUE': {
      if (state.phase !== 'result') return state;
      if (state.actionIndex >= 5) return settle(state);
      let next: GameState = { ...state, phase: 'open', activeEvent: null };
      next = refreshOffers(next);
      if (isOpeningDay(next.calendar)) {
        const hint = DAY1_SCRIPT[next.scriptStep]?.hint;
        if (hint) next = { ...next, todayNote: hint };
      }
      return bump(next, {});
    }
    case 'START_NEXT_DAY': {
      if (state.phase !== 'summary' || !state.dailyLedger.settled || !state.calendar || !state.shop) return state;
      const date = nextDate(state.calendar);
      const weather = rollWeather(state.rngState);
      return openDay(state, makeCalendar(date.year, date.month, date.day, weather.weather), weather.rngState);
    }
    case 'TRAIN_EMPLOYEE':
      return trainEmployee(state, action.employeeId);
    case 'CHECKIN_PET': {
      if (!state.calendar || !state.pets[action.petId]?.present || state.checkedInPets.includes(action.petId)) return state;
      if (state.phase === 'event' || state.phase === 'onboarding') return state;
      const current = state.pets[action.petId]!;
      const pets = {
        ...state.pets,
        [action.petId]: { ...current, trust: clamp(current.trust + 1, 0, 100) },
      };
      return bump(state, {
        pets,
        shop: state.shop ? { ...state.shop, happiness: recomputeHappiness(pets) } : null,
        checkedInPets: [...state.checkedInPets, action.petId],
        diaries: [...state.diaries, { petId: action.petId, dayId: state.calendar.dayId, text: diaryLine(action.petId, current.trust, state.calendar.weather) }],
      });
    }
    case 'EQUIP_DECOR': {
      if (!state.shop || !state.shop.ownedDecor.includes(action.decorId)) return bump(state, { notice: '还没有这件装饰，不能换上。' });
      const decor = DECOR_MAP[action.decorId];
      if (!decor) return state;
      return bump(state, { shop: { ...state.shop, equipped: { ...state.shop.equipped, [decor.slot]: action.decorId } }, notice: null });
    }
    case 'BUY_DECOR':
      return buyDecor(state, action.decorId);
    case 'BUY_ITEM':
      return buyItem(state, action.itemId);
    case 'SET_RESTOCK':
      return setRestock(state, action);
    case 'TOGGLE_WARM_LIGHT':
      if (!state.shop || state.phase === 'onboarding') return state;
      return bump(state, { shop: { ...state.shop, warmLight: !state.shop.warmLight } });
    case 'SET_SETTINGS':
      return bump(state, {
        settings: {
          music: action.music ?? state.settings.music,
          sfx: action.sfx ?? state.settings.sfx,
          reduceMotion: action.reduceMotion ?? state.settings.reduceMotion,
          audioPromptSeen: action.audioPromptSeen ?? state.settings.audioPromptSeen,
          replayIntro: action.replayIntro ?? state.settings.replayIntro,
        },
      });
    case 'CLEAR_NOTICE':
      if (!state.notice) return state;
      return bump(state, { notice: null });
    case 'SHOW_NOTICE':
      return bump(state, { notice: action.text });
    case 'BEGIN_AD': {
      if (!state.shop || !state.calendar) return state;
      if (action.placement === 'day_transition') return bump(state, { notice: '插屏广告默认关闭，不会挡住下一天。' });
      if (action.placement === 'day_end_bonus' && state.phase !== 'summary') return state;
      if (state.phase === 'event' || state.phase === 'result' || state.phase === 'onboarding') {
        return bump(state, { notice: '现在不能看广告。先把眼前的事做完。' });
      }
      if (state.adGrantedDays[state.calendar.dayId]?.[action.placement]) {
        return bump(state, { notice: '今天这个测试奖励已经领过了。' });
      }
      if (state.pendingAd) return bump(state, { notice: '有一个广告测试还没选完。' });
      return bump(state, {
        pendingAd: { requestId: action.requestId, placement: action.placement, gameDayId: state.calendar.dayId },
        notice: null,
      });
    }
    case 'RESOLVE_AD':
      return resolveAd(state, action.result);
    case 'IMPORT_SAVE':
      if (action.state.saveVersion !== SAVE_VERSION) return bump(state, { notice: '这份存档的版本不能用，当前进度还在。' });
      return action.state;
    default:
      return state;
  }
}

export { createNewGame };
