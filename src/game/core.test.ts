import { describe, expect, it } from 'vitest';
import { prepareEvent, listTemplates } from '../content/events';
import { applyMorning, availableQty, monthTotals } from './economy';
import { createNewGame, initialEmployees } from './initial';
import { gameReducer } from './reducer';
import { parseGame, serializeGame } from './save';
import { loadGame, persistGame, type Kv } from '../services/storage';
import { canStartRewarded, emptyAdFrequency, noteRewarded, realAdsAllowed, shouldShowRewardEntry, interstitialEnabled } from '../services/ads';
import { emptyDraft, parseDraft, shopNameError } from './draft';
import { dailyWage } from './roster';
import type { ActionCategory, GameState, OnboardingDraft } from './types';

function sampleDraft(ids = ['su_tao', 'lin_xu']): OnboardingDraft {
  return {
    schemaVersion: 1,
    step: 'STAFF',
    shopName: '茸茸小屋',
    styleId: 'japanese_wood',
    locationId: 'old_town',
    ownerName: '祁见禾',
    personalityId: 'kind',
    appearance: {
      hairId: 'hair.chestnut_bob',
      topId: 'top.ivory_blouse',
      apronId: 'apron.sage_paw',
      shoesId: 'shoes.brown_boots',
    },
    selectedEmployeeIds: ids,
  };
}

