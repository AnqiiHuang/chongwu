import type { ShopStyle } from '../game/types';

export interface StandingSpot {
  x: number;
  y: number;
  h: number;
}

export interface InteriorDefinition {
  styleId: ShopStyle;
  frameId: string;
  name: string;
  text: string;
  owner: StandingSpot;
  staff: StandingSpot[];
  pets: Record<string, StandingSpot>;
}

export const INTERIORS: InteriorDefinition[] = [
  {
    styleId: 'japanese_wood',
    frameId: 'interior.japanese_wood',
    name: '日系原木治愈风',
    text: '木梁、暖木货架、爪印地毯、暖色窗光。',
    owner: { x: 54, y: 92, h: 36 },
    staff: [{ x: 72, y: 88, h: 30 }],
    pets: {
      dahuang: { x: 40, y: 64, h: 12 },
      naipao: { x: 24, y: 58, h: 9 },
      doubao: { x: 82, y: 84, h: 11 },
    },
  },
  {
    styleId: 'nordic_nature',
    frameId: 'interior.nordic_nature',
    name: '北欧自然风',
    text: '大窗、浅木地板、藤编灯、绿植和浅色家具。',
    owner: { x: 50, y: 91, h: 36 },
    staff: [{ x: 68, y: 87, h: 30 }],
    pets: {
      dahuang: { x: 30, y: 86, h: 10 },
      naipao: { x: 42, y: 82, h: 10 },
      doubao: { x: 78, y: 80, h: 11 },
    },
  },
  {
    styleId: 'vintage_academy',
    frameId: 'interior.vintage_academy',
    name: '复古宠物学院风',
    text: '拱窗、深木书柜、格纹软装、黑板与小旗。',
    owner: { x: 48, y: 91, h: 34 },
    staff: [{ x: 66, y: 87, h: 28 }],
    pets: {
      dahuang: { x: 26, y: 72, h: 11 },
      naipao: { x: 38, y: 80, h: 10 },
      doubao: { x: 74, y: 82, h: 11 },
    },
  },
  {
    styleId: 'modern_minimal',
    frameId: 'interior.modern_minimal',
    name: '现代简约风',
    text: '弧形窗、奶油墙面、圆角浅木柜台、简洁留白。',
    owner: { x: 64, y: 90, h: 34 },
    staff: [{ x: 80, y: 86, h: 28 }],
    pets: {
      dahuang: { x: 24, y: 70, h: 11 },
      naipao: { x: 36, y: 76, h: 10 },
      doubao: { x: 50, y: 84, h: 11 },
    },
  },
  {
    styleId: 'soft_industrial',
    frameId: 'interior.soft_industrial',
    name: '轻工业风',
    text: '红砖、黑铁货架、木台面、暖灯与绿植。',
    owner: { x: 50, y: 92, h: 34 },
    staff: [{ x: 68, y: 88, h: 28 }],
    pets: {
      dahuang: { x: 28, y: 74, h: 11 },
      naipao: { x: 38, y: 80, h: 10 },
      doubao: { x: 80, y: 84, h: 11 },
    },
  },
  {
    styleId: 'cute_pets',
    frameId: 'interior.cute_pets',
    name: '可爱宠物风',
    text: '桃粉窗帘、爪印地毯、圆形软垫、可爱货架。',
    owner: { x: 42, y: 88, h: 32 },
    staff: [{ x: 56, y: 84, h: 26 }],
    pets: {
      dahuang: { x: 32, y: 84, h: 9 },
      naipao: { x: 26, y: 78, h: 8 },
      doubao: { x: 58, y: 70, h: 8 },
    },
  },
];

export const INTERIOR_MAP: Record<ShopStyle, InteriorDefinition> = Object.fromEntries(
  INTERIORS.map((item) => [item.styleId, item]),
) as Record<ShopStyle, InteriorDefinition>;

export const LOCATIONS: { id: string; frameId: string }[] = [
  { id: 'residential', frameId: 'location.residential' },
  { id: 'old_town', frameId: 'location.old_town' },
  { id: 'university', frameId: 'location.university' },
  { id: 'clinic', frameId: 'location.clinic' },
];
