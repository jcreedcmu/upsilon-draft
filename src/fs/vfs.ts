import { Ident, Item, Location } from '../core/model';
import { translit } from '../util/alphabet';
import { Rand } from '../util/util';
import { Fs, itemOfPlan, ItemPlan, virtualId } from "./fs";
import { Resources } from './resources';
import { GeneralItemPlan as GeneralItemPlan } from './fs';
import { getAssets } from '../core/assets';
/// Constants

// The idea is that every virtual item doesn't have a normal abstract
// id, but rather an id that tells us enough information that we're
// able to regenerate its hereditary contents deterministically.
export const VIRTUAL_ITEM_PATTERN = /^_gen_/;
export const VIRTUAL_ITEM_PREFIX = '_gen_';

// In practice, a virtual id looks like
// _gen_vroot
// _gen_vroot/foo1
// _gen_vroot/foo1/foo2
// _gen_vroot/foo1/foo3
// etc.

type VirtualItemPlan =
  | { t: 'file', name: string }
  | { t: 'dir', name: string, contents: Ident[] };

function resourcesOfIdent(ident: Ident): Resources {
  switch (ident) {
    case translit('tapra'): return { cpu: 3 };
    default: return {};
  }
}

function planOfVirtualPlan(ident: Ident, vip: VirtualItemPlan): ItemPlan {
  switch (vip.t) {
    case 'file': return {
      t: 'file', name: vip.name, resources: resourcesOfIdent(vip.name)
    };
    case 'dir': {
      const contents: GeneralItemPlan[] = vip.contents.map(id => ({ t: 'virtual', id: `${ident}/${id}` }));
      return {
        t: 'dir',
        name: vip.name == 'vroot' ? 'virtual' : vip.name,
        contents,
      };
    }
  }
}
export function getVirtualItem(ident: Ident): Item {
  const plan = planOfVirtualPlan(ident, getVirtualItemPlan(ident))
  const item = itemOfPlan(plan);
  // XXX I don't love this special case, but this is what I want out of a virtual item dir:
  // that it already knows its contents.
  if (plan.t == 'dir') {
    return {
      ...item, content: {
        t: 'file', text: '', contents: plan.contents.map(x => {
          if (x.t == 'virtual') {
            return virtualId(x.id);
          }
          else {
            throw new Error(`nonvirtual item plan inside virtual item plan`);
          }
        })
      }
    };
  }
  else {
    return item;
  }
}

function randomLetter(rand: Rand): string {
  return String.fromCharCode(97 + rand.i(26));
}

function maybeRandomLetter(rand: Rand): string {
  return rand.i(4) == 0 ? randomLetter(rand) : '';
}

function randomName(rand: Rand): string {
  const surnames = getAssets().surnames;
  return randomLetter(rand) + maybeRandomLetter(rand) + surnames[rand.i(surnames.length)];
}

function nameOfIdent(ident: Ident): string {
  let m;
  if (m = ident.match(/^dir-(\d+)$/)) {
    const seed = parseInt(m[1]);
    return randomName(new Rand(seed));
  }
  else {
    return ident;
  }
}

function virtualPlanOfIdent(ident: Ident): VirtualItemPlan {
  let seed = undefined;
  let m;
  if (ident == 'vroot') {
    seed = 0;
  }
  if (m = ident.match(/^dir-(\d+)$/)) {
    seed = parseInt(m[1]);
  }
  if (seed != undefined) {

    const rand = new Rand(seed);
    const contents: Ident[] = [];
    for (let i = 0; i < 5; i++) {
      const genid = rand.i(1000);
      contents.push(`dir-${genid}`);
    }
    if (seed < 100) {
      contents.push(translit('tapra'));
    }
    else if (seed < 200) {
      contents.push(translit('gar'));
    }
    else if (seed < 300) {
      contents.push(translit('wojma'));
    }
    return { t: 'dir', name: nameOfIdent(ident), contents };
  }
  else {
    return { t: 'file', name: nameOfIdent(ident) };
  }
}

export function getVirtualItemPlan(path: Ident): VirtualItemPlan {
  return virtualPlanOfIdent(path.split('/').pop()!);
}

export function getVirtualItemLocation(ident: Ident): Location {
  const parts = ident.split('/');
  const last = parts[parts.length - 1];
  if (parts.length == 1) {
    // It's ok to advertise the root of the virtual filesystem as
    // being a root. During initialization we actually move it to
    // being located inside the real filesystem.
    return { t: 'is_root' };
  }
  else {
    const dirId = parts.slice(0, -1).join('/');
    const vip = getVirtualItemPlan(dirId);
    if (vip.t != 'dir') {
      throw new Error(`invariant violation: ${dirId} should be a dir`);
    }
    const pos = vip.contents.findIndex(t => t == last);
    return { t: 'at', pos, id: virtualId(dirId) };
  }

}
