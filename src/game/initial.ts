import { CUSTOMERS } from '../content/world';
import { emptyLedger } from './economy';
import { SAVE_VERSION, type CustomerState, type EmployeeState, type GameState, type InventoryBatch, type PetState, type Weather } from './types';

export function charLength(value: string): number {
  return [...value.trim()].length;
}

export function createNewGame(seed?: number): GameState {
  const mixed = (seed ?? Math.floor(Date.now() ^ (Math.random() * 0xffffffff))) >>> 0;
  return {
    saveVersion: SAVE_VERSION,
    revision: 1,
    phase: 'onboarding',
    onboardingStep: 'name',
    draft: { shopName: '', style: null, addressId: null },
    player: null,
    shop: null,
    calendar: null,
    actionIndex: 0,
    prepared: {},
    activeEvent: null,
    scriptStep: 0,
    recentUses: [],
    rngState: mixed || 1,
    pets: {},
    customers: {},
    employees: {},
    inventory: [],
    storyFlags: {},
    dailyLedger: emptyLedger(0),
    settledDayIds: [],
    rewardClaims: {},
    adGrantedDays: {},
    pendingAd: null,
    checkedInPets: [],
    diaries: [],
    history: [],
    todayNote: '',
    notice: null,
    levelNote: null,
    metricLog: { popularity: [], happiness: [], community: [] },
    settings: { music: false, sfx: true, reduceMotion: false, audioPromptSeen: false, replayIntro: false },
    restockedDayId: null,
    restock: { budget: 80, paused: [] },
    star1: false,
    star2: false,
    star2DayId: null,
  };
}

export function initialPets(): Record<string, PetState> {
  return {
    dahuang: { id: 'dahuang', happiness: 55, energy: 70, trust: 22, care: 'ok', present: true },
    naipao: { id: 'naipao', happiness: 48, energy: 74, trust: 36, care: 'ok', present: true },
    doubao: { id: 'doubao', happiness: 62, energy: 78, trust: 58, care: 'ok', present: true },
    wuyun: { id: 'wuyun', happiness: 42, energy: 68, trust: 8, care: 'ok', present: false },
    zhima: { id: 'zhima', happiness: 50, energy: 64, trust: 12, care: 'ok', present: false },
    nuomi: { id: 'nuomi', happiness: 46, energy: 40, trust: 10, care: 'ok', present: false },
  };
}

export function initialCustomers(): Record<string, CustomerState> {
  return Object.fromEntries(
    Object.keys(CUSTOMERS).map((id) => [
      id,
      { id, visits: 0, affinity: 0, lastPurchase: null, preferences: [], taboo: null, goodStreak: 0, met: false },
    ]),
  );
}

export function initialEmployees(ids: readonly string[]): Record<string, EmployeeState> {
  return Object.fromEntries(ids.map((id) => [id, { id, skill: 0, practice: 0, trainedToday: false }]));
}

export function initialInventory(day: number): InventoryBatch[] {
  return [
    { itemId: 'food_cat', quantity: 4, expiresOn: day + 30 },
    { itemId: 'food_dog', quantity: 3, expiresOn: day + 30 },
    { itemId: 'snack_cat', quantity: 4, expiresOn: day + 20 },
    { itemId: 'snack_dog', quantity: 3, expiresOn: day + 20 },
    { itemId: 'litter', quantity: 2, expiresOn: null },
    { itemId: 'towel', quantity: 6, expiresOn: null },
    { itemId: 'comb', quantity: 2, expiresOn: null },
    { itemId: 'cotton', quantity: 4, expiresOn: null },
    { itemId: 'cleaner', quantity: 2, expiresOn: null },
    { itemId: 'leash', quantity: 1, expiresOn: null },
    { itemId: 'toy', quantity: 2, expiresOn: null },
    { itemId: 'paper_house', quantity: 1, expiresOn: null },
  ];
}

export function diaryLine(petId: string, trust: number, weather: Weather): string {
  if (petId === 'dahuang') {
    if (trust >= 40) return '大黄的耳朵没有贴下去。你猜它今天把窗台当成了自己的地方。这是你的观察，它没有说话。';
    return '大黄还是看着阳光，不看你的手。你在手记里写：慢一点也算靠近。';
  }
  if (petId === 'naipao') {
    return trust >= 45
      ? '奶泡把下巴放在爪子上，尾巴却没有收紧。你没有伸手，它也就没有躲开。'
      : '奶泡看了你一眼，又把脸埋回软垫。今天的摸摸，只是让它知道你在。';
  }
  if (petId === 'wuyun') return '乌云停在安静房间的门口，没有进到猫狗活动的地方。你记下它今天愿意待在自己的区域。';
  if (petId === 'zhima') return '芝麻在纸屋里探出鼻子，又缩回去。你没有把它抱去前厅。';
  if (petId === 'nuomi') return '糯米在自己的小房子里动了动粮食。你没有打开盖子打扰它。';
  if (weather === 'rain') return '豆包的爪子在垫子上踩了踩，没有往雨里冲。你记下它愿意等。';
  return '豆包用鼻子碰了碰你的鞋边，又回到自己的纸袋旁边。它今天接受了这次打招呼。';
}
