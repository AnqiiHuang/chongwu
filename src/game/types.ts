export const SAVE_VERSION = 1;

export type Phase = 'onboarding' | 'open' | 'event' | 'result' | 'summary';
export type OnboardingStep = 'name' | 'style' | 'address' | 'owner' | 'staff';
export type Weather = 'sunny' | 'cloudy' | 'rain';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type ActionCategory = 'customer' | 'care' | 'neighborhood';
export type ShopStyle = 'wood' | 'nordic' | 'academy' | 'modern' | 'workshop' | 'cute';
export type AddressId = 'community' | 'oldtown' | 'campus' | 'hospital';
export type PersonalityId = 'kind' | 'careful' | 'bright' | 'calm';
export type CareStatus = 'ok' | 'watch' | 'hospital';
export type AdPlacement = 'day_end_bonus' | 'decor_materials' | 'day_transition';
export type AdResult = 'rewarded' | 'closed' | 'unavailable' | 'failed';
export type DecorSlot = 'window' | 'door' | 'carpet' | 'shelf' | 'wall';
export type HairStyle = 'bob' | 'bun' | 'curly' | 'short';

export interface Look {
  hairStyle: HairStyle;
  hairColor: string;
  apron: string;
  shirt: string;
  glasses: boolean;
  accent: string;
}

export interface Player {
  name: string;
  age: 22;
  gender: 'female';
  heightCm: number;
  portraitId: string;
  personalityId: PersonalityId;
  hair: string;
  outfit: string;
}

export interface Shop {
  name: string;
  style: ShopStyle;
  addressId: AddressId;
  cash: number;
  materials: number;
  popularity: number;
  happiness: number;
  community: number;
  level: number;
  xp: number;
  equipped: Record<DecorSlot, string | null>;
  ownedDecor: string[];
  warmLight: boolean;
  wagePayable: number;
  rentPayable: number;
  stamps: number;
}

export interface GameCalendar {
  year: number;
  month: number;
  day: number;
  absoluteDay: number;
  dayId: string;
  weather: Weather;
}

export interface PetState {
  id: string;
  happiness: number;
  energy: number;
  trust: number;
  care: CareStatus;
  present: boolean;
}

export interface CustomerState {
  id: string;
  visits: number;
  affinity: number;
  lastPurchase: string | null;
  preferences: string[];
  taboo: string | null;
  goodStreak: number;
  met: boolean;
}

export interface EmployeeState {
  id: string;
  skill: number;
  practice: number;
  trainedToday: boolean;
}

export interface InventoryBatch {
  itemId: string;
  quantity: number;
  expiresOn: number | null;
}

export interface Effects {
  revenue: number;
  cashExpense: number;
  stockCogs: number;
  purchases: number;
  deposits: number;
  miscCash: number;
  popularity: number;
  community: number;
  visitors: number;
  orders: number;
  goodService: boolean;
  bonusCash: number;
  items: { itemId: string; delta: number }[];
  pets: { id: string; trust: number; happiness: number; energy: number }[];
  customers: {
    id: string;
    affinity: number;
    meet: boolean;
    lastPurchase: string | null;
    preference: string | null;
    taboo: string | null;
    visits: number;
  }[];
  stamps: number;
  flags: string[];
  clearFlags: string[];
  decor: string | null;
  practiceStaff: string | null;
  note: string;
}

export interface ResolvedChoice {
  id: string;
  label: string;
  preview: string;
  disabledReason: string | null;
  resultText: string;
  effects: Effects;
  changes: string[];
}

export interface ActiveEvent {
  instanceId: string;
  templateId: string;
  category: ActionCategory;
  title: string;
  description: string;
  timeLabel: string;
  characterId: string | null;
  petId: string | null;
  coach: string | null;
  choices: ResolvedChoice[];
  submitted: boolean;
  result: { choiceId: string; text: string; changes: string[] } | null;
}

export interface Draft {
  shopName: string;
  style: ShopStyle | null;
  addressId: AddressId | null;
}

