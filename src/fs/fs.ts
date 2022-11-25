import { produce } from "../util/produce";
import { Resources } from './resources';
import { SpecialId } from "./initialFs";
import { canOpen } from '../core/lines';
import { Hook, Ident, Item, Location } from '../core/model';
import { getVirtualItem, getVirtualItemLocation } from "./vfs";

/// Constants

const VIRTUAL_ITEM_PATTERN = /^_gen_/;
const VIRTUAL_ITEM_PREFIX = '_gen_';

/// Types

export type Fs = {
  counter: number;
  idToItem: Record<Ident, Item>;

  // Any field that is named _cached_* is a computed
  // view that is not part of the fundamental state.
  _cached_locmap: Record<Ident, Location>;
};

export type ItemPlan =
  | { t: 'dir', name: string, contents: VirtualItemPlan[], forceId?: Ident, hooks?: Hook[] }
  | { t: 'exec', name: string, contents: ItemPlan[], forceId?: Ident, numTargets?: number, resources?: Resources }
  | { t: 'file', name: string, text?: string, size?: number, resources?: Resources, forceId?: Ident }
  | { t: 'instr', name: string };

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


export function getItem(fs: Fs, ident: Ident): Item {
  const item = fs.idToItem[ident];
  if (item === undefined) {
    if (ident.match(VIRTUAL_ITEM_PATTERN)) {
      return getVirtualItem(ident.replace(VIRTUAL_ITEM_PATTERN, ''));
    }
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
    acls: {},
    contents: [],
    resources: {},
    size: 0
  });
  return fs;
}

export function mkFs(): Fs {
  let fs: Fs = {
    counter: 0,
    idToItem: {},
    _cached_locmap: {}
  };
  fs = makeInsertRootItem(fs, SpecialId.root)
  fs = makeInsertRootItem(fs, SpecialId.inventory);
  return fs;
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
        contents: plan.contents.flatMap(x => x.t == 'virtual' ? [virtualId(x.id)] : []),
        resources: {},
        size: 1,
        hooks: plan.hooks,
      };
    }

    case 'exec': {
      return {
        name: plan.name,
        acls: { exec: true, pickup: true },
        contents: [],
        resources: plan.resources ?? {},
        size: 1,
      };
    }

    case 'file': return {
      name: plan.name,
      acls: { pickup: true },
      contents: [],
      text: plan.text,
      resources: plan.resources ?? {},
      size: 1,
    };

    case 'instr': return {
      name: plan.name,
      acls: { instr: true, pickup: true },
      contents: [],
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

// Inserts at end of loc. Intended for fs initialization.
export function insertItem(fs: Fs, loc: Ident, item: Item, forceId?: Ident): [Fs, Ident] {
  const id = forceId ?? `item.${fs.counter}`;
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
  const newItem = f(getItem(fs, ident));
  return produce(fs, fsd => {
    fsd.idToItem[ident] = newItem;
  });
}

// This doesn't create the item itself, just inserts the id in the right place
export function insertId(fs: Fs, loc: Ident, ix: number, id: Ident): [Fs, Hook[]] {
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

//// Dead code?
// function spliced<T>(list: T[], ix: number, length: number): T[] {
//   const tmp = [...list];
//   tmp.slice(ix, length);
//   return tmp;
// }

export function removeId(fs: Fs, loc: Ident, ix: number): [Fs, Ident, Hook[]] {
  const parent = getItem(fs, loc);
  const contents = [...parent.contents];
  const id = contents[ix];

  fs = modifyItem(fs, loc, item => produce(item, it => { it.contents.splice(ix, 1) }));

  fs = produce(fs, fsd => {
    fsd._cached_locmap[id] = { t: 'is_root' };
    for (let i = ix + 1; i < contents.length; i++) {
      fsd._cached_locmap[contents[i]] = { t: 'at', id: loc, pos: i - 1 };
    }
  });
  return [fs, id, parent.hooks ?? []];
}
