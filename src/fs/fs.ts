import { produce } from "../util/produce";
import { Resources } from './resources';
import { SpecialId } from "./initialFs";
import { canOpen } from '../core/lines';
import { Hook, Ident, Item, Location } from '../core/model';

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
  | { t: 'file', name: string, text?: string, size?: number, resources?: Resources }
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

export function getVirtualItem(fs: Fs, ident: Ident): Item {
  if (ident == 'file') {
    return planItem({ t: 'file', name: 'foobar', text: 'blah' });
  }
  else {
    return planItem({ t: 'dir', name: 'virtual', contents: [{ t: 'virtual', id: 'file' }] });
  }
}

export function getItem(fs: Fs, ident: Ident): Item {
  const item = fs.idToItem[ident];
  if (item === undefined) {
    if (ident.match(VIRTUAL_ITEM_PATTERN)) {
      return getVirtualItem(fs, ident.replace(VIRTUAL_ITEM_PATTERN, ''));
    }
    throw new Error(`Couldn't find ident ${ident}`);
  }
  return item;
}

export function getLocation(fs: Fs, ident: Ident): Location | undefined {
  return fs._cached_locmap[ident];
}

//// FIXME: dead code?
//
// export function getDirMaybe(fs: Fs, ident: Ident): Item | undefined {
//   const cand = fs.idToItem[ident];
//   if (!canOpen(cand)) return undefined;
//   return cand;
// }

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

function planItem(plan: ItemPlan): Item {
  switch (plan.t) {

    case 'dir': {
      return {
        name: plan.name,
        acls: { open: true },
        contents: [],
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
      resources: {},
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
    ident = `${VIRTUAL_ITEM_PREFIX}${plan.id}`;
    // XXX factor this out as insertIdLast?
    const ix = getContents(fs, loc).length; // ignore hooks during init
    [fs,] = insertId(fs, loc, ix, ident);
  }
  else {
    [fs, ident] = insertItem(fs, loc, planItem(plan),
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

// This doesn't create the item itself, just inserts the id in the right place
export function insertId(fs: Fs, loc: Ident, ix: number, id: Ident): [Fs, Hook[]] {
  const parent = fs.idToItem[loc];
  if (parent == undefined) {
    throw new Error(`Invariant violation: trying to insert item in unknown location ${loc}`);
  }
  fs = produce(fs, fsd => {
    const contents = fsd.idToItem[loc].contents;
    contents.splice(ix, 0, id); // insert id at index ix

    // recache the position of every item in the dir
    // XXX There is some annoying quadratic time-wasting during
    // initialization updating _cached_locmap a lot, oh well.
    contents.forEach((id, ix) => {
      fsd._cached_locmap[id] = { t: 'at', id: loc, pos: ix };
    });
  });
  return [fs, parent.hooks ?? []];
}

export function removeId(fs: Fs, loc: Ident, ix: number): [Fs, Ident, Hook[]] {
  const parent = fs.idToItem[loc];
  if (parent == undefined) {
    throw new Error(`Invariant violation: trying to remove item from unknown location ${loc}`);
  }
  const id = fs.idToItem[loc].contents[ix];

  fs = produce(fs, fsd => {
    const contents = fsd.idToItem[loc].contents;

    contents.splice(ix, 1); // remove id at index ix
    // recache the position of every item in the dir
    contents.forEach((id, ix) => {
      fsd._cached_locmap[id] = { t: 'at', id: loc, pos: ix };
    });
  });
  return [fs, id, parent.hooks ?? []];
}
