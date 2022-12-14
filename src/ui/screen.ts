import { Char, COLS, ROWS, ColorCode, TEXT_PAGE_W, TEXT_PAGE_H } from './ui-constants';
import { Point } from '../util/types';
import { invertAttr, repeat } from '../util/util';
import { parseTagstrSafe as parseTagstr } from './parse-tagstr';
import { ImageDat } from './image-dat';

export type Attr = { fg: ColorCode, bg: ColorCode };
export type Rect = { x: number, y: number, w: number, h: number };
export type RectP = { p: Point, sz: Point };
export type AttrString = { str: string, attr: Attr };

export const BOXN = 1;
export const BOXE = 2;
export const BOXS = 4;
export const BOXW = 8;

// special characters
export const Chars = {
  LOCK: '\x04',
  DIA: '\x05',
  EMPTY_DIA: '\x06',
  SQR: '\x07',
  EMPTY_SQR: '\x08',
  SHADE1: '\x0d',
  SHADE2: '\x0e',
  SHADE3: '\x0f',
  SHADE4: '\x00',
  CHECKMARK: '\xa4',
  SPEAKER: '\xa5',
  TOP_HALF: '\xa6',
  BOTTOM_HALF: '\xa7',
  ARCHIVE: '\xa8',
  BOXN: String.fromCharCode(0x10 + BOXN),
  BOXS: String.fromCharCode(0x10 + BOXS),
  BOXW: String.fromCharCode(0x10 + BOXW),
  BOXE: String.fromCharCode(0x10 + BOXE),
  ARROW_UP: '\xa0',
  ARROW_LEFT: '\xa1',
  ARROW_DOWN: '\xa2',
  ARROW_RIGHT: '\xa3',
  TRI_UP: '\xc0',
  TRI_LEFT: '\xc1',
  TRI_DOWN: '\xc2',
  TRI_RIGHT: '\xc3',
  LTRI_UP: '\xc4',
  LTRI_LEFT: '\xc5',
  LTRI_DOWN: '\xc6',
  LTRI_RIGHT: '\xc7',
  LOLLI: '\xae',
  OTIMES: '\xaf',
  OPLUS: '\xb0',
  PAR: '\xb1',
  TOP: '\xb2',
  BOT: '\xb3',
}

export function isEntity(x: string): x is keyof (typeof Chars) {
  return x in Chars;
}

export const progressChars = [
  ' ',
  '\xa9',
  '\xaa',
  '\xab',
  '\xac',
  '\xad',
  '\x00',
];

export const arrowChars = '\xa0\xa1\xa2\xa3';

type StrState = {
  start: Point,
  p: Point,
  wrapLen?: number
}

export function boxify(x: number): (charcode: number) => number {
  return (charcode: number) => {
    if ((charcode & 0xf0) == 0x10) {
      return charcode | x;
    }
    else {
      return 0x10 | x;
    }
  }
}

function codeOfAttr(attr: Attr): number {
  return attr.fg + 16 * attr.bg;
}

function attrOfCode(code: number): Attr {
  return { fg: code & 15, bg: (code >> 4) & 15 };
}

export class Screen {
/* private */ imdat: ImageDat;

  rows: number = ROWS;
  cols: number = COLS;

