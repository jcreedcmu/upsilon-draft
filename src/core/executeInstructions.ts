import { produce } from "../util/produce";
import { getResource, modifyResourceꜝ, Resource } from "../fs/resources";
import { createAndInsertItem, getContents, getItem, getLocation, maybeGetItem, moveId, moveIdTo, reifyId } from "../fs/fs";
import { Effect, GameState, Ident, Item, nextLocation } from "./model";
import { processHooks, withError } from "./reduce";

export type ExecutableSpec = {
  cycles: number,
  cpuCost: number,
  numTargets?: number,
}

export enum ExecutableName {
  textDialog = 'text-dialog',
  combine = 'combine',
  movCpu5 = 'mov-cpu-5',
  movCpu1 = 'mov-cpu-1',
  toggleOpen = 'toggle-open',
  togglePickup = 'toggle-pickup',
  toggleInstr = 'toggle-instr',
  toggleExec = 'toggle-exec',
  toggleUnlock = 'toggle-unlock',
  toggleCaps = 'toggle-caps',
  prefix = 'prefix',
  charge = 'charge',
  treadmill = 'treadmill',
  extractId = 'extract-id',
  magnet = 'magnet',
};

export const executableNameMap: Record<ExecutableName, ExecutableSpec> = {
  'text-dialog': { cycles: 3, cpuCost: 0, numTargets: 0 },
  'combine': { cycles: 10, cpuCost: 1, numTargets: 2 },
  'mov-cpu-5': { cycles: 5, cpuCost: 1, numTargets: 2 },
  'mov-cpu-1': { cycles: 5, cpuCost: 1, numTargets: 2 },
  'toggle-open': { cycles: 5, cpuCost: 1 },
  'toggle-pickup': { cycles: 5, cpuCost: 1 },
  'toggle-instr': { cycles: 5, cpuCost: 1 },
  'toggle-exec': { cycles: 5, cpuCost: 1 },
  'toggle-unlock': { cycles: 5, cpuCost: 1 },
  'toggle-caps': { cycles: 5, cpuCost: 1 },
  'prefix': { cycles: 5, cpuCost: 1 },
  'charge': { cycles: 5, cpuCost: 1 },
  'treadmill': { cycles: 50, cpuCost: 0 },
  'extract-id': { cycles: 5, cpuCost: 1 },
  'magnet': { cycles: 5, cpuCost: 1 },
}

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
    modifyResourceꜝ(getItem(s.fs, targets[0]), 'cpu', x => x - actualAmount);
    modifyResourceꜝ(getItem(s.fs, targets[1]), 'cpu', x => x + actualAmount);
  }), []];
}

// These effects don't need to include redraw. Do they need reschedule?
// Wait, maybe they do need a redraw if they're zero-cycle.
export function executeInstructions(state: GameState, instr: ExecutableName, targets: Ident[], actor: Ident): [GameState, Effect[]] {


  function withModifiedTarget(f: (x: Item) => void): [GameState, Effect[]] {
    const target = getItem(state.fs, targets[0]);
    const ftgt = produce(target, t => { f(t); });

    // XXX this is wrong if idToItem doesn't already have a location
    return [produce(state, s => {
      s.fs.idToItem[targets[0]] = ftgt;
    }), [{ t: 'playSound', effect: 'ping' }]];
  }

  switch (instr) {
    case ExecutableName.textDialog:
      return [produce(state, s => {
        s.viewState = { t: 'textDialogView', back: state.viewState };
      }), [{ t: 'redraw' }]];
    case ExecutableName.combine:
      return [state, []];
    case ExecutableName.movCpu5: return movResource(state, targets, 'cpu', 5);
    case ExecutableName.movCpu1: return movResource(state, targets, 'cpu', 1);


    case ExecutableName.charge:
      return withModifiedTarget(tgt => { modifyResourceꜝ(tgt, 'cpu', x => x + 1); });
    case ExecutableName.treadmill:
      return withModifiedTarget(tgt => { modifyResourceꜝ(tgt, 'cpu', x => x + 1); });

    case ExecutableName.toggleUnlock:
      return withModifiedTarget(tgt => { tgt.acls.unlock = !tgt.acls.unlock; });
    case ExecutableName.toggleExec:
      return withModifiedTarget(tgt => { tgt.acls.exec = !tgt.acls.exec; });

    case ExecutableName.togglePickup:
      return withModifiedTarget(tgt => { tgt.acls.pickup = !tgt.acls.pickup; });

    case ExecutableName.toggleInstr:
      return withModifiedTarget(tgt => { tgt.acls.instr = !tgt.acls.instr; });

    case ExecutableName.toggleCaps:
      return withModifiedTarget(tgt => { tgt.name = tgt.name === tgt.name.toUpperCase() ? tgt.name.toLowerCase() : tgt.name.toUpperCase(); });

    case ExecutableName.toggleOpen:
      return withModifiedTarget(tgt => { tgt.acls.open = !tgt.acls.open; });
    case ExecutableName.prefix:
      return withModifiedTarget(tgt => { tgt.name = "." + tgt.name; });

    case ExecutableName.extractId: {
      // Takes one argument.
      // Creates a new file whose name is the item id of that argument.
      // Sort of like taking the address of a pointer.
      const newItem: Item = {
        name: targets[0],
        contents: [], acls: { pickup: true }, resources: {}, size: 1
      };
      const newItemLoc = nextLocation(getLocation(state.fs, actor));
      if (newItemLoc.t == 'is_root') {
        return withError(state, 'badInputs');
      }
      const [newfs, id, hooks] = createAndInsertItem(state.fs, newItemLoc.id, newItemLoc.pos, newItem);
      state = produce(state, s => { s.fs = newfs; });
      state = processHooks(state, hooks);
      return [state, [{ t: 'redraw' /* ??? */ }, { t: 'playSound', effect: 'ping' }]];
    }

    case ExecutableName.magnet: {
      const referentId = getItem(state.fs, targets[0]).name;
      const referent: Item | undefined = maybeGetItem(state.fs, referentId);
      if (referent == undefined) {
        return withError(state, 'badInputs');
      }
      else {
        const newItemLoc = nextLocation(getLocation(state.fs, actor));
        // XXX there is a funny edge case where things go wrong if
        // the old item loc is in the same dir, where the meaning of the new
        // location is invalidated by deleting the old location.
        // Maybe moveIdTo needs to take a call back that returns a location,
        // so that I can capture the intent that the new location is
        // nextLocation(getLocation(... actor)) in a more robust way?

        // Similarly the "currently selected line" should be sort of robust
        // against insertions.
        const [newfs, hooks] = moveIdTo(state.fs, referentId, newItemLoc);
        state = produce(state, s => { s.fs = newfs; });
        state = processHooks(state, hooks);
        return [state, [{ t: 'redraw' /* ??? */ }, { t: 'playSound', effect: 'ping' }]];
      }
    }
  }
}
