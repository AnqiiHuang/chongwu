import { useEffect, useRef, useState } from 'react';
import { frameBackground, frameOf, loadImage } from '../content/assets';
import metrics from '../content/figure-metrics.json';
import { INTERIOR_MAP } from '../content/interiors';
import {
  BODY,
  LANDMARKS,
  LONG_HAIR,
  MALE_SCALE,
  ORIGIN,
  PORTRAIT,
  SHOE_WIDTH,
  STAGE,
  partBox,
  stageBox,
  type Box,
} from '../content/rig';
import { STAFF_FRAME, type HireId } from '../game/roster';
import type { Appearance, ShopStyle, Weather } from '../game/types';

interface FigureMetric {
  male: boolean;
  crown: number;
  foot: number;
  focusX: number;
  focusY: number;
  opaque: number[];
}

const FIGURES = metrics as Record<string, FigureMetric>;

export function AssetSprite({
  frameId,
  height,
  label,
}: {
  frameId: string;
  height: number;
  label: string;
}) {
  const frame = frameOf(frameId);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!frame) return;
    let cancel = false;
    setFailed(false);
    loadImage(frame.url).catch(() => {
      if (!cancel) setFailed(true);
    });
    return () => {
      cancel = true;
    };
  }, [frame, attempt]);
  if (!frame) return null;
  if (failed) {
    return (
      <button className="btn ghost" type="button" onClick={() => setAttempt((value) => value + 1)}>
        {label}没载入，重试
      </button>
    );
  }
  const scale = height / frame.rect.h;
  const width = Math.max(1, Math.round(frame.rect.w * scale));
  return (
    <span
      className="pixel-sprite"
      role="img"
      aria-label={label}
      style={{
        width,
        height,
        backgroundImage: `url(${frame.url})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${frame.image.width * scale}px ${frame.image.height * scale}px`,
        backgroundPosition: `-${frame.rect.x * scale}px -${frame.rect.y * scale}px`,
      }}
    />
  );
}

function isSkin(r: number, g: number, b: number, a: number): boolean {
  return a > 40 && r > 210 && g > 150 && r > b + 15;
}

function blit(ctx: CanvasRenderingContext2D, image: HTMLImageElement, frameId: string, box: Box): void {
  const frame = frameOf(frameId);
  if (!frame) return;
  const dest = stageBox(box);
  ctx.drawImage(image, frame.rect.x, frame.rect.y, frame.rect.w, frame.rect.h, dest.x, dest.y, dest.w, dest.h);
}

function shoeSplit(image: HTMLImageElement, frameId: string): number {
  const frame = frameOf(frameId);
  if (!frame) return 0;
  const { x, y, w, h } = frame.rect;
  let best = Number.POSITIVE_INFINITY;
  let at = x + Math.floor(w / 2);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return at;
  ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let col = Math.floor(w * 0.35); col < Math.floor(w * 0.65); col += 1) {
    let hits = 0;
    for (let row = 0; row < h; row += 2) {
      if (data[(row * w + col) * 4 + 3]! > 30) hits += 1;
    }
    if (hits < best) {
      best = hits;
      at = col;
    }
  }
  return at;
}

export interface RigDrawOptions {
  backHair?: boolean;
  body?: boolean;
  shoes?: boolean;
  cuff?: boolean;
  top?: boolean;
  apron?: boolean;
  frontHair?: boolean;
  guides?: boolean;
  shoeWidth?: number;
  shoeDy?: number;
  boxes?: Partial<Record<'hair' | 'top' | 'apron', Box>>;
}

