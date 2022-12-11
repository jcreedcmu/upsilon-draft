import { produce } from "../util/produce";
import { Resources } from './resources';
import { SpecialId } from "./initialFs";
import { canOpen } from '../core/lines';
import { Hook, Ident, Item, ItemContent, ItemType, Location } from '../core/model';
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

  // Any field that is named _cached_* is a computed
  // view that is not part of the fundamental state.
  _cached_locmap: Record<Ident, Location>;
};

export type ItemPlan =
  | { t: 'dir', name: string, contents: VirtualItemPlan[], forceId?: Ident, hooks?: Hook[], resources?: Resources }
  | { t: 'exec', name: string, contents: ItemPlan[], forceId?: Ident, numTargets?: number, resources?: Resources }
  | { t: 'file', name: string, content?: ItemContent, size?: number, resources?: Resources, forceId?: Ident, itemType?: ItemType }
  | { t: 'instr', name: string }
  | { t: 'checkbox', name: string, checked: boolean, forceId?: Ident };

export type VirtualItemPlan = ItemPlan
  | { t: 'virtual', id: Ident };

/// Fs Read Utilities

export function getContents(fs: Fs, ident: Ident): Ident[] {
  const item = getItem(fs, ident);
  return item.contents;
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

export function getItemIdsAfter(fs: Fs, ident: Ident, howMany: number): Ident[] | undefined {
  const rv: Item[] = [];
  let loc = getLocation(fs, ident);
  if (loc == undefined) {
    throw new Error(`Can't find files following identifier ${ident} which has no location`);
  }
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

/// Fs Construction

function makeInsertRootItem(fs: Fs, name: SpecialId): Fs {
  [fs,] = insertRootItem(fs, name, {
    name,
    itemType: 'plain',
    acls: {},
    contents: [],
    content: textContent(''),
    resources: {},
    size: 0
  });
  return fs;
}

export function mkFs(): Fs {
  let fs: Fs = {
    counter: 0,
    idToItem: {},
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
        itemType: 'plain',
        name: plan.name,
        acls: { open: true },
        // XXX This is a little sketchy.
        //
        // I think it depends on the invariant that virtual
        // directories only have virtual contents.
        contents: plan.contents.flatMap(x => x.t == 'virtual' ? [virtualId(x.id)] : []),
        content: textContent(''),
        resources: plan.resources ?? {},
        size: 1,
        hooks: plan.hooks,
      };
    }

    case 'exec': {
      return {
        itemType: 'plain',
        name: plan.name,
        acls: { exec: true, pickup: true },
        contents: [],
        content: textContent(''),
        resources: plan.resources ?? {},
        size: 1,
      };
    }

    case 'file': return {
      itemType: plan.itemType ?? 'plain',
      name: plan.name,
      acls: { pickup: true },
      contents: [],
      content: plan.content ?? { t: 'text', text: '' },
      resources: plan.resources ?? {},
      size: 1,
    };

    case 'instr': return {
      itemType: 'plain',
      name: plan.name,
      acls: { instr: true, pickup: true },
      content: textContent(''),
      contents: [],
      resources: {},
      size: 1,
    };

    case 'checkbox': return {
      itemType: 'plain',
      name: plan.name,
      acls: { pickup: true },
      contents: [],
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

// This doesn't create the item itself, just inserts the id in the right place
export function insertId(fs: Fs, loc: Ident, ix: number, id: Ident): [Fs, Hook[]] {
  logger('movement', `insertId ${loc}[${ix}] id ${id}`);
  const parent = getItem(fs, loc);
  const contents = [...parent.contents];

  fs = modifyItem(fs, loc, item => produce(item, it => { it.contents.splice(ix, 0, id) }));

  fs = produce(fs, fsd => {
    fsd._cached_locmap[id] = { t: 'at', id: loc, pos: ix };
    for (let i = ix; i < contents.length; i++) {
      fsd._cached_locmap[contents[i]] = { t: 'at', id: loc, pos: i + 1 };
    }
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
  const contents = [...parent.contents];
  const id = contents[ix];
  logger('movement', `removeId ${loc}[${ix}] = ${id}`);

  fs = modifyItem(fs, loc, item => produce(item, it => { it.contents.splice(ix, 1) }));

  fs = produce(fs, fsd => {
    fsd._cached_locmap[id] = { t: 'is_root' };
    for (let i = ix + 1; i < contents.length; i++) {
      fsd._cached_locmap[contents[i]] = { t: 'at', id: loc, pos: i - 1 };
    }
  });
  return [fs, id, parent.hooks ?? []];
}

export function moveId(fs: Fs, fromLoc: Location, toLoc: Location): [Fs, Hook[]] {
  if (fromLoc.t != 'at') { throw new Error(`moveId only supports at right now`); }
  if (toLoc.t != 'at') { throw new Error(`moveId only supports at right now`); }
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
