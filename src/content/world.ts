import type {
  AddressId,
  DecorSlot,
  Look,
  PersonalityId,
  ShopStyle,
} from '../game/types';

export interface StyleDef {
  id: ShopStyle;
  name: string;
  text: string;
  wall: string;
  wood: string;
  cloth: string;
  sign: string;
  accent: string;
}

export const STYLES: StyleDef[] = [
  { id: 'japanese_wood', name: '日系原木治愈风', text: '木梁、暖木货架、爪印地毯、暖色窗光。', wall: '#F6E6D4', wood: '#C4A574', cloth: '#D7E8DC', sign: '#8FBF9F', accent: '#E7B89A' },
  { id: 'nordic_nature', name: '北欧自然风', text: '大窗、浅木地板、藤编灯、绿植和浅色家具。', wall: '#F7F4EF', wood: '#D2C4B0', cloth: '#E3EEE6', sign: '#A9C3B2', accent: '#E6D3B3' },
  { id: 'vintage_academy', name: '复古宠物学院风', text: '拱窗、深木书柜、格纹软装、黑板与小旗。', wall: '#F8E7D6', wood: '#B08968', cloth: '#E7D2C0', sign: '#C48B6A', accent: '#E8C56B' },
  { id: 'modern_minimal', name: '现代简约风', text: '弧形窗、奶油墙面、圆角浅木柜台、简洁留白。', wall: '#F4F1EC', wood: '#E2D0C0', cloth: '#F6E0D8', sign: '#E3B7A8', accent: '#F3D48A' },
  { id: 'soft_industrial', name: '轻工业风', text: '红砖、黑铁货架、木台面、暖灯与绿植。', wall: '#F6F0E6', wood: '#D7C4A3', cloth: '#F3D5CB', sign: '#D2A679', accent: '#E7C98A' },
  { id: 'cute_pets', name: '可爱宠物风', text: '桃粉窗帘、爪印地毯、圆形软垫、可爱货架。', wall: '#FFF1E8', wood: '#E8C8A4', cloth: '#F7D5CC', sign: '#F0B5A6', accent: '#F6D88B' },
];

export interface AddressDef {
  id: AddressId;
  name: string;
  trait: string;
  tendency: string;
  advantage: string;
  drawback: string;
  revenueMod: number;
  rent: number;
  bondMod: number;
  visitorMod: number;
  weekendVisitorMod: number;
  careVisitorMod: number;
  retailVisitorMod: number;
}

export const ADDRESSES: AddressDef[] = [
  {
    id: 'residential',
    name: '中高端社区底商',
    trait: '社区门口，散步家庭来往稳定。',
    tendency: '预约服务较多。',
    advantage: '预约服务较多；客单价初值 +10%。',
    drawback: '租金初值 +15%；更重视服务细节。',
    revenueMod: 1.1,
    rent: 115,
    bondMod: 1,
    visitorMod: 0,
    weekendVisitorMod: 0,
    careVisitorMod: 0,
    retailVisitorMod: 0,
  },
  {
    id: 'old_town',
    name: '老城区步行街转角铺',
    trait: '有树荫与老邻居的小转角。',
    tendency: '邻里愿意停下来聊天。',
    advantage: '租金 -10%；社区羁绊收益 +10%。',
    drawback: '基础自然客流 -5%。',
    revenueMod: 1,
    rent: 90,
    bondMod: 1.1,
    visitorMod: -0.05,
    weekendVisitorMod: 0,
    careVisitorMod: 0,
    retailVisitorMod: 0,
  },
  {
    id: 'university',
    name: '大学城周边商铺',
    trait: '校园附近，周末热闹。',
    tendency: '实用商品好卖，预算更敏感。',
    advantage: '周末自然客流 +15%；实用商品好卖。',
    drawback: '平均客单价 -10%；预算敏感。',
    revenueMod: 0.9,
    rent: 100,
    bondMod: 1,
    visitorMod: 0,
    weekendVisitorMod: 0.15,
    careVisitorMod: 0,
    retailVisitorMod: 0,
  },
  {
    id: 'clinic',
    name: '宠物医院旁',
    trait: '安静护理与医院转介比较常见。',
    tendency: '选在这里不等于自动得到医疗资格。',
    advantage: '护理类来客权重 +15%。',
    drawback: '租金 +5%；普通零售客占比相应降低。',
    revenueMod: 1,
    rent: 105,
    bondMod: 1,
    visitorMod: 0,
    weekendVisitorMod: 0,
    careVisitorMod: 0.15,
    retailVisitorMod: -0.15,
  },
];

