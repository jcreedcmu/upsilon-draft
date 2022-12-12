import { Chars } from "./screen";

const IMG_C_W = 20;
const IMG_C_H = 20;

export type ImgData = number[];

export function tagStrOfImg(dat: ImgData): string {
  let rv = '';
  for (let y = 0; y < Math.floor(IMG_C_H / 2); y++) {
    for (let x = 0; x < IMG_C_W; x++) {
      const upper = dat[2 * y * IMG_C_W + x];
      const lower = dat[(2 * y + 1) * IMG_C_W + x];
      rv += [' ', Chars.TOP_HALF, Chars.BOTTOM_HALF, Chars.SHADE4][upper + 2 * lower];
    }
    rv += '\n';
  }
  return `{black}{bg-white}${rv}`;
}
