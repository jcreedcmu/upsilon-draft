import { nowTicks } from '../core/clock';
import { errorCodes, errorCodeText } from '../core/errors';
import { getLines, getRenderableLineOfItem } from '../core/lines';
import { GameState, getCurId, getCurLine, InventoryState, SceneState, Show, UserError } from '../core/model';
import { INVENTORY_MAX_ITEMS } from '../core/reduce';
import { getInventoryItem, getItem } from '../fs/fs';
import { Resources } from '../fs/resources';
import { doOnce, logger, logOnce } from '../util/debug';
import { Point } from '../util/types';
import { int, invertAttr, mapval, repeat, zeropad } from '../util/util';
import { ImgData, tagStrOfImg } from './image';
import { Attr, AttrString, BOXE, boxify, BOXW, Chars, Screen } from './screen';
import { ColorCode, COLS, ROWS } from './ui-constants';

const FS_LEN = int(COLS / 2) - 1; // number of columns one row can take up in fsview
const FS_ROWS = ROWS - 1;
const CHARGE_COL_SIZE = 3;
const SIZE_COL_SIZE = 3;
const MARGIN = 1;
const FILE_COL_SIZE = FS_LEN - CHARGE_COL_SIZE - SIZE_COL_SIZE - MARGIN;

function infoSectionStartRow(rend: FsRenderable) {
  return rend.inventoryState.numSlots + 1;
}

// Everything with "Renderable" in its name is a sort of convenience
// representation a bit closer in form (compared to the raw state
// data) to what we need to render.

export type InfoBox =
  | { t: 'text', text: string }
  | { t: 'image', data: ImgData };

export type ItemRenderableLine = {
  t: 'item',
  str: string,
  infobox?: InfoBox,
  resources: Resources,
  size: number,
  checked?: boolean | undefined,
  chargeNeeded?: number,
  attr: Attr,
  inProgress?: boolean,
};

export type SpecialRenderableLine = {
  t: 'special',
  str: string,
  attr: Attr,
};

export type RenderableLine =
  | ItemRenderableLine
  | SpecialRenderableLine

type DirRenderable = {
  curLine: number,
  lines: RenderableLine[],
  show: Show,
}

export type ErrorRenderable = { msg: string } | undefined;
export type FsRenderable = {
  curLine: number,
  lines: RenderableLine[],
  show: Show,
  path: string[],
  error: ErrorRenderable,
  invLines: RenderableLine[],
  inventoryState: InventoryState,
};

export type TextDialogRenderable = { text: string, cursor: Point };

export type Renderable =
  | { t: 'fsView' } & FsRenderable
  | { t: 'textDialogView' } & TextDialogRenderable;

function truncate(name: string, len: number) {
  if (name.length > len) {
    return name.substring(0, len - 1) + Chars.BOXW;
  }
  else {
    return name;
  }
}

function emptyRenderableLine(): RenderableLine {
  const boxw = String.fromCharCode(boxify(BOXW)(0));
  return {
    t: 'special',
    str: repeat(boxw, FS_LEN),
    attr: { fg: ColorCode.yellow, bg: ColorCode.blue },
  };
}

function getInventoryLines(state: GameState): RenderableLine[] {
  const rv: RenderableLine[] = [];
  for (let i = 0; i < state.inventoryState.numSlots; i++) {
    const id = getInventoryItem(state.fs, i);
    if (id != undefined) {
      const invItem = getItem(state.fs, id);
      rv.push(getRenderableLineOfItem(id, invItem, nowTicks(state.clock)));
    }
    else {
      rv.push(emptyRenderableLine());
    }
  }
  return rv;
}

function renderError(error: UserError | undefined, errorMsgs: Record<number, string>): ErrorRenderable {
  if (error == undefined)
    return undefined;
  const codeNum = errorCodes[error.code];
  const msg = errorMsgs[codeNum];
  const text = msg == undefined ? '' : ` ${msg}`;
  return { msg: `E${codeNum}${text}` };
}