export const ADDRESS_MAP: Record<AddressId, AddressDef> = Object.fromEntries(
  ADDRESSES.map((item) => [item.id, item]),
) as Record<AddressId, AddressDef>;

export interface ItemDef {
  id: string;
  name: string;
  price: number;
  perishableDays: number | null;
  restock: { min: number; target: number; priority: number } | null;
}

export const ITEMS: ItemDef[] = [
  { id: 'food_cat', name: '猫主粮', price: 8, perishableDays: 30, restock: { min: 2, target: 4, priority: 1 } },
  { id: 'food_dog', name: '狗主粮', price: 8, perishableDays: 30, restock: { min: 2, target: 3, priority: 2 } },
  { id: 'snack_cat', name: '猫零食', price: 4, perishableDays: 20, restock: { min: 2, target: 4, priority: 3 } },
  { id: 'snack_dog', name: '狗零食', price: 5, perishableDays: 20, restock: { min: 2, target: 3, priority: 4 } },
  { id: 'litter', name: '猫砂', price: 6, perishableDays: null, restock: { min: 1, target: 2, priority: 5 } },
  { id: 'towel', name: '毛巾', price: 6, perishableDays: null, restock: { min: 2, target: 4, priority: 6 } },
  { id: 'comb', name: '宠物梳', price: 6, perishableDays: null, restock: { min: 1, target: 2, priority: 7 } },
  { id: 'cotton', name: '棉布', price: 3, perishableDays: null, restock: { min: 1, target: 2, priority: 8 } },
  { id: 'cleaner', name: '清洁布', price: 4, perishableDays: null, restock: { min: 1, target: 2, priority: 9 } },
  { id: 'leash', name: '牵引绳', price: 12, perishableDays: null, restock: null },
  { id: 'toy', name: '软球', price: 10, perishableDays: null, restock: null },
  { id: 'paper_house', name: '纸屋', price: 16, perishableDays: null, restock: null },
];

export const ITEM_MAP: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((item) => [item.id, item]));

export interface DecorDef {
  id: string;
  name: string;
  slot: DecorSlot;
  text: string;
  price: number;
  level: number;
}

export const DECOR: DecorDef[] = [
  { id: 'price_board', name: '原木价目板', slot: 'wall', text: '写着已经开放的服务，不闪、不叫卖。', price: 0, level: 1 },
  { id: 'dried_flowers', name: '干燥小花束', slot: 'shelf', text: '不需要浇水，也引不起宠物的兴趣。', price: 18, level: 1 },
  { id: 'window_cushion', name: '窗边软垫', slot: 'window', text: '给愿意自己跳上来的猫留的位置。', price: 40, level: 1 },
  { id: 'door_mat', name: '门口脚垫', slot: 'door', text: '雨天可以蹭爪子，不挡着进出。', price: 36, level: 2 },
  { id: 'soft_carpet', name: '浅色短地毯', slot: 'carpet', text: '铺在店里的地面，豆包的短腿走上去不打滑。', price: 72, level: 2 },
  { id: 'flower_stand', name: '花店送来的花架', slot: 'door', text: '何芳送来的。花放在布丁够不到的一侧。', price: 0, level: 1 },
  { id: 'thank_card', name: '感谢小卡片', slot: 'shelf', text: '连续被好好接待的客人留下的话，可以换到货架上。', price: 0, level: 1 },
  { id: 'name_plate', name: '大黄的门口名牌', slot: 'door', text: '写着大黄的名字。它自己想出来的时候，名牌就在原来的高度。', price: 0, level: 1 },
];

