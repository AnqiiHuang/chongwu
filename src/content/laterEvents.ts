import { fx, quoteRevenue } from '../game/effects';
import { availableQty } from '../game/economy';
import { onDuty } from '../game/time';
import type { Effects, GameState } from '../game/types';
import type { EventTemplate, PrepCtx } from './events';

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
  if (ctx.state.employees[employeeId]?.trainedToday) return `${label}今天在培训，不能同时做这项服务。`;
  return null;
}

function guest(id: string, affinity: number, extra: { preference?: string; lastPurchase?: string; taboo?: string } = {}): Effects['customers'][number] {
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

function day(state: GameState): number {
  return state.calendar?.absoluteDay ?? 0;
}

export const LATER_TEMPLATES: EventTemplate[] = [
  {
    id: 'sun_quiet',
    title: '窗边先空出来',
    category: 'care',
    story: true,
    characterId: null,
    petId: 'dahuang',
    coach: null,
    when: (state) => !!state.storyFlags.dahuang_met && !state.storyFlags.sun_quiet,
    description: () =>
      '上午的光又停在窗台右边。大黄看着那块地方，没有跳上去。奶泡的软垫在另一头。如果你把中间的梳子和水碗挪开，它就有一条自己的路。',
    choices: [
      {
        id: 'clear',
        label: '把梳子和水碗挪开，留下一块空窗台',
        preview: () => '不花钱 · 不把大黄抱上去',
        resolve: () => ({
          resultText: '窗台空出来以后，大黄看了很久，才把自己搁上去。你一直站在原来的位置，没有伸手。',
          effects: fx({
            goodService: true,
            flags: ['sun_quiet'],
            pets: [pet('dahuang', 4, 3, 0)],
            note: '大黄有一块不用让出来的窗台。',
          }),
        }),
      },
      {
        id: 'watch',
        label: '先站远一点，看它要不要自己走过去',
        preview: () => '不挪东西 · 只观察',
        resolve: () => ({
          resultText: '大黄绕到窗台下面，又停住。你把今天的路线写下来：它会靠近光，但还不愿意从人或碗旁边挤过去。',
          effects: fx({
            flags: ['sun_quiet'],
            pets: [pet('dahuang', 2, 1, 0)],
            note: '大黄靠近阳光时，会先躲开人和碗。',
          }),
        }),
      },
      {
        id: 'cloth',
        label: '在空处铺一块棉布，当临时的落脚点',
        preview: () => '消耗棉布 1 · 不是强迫它躺下',
        requires: (ctx) => needItem(ctx, 'cotton', '棉布'),
        resolve: () => ({
          resultText: '棉布铺在光边上。大黄闻了闻，用爪子按了一下，没有躺平。位置先留着。',
          effects: fx({
            items: [{ itemId: 'cotton', delta: -1 }],
            cashExpense: 3,
            flags: ['sun_quiet'],
            pets: [pet('dahuang', 3, 2, 0)],
          }),
        }),
      },
    ],
  },
  {
    id: 'sun_clock',
    title: '它晒太阳的钟点',
    category: 'care',
    story: true,
    characterId: null,
    petId: 'dahuang',
    coach: null,
    when: (state) => !!state.storyFlags.sun_quiet && !state.storyFlags.sun_clock,
    description: () =>
      '你翻到上次的手账。上午的光会停在窗台右边，大黄多半在那个时候出现。今天可以只核对时间，不安排别的互动。',
    choices: [
      {
        id: 'mark',
        label: '把这个钟点写进每天的照护栏',
        preview: () => '不消耗物品 · 以后按它的时间留窗台',
        resolve: () => ({
          resultText: '照护栏上多了一行：上午，窗台右边留给大黄。员工打扫时会绕开，不等它起来。',
          effects: fx({
            goodService: true,
            flags: ['sun_clock', 'dahuang_sun_time'],
            pets: [pet('dahuang', 3, 2, 0)],
            note: '大黄晒太阳的时间写进了照护栏。',
          }),
        }),
      },
      {
        id: 'sit',
        label: '在光过来之前坐下，等它自己到',
        preview: () => '不叫它 · 只对一对时间',
        resolve: () => ({
          resultText: '光挪到窗台右边时，大黄也到了。你没有出声。时间对得上，手账上的那一行可以留着。',
          effects: fx({
            flags: ['sun_clock', 'dahuang_sun_time'],
            pets: [pet('dahuang', 4, 2, 0)],
          }),
        }),
      },
      {
        id: 'staff',
        label: '请林序以后打扫时绕开这块光',
        preview: () => '需要护理员在岗 · 只改打扫路线',
        requires: (ctx) => needStaff(ctx, 'lin_xu', '林序'),
        resolve: () => ({
          resultText: '林序把抹布和水桶放到窗台的另一侧。他说打扫可以等这束光过去，不用把猫请下来。',
          effects: fx({
            flags: ['sun_clock', 'dahuang_sun_time'],
            practiceStaff: 'lin_xu',
            pets: [pet('dahuang', 2, 2, 0)],
          }),
        }),
      },
    ],
  },
  {
    id: 'sun_nuzzle',
    title: '它先碰了你一下',
    category: 'care',
    story: true,
    characterId: null,
    petId: 'dahuang',
    coach: null,
    when: (state) => !!state.storyFlags.sun_clock && !state.storyFlags.sun_nuzzle,
    description: () =>
      '大黄已经在窗台上。你路过的时候，它的尾巴动了一下，头却没有抬。如果它想靠近，会自己决定；你要是伸手，它也可能躲开。',
    choices: [
      {
        id: 'still',
        label: '手垂着，等它要不要碰你的裤脚',
        preview: () => '不主动摸 · 碰一下也停住',
        resolve: () => ({
          resultText: '大黄从窗台下来，用头侧在你裤脚上碰了一下，然后回到光里。你没有追上去再摸第二次。',
          effects: fx({
            goodService: true,
            flags: ['sun_nuzzle'],
            pets: [pet('dahuang', 6, 4, 0)],
            note: '大黄第一次主动碰了你的裤脚。',
          }),
        }),
      },
      {
        id: 'back',
        label: '往后退半步，把选择权留在它那边',
        preview: () => '不靠近 · 躲开也没关系',
        resolve: () => ({
          resultText: '你退了半步。大黄看了看空出来的地面，把一只爪子搭出窗台，又收回去。今天没有碰到你，它也没有躲开到架子下面。',
          effects: fx({
            flags: ['sun_nuzzle'],
            pets: [pet('dahuang', 3, 2, 0)],
            note: '大黄今天没有靠近，也没有躲起来。',
          }),
        }),
      },
      {
        id: 'note',
        label: '只把这一幕写进手账，不去试探',
        preview: () => '不伸手 · 记下它的节奏',
        resolve: () => ({
          resultText: '你写下：它会在晒完太阳以后看人，不一定要人先开口。大黄继续打盹，像没看见这笔记录。',
          effects: fx({
            flags: ['sun_nuzzle'],
            pets: [pet('dahuang', 2, 2, 0)],
          }),
        }),
      },
    ],
  },
  {
    id: 'sun_plate',
    title: '门口的名牌',
    category: 'care',
    story: true,
    characterId: null,
    petId: 'dahuang',
    coach: null,
    when: (state) => !!state.storyFlags.sun_nuzzle && !state.storyFlags.sun_plate,
    description: () =>
      '大黄已经把窗台当成自己的地方。你可以在门口挂一块不高的名牌，写它的名字。名牌是给找过来的人看的，不是要它表演。',
    choices: [
      {
        id: 'hang',
        label: '挂上大黄的名牌，高度不挡它进出',
        preview: () => '不另外收费 · 得到门口名牌',
        resolve: () => ({
          resultText: '名牌挂在门边，刚好是路过的人低头能看见的高度。大黄闻了闻门框，从旁边走回窗台。',
          effects: fx({
            goodService: true,
            decor: 'name_plate',
            flags: ['sun_plate'],
            pets: [pet('dahuang', 3, 3, 0)],
            note: '门口挂上了大黄的名牌。',
          }),
        }),
      },
      {
        id: 'book',
        label: '名牌先写在手账里，门口保持原来的样子',
        preview: () => '不挂东西 · 故事仍然记下',
        resolve: () => ({
          resultText: '你在手账扉页写下大黄的名字和它晒太阳的钟点。门口没有新的牌子，窗台还是它的。',
          effects: fx({
            flags: ['sun_plate'],
            pets: [pet('dahuang', 2, 2, 0)],
            note: '大黄的名字写在手账扉页。',
          }),
        }),
      },
      {
        id: 'pay',
        label: '请木工按普通价做一块，再挂上',
        preview: () => '采购 24 · 名牌不是礼物',
        requires: (ctx) => needCash(ctx, 24),
        resolve: () => ({
          resultText: '你按木工报的价钱付了名牌。挂好以后，大黄只是从门边经过，没有停下来看字。',
          effects: fx({
            purchases: 24,
            decor: 'name_plate',
            flags: ['sun_plate'],
            pets: [pet('dahuang', 2, 2, 0)],
          }),
        }),
      },
    ],
  },
  {
    id: 'cloud_meet',
    title: '认识帮乌云的人',
    category: 'neighborhood',
    story: true,
    characterId: 'shen_he',
    petId: null,
    coach: null,
    when: (state) => !!state.storyFlags.florist_stand && !state.storyFlags.cloud_meet,
    description: () =>
      '沈禾在公告栏边等你，怀里没有猫。「有一只黑猫，叫乌云。它现在住在救助点的单独房间，不跟别的动物混。我想先让你认识它的习惯，不是今天就把它送来。」',
    choices: [
      {
        id: 'listen',
        label: '先听它怕什么，不约今天见面',
        preview: () => '不成交 · 把已知的习惯记下',
        resolve: () => ({
          resultText: '沈禾说乌云怕突然的手，也怕和其他猫挤在一起。你记下这些，没有问它好不好看。',
          effects: fx({
            community: 3,
            visitors: 1,
            goodService: true,
            flags: ['cloud_meet', 'wuyun_known'],
            customers: [guest('shen_he', 5, { preference: '乌云需要单独的房间', taboo: '不要突然伸手' })],
            note: '乌云先被写进手账，人还没把它带来。',
          }),
        }),
      },
      {
        id: 'visit',
        label: '约一次去安静房间门口看它，不抱',
        preview: () => '只看 · 不进它的房间',
        resolve: () => ({
          resultText: '你们约了人少的时候，站在房间门口。沈禾说如果乌云不出来，就看一会儿再走。',
          effects: fx({
            community: 2,
            visitors: 1,
            flags: ['cloud_meet', 'wuyun_known'],
            customers: [guest('shen_he', 4, { preference: '看乌云时站在门口' })],
          }),
        }),
      },
      {
        id: 'later',
        label: '请她留下联系方式，这周先忙店里',
        preview: () => '不承诺收留 · 故事先记一笔',
        resolve: () => ({
          resultText: '沈禾留下一张手写的联系卡。你说店里的安静房间还要再整理，不会为了快点把乌云接来。',
          effects: fx({
            visitors: 1,
            flags: ['cloud_meet', 'wuyun_known'],
            customers: [guest('shen_he', 3)],
          }),
        }),
      },
    ],
  },
  {
    id: 'cloud_match',
    title: '什么样的家适合它',
    category: 'neighborhood',
    story: true,
    characterId: 'shen_he',
    petId: null,
    coach: null,
    when: (state) => !!state.storyFlags.cloud_meet && !state.storyFlags.cloud_match,
    description: () =>
      '沈禾把一张简单的照护条件摊在桌上：单独房间、有人能接受它慢热、不和其他宠物抢地方。「有一户人家想认识它。条件还没对完。对不上的话，可以再等。」',
    choices: [
      {
        id: 'check',
        label: '和她一起核对那户人家的房间和作息',
        preview: () => '不催领养 · 条件不够就停',
        resolve: () => ({
          resultText: '那户人家有一间不进其他动物的小房间，也说可以等乌云自己出来。沈禾把这一条勾上，其余的还要再看一次。',
          effects: fx({
            community: 3,
            visitors: 1,
            goodService: true,
            flags: ['cloud_match'],
            customers: [guest('shen_he', 5, { preference: '领养前先核对单独房间' })],
            note: '乌云的领养条件对上了一部分。',
          }),
        }),
      },
      {
        id: 'wait',
        label: '条件还没写完，请这户人家再等一等',
        preview: () => '延后 · 不算拒绝他们',
        resolve: () => ({
          resultText: '你和沈禾都觉得还缺一条：家里谁负责每天的安静时间。这户人家说明天补上，乌云今天仍留在救助点。',
          effects: fx({
            community: 2,
            visitors: 1,
            flags: ['cloud_match'],
            customers: [guest('shen_he', 4)],
          }),
        }),
      },
      {
        id: 'shop',
        label: '如果暂时没有合适的家，店里的安静房间可以过渡',
        preview: () => '只是过渡 · 不把店当成它的归宿',
        resolve: () => ({
          resultText: '沈禾同意把店里的安静房间当作过渡，不写进领养协议。乌云如果来，也只待到合适的家准备好。',
          effects: fx({
            community: 2,
            visitors: 1,
            flags: ['cloud_match'],
            customers: [guest('shen_he', 4, { preference: '店里只做过渡，不做永久收留' })],
          }),
        }),
      },
    ],
  },
  {
    id: 'cloud_prepare',
    title: '给乌云准备单独的地方',
    category: 'neighborhood',
    story: true,
    characterId: 'shen_he',
    petId: 'wuyun',
    coach: null,
    when: (state) => !!state.storyFlags.cloud_match && !state.storyFlags.cloud_prepare,
    description: () =>
      '沈禾今天把乌云带在运输箱里，箱子没有打开。「如果安静房间已经和前厅隔开，它可以先在里面待着。食物用水都用它自己的，不和奶泡、大黄的碗放一起。」',
    choices: [
      {
        id: 'room',
        label: '打开安静房间，让它自己从箱子里出来',
        preview: () => '不抱它 · 乌云先住进来',
        resolve: () => ({
          resultText: '房间门带上以后，乌云从箱子里走出来，停在离门最远的角落。前厅的三只都没看见它。',
          effects: fx({
            goodService: true,
            flags: ['cloud_prepare', 'wuyun_arrived'],
            pets: [pet('wuyun', 4, 3, 0)],
            customers: [guest('shen_he', 4)],
            note: '乌云住进了单独的安静房间。',
          }),
        }),
      },
      {
        id: 'bowl',
        label: '先放好它自己的水和粮，今天不接它进店',
        preview: () => '采购 16 · 碗不和猫狗混用',
        requires: (ctx) => needCash(ctx, 16),
        resolve: () => ({
          resultText: '你买了一套只放在安静房间的碗。沈禾说那就算准备好了，乌云今天仍回救助点，下一回再来。',
          effects: fx({
            purchases: 16,
            flags: ['cloud_prepare'],
            customers: [guest('shen_he', 3)],
            note: '乌云的碗准备好了，它今天还没进店。',
          }),
        }),
      },
      {
        id: 'look',
        label: '只在箱子外看它一眼，不打开',
        preview: () => '不打开箱子 · 仍然把房间记为准备好',
        resolve: () => ({
          resultText: '乌云在格子后面看了你一下。箱子没有打开。沈禾确认安静房间可以等下一次再用。',
          effects: fx({
            visitors: 1,
            flags: ['cloud_prepare', 'wuyun_known'],
            pets: [pet('wuyun', 1, 1, 0)],
            customers: [guest('shen_he', 4)],
          }),
        }),
      },
    ],
  },
  {
    id: 'cloud_handoff',
    title: '交接的那一天',
    category: 'neighborhood',
    story: true,
    characterId: 'shen_he',
    petId: 'wuyun',
    coach: null,
    when: (state) => !!state.storyFlags.cloud_prepare && !state.storyFlags.cloud_handoff,
    description: () =>
      '那户人家来了，站在安静房间外面。沈禾把照护条件再读了一遍：单独房间、不强迫接触、食物分开。「他们可以今天接走，也可以再等。等一等不会算你没做成。」',
    choices: [
      {
        id: 'go',
        label: '条件已经对上，让这户人家接它回家',
        preview: () => '不是卖猫 · 交接完它离开店',
        resolve: () => ({
          resultText: '乌云跟着自己的箱子上了车。没有人收领养费。沈禾说回家的第一周，他们只在门口放粮食，不进去抓它。',
          effects: fx({
            community: 4,
            visitors: 1,
            goodService: true,
            flags: ['cloud_handoff', 'wuyun_adopted'],
            customers: [guest('shen_he', 6)],
            note: '乌云去了新家。店里没有把它当成一笔收入。',
          }),
        }),
      },
      {
        id: 'stay',
        label: '请这户人家再熟悉一天，乌云先留在安静房间',
        preview: () => '过渡留店 · 仍然不是售宠',
        resolve: () => ({
          resultText: '这户人家在门口坐了一会儿就走了。乌云留在自己的房间。沈禾把明天的交接时间写在卡片上。',
          effects: fx({
            community: 2,
            visitors: 1,
            flags: ['cloud_handoff', 'wuyun_arrived'],
            pets: [pet('wuyun', 2, 1, 0)],
            customers: [guest('shen_he', 4)],
            note: '交接改到明天，乌云还在安静房间。',
          }),
        }),
      },
      {
        id: 'wait',
        label: '今天先不交接，等他们把房间照片补来',
        preview: () => '礼貌延后 · 不扣好感当惩罚',
        resolve: () => ({
          resultText: '照片还缺窗边那一张。沈禾请他们回家补拍，没有责怪。乌云今天不去新的地方，这件事明天还可以再谈。',
          effects: fx({
            community: 1,
            visitors: 1,
            customers: [guest('shen_he', 3, { preference: '交接前要看到新家的房间' })],
            note: '领养交接先停一停，等房间照片。',
          }),
        }),
      },
    ],
  },
  {
    id: 'cloud_photo',
    title: '寄来的全家福',
    category: 'neighborhood',
    story: true,
    characterId: 'shen_he',
    petId: null,
    coach: null,
    when: (state) => !!state.storyFlags.cloud_handoff && !state.storyFlags.cloud_photo,
    description: (state) =>
      state.storyFlags.wuyun_adopted
        ? '沈禾带来一个纸袋。里面是那户人家寄来的照片：乌云蹲在新家的窗下，旁边没有别的动物。「他们说它还是慢，不过会自己去吃饭。」'
        : '沈禾带来那户人家补拍的房间照片，也带来一张在店门口的合影。乌云如果还在安静房间，照片里就只有门，没有人把它抓出来。',
    choices: [
      {
        id: 'keep',
        label: '把照片收进手账，不拿去当广告',
        preview: () => '纪念 · 不算营业额',
        resolve: () => ({
          resultText: '照片夹进手账。沈禾说以后回访还会再来，不用店里再做什么促销。',
          effects: fx({
            community: 3,
            visitors: 1,
            goodService: true,
            stamps: 1,
            flags: ['cloud_photo'],
            customers: [guest('shen_he', 5)],
            note: '乌云的照片收进了手账。',
          }),
        }),
      },
      {
        id: 'visit',
        label: '约一次回访，只在新家或门口看它',
        preview: () => '回访 · 不把它接回店里展示',
        resolve: () => ({
          resultText: '回访约在下周。无论它在新家还是还在安静房间，都只是看看吃饭和躲藏的地方，不把它带去前厅。',
          effects: fx({
            community: 2,
            visitors: 1,
            flags: ['cloud_photo'],
            customers: [guest('shen_he', 4)],
            note: '乌云的回访约好了。',
          }),
        }),
      },
      {
        id: 'note',
        label: '不收照片，只把交接结果写一句话',
        preview: () => '文字也算完成 · 不收集他们的家庭照',
        resolve: () => ({
          resultText: '你写下：乌云的家要安静、单独，而且不能靠卖掉它来完成这件事。沈禾把照片带回给那户人家。',
          effects: fx({
            community: 2,
            visitors: 1,
            flags: ['cloud_photo'],
            customers: [guest('shen_he', 3)],
          }),
        }),
      },
    ],
  },
  {
    id: 'senior_slow',
    title: '木木走得慢',
    category: 'customer',
    cooldownDays: 3,
    characterId: 'zhou_shu',
    petId: null,
    coach: null,
    description: () =>
      '周叔牵着老狗木木，在门口停了两次才进门。木木的后腿不太利索，呼吸却平稳。「想梳一梳背上的毛。洗的话它会站不住，今天就算了。」',
    choices: [
      {
        id: 'comb',
        label: '只梳它站着也舒服的地方，不安排洗护',
        preview: (ctx) => `报价 ${quoteRevenue(35, ctx.state)} · 它不想继续就停`,
        requires: (ctx) => needStaff(ctx, 'su_tao', '苏桃'),
        resolve: () => ({
          resultText: '苏桃让木木站在垫子上，只梳了背。木木侧了侧身子，她就停手。周叔按基础梳理付了钱。',
          effects: fx({
            revenue: 35,
            cashExpense: 8,
            orders: 1,
            visitors: 1,
            goodService: true,
            practiceStaff: 'su_tao',
            customers: [guest('zhou_shu', 5, { lastPurchase: '基础梳理', preference: '木木不安排洗护' })],
          }),
        }),
      },
      {
        id: 'sit',
        label: '先让木木坐下喝水，今天不梳',
        preview: () => '不收费 · 记下它需要停顿',
        resolve: () => ({
          resultText: '木木喝了水，在垫子上坐稳。周叔说梳毛可以等下一次腿更有劲的时候。你没有劝他改买洗护。',
          effects: fx({
            visitors: 1,
            goodService: true,
            customers: [guest('zhou_shu', 4, { preference: '木木进门要先休息', taboo: '不要安排洗护' })],
          }),
        }),
      },
      {
        id: 'refer',
        label: '腿的事请他去合作医院，店里不判断',
        preview: () => '转诊 · 店里不诊断',
        resolve: () => ({
          resultText: '你把医院的时间抄给他。店里没有人说木木得了什么。周叔说明天先去问医生，梳毛以后再说。',
          effects: fx({
            visitors: 1,
            flags: ['mumu_referral'],
            customers: [guest('zhou_shu', 3, { preference: '腿的问题交给医院' })],
          }),
        }),
      },
    ],
  },
  {
    id: 'rival_week',
    title: '尾巴铺的小黑板',
    category: 'neighborhood',
    cooldownDays: 8,
    characterId: 'a_mai',
    petId: null,
    coach: null,
    description: () =>
      '隔壁尾巴铺的阿麦把黑板转过来给你看。上面写着这周梳子打九折，字不大，也不闪。「你们要是想一起做个清楚的价目，可以。不想跟着降价，也没关系。」',
    choices: [
      {
        id: 'keep',
        label: '保持自己的价目，谢谢她来打声招呼',
        preview: () => '不促销 · 价目板维持原样',
        resolve: () => ({
          resultText: '阿麦点点头，把黑板转回去。你的价目板没有改。两家店的门口还是各写各的。',
          effects: fx({
            community: 2,
            visitors: 1,
            goodService: true,
            customers: [guest('a_mai', 3, { preference: '可以各自标价，不必跟着打折' })],
            note: '尾巴铺在打折，你的价目没有改。',
          }),
        }),
      },
      {
        id: 'sale',
        label: '这周给梳子一个写清楚的小折扣',
        preview: () => '折扣写在价目旁边 · 不说别人的坏话',
        resolve: () => ({
          resultText: '你在价目板旁边夹了一张纸条：本周梳子减 2。没有提尾巴铺。阿麦说这样客人自己看得懂。',
          effects: fx({
            popularity: 2,
            visitors: 1,
            flags: ['comb_discount'],
            customers: [guest('a_mai', 2)],
          }),
        }),
      },
      {
        id: 'together',
        label: '约一个联合的咨询下午，两边都标原价',
        preview: () => '联合活动 · 不比谁更便宜',
        resolve: () => ({
          resultText: '你们约了周四下午，各自解答梳子和牵引的问题，价格仍按各家价目。黑板上没有出现“全城最低”。',
          effects: fx({
            community: 3,
            popularity: 1,
            visitors: 1,
            customers: [guest('a_mai', 4, { preference: '联合活动不比价' })],
          }),
        }),
      },
    ],
  },
  {
    id: 'chen_picture',
    title: '老猫的一张照片',
    category: 'customer',
    cooldownDays: 3,
    characterId: 'chen_jie',
    petId: null,
    coach: null,
    when: (state) => !!state.customers.chen_jie?.met,
    description: () =>
      '陈姐带来一张洗好的照片。照片里的老猫蹲在她家窗台，眼睛半闭。「它今天还是没出门。我想让你认得它，不是要你现在做护理。」',
    choices: [
      {
        id: 'copy',
        label: '把照片上的习惯问清楚，再收进手账',
        preview: () => '不收费 · 第二次见面才算认得',
        resolve: () => ({
          resultText: '老猫叫点心，不喜欢被抱，只在自家窗台吃饭。你把这张照片夹进陈姐的那一页，没有约今天的服务。',
          effects: fx({
            community: 2,
            visitors: 1,
            goodService: true,
            customers: [guest('chen_jie', 4, { preference: '点心不喜欢被抱' })],
            note: '陈姐的老猫叫点心。',
          }),
        }),
      },
      {
        id: 'look',
        label: '只看照片，不把它写成下一次的预约',
        preview: () => '不成交 · 她可以只是来展示',
        resolve: () => ({
          resultText: '你看完就把照片还给她。陈姐说这样就行，认得门口比约服务重要。',
          effects: fx({
            visitors: 1,
            customers: [guest('chen_jie', 3)],
          }),
        }),
      },
      {
        id: 'snack',
        label: '如果她要带零食回去，先确认是猫的',
        preview: (ctx) => `售价 ${quoteRevenue(12, ctx.state)} · 消耗猫零食 1`,
        requires: (ctx) => needItem(ctx, 'snack_cat', '猫零食'),
        resolve: () => ({
          resultText: '陈姐看了包装，确认是猫零食，付了钱。她说点心吃不了多少，这一包可以放很久。',
          effects: fx({
            revenue: 12,
            stockCogs: 4,
            orders: 1,
            visitors: 1,
            items: [{ itemId: 'snack_cat', delta: -1 }],
            customers: [guest('chen_jie', 3, { lastPurchase: '猫零食' })],
          }),
        }),
      },
    ],
  },
  {
    id: 'nail_return',
    title: '豆豆的指甲还是明天',
    category: 'customer',
    cooldownDays: 3,
    characterId: 'liang',
    petId: 'doubao',
    coach: null,
    when: (state) => !!state.storyFlags.nail_appointment || (state.customers.liang?.visits ?? 0) > 0,
    description: () =>
      '梁老师又来了，豆豆这次没有喘气，可它还是先去闻纸袋。「如果林序在，可以剪。不在的话，我们就再约，不找已经下班的人临时回来。」',
    choices: [
      {
        id: 'trim',
        label: '请林序按预约修甲，豆豆不愿意就停',
        preview: (ctx) => `报价 ${quoteRevenue(20, ctx.state)} · 需要护理员在岗`,
        requires: (ctx) => needStaff(ctx, 'lin_xu', '林序'),
        resolve: () => ({
          resultText: '林序让豆豆坐下，只剪了过长的前端。豆豆站起来时，他就停了。梁老师按修甲的价格付了钱。',
          effects: fx({
            revenue: 20,
            cashExpense: 4,
            orders: 1,
            visitors: 1,
            goodService: true,
            practiceStaff: 'lin_xu',
            clearFlags: ['nail_appointment'],
            customers: [guest('liang', 4, { lastPurchase: '修甲' })],
            pets: [pet('doubao', 1, 1, -4)],
          }),
        }),
      },
      {
        id: 'book',
        label: '林序不在就改约，不叫别人顶上',
        preview: () => '改时间 · 不消耗行动以外的东西',
        resolve: () => ({
          resultText: '你把时间改到林序的班次里。豆豆今天只是喝了水。没有人在美容师下班后把她叫回来。',
          effects: fx({
            visitors: 1,
            flags: ['nail_appointment'],
            customers: [guest('liang', 3, { preference: '修甲等林序在岗' })],
          }),
        }),
      },
      {
        id: 'walk',
        label: '先把散步后的停顿做完，指甲以后再说',
        preview: () => '不修甲 · 记住豆豆的顺序',
        resolve: () => ({
          resultText: '豆豆把纸袋闻完，才在垫子上坐下。梁老师说顺序对了，指甲可以排到下一次。',
          effects: fx({
            visitors: 1,
            goodService: true,
            pets: [pet('doubao', 1, 2, 0)],
            customers: [guest('liang', 4, { preference: '散步后不宜立刻修甲' })],
          }),
        }),
      },
    ],
  },
  {
    id: 'sesame_pen',
    title: '芝麻的纸屋',
    category: 'care',
    cooldownDays: 3,
    characterId: null,
    petId: 'zhima',
    coach: null,
    when: (state) => day(state) >= 4 && !state.storyFlags.zhima_arrived,
    description: () =>
      '志愿者留了一只兔子在店外的运输箱里，名字写着芝麻。箱子上贴着：需要单独的安静区域和纸屋，不能和猫狗放在一起，也不吃它们的粮。',
    choices: [
      {
        id: 'pen',
        label: '把纸屋放进隔开的兔区，让它自己出来',
        preview: () => '消耗纸屋 1 · 不抱去前厅',
        requires: (ctx) => needItem(ctx, 'paper_house', '纸屋'),
        resolve: () => ({
          resultText: '纸屋放在隔板后面。芝麻闻了闻入口，慢慢钻进去。前厅的门仍然关着。',
          effects: fx({
            goodService: true,
            items: [{ itemId: 'paper_house', delta: -1 }],
            stockCogs: 16,
            flags: ['zhima_arrived', 'zhima_known'],
            pets: [pet('zhima', 4, 3, 0)],
            note: '芝麻住进了单独的兔区。',
          }),
        }),
      },
      {
        id: 'hay',
        label: '先买一份兔子的草，今天不接它进店',
        preview: () => '采购 14 · 草不放进猫狗的货架',
        requires: (ctx) => needCash(ctx, 14),
        resolve: () => ({
          resultText: '草放在准备间，没有和猫主粮摆在一起。芝麻今天仍由志愿者带回去，等兔区清空再来。',
          effects: fx({
            purchases: 14,
            flags: ['zhima_known'],
            note: '芝麻的草准备好了，它还没入住。',
          }),
        }),
      },
      {
        id: 'later',
        label: '请志愿者明天再来，兔区还没隔好',
        preview: () => '礼貌延后 · 不把兔子先放进前厅',
        resolve: () => ({
          resultText: '志愿者把箱子带回去。你答应隔板钉好再联系，没有让芝麻在猫狗中间等。',
          effects: fx({
            community: 1,
            flags: ['zhima_known'],
          }),
        }),
      },
    ],
  },
  {
    id: 'nuomi_room',
    title: '糯米的小房子',
    category: 'care',
    cooldownDays: 3,
    characterId: null,
    petId: 'nuomi',
    coach: null,
    when: (state) => day(state) >= 8 && !state.storyFlags.nuomi_arrived,
    description: () =>
      '傍晚的柜台上多了一个带气孔的小房子，卡片写着仓鼠糯米。它白天多半睡觉，粮食要单独放，不能混进猫碗，也不能拿去和芝麻的草做邻居。',
    choices: [
      {
        id: 'shelf',
        label: '把小房子放到人和猫狗都碰不到的一层',
        preview: () => '不打开盖子 · 糯米住进自己的居所',
        resolve: () => ({
          resultText: '小房子放到高处的安静层。你从气孔里看见糯米把一粒粮食藏到角落，没有把盖子掀开。',
          effects: fx({
            goodService: true,
            flags: ['nuomi_arrived', 'nuomi_known'],
            pets: [pet('nuomi', 3, 2, 0)],
            note: '糯米有了碰不到猫狗的小房子。',
          }),
        }),
      },
      {
        id: 'food',
        label: '另买一份仓鼠粮，不从猫零食里分',
        preview: () => '采购 10 · 粮食单独收着',
        requires: (ctx) => needCash(ctx, 10),
        resolve: () => ({
          resultText: '仓鼠粮放进准备间的小盒子。糯米今天还在原来的寄养处，等架子清出来再搬来。',
          effects: fx({
            purchases: 10,
            flags: ['nuomi_known'],
            note: '糯米的粮食没有混进猫零食。',
          }),
        }),
      },
      {
        id: 'wait',
        label: '今天先不搬，等白天的客人走完',
        preview: () => '延后 · 傍晚再安放也行',
        resolve: () => ({
          resultText: '小房子先放在柜台上最里面。你打算等打烊前再挪到高处，不在人来人往时打开。',
          effects: fx({
            flags: ['nuomi_known'],
            pets: [pet('nuomi', 1, 0, 0)],
          }),
        }),
      },
    ],
  },
  {
    id: 'doubao_walk',
    title: '豆包的这一圈',
    category: 'care',
    cooldownDays: 3,
    characterId: null,
    petId: 'doubao',
    coach: null,
    description: () =>
      '豆包已经在门口转了两圈，牵引绳挂在原来的钩子上。它不是非要跑远，只是散步的时间到了。雨天的话，这一圈可以改在屋檐下。',
    choices: [
      {
        id: 'round',
        label: '沿门口走一小圈，结束前留时间让它闻',
        preview: () => '不卖东西 · 按它的节奏回来',
        resolve: () => ({
          resultText: '这一圈没有走远。豆包在回来的转角停下来闻了一会儿，你没有拉紧绳子催它。',
          effects: fx({
            goodService: true,
            pets: [pet('doubao', 2, 3, -6)],
            note: '豆包走完了自己的一小圈。',
          }),
        }),
      },
      {
        id: 'in',
        label: '今天改在门内，让它闻纸袋就当散步',
        preview: () => '不外出 · 精力还留着',
        resolve: () => ({
          resultText: '豆包把纸袋从这头闻到那头，然后坐下。你把牵引绳挂回钩子，没有再开门。',
          effects: fx({
            pets: [pet('doubao', 1, 2, -2)],
          }),
        }),
      },
      {
        id: 'leash',
        label: '检查牵引绳还在，先不出发',
        preview: () => '只检查库存 · 今天可以不走',
        requires: (ctx) => needItem(ctx, 'leash', '牵引绳'),
        resolve: () => ({
          resultText: '牵引绳还挂在钩子上，扣具也能打开。豆包看了一眼，又回到纸袋旁边。散步可以等下一次。',
          effects: fx({
            pets: [pet('doubao', 1, 1, 0)],
          }),
        }),
      },
    ],
  },
  {
    id: 'naipao_hour',
    title: '奶泡的安静一下午',
    category: 'care',
    cooldownDays: 3,
    characterId: null,
    petId: 'naipao',
    coach: null,
    description: () =>
      '奶泡把脸埋进自己的位置，尾巴没有张开。有人想靠近看它的长毛。你可以让下午保持安静，也可以只在它自己走出来时才打招呼。',
    choices: [
      {
        id: 'quiet',
        label: '把参观留到它离开软垫以后',
        preview: () => '不抱 · 拒绝靠近也算它的个性',
        resolve: () => ({
          resultText: '你把“先不要靠近软垫”写在护理角。奶泡一整下午没有被叫起来，后来自己换了个姿势。',
          effects: fx({
            goodService: true,
            pets: [pet('naipao', 3, 3, 2)],
            note: '奶泡的下午没有被打扰。',
          }),
        }),
      },
      {
        id: 'comb',
        label: '等它自己坐起来，再问要不要梳一下',
        preview: () => '它不坐起来就不梳',
        requires: (ctx) => needItem(ctx, 'comb', '宠物梳'),
        resolve: () => ({
          resultText: '奶泡没有坐起来。梳子放回原处，谁也没有把它翻过来。下午就这样过去。',
          effects: fx({
            pets: [pet('naipao', 2, 2, 0)],
          }),
        }),
      },
      {
        id: 'pad',
        label: '把软垫上的毛抖掉，不追加香味',
        preview: () => '只清洁 · 不喷东西',
        resolve: () => ({
          resultText: '你等奶泡离开以后才抖软垫。没有喷雾。它回来时，垫子还是原来的味道。',
          effects: fx({
            pets: [pet('naipao', 1, 2, 0)],
          }),
        }),
      },
    ],
  },
  {
    id: 'rain_inside',
    title: '雨天不出去拍',
    category: 'customer',
    cooldownDays: 3,
    characterId: 'xiao_qiao',
    petId: null,
    coach: null,
    when: (state) => state.calendar?.weather === 'rain',
    description: () =>
      '小乔下班经过，看见门口有人想在雨里给狗拍照。「地面滑。如果只是想留一张，可以等它在门内站好。不想拍的话，擦干爪子就行。」',
    choices: [
      {
        id: 'inside',
        label: '请他们在门内等动物自己站好再拍',
        preview: () => '不追着拍 · 雨留在外面',
        resolve: () => ({
          resultText: '狗在门内的干垫子上站了几秒。照片拍完，人就收起伞。没有谁把动物叫回雨里重拍。',
          effects: fx({
            popularity: 1,
            visitors: 1,
            goodService: true,
            customers: [guest('xiao_qiao', 2)],
            note: '雨天的照片留在门内。',
          }),
        }),
      },
      {
        id: 'towel',
        label: '先借毛巾擦爪子，拍照的事作罢',
        preview: () => '消耗毛巾 1 · 今天不拍',
        requires: (ctx) => needItem(ctx, 'towel', '毛巾'),
        resolve: () => ({
          resultText: '爪子擦干以后，客人说照片改天再拍。毛巾挂开，没有和食物放在一起。',
          effects: fx({
            visitors: 1,
            items: [{ itemId: 'towel', delta: -1 }],
            cashExpense: 6,
            customers: [guest('xiao_qiao', 2, { preference: '雨天先擦干，再决定拍不拍' })],
          }),
        }),
      },
      {
        id: 'close',
        label: '告诉他们雨停以前不做门外的活动',
        preview: () => '不拍照 · 门口保持通行',
        resolve: () => ({
          resultText: '门外没有摆道具。客人收起相机，小乔也进门坐了一会儿。雨还在下，店门可以正常开关。',
          effects: fx({
            visitors: 1,
            customers: [guest('xiao_qiao', 3, { preference: '夜班后只想坐一会儿' })],
          }),
        }),
      },
    ],
  },
  {
    id: 'spare_cotton',
    title: '棉布还够不够',
    category: 'care',
    cooldownDays: 3,
    characterId: null,
    petId: null,
    coach: null,
    description: () =>
      '护理角的棉布格空了一点。猫、狗、兔的铺垫不能混用。你可以补一块普通棉布，也可以先把现有的分成三格，不够再买。',
    choices: [
      {
        id: 'sort',
        label: '把现有棉布分成猫、狗和其他动物三格',
        preview: () => '不花钱 · 先分开再用',
        resolve: () => ({
          resultText: '三格都写了名字。芝麻如果还没来，那一格也先空着，不拿猫用过的棉布去垫。',
          effects: fx({
            goodService: true,
            flags: ['cotton_sorted'],
            note: '棉布按动物分开了。',
          }),
        }),
      },
      {
        id: 'buy',
        label: '再买两块新棉布，旧的不混着铺',
        preview: () => '采购 6 · 新的留在空格',
        requires: (ctx) => needCash(ctx, 6),
        resolve: () => ({
          resultText: '新棉布放进空格。旧的仍留在原来的动物那一格，没有拿去给另一种动物垫。',
          effects: fx({
            purchases: 6,
            items: [{ itemId: 'cotton', delta: 2 }],
          }),
        }),
      },
      {
        id: 'enough',
        label: '数过还够今天用，先不补',
        preview: () => '不采购 · 明天开门再看',
        resolve: () => ({
          resultText: '你数过，今天的铺垫还够。自动补货仍按原来的预算，不会因为看了一眼就再买一次。',
          effects: fx({
            community: 1,
          }),
        }),
      },
    ],
  },
  {
    id: 'price_question',
    title: '这个价里有没有看病',
    category: 'customer',
    cooldownDays: 3,
    characterId: 'chen_jie',
    petId: null,
    coach: null,
    description: () =>
      '一位客人指着价目板最下面的空行。「洗护和修甲我看懂了。如果动物不舒服，这个价格里包看病吗？」',
    choices: [
      {
        id: 'no',
        label: '说明店里不看病，不舒服就去合作医院',
        preview: () => '不报价 · 医疗不进店铺收入',
        resolve: () => ({
          resultText: '你把医院的地址写在纸条上。价目板没有加看病这一行，也没有收咨询费。',
          effects: fx({
            community: 2,
            visitors: 1,
            goodService: true,
            customers: [guest('chen_jie', 2)],
            note: '客人知道店里不看病。',
          }),
        }),
      },
      {
        id: 'read',
        label: '把已经开放的三项服务再读一遍',
        preview: () => '只读价目 · 不增加项目',
        resolve: () => ({
          resultText: '基础梳理、洗护和修甲还是原来的价格。客人听完说知道了，今天先不约。',
          effects: fx({
            popularity: 1,
            visitors: 1,
            customers: [guest('chen_jie', 1)],
          }),
        }),
      },
      {
        id: 'sit',
        label: '请他坐下看完价目，不跟着去医院',
        preview: () => '不陪诊 · 店里继续营业',
        resolve: () => ({
          resultText: '客人把纸条收好，自己决定要不要去医院。你留在店里，没有跟着出门。',
          effects: fx({
            visitors: 1,
            customers: [guest('chen_jie', 2)],
          }),
        }),
      },
    ],
  },
  {
    id: 'hospital_slip',
    title: '交给医院的那一栏',
    category: 'neighborhood',
    cooldownDays: 3,
    characterId: null,
    petId: null,
    coach: null,
    description: () =>
      '合作医院的前台请你补一栏观察记录：吃饭、精神、哪里不愿意被碰。她说诊断会由医院来写，店里这一栏空着也没关系。',
    choices: [
      {
        id: 'write',
        label: '只写看见的事，空着的诊断留给医院',
        preview: () => '不判断病因 · 记录可以交接',
        resolve: () => ({
          resultText: '你写下今天谁吃饭、谁躲手。诊断那一栏是空的。前台说这样就够交给医生。',
          effects: fx({
            community: 2,
            goodService: true,
            flags: ['hospital_slip'],
            note: '观察记录交给了医院，诊断仍是空的。',
          }),
        }),
      },
      {
        id: 'ask',
        label: '问清楚哪些句子不该由店员来写',
        preview: () => '只问边界 · 不学习诊断',
        resolve: () => ({
          resultText: '前台用铅笔圈出“可能是”这一类句子，说这些留给医生。你把店里的记录表也改成只留观察。',
          effects: fx({
            community: 2,
            flags: ['record_sheet'],
          }),
        }),
      },
      {
        id: 'back',
        label: '今天没有要转诊的动物，把表先带回去',
        preview: () => '不编造记录 · 空手也行',
        resolve: () => ({
          resultText: '你没有为了填满表格而写下一只动物。表带回店里，等真的需要转诊时再用。',
          effects: fx({
            community: 1,
          }),
        }),
      },
    ],
  },
];
