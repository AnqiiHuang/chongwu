import type { Appearance } from '../game/types';

/** Body-space box: x, y, width, height. Y grows downward from the skull top. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The bald base is drawn 1:1. Hair may start above y = 0, so the stage is padded. */
export const ORIGIN = { x: 48, y: 96 };
export const BODY = { w: 595, h: 1305 };
export const STAGE = { w: BODY.w + ORIGIN.x * 2, h: BODY.h + ORIGIN.y };

export const LANDMARKS = {
  headCenter: { x: 298, y: 190 },
  eye: { x: 298, y: 244 },
  chin: { x: 298, y: 386 },
  shoulderY: 452,
  waistY: 712,
  ankleL: { x: 250, y: 1224 },
  ankleR: { x: 344, y: 1224 },
  soleY: 1304,
};

/** Eyes sit at 43% of this square, in stage pixels. Same window for every avatar size. */
export const PORTRAIT = {
  x: ORIGIN.x + LANDMARKS.eye.x - 320,
  y: ORIGIN.y + LANDMARKS.eye.y - 275,
  size: 640,
};

export const MALE_SCALE = 1.08;

export const HAIR_BOX: Record<string, Box> = {
  'hair.chestnut_bob': { x: 42, y: -52, w: 510, h: 470 },
  'hair.black_bun': { x: 58, y: -78, w: 480, h: 540 },
  'hair.brown_waves': { x: 24, y: -46, w: 546, h: 530 },
  'hair.honey_shoulder': { x: 36, y: -42, w: 524, h: 510 },
};

/** Long hair is split: strands below the chin go behind the body, bangs stay in front. */
export const LONG_HAIR = new Set(['hair.black_bun', 'hair.brown_waves', 'hair.honey_shoulder']);

export const TOP_BOX: Record<string, Box> = {
  'top.ivory_blouse': { x: 4, y: 400, w: 586, h: 360 },
  'top.peach_short': { x: 8, y: 348, w: 580, h: 360 },
  'top.blue_stripe': { x: 8, y: 396, w: 580, h: 370 },
  'top.mustard_cardigan': { x: 16, y: 392, w: 564, h: 330 },
};

export const APRON_BOX: Record<string, Box> = {
  'apron.sage_paw': { x: 128, y: 448, w: 340, h: 560 },
  'apron.peach_flower': { x: 136, y: 446, w: 328, h: 570 },
  'apron.blue_flower': { x: 124, y: 448, w: 348, h: 570 },
  'apron.oatmeal_pockets': { x: 130, y: 442, w: 336, h: 580 },
};

export const SHOE_WIDTH: Record<string, number> = {
  'shoes.brown_boots': 96,
  'shoes.cream_sneakers': 90,
  'shoes.brown_straps': 90,
  'shoes.slate_canvas': 90,
};

export function stageBox(box: Box): Box {
  return { x: box.x + ORIGIN.x, y: box.y + ORIGIN.y, w: box.w, h: box.h };
}

export function partBox(appearance: Appearance, kind: 'hair' | 'top' | 'apron'): Box {
  if (kind === 'hair') return HAIR_BOX[appearance.hairId] ?? HAIR_BOX['hair.chestnut_bob']!;
  if (kind === 'top') return TOP_BOX[appearance.topId] ?? TOP_BOX['top.ivory_blouse']!;
  return APRON_BOX[appearance.apronId] ?? APRON_BOX['apron.sage_paw']!;
}

export function rigConfig() {
  return {
    origin: ORIGIN,
    body: BODY,
    stage: STAGE,
    landmarks: LANDMARKS,
    portrait: PORTRAIT,
    hair: HAIR_BOX,
    top: TOP_BOX,
    apron: APRON_BOX,
    shoeWidth: SHOE_WIDTH,
    longHair: [...LONG_HAIR],
  };
}
