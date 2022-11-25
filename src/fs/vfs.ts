import { Ident, Item, Location } from '../core/model';
import { Fs, itemOfPlan, ItemPlan, virtualId } from "./fs";


// a virtual id looks like
// vroot
// vroot/foo1
// vroot/foo1/foo2
// vroot/foo1/foo3
// etc.

type VirtualItemPlan =
  | { t: 'file', name: string }
  | { t: 'dir', name: string, contents: Ident[] };

function planOfVirtualPlan(ident: Ident, vip: VirtualItemPlan): ItemPlan {
  switch (vip.t) {
    case 'file': return { t: 'file', name: vip.name };
    case 'dir': return {
      t: 'dir', name: vip.name,
      contents: vip.contents.map(id => ({ t: 'virtual', id: `${ident}/${id}` }))
    };
  }
}
export function getVirtualItem(ident: Ident): Item {
  return itemOfPlan(planOfVirtualPlan(ident, getVirtualItemPlan(ident)));
}

export function getVirtualItemPlan(ident: Ident): VirtualItemPlan {
  const parts = ident.split('/');
  const last = parts.pop()!;
  switch (last) {
    case 'vroot': return { t: 'dir', name: 'virtual', contents: ['foo', 'bar'] };
    case 'foo': return { t: 'dir', name: 'foo', contents: ['baz'] };
    case 'bar': return { t: 'dir', name: 'bar', contents: ['baz'] };
    default: return { t: 'file', name: last };
  }
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