export const DECOR_MAP: Record<string, DecorDef> = Object.fromEntries(DECOR.map((item) => [item.id, item]));

export const SLOT_LABEL: Record<DecorSlot, string> = {
  window: '窗边',
  door: '门牌',
  carpet: '地毯',
  shelf: '货架',
  wall: '墙面',
};

export interface PetDef {
  id: string;
  name: string;
  species: string;
  personality: string;
  story: string;
  likes: string;
  zone: string;
}

export const PETS: PetDef[] = [
  { id: 'dahuang', name: '大黄', species: '橘白中华田园猫', personality: '慢热，爱晒太阳', story: '大约 8 岁，常驻在店里，还在把这里当成家。', likes: '窗边的阳光，以及你不伸手的时候。', zone: '窗台' },
  { id: 'naipao', name: '奶泡', species: '布偶猫', personality: '安静，对突然靠近会躲开', story: '常驻。喜欢窗边的软垫，不喜欢被抱起来。', likes: '自己的软垫，和没有脚步声的下午。', zone: '窗边软垫' },
  { id: 'doubao', name: '豆包', species: '柯基', personality: '活泼，爱闻纸袋', story: '常驻。每天都有自己的散步节奏。', likes: '纸袋、出门前的停顿，以及清楚的约定。', zone: '门口地面' },
  { id: 'wuyun', name: '乌云', species: '黑色田园猫', personality: '机警，慢慢才肯靠近', story: '待领养。先住在单独的安静房间，不和前厅的猫狗混在一起。', likes: '自己的房间，以及没有人伸手的时候。', zone: '安静房间' },
  { id: 'zhima', name: '芝麻', species: '兔子', personality: '安静，喜欢探纸屋', story: '待领养。住在独立的安静区域，不进猫狗的活动区。', likes: '纸屋和单独的草，不吃猫狗的粮食。', zone: '兔区' },
  { id: 'nuomi', name: '糯米', species: '仓鼠', personality: '傍晚活跃，喜欢藏粮', story: '待领养。有自己的小房子，白天多半在休息。', likes: '自己的粮食和关上的小房子。', zone: '仓鼠居所' },
];

export const PET_MAP: Record<string, PetDef> = Object.fromEntries(PETS.map((item) => [item.id, item]));

export interface EmployeeDef {
  id: string;
  name: string;
  age: number;
  role: string;
  lookText: string;
  duty: string;
  shiftStart: string;
  shiftEnd: string;
  look: Look;
}

export const EMPLOYEES: Record<string, EmployeeDef> = {
  su_tao: {
    id: 'su_tao',
    name: '苏桃',
    age: 26,
    role: '美容师',
    lookText: '丸子头，蜜桃围裙，细心，爱笑。',
    duty: '细心、爱笑。基础梳理和美容预约。',
    shiftStart: '09:00',
    shiftEnd: '17:00',
    look: { hairStyle: 'bun', hairColor: '#3D342C', apron: '#F4B8A4', shirt: '#F8E7D8', glasses: false, accent: '#E7A15A' },
  },
  lin_xu: {
    id: 'lin_xu',
    name: '林序',
    age: 29,
    role: '护理员',
    lookText: '短发，浅绿马甲，沉稳温和。',
    duty: '沉稳。日常观察、环境和护理记录。不诊断，不打针。',
    shiftStart: '11:00',
    shiftEnd: '19:00',
    look: { hairStyle: 'short', hairColor: '#3F3A36', apron: '#C9E2D4', shirt: '#F4F0E8', glasses: false, accent: '#8FBF9F' },
  },
  tang_li: {
    id: 'tang_li',
    name: '唐栗',
    age: 23,
    role: '销售顾问',
    lookText: '卷发，圆框眼镜，健谈，但不强推。',
    duty: '健谈，重视需求。商品和常客记录。客人拒绝也没关系。',
    shiftStart: '14:30',
    shiftEnd: '22:30',
    look: { hairStyle: 'curly', hairColor: '#6B442F', apron: '#F6E3A1', shirt: '#F7F1E8', glasses: true, accent: '#E2B56A' },
  },
};

