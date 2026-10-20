import { LATER_TEMPLATES } from './laterEvents';
import { cashDelta, describeEffects, emptyEffects, finishEffects, fx, quoteExpense, quoteRevenue } from '../game/effects';
import { availableQty } from '../game/economy';
import { nextRng } from '../game/rng';
import { isOpeningDay, onDuty, timeLabel } from '../game/time';
import type { ActionCategory, ActiveEvent, Effects, GameState } from '../game/types';

export interface PrepCtx {
  state: GameState;
  roll: () => number;
  category: ActionCategory;
}

interface ChoiceTemplate {
  id: string;
  label: string;
  preview: (ctx: PrepCtx) => string;
  requires?: (ctx: PrepCtx) => string | null;
  resolve: (ctx: PrepCtx) => { resultText: string; effects: Effects };
}

export interface EventTemplate {
  id: string;
  title: string;
  category: ActionCategory;
  day1Only?: boolean;
  fallback?: boolean;
  cooldownDays?: number;
  story?: boolean;
  characterId: string | null;
  petId: string | null;
  coach: string | null;
  when?: (state: GameState) => boolean;
  description: (state: GameState) => string;
  choices: ChoiceTemplate[];
}

export const DAY1_SCRIPT: { category: ActionCategory; templateId: string; hint: string }[] = [
  { category: 'customer', templateId: 'opening_welcome', hint: '开张日，先去接待来客。' },
  { category: 'care', templateId: 'meet_dahuang', hint: '开张日，去照顾小店，认识大黄。' },
  { category: 'neighborhood', templateId: 'florist_visit', hint: '开张日，到街坊走走，花店就在附近。' },
  { category: 'care', templateId: 'window_corner', hint: '开张日，再照顾一次小店，布置窗边。' },
  { category: 'customer', templateId: 'regular_appointment', hint: '开张日，接待来客里有一位老师。' },
];

function needCash(ctx: PrepCtx, amount: number): string | null {
  const cash = ctx.state.shop?.cash ?? 0;
  if (cash < amount) return `店铺金不够，还差 ${amount - cash}。可以改选别的办法。`;
  return null;
}

function needItem(ctx: PrepCtx, itemId: string, name: string): string | null {
  const day = ctx.state.calendar?.absoluteDay ?? 0;
  if (availableQty(ctx.state.inventory, itemId, day) < 1) return `${name}没有可使用的库存。可以改选别的办法。`;
  return null;
}

function needStaff(ctx: PrepCtx, employeeId: string, label: string): string | null {
  if (!onDuty(employeeId, ctx.state.actionIndex)) return `${label}这个时段不在店里，可以改选不需要当班员工的办法。`;
  return null;
}

function guest(
  id: string,
  affinity: number,
  extra: { preference?: string; lastPurchase?: string; taboo?: string } = {},
): Effects['customers'][number] {
  return {
    id,
    affinity,
    meet: true,
    lastPurchase: extra.lastPurchase ?? null,
    preference: extra.preference ?? null,
    taboo: extra.taboo ?? null,
    visits: 1,
  };
}

function pet(id: string, trust = 0, happiness = 0, energy = 0) {
  return { id, trust, happiness, energy };
}

