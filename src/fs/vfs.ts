import { Ident, Item, Location } from '../core/model';
import { translit } from '../util/alphabet';
import { Rand } from '../util/util';
import { Fs, itemOfPlan, ItemPlan, virtualId } from "./fs";
import { Resources } from './resources';

// a virtual id looks like
// vroot
// vroot/foo1
// vroot/foo1/foo2
// vroot/foo1/foo3
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
    case 'dir': return {
      t: 'dir',
      name: vip.name == 'vroot' ? 'virtual' : vip.name,
      contents: vip.contents.map(id => ({ t: 'virtual', id: `${ident}/${id}` }))
    };
  }
}
export function getVirtualItem(ident: Ident): Item {
  return itemOfPlan(planOfVirtualPlan(ident, getVirtualItemPlan(ident)));
}

function virtualPlanOfIdent(ident: Ident): VirtualItemPlan {
  let seed = undefined;
  let m;
  if (ident == 'vroot') {
    seed = 0;
  }
  if (m = ident.match(/dir-(\d+)/)) {
    seed = parseInt(m[1]);
  }
  if (seed != undefined) {

    const rand = new Rand(seed);
    const contents: Ident[] = [];
    for (let i = 0; i < 5; i++) {
      const genid = rand.i(25);
      contents.push(`dir-${genid}`);
    }
    if (seed == 0) {
      contents.push(translit('tapra'));
    }
    if (seed == 1) {
      contents.push(translit('gar'));
    }
    if (seed == 2) {
      contents.push(translit('wojma'));
    }
    return { t: 'dir', name: ident, contents };
  }
  else {
    return { t: 'file', name: ident };
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