export interface CustomerDef {
  id: string;
  name: string;
  role: string;
  pet: string;
  look: Look;
}

export const CUSTOMERS: Record<string, CustomerDef> = {
  chen_jie: {
    id: 'chen_jie',
    name: '陈姐',
    role: '街对面的邻居',
    pet: '家里的老猫今天没出门',
    look: { hairStyle: 'bob', hairColor: '#4A372C', apron: '#E7D3C1', shirt: '#F7EFE4', glasses: false, accent: '#C4A574' },
  },
  he_fang: {
    id: 'he_fang',
    name: '何芳',
    role: '花店老板娘',
    pet: '小贵宾布丁',
    look: { hairStyle: 'bun', hairColor: '#2F2A28', apron: '#A8D5BA', shirt: '#F8EFE6', glasses: false, accent: '#E07A7A' },
  },
  liang: {
    id: 'liang',
    name: '梁老师',
    role: '退休老师',
    pet: '柯基豆豆',
    look: { hairStyle: 'short', hairColor: '#6E5A48', apron: '#E6D5B8', shirt: '#F6F1E6', glasses: true, accent: '#B9D8E8' },
  },
  xu_aunt: {
    id: 'xu_aunt',
    name: '许阿姨',
    role: '常在雨天路过',
    pet: '奶油色贵宾黄油',
    look: { hairStyle: 'bob', hairColor: '#5C4034', apron: '#F4C9B0', shirt: '#F8F3EA', glasses: false, accent: '#F6D88B' },
  },
  aning: {
    id: 'aning',
    name: '阿宁',
    role: '大学城的学生',
    pet: '室友的猫，今天没一起来',
    look: { hairStyle: 'curly', hairColor: '#3D342C', apron: '#F7D7C8', shirt: '#F4F7F8', glasses: true, accent: '#B9D8E8' },
  },
  zhou_wan: {
    id: 'zhou_wan',
    name: '周晚',
    role: '刚开始养猫的上班族',
    pet: '小猫团子',
    look: { hairStyle: 'bob', hairColor: '#3D342C', apron: '#F6E0D8', shirt: '#F7F4EF', glasses: false, accent: '#E7A15A' },
  },
  xiao_qiao: {
    id: 'xiao_qiao',
    name: '小乔',
    role: '夜班护士',
    pet: '今天没有带宠物',
    look: { hairStyle: 'bun', hairColor: '#4A372C', apron: '#E7EEF2', shirt: '#F7F1E8', glasses: false, accent: '#B9D8E8' },
  },
  zhao_ye: {
    id: 'zhao_ye',
    name: '赵爷爷',
    role: '养龟的老邻居',
    pet: '乌龟慢吞吞',
    look: { hairStyle: 'short', hairColor: '#6E5A48', apron: '#E6D5B8', shirt: '#F6F1E6', glasses: true, accent: '#A8D5BA' },
  },
  lin_yi: {
    id: 'lin_yi',
    name: '林姨',
    role: '社区志愿者',
    pet: '来贴公告，没带宠物',
    look: { hairStyle: 'bob', hairColor: '#5C4034', apron: '#C9E2D4', shirt: '#F8F3EA', glasses: false, accent: '#F6D88B' },
  },
  shen_he: {
    id: 'shen_he',
    name: '沈禾',
    role: '领养志愿者',
    pet: '在帮黑猫乌云找家',
    look: { hairStyle: 'short', hairColor: '#3D342C', apron: '#C9D7C4', shirt: '#F7F1E8', glasses: false, accent: '#A8D5BA' },
  },
  zhou_shu: {
    id: 'zhou_shu',
    name: '周叔',
    role: '带着年长的狗散步',
    pet: '老狗木木',
    look: { hairStyle: 'short', hairColor: '#5C4034', apron: '#E6D5B8', shirt: '#F4EFE6', glasses: false, accent: '#C4A574' },
  },
  a_mai: {
    id: 'a_mai',
    name: '阿麦',
    role: '隔壁尾巴铺的店主',
    pet: '今天没有带动物',
    look: { hairStyle: 'curly', hairColor: '#4A372C', apron: '#F6E3A1', shirt: '#F7F1E8', glasses: true, accent: '#E7A15A' },
  },
};