function drawRig(
  ctx: CanvasRenderingContext2D,
  appearance: Appearance,
  images: Map<string, HTMLImageElement>,
  options: RigDrawOptions = {},
): void {
  const show = {
    backHair: true,
    body: true,
    shoes: true,
    cuff: true,
    top: true,
    apron: true,
    frontHair: true,
    guides: false,
    ...options,
  };
  const base = frameOf('owner.base');
  const baseImage = base ? images.get(base.url) : undefined;
  const hairFrame = frameOf(appearance.hairId);
  const hairImage = hairFrame ? images.get(hairFrame.url) : undefined;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, STAGE.w, STAGE.h);

  const hair = options.boxes?.hair ?? partBox(appearance, 'hair');
  const long = LONG_HAIR.has(appearance.hairId);
  if (hairImage && long && show.backHair) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, ORIGIN.y + 400, STAGE.w, STAGE.h);
    ctx.clip();
    blit(ctx, hairImage, appearance.hairId, hair);
    ctx.restore();
  }

  if (base && baseImage && show.body) {
    ctx.drawImage(baseImage, base.rect.x, base.rect.y, base.rect.w, base.rect.h, ORIGIN.x, ORIGIN.y, BODY.w, BODY.h);
    const feet = ctx.getImageData(ORIGIN.x + 180, ORIGIN.y + 1222, 250, BODY.h - 1222);
    const data = feet.data;
    for (let i = 0; i < data.length; i += 4) data[i + 3] = 0;
    ctx.putImageData(feet, ORIGIN.x + 180, ORIGIN.y + 1222);
  }

  const shoeFrame = frameOf(appearance.shoesId);
  const shoeImage = shoeFrame ? images.get(shoeFrame.url) : undefined;
  const placements: { slice: HTMLCanvasElement; sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number }[] = [];
  if (shoeImage && shoeFrame && (show.shoes || show.cuff)) {
    const split = shoeSplit(shoeImage, appearance.shoesId);
    const width = options.shoeWidth ?? SHOE_WIDTH[appearance.shoesId] ?? 90;
    const halves = [
      { sx: 0, sw: split, ax: LANDMARKS.ankleL.x },
      { sx: split, sw: shoeFrame.rect.w - split, ax: LANDMARKS.ankleR.x },
    ];
    for (const half of halves) {
      if (half.sw <= 0) continue;
      const slice = document.createElement('canvas');
      slice.width = half.sw;
      slice.height = shoeFrame.rect.h;
      const sctx = slice.getContext('2d', { willReadFrequently: true });
      if (!sctx) continue;
      sctx.drawImage(shoeImage, shoeFrame.rect.x + half.sx, shoeFrame.rect.y, half.sw, shoeFrame.rect.h, 0, 0, half.sw, shoeFrame.rect.h);
      const pixels = sctx.getImageData(0, 0, slice.width, slice.height);
      const data = pixels.data;
      let minX = slice.width;
      let minY = slice.height;
      let maxX = 0;
      let maxY = 0;
      for (let y = 0; y < slice.height; y += 1) {
        for (let x = 0; x < slice.width; x += 1) {
          const i = (y * slice.width + x) * 4;
          if (data[i + 3]! <= 24) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      if (maxX < minX) continue;
      const opening = minY + (maxY - minY) * 0.28;
      for (let y = minY; y <= opening; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const i = (y * slice.width + x) * 4;
          if (isSkin(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!)) data[i + 3] = 0;
        }
      }
      sctx.putImageData(pixels, 0, 0);
      const ow = maxX - minX + 1;
      const oh = maxY - minY + 1;
      const dh = Math.max(1, Math.round(oh * (width / ow)));
      const dx = Math.round(ORIGIN.x + half.ax - width / 2);
      const dy = Math.round(ORIGIN.y + LANDMARKS.soleY - dh + 1 + (options.shoeDy ?? 0));
      placements.push({ slice, sx: minX, sy: minY, sw: ow, sh: oh, dx, dy, dw: width, dh });
    }
  }

  const collar = 14;
  if (show.cuff && placements.length) {
    for (const shoe of placements) {
      const region = ctx.getImageData(shoe.dx, shoe.dy, shoe.dw, collar);
      const data = region.data;
      for (let i = 0; i < data.length; i += 4) {
        if (isSkin(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!)) data[i + 3] = 0;
      }
      const below = ctx.getImageData(shoe.dx, shoe.dy + collar, shoe.dw, Math.max(1, shoe.dh - collar));
      for (let i = 0; i < below.data.length; i += 4) below.data[i + 3] = 0;
      ctx.putImageData(below, shoe.dx, shoe.dy + collar);
      shoe.slice.dataset['collar'] = JSON.stringify(Array.from(region.data));
    }
  }

  if (show.shoes) {
    for (const shoe of placements) {
      ctx.drawImage(shoe.slice, shoe.sx, shoe.sy, shoe.sw, shoe.sh, shoe.dx, shoe.dy, shoe.dw, shoe.dh);
    }
  }

  if (show.cuff) {
    for (const shoe of placements) {
      const raw = shoe.slice.dataset['collar'];
      if (!raw) continue;
      const saved = Uint8ClampedArray.from(JSON.parse(raw) as number[]);
      const current = ctx.getImageData(shoe.dx, shoe.dy, shoe.dw, collar);
      for (let i = 0; i < saved.length; i += 4) {
        if (saved[i + 3]! <= 24) continue;
        current.data[i] = saved[i]!;
        current.data[i + 1] = saved[i + 1]!;
        current.data[i + 2] = saved[i + 2]!;
        current.data[i + 3] = saved[i + 3]!;
      }
      ctx.putImageData(current, shoe.dx, shoe.dy);
    }
  }

  const topFrame = frameOf(appearance.topId);
  const topImage = topFrame ? images.get(topFrame.url) : undefined;
  if (topImage && show.top) blit(ctx, topImage, appearance.topId, options.boxes?.top ?? partBox(appearance, 'top'));
  const apronFrame = frameOf(appearance.apronId);
  const apronImage = apronFrame ? images.get(apronFrame.url) : undefined;
  if (apronImage && show.apron) blit(ctx, apronImage, appearance.apronId, options.boxes?.apron ?? partBox(appearance, 'apron'));

  if (hairImage && show.frontHair) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, STAGE.w, ORIGIN.y + (long ? 470 : STAGE.h));
    ctx.clip();
    blit(ctx, hairImage, appearance.hairId, hair);
    ctx.restore();
  }

  if (show.guides) {
    ctx.save();
    ctx.strokeStyle = 'rgba(220, 60, 60, 0.9)';
    ctx.lineWidth = 2;
    const lines = [LANDMARKS.eye.y, LANDMARKS.chin.y, LANDMARKS.shoulderY, LANDMARKS.waistY, LANDMARKS.ankleL.y, LANDMARKS.soleY];
    for (const y of lines) {
      ctx.beginPath();
      ctx.moveTo(0, ORIGIN.y + y);
      ctx.lineTo(STAGE.w, ORIGIN.y + y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(220, 60, 60, 0.95)';
    ctx.beginPath();
    ctx.arc(ORIGIN.x + LANDMARKS.headCenter.x, ORIGIN.y + LANDMARKS.headCenter.y, 6, 0, Math.PI * 2);
    ctx.fill();
    for (const ankle of [LANDMARKS.ankleL, LANDMARKS.ankleR]) {
      ctx.beginPath();
      ctx.arc(ORIGIN.x + ankle.x, ORIGIN.y + ankle.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeRect(0.5, 0.5, STAGE.w - 1, STAGE.h - 1);
    ctx.restore();
  }
}

function useImages(urls: string[]): { images: Map<string, HTMLImageElement> | null; failed: boolean; retry: () => void } {
  const [images, setImages] = useState<Map<string, HTMLImageElement> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancel = false;
    setFailed(false);
    Promise.all(urls.map((url) => loadImage(url)))
      .then((loaded) => {
        if (!cancel) setImages(new Map(urls.map((url, index) => [url, loaded[index]!])));
      })
      .catch(() => {
        if (!cancel) setFailed(true);
      });
    return () => {
      cancel = true;
    };
  }, [urls.join('|'), attempt]);
  return { images, failed, retry: () => setAttempt((value) => value + 1) };
}

function rigUrls(appearance: Appearance): string[] {
  const ids = ['owner.base', appearance.hairId, appearance.topId, appearance.apronId, appearance.shoesId];
  return [...new Set(ids.map((id) => frameOf(id)?.url).filter((url): url is string => !!url))];
}

export function paintRig(
  canvas: HTMLCanvasElement,
  appearance: Appearance,
  images: Map<string, HTMLImageElement>,
  options?: RigDrawOptions,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawRig(ctx, appearance, images, options);
}

export function OwnerDoll({
  appearance,
  bodyHeight = 420,
  label = '店主',
  guides = false,
  layers,
}: {
  appearance: Appearance;
  bodyHeight?: number;
  label?: string;
  guides?: boolean;
  layers?: RigDrawOptions;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const urls = rigUrls(appearance);
  const { images, failed, retry } = useImages(urls);
  const layerKey = JSON.stringify(layers ?? null);
  useEffect(() => {
    if (!canvas.current || !images) return;
    paintRig(canvas.current, appearance, images, { ...layers, guides });
  }, [appearance, images, guides, layerKey, layers]);
  if (failed) {
    return (
      <button className="btn ghost" type="button" onClick={retry}>
        店主形象没载入，重试
      </button>
    );
  }
  const height = Math.round(bodyHeight * (STAGE.h / BODY.h));
  return (
    <canvas
      ref={canvas}
      className="owner-doll"
      width={STAGE.w}
      height={STAGE.h}
      aria-label={label}
      style={{ height, width: 'auto' }}
    />
  );
}

export function OwnerPortrait({
  appearance,
  size,
  label = '店主头像',
}: {
  appearance: Appearance;
  size: number;
  label?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const urls = rigUrls(appearance);
  const { images, failed, retry } = useImages(urls);
  useEffect(() => {
    const node = canvas.current;
    if (!node || !images) return;
    const source = document.createElement('canvas');
    source.width = STAGE.w;
    source.height = STAGE.h;
    paintRig(source, appearance, images);
    const ctx = node.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(source, PORTRAIT.x, PORTRAIT.y, PORTRAIT.size, PORTRAIT.size, 0, 0, size, size);
  }, [appearance, images, size]);
  if (failed) {
    return (
      <button className="btn ghost" type="button" onClick={retry}>
        头像没载入，重试
      </button>
    );
  }
  return <canvas ref={canvas} className="owner-doll" width={size} height={size} aria-label={label} style={{ width: size, height: size }} />;
}

export function StandingSprite({
  frameId,
  bodyHeight,
  label,
}: {
  frameId: string;
  bodyHeight: number;
  label: string;
}) {
  const frame = frameOf(frameId);
  const metric = FIGURES[frameId];
  if (!frame) return null;
  const foot = metric?.foot ?? frame.rect.h - 1;
  const opaqueX = metric?.opaque[0] ?? 0;
  const opaqueY = metric?.opaque[1] ?? 0;
  const opaqueW = metric?.opaque[2] ?? frame.rect.w;
  const body = Math.max(1, (metric?.foot ?? frame.rect.h - 1) - (metric?.crown ?? 0));
  const scale = (bodyHeight * (metric?.male ? MALE_SCALE : 1)) / body;
  const width = Math.max(1, Math.round(opaqueW * scale));
  const height = Math.max(1, Math.round((foot - opaqueY + 1) * scale));
  return (
    <span
      className="pixel-sprite"
      role="img"
      aria-label={label}
      style={{
        width,
        height,
        backgroundImage: `url(${frame.url})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${frame.image.width * scale}px ${frame.image.height * scale}px`,
        backgroundPosition: `-${(frame.rect.x + opaqueX) * scale}px -${(frame.rect.y + opaqueY) * scale}px`,
      }}
    />
  );
}

export function SpritePortrait({
  frameId,
  size,
  label,
}: {
  frameId: string;
  size: number;
  label: string;
}) {
  const frame = frameOf(frameId);
  const metric = FIGURES[frameId];
  if (!frame || !metric) return <StandingSprite frameId={frameId} bodyHeight={size} label={label} />;
  const crop = Math.round(metric.opaque[3] * 0.72);
  const scale = size / crop;
  const focusX = frame.rect.x + metric.focusX;
  const focusY = frame.rect.y + metric.focusY;
  const left = focusX - crop / 2;
  const top = focusY - crop * 0.43;
  return (
    <span
      className="pixel-sprite"
      role="img"
      aria-label={label}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${frame.url})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${frame.image.width * scale}px ${frame.image.height * scale}px`,
        backgroundPosition: `-${left * scale}px -${top * scale}px`,
      }}
    />
  );
}

export function PixelShop({
  styleId,
  shopName,
  weather,
  appearance,
  staffIds,
  showPets,
  warmLight,
}: {
  styleId: ShopStyle;
  shopName: string;
  weather: Weather;
  appearance: Appearance | null;
  staffIds: HireId[];
  showPets: boolean;
  warmLight: boolean;
}) {
  const scene = useRef<HTMLDivElement>(null);
  const [sceneH, setSceneH] = useState(360);
  useEffect(() => {
    const node = scene.current;
    if (!node) return;
    const measure = () => setSceneH(node.clientHeight || 360);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const interior = INTERIOR_MAP[styleId] ?? INTERIOR_MAP.japanese_wood;
  const frame = frameOf(interior.frameId);
  const body = Math.max(72, Math.round((sceneH * interior.owner.h) / 100));
  const tint = weather === 'rain' ? 'rgba(70, 96, 120, 0.14)' : weather === 'cloudy' ? 'rgba(120, 120, 130, 0.08)' : 'rgba(255, 214, 150, 0.08)';
  return (
    <div className="pixel-scene" ref={scene}>
      {frame && (
        <span className="pixel-scene-bg" role="img" aria-label={interior.name} style={frameBackground(frame)} />
      )}
      <span className="scene-tint" style={{ background: tint }} />
      {warmLight && <span className="scene-tint" style={{ background: 'rgba(255, 196, 120, 0.12)' }} />}
      <strong className="scene-sign">{shopName}</strong>
      {showPets &&
        Object.entries(interior.pets).map(([id, spot]) => (
          <span key={id} className="scene-actor" style={{ left: `${spot.x}%`, top: `${spot.y}%` }}>
            <AssetSprite frameId={`${id}.front`} height={Math.max(28, Math.round((sceneH * spot.h) / 100))} label={id} />
          </span>
        ))}
      {staffIds.map((id, index) => {
        const spot = interior.staff[Math.min(index, interior.staff.length - 1)] ?? interior.owner;
        return (
          <span key={id} className="scene-actor" style={{ left: `${spot.x + index * 8}%`, top: `${interior.owner.y}%` }}>
            <StandingSprite frameId={STAFF_FRAME[id]} bodyHeight={body} label={id} />
          </span>
        );
      })}
      {appearance && (
        <span className="scene-actor" style={{ left: `${interior.owner.x}%`, top: `${interior.owner.y}%` }}>
          <OwnerDoll appearance={appearance} bodyHeight={body} />
        </span>
      )}
    </div>
  );
}