const TEMPLATES: EventTemplate[] = [
  {
    id: 'opening_welcome',
    title: '开张接待',
    category: 'customer',
    day1Only: true,
    characterId: 'chen_jie',
    petId: 'dahuang',
    coach: '先看她需要什么，再选一个办法，然后看结果。',
    description: () =>
      '门铃被轻轻推开。街对面的陈姐抱着帆布袋，在门口停了一下。她看了看还很新的价目板，又看了看窗边打哈欠的大黄。阳光里有一点木头味。「新开的呀？我先看看，不一定买东西。」',
    choices: [
      {
        id: 'water',
        label: '请她进门喝口水，再慢慢讲今天的价目',
        preview: (ctx) => `茶水 ${quoteExpense(2, ctx.state.player?.personalityId ?? null)} · 让她愿意停留`,
        requires: (ctx) => needCash(ctx, quoteExpense(2, ctx.state.player?.personalityId ?? null)),
        resolve: () => ({
          resultText: '陈姐在柜台边把价目看完。她说家里的老猫今天没出来，下次也许会带一张照片给你看。',
          effects: fx({
            cashExpense: 2,
            popularity: 3,
            community: 2,
            visitors: 1,
            customers: [guest('chen_jie', 4)],
            note: '陈姐记住了这家店的门口。',
          }),
        }),
      },
      {
        id: 'offer',
        label: '说明基础梳理的价格，问她要不要',
        preview: (ctx) => `报价 ${quoteRevenue(35, ctx.state)} · 由她自己决定`,
        resolve: (ctx) => {
          const accept = ctx.roll() < 0.45;
          if (accept) {
            return {
              resultText: '她想了想，说那就给脖子上的毛简单顺一下。你讲完价格，等她点头，才拿出梳子。',
              effects: fx({
                revenue: 35,
                cashExpense: 8,
                orders: 1,
                popularity: 2,
                visitors: 1,
                customers: [guest('chen_jie', 4, { lastPurchase: '基础梳理' })],
              }),
            };
          }
          return {
            resultText: '她摇摇头，说今天先记下价格。你没有再往下说，把门边的位置让给她。',
            effects: fx({
              popularity: 1,
              visitors: 1,
              customers: [guest('chen_jie', 2)],
              note: '陈姐记下了价格，没有被催着买。',
            }),
          };
        },
      },
      {
        id: 'look',
        label: '请她只在窗边看一会儿大黄，不推销',
        preview: () => '不收费 · 店里保持安静',
        resolve: () => ({
          resultText: '大黄没有躲开阳光。陈姐把声音放轻，说这家店闻起来不像在催人买东西。',
          effects: fx({
            popularity: 1,
            community: 2,
            visitors: 1,
            goodService: true,
            pets: [pet('dahuang', 2, 1, 0)],
            customers: [guest('chen_jie', 3)],
            note: '大黄今天愿意在窗边被人远远看着。',
          }),
        }),
      },
    ],
  },
  {
    id: 'meet_dahuang',
    title: '认识大黄',
    category: 'care',
    day1Only: true,
    story: true,
    characterId: null,
    petId: 'dahuang',
    coach: null,
    description: () =>
      '护理角的阳光挪到窗台上。大黄把下巴搁在爪子上，尾巴只动了一下，没有过来。奶泡在软垫另一头假装睡觉。豆包的鼻子已经贴上纸袋，不过这件事等一下再管。',
    choices: [
      {
        id: 'sit',
        label: '在一米外坐下，让大黄自己决定靠不靠近',
        preview: () => '不消耗物品 · 信任慢慢增加',
        resolve: () => ({
          resultText: '你坐下以后没有伸手。过了一会儿，大黄的耳朵转向你，又转回去。今天这样就够了。',
          effects: fx({
            goodService: true,
            pets: [pet('dahuang', 8, 3, 0)],
            flags: ['dahuang_met'],
            note: '大黄允许你坐在阳光旁边。',
          }),
        }),
      },
      {
        id: 'snack',
        label: '把猫零食放在阳光边缘，自己退开',
        preview: () => '猫零食 1 · 适合慢热的猫',
        requires: (ctx) => needItem(ctx, 'snack_cat', '猫零食'),
        resolve: () => ({
          resultText: '零食放到阳光边上。你退开以后，大黄才慢慢把它拨到爪子前面，没有人盯着它吃。',
          effects: fx({
            stockCogs: 4,
            items: [{ itemId: 'snack_cat', delta: -1 }],
            pets: [pet('dahuang', 6, 2, 0)],
            flags: ['dahuang_met'],
            note: '大黄收下了放在远处的零食。',
          }),
        }),
      },
      {
        id: 'note',
        label: '记下它晒太阳的时间，今天不再靠近',
        preview: () => '不消耗物品 · 记住习惯',
        resolve: () => ({
          resultText: '你在手账上写下「上午的光停在窗台右边」。大黄继续晒它的太阳，尾巴终于松下来。',
          effects: fx({
            goodService: true,
            flags: ['dahuang_sun_time', 'dahuang_met'],
            pets: [pet('dahuang', 4, 2, 4)],
            note: '大黄晒太阳的时间被你记下了。',
          }),
        }),
      },
    ],
  },
  {
    id: 'florist_visit',
    title: '花店老板娘',
    category: 'neighborhood',
    day1Only: true,
    story: true,
    characterId: 'he_fang',
    petId: null,
    coach: null,
    description: () =>
      '你走到街角，花店老板娘何芳提着一小盆绿萝跟了出来。她先看了看你的鞋底干不干净。「我店里的小贵宾布丁有时会跟着过来。这盆如果放店里，得放在它碰不到的架子上。」',
    choices: [
      {
        id: 'talk',
        label: '把绿萝放到高处，请她讲讲布丁的习惯',
        preview: () => '不收费 · 开始记住布丁',
        resolve: () => ({
          resultText: '绿萝放到了布丁够不到的架子上。何芳又说，布丁怕剪刀声，来的时候如果能安静一点就好。',
          effects: fx({
            community: 4,
            visitors: 1,
            goodService: true,
            customers: [guest('he_fang', 6, { preference: '布丁不能碰到绿植，也怕剪刀声' })],
            flags: ['florist_met'],
            note: '何芳和布丁的习惯，写进了手账。',
          }),
        }),
      },
      {
        id: 'slot',
        label: '约一个安静时段，说明布丁来时不安排梳洗',
        preview: () => '只做约定 · 减少拥挤',
        resolve: () => ({
          resultText: '你们约了午后客人少的时候。何芳说，这样布丁就不用跟吹风机抢地方。',
          effects: fx({
            popularity: 1,
            community: 2,
            visitors: 1,
            flags: ['florist_quiet_slot', 'florist_met'],
            customers: [guest('he_fang', 4, { preference: '布丁适合安静时段' })],
          }),
        }),
      },
      {
        id: 'buy',
        label: '买一小束干燥花，装饰窗边',
        preview: () => '采购 18 · 窗边更温暖',
        requires: (ctx) => needCash(ctx, 18),
        resolve: () => ({
          resultText: '干燥花不需要浇水，也引不起布丁的兴趣。何芳帮你把花束扎松，免得掉屑。',
          effects: fx({
            purchases: 18,
            community: 3,
            visitors: 1,
            decor: 'dried_flowers',
            flags: ['florist_met'],
            customers: [guest('he_fang', 3)],
            note: '窗边多了一小束干燥花。',
          }),
        }),
      },
    ],
  },
  {
    id: 'window_corner',
    title: '窗边的位置',
    category: 'care',
    day1Only: true,
    characterId: 'su_tao',
    petId: 'naipao',
    coach: null,
    description: () =>
      '奶泡盯着窗台，又把头转开。那里只有一块折着的棉布。它没有过来求抱。美容师苏桃如果还在班，可以把护理角的东西分得更清楚。',
    choices: [
      {
        id: 'cushion',
        label: '买一块窗边软垫给奶泡',
        preview: () => '采购 40 · 给它一个自己的位置',
        requires: (ctx) => needCash(ctx, 40),
        resolve: () => ({
          resultText: '软垫放下以后，奶泡先闻了闻边角，然后把自己搁了上去。你没有抱它。',
          effects: fx({
            purchases: 40,
            decor: 'window_cushion',
            pets: [pet('naipao', 3, 8, 0)],
            note: '奶泡有了窗边的软垫。',
          }),
        }),
      },
      {
        id: 'cloth',
        label: '用现有棉布铺平，留出不被打扰的位置',
        preview: () => '不额外花钱 · 先让它愿意待着',
        resolve: () => ({
          resultText: '棉布铺平后，窗台边空出一块。奶泡没有马上躺下，但它也没有再走开。',
          effects: fx({
            goodService: true,
            pets: [pet('naipao', 3, 4, 0)],
            note: '窗边留出了奶泡的位置。',
          }),
        }),
      },
      {
        id: 'staff',
        label: '请苏桃把梳子和毛巾分开放好',
        preview: () => '需要美容师在岗 · 护理角更清楚',
        requires: (ctx) => needStaff(ctx, 'su_tao', '苏桃'),
        resolve: () => ({
          resultText: '苏桃把梳子、毛巾和棉布分成三格。她说，敏感的猫会先看你的手放在哪里。',
          effects: fx({
            flags: ['care_corner_ready'],
            pets: [pet('naipao', 1, 2, 0)],
            note: '护理角的东西分开了。',
          }),
        }),
      },
    ],
  },
  {
    id: 'regular_appointment',
    title: '第一位预约',
    category: 'customer',
    day1Only: true,
    characterId: 'liang',
    petId: 'doubao',
    coach: null,
    description: () =>
      '梁老师牵着柯基豆豆，在门口把灰抖干净。豆豆的短腿还沾着一点散步后的土，鼻子却已经朝店里的纸袋探。「想约修甲，但它刚走完，这会儿太兴奋。」',
    choices: [
      {
        id: 'deposit',
        label: '约到明天林序在岗的时段，先收订金',
        preview: () => '订金 20 · 今天不算完成服务',
        resolve: () => ({
          resultText: '你写下明天上午的修甲。订金先放着，指甲还没剪，所以不算进今天的营业额。',
          effects: fx({
            deposits: 20,
            visitors: 1,
            flags: ['nail_appointment'],
            pets: [pet('doubao', 1, 0, 0)],
            customers: [guest('liang', 5, { preference: '散步后不宜立刻修甲' })],
            note: '梁老师约了明天的修甲。',
          }),
        }),
      },
      {
        id: 'chat',
        label: '今天只聊聊散步习惯，不勉强修甲',
        preview: () => '不收费 · 记住豆豆刚散步完',
        resolve: () => ({
          resultText: '梁老师松了口气。豆豆把鼻子伸进纸袋又缩回来。你们约好，下一次先让它坐下喝水。',
          effects: fx({
            community: 2,
            visitors: 1,
            goodService: true,
            pets: [pet('doubao', 2, 1, 0)],
            customers: [guest('liang', 6, { preference: '散步后不宜立刻修甲' })],
            note: '豆豆的散步习惯被记下了。',
          }),
        }),
      },
      {
        id: 'comb',
        label: '卖出一把宠物梳，建议回家再顺毛',
        preview: (ctx) => `售价 ${quoteRevenue(15, ctx.state)} · 消耗梳子 1`,
        requires: (ctx) => needItem(ctx, 'comb', '宠物梳'),
        resolve: () => ({
          resultText: '梁老师付了梳子的钱。你提醒她回家再顺，不在豆豆还喘着的时候剪指甲。',
          effects: fx({
            revenue: 15,
            stockCogs: 6,
            orders: 1,
            visitors: 1,
            items: [{ itemId: 'comb', delta: -1 }],
            customers: [guest('liang', 3, { lastPurchase: '宠物梳', preference: '散步后不宜立刻修甲' })],
          }),
        }),
      },
    ],
  },
  {
    id: 'student_comb',
    title: '软一点的梳子',
    category: 'customer',
    cooldownDays: 3,
    characterId: 'aning',
    petId: null,
    coach: null,
    description: () =>
      '学生阿宁抱着书，在货架前停住。她看了看标价，又看了看自己的钱包。「有没有软一点的梳子？室友的猫不让用太硬的，我也不想买错。」',
    choices: [
      {
        id: 'sell',
        label: '卖给她一把软齿梳，价格照价目来',
        preview: (ctx) => `售价 ${quoteRevenue(15, ctx.state)} · 消耗梳子 1`,
        requires: (ctx) => needItem(ctx, 'comb', '宠物梳'),
        resolve: () => ({
          resultText: '阿宁把梳子在自己手背上试了试，点头付了钱。你告诉她，猫如果躲开，就先停下来。',
          effects: fx({
            revenue: 15,
            stockCogs: 6,
            orders: 1,
            visitors: 1,
            items: [{ itemId: 'comb', delta: -1 }],
            customers: [guest('aning', 3, { lastPurchase: '宠物梳' })],
          }),
        }),
      },
      {
        id: 'try',
        label: '让她先在自己手上试齿距，不急着卖',
        preview: () => '不收费 · 她可以空手离开',
        resolve: () => ({
          resultText: '阿宁试完齿距，说先回去问问室友。你把梳子放回原处，没有追出去。',
          effects: fx({
            community: 1,
            visitors: 1,
            goodService: true,
            customers: [guest('aning', 4, { preference: '想要软齿梳' })],
          }),
        }),
      },
      {
        id: 'wash',
        label: '说明基础洗护的价格，由她决定',
        preview: (ctx) => `报价 ${quoteRevenue(80, ctx.state)} · 她多半会再想想`,
        resolve: (ctx) => {
          const accept = ctx.roll() < 0.25;
          if (accept) {
            return {
              resultText: '她算了算这个月的零花，还是约了一次基础洗护。你把时间和价格又重复了一遍。',
              effects: fx({
                revenue: 80,
                cashExpense: 18,
                orders: 1,
                visitors: 1,
                customers: [guest('aning', 2, { lastPurchase: '基础洗护' })],
              }),
            };
          }
          return {
            resultText: '她听完价格，说今天只是问问梳子。你点点头，把价目留在她看得到的地方。',
            effects: fx({
              visitors: 1,
              customers: [guest('aning', 2)],
              note: '阿宁知道了价格，没有被留下。',
            }),
          };
        },
      },
    ],
  },
  {
    id: 'rainy_towel',
    title: '雨伞下面的黄油',
    category: 'customer',
    cooldownDays: 3,
    characterId: 'xu_aunt',
    petId: null,
    coach: null,
    when: (state) => state.calendar?.weather === 'rain' && !state.storyFlags.xu_towel_on_loan,
    description: () =>
      '门铃轻轻响了一声。许阿姨收起雨伞，黄油的爪子在门垫上留下四个湿印。她看了看墙上的价目表：「今天只是路过，能不能借条毛巾？我怕它一路湿着回家。」',
    choices: [
      {
        id: 'lend_here',
        label: '请她坐一会儿，借用店里的干净毛巾',
        preview: (ctx) => `耗材 ${quoteExpense(6, ctx.state.player?.personalityId ?? null)} · 增进街坊感情`,
        requires: (ctx) => needCash(ctx, quoteExpense(6, ctx.state.player?.personalityId ?? null)),
        resolve: () => ({
          resultText: '黄油安静地靠在阿姨脚边。她笑着说，下次来会带上洗好的小毛巾。',
          effects: fx({
            cashExpense: 6,
            community: 2,
            visitors: 1,
            goodService: true,
            customers: [guest('xu_aunt', 6)],
          }),
        }),
      },
      {
        id: 'offer_service',
        label: '说明基础整理的价格，询问是否需要',
        preview: (ctx) => `报价 ${quoteRevenue(30, ctx.state)} · 由她自己决定`,
        resolve: (ctx) => {
          const accept = ctx.roll() < 0.5;
          if (accept) {
            return {
              resultText: '你把服务内容和价格讲清楚。许阿姨看了看黄油的爪子，说那就简单整理一下。',
              effects: fx({
                revenue: 30,
                cashExpense: 8,
                orders: 1,
                visitors: 1,
                customers: [guest('xu_aunt', 4, { lastPurchase: '基础整理' })],
              }),
            };
          }
          return {
            resultText: '她慢慢听完，说今天只想把爪子擦干。你把毛巾递过去，没有再报价。',
            effects: fx({
              visitors: 1,
              customers: [guest('xu_aunt', 2)],
            }),
          };
        },
      },
      {
        id: 'lend_takeaway',
        label: '借一条可带走的毛巾，约定下次归还',
        preview: () => '暂时借出 1 条毛巾 · 等她下次送来',
        requires: (ctx) => needItem(ctx, 'towel', '毛巾'),
        resolve: () => ({
          resultText: '她仔细折好毛巾，说会在下次散步时送回来。黄油在门垫上又踩出两个浅印。',
          effects: fx({
            visitors: 1,
            items: [{ itemId: 'towel', delta: -1 }],
            flags: ['xu_towel_on_loan'],
            customers: [guest('xu_aunt', 5, { preference: '雨天需要毛巾' })],
            note: '一条毛巾借给了许阿姨。',
          }),
        }),
      },
    ],
  },
  {
    id: 'towel_return',
    title: '洗好的毛巾',
    category: 'customer',
    cooldownDays: 2,
    characterId: 'xu_aunt',
    petId: null,
    coach: null,
    when: (state) => !!state.storyFlags.xu_towel_on_loan,
    description: () =>
      '许阿姨把叠好的毛巾放在柜台上。黄油在门口抖了抖水，又自己停住。阿姨说，上次的约定她记着，所以今天专门绕过来。',
    choices: [
      {
        id: 'take',
        label: '收下毛巾，谢谢她专门跑一趟',
        preview: () => '毛巾回到库存 · 约定完成',
        resolve: () => ({
          resultText: '毛巾还带着肥皂的味道。你把它放回架子，并告诉她，以后雨天也可以只是来坐坐。',
          effects: fx({
            visitors: 1,
            community: 2,
            items: [{ itemId: 'towel', delta: 1 }],
            clearFlags: ['xu_towel_on_loan'],
            customers: [guest('xu_aunt', 4)],
            note: '借出的毛巾回来了。',
          }),
        }),
      },
      {
        id: 'sit',
        label: '请她坐一会儿，不收费',
        preview: () => '不收费 · 把毛巾也收回来',
        resolve: () => ({
          resultText: '黄油在门垫上躺了一小会儿。许阿姨说，这家店的门口不赶人。',
          effects: fx({
            visitors: 1,
            community: 2,
            goodService: true,
            items: [{ itemId: 'towel', delta: 1 }],
            clearFlags: ['xu_towel_on_loan'],
            customers: [guest('xu_aunt', 3)],
          }),
        }),
      },
      {
        id: 'later',
        label: '告诉她不急，下次带来也行',
        preview: () => '毛巾继续借着 · 少给她压力',
        resolve: () => ({
          resultText: '她把毛巾又抱回去，说那下次洗得更干一点再送来。你们没有把这件事变成亏欠。',
          effects: fx({
            visitors: 1,
            customers: [guest('xu_aunt', 2)],
          }),
        }),
      },
    ],
  },
  {
    id: 'quiet_water',
    title: '各自的水碗',
    category: 'care',
    cooldownDays: 2,
    characterId: null,
    petId: null,
    coach: null,
    description: () =>
      '员工已经加过一轮水。可窗台上的碗和门口的碗不该混用：大黄和奶泡在高处，豆包在自己的地面区域。今天只是把这件事再看清楚。',
    choices: [
      {
        id: 'split',
        label: '分开加水，不把它们叫到一起',
        preview: () => '不收费 · 各自留在原处',
        resolve: () => ({
          resultText: '你没有把三只唤到同一个碗前。水加好以后，店里还是原来的安静。',
          effects: fx({
            goodService: true,
            pets: [pet('dahuang', 1, 2, 2), pet('naipao', 1, 2, 2), pet('doubao', 1, 2, 2)],
            note: '三只宠物各自喝了自己的水。',
          }),
        }),
      },
      {
        id: 'sun',
        label: '只给大黄换窗边那一碗',
        preview: () => '不消耗库存 · 先照顾晒太阳的猫',
        resolve: () => ({
          resultText: '大黄等你的手离开，才低头喝水。另外两只没有被赶过来。',
          effects: fx({
            pets: [pet('dahuang', 2, 3, 1)],
          }),
        }),
      },
      {
        id: 'wipe',
        label: '用一点耗材把碗缘擦干',
        preview: (ctx) => `耗材 ${quoteExpense(6, ctx.state.player?.personalityId ?? null)} · 地面更干`,
        requires: (ctx) => needCash(ctx, quoteExpense(6, ctx.state.player?.personalityId ?? null)),
        resolve: () => ({
          resultText: '碗缘干了，豆包就不会把水甩到纸袋上。你把用过的布放进待洗的筐里。',
          effects: fx({
            cashExpense: 6,
            community: 1,
            pets: [pet('dahuang', 0, 1, 0), pet('naipao', 0, 1, 0), pet('doubao', 0, 2, 0)],
          }),
        }),
      },
    ],
  },
  {
    id: 'paper_bag',
    title: '豆包和纸袋',
    category: 'care',
    cooldownDays: 2,
    characterId: null,
    petId: 'doubao',
    coach: null,
    description: () =>
      '豆包叼着纸袋，在自己的地面区域转了一小圈，没有冲向窗台。它的短腿踩得很响，耳朵却是竖着的，像在等你给一个清楚的信号。',
    choices: [
      {
        id: 'play',
        label: '陪它在门口把纸袋铺开',
        preview: () => '不消耗物品 · 只在它的区域玩',
        resolve: () => ({
          resultText: '纸袋铺在门口。豆包拱了几下就趴下来，尾巴还在拍地板。你没有把它抱去窗边。',
          effects: fx({
            goodService: true,
            pets: [pet('doubao', 2, 4, -6)],
            note: '豆包在自己的区域玩完了纸袋。',
          }),
        }),
      },
      {
        id: 'rest',
        label: '把纸袋收进抽屉，让它先休息',
        preview: () => '不消耗物品 · 精力留到散步',
        resolve: () => ({
          resultText: '纸袋收好以后，豆包在垫子上转了两圈，终于把下巴放下。休息也是今天的安排。',
          effects: fx({
            pets: [pet('doubao', 1, 1, 6)],
          }),
        }),
      },
      {
        id: 'snack',
        label: '把狗零食放进它自己的碗',
        preview: () => '狗零食 1 · 不奖励扑人',
        requires: (ctx) => needItem(ctx, 'snack_dog', '狗零食'),
        resolve: () => ({
          resultText: '零食进了豆包自己的碗。它吃完没有扑上来，只是把空碗往你脚边推了推。',
          effects: fx({
            stockCogs: 5,
            items: [{ itemId: 'snack_dog', delta: -1 }],
            pets: [pet('doubao', 3, 2, -2)],
          }),
        }),
      },
    ],
  },
  {
    id: 'flower_walk',
    title: '花店门口',
    category: 'neighborhood',
    cooldownDays: 3,
    characterId: 'he_fang',
    petId: null,
    coach: null,
    description: () =>
      '何芳在花店门口修剪枯叶。布丁趴在她脚边的垫子上，没有跟着出门。她抬抬下巴，示意你看那盆放得很高的绿萝。',
    choices: [
      {
        id: 'ask',
        label: '问哪些植物不适合放在宠物碰得到的地方',
        preview: () => '不花钱 · 记住安全的摆法',
        resolve: () => ({
          resultText: '何芳说，拿不准的植物就放高，不放进它们的水碗附近。你把这句话记在手账边上。',
          effects: fx({
            community: 2,
            visitors: 1,
            goodService: true,
            customers: [guest('he_fang', 3, { preference: '植物要放在宠物碰不到的地方' })],
          }),
        }),
      },
      {
        id: 'later',
        label: '约好下次再检查窗边的摆法',
        preview: () => '只做约定 · 今天不采购',
        resolve: () => ({
          resultText: '你们约了下一次开店前看一眼窗台。布丁在垫子上打了个哈欠，没有被叫起来。',
          effects: fx({
            community: 2,
            visitors: 1,
            flags: ['flower_check'],
            customers: [guest('he_fang', 2)],
          }),
        }),
      },
      {
        id: 'buy',
        label: '再买一小束不掉屑的干花',
        preview: () => '采购 12 · 不换成会掉叶子的鲜切花',
        requires: (ctx) => needCash(ctx, 12),
        resolve: (ctx) => ({
          resultText: ctx.state.shop?.ownedDecor.includes('dried_flowers')
            ? '干花插进原来的瓶子里。何芳说，这个比鲜切花省心，也不会引布丁去啃。'
            : '你带回一小束干花。它不需要水，也不适合被布丁碰到。',
          effects: fx({
            purchases: 12,
            community: 2,
            visitors: 1,
            decor: 'dried_flowers',
            customers: [guest('he_fang', 2)],
          }),
        }),
      },
    ],
  },
  {
    id: 'clinic_board',
    title: '医院门口的公告',
    category: 'neighborhood',
    cooldownDays: 3,
    characterId: null,
    petId: null,
    coach: null,
    description: () =>
      '宠物医院门口的公告栏写着转诊时间。候诊的人安静地坐着，医生并没有在栏前等你。你只是来看合作方式，不替任何一只动物下判断。',
    choices: [
      {
        id: 'copy',
        label: '抄下转诊电话和接待时间',
        preview: () => '不收费 · 只记录联系方式',
        resolve: () => ({
          resultText: '你抄下电话和上午的接待时间。需要看诊的时候，交给医院，不在店里猜病因。',
          effects: fx({
            popularity: 1,
            community: 2,
            flags: ['clinic_note'],
            note: '医院的转诊时间记在手账里了。',
          }),
        }),
      },
      {
        id: 'sheet',
        label: '回店给观察记录多留一列空白',
        preview: () => '不消耗物品 · 方便以后交给医院',
        resolve: () => ({
          resultText: '记录表上多了一列「交给医院的观察」。林序以后可以填写，但仍然不写诊断。',
          effects: fx({
            community: 2,
            flags: ['record_sheet'],
            note: '转诊记录表准备好了。',
          }),
        }),
      },
      {
        id: 'leave',
        label: '看一眼就回店，不打扰候诊的人',
        preview: () => '不停留 · 医院保持安静',
        resolve: () => ({
          resultText: '你没有走进候诊区。回到店里时，门铃轻轻响了一下，三只宠物都在原来的位置。',
          effects: fx({
            community: 1,
            goodService: true,
          }),
        }),
      },
    ],
  },
  {
    id: 'florist_pace',
    title: '布丁怎么靠近',
    category: 'neighborhood',
    story: true,
    characterId: 'he_fang',
    petId: null,
    coach: null,
    when: (state) => !!state.storyFlags.florist_met && !state.storyFlags.florist_pace,
    description: () =>
      '何芳把布丁留在花店门口的阴凉处，没有牵进你的店。布丁先闻地砖，又在离你一只手臂的地方停下。「我想知道它愿不愿意跟你打招呼。它有时会躲开伸过去的手。」',
    choices: [
      {
        id: 'watch',
        label: '把手放下，看它自己决定要不要靠近',
        preview: () => '不伸手 · 记下它舒服的距离',
        resolve: () => ({
          resultText: '布丁绕到何芳脚边，又探出半步。你没有往前凑。何芳说，这个距离它今天是愿意的。',
          effects: fx({
            community: 3,
            visitors: 1,
            goodService: true,
            flags: ['florist_pace'],
            customers: [guest('he_fang', 5, { preference: '布丁自己决定要不要靠近' })],
            note: '布丁今天愿意停在一臂远的地方。',
          }),
        }),
      },
      {
        id: 'show',
        label: '请何芳示范她平时怎么跟布丁打招呼',
        preview: () => '跟着学 · 不替布丁做主',
        resolve: () => ({
          resultText: '何芳蹲下去，手心朝上，停在布丁胸口的高度。布丁把鼻子碰了碰她的手指。你只是看着，没有模仿第二次。',
          effects: fx({
            community: 2,
            visitors: 1,
            flags: ['florist_pace'],
            customers: [guest('he_fang', 4, { preference: '跟布丁打招呼时手心朝上' })],
          }),
        }),
      },
      {
        id: 'plan',
        label: '约下次带软球，说明练习不用食物',
        preview: () => '只做约定 · 零食不拿来当道具',
        resolve: () => ({
          resultText: '何芳点头。她说布丁对食物太认真，练习时看见零食就会忘了自己在做什么。软球可以，饼干不行。',
          effects: fx({
            community: 2,
            visitors: 1,
            flags: ['florist_pace'],
            customers: [guest('he_fang', 4, { preference: '布丁的练习不用食物', taboo: '练习时不给零食' })],
            note: '和布丁练习时，不把食物当道具。',
          }),
        }),
      },
    ],
  },
  {
    id: 'florist_practice',
    title: '软球，不是零食',
    category: 'neighborhood',
    story: true,
    characterId: 'he_fang',
    petId: null,
    coach: null,
    when: (state) => !!state.storyFlags.florist_pace && !state.storyFlags.florist_practice,
    description: () =>
      '花店门口铺了一小块空地。何芳把布丁的牵引绳放得很松。「上次说好了，练习不用吃的。你店里如果有软球，可以滚在地上；没有的话，我们换一种不消耗东西的办法。」',
    choices: [
      {
        id: 'roll',
        label: '把软球轻轻滚到它面前，不朝脸上丢',
        preview: () => '消耗软球 1 · 球只在地面上',
        requires: (ctx) => needItem(ctx, 'toy', '软球'),
        resolve: () => ({
          resultText: '球滚到布丁鼻子前面，又慢慢停住。它用爪子拨了一下，没有扑上来。何芳把球捡回去，说这样的速度刚刚好。',
          effects: fx({
            community: 3,
            visitors: 1,
            goodService: true,
            stockCogs: 10,
            items: [{ itemId: 'toy', delta: -1 }],
            flags: ['florist_practice'],
            customers: [guest('he_fang', 5)],
            note: '布丁愿意玩地面上的软球。',
          }),
        }),
      },
      {
        id: 'note',
        label: '今天不拿道具，只把何芳的步骤记下来',
        preview: () => '不消耗物品 · 先把步骤写清楚',
        resolve: () => ({
          resultText: '你写下三步：手放下，球在地面，停下来等。布丁全程坐在何芳旁边，没有被要求表演。',
          effects: fx({
            community: 2,
            visitors: 1,
            flags: ['florist_practice'],
            customers: [guest('he_fang', 4, { preference: '练习时球只放在地面' })],
          }),
        }),
      },
      {
        id: 'later',
        label: '改到店里安静的角落，今天先不练习',
        preview: () => '只改时间 · 花店门口人来人往',
        resolve: () => ({
          resultText: '门口有人买花，布丁的耳朵竖了一下。你们把练习改到午后的店里。今天它只是闻了闻空气，然后回家。',
          effects: fx({
            community: 2,
            visitors: 1,
            flags: ['florist_practice', 'florist_quiet_slot'],
            customers: [guest('he_fang', 3, { preference: '布丁适合安静时段' })],
          }),
        }),
      },
    ],
  },
  {
    id: 'florist_photo',
    title: '花店门口的一张照片',
    category: 'neighborhood',
    story: true,
    characterId: 'he_fang',
    petId: null,
    coach: null,
    when: (state) => !!state.storyFlags.florist_practice && !state.storyFlags.florist_photo,
    description: () =>
      '何芳把花桶往旁边挪了挪，给布丁留出一块不挡门的地面。「如果它自己站好，可以拍一张。它要是走开，这张照片就改天再来，不追着拍。」',
    choices: [
      {
        id: 'wait',
        label: '等布丁自己站定，再拍这一张',
        preview: () => '不追着拍 · 拍到就留在手账',
        resolve: () => ({
          resultText: '布丁在花桶阴影里站了几秒。你拍下它和何芳的鞋尖，没有叫它看镜头。照片洗出来之前，先记在今天的手账里。',
          effects: fx({
            community: 4,
            popularity: 1,
            visitors: 1,
            goodService: true,
            flags: ['florist_photo'],
            customers: [guest('he_fang', 5)],
            note: '花店门口留下了布丁自己站好的一张。',
          }),
        }),
      },
      {
        id: 'write',
        label: '今天不拍照，把习惯写进手账',
        preview: () => '不拍 · 文字也算记住',
        resolve: () => ({
          resultText: '你写下：布丁喜欢阴凉，不喜欢镜头凑近。何芳说这样也很好，照片可以等它下一次自己站好。',
          effects: fx({
            community: 2,
            visitors: 1,
            flags: ['florist_photo'],
            customers: [guest('he_fang', 4, { preference: '布丁不喜欢镜头凑近' })],
          }),
        }),
      },
      {
        id: 'shop',
        label: '约到宠物店窗边，用自然光再试一次',
        preview: () => '改地点 · 今天先不按快门',
        resolve: () => ({
          resultText: '窗边的光比较稳。你们约了布丁愿意出门的下一回。今天的花店门口，只是让它闻完花香再回家。',
          effects: fx({
            community: 2,
            visitors: 1,
            flags: ['florist_photo'],
            customers: [guest('he_fang', 3)],
            note: '合影改到窗边的自然光里。',
          }),
        }),
      },
    ],
  },
  {
    id: 'florist_stand',
    title: '够不到的花架',
    category: 'neighborhood',
    story: true,
    characterId: 'he_fang',
    petId: null,
    coach: null,
    when: (state) => !!state.storyFlags.florist_photo && !state.storyFlags.florist_stand,
    description: () =>
      '何芳抱着一个不高的木花架，在你门口停住。架子上只有干燥花，没有布丁能扯到的叶子。「这是谢谢你这几天按它的节奏来。你可以收下，也可以让它继续留在花店。」',
    choices: [
      {
        id: 'accept',
        label: '收下花架，放在门口布丁够不到的一侧',
        preview: () => '不另外付钱 · 得到花架和一枚印章',
        resolve: () => ({
          resultText: '花架靠在门边，高度刚好超过布丁抬起的头。何芳说干燥花不会招它。你在手账里贴上一枚温暖印章。',
          effects: fx({
            community: 4,
            visitors: 1,
            goodService: true,
            decor: 'flower_stand',
            stamps: 1,
            flags: ['florist_stand'],
            customers: [guest('he_fang', 6)],
            note: '门口多了何芳送来的花架。',
          }),
        }),
      },
      {
        id: 'leave',
        label: '请她把花架留在花店，店里只记一句感谢',
        preview: () => '不搬东西 · 仍然得到印章',
        resolve: () => ({
          resultText: '花架回到花店的柜台边。何芳把一句谢谢写在卡片上，你收进手账，并盖了一枚温暖印章。店里的地面还是原来的样子。',
          effects: fx({
            community: 3,
            visitors: 1,
            stamps: 1,
            flags: ['florist_stand'],
            customers: [guest('he_fang', 5)],
            note: '花架留在花店，感谢记在手账里。',
          }),
        }),
      },
      {
        id: 'pay',
        label: '按花架的价钱付给她，再放到门口',
        preview: () => '采购 60 · 不当成白拿的礼物',
        requires: (ctx) => needCash(ctx, 60),
        resolve: () => ({
          resultText: '你按她报的价钱付了花架。何芳还是把那枚印章按在你的手账上，说钱是花架的，印章是这几天的事。',
          effects: fx({
            purchases: 60,
            community: 3,
            visitors: 1,
            decor: 'flower_stand',
            stamps: 1,
            flags: ['florist_stand'],
            customers: [guest('he_fang', 4)],
            note: '花架按价钱买下，印章另外记下。',
          }),
        }),
      },
    ],
  },
  {
    id: 'new_cat_snack',
    title: '团子能不能吃这个',
    category: 'customer',
    cooldownDays: 3,
    characterId: 'zhou_wan',
    petId: null,
    coach: null,
    description: () =>
      '周晚下班后来，包上还别着工牌。她没有把猫带来。「团子才到家一周。同事给了一包人吃的小点心，我不确定能不能分给它。你们的猫零食，和那个不是一类吧？」',
    choices: [
      {
        id: 'snack',
        label: '卖一包猫零食，说明这是给猫的',
        preview: (ctx) => `售价 ${quoteRevenue(12, ctx.state)} · 消耗猫零食 1`,
        requires: (ctx) => needItem(ctx, 'snack_cat', '猫零食'),
        resolve: () => ({
          resultText: '周晚看了包装上的适用对象，付了钱。你请她把同事的点心留在自己的桌上，不要混进猫碗。',
          effects: fx({
            revenue: 12,
            stockCogs: 4,
            orders: 1,
            visitors: 1,
            items: [{ itemId: 'snack_cat', delta: -1 }],
            customers: [guest('zhou_wan', 4, { lastPurchase: '猫零食', taboo: '团子不吃人类点心' })],
          }),
        }),
      },
      {
        id: 'no',
        label: '请她不要分人吃的点心，今天先不卖',
        preview: () => '不成交 · 把禁忌写下来',
        resolve: () => ({
          resultText: '周晚把那包点心放回自己包里。你在她的档案上写下：团子不吃人类点心。她说回家就换猫碗里原来的粮。',
          effects: fx({
            community: 2,
            visitors: 1,
            goodService: true,
            customers: [guest('zhou_wan', 5, { taboo: '团子不吃人类点心', preference: '只给猫的食物' })],
            note: '团子的碗里，不放人类点心。',
          }),
        }),
      },
      {
        id: 'later',
        label: '约她下次带团子来熟悉门口，今天不护理',
        preview: () => '只预约 · 不在店里做护理',
        resolve: () => ({
          resultText: '你们约了人少的下午。周晚问要不要先做身体检查，你说店里不诊断，真要看身体就去旁边的合作医院。',
          effects: fx({
            popularity: 1,
            visitors: 1,
            flags: ['tuanzi_visit'],
            customers: [guest('zhou_wan', 3, { preference: '团子第一次来只熟悉门口' })],
          }),
        }),
      },
    ],
  },
  {
    id: 'leash_pause',
    title: '牵引绳先别收太短',
    category: 'customer',
    cooldownDays: 3,
    characterId: 'liang',
    petId: 'doubao',
    coach: null,
    when: (state) => !!state.customers.liang?.met,
    description: () =>
      '梁老师在门口把豆豆的牵引绳放松了一点。豆豆的鼻子已经朝纸袋过去，脚还停在垫子外面。「散步的最后一段它总要闻。我想买一条备用的，但今天先不修甲。」',
    choices: [
      {
        id: 'sell',
        label: '卖一条牵引绳，提醒回家再慢慢换',
        preview: (ctx) => `售价 ${quoteRevenue(28, ctx.state)} · 消耗牵引绳 1`,
        requires: (ctx) => needItem(ctx, 'leash', '牵引绳'),
        resolve: () => ({
          resultText: '梁老师付了牵引绳的钱，没有在门口立刻给豆豆换上。豆豆把新绳子闻了一遍，然后继续看纸袋。',
          effects: fx({
            revenue: 28,
            stockCogs: 12,
            orders: 1,
            visitors: 1,
            items: [{ itemId: 'leash', delta: -1 }],
            customers: [guest('liang', 3, { lastPurchase: '牵引绳' })],
          }),
        }),
      },
      {
        id: 'wait',
        label: '先让豆豆把这趟散步闻完，不推销',
        preview: () => '不收费 · 记住它需要这段停顿',
        resolve: () => ({
          resultText: '豆豆在门口多停了一分钟。梁老师说，这段停顿比新绳子重要。你没有把备用绳拿到它眼前。',
          effects: fx({
            community: 2,
            visitors: 1,
            goodService: true,
            pets: [pet('doubao', 1, 1, 0)],
            customers: [guest('liang', 5, { preference: '散步最后要留一段闻味道的时间' })],
          }),
        }),
      },
      {
        id: 'water',
        label: '接一碗水，把修甲继续留到它喘匀以后',
        preview: () => '不消耗库存 · 今天不做修甲',
        resolve: () => ({
          resultText: '豆豆喝了几口，坐下来。指甲还是没剪。梁老师把下一次的时间留在人少、它也不再喘气的时候。',
          effects: fx({
            visitors: 1,
            goodService: true,
            pets: [pet('doubao', 1, 2, 0)],
            customers: [guest('liang', 4, { preference: '散步后不宜立刻修甲' })],
            note: '豆豆的修甲还留在喘匀以后。',
          }),
        }),
      },
    ],
  },
  {
    id: 'litter_bag',
    title: '猫砂要哪一种',
    category: 'customer',
    cooldownDays: 3,
    characterId: 'zhou_wan',
    petId: null,
    coach: null,
    description: () =>
      '周晚拎着空袋子进来，看了看货架最下面一层。「团子的猫砂快没了。我不知道该买细的还是结团的，只知道它会把砂刨到垫子外面。」',
    choices: [
      {
        id: 'sell',
        label: '卖一袋店里在用的猫砂，说明只适合猫',
        preview: (ctx) => `售价 ${quoteRevenue(18, ctx.state)} · 消耗猫砂 1`,
        requires: (ctx) => needItem(ctx, 'litter', '猫砂'),
        resolve: () => ({
          resultText: '周晚确认袋子上写的是猫砂，付了钱。你提醒她别和狗用的垫子混放，团子刨出来的砂扫掉就好。',
          effects: fx({
            revenue: 18,
            stockCogs: 6,
            orders: 1,
            visitors: 1,
            items: [{ itemId: 'litter', delta: -1 }],
            customers: [guest('zhou_wan', 3, { lastPurchase: '猫砂', preference: '团子用猫砂，不和别的垫子混' })],
          }),
        }),
      },
      {
        id: 'ask',
        label: '先问家里的猫砂盆放在哪里，今天不卖',
        preview: () => '不成交 · 确认她已经有猫砂盆',
        resolve: () => ({
          resultText: '猫砂盆在卫生间角落，远离团子的饭碗。你说位置可以，砂等她看完两种手感再买，不用今天决定。',
          effects: fx({
            community: 1,
            visitors: 1,
            goodService: true,
            customers: [guest('zhou_wan', 4, { preference: '猫砂盆远离饭碗' })],
          }),
        }),
      },
      {
        id: 'sweep',
        label: '教她把刨出来的砂扫回盆里，不追加用品',
        preview: () => '不卖清洁工具 · 先用家里的扫帚',
        resolve: () => ({
          resultText: '周晚说明天就用家里的扫帚。你没有再推荐除味喷雾。团子刨砂是正常的，垫子脏了洗一洗就行。',
          effects: fx({
            visitors: 1,
            customers: [guest('zhou_wan', 3, { preference: '刨出的猫砂扫回去就好' })],
          }),
        }),
      },
    ],
  },
  {
    id: 'night_seat',
    title: '夜班之后的十分钟',
    category: 'customer',
    cooldownDays: 3,
    characterId: 'xiao_qiao',
    petId: null,
    coach: null,
    description: () =>
      '小乔还穿着浅色外套，在门口把步子放慢。她看了看价目，又看了看空着的椅子。「我刚下夜班，没有带宠物。可以坐十分钟吗？今天什么都不想买。」',
    choices: [
      {
        id: 'sit',
        label: '请她坐，不介绍商品',
        preview: () => '不收费 · 椅子可以只是椅子',
        resolve: () => ({
          resultText: '小乔坐了不到十分钟，看大黄在窗台上换姿势。离开时她说，知道这里可以什么都不买。',
          effects: fx({
            community: 2,
            visitors: 1,
            goodService: true,
            customers: [guest('xiao_qiao', 5, { preference: '夜班后只想坐一会儿' })],
            note: '小乔知道这把椅子不必消费。',
          }),
        }),
      },
      {
        id: 'towel',
        label: '递一条干净毛巾给她擦手，不收钱',
        preview: () => '消耗毛巾 1 · 不算一笔订单',
        requires: (ctx) => needItem(ctx, 'towel', '毛巾'),
        resolve: () => ({
          resultText: '小乔擦完手，把毛巾叠好放回筐边。你说这条算店里的接待，不记进她的消费。',
          effects: fx({
            visitors: 1,
            items: [{ itemId: 'towel', delta: -1 }],
            cashExpense: 6,
            customers: [guest('xiao_qiao', 4, { preference: '夜班后只想坐一会儿' })],
          }),
        }),
      },
      {
        id: 'close',
        label: '告诉她快关门了，请她改到明天白天',
        preview: () => '不接待久坐 · 员工也要下班',
        resolve: () => ({
          resultText: '小乔点点头，没有不高兴。她说明天如果醒得早，会在白天再来看一眼价目。今晚店门可以按时关。',
          effects: fx({
            visitors: 1,
            customers: [guest('xiao_qiao', 2)],
          }),
        }),
      },
    ],
  },
  {
    id: 'turtle_shelf',
    title: '慢吞吞不吃狗粮',
    category: 'neighborhood',
    cooldownDays: 3,
    characterId: 'zhao_ye',
    petId: null,
    coach: null,
    description: () =>
      '赵爷爷在货架前停住，眼镜往下压了压。「隔壁说宠物店什么粮食都有。我家是乌龟，叫慢吞吞。狗粮、猫零食，它是不是都能吃一点？」',
    choices: [
      {
        id: 'no',
        label: '说明狗粮和猫零食都不给龟，今天不卖',
        preview: () => '不成交 · 不把别的口粮混进去',
        resolve: () => ({
          resultText: '赵爷爷把伸向狗粮的手收回来。你说慢吞吞的食物按龟来准备，不从猫狗的袋子里分。他说明天去问熟悉龟的人。',
          effects: fx({
            community: 2,
            visitors: 1,
            goodService: true,
            customers: [guest('zhao_ye', 5, { taboo: '慢吞吞不吃猫狗的粮食' })],
            note: '慢吞吞的口粮，不从猫狗袋子里分。',
          }),
        }),
      },
      {
        id: 'quiet',
        label: '请他讲讲慢吞吞平时待在哪里',
        preview: () => '只听 · 不推荐用品',
        resolve: () => ({
          resultText: '慢吞吞住在安静的角落，不跟店里的猫狗见面。赵爷爷说它最怕忽然的响动。你没有拿任何商品到他手里。',
          effects: fx({
            community: 2,
            visitors: 1,
            customers: [guest('zhao_ye', 4, { preference: '慢吞吞需要安静的角落' })],
          }),
        }),
      },
      {
        id: 'paper',
        label: '如果他想给角落添一个纸屋，先讲清楚不是龟的必需品',
        preview: (ctx) => `售价 ${quoteRevenue(24, ctx.state)} · 消耗纸屋 1 · 他可以不买`,
        requires: (ctx) => needItem(ctx, 'paper_house', '纸屋'),
        resolve: (ctx) => {
          const accept = ctx.roll() < 0.4;
          if (!accept) {
            return {
              resultText: '赵爷爷看了看纸屋，说慢吞吞已经有自己的壳和角落。你把纸屋放回货架，没有再劝。',
              effects: fx({
                visitors: 1,
                customers: [guest('zhao_ye', 3, { preference: '慢吞吞不需要额外的纸屋' })],
              }),
            };
          }
          return {
            resultText: '赵爷爷决定买一个纸屋，放在慢吞吞的角落旁边，不放进它的食盆。你又说了一遍：这不是龟粮。',
            effects: fx({
              revenue: 24,
              stockCogs: 16,
              orders: 1,
              visitors: 1,
              items: [{ itemId: 'paper_house', delta: -1 }],
              customers: [guest('zhao_ye', 3, { lastPurchase: '纸屋', taboo: '慢吞吞不吃猫狗的粮食' })],
            }),
          };
        },
      },
    ],
  },
  {
    id: 'community_board',
    title: '公告栏的一角',
    category: 'neighborhood',
    cooldownDays: 3,
    characterId: 'lin_yi',
    petId: null,
    coach: null,
    description: () =>
      '林姨抱着一叠社区公告，在你的橱窗边找空位。「寻猫启示和义诊时间，能不能贴一小角？不要挡住价目，也不要做成闪来闪去的广告。」',
    choices: [
      {
        id: 'corner',
        label: '把公告贴在价目板旁边的空白处',
        preview: () => '不收费 · 价目仍然看得清',
        resolve: () => ({
          resultText: '寻猫启示贴在空白处，价目上的字没有被盖住。林姨说找到了会来撕掉，不会一直占着。',
          effects: fx({
            community: 3,
            visitors: 1,
            goodService: true,
            flags: ['community_board'],
            customers: [guest('lin_yi', 5)],
            note: '橱窗空白处贴上了社区公告。',
          }),
        }),
      },
      {
        id: 'read',
        label: '先把寻猫启示读完，再决定贴哪里',
        preview: () => '不立刻张贴 · 确认不是推销',
        resolve: () => ({
          resultText: '启示上只有时间和联系人。你把它贴到门内员工看得到的地方，橱窗仍留给价目和外面的光。',
          effects: fx({
            community: 2,
            visitors: 1,
            customers: [guest('lin_yi', 4, { preference: '公告不挡住价目' })],
          }),
        }),
      },
      {
        id: 'later',
        label: '请她留一张，等你整理完橱窗再贴',
        preview: () => '今天不改橱窗 · 公告先收好',
        resolve: () => ({
          resultText: '林姨留下一张寻猫启示。你夹进手账，没有在营业时挪动价目板。她说明天可以再来看位置。',
          effects: fx({
            community: 1,
            visitors: 1,
            customers: [guest('lin_yi', 3)],
          }),
        }),
      },
    ],
  },
  {
    id: 'rain_paws',
    title: '门口的四个湿印',
    category: 'care',
    cooldownDays: 3,
    characterId: null,
    petId: 'doubao',
    coach: null,
    when: (state) => state.calendar?.weather === 'rain',
    description: () =>
      '雨不大，豆包还是把四个湿印留在门垫上。它没有往外冲，只是看着自己的爪子。毛巾架就在手边，主粮碗也还是干的。',
    choices: [
      {
        id: 'towel',
        label: '用一条毛巾把爪子擦干，再让它回垫子',
        preview: () => '消耗毛巾 1 · 不把豆包赶去雨里',
        requires: (ctx) => needItem(ctx, 'towel', '毛巾'),
        resolve: () => ({
          resultText: '湿印淡了。豆包在干的地方转了一圈，没有再往门口挤。你把毛巾挂开，不和食物放在一起。',
          effects: fx({
            goodService: true,
            items: [{ itemId: 'towel', delta: -1 }],
            cashExpense: 6,
            pets: [pet('doubao', 1, 3, 0)],
            note: '豆包的爪子擦干了。',
          }),
        }),
      },
      {
        id: 'mat',
        label: '把脚垫挪正，等它自己把水踩干',
        preview: () => '不消耗毛巾 · 给它留时间',
        resolve: () => ({
          resultText: '脚垫铺平以后，豆包在上面站了一会儿。水迹没有扩大。你没有拿零食去叫它。',
          effects: fx({
            pets: [pet('doubao', 1, 2, 0)],
            note: '门口的脚垫刚好接住湿脚印。',
          }),
        }),
      },
      {
        id: 'food',
        label: '确认狗主粮还没过期，雨天也不改食谱',
        preview: () => '不额外加餐 · 只检查库存',
        requires: (ctx) => needItem(ctx, 'food_dog', '狗主粮'),
        resolve: () => ({
          resultText: '狗主粮还在保质期内。你没有因为下雨就多倒一勺，也没有把猫主粮混进去。豆包的碗保持原来的量。',
          effects: fx({
            pets: [pet('doubao', 0, 1, 0)],
            note: '雨天的口粮还是原来的那一种。',
          }),
        }),
      },
    ],
  },
  {
    id: 'shelf_count',
    title: '把货架数清楚',
    category: 'care',
    cooldownDays: 3,
    characterId: null,
    petId: 'naipao',
    coach: null,
    description: (state) => {
      const food = state.inventory.find((batch) => batch.itemId === 'food_cat');
      const hint = food ? '猫主粮还在架子上。' : '猫主粮的位置空着。';
      return `关门前的空档，林序如果在，可以一起看货架；不在也没关系。${hint}奶泡只是在自己的位置上，没有来翻袋子。食品和玩具分开放着。`;
    },
    choices: [
      {
        id: 'split',
        label: '把食品和软球分到两层，避免混在一起',
        preview: () => '不花钱 · 玩具不进食物',
        resolve: () => ({
          resultText: '软球拿到上面一层，主粮留在下面。奶泡看了一眼，没有跳上货架。你确认没有玩具掉进任何一个食盆。',
          effects: fx({
            goodService: true,
            flags: ['shelf_sorted'],
            pets: [pet('naipao', 1, 1, 0)],
            note: '食品和玩具分开了。',
          }),
        }),
      },
      {
        id: 'date',
        label: '看一遍食品的日期，过期的先拿开',
        preview: () => '不出售过期食品 · 今天只是检查',
        resolve: () => ({
          resultText: '日期还清楚的留在原处。哪怕有一袋接近到期，你也把它转到前面，而不是混进新的里面继续卖。',
          effects: fx({
            community: 1,
            note: '食品日期又看过一遍。',
          }),
        }),
      },
      {
        id: 'staff',
        label: '请林序把今天的喂食记到照护栏',
        preview: () => '需要护理员在岗 · 只记喂食，不写诊断',
        requires: (ctx) => needStaff(ctx, 'lin_xu', '林序'),
        resolve: () => ({
          resultText: '林序写下猫和狗的口粮都按原来的分量。备注栏是空的。他说没有看见需要交给医院的情况。',
          effects: fx({
            flags: ['feeding_logged'],
            pets: [pet('naipao', 0, 1, 0), pet('dahuang', 0, 1, 0)],
          }),
        }),
      },
    ],
  },
  ...LATER_TEMPLATES,
  {
    id: 'fallback_customer',
    title: '看完价目的客人',
    category: 'customer',
    fallback: true,
    cooldownDays: 0,
    characterId: null,
    petId: 'dahuang',
    coach: null,
    description: (state) =>
      state.calendar?.weather === 'rain'
        ? '雨天的门铃响得更轻。一位客人看完价目，在门垫上把鞋底蹭干，说今天先不买。'
        : '一位客人把价目板看完，点了点头。店里没有人催他，大黄也只是在窗台上换了个姿势。',
    choices: [
      {
        id: 'bye',
        label: '微笑送别，告诉他下次也可以只是看看',
        preview: () => '不收费 · 人气慢慢积累',
        resolve: () => ({
          resultText: '客人把伞或袋子换到另一只手，说知道这家店在。你没有追问他养的是什么。',
          effects: fx({ popularity: 1, visitors: 1 }),
        }),
      },
      {
        id: 'wipe',
        label: '等他离开后，把价目板擦干净',
        preview: () => '不消耗行动以外的东西',
        resolve: () => ({
          resultText: '价目板上的字又清楚了。基础梳理、洗护和修甲都还写在原来的位置。',
          effects: fx({ community: 1, visitors: 1 }),
        }),
      },
      {
        id: 'quiet',
        label: '记住今天不必追加推销',
        preview: () => '不收费 · 算一次稳妥的接待',
        resolve: () => ({
          resultText: '客人走了以后，店里恢复原来的声音：爪子、纸袋，还有窗外的风。',
          effects: fx({ popularity: 1, visitors: 1, goodService: true }),
        }),
      },
    ],
  },
  {
    id: 'fallback_care',
    title: '看一圈就好',
    category: 'care',
    fallback: true,
    cooldownDays: 0,
    characterId: null,
    petId: null,
    coach: null,
    description: () =>
      '喂食和清洁已经由当班的人做完。你要做的只是看一圈：窗台、软垫、门口，三只都在自己的区域里。',
    choices: [
      {
        id: 'look',
        label: '远远看过三只的水和休息',
        preview: () => '不打扰 · 确认今天过得去',
        resolve: () => ({
          resultText: '水是满的，垫子也是干的。没有谁被叫到别人的区域里。',
          effects: fx({
            goodService: true,
            pets: [pet('dahuang', 0, 1, 0), pet('naipao', 0, 1, 0), pet('doubao', 0, 1, 0)],
          }),
        }),
      },
      {
        id: 'mat',
        label: '把门口的垫子拍松',
        preview: () => '不花钱 · 豆包的地面更舒服',
        resolve: () => ({
          resultText: '垫子拍松以后，豆包立刻踩上去试了试。窗台上的两只猫没有下来。',
          effects: fx({ pets: [pet('doubao', 1, 2, 0)] }),
        }),
      },
      {
        id: 'self',
        label: '给自己也倒杯水，再回到柜台',
        preview: () => '不消耗库存 · 店主也要歇一下',
        resolve: () => ({
          resultText: '你在柜台后站了一会儿。员工继续做手里的事，没有人被突然支使。',
          effects: fx({ community: 1 }),
        }),
      },
    ],
  },
  {
    id: 'fallback_neighborhood',
    title: '门口站一分钟',
    category: 'neighborhood',
    fallback: true,
    cooldownDays: 0,
    characterId: null,
    petId: null,
    coach: null,
    description: (state) => {
      const weather = state.calendar?.weather === 'rain' ? '屋檐上的雨不大。' : '街上的声音不急。';
      return `${weather}你在自己的门口站了一分钟，没有把店门大开着等人，也没有跑去很远的地方。`;
    },
    choices: [
      {
        id: 'nod',
        label: '跟路过的人点个头',
        preview: () => '不推销 · 让这条街认得你',
        resolve: () => ({
          resultText: '有人点头回你。没有人被拉进店里，羁绊也只是多了一点点。',
          effects: fx({ community: 1 }),
        }),
      },
      {
        id: 'weather',
        label: '看一眼天气，决定今天不跑远',
        preview: () => '不消耗物品 · 店里有人看着',
        resolve: () => ({
          resultText: '你确认员工还在班，就回到柜台。远一点的社区活动，以后再走。',
          effects: fx({ community: 1, popularity: 1 }),
        }),
      },
      {
        id: 'lamp',
        label: '看一眼门外的灯，确认晚上还能亮',
        preview: () => '不花钱 · 灯可以在设置里保留',
        resolve: () => ({
          resultText: '灯是普通的暖光。你记下它能亮到关门，不用谁一直站在门外招客。',
          effects: fx({ community: 1, flags: ['warm_light_seen'] }),
        }),
      },
    ],
  },
];