export interface PortraitDef {
  id: string;
  hair: string;
  outfit: string;
  look: Look;
}

export const PORTRAITS: PortraitDef[] = [
  { id: 'p1', hair: '栗色短发', outfit: '米色上衣，薄荷绿围裙', look: { hairStyle: 'bob', hairColor: '#8C5A3C', apron: '#A8D5BA', shirt: '#F3E6D4', glasses: true, accent: '#F4B8A4' } },
  { id: 'p2', hair: '黑色低丸子', outfit: '杏桃色上衣，原木色围裙', look: { hairStyle: 'bun', hairColor: '#3D342C', apron: '#E6C7A8', shirt: '#F6D7CC', glasses: false, accent: '#E7A15A' } },
  { id: 'p3', hair: '深棕微卷', outfit: '白衬衫，淡蓝围裙', look: { hairStyle: 'curly', hairColor: '#5C4030', apron: '#B9D8E8', shirt: '#F7F1E8', glasses: true, accent: '#A8D5BA' } },
  { id: 'p4', hair: '蜂蜜色齐肩', outfit: '暖黄内搭，蜜桃围裙', look: { hairStyle: 'bob', hairColor: '#C48A4A', apron: '#F4B8A4', shirt: '#F8E7C2', glasses: false, accent: '#F6D88B' } },
];

export const OWNER_NAMES = ['祁见禾', '林晚星', '陈糯米', '苏小满', '周念安', '许清和', '江软软', '沈知夏'];
export const HEIGHTS = [158, 162, 165, 168, 170, 172];

export const PERSONALITIES: { id: PersonalityId; name: string; text: string }[] = [
  { id: 'kind', name: '耐心亲切', text: '客人的好感会多 1 点。' },
  { id: 'careful', name: '细心', text: '少量耗材会少损耗 1 点。' },
  { id: 'bright', name: '爽朗热心', text: '接待客人时，人气会多 1 点。' },
  { id: 'calm', name: '安静沉稳', text: '照顾小店时，羁绊会多 1 点。' },
];

export const TRAIN_COSTS = [300, 800, 1500] as const;

export const SERVICES = [
  { name: '基础梳理', price: 35, level: 1, open: true },
  { name: '小型犬基础洗护', price: 80, level: 1, open: true },
  { name: '修甲', price: 20, level: 1, open: true },
  { name: '宠物照片', price: 45, level: 3, open: false },
  { name: '生日布景', price: 120, level: 5, open: false },
  { name: '预约陪伴', price: 50, level: 5, open: false },
];

export const LEVEL_NOTES: Record<number, string> = {
  2: '常客手账会把已经确认的偏好写清楚。',
  3: '宠物照片和相框还在准备，墙上先留了位置。',
  5: '员工培训开了。一次培训用掉 1 次行动，也要付店铺金。',
  8: '领养回访墙会在后面的章节出现。',
  10: '新的区域还在后面。经验会继续记，内容尚未开放。',
};

export function styleOf(id: ShopStyle): StyleDef {
  return STYLES.find((item) => item.id === id) ?? STYLES[0]!;
}

export function portraitOf(id: string): PortraitDef {
  return PORTRAITS.find((item) => item.id === id) ?? PORTRAITS[0]!;
}
