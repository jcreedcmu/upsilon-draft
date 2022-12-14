import { getContents, getItem } from '../fs/fs';
import { SpecialId } from '../fs/initialFs';
import { InfoBox, ItemRenderableLine, RenderableLine } from '../ui/render';
import { Attr, Chars } from '../ui/screen';
import { ColorCode, COLS } from '../ui/ui-constants';
import { invertAttr, repeat, unreachable } from '../util/util';
import { nowTicks } from './clock';
import { ErrorCode } from './errors';
import { GameState, Ident, Item, ItemContent } from './model';

export type Action =
  | { t: 'back' }
  | { t: 'descend', into: Ident }
  | { t: 'none' }
  | { t: 'error', code: ErrorCode }
  | { t: 'exec', item: Ident }

export const defaultAttr: Attr = { fg: ColorCode.white, bg: ColorCode.blue };

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
  if (item.content.t == 'sound') {
    return Chars.SPEAKER;
  }
  if (canOpen(item))
    return '+';
  else if (!item.acls.pickup)
    return Chars.LOCK;
  else if (canExec(item)) {
    return '*';
  }
  else
    return ' ';
}

export function prefixForItem(item: Item): string {
  return typeCharForItem(item) +
    (item.acls.unlock ? '!' : ' ');
}

function attrForItem(item: Item): Attr {
  const locked = { fg: ColorCode.bblack, bg: ColorCode.blue };
  const instr = { fg: ColorCode.cyan, bg: ColorCode.blue };
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
  | { t: 'toggle', ident: Ident }
  | { t: 'play', ident: Ident } // as in: play audio
  ;

export type PickupLineAction =
  | { t: 'pickup', loc: Ident, ix: number }
  | { t: 'addInventorySlot', loc: Ident, ix: number }
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

export type FullItemLine = ItemRenderableLine & {
  actions: LineActions
};

function execActionForItem(ident: Ident, item: Item): ExecLineAction {
  if (canOpen(item))
    return { t: 'descend', ident };

  if (item.content.t == 'sound') {
    return { t: 'play', ident };
  }
  else if (item.content.t == 'checkbox') {
    return { t: 'toggle', ident };
  }
  if (canExec(item))
    return { t: 'exec', ident };
  else
    return { t: 'error', code: 'notExecutable' };
}

function pickupActionForItem(item: Item, loc: Ident, ix: number): PickupLineAction {
  if (item.content.t == 'inventorySlot') {
    return { t: 'addInventorySlot', loc, ix };
  }

  if (!canPickup(item)) {
    if (canOpen(item)) {
      return { t: 'error', code: 'cantPickUpDir' };
    }
    else {
      return { t: 'error', code: 'cantPickUpLocked' };
    }
  }
  else {
    return { t: 'pickup', loc, ix };
  }
}

function dropActionForItem(item: Item, loc: Ident, ix: number): DropLineAction {
  return { t: 'drop', loc, ix };
}

function renderInfoBox(content: ItemContent): InfoBox | undefined {
  switch (content.t) {
    case 'text': return { t: 'text', text: content.text };
    case 'image': return { t: 'image', data: content.data };
    case 'dir': return undefined;
    case 'checkbox': return undefined;
    case 'sound': return undefined;
    case 'inventorySlot': return undefined;
  }
  // wouldn't get nonexhaustivity check otherwise because fallthrough would return undefined
  unreachable(content);
}

export function getRenderableLineOfItem(ident: Ident, item: Item, ticks: number): ItemRenderableLine {
  const str = prefixForItem(item) + item.name;
  const _attr = attrForItem(item);
  // XXX Maybe something other than invertAttr for flash? Not sure.
  const attr = (item.flashUntilTick != undefined && ticks < item.flashUntilTick) ? invertAttr(_attr) : _attr;

  return {
    t: 'item',
    str,
    infobox: renderInfoBox(item.content),
    size: item.size,
    resources: item.resources,
    chargeNeeded: item.acls.exec ? 1 : 0,
    attr,
    checked: item.content.t == 'checkbox' ? item.content.checked : undefined,
  }
}

export function getLineOfItem(ident: Ident, item: Item, loc: Ident, ix: number, ticks: number): FullItemLine {
  return {
    ...getRenderableLineOfItem(ident, item, ticks),
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
    const line = getLineOfItem(ident, item, loc, ix, nowTicks(state.clock));

    // Apply different attr if ident is currently recurring
    if (state.recurring[ident] != undefined) {
      line.attr = { ...line.attr, fg: ColorCode.bmagenta };
    }

    if (item.progress == undefined) {
      lines.push(line);
    }
    else {
      const elapsed = nowTicks(state.clock) - item.progress.startTicks;
      lines.push({
        t: 'item',
        str: repeat(Chars.SHADE2, Math.floor((COLS / 2 - 1) * elapsed / (item.progress.totalTicks - 1))),
        resources: line.resources,
        size: 1,
        inProgress: true,
        attr: { bg: ColorCode.red, fg: ColorCode.yellow },
        actions: {
          exec: { t: 'error', code: 'alreadyExecuting' },
          pickup: { t: 'error', code: 'cantPickUpLocked' },
          drop: dropActionForItem(item, loc, lines.length),
        }
      });
    }
  });

  if (loc != SpecialId.root) {
    lines.push({
      t: 'item',
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
      t: 'item',
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
