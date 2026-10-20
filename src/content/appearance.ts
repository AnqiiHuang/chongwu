import type { Appearance } from '../game/types';

export interface PartOption {
  id: string;
  name: string;
}

export const HAIR_OPTIONS: PartOption[] = [
  { id: 'hair.chestnut_bob', name: '栗色短发' },
  { id: 'hair.black_bun', name: '黑色低发髻' },
  { id: 'hair.brown_waves', name: '深棕卷发' },
  { id: 'hair.honey_shoulder', name: '蜜糖色披肩发' },
];

export const TOP_OPTIONS: PartOption[] = [
  { id: 'top.ivory_blouse', name: '奶油衬衫' },
  { id: 'top.peach_short', name: '蜜桃短袖' },
  { id: 'top.blue_stripe', name: '蓝色条纹衬衫' },
  { id: 'top.mustard_cardigan', name: '芥末黄开衫' },
];

export const APRON_OPTIONS: PartOption[] = [
  { id: 'apron.sage_paw', name: '苔绿爪印' },
  { id: 'apron.peach_flower', name: '蜜桃小花' },
  { id: 'apron.blue_flower', name: '雾蓝小花' },
  { id: 'apron.oatmeal_pockets', name: '燕麦棕口袋' },
];

export const SHOE_OPTIONS: PartOption[] = [
  { id: 'shoes.brown_boots', name: '棕色短靴' },
  { id: 'shoes.cream_sneakers', name: '奶油运动鞋' },
  { id: 'shoes.brown_straps', name: '棕色搭扣鞋' },
  { id: 'shoes.slate_canvas', name: '蓝灰帆布鞋' },
];

export const DEFAULT_APPEARANCE: Appearance = {
  hairId: 'hair.chestnut_bob',
  topId: 'top.ivory_blouse',
  apronId: 'apron.sage_paw',
  shoesId: 'shoes.brown_boots',
};

const KNOWN = new Set(
  [...HAIR_OPTIONS, ...TOP_OPTIONS, ...APRON_OPTIONS, ...SHOE_OPTIONS].map((item) => item.id),
);

export function appearanceOk(value: Appearance | null | undefined): value is Appearance {
  return !!value && KNOWN.has(value.hairId) && KNOWN.has(value.topId) && KNOWN.has(value.apronId) && KNOWN.has(value.shoesId);
}

export function partName(id: string): string {
  return [...HAIR_OPTIONS, ...TOP_OPTIONS, ...APRON_OPTIONS, ...SHOE_OPTIONS].find((item) => item.id === id)?.name ?? id;
}