const TEMPLATE_MAP: Record<string, EventTemplate> = Object.fromEntries(TEMPLATES.map((item) => [item.id, item]));

export function listTemplates(): EventTemplate[] {
  return TEMPLATES;
}

export function getTemplate(id: string): EventTemplate | null {
  return TEMPLATE_MAP[id] ?? null;
}

export const FLORIST_STEPS = [
  { id: 'florist_met', title: '初识' },
  { id: 'florist_pace', title: '确认适合的互动' },
  { id: 'florist_practice', title: '安全的替代道具' },
  { id: 'florist_photo', title: '花店合影' },
  { id: 'florist_stand', title: '送来花架' },
] as const;

export const DAHUANG_STEPS = [
  { id: 'dahuang_met', title: '不愿靠近' },
  { id: 'sun_quiet', title: '留出安静位置' },
  { id: 'sun_clock', title: '记住晒太阳的时间' },
  { id: 'sun_nuzzle', title: '第一次主动靠近' },
  { id: 'sun_plate', title: '门口的名牌' },
] as const;

export const WUYUN_STEPS = [
  { id: 'cloud_meet', title: '认识救助人' },
  { id: 'cloud_match', title: '确认适合的家' },
  { id: 'cloud_prepare', title: '准备物品' },
  { id: 'cloud_handoff', title: '领养交接' },
  { id: 'cloud_photo', title: '收到回访照片' },
] as const;

