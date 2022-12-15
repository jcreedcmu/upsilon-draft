import { produce } from "../util/produce";
import { Resources } from './resources';
import { SpecialId } from "./initialFs";
import { canOpen } from '../core/lines';
import { Hook, Ident, Item, ItemContent, Location } from '../core/model';
import { getVirtualItem, getVirtualItemLocation } from "./vfs";
import { logger } from "../util/debug";

/// Constants

const VIRTUAL_ITEM_PATTERN = /^_gen_/;
const VIRTUAL_ITEM_PREFIX = '_gen_';

/// Types

export type Fs = {
  counter: number;
  idToItem: Record<Ident, Item>;
  inventory: (Ident | undefined)[];

  marks: Record<string, Location>;

  // Any field that is named _cached_* is a computed
  // view that is not part of the fundamental state.
  _cached_locmap: Record<Ident, Location>;
};

export type ItemPlan =
  | { t: 'dir', name: string, contents: VirtualItemPlan[], forceId?: Ident, hooks?: Hook[], resources?: Resources }
  | { t: 'exec', name: string, contents: ItemPlan[], forceId?: Ident, resources?: Resources }
  | { t: 'file', name: string, content?: ItemContent, size?: number, resources?: Resources, forceId?: Ident }
  | { t: 'instr', name: string }
  | { t: 'checkbox', name: string, checked: boolean, forceId?: Ident };

export type VirtualItemPlan = ItemPlan
  | { t: 'virtual', id: Ident };

/// Fs Read Utilities

export function itemContents(item: Item): Ident[] {
  if (item.content.t == 'dir')
    return item.content.contents;
  else
    return []; // XXX should warn if we get here?
}

export function getContents(fs: Fs, ident: Ident): Ident[] {
  return itemContents(getItem(fs, ident));
}

export function getFullContents(fs: Fs, ident: Ident): Item[] {
  return getContents(fs, ident).map(id => getItem(fs, id));
}

export function virtualId(ident: Ident): Ident {
  return `${VIRTUAL_ITEM_PREFIX}${ident}`;
}

export function maybeGetItem(fs: Fs, ident: Ident): Item | undefined {
  const item = fs.idToItem[ident];
  if (item === undefined) {
    if (ident.match(VIRTUAL_ITEM_PATTERN)) {
      return getVirtualItem(ident.replace(VIRTUAL_ITEM_PATTERN, ''));
    }
    return undefined;
  }
  return item;
}

export function getItem(fs: Fs, ident: Ident): Item {
  const item = maybeGetItem(fs, ident);
  if (item === undefined) {
    throw new Error(`Couldn't find ident ${ident}`);
  }
  return item;
}

export function getLocation(fs: Fs, ident: Ident): Location {
  const location = fs._cached_locmap[ident];
  if (location === undefined) {
    if (ident.match(VIRTUAL_ITEM_PATTERN)) {
      return getVirtualItemLocation(ident.replace(VIRTUAL_ITEM_PATTERN, ''));
    }
    throw new Error(`Couldn't find location of ident ${ident}`);
  }
  return location;
}

export function getItemIdsAfter(fs: Fs, loc: Location, howMany: number): Ident[] | undefined {
  const rv: Item[] = [];
  if (loc.t !== 'at')
    return undefined;
  const conts = getContents(fs, loc.id);

  if (loc.pos + howMany >= conts.length)
    return undefined;

  const idents: Ident[] = [];
  for (let i = 0; i < howMany; i++) {
    idents.push(conts[loc.pos + 1 + i]);
  }
  return idents;
}

export function getItemIdsBefore(fs: Fs, loc: Location, howMany: number): Ident[] | undefined {
  const rv: Item[] = [];
  if (loc.t !== 'at')
    return undefined;
  const conts = getContents(fs, loc.id);

  if (loc.pos < howMany)
    return undefined;

  const idents: Ident[] = [];
  for (let i = 0; i < howMany; i++) {
    idents.push(conts[loc.pos - 1 - i]);
  }
  return idents;
}

/// Fs Construction

function makeInsertRootItem(fs: Fs, name: SpecialId): Fs {
  [fs,] = insertRootItem(fs, name, {
    name,
    acls: {},

    content: { t: 'dir', contents: [] },
    resources: {},
    size: 0
  });
  return fs;
}

export function mkFs(): Fs {
  let fs: Fs = {
    counter: 0,
    idToItem: {},
    marks: {},
    _cached_locmap: {},
    inventory: [],
  };
  fs = makeInsertRootItem(fs, SpecialId.root)
  return fs;
}

export function textContent(text: string): ItemContent {
  return { t: 'text', text };
}

