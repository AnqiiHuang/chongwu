import raw from './asset-manifest.json';

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FrameDef {
  imageId: string;
  rect: SpriteRect;
  entityId: string | null;
  role: string;
  reviewRequired: boolean;
  requiresAlignment?: boolean;
}

interface ImageDef {
  imagePath: string;
  width: number;
  height: number;
}

const manifest = raw as {
  images: Record<string, ImageDef>;
  frames: Record<string, FrameDef>;
};

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function assetUrl(imagePath: string): string {
  const relative = imagePath.replace(/^assets\//, '');
  return `${import.meta.env.BASE_URL}assets/petshop/${relative}`;
}

export function frameBackground(frame: { rect: SpriteRect; image: ImageDef; url: string }): {
  backgroundImage: string;
  backgroundRepeat: 'no-repeat';
  backgroundSize: string;
  backgroundPosition: string;
} {
  const posX = frame.image.width === frame.rect.w ? 0 : (frame.rect.x / (frame.image.width - frame.rect.w)) * 100;
  const posY = frame.image.height === frame.rect.h ? 0 : (frame.rect.y / (frame.image.height - frame.rect.h)) * 100;
  return {
    backgroundImage: `url(${frame.url})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${(frame.image.width / frame.rect.w) * 100}% ${(frame.image.height / frame.rect.h) * 100}%`,
    backgroundPosition: `${posX}% ${posY}%`,
  };
}

export function frameOf(frameId: string): (FrameDef & { image: ImageDef; url: string }) | null {
  const frame = manifest.frames[frameId];
  if (!frame) return null;
  const image = manifest.images[frame.imageId];
  if (!image) return null;
  return { ...frame, image, url: assetUrl(image.imagePath) };
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => {
      imageCache.delete(url);
      reject(new Error(url));
    };
    image.src = url;
  });
  imageCache.set(url, pending);
  return pending;
}

export const OPENING_URL = assetUrl('assets/scenes/opening_street.png');

export function preloadAll(): Promise<PromiseSettledResult<HTMLImageElement>[]> {
  const urls = [...new Set(Object.values(manifest.frames).map((frame) => {
    const image = manifest.images[frame.imageId];
    return image ? assetUrl(image.imagePath) : null;
  }).filter((url): url is string => !!url))];
  return Promise.allSettled(urls.map((url) => loadImage(url)));
}

export function preloadAtlases(ids: string[]): Promise<PromiseSettledResult<HTMLImageElement>[]> {
  const urls = [...new Set(ids.map((id) => frameOf(id)?.url).filter((url): url is string => !!url))];
  return Promise.allSettled(urls.map((url) => loadImage(url)));
}
