import { logger } from '../util/debug';
import { Resources } from '../fs/resources';
import { Attr, AttrString, BOXE, boxify, BOXW, Chars, Screen } from './screen';
import { Point } from '../util/types';
import { ColorCode } from './ui-constants';
import { int, invertAttr, mapval, repeat, zeropad } from '../util/util';
import { getContents, getItem } from '../fs/fs';
import { SpecialId } from '../fs/initialFs';
import { getLines, getRenderableLineOfItem } from '../core/lines';
import { GameState, Show, State, UserError } from '../core/model';

const CHARGE_COL_SIZE = 3;
const SIZE_COL_SIZE = 3;
const MARGIN = 1;

// Everything with "Renderable" in its name is a sort of convenience
// representation a bit closer in form (compared to the raw state
// data) to what we need to render.

export type RenderableLine = {
  str: string,
  text?: string,
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
  invLine?: RenderableLine
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

function getInventoryLine(state: GameState): RenderableLine | undefined {
  const inventory = getContents(state.fs, SpecialId.inventory);
  if (inventory.length == 0)
    return undefined;
  const id = inventory[0];
  const invItem = getItem(state.fs, id);
  return getRenderableLineOfItem(id, invItem);
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
        invLine: getInventoryLine(state),
      };
    }
    case 'textDialogView':
      return { t: 'textDialogView' };
  }
}

const CHARGE_ATTR = { fg: ColorCode.bblue, bg: ColorCode.black };
const NETWORK_ATTR = { fg: ColorCode.byellow, bg: ColorCode.black };
const DATA_ATTR = { fg: ColorCode.bgreen, bg: ColorCode.black };

const MODELINE_ATTR = { fg: ColorCode.yellow, bg: ColorCode.blue };
const ERROR_ATTR = { fg: ColorCode.yellow, bg: ColorCode.red };
const INV_ATTR = { fg: ColorCode.yellow, bg: ColorCode.black };
const GRAY_ATTR = { fg: ColorCode.bblack, bg: ColorCode.black };

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
    const sizeAttr = (line.size < 2 && !invert) ? { fg: ColorCode.bblack, bg: ColorCode.black } : attrs.base;
    screen.drawTagStr(screen.at(sizeCol, y), sizeStr, sizeAttr);
  }
}

export function renderFsView(rend: FsRenderable): Screen {
  const screen = new Screen();

  const len = int(screen.cols / 2) - 1;
  const lines = rend.lines;
  lines.forEach((line, i) => {
    const selected = i == rend.curLine;
    if (rend.show.info) {
      if (line.text && selected) {
        screen.drawTagStr(screen.at(len + 1, 3, len), line.text, INV_ATTR);
      }
      if (selected && line.resources.cpu) {
        screen.drawTagStr(screen.at(len + 1, screen.rows - 3), "CPU:", INV_ATTR);
        screen.drawTagStr(screen.at(len + 5, screen.rows - 3), repeat(Chars.DIA, line.resources.cpu), CHARGE_ATTR);
      }
      if (selected && line.resources.network) {
        screen.drawTagStr(screen.at(len + 1, screen.rows - 4), "NET:", INV_ATTR);
        screen.drawTagStr(screen.at(len + 5, screen.rows - 4), repeat(Chars.SQR, line.resources.network), NETWORK_ATTR);
      }
    }
    renderLine(screen, { x: 0, y: i }, len, line, rend.show, selected);
  });

  if (rend.show.inventory) {
    if (rend.invLine != undefined) {
      renderLine(screen, { x: len + 1, y: 1 }, len, rend.invLine, rend.show);
    }
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
    screen.drawRect({ x: len, y: 0, w: len + 1, h: 2 }, INV_ATTR);
    screen.drawTagStr(screen.at(len + 2, 0), `${boxw}Holding${boxe}`, INV_ATTR);
  }
  if (rend.show.info) {
    screen.drawRect({ x: len, y: 2, w: len + 1, h: screen.rows - 4 }, INV_ATTR);
    screen.drawTagStr(screen.at(len + 2, 2), `${boxw}Info${boxe}`, INV_ATTR);
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

export function render(state: State): Screen {
  switch (state.t) {
    case 'title':
      const screen = new Screen();
      const str1 = '* * \x03 UpsilonDraft \x02 * *';
      screen.drawAttrStr(screen.at(Math.floor((screen.cols - str1.length) / 2), 3), [{ str: str1, attr: { fg: 15, bg: 4 } }]);
      const str2 = 'press any key to start';
      screen.drawAttrStr(screen.at(Math.floor((screen.cols - str2.length) / 2), 5), [{ str: str2, attr: { fg: 0, bg: 15 } }]);
      return screen;

    case 'game': {
      return finalRender(getRenderable(state.gameState));
    }
  }
}