function getRenderable(state: GameState): Renderable {
  switch (state.viewState.t) {
    case 'fsView': {
      const lines = getLines(state, getCurId(state));
      return {
        t: 'fsView',
        curLine: getCurLine(state),
        error: renderError(state.error, state._cached_errors),
        lines,
        path: state.path,
        show: state._cached_show,
        invLines: getInventoryLines(state),
        inventoryState: state.inventoryState,
      };
    }
    case 'textDialogView':
      return { t: 'textDialogView', ...state.viewState.state };
  }
}

const CHARGE_ATTR = { fg: ColorCode.bblue, bg: ColorCode.blue };
const NETWORK_ATTR = { fg: ColorCode.byellow, bg: ColorCode.blue };
const DATA_ATTR = { fg: ColorCode.bgreen, bg: ColorCode.blue };

const MODELINE_ATTR = { fg: ColorCode.yellow, bg: ColorCode.black };
const ERROR_ATTR = { fg: ColorCode.yellow, bg: ColorCode.red };
const INV_ATTR = { fg: ColorCode.yellow, bg: ColorCode.blue }; // "inventory attr"? but it's more broadly used than that
const GRAY_ATTR = { fg: ColorCode.bblack, bg: ColorCode.blue };

function invertAttrText(x: AttrString): AttrString {
  return { ...x, attr: invertAttr(x.attr) };
}

function renderSpecialLine(screen: Screen, p: Point, len: number, line: SpecialRenderableLine, attrs: LineAttrs): void {
  const { x, y } = p;
  screen.drawTagLine(screen.at(x, y), len, line.str, attrs.base);
}

function renderItemLine(screen: Screen, p: Point, len: number, line: ItemRenderableLine, show: Show, attrs: LineAttrs, invert: boolean): void {
  const { x, y } = p;
  if (line.inProgress) {
    screen.drawTagLine(screen.at(x, y), len, line.str, attrs.base);
    return;
  }

  const str = truncate(line.str, FILE_COL_SIZE);
  const cpu = line.resources.cpu ?? 0;
  const network = line.resources.network ?? 0;
  const data = line.resources.data ?? 0;

  const needsResources = (line.chargeNeeded ?? 0) > 0;

  screen.drawTagLine(screen.at(x, y), len, str, attrs.base);

  const chargeCol = x + len - CHARGE_COL_SIZE;
  const sizeCol = chargeCol - SIZE_COL_SIZE - MARGIN;

  // show cpu quota
  if (show.charge) {
    const resText: AttrString[] = [];
    if (needsResources && !line.resources.cpu) resText.push({ str: Chars.EMPTY_DIA, attr: GRAY_ATTR });
    if (line.resources.cpu) resText.push({ str: Chars.DIA, attr: CHARGE_ATTR });
    if (line.resources.network) resText.push({ str: Chars.SQR, attr: NETWORK_ATTR });
    if (line.resources.data) resText.push({ str: Chars.SQR, attr: DATA_ATTR });
    const output = invert ? resText.map(invertAttrText) : resText;
    screen.drawAttrStr(screen.at(chargeCol, y), output);
  }

  if (show.size) {
    const sizeStr = line.size ? zeropad(line.size + '', SIZE_COL_SIZE) : '';
    const sizeAttr = (line.size < 2 && !invert) ? { fg: ColorCode.bblack, bg: ColorCode.blue } : attrs.base;
    screen.drawTagStr(screen.at(sizeCol, y), sizeStr, sizeAttr);
  }

  if (line.checked !== undefined) {
    const inner = line.checked ? Chars.CHECKMARK : ' ';
    const checkedStr = `[${inner}]`;
    const attr = line.checked
      ? { fg: ColorCode.bgreen, bg: ColorCode.green }
      : { fg: ColorCode.bred, bg: ColorCode.red };
    screen.drawTagStr(screen.at(sizeCol, y), checkedStr, attr);
  }
}

type LineAttrs = {
  base: Attr
};

function renderLine(screen: Screen, p: Point, len: number, line: RenderableLine, show: Show, invert?: boolean): void {

  const baseAttrs: LineAttrs = {
    base: line.attr,
  };
  const attrs: LineAttrs = invert ? mapval(baseAttrs, invertAttr) as LineAttrs : baseAttrs;

  switch (line.t) {
    case 'item': renderItemLine(screen, p, len, line, show, attrs, invert || false); break;
    case 'special': renderSpecialLine(screen, p, len, line, attrs); break;
  }
}


