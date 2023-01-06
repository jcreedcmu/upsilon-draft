import { getContents, getItem } from '../fs/fs';
import { SpecialId } from '../fs/initial-fs';
import { InfoBox, ItemRenderableLine, RenderableLine } from '../ui/render';
import { Attr, Chars, progressChars } from '../ui/screen';
import { ColorCode, COLS } from '../ui/ui-constants';
import { invertAttr, repeat, unreachable } from '../util/util';
import { nowTicks } from './clock';
import { ErrorCode } from './errors';
import { itemIsLabel } from './labels';
import { EnumContent, EnumData, GameState, Ident, Item, ItemContent } from './model';

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
  if (item.content.t == 'compressed') {
    return Chars.ARCHIVE;
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
  | { t: 'increment', ident: Ident }
  | { t: 'play', ident: Ident } // as in: play audio
  ;

export type PickupLineAction =
  | { t: 'pickup', loc: Ident, ix: number }
  | { t: 'addInventorySlot', loc: Ident, ix: number }
  | { t: 'error', code: ErrorCode }

export type DropLineAction =
  | { t: 'drop', loc: Ident, ix: number }
  | { t: 'error', code: ErrorCode }

export type SignalAction =
  | { t: 'none' }
  | { t: 'decrement', ident: Ident }
  ;

export type LineActions = {
  exec: ExecLineAction,
  pickup: PickupLineAction,
  drop: DropLineAction,
  signals?: Record<string, SignalAction>,
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
  else if (item.content.t == 'enum') {
    return { t: 'increment', ident };
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
    case 'file': return { t: 'text', text: content.text };
    case 'image': return { t: 'image', data: content.data };
    case 'sound': return undefined;
    case 'inventorySlot': return undefined;
    case 'compressed': return undefined;
    case 'enum': return undefined;
    case 'linlog': return undefined;
  }
  // wouldn't get nonexhaustivity check otherwise because fallthrough would return undefined
  return unreachable(content);
}

function enumContentAsStr(content: EnumContent, enumData: EnumData): string {
  const record = enumData[content.tp];
  if (record == undefined)
    return '???';
  const entry = record[content.value];
  if (entry == undefined)
    return '???';
  return entry; // XXX limit to three chars somehow?
}

export function getRenderableLineOfItem(item: Item, ticks: number, enumData: EnumData): RenderableLine {
  if (itemIsLabel(item)) {
    return {
      t: 'special',
      attr: { fg: ColorCode.bblue, bg: ColorCode.blue },
      str: ' ' + item.name,
      resources: item.resources,
    }
  }

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
    valueStr: item.content.t == 'enum' ? enumContentAsStr(item.content, enumData) : undefined,
  }
}

function signalActionsForItem(ident: Ident, item: Item): Record<string, SignalAction> | undefined {
  if (item.content.t == 'enum') {
    return { q: { t: 'decrement', ident } };
  }
  return undefined;
}

export function getLineOfItem(ident: Ident, item: Item, loc: Ident, ix: number, ticks: number, enumData: EnumData): FullLine {
  const line: FullLine = {
    ...getRenderableLineOfItem(item, ticks, enumData),
    actions: {
      exec: execActionForItem(ident, item),
      pickup: pickupActionForItem(item, loc, ix),
      drop: dropActionForItem(item, loc, ix),
    },
  }
  const signals = signalActionsForItem(ident, item);
  if (signals !== undefined)
    line.actions.signals = signals;
  return line;
}

// If you change this, also change getNumLines in fs.ts so that the
// invariant
//
//     (getLines(state, loc)).length == getNumLines(state.fs, loc)
//
// is maintained.
export function getLines(state: GameState, loc: Ident): FullLine[] {
  const { fs } = state;
  const contents = getContents(fs, loc);
  const lines: FullLine[] = [];

  contents.forEach((ident, ix) => {
    const item = getItem(fs, ident);
    const line = getLineOfItem(ident, item, loc, ix, nowTicks(state.clock), state._cached_enums);

    // Apply different attr if ident is currently recurring
    if (state.recurring[ident] != undefined) {
      line.attr = { ...line.attr, fg: ColorCode.bmagenta };
    }

    if (item.progress == undefined) {
      lines.push(line);
    }
    else {
      const elapsed = nowTicks(state.clock) - item.progress.startTicks;
      if (line.t == 'item') {
        const progress = elapsed / (item.progress.totalTicks - 1);
        function progressChar(fraction: number): string {
          const len = progressChars.length;
          const ix = Math.floor(fraction * (len - 1));
          return progressChars[Math.min(len - 1, Math.max(0, ix))];
        }

        const sizeStr = progressChar(progress * 3) +
          progressChar(progress * 3 - 1) +
          progressChar(progress * 3 - 2);
        lines.push({
          t: 'item',
          str: line.str,
          resources: line.resources,
          size: 1,
          sizeStr,
          attr: { bg: ColorCode.blue, fg: ColorCode.yellow },
          actions: {
            exec: { t: 'error', code: 'alreadyExecuting' },
            pickup: { t: 'error', code: 'cantPickUpLocked' },
            drop: dropActionForItem(item, loc, lines.length),
          }
        });
      }
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