export interface DailyLedger {
  visitors: number;
  orders: number;
  revenue: number;
  cogs: number;
  purchases: number;
  deposits: number;
  miscCash: number;
  wageAccrual: number;
  rentAccrual: number;
  utilities: number;
  bonusCash: number;
  goodService: boolean;
  settled: boolean;
  wagePaid: number;
  rentPaid: number;
  cashAtStart: number;
  notes: string[];
  photoCaption: string;
}

export interface DaySummary {
  dayId: string;
  dateLabel: string;
  weather: Weather;
  ledger: DailyLedger;
  popularity: number;
  happiness: number;
  community: number;
  level: number;
  xp: number;
  cash: number;
  profit: number;
  cashDelta: number;
}

export interface RewardClaim {
  requestId: string;
  placement: AdPlacement;
  granted: boolean;
  gameDayId: string;
}

export interface PendingAd {
  requestId: string;
  placement: AdPlacement;
  gameDayId: string;
}

export interface RestockPlan {
  budget: number;
  paused: string[];
}

export interface DiaryEntry {
  petId: string;
  dayId: string;
  text: string;
}

export interface TemplateUse {
  id: string;
  day: number;
}

export interface GameSettings {
  music: boolean;
  sfx: boolean;
  reduceMotion: boolean;
  audioPromptSeen: boolean;
}

export interface GameState {
  saveVersion: number;
  revision: number;
  phase: Phase;
  onboardingStep: OnboardingStep;
  draft: Draft;
  player: Player | null;
  shop: Shop | null;
  calendar: GameCalendar | null;
  actionIndex: number;
  prepared: Partial<Record<ActionCategory, ActiveEvent>>;
  activeEvent: ActiveEvent | null;
  scriptStep: number;
  recentUses: TemplateUse[];
  rngState: number;
  pets: Record<string, PetState>;
  customers: Record<string, CustomerState>;
  employees: Record<string, EmployeeState>;
  inventory: InventoryBatch[];
  storyFlags: Record<string, boolean>;
  dailyLedger: DailyLedger;
  settledDayIds: string[];
  rewardClaims: Record<string, RewardClaim>;
  adGrantedDays: Record<string, Partial<Record<AdPlacement, boolean>>>;
  pendingAd: PendingAd | null;
  checkedInPets: string[];
  diaries: DiaryEntry[];
  history: DaySummary[];
  todayNote: string;
  notice: string | null;
  levelNote: string | null;
  metricLog: { popularity: string[]; happiness: string[]; community: string[] };
  settings: GameSettings;
  restockedDayId: string | null;
  restock: RestockPlan;
  star1: boolean;
  star2: boolean;
  star2DayId: string | null;
}

export type Action =
  | { type: 'CONFIRM_NAME'; name: string }
  | { type: 'SELECT_STYLE'; style: ShopStyle }
  | { type: 'CONFIRM_STYLE' }
  | { type: 'CONFIRM_ADDRESS' }
  | { type: 'UPDATE_PLAYER'; name?: string; heightCm?: number; portraitId?: string; personalityId?: PersonalityId }
  | { type: 'CONFIRM_OWNER' }
  | { type: 'START_BUSINESS' }
  | { type: 'OPEN_CATEGORY'; category: ActionCategory }
  | { type: 'CANCEL_EVENT' }
  | { type: 'CHOOSE'; choiceId: string }
  | { type: 'CONTINUE' }
  | { type: 'START_NEXT_DAY' }
  | { type: 'CHECKIN_PET'; petId: string }
  | { type: 'TRAIN_EMPLOYEE'; employeeId: string }
  | { type: 'EQUIP_DECOR'; decorId: string }
  | { type: 'BUY_DECOR'; decorId: string }
  | { type: 'BUY_ITEM'; itemId: string }
  | { type: 'SET_RESTOCK'; budget?: number; itemId?: string }
  | { type: 'TOGGLE_WARM_LIGHT' }
  | { type: 'SET_SETTINGS'; music?: boolean; sfx?: boolean; reduceMotion?: boolean; audioPromptSeen?: boolean }
  | { type: 'CLEAR_NOTICE' }
  | { type: 'SHOW_NOTICE'; text: string }
  | { type: 'BEGIN_AD'; placement: AdPlacement; requestId: string }
  | { type: 'RESOLVE_AD'; result: AdResult }
  | { type: 'IMPORT_SAVE'; state: GameState };
