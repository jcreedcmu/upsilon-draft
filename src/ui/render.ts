import { nowTicks } from '../core/clock';
import { getLines, getRenderableLineOfItem } from '../core/lines';
import { GameState, SceneState, Show, UserError } from '../core/model';
import { INVENTORY_MAX_ITEMS } from '../core/reduce';
import { getInventoryItem, getItem } from '../fs/fs';
import { Resources } from '../fs/resources';
import { doOnce, logger } from '../util/debug';
import { Point } from '../util/types';
import { int, invertAttr, mapval, repeat, zeropad } from '../util/util';
import { Attr, AttrString, BOXE, boxify, BOXW, Chars, Screen } from './screen';
import { ColorCode, COLS, ROWS } from './ui-constants';

const FS_LEN = int(COLS / 2) - 1; // number of columns one row can take up in fsview
const FS_ROWS = ROWS - 1;
const CHARGE_COL_SIZE = 3;
const SIZE_COL_SIZE = 3;
const MARGIN = 1;
const FILE_COL_SIZE = FS_LEN - CHARGE_COL_SIZE - SIZE_COL_SIZE - MARGIN;
const INFO_SECTION_START_Y = INVENTORY_MAX_ITEMS + 1;

// Everything with "Renderable" in its name is a sort of convenience
// representation a bit closer in form (compared to the raw state
// data) to what we need to render.

