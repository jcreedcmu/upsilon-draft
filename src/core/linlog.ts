import { unreachable } from "../util/util";
import { Chars } from "../ui/screen";
import { GameState, Ident, Item, ItemContent } from "./model";
import { processHooks, ReduceResult, withError } from "./reduce";
import { createAndInsertItem, getItem, getItemIdsAfter, getLocation, insertId, removeId } from "../fs/fs";
import { Resources } from "../fs/resources";
import { produce } from "../util/produce";

export type LinlogContent = { linlog: Linlog };

export type Linlog =
  | { t: 'atom', name: string }
  | { t: 'lolli', a: Linlog, b: Linlog }
  ;

export function latom(name: string): Linlog {
  return { t: 'atom', name };
}

export function limp(a: Linlog | string, b: Linlog | string): Linlog {
  const aa = typeof a == 'string' ? latom(a) : a;
  const bb = typeof b == 'string' ? latom(b) : b;
  return { t: 'lolli', a: aa, b: bb };
}

export function nameOfLinlog(ll: Linlog): string {
  if (ll.t == 'atom')
    return ll.name
  else if (ll.t == 'lolli') {
    let aa = nameOfLinlog(ll.a);
    if (ll.a.t == 'lolli') {
      aa = `(${aa})`;
    }
    const bb = nameOfLinlog(ll.b);
    return `${aa}${Chars.LOLLI}${bb}`;
  }
  else {
    return unreachable(ll);
  }
}

export function isLinLog(content: ItemContent): content is { t: 'linlog' } & LinlogContent {
  return content.t == 'linlog';
}

export function startLinlog(state: GameState, id: Ident, llc: LinlogContent): ReduceResult {
  const ll = llc.linlog;
  if (ll.t == 'atom')
    return withError(state, { code: 'badExecutable' });
  const locf = getLocation(state.fs, id);
  const targetIds = getItemIdsAfter(state.fs, locf, 1);
  if (targetIds == undefined || targetIds.length < 1)
    return withError(state, { code: 'badInputs' });

  const target = getItem(state.fs, targetIds[0]);
  if (target.content.t != 'linlog')
    return withError(state, { code: 'badInputs' });

  if (!llequal(ll.a, target.content.linlog))
    return withError(state, { code: 'badInputs' });

  // We're committing to removing the items now
  const loct = getLocation(state.fs, targetIds[0]);

  if (locf.t != 'at') { throw new Error(`linlog only supports 'at' right now`); }
  if (loct.t != 'at') { throw new Error(`linlog only supports 'at' right now`); }

  // remove target before function so we don't have to think too hard
  // about reindexing. Maybe we should be doing sequential removals
  // here by id instead of by location...
  const [fs1, , hooks1] = removeId(state.fs, loct.id, loct.pos);
  const [fs2, , hooks2] = removeId(fs1, locf.id, locf.pos);
  // XXX combine resources here, pass to llitem
  const [fs3, , hooks3] = createAndInsertItem(fs2, locf.id, locf.pos, llitem(ll.b));

  state = produce(state, s => { s.fs = fs3; });
  state = processHooks(state, [...hooks1, ...hooks2, ...hooks3]);

  return [state, [{ t: 'playAbstractSound', effect: 'success', loc: locf }]];
}

export function llitem(ll: Linlog, resources?: Resources): Item {
  return {
    name: nameOfLinlog(ll),
    acls: { pickup: true, exec: ll.t == 'lolli' },
    content: { t: 'linlog', linlog: ll },
    resources: resources ?? {},
    size: 1,
  }
}

function llequal(a: Linlog, b: Linlog): boolean {
  if (a.t == 'atom' && b.t == 'atom' && a.name == b.name) return true;
  if (a.t == 'lolli' && b.t == 'lolli' && llequal(a.a, b.a) && llequal(a.b, b.b)) return true;
  return false;
}
