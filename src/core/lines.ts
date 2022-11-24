import { ErrorCode } from './error-codes';
import { Attr, Chars } from '../ui/screen';
import { ColorCode, COLS } from '../ui/ui-constants';
import { repeat } from '../util/util';
import { nowTicks } from './clock';
import { getContents, getItem } from '../fs/fs';
import { SpecialId } from '../fs/initialFs';
import { GameState, Ident, Item, numTargetsOfExecutable } from './model';
import { RenderableLine } from '../ui/render';

export type Action =
  | { t: 'back' }
  | { t: 'descend', into: Ident }
  | { t: 'none' }
  | { t: 'error', code: ErrorCode }
  | { t: 'exec', item: Ident }

export const defaultAttr: Attr = { fg: ColorCode.white, bg: ColorCode.black };

export function canExec(item: Item): boolean {
  return !!item.acls.exec;
}

export function canOpen(item: Item): boolean {
  return !!item.acls.open;
}

export function canPickup(item: Item, actor?: Item): boolean {
  return (/* !item.progress && */(item.acls.pickup || actor?.acls.unlock)) || false;
}

export function typeCharForItem(item: Item): string {
  if (canOpen(item))
    return '+';
  else if (!item.acls.pickup)
    return Chars.LOCK;
  else if (canExec(item))
    return '*';
  else
    return ' ';
}

export function prefixForItem(item: Item): string {
  return typeCharForItem(item) +
    (item.acls.unlock ? '!' : ' ');
}

function attrForItem(item: Item): Attr {
  const locked = { fg: ColorCode.bblack, bg: ColorCode.black };
  const instr = { fg: ColorCode.cyan, bg: ColorCode.black };
  if (item.acls.instr)
    return instr;
  if (!canPickup(item) && !canOpen(item))
    return locked;
  else
    return defaultAttr;
}

export type ExecLineAction =
  | { t: 'descend', ident: Ident }
  | { t: 'none' }
  | { t: 'error', code: ErrorCode }
  | { t: 'exec', ident: Ident }
  | { t: 'back' }
  ;

export type PickupLineAction =
  | { t: 'pickup', loc: Ident, ix: number }
  | { t: 'error', code: ErrorCode }

export type DropLineAction =
  | { t: 'drop', loc: Ident, ix: number }
  | { t: 'error', code: ErrorCode }

export type LineActions = {
  exec: ExecLineAction,
  pickup: PickupLineAction,
  drop: DropLineAction,
};

export type FullLine = RenderableLine & {
  actions: LineActions
};

function execActionForItem(ident: Ident, item: Item): ExecLineAction {
  if (canOpen(item))
    return { t: 'descend', ident };
  if (canExec(item))
    return { t: 'exec', ident };
  else
    return { t: 'error', code: 'notExecutable' };
}

function pickupActionForItem(item: Item, loc: Ident, ix: number): PickupLineAction {
  if (!canPickup(item)) {
    return { t: 'error', code: 'cantPickUpLocked' };
  }
  else {
    return { t: 'pickup', loc, ix };
  }
}

function dropActionForItem(item: Item, loc: Ident, ix: number): DropLineAction {
  return { t: 'drop', loc, ix };
}

export function getRenderableLineOfItem(ident: Ident, item: Item): RenderableLine {
  const str = prefixForItem(item) + item.name;
  return {
    str,
    text: item.text,
    size: item.size,
    resources: item.resources,
    chargeNeeded: item.acls.exec ? 1 : 0,
    attr: attrForItem(item),
  }
}

export function getLineOfItem(ident: Ident, item: Item, loc: Ident, ix: number): FullLine {
  return {
    ...getRenderableLineOfItem(ident, item),
    actions: {
      exec: execActionForItem(ident, item),
      pickup: pickupActionForItem(item, loc, ix),
      drop: dropActionForItem(item, loc, ix),
    },
  }
}

export function getLines(state: GameState, loc: Ident): FullLine[] {
  const { fs } = state;
  const contents = getContents(fs, loc);
  const lines: FullLine[] = [];

  contents.forEach((ident, ix) => {
    const item = getItem(fs, ident);
    if (item.progress == undefined) {
      lines.push(getLineOfItem(ident, item, loc, ix));
    }
    else {
      const elapsed = nowTicks(state.clock) - item.progress.startTicks;
      const numTargets = numTargetsOfExecutable(item);
      lines.push({
        str: repeat(Chars.SHADE2, Math.floor((COLS / 2 - 1) * elapsed / (item.progress.totalTicks - 1))),
        resources: {},
        size: 0,
        attr: { bg: ColorCode.red, fg: ColorCode.yellow },
        actions: {
          exec: { t: 'none' },
          pickup: { t: 'error', code: 'cantPickUpLocked' },
          drop: { t: 'error', code: 'cantPickUpLocked' },
        }
      });
    }
  });

  if (loc != SpecialId.root) {
    lines.push({
      str: '  ..',
      size: 0,
      actions: {
        drop: { t: 'drop', loc, ix: lines.length },
        exec: { t: 'back' },
        pickup: { t: 'error', code: 'cantPickUpParentDir' }
      },
      resources: {},
      attr: defaultAttr,
    });
  }
  else {
    lines.push({
      str: '',
      size: 0,
      actions: {
        drop: { t: 'drop', loc, ix: lines.length },
        exec: { t: 'back' },
        pickup: { t: 'error', code: 'cantPickUpParentDir' }
      },
      resources: {},
      attr: defaultAttr,
    });
  }
  return lines;
}