export type ItemRenderableLine = {
  t: 'item',
  str: string,
  text?: string,
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

export type FsRenderable = {
  curLine: number,
  lines: RenderableLine[],
  show: Show,
  path: string[],
  error: UserError | undefined,
  invLines: RenderableLine[],
  inventorySlot: number,
};

export type TextDialogRenderable = {};

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
  for (let i = 0; i < INVENTORY_MAX_ITEMS; i++) {
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

function getInventorySlot(state: GameState): number {
  return state.inventorySlot;
}

function getRenderable(state: GameState): Renderable {
  switch (state.viewState.t) {
    case 'fsView': {
      const lines = getLines(state, state.curId);
      return {
        t: 'fsView',
        curLine: state.curLine,
        error: state.error,
        lines,
        path: state.path,
        show: state._cached_show,
        invLines: getInventoryLines(state),
        inventorySlot: getInventorySlot(state),
      };
    }
    case 'textDialogView':
      return { t: 'textDialogView' };
  }
}

const CHARGE_ATTR = { fg: ColorCode.bblue, bg: ColorCode.blue };
const NETWORK_ATTR = { fg: ColorCode.byellow, bg: ColorCode.blue };
const DATA_ATTR = { fg: ColorCode.bgreen, bg: ColorCode.blue };

const MODELINE_ATTR = { fg: ColorCode.yellow, bg: ColorCode.black };
const ERROR_ATTR = { fg: ColorCode.yellow, bg: ColorCode.red };
const INV_ATTR = { fg: ColorCode.yellow, bg: ColorCode.blue };
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

/*
Depending on how many things are inserted, we want to insert varying
amounts of guides. For the sake of example, suppose FS_ROWS is 4.
Asymptotically the thing we want to divide by is FS_ROWS - 2.
                      offset, numLinesToShow, prev, next
#                     (0, 1)
##                    (0, 2)
###                   (0, 3)
####                  (0, 4)
###N P##              (0, 3, N), (2, 2, P)
###N P###             (0, 3, N), (2, 3, P)
###N P##N P##         (0, 3, N), (2, 2, PN), (4, 2, P)
###N P##N P###        (0, 3, N), (2, 2, PN), (4, 3, P)
###N P##N P##N P##    (0, 3, N), (2, 2, PN), (4, 2, PN), (6, 2, P)

Now think about FS_ROWS=5, and compute which page we're on
0
00
000
0000
00000
0000N P11
0000N P111
0000N P1111
0000N P111N P2222
-012   345   6789

*/

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

function go() {
  let output = '';
  const FS_ROWS = 4;

  for (let numLines = 0; numLines < 20; numLines++) {
    const lastPage = getLastPage(numLines, FS_ROWS);
    output += lastPage + ' ';
    for (let curLine = 0; curLine < numLines; curLine++) {
      const whichPage = getWhichPage(lastPage, curLine, numLines, FS_ROWS);
      output += whichPage + '';
    }
    output += "\n";
  }
  console.log(output);
}
// go();

function getDisplayableLines(lines: RenderableLine[], curLine: number): [RenderableLine[], number] {
  const numLines = lines.length;
  if (numLines <= FS_ROWS)
    return [lines, 0];

  const lastPage = getLastPage(numLines, FS_ROWS);
  const whichPage = getWhichPage(lastPage, curLine, numLines, FS_ROWS);
  const shouldInsertPrevGuard = whichPage > 0;
  const shouldInsertNextGuard = whichPage < lastPage;
  const numLinesToShow = FS_ROWS - (shouldInsertNextGuard ? 1 : 0) - (shouldInsertPrevGuard ? 1 : 0);
  const offset = whichPage * (FS_ROWS - 2);
  const ioffset = offset + (shouldInsertPrevGuard ? 1 : 0);
  const itemLines: RenderableLine[] = lines.slice(ioffset, ioffset + numLinesToShow);
  if (shouldInsertPrevGuard) {
    itemLines.unshift({ t: 'special', attr: { fg: ColorCode.white, bg: ColorCode.bblack }, str: repeat(Chars.ARROW_UP, FS_LEN) });
  }
  if (shouldInsertNextGuard) {
    itemLines.push({ t: 'special', attr: { fg: ColorCode.white, bg: ColorCode.bblack }, str: repeat(Chars.ARROW_DOWN, FS_LEN) });
  }

  doOnce('...', () => {
    console.log(`FS_ROWS ${FS_ROWS}`);
    console.log(`curLine ${curLine}`);
    console.log(`numLines ${numLines}`);
    console.log(`numLinesToShow ${numLinesToShow}`);
    console.log(`lastPage ${lastPage}`);
    console.log(`whichPage ${whichPage}`);
    console.log(`prev ${shouldInsertPrevGuard}`);
    console.log(`next ${shouldInsertNextGuard}`);
    console.log(`offset ${offset}`);
    console.log(`ioffset ${ioffset}`);
  });

  return [itemLines, offset];
}

function textOfRenderableLine(line: RenderableLine): string | undefined {
  switch (line.t) {
    case 'item': return line.text;
    case 'special': return undefined;
  }
}

export function renderFsView(rend: FsRenderable): Screen {
  const screen = new Screen({ fg: ColorCode.blue, bg: ColorCode.blue });
  logger('renderFsView', rend);
  const lines = rend.lines;

  const [displayableLines, offset] = getDisplayableLines(lines, rend.curLine);

  displayableLines.forEach((line, i) => {
    const lineIndex = i + offset;
    const selected = lineIndex == rend.curLine;
    if (rend.show.info) {
      const text = textOfRenderableLine(line);
      if (text !== undefined && selected) {
        screen.drawTagStr(screen.at(FS_LEN + 1, INFO_SECTION_START_Y + 1, FS_LEN), text, INV_ATTR);
      }
      if (selected) {
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
    }
    renderLine(screen, { x: 0, y: i }, FS_LEN, line, rend.show, selected);
  });

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
      'E ' + rend.error.code,
      ERROR_ATTR
    );
  }

  const boxw = String.fromCharCode(boxify(BOXW)(0));
  const boxe = String.fromCharCode(boxify(BOXE)(0));
  if (rend.show.inventory) {
    screen.drawRect({ x: FS_LEN, y: 0, w: FS_LEN + 1, h: INVENTORY_MAX_ITEMS + 1 }, INV_ATTR);
    screen.drawTagStr(screen.at(FS_LEN + 2, 0), `${boxw}Holding${boxe}`, INV_ATTR);
    screen.drawTagStr(screen.at(FS_LEN, rend.inventorySlot + 1), `>`, INV_ATTR);
  }
  if (rend.show.info) {
    screen.drawRect({ x: FS_LEN, y: INFO_SECTION_START_Y, w: FS_LEN + 1, h: screen.rows - 2 - INFO_SECTION_START_Y }, INV_ATTR);
    screen.drawTagStr(screen.at(FS_LEN + 2, INFO_SECTION_START_Y), `${boxw}Info${boxe}`, INV_ATTR);
  }
  return screen;
}

export function renderTextDialogView(state: Renderable): Screen {
  const screen = new Screen();
  screen.fillRect({ h: screen.rows - 1, w: screen.cols - 1, x: 0, y: 0 }, { fg: ColorCode.white, bg: ColorCode.blue }, 32);
  screen.drawRect({ h: screen.rows - 1, w: screen.cols - 1, x: 0, y: 0 }, { fg: ColorCode.white, bg: ColorCode.blue });
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
