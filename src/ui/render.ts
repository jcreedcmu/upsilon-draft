import { logger } from '../util/debug';
import { Resources } from '../fs/resources';
import { Attr, AttrString, BOXE, boxify, BOXW, Chars, Screen } from './screen';
import { Point } from '../util/types';
import { ColorCode } from './ui-constants';
import { int, invertAttr, mapval, repeat, zeropad } from '../util/util';
import { getContents, getInventoryItem, getItem } from '../fs/fs';
import { SpecialId } from '../fs/initialFs';
import { getLines, getRenderableLineOfItem } from '../core/lines';
import { GameState, Show, SceneState, UserError } from '../core/model';
import { nowTicks } from '../core/clock';
import { INVENTORY_MAX_ITEMS } from '../core/reduce';

const CHARGE_COL_SIZE = 3;
const SIZE_COL_SIZE = 3;
const MARGIN = 1;
const INFO_SECTION_START_Y = INVENTORY_MAX_ITEMS + 1;

// Everything with "Renderable" in its name is a sort of convenience
// representation a bit closer in form (compared to the raw state
// data) to what we need to render.

export type RenderableLine = {
  str: string,
  text?: string,
  inProgress?: boolean,
  resources: Resources,
  size: number,
  chargeNeeded?: number,
  attr: Attr,
}

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

function defaultLine(name: string): RenderableLine {
  return {
    resources: {},
    attr: { fg: 15, bg: 0 },
    size: 1,
    str: '  ' + name,
    text: '...'
  };
}

function emptyRenderableLine(): RenderableLine {
  return { str: Chars.SHADE1, attr: { fg: ColorCode.yellow, bg: ColorCode.blue }, size: 0, resources: {} };
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

function renderLine(screen: Screen, p: Point, len: number, line: RenderableLine, show: Show, invert?: boolean): void {
  const { x, y } = p;
  const str = line.str;
  const cpu = line.resources.cpu ?? 0;
  const network = line.resources.network ?? 0;
  const data = line.resources.data ?? 0;

  const needsResources = (line.chargeNeeded ?? 0) > 0;

  const baseAttrs = {
    base: line.attr,
  };
  const attrs = invert ? mapval(baseAttrs, invertAttr) : baseAttrs;

  screen.drawTagLine(screen.at(x, y), len, str, attrs.base);

  const chargeCol = x + len - CHARGE_COL_SIZE;
  const sizeCol = chargeCol - SIZE_COL_SIZE - MARGIN;

  // show cpu quota
  if (show.charge && !line.inProgress) {
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
}

type RenderableResources = { name: string, count: number, attr: Attr, symbol: string };

export function getRenderableResources(line: RenderableLine): RenderableResources[] {
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

export function renderFsView(rend: FsRenderable): Screen {
  const screen = new Screen({ fg: ColorCode.blue, bg: ColorCode.blue });

  const len = int(screen.cols / 2) - 1;
  const lines = rend.lines;
  lines.forEach((line, i) => {
    const selected = i == rend.curLine;
    if (rend.show.info) {
      if (line.text && selected) {
        screen.drawTagStr(screen.at(len + 1, INFO_SECTION_START_Y + 1, len), line.text, INV_ATTR);
      }
      if (selected) {
        const rrs = getRenderableResources(line);
        rrs.forEach((rr, ix) => {
          const nameStr = `${rr.name}:`;
          screen.drawTagStr(screen.at(len + 1, screen.rows - 3 - ix), nameStr, INV_ATTR);
          if (rr.count >= 5)
            screen.drawAttrStr(
              screen.at(len + nameStr.length + 1, screen.rows - 3 - ix),
              [{ str: rr.count + '', attr: INV_ATTR }, { str: rr.symbol, attr: rr.attr }]
            );
          else
            screen.drawTagStr(screen.at(len + nameStr.length + 1, screen.rows - 3 - ix), repeat(rr.symbol, rr.count), rr.attr);
        });
      }
    }
    renderLine(screen, { x: 0, y: i }, len, line, rend.show, selected);
  });

  if (rend.show.inventory) {
    rend.invLines.forEach((line, ix) => {
      renderLine(screen, { x: len + 1, y: ix + 1 }, len, line, rend.show);
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
    screen.drawRect({ x: len, y: 0, w: len + 1, h: INVENTORY_MAX_ITEMS + 1 }, INV_ATTR);
    screen.drawTagStr(screen.at(len + 2, 0), `${boxw}Holding${boxe}`, INV_ATTR);
    screen.drawTagStr(screen.at(len, rend.inventorySlot + 1), `>`, INV_ATTR);
  }
  if (rend.show.info) {
    screen.drawRect({ x: len, y: INFO_SECTION_START_Y, w: len + 1, h: screen.rows - 2 - INFO_SECTION_START_Y }, INV_ATTR);
    screen.drawTagStr(screen.at(len + 2, INFO_SECTION_START_Y), `${boxw}Info${boxe}`, INV_ATTR);
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
