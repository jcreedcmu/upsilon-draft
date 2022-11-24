// These need to be the same values as those that occur in
// public/assets/fragment.frag
export const ROWS = 18;
export const COLS = 48;
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

export const rawPalette: string[] =
  [
    '#111', // black
    '#800', // red
    '#080', // green
    '#b81', // yellow
    '#008', // blue
    '#808', // magenta
    '#088', // cyan
    '#ccc', // white

    '#555', // bblack
    '#f55', // bred
    '#5f5', // bgreen
    '#cc0', // byellow
    '#55f', // bblue
    '#f5f', // bmagenta
    '#5ff', // bcyan
    '#eee', // bwhite
  ];

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