export function itemOfPlan(plan: ItemPlan): Item {
  switch (plan.t) {

    case 'dir': {
      return {
        name: plan.name,
        acls: { open: true },
        // XXX This is a little sketchy.
        //
        // I think it depends on the invariant that virtual
        // directories only have virtual contents.
        content: { t: 'dir', contents: plan.contents.flatMap(x => x.t == 'virtual' ? [virtualId(x.id)] : []) },
        resources: plan.resources ?? {},
        size: 1,
        hooks: plan.hooks,
      };
    }

    case 'exec': {
      return {
        name: plan.name,
        acls: { exec: true, pickup: true },
        content: textContent(''),
        resources: plan.resources ?? {},
        size: 1,
      };
    }

    case 'file': return {
      name: plan.name,
      acls: { pickup: true },
      content: plan.content ?? { t: 'text', text: '' },
      resources: plan.resources ?? {},
      size: 1,
    };

    case 'instr': return {
      name: plan.name,
      acls: { instr: true, pickup: true },
      content: textContent(''),
      resources: {},
      size: 1,
    };

    case 'checkbox': return {
      name: plan.name,
      acls: { pickup: true },
      content: { t: 'checkbox', checked: plan.checked },
      resources: {},
      size: 1,
    };

  }
}

export function insertPlan(fs: Fs, loc: Ident, plan: VirtualItemPlan): [Fs, Ident] {
  let ident;
  if (plan.t == 'virtual') {
    ident = virtualId(plan.id);
    // XXX factor this out as insertIdLast?
    const ix = getContents(fs, loc).length; // ignore hooks during init
    [fs,] = insertId(fs, loc, ix, ident);
  }
  else {
    [fs, ident] = insertItem(fs, loc, itemOfPlan(plan),
      'forceId' in plan ? plan.forceId : undefined);

    if (plan.t == 'dir' || plan.t == 'exec') {
      [fs,] = insertPlans(fs, ident, plan.contents);
    }
  }
  return [fs, ident];
}

export function insertPlans(fs: Fs, loc: Ident, plans: VirtualItemPlan[]): [Fs, Ident[]] {
  const idents: Ident[] = [];
  for (const plan of plans) {
    let ident;
    [fs, ident] = insertPlan(fs, loc, plan);
    idents.push(ident);
  }
  return [fs, idents];
}

function insertRootItem(fs: Fs, id: Ident, item: Item): [Fs, Ident] {
  fs = produce(fs, fsd => {
    fsd.idToItem[id] = item;
    fsd._cached_locmap[id] = { t: 'is_root' };
  });
  return [fs, id];
}

/// Fs Writes

export function currentId(fs: Fs): Ident {
  return `item.${fs.counter}`;
}

// Inserts at end of loc. Intended for fs initialization.
export function insertItem(fs: Fs, loc: Ident, item: Item, forceId?: Ident): [Fs, Ident] {
  const id = forceId ?? currentId(fs);
  fs = produce(fs, fsd => {
    if (forceId == undefined)
      fsd.counter++;
    fsd.idToItem[id] = item; // create the item itself
  });
  const ix = getContents(fs, loc).length;
  // XXX factor this out as insertIdLast?
  [fs,] = insertId(fs, loc, ix, id); // ignore hooks during init
  return [fs, id];
}

// Takes an fs and a pure function modifying an item (ok if it uses
// produce) and returns an fs with item `ident` so modified.
// Crucially, if ident is a virtual id, we still do the right thing,
// that is, we reify the virtual item in the course of modifying it.
function modifyItem(fs: Fs, ident: Ident, f: (x: Item) => Item): Fs {
  fs = reifyId(fs, ident);
  const newItem = f(getItem(fs, ident));
  return produce(fs, fsd => {
    fsd.idToItem[ident] = newItem;
  });
}

// Imperatively modifies item with ident `ident`, using imperative
// function f.
export function modifyItemꜝ(fs: Fs, ident: Ident, f: (x: Item) => void): void {
  const item = getItem(fs, ident);
  f(item);
  fs.idToItem[ident] = item;
}


export function createAndInsertItem(fs: Fs, loc: Ident, ix: number, item: Item): [Fs, Ident, Hook[]] {
  const id = currentId(fs);
  fs = produce(fs, fsd => {
    fsd.counter++;
    fsd.idToItem[id] = item; // install the item itself
  });

  let hooks;
  // insertId takes care of updating _cached_locmap.
  [fs, hooks] = insertId(fs, loc, ix, id); // ignore hooks during init
  return [fs, id, hooks];
}

// insertCount can be -1 for a delete
function maybeShiftMark(markLoc: Location, insertLoc: Ident, insertIx: number, insertCount: number): Location {
  if (markLoc.t == 'at' && insertLoc == markLoc.id && insertIx <= markLoc.pos) {
    if (insertIx > markLoc.pos + insertCount) {
      // I think this has to be a deletion that actually deletes the mark itself!
      // XXX should write some tests probably
      console.error('mark deleted... is this right?');
      return { t: 'is_root' };
    }
    return { t: 'at', id: markLoc.id, pos: markLoc.pos + insertCount };
  }
  else {
    return markLoc;
  }
}

