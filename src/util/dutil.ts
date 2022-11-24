import { Color, Point } from './types';

export type Buffer = {
  c: HTMLCanvasElement,
  d: CanvasRenderingContext2D,
}

export function imgProm(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const sprite = new Image();
    sprite.src = src;
    sprite.onload = function() { res(sprite); }
  });
}

export function fbuf(sz: Point, getPixel: (x: number, y: number) => Color): Buffer {
  const c = document.createElement('canvas');
  c.width = sz.x;
  c.height = sz.y;
  const d = c.getContext('2d');
  if (d == null) {
    throw "couldn't create canvas rendering context for buffer";
  }
  const dd = d.getImageData(0, 0, sz.x, sz.y);
  for (let x = 0; x < dd.width; x++) {
    for (let y = 0; y < dd.height; y++) {
      const base = 4 * (y * dd.width + x);
      const cn = getPixel(x, y);
      dd.data[base] = cn.r;
      dd.data[base + 1] = cn.g;
      dd.data[base + 2] = cn.b;
      dd.data[base + 3] = cn.a;
    }
  }
  d.putImageData(dd, 0, 0);
  return { c, d };
}

export function buffer(sz: Point): Buffer {
  const c = document.createElement('canvas');
  c.width = sz.x;
  c.height = sz.y;
  const d = c.getContext('2d');
  if (d == null) {
    throw "couldn't create canvas rendering context for buffer";
  }
  return { c, d };
}