export function pickTemplateId(state: GameState, category: ActionCategory): { id: string; rngState: number } {
  const day = state.calendar?.absoluteDay ?? 0;
  const storyPlayedToday = state.recentUses.some((item) => {
    const template = TEMPLATE_MAP[item.id];
    return item.day === day && !!template?.story && template.category === category;
  });
  if (!storyPlayedToday) {
    const story = TEMPLATES.find((template) => template.story && !template.day1Only && template.category === category && (!template.when || template.when(state)));
    if (story) return { id: story.id, rngState: state.rngState };
  }
  const specific = TEMPLATES.filter((template) => {
    if (template.category !== category || template.day1Only || template.fallback || template.story) return false;
    if (template.when && !template.when(state)) return false;
    const cooldown = template.cooldownDays ?? 3;
    const used = state.recentUses.find((item) => item.id === template.id);
    if (used && cooldown > 0 && day - used.day < cooldown) return false;
    return true;
  });
  const pool = specific.length ? specific : TEMPLATES.filter((template) => template.category === category && template.fallback);
  const rolled = nextRng(state.rngState);
  const index = Math.min(pool.length - 1, Math.floor(rolled.value * pool.length));
  return { id: pool[index]!.id, rngState: rolled.next };
}

export function prepareEvent(state: GameState, templateId: string): { event: ActiveEvent; rngState: number } | null {
  const template = getTemplate(templateId);
  if (!template || template.choices.length !== 3 || !state.calendar) return null;
  let rng = state.rngState;
  const roll = () => {
    const next = nextRng(rng);
    rng = next.next;
    return next.value;
  };
  const ctx: PrepCtx = { state, roll, category: template.category };
  const choices = template.choices.map((choice) => {
    const preview = choice.preview(ctx);
    let disabledReason = choice.requires?.(ctx) ?? null;
    const resolved = choice.resolve(ctx);
    let effects = disabledReason ? emptyEffects() : finishEffects(resolved.effects, state, template.category);
    if (!disabledReason) {
      const delta = cashDelta(effects);
      const cash = state.shop?.cash ?? 0;
      if (delta < 0 && cash + delta < 0) {
        disabledReason = `店铺金不够，还差 ${-(cash + delta)}。可以改选别的办法。`;
        effects = emptyEffects();
      }
    }
    const changes = disabledReason ? [] : [...describeEffects(effects), '经验 +6'];
    return {
      id: choice.id,
      label: choice.label,
      preview,
      disabledReason,
      resultText: resolved.resultText,
      effects,
      changes,
    };
  });
  const idRoll = nextRng(rng);
  rng = idRoll.next;
  return {
    rngState: rng,
    event: {
      instanceId: `${state.calendar.dayId}-${template.id}-${idRoll.next.toString(16)}`,
      templateId: template.id,
      category: template.category,
      title: template.title,
      description: template.description(state),
      timeLabel: timeLabel(state.actionIndex),
      characterId: template.characterId,
      petId: template.petId,
      coach: template.coach,
      choices,
      submitted: false,
      result: null,
    },
  };
}

export function refreshOffers(state: GameState): GameState {
  if (!state.calendar || !state.shop) return state;
  let next = state;
  if (isOpeningDay(state.calendar)) {
    const step = DAY1_SCRIPT[state.scriptStep];
    if (!step || next.prepared[step.category]) return next;
    const prepared = prepareEvent(next, step.templateId);
    if (!prepared) return next;
    return {
      ...next,
      rngState: prepared.rngState,
      prepared: { ...next.prepared, [step.category]: prepared.event },
      recentUses: [...next.recentUses, { id: step.templateId, day: state.calendar.absoluteDay }],
    };
  }
  const categories: ActionCategory[] = ['customer', 'care', 'neighborhood'];
  for (const category of categories) {
    if (next.prepared[category]) continue;
    const picked = pickTemplateId(next, category);
    next = { ...next, rngState: picked.rngState };
    const prepared = prepareEvent(next, picked.id);
    if (!prepared) continue;
    next = {
      ...next,
      rngState: prepared.rngState,
      prepared: { ...next.prepared, [category]: prepared.event },
      recentUses: [...next.recentUses, { id: picked.id, day: next.calendar!.absoluteDay }],
    };
  }
  return next;
}