type RenderableResources = { name: string, count: number, attr: Attr, symbol: string };

export function getRenderableResources(line: RenderableLine): RenderableResources[] {
  if (line.t != 'item')
    return [];
  const rv: RenderableResources[] = [];
  if (line.resources.cpu) {
    rv.push({ name: 'CPU', count: line.resources.cpu, attr: CHARGE_ATTR, symbol: Chars.DIA });
  }
  if (line.resources.network) {
    rv.push({ name: 'NET', count: line.resources.network, attr: NETWORK_ATTR, symbol: Chars.SQR });
  }
  if (line.resources.data) {
    rv.push({ name: 'DAT', count: line.resources.data, attr: DATA_ATTR, symbol: Chars.SQR });
  }
  return rv;
}

function getLastPage(numLines: number, FS_ROWS: number): number {
  return Math.max(0, Math.floor((numLines - 3) / (FS_ROWS - 2)));
}

function getWhichPage(lastPage: number, curLine: number, numLines: number, FS_ROWS: number): number {
  const tweak = (curLine == numLines - 1 && (curLine) % (FS_ROWS - 2) == 1) ? 1 : 0;
  const pageEstimate = Math.floor((curLine - 1) / (FS_ROWS - 2)) - tweak;
  // which page is curLine actually on
  const whichPage =
    Math.min(lastPage, Math.max(0, pageEstimate));

  return whichPage;
}

function getDisplayableLines(lines: RenderableLine[], curLine: number, sz: Point): [RenderableLine[], number] {
  const { x: numCols, y: numRows } = sz;
  const numLines = lines.length;
  if (numLines <= numRows)
    return [lines, 0];

  const lastPage = getLastPage(numLines, numRows);
  const whichPage = getWhichPage(lastPage, curLine, numLines, numRows);
  const shouldInsertPrevGuard = whichPage > 0;
  const shouldInsertNextGuard = whichPage < lastPage;
  const numLinesToShow = numRows - (shouldInsertNextGuard ? 1 : 0) - (shouldInsertPrevGuard ? 1 : 0);
  const offset = whichPage * (numRows - 2);
  const ioffset = offset + (shouldInsertPrevGuard ? 1 : 0);
  const itemLines: RenderableLine[] = lines.slice(ioffset, ioffset + numLinesToShow);
  if (shouldInsertPrevGuard) {
    itemLines.unshift({ t: 'special', attr: { fg: ColorCode.white, bg: ColorCode.bblack }, str: repeat(Chars.ARROW_UP, numCols) });
  }
  if (shouldInsertNextGuard) {
    itemLines.push({ t: 'special', attr: { fg: ColorCode.white, bg: ColorCode.bblack }, str: repeat(Chars.ARROW_DOWN, numCols) });
  }
  return [itemLines, offset];
}

function renderLineInfo(rend: FsRenderable, screen: Screen, line: RenderableLine) {
  // draw the info the line content wants us to
  if (line.t == 'special')
    return;
  if (line.infobox == undefined)
    return;
  switch (line.infobox.t) {
    case 'text': {
      const text = line.infobox.text;
      screen.drawTagStr(screen.at(FS_LEN + 1, infoSectionStartRow(rend) + 1, FS_LEN), text, INV_ATTR);
      break;
    }
    case 'image': {
      screen.drawTagStr(screen.at(FS_LEN + 2, infoSectionStartRow(rend) + 1, FS_LEN), tagStrOfImg(line.infobox.data), INV_ATTR);
      break;
    }
  }

  // draw resources info
  const rrs = getRenderableResources(line);
  rrs.forEach((rr, ix) => {
    const nameStr = `${rr.name}:`;
    screen.drawTagStr(screen.at(FS_LEN + 1, screen.rows - 3 - ix), nameStr, INV_ATTR);
    if (rr.count >= 5)
      screen.drawAttrStr(
        screen.at(FS_LEN + nameStr.length + 1, screen.rows - 3 - ix),
        [{ str: rr.count + '', attr: INV_ATTR }, { str: rr.symbol, attr: rr.attr }]
      );
    else
      screen.drawTagStr(screen.at(FS_LEN + nameStr.length + 1, screen.rows - 3 - ix), repeat(rr.symbol, rr.count), rr.attr);
  });
}

