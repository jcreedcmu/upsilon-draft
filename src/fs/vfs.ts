import { Ident, Item, Location } from '../core/model';
import { Fs, itemOfPlan, ItemPlan, virtualId } from "./fs";


// a virtual id looks like
// root
// root/0
// root/0/3
// root/0/3/2/4/0
// etc.

export function getVirtualItem(fs: Fs, ident: Ident): Item {
  return itemOfPlan(getVirtualItemPlan(fs, ident));
}

function itemPlanOfIndices(parts: number[]): ItemPlan {
  if (parts.length == 0 || parts[parts.length - 1] == 0) {
    return {
      t: 'dir',
      name: 'virtual' + parts.join("."),
      contents: [0, 1, 2].map(x => ({ t: 'virtual', id: ['vroot', ...parts, x].join('/') }))
    }
  }
  else {
    return { t: 'file', name: parts[parts.length - 1] == 1 ? 'foo' : 'bar', text: 'blah' };
  }
}

export function getVirtualItemPlan(fs: Fs, ident: Ident): ItemPlan {
  const parts = ident.split('/');
  parts.shift();
  return itemPlanOfIndices(parts.map(x => parseInt(x)));
}

export function getVirtualItemLocation(fs: Fs, ident: Ident): Location {
  const parts = ident.split('/');
  if (parts.length == 1) {
    // It's ok to advertise the root of the virtual filesystem as
    // being a root. During initialization we actually move it to
    // being located inside the real filesystem.
    return { t: 'is_root' };
  }
  else {
    console.log('child, parent', ident, virtualId(parts.slice(0, -1).join('/')));
    return { t: 'at', id: virtualId(parts.slice(0, -1).join('/')), pos: parseInt(parts[parts.length - 1]) }
  }

}
