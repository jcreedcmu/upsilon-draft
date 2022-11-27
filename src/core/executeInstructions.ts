import { produce } from "../util/produce";
import { getResource, modifyResource, Resource } from "../fs/resources";
import { getContents, getItem, reifyId } from "../fs/fs";
import { Effect, GameState, Ident, Item } from "./model";
import { withError } from "./reduce";

export type ExecutableSpec = {
  cycles: number,
  cpuCost: number,
  numTargets: number,
}

const _executableNameMap = {
  'text-dialog': { cycles: 3, cpuCost: 0, numTargets: 0 },
  'combine': { cycles: 10, cpuCost: 1, numTargets: 2 },
  'mov-cpu-5': { cycles: 0, cpuCost: 1, numTargets: 2 },
  'mov-cpu-1': { cycles: 5, cpuCost: 1, numTargets: 2 },
}

export type ExecutableName = keyof (typeof _executableNameMap);

export const executableNameMap: Record<ExecutableName, ExecutableSpec> = _executableNameMap;

export function isExecutable(k: string): k is ExecutableName {
  return k in executableNameMap;
}

function movResource(state: GameState, targets: Ident[], resource: Resource, amount: number): [GameState, Effect[]] {
  const actualAmount = Math.min(amount, getResource(getItem(state.fs, targets[0]), 'cpu'));

  let fs = state.fs;
  fs = reifyId(fs, targets[0]);
  fs = reifyId(fs, targets[1]);
  state = produce(state, s => { s.fs = fs; });
  return [produce(state, s => {
    modifyResource(getItem(s.fs, targets[0]), 'cpu', x => x - actualAmount);
    modifyResource(getItem(s.fs, targets[1]), 'cpu', x => x + actualAmount);
  }), []];
}

// These effects don't need to include redraw. Cxu reschedule?
export function executeNamedInstructions(state: GameState, instr: ExecutableName, targets: Ident[], actor: Ident): [GameState, Effect[]] {
  switch (instr) {
    case 'text-dialog':
      return [produce(state, s => {
        s.viewState = { t: 'textDialogView', back: state.viewState };
      }), [{ t: 'redraw' }]];
    case 'combine':
      return [state, []];
    case 'mov-cpu-5': return movResource(state, targets, 'cpu', 5);
    case 'mov-cpu-1': return movResource(state, targets, 'cpu', 1);
  }
}

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