function memory(): Kv {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function boot(seed = 7, ids = ['su_tao', 'lin_xu']): GameState {
  return gameReducer(createNewGame(seed), { type: 'BEGIN_SHOP', draft: sampleDraft(ids) });
}

const DAY1: { category: ActionCategory; choiceId: string }[] = [
  { category: 'customer', choiceId: 'look' },
  { category: 'care', choiceId: 'sit' },
  { category: 'neighborhood', choiceId: 'talk' },
  { category: 'care', choiceId: 'cloth' },
  { category: 'customer', choiceId: 'chat' },
];

function playOpeningDay(seed = 7): GameState {
  let state = boot(seed);
  for (const step of DAY1) {
    state = gameReducer(state, { type: 'OPEN_CATEGORY', category: step.category });
    state = gameReducer(state, { type: 'CHOOSE', choiceId: step.choiceId });
    state = gameReducer(state, { type: 'CONTINUE' });
  }
  return state;
}

describe('开张日', () => {
  it('每个事件恰好三个选项', () => {
    for (const template of listTemplates()) {
      expect(template.choices).toHaveLength(3);
    }
  });

  it('店名太短不能开店，选定的地址会留在草稿里', () => {
    expect(shopNameError('猫')).toContain('2');
    const draft = { ...emptyDraft(), shopName: '茸茸小屋', styleId: 'cute_pets' as const, locationId: 'clinic' as const, step: 'LOCATION' as const };
    const restored = parseDraft(JSON.stringify(draft));
    expect(restored?.locationId).toBe('clinic');
    expect(restored?.styleId).toBe('cute_pets');
    const started = gameReducer(createNewGame(1), { type: 'BEGIN_SHOP', draft: { ...sampleDraft(), shopName: '猫' } });
    expect(started.shop).toBeNull();
  });

  it('五次行动后进入日报，重复结算不会再扣钱', () => {
    const state = playOpeningDay();
    expect(state.phase).toBe('summary');
    expect(state.actionIndex).toBe(5);
    expect(state.shop?.cash).toBe(19940);
    expect(state.dailyLedger.settled).toBe(true);
    expect(state.dailyLedger.utilities).toBe(60);
    expect(state.shop?.xp).toBe(40);
    expect(state.star1).toBe(true);
    expect(state.history).toHaveLength(1);
    const again = gameReducer(state, { type: 'CONTINUE' });
    expect(again.shop?.cash).toBe(19940);
    expect(again.history).toHaveLength(1);
    expect(again.phase).toBe('summary');
    const stuck = gameReducer(again, { type: 'OPEN_CATEGORY', category: 'customer' });
    expect(stuck.actionIndex).toBe(5);
    expect(stuck.shop?.cash).toBe(19940);
  });

  it('取消事件不扣行动，刷新后还是同一件事', () => {
    let state = boot();
    const instance = state.prepared.customer?.instanceId;
    state = gameReducer(state, { type: 'OPEN_CATEGORY', category: 'customer' });
    expect(state.phase).toBe('event');
    expect(state.actionIndex).toBe(0);
    state = gameReducer(state, { type: 'CANCEL_EVENT' });
    expect(state.phase).toBe('open');
    expect(state.actionIndex).toBe(0);
    expect(state.prepared.customer?.instanceId).toBe(instance);
    const saved = parseGame(serializeGame(state));
    expect(saved?.prepared.customer?.title).toBe('开张接待');
    expect(saved?.calendar?.weather).toBe(state.calendar?.weather);
    expect(saved?.shop?.cash).toBe(20000);
  });

  it('同一个选项不能提交两次', () => {
    let state = boot();
    state = gameReducer(state, { type: 'OPEN_CATEGORY', category: 'customer' });
    state = gameReducer(state, { type: 'CHOOSE', choiceId: 'look' });
    const cash = state.shop?.cash;
    const revision = state.revision;
    const again = gameReducer(state, { type: 'CHOOSE', choiceId: 'look' });
    expect(again.revision).toBe(revision);
    expect(again.shop?.cash).toBe(cash);
    expect(again.actionIndex).toBe(1);
  });

  it('点错开张日入口不扣行动', () => {
    const state = gameReducer(boot(), { type: 'OPEN_CATEGORY', category: 'care' });
    expect(state.phase).toBe('open');
    expect(state.actionIndex).toBe(0);
    expect(state.notice).toContain('不消耗行动');
  });

  it('开启明天才会进入下一天', () => {
    const summary = playOpeningDay();
    const tomorrow = gameReducer(summary, { type: 'START_NEXT_DAY' });
    expect(tomorrow.calendar?.day).toBe(2);
    expect(tomorrow.phase).toBe('open');
    expect(tomorrow.actionIndex).toBe(0);
    expect(tomorrow.dailyLedger.settled).toBe(false);
    expect(tomorrow.history).toHaveLength(1);
    const early = gameReducer(tomorrow, { type: 'START_NEXT_DAY' });
    expect(early.calendar?.day).toBe(2);
  });

  it('钱不够时不能买，余额不会变成负数', () => {
    const started = boot();
    const broke: GameState = { ...started, shop: { ...started.shop!, cash: 10 } };
    const prepared = prepareEvent(broke, 'window_corner');
    const cushion = prepared?.event.choices.find((choice) => choice.id === 'cushion');
    expect(cushion?.disabledReason).toContain('不够');
    const opened = gameReducer(
      { ...broke, phase: 'event', activeEvent: prepared!.event },
      { type: 'CHOOSE', choiceId: 'cushion' },
    );
    expect(opened.shop?.cash).toBe(10);
    expect(opened.actionIndex).toBe(0);
  });

  it('苏桃下班后不能出现在护理里', () => {
    const started = boot();
    const evening: GameState = { ...started, actionIndex: 4 };
    const prepared = prepareEvent(evening, 'window_corner');
    expect(prepared?.event.choices.find((choice) => choice.id === 'staff')?.disabledReason).toContain('不在店里');
  });

  it('过期食品不会留下来卖，自动补货一天只做一次', () => {
    const started = boot();
    const day = started.calendar!.absoluteDay;
    const stocked: GameState = {
      ...started,
      restockedDayId: null,
      inventory: [
        { itemId: 'snack_cat', quantity: 2, expiresOn: day - 1 },
        { itemId: 'snack_dog', quantity: 3, expiresOn: day + 5 },
        { itemId: 'towel', quantity: 6, expiresOn: null },
        { itemId: 'comb', quantity: 2, expiresOn: null },
        { itemId: 'cotton', quantity: 4, expiresOn: null },
      ],
    };
    const morning = applyMorning(stocked);
    expect(morning.inventory.some((batch) => batch.expiresOn !== null && batch.expiresOn < day)).toBe(false);
    expect(morning.shop!.cash).toBeLessThan(20000);
    expect(applyMorning(morning).shop!.cash).toBe(morning.shop!.cash);
    expect(applyMorning(morning).revision).toBe(morning.revision);
  });
});

function finishDay(state: GameState): GameState {
  let guard = 0;
  while (state.phase !== 'summary' && guard < 12) {
    guard += 1;
    if (state.phase === 'open') {
      const category = (['customer', 'care', 'neighborhood'] as const).find((id) => state.prepared[id]);
      if (!category) break;
      state = gameReducer(state, { type: 'OPEN_CATEGORY', category });
    } else if (state.phase === 'event') {
      const choice = state.activeEvent?.choices.find((item) => !item.disabledReason);
      if (!choice) break;
      state = gameReducer(state, { type: 'CHOOSE', choiceId: choice.id });
    } else if (state.phase === 'result') {
      state = gameReducer(state, { type: 'CONTINUE' });
    } else {
      break;
    }
  }
  return state;
}

describe('一周的店', () => {
  it('花店故事一天只接一段，刷新后进度还在', () => {
    const day2 = gameReducer(playOpeningDay(), { type: 'START_NEXT_DAY' });
    expect(day2.storyFlags.florist_met).toBe(true);
    expect(day2.prepared.neighborhood?.templateId).toBe('florist_pace');
    expect(day2.prepared.care?.templateId).toBe('sun_quiet');
    expect(day2.prepared.neighborhood?.choices).toHaveLength(3);
    let state = gameReducer(day2, { type: 'OPEN_CATEGORY', category: 'neighborhood' });
    state = gameReducer(state, { type: 'CHOOSE', choiceId: 'watch' });
    state = gameReducer(state, { type: 'CONTINUE' });
    expect(state.storyFlags.florist_pace).toBe(true);
    expect(state.customers.he_fang?.visits).toBe(2);
    expect(state.prepared.neighborhood?.templateId).not.toBe('florist_practice');
    expect(parseGame(serializeGame(state))?.storyFlags.florist_pace).toBe(true);
    const day3 = gameReducer(finishDay(state), { type: 'START_NEXT_DAY' });
    expect(day3.calendar?.day).toBe(3);
    expect(day3.prepared.neighborhood?.templateId).toBe('florist_practice');
  });

  it('没有软球时仍有别的办法，缺货会说明原因', () => {
    const started = boot();
    const bare: GameState = {
      ...started,
      storyFlags: { florist_met: true, florist_pace: true },
      inventory: started.inventory.filter((batch) => batch.itemId !== 'toy'),
    };
    const prepared = prepareEvent(bare, 'florist_practice');
    expect(prepared?.event.choices).toHaveLength(3);
    expect(prepared?.event.choices.find((choice) => choice.id === 'roll')?.disabledReason).toContain('软球');
    expect(prepared?.event.choices.find((choice) => choice.id === 'note')?.disabledReason).toBeNull();
  });

  it('装饰先看店铺金和等级，换上不重复付钱', () => {
    const started = boot();
    const broke: GameState = { ...started, shop: { ...started.shop!, cash: 10 } };
    const denied = gameReducer(broke, { type: 'BUY_DECOR', decorId: 'dried_flowers' });
    expect(denied.shop?.cash).toBe(10);
    expect(denied.notice).toContain('不够');
    const locked = gameReducer(started, { type: 'BUY_DECOR', decorId: 'door_mat' });
    expect(locked.notice).toContain('Lv.2');
    expect(locked.shop?.cash).toBe(20000);
    const bought = gameReducer(started, { type: 'BUY_DECOR', decorId: 'dried_flowers' });
    expect(bought.shop?.cash).toBe(19982);
    expect(bought.shop?.equipped.shelf).toBe('dried_flowers');
    const again = gameReducer(bought, { type: 'BUY_DECOR', decorId: 'dried_flowers' });
    expect(again.shop?.cash).toBe(19982);
    const moved = gameReducer(bought, { type: 'EQUIP_DECOR', decorId: 'price_board' });
    expect(moved.shop?.cash).toBe(19982);
  });

  it('手动补货不消耗行动，旧存档会补上后来的字段', () => {
    const started = boot();
    const bought = gameReducer(started, { type: 'BUY_ITEM', itemId: 'toy' });
    expect(bought.actionIndex).toBe(0);
    expect(bought.shop?.cash).toBe(19990);
    expect(availableQty(bought.inventory, 'toy', bought.calendar!.absoluteDay)).toBe(3);
    const raw = JSON.parse(serializeGame(bought)) as {
      shop: { stamps?: number };
      restock?: { budget: number };
      customers: Record<string, { taboo?: string; goodStreak?: number; met?: boolean }>;
      storyFlags: Record<string, boolean>;
    };
    delete raw.shop.stamps;
    delete raw.restock;
    delete raw.customers.he_fang?.taboo;
    delete raw.customers.he_fang?.goodStreak;
    delete raw.customers.zhou_wan;
    raw.customers.he_fang = { ...raw.customers.he_fang, met: true };
    delete raw.storyFlags.florist_met;
    const restored = parseGame(JSON.stringify(raw));
    expect(restored?.shop?.stamps).toBe(0);
    expect(restored?.restock.budget).toBe(80);
    expect(restored?.customers.zhou_wan?.met).toBe(false);
    expect(restored?.customers.he_fang?.goodStreak).toBe(0);
    expect(restored?.storyFlags.florist_met).toBe(true);
    expect(restored?.shop?.name).toBe('茸茸小屋');
  });
});

describe('一个月', () => {
  it('日常和故事加起来覆盖四十五个事件', () => {
    const playable = listTemplates().filter((template) => !template.fallback);
    expect(playable).toHaveLength(45);
    expect(playable.filter((template) => template.story)).toHaveLength(15);
    expect(playable.every((template) => template.choices.length === 3)).toBe(true);
  });

  it('培训未到等级不扣钱，到了等级只扣一次行动', () => {
    const early = gameReducer(boot(), { type: 'TRAIN_EMPLOYEE', employeeId: 'su_tao' });
    expect(early.actionIndex).toBe(0);
    expect(early.shop?.cash).toBe(20000);
    expect(early.notice).toContain('Lv.5');
    const ready: GameState = { ...boot(), shop: { ...boot().shop!, level: 5 } };
    const trained = gameReducer(ready, { type: 'TRAIN_EMPLOYEE', employeeId: 'su_tao' });
    expect(trained.actionIndex).toBe(1);
    expect(trained.shop?.cash).toBe(19700);
    expect(trained.employees.su_tao?.skill).toBe(1);
    expect(trained.employees.su_tao?.trainedToday).toBe(true);
    const again = gameReducer(trained, { type: 'TRAIN_EMPLOYEE', employeeId: 'su_tao' });
    expect(again.actionIndex).toBe(1);
    expect(again.shop?.cash).toBe(19700);
  });

  it('二星要等花店故事、幸福和综合分一起达到', () => {
    const opened = playOpeningDay();
    expect(opened.star2).toBe(false);
    const base = {
      ...opened,
      phase: 'result' as const,
      dailyLedger: { ...opened.dailyLedger, settled: false },
      settledDayIds: [] as string[],
      shop: { ...opened.shop!, popularity: 50, happiness: 80, community: 40 },
    };
    const tooSoon = gameReducer(base, { type: 'CONTINUE' });
    expect(tooSoon.star2).toBe(false);
    const ready = gameReducer({ ...base, storyFlags: { ...base.storyFlags, florist_stand: true } }, { type: 'CONTINUE' });
    expect(ready.star2).toBe(true);
    expect(ready.star2DayId).toBe(opened.calendar?.dayId);
  });

  it('月报把利润和现金分开', () => {
    const state = playOpeningDay();
    const month = monthTotals(state.history, 1, 3);
    expect(month.days).toBe(1);
    expect(month.profit).toBe(state.history[0]?.profit);
    expect(month.cash).toBe(state.history[0]?.cashDelta);
    expect(month.profit).not.toBe(month.cash);
  });

  it('正好两位店员，连点开店不会再建一份', () => {
    const pair = boot(4, ['su_tao', 'tang_li']);
    expect(Object.keys(pair.employees).sort()).toEqual(['su_tao', 'tang_li']);
    expect(dailyWage(pair.employees)).toBe(230);
    expect(dailyWage(boot(1, ['su_tao', 'lin_xu']).employees)).toBe(250);
    expect(dailyWage(boot(1, ['lin_xu', 'tang_li']).employees)).toBe(220);
    expect(gameReducer(createNewGame(1), { type: 'BEGIN_SHOP', draft: sampleDraft(['su_tao']) }).shop).toBeNull();
    expect(gameReducer(createNewGame(1), { type: 'BEGIN_SHOP', draft: sampleDraft(['su_tao', 'lin_xu', 'tang_li']) }).shop).toBeNull();
    expect(pair.employees.lin_xu).toBeUndefined();
    const again = gameReducer(pair, { type: 'BEGIN_SHOP', draft: { ...sampleDraft(['lin_xu', 'tang_li']), shopName: '另一家' } });
    expect(again.shop?.name).toBe('茸茸小屋');
    expect(again.shop?.cash).toBe(pair.shop?.cash);
    expect(again.actionIndex).toBe(0);
  });

  it('旧的三员工存档保留团队，并换成对应的装修和店址', () => {
    const opened = boot();
    const raw = JSON.parse(serializeGame({ ...opened, employees: initialEmployees(['su_tao', 'lin_xu', 'tang_li']) })) as {
      saveVersion: number;
      shop: { style: string; addressId: string };
      player: { portraitId: string; appearance?: unknown };
      employees: Record<string, unknown>;
    };
    raw.saveVersion = 1;
    raw.shop.style = 'cute';
    raw.shop.addressId = 'hospital';
    raw.player.portraitId = 'p4';
    delete raw.player.appearance;
    const restored = parseGame(JSON.stringify(raw));
    expect(restored?.saveVersion).toBe(2);
    expect(restored?.shop?.style).toBe('cute_pets');
    expect(restored?.shop?.addressId).toBe('clinic');
    expect(restored?.player?.appearance.hairId).toBe('hair.honey_shoulder');
    expect(Object.keys(restored?.employees ?? {})).toEqual(['su_tao', 'lin_xu', 'tang_li']);
    expect(restored?.shop?.cash).toBe(20000);
    expect(dailyWage(restored?.employees ?? {})).toBe(350);
  });

  it('没入职的员工不能被派去工作', () => {
    const started = boot(7, ['lin_xu', 'tang_li']);
    const prepared = prepareEvent(started, 'window_corner');
    expect(prepared?.event.description).toContain('没有加入');
    const evening = prepareEvent({ ...started, employees: boot().employees, actionIndex: 4 }, 'window_corner');
    expect(evening?.event.choices.find((choice) => choice.id === 'staff')?.disabledReason).toContain('不在店里');
  });

  it('后来的动物开局不在店里，旧存档会补上', () => {
    const started = boot();
    expect(started.pets.wuyun?.present).toBe(false);
    expect(started.pets.zhima?.present).toBe(false);
    expect(started.pets.nuomi?.present).toBe(false);
    expect(started.shop?.happiness).toBe(55);
    const raw = JSON.parse(serializeGame(playOpeningDay())) as { pets: Record<string, unknown>; star2?: boolean };
    delete raw.pets.wuyun;
    delete raw.pets.zhima;
    delete raw.pets.nuomi;
    delete raw.star2;
    const restored = parseGame(JSON.stringify(raw));
    expect(restored?.pets.wuyun?.present).toBe(false);
    expect(restored?.star2).toBe(false);
    expect(restored?.storyFlags.dahuang_met).toBe(true);
  });
});

describe('存档与广告', () => {
  it('坏掉的主存档会退回备份，错误导入不会覆盖进度', () => {
    const store = memory();
    const state = boot();
    expect(persistGame(store, state).ok).toBe(true);
    expect(persistGame(store, state).ok).toBe(true);
    store.setItem('chongwu.save.v1', '{');
    const loaded = loadGame(store);
    expect(loaded?.source).toBe('backup');
    expect(loaded?.state.shop?.name).toBe('茸茸小屋');
    const kept = gameReducer(state, { type: 'IMPORT_SAVE', state: { ...state, saveVersion: 99 as 1 } });
    expect(kept.shop?.name).toBe('茸茸小屋');
    expect(kept.notice).toContain('版本');
    expect(parseGame('{bad')).toBeNull();
  });

  it('广告奖励只发一次，失败不扣钱也不加经验', () => {
    let state = playOpeningDay();
    const xp = state.shop!.xp;
    const revenue = state.dailyLedger.revenue;
    state = gameReducer(state, { type: 'BEGIN_AD', placement: 'day_end_bonus', requestId: 'req-1' });
    state = gameReducer(state, { type: 'RESOLVE_AD', result: 'closed' });
    expect(state.shop?.cash).toBe(19940);
    expect(state.rewardClaims['req-1']?.granted).toBe(false);
    state = gameReducer(state, { type: 'RESOLVE_AD', result: 'rewarded' });
    expect(state.shop?.cash).toBe(19940);
    state = gameReducer(state, { type: 'BEGIN_AD', placement: 'day_end_bonus', requestId: 'req-2' });
    state = gameReducer(state, { type: 'RESOLVE_AD', result: 'rewarded' });
    expect(state.shop?.cash).toBe(20020);
    expect(state.dailyLedger.revenue).toBe(revenue);
    expect(state.dailyLedger.bonusCash).toBe(80);
    expect(state.shop?.xp).toBe(xp);
    const repeated = gameReducer(state, { type: 'RESOLVE_AD', result: 'rewarded' });
    expect(repeated.shop?.cash).toBe(20020);
    const blocked = gameReducer(state, { type: 'BEGIN_AD', placement: 'day_end_bonus', requestId: 'req-3' });
    expect(blocked.pendingAd).toBeNull();
    expect(blocked.shop?.cash).toBe(20020);
  });

  it('正式广告有静默期，生产环境没有真实 SDK 时不显示入口', () => {
    expect(interstitialEnabled).toBe(false);
    expect(shouldShowRewardEntry(false, false)).toBe(false);
    expect(shouldShowRewardEntry(true, false)).toBe(true);
    const fresh = emptyAdFrequency(1_000);
    expect(realAdsAllowed(fresh)).toBe(false);
    const ready = { ...fresh, seenGameDayIds: ['1', '2', '3', '4'], foregroundMs: 11 * 60 * 1000 };
    expect(realAdsAllowed(ready)).toBe(true);
    const limited = noteRewarded(noteRewarded(noteRewarded(noteRewarded(fresh, 10_000), 400_000), 800_000), 1_200_000);
    expect(canStartRewarded(limited, 1_400_000).ok).toBe(false);
    expect(canStartRewarded(noteRewarded(fresh, 10_000), 20_000).ok).toBe(false);
  });
});
