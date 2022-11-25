import { produce } from "../util/produce";
import { modifyResource } from "../fs/resources";
import { getContents, getItem } from "../fs/fs";
import { Effect, GameState, Ident, Item } from "./model";
import { withError } from "./reduce";

export function executeInstructions(state: GameState, targets: Ident[], actor: Ident): [GameState, Effect[]] {
  const actCont = getContents(state.fs, actor);

  // first item in contents of executable is a plain file naming the "cpu type"

  if (actCont.length <= 1) {
    return withError(state, 'noInstr');
  }

  const first = getItem(state.fs, actCont[1]);
  const target = getItem(state.fs, targets[0]);

  function withModifiedTarget(f: (x: Item) => void): [GameState, Effect[]] {
    const ftgt = produce(target, t => { f(t); });
    return [produce(state, s => {
      s.fs.idToItem[targets[0]] = ftgt;
    }), []];
  }

  if (!first.acls.instr) {
    return withError(state, 'illegalInstr');
  }

  switch (first.name) {
    case 'combine':
      // FIXME: unimplemented for now
      // if (targets[0].name == 'foo' && targets[1].name == 'bar') {
      //   return [{
      //     ...things.instr('toggle-open'),
      //     resources: resourcesPlus(targets[0].resources, targets[1].resources)
      //   }];
      // }
      // else {
      return withError(state, 'badInputs');
    // }
    // break;
    case 'charge':
      return withModifiedTarget(tgt => { modifyResource(tgt, 'cpu', x => x + 1); });
    case 'toggle-unlock':
      return withModifiedTarget(tgt => { tgt.acls.unlock = !tgt.acls.unlock; });
    case 'toggle-exec':
      return withModifiedTarget(tgt => { tgt.acls.exec = !tgt.acls.exec; });

    case 'toggle-pickup':
      return withModifiedTarget(tgt => { tgt.acls.pickup = !tgt.acls.pickup; });

    case 'toggle-instr':
      return withModifiedTarget(tgt => { tgt.acls.instr = !tgt.acls.instr; });

    case 'toggle-caps':
      return withModifiedTarget(tgt => { tgt.name = tgt.name === tgt.name.toUpperCase() ? tgt.name.toLowerCase() : tgt.name.toUpperCase(); });

    case 'toggle-open':
      return withModifiedTarget(tgt => { tgt.acls.open = !tgt.acls.open; });
    case 'prefix':
      return withModifiedTarget(tgt => { tgt.name = "." + tgt.name; });

    default:
      return withError(state, 'illegalInstr');

  }
}
