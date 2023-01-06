import { Point } from "../util/types";

// These need to be the same values as those that occur in
// public/assets/fragment.frag
export const SCALE = 3;
export const ROWS = 18;
export const COLS = 48;
export const char_size: Point = { x: 6, y: 12 };
export const TEXT_PAGE_W = 48;  // Could instead do: smallest power of 2 >= COLS
export const TEXT_PAGE_H = 18;  // Could instead do: Smallest power of 2 >= COLS

export enum ColorCode {
  black = 0,
  red,
  green,
  yellow,
  blue,
  magenta,
  cyan,
  white,
  bblack,
  bred,
  bgreen,
  byellow,
  bblue,
  bmagenta,
  bcyan,
  bwhite,
}

export type Char = {
  charcode: number,
  fg: ColorCode,
  bg: ColorCode,
};

type Color = string;
export const ncolors: Color[] = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'bblack', 'bred', 'bgreen', 'byellow', 'bblue', 'bmagenta', 'bcyan', 'bwhite'];

export function colorCodeOfName(name: string): ColorCode {
  const ix = ncolors.findIndex(x => x == name);
  if (ix == -1) {
    throw new Error(`Unknown color name ${name}`);
  }
  return ix;
}
