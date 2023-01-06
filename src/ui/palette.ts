// returns an array of 16 * 4 floats, which are the rgba values for
// the 16 palette entries.
export function paletteDataFloat(): number[] {
  return paletteDataInt().map(x => x / 255);
}

export function paletteDataInt(): number[] {
  function valOfHex(hex: string) {
    return parseInt(hex, 16) * 17;
  }
  const rv: number[] = [];
  for (let i = 0; i < 16; i++) {
    const [r, g, b] = [1, 2, 3].map(pos => valOfHex(rawPalette[i][pos]));
    rv.splice(i * 4, 4, ...[r, g, b, 255]);
  }
  return rv;
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