  constructor(attr?: Attr) {
    this.imdat = new ImageDat(TEXT_PAGE_W, TEXT_PAGE_H);
    {
      for (let n = 0; n < TEXT_PAGE_W * TEXT_PAGE_H; n++) {
        this.imdat.data[4 * n] = 0;
        this.imdat.data[4 * n + 1] = 0;
        this.imdat.data[4 * n + 2] = 0;
        this.imdat.data[4 * n + 3] = 255;
      }
    }
    {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const char = { ...(attr ?? { fg: ColorCode.black, bg: ColorCode.black }), charcode: 0 };
          this.putChar(x, y, char);
        }
      }
    }

  }

  putChar(x: number, y: number, chr: Char): void {
    const i = 4 * (y * TEXT_PAGE_W + x);
    this.imdat.data[i] = chr.charcode;
    this.imdat.data[i + 1] = codeOfAttr(chr);
  }

  getChar(x: number, y: number): Char {
    const i = 4 * (y * TEXT_PAGE_W + x);
    return {
      charcode: this.imdat.data[i],
      fg: this.imdat.data[i + 1] & 15,
      bg: this.imdat.data[i + 1] >> 4,
    };
  }

  modChar(x: number, y: number, f: (c: number) => number, attr: Attr): void {
    const j = 4 * (y * TEXT_PAGE_W + x);
    this.imdat.data[j] = f(this.imdat.data[j]);
    this.imdat.data[j + 1] = codeOfAttr(attr);
  }

  invertAt(x: number, y: number): void {
    const j = 4 * (y * TEXT_PAGE_W + x);
    this.imdat.data[j + 1] = codeOfAttr(invertAttr(attrOfCode(this.imdat.data[j + 1])));
  }

  at(x: number, y: number, wrapLen?: number): StrState {
    return {
      p: { x, y }, start: { x, y }, wrapLen
    };
  }

  atp(p: Point, wrapLen?: number): StrState {
    return {
      p: { x: p.x, y: p.y }, start: { x: p.x, y: p.y }, wrapLen
    };
  }

  drawAttrStr(state: StrState, sa: AttrString[]) {
    sa.forEach(({ str, attr }) => {
      state = this.drawStr(state, str, attr);
    });
  }

  drawTagStr(state: StrState, str: string, attr: Attr) {
    this.drawAttrStr(state, parseTagstr(str, attr));
  }

  drawStr(state: StrState, str: string, attr: Attr): StrState {
    for (let n = 0; n < str.length; n++) {
      const cc = str.charCodeAt(n);
      if (cc == 10) {
        state.p.y++;
        state.p.x = state.start.x;
      }
      else {
        this.putChar(state.p.x, state.p.y, {
          ...attr,
          charcode: str.charCodeAt(n)
        });
        state.p.x++;
        if (state.wrapLen !== undefined && state.p.x - state.start.x >= state.wrapLen) {
          state.p.y++;
          state.p.x = state.start.x;
        }
      }
    }
    return state;
  }

  drawLine(state: StrState, len: number, str: string, attr: Attr) {
    const padding = len - str.length;
    const padded = padding >= 0 ?
      str + repeat(' ', len - str.length) :
      str.substr(0, len);
    this.drawStr(state, padded, attr);
  }

  parseStrToLength(str: string, attr: Attr, len: number): AttrString[] {
    const parsed = parseTagstr(str, attr);
    let total = 0;
    for (let i = 0; i < parsed.length; i++) {
      const nextTotal = total + parsed[i].str.length;
      if (nextTotal > len) {
        parsed[i].str = parsed[i].str.substr(str.length - (nextTotal - len));
        parsed.splice(i + 1);
        return parsed;
      }
      total = nextTotal;
    }
    // if we get here, len >= length(str)
    const padding = len - total;
    parsed.push({ str: repeat(' ', len - total), attr });
    return parsed;
  }

  drawTagLine(state: StrState, len: number, str: string, attr: Attr) {
    this.drawAttrStr(state, this.parseStrToLength(str, attr, len));
  }

  fillRect(rect: Rect, attr: Attr, char: number) {
    const { x, y, w, h } = rect;
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        this.modChar(x + i, y + j, x => char, attr)
      }
    }
  }

  drawRect(rect: Rect, attr: Attr) {
    const { x, y, w, h } = rect;

    this.modChar(x, y, boxify(BOXS | BOXE), attr);
    this.modChar(x + w, y, boxify(BOXS | BOXW), attr);
    this.modChar(x, y + h, boxify(BOXN | BOXE), attr);
    this.modChar(x + w, y + h, boxify(BOXN | BOXW), attr);

    const horiz = boxify(BOXW | BOXE);
    const vert = boxify(BOXN | BOXS);
    for (let i = 0; i < w - 1; i++) {
      this.modChar(x + i + 1, y, horiz, attr);
      this.modChar(x + i + 1, y + h, horiz, attr);
    }
    for (let i = 0; i < h - 1; i++) {
      this.modChar(x, y + i + 1, vert, attr);
      this.modChar(x + w, y + i + 1, vert, attr);
    }
  }

  drawRectp(rect: RectP, attr: Attr) {
    this.drawRect({ x: rect.p.x, y: rect.p.y, w: rect.sz.x, h: rect.sz.y }, attr);
  }
}