function renderDir(screen: Screen, p: Point, sz: Point, rend: DirRenderable): void {
  const lines = rend.lines;

  const [displayableLines, offset] = getDisplayableLines(lines, rend.curLine, sz);

  displayableLines.forEach((line, i) => {
    const lineIndex = i + offset;
    const selected = lineIndex == rend.curLine;
    renderLine(screen, { x: p.x, y: p.y + i }, sz.x, line, rend.show, selected);
  });
}

export function renderFsView(rend: FsRenderable): Screen {
  const screen = new Screen({ fg: ColorCode.blue, bg: ColorCode.blue });
  logger('renderFsView', rend);

  renderDir(screen, { x: 0, y: 0 }, { x: FS_LEN, y: FS_ROWS }, rend);

  if (rend.show.info) {
    renderLineInfo(rend, screen, rend.lines[rend.curLine]);
  }

  if (rend.show.inventory) {
    rend.invLines.forEach((line, ix) => {
      renderLine(screen, { x: FS_LEN + 1, y: ix + 1 }, FS_LEN, line, rend.show);
    });
  }

  if (rend.show.cwd) {
    let modestring = '/ ' + rend.path.join(' / ');
    if (modestring.length > screen.cols) {
      modestring = '... ' + modestring.substr(modestring.length - screen.cols + 5, screen.cols - 5);
    }
    screen.drawTagLine(screen.at(0, screen.rows - 1), screen.cols,
      modestring,
      MODELINE_ATTR
    );
  }

  if (rend.error !== undefined) {
    screen.drawTagLine(screen.at(0, screen.rows - 1), screen.cols,
      rend.error.msg,
      ERROR_ATTR
    );
  }

  const boxw = String.fromCharCode(boxify(BOXW)(0));
  const boxe = String.fromCharCode(boxify(BOXE)(0));
  if (rend.show.inventory) {
    screen.drawRect({ x: FS_LEN, y: 0, w: FS_LEN + 1, h: rend.inventoryState.numSlots + 1 }, INV_ATTR);
    screen.drawTagStr(screen.at(FS_LEN + 2, 0), `${boxw}Holding${boxe}`, INV_ATTR);
    if (rend.inventoryState.numSlots > 1)
      screen.drawTagStr(screen.at(FS_LEN, rend.inventoryState.curSlot + 1), Chars.LTRI_RIGHT, INV_ATTR);
  }
  if (rend.show.info) {
    const row = infoSectionStartRow(rend);
    screen.drawRect({ x: FS_LEN, y: row, w: FS_LEN + 1, h: screen.rows - 2 - row }, INV_ATTR);
    screen.drawTagStr(screen.at(FS_LEN + 2, row), `${boxw}Info${boxe}`, INV_ATTR);
  }
  return screen;
}

export function renderTextDialogView(state: TextDialogRenderable): Screen {
  const screen = new Screen();
  const yellowFg = { fg: ColorCode.yellow, bg: ColorCode.blue };
  const whiteFg = { fg: ColorCode.white, bg: ColorCode.blue };
  const offset: Point = { x: 1, y: 1 };
  screen.fillRect({ h: screen.rows - 1, w: screen.cols - 1, x: 0, y: 0 }, whiteFg, 32);
  screen.drawRect({ h: screen.rows - 1, w: screen.cols - 1, x: 0, y: 0 }, whiteFg);
  screen.drawStr(screen.at(offset.x, offset.y, screen.cols - 2), state.text, yellowFg);
  screen.drawStr(screen.at(3, screen.rows - 1, screen.cols - 2), "<esc> to quit", yellowFg);
  screen.invertAt(state.cursor.x + offset.x, state.cursor.y + offset.y);
  return screen;
}

export function finalRender(state: Renderable): Screen {
  logger('rendering', 'rendering');

  switch (state.t) {
    case 'fsView': return renderFsView(state);
    case 'textDialogView': return renderTextDialogView(state);
  }
}

export function render(state: SceneState): Screen {
  switch (state.t) {
    case 'game': {
      return finalRender(getRenderable(state.gameState));
    }
  }
}