// This doesn't create the item itself, just inserts the id in the right place
export function insertId(fs: Fs, loc: Ident, ix: number, id: Ident): [Fs, Hook[]] {
  logger('movement', `insertId ${loc}[${ix}] id ${id}`);
  const parent = getItem(fs, loc);
  const contents = [...itemContents(parent)];

  fs = modifyItem(fs, loc, item => produce(item, it => { itemContents(it).splice(ix, 0, id) }));

  fs = produce(fs, fsd => {
    fsd._cached_locmap[id] = { t: 'at', id: loc, pos: ix };
    for (let i = ix; i < contents.length; i++) {
      fsd._cached_locmap[contents[i]] = { t: 'at', id: loc, pos: i + 1 };
    }
  });

  // update marks
  fs = produce(fs, fsd => {
    Object.keys(fs.marks).forEach(mark => {
      fsd.marks[mark] = maybeShiftMark(fs.marks[mark], loc, ix, 1);
    });
  });
  return [fs, parent.hooks ?? []];
}

export function hooksOfLocation(fs: Fs, loc: Location): Hook[] {
  switch (loc.t) {
    case 'at': return getItem(fs, loc.id).hooks ?? [];
    case 'inventory': return [];
    case 'is_root': return [];
  }
}

export function removeId(fs: Fs, loc: Ident, ix: number): [Fs, Ident, Hook[]] {
  const parent = getItem(fs, loc);
  const contents = [...itemContents(parent)];
  const id = contents[ix];
  logger('movement', `removeId ${loc}[${ix}] = ${id}`);

  fs = modifyItem(fs, loc, item => produce(item, it => { itemContents(it).splice(ix, 1) }));

  fs = produce(fs, fsd => {
    fsd._cached_locmap[id] = { t: 'is_root' };
    for (let i = ix + 1; i < contents.length; i++) {
      fsd._cached_locmap[contents[i]] = { t: 'at', id: loc, pos: i - 1 };
    }
  });

  // update marks
  fs = produce(fs, fsd => {
    Object.keys(fs.marks).forEach(mark => {
      fsd.marks[mark] = maybeShiftMark(fs.marks[mark], loc, ix, -1);
    });
  });

  return [fs, id, parent.hooks ?? []];
}

// If you change this, also change getLines in lines.ts so that the
// invariant
//
//     (getLines(state, loc)).length == getNumLines(state.fs, loc)
//
// is maintained.
export function getNumLines(fs: Fs, loc: Ident): number {
  let contentsLength = getContents(fs, loc).length;
  if (loc != SpecialId.root)
    contentsLength++;
  return contentsLength;
}

export function forwardLocation(fs: Fs, loc: Location, spaces: number): Location {
  if (loc.t != 'at') { throw new Error(`forwardLocation only supports 'at' right now`); }
  const len = getNumLines(fs, loc.id);
  return { t: 'at', id: loc.id, pos: (loc.pos + spaces + len) % len };
}

export function moveIdForward(fs: Fs, id: Ident, spaces: number): [Fs, Hook[]] {
  const fromLoc = getLocation(fs, id);
  const toLoc = forwardLocation(fs, fromLoc, spaces);
  return moveId(fs, fromLoc, toLoc);
}

export function moveId(fs: Fs, fromLoc: Location, toLoc: Location): [Fs, Hook[]] {
  if (fromLoc.t != 'at') { throw new Error(`moveId only supports 'at' right now`); }
  if (toLoc.t != 'at') { throw new Error(`moveId only supports 'at' right now`); }
  const [fs2, ident, hooks2] = removeId(fs, fromLoc.id, fromLoc.pos);
  const [fs3, hooks3] = insertId(fs2, toLoc.id, toLoc.pos, ident);
  return [fs3, [...hooks2, ...hooks3]];
}

export function moveIdTo(fs: Fs, id: Ident, toLoc: Location): [Fs, Hook[]] {
  return moveId(fs, getLocation(fs, id), toLoc);
}

// ensures ident is really mapped to a real item
export function reifyId(fs: Fs, ident: Ident): Fs {
  if (fs.idToItem[ident] == undefined) {
    const item = getItem(fs, ident);
    const loc = getLocation(fs, ident);
    return produce(fs, fsd => {
      fsd.idToItem[ident] = item;
      fsd._cached_locmap[ident] = loc;
    });
  }
  else {
    return fs;
  }
}

export function insertIntoInventory(fs: Fs, ident: Ident, pos: number): Fs {
  return produce(fs, fsd => {
    fsd.inventory[pos] = ident;
    fsd._cached_locmap[ident] = { t: 'inventory', pos };
  });
}

export function removeFromInventory(fs: Fs, pos: number): [Fs, Ident] {
  const ident = fs.inventory[pos];
  if (ident == undefined) {
    throw new Error(`Tried to remove from inventory slot ${pos} when there was nothing there.`);
  }
  return [produce(fs, fsd => {
    fsd.inventory[pos] = undefined
    fsd._cached_locmap[ident] = { t: 'is_root' };
  }), ident];
}

export function getInventoryItem(fs: Fs, pos: number): Ident | undefined {
  return fs.inventory[pos];
}
