import { createAndInsertItem, getItem, getLocation, maybeGetItem, moveIdTo, reifyId, textContent } from "../fs/fs";
import { getResource, modifyResourceꜝ, Resource } from "../fs/resources";
import { produce } from "../util/produce";
import { nowTicks } from "./clock";
import { ErrorInfo } from "./errors";
import { Effect, GameState, Ident, Item, Location, nextLocation } from "./model";
import { processHooks, withError } from "./reduce";

export type ExecutableSpec = {
  cycles: number,
  cpuCost: number,
  numTargets?: number,
}

export const executables = {
  textDialog: 'text-dialog',
  combine: 'combine',
  movCpu5: 'mov-cpu-5',
  movCpu1: 'mov-cpu-1',
  toggleOpen: 'toggle-open',
  togglePickup: 'toggle-pickup',
  toggleInstr: 'toggle-instr',
  toggleExec: 'toggle-exec',
  toggleUnlock: 'toggle-unlock',
  toggleCaps: 'toggle-caps',
  prefix: 'prefix',
  charge: 'charge',
  treadmill: 'treadmill',
  extractId: 'extract-id',
  magnet: 'magnet',
  modify: 'modify',
  copy: 'copy',
  automate: 'automate',
} as const;

export type ExecutablesType = typeof executables;
export type ExecutableName = ExecutablesType[keyof ExecutablesType];

export const executableProperties: Record<ExecutableName, ExecutableSpec> = {
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
  'modify': { cycles: 5, cpuCost: 1 },
  'copy': { cycles: 5, cpuCost: 1 },
  'automate': { cycles: 5, cpuCost: 1 },
}

export function modificationOrder(): readonly ExecutableName[] {
  // the fact that typescript infers `_modificationOrder` here as
  //    ("text-dialog" | ⋯)[]
  // seems to depend on `executables` being `as const`, but doesn't
  // require `_modificationOrder` to be `as const` to get an effective
  // static exhaustiveness check via _staticCheckCoverage below.
  const _modificationOrder = [
    executables.textDialog,
    executables.combine,
    executables.movCpu5,
    executables.movCpu1,
    executables.toggleOpen,
    executables.togglePickup,
    executables.toggleInstr,
    executables.toggleExec,
    executables.toggleUnlock,
    executables.toggleCaps,
    executables.prefix,
    executables.charge,
    executables.treadmill,
    executables.extractId,
    executables.magnet,
    executables.modify,
    executables.copy,
    executables.automate
  ];

  // We don't ever expect to call this function, but it will only typecheck if
  // every value of `executables` appears somewhere in _modificationOrder
  function _staticCheckCoverage(x: ExecutableName, f: (y: (typeof _modificationOrder)[number]) => void): void {
    return f(x);
  }
  return _modificationOrder;
}

export function isExecutable(k: string): k is ExecutableName {
  return k in executableProperties;
}

function movResource(state: GameState, targets: Ident[], resource: Resource, amount: number, loc: Location): [GameState, Effect[], ErrorInfo | undefined] {
  const actualAmount = Math.min(amount, getResource(getItem(state.fs, targets[0]), 'cpu'));

  let fs = state.fs;
  fs = reifyId(fs, targets[0]);
  fs = reifyId(fs, targets[1]);
  state = produce(state, s => { s.fs = fs; });
  return [produce(state, s => {
    modifyResourceꜝ(getItem(s.fs, targets[0]), 'cpu', x => x - actualAmount);
    modifyResourceꜝ(getItem(s.fs, targets[1]), 'cpu', x => x + actualAmount);
  }), [{ t: 'playAbstractSound', effect: 'success', loc }], undefined];
}

function withErrorExec(state: GameState, errorInfo: ErrorInfo): [GameState, Effect[], ErrorInfo | undefined] {
  return [...withError(state, errorInfo), errorInfo];
}

export function executeInstructions(state: GameState, instr: ExecutableName, targets: Ident[], actor: Ident): [GameState, Effect[], ErrorInfo | undefined] {

  const loc = getLocation(state.fs, actor);

  function withModifiedTarget(f: (x: Item) => void): [GameState, Effect[], ErrorInfo | undefined] {
    const target = getItem(state.fs, targets[0]);
    const ftgt = produce(target, t => { f(t); });

    // XXX this is wrong if idToItem doesn't already have a location
    return [produce(state, s => {
      s.fs.idToItem[targets[0]] = ftgt;
    }), [{ t: 'playAbstractSound', effect: 'success', loc }], undefined];
  }

  switch (instr) {
    case executables.textDialog:
      return [produce(state, s => {
        s.viewState = { t: 'textDialogView', back: state.viewState };
      }), [], undefined];
    case executables.combine:
      return [state, [{ t: 'playAbstractSound', effect: 'success', loc }], undefined];
    case executables.movCpu5: return movResource(state, targets, 'cpu', 5, loc);
    case executables.movCpu1: return movResource(state, targets, 'cpu', 1, loc);


    case executables.charge:
      return withModifiedTarget(tgt => { modifyResourceꜝ(tgt, 'cpu', x => x + 1); });
    case executables.treadmill:
      return withModifiedTarget(tgt => { modifyResourceꜝ(tgt, 'cpu', x => x + 1); });

    case executables.toggleUnlock:
      return withModifiedTarget(tgt => { tgt.acls.unlock = !tgt.acls.unlock; });
    case executables.toggleExec:
      return withModifiedTarget(tgt => { tgt.acls.exec = !tgt.acls.exec; });

    case executables.togglePickup:
      return withModifiedTarget(tgt => { tgt.acls.pickup = !tgt.acls.pickup; });

    case executables.toggleInstr:
      return withModifiedTarget(tgt => { tgt.acls.instr = !tgt.acls.instr; });

    case executables.toggleCaps:
      return withModifiedTarget(tgt => { tgt.name = tgt.name === tgt.name.toUpperCase() ? tgt.name.toLowerCase() : tgt.name.toUpperCase(); });

    case executables.toggleOpen:
      return withModifiedTarget(tgt => { tgt.acls.open = !tgt.acls.open; });
    case executables.prefix:
      return withModifiedTarget(tgt => { tgt.name = "." + tgt.name; });

    case executables.extractId: {
      // Takes one argument.
      // Creates a new file whose name is the item id of that argument.
      // Sort of like taking the address of a pointer.
      const newItem: Item = {
        name: targets[0],
        content: textContent(''),
        acls: { pickup: true }, resources: {}, size: 1
      };
      const newItemLoc = nextLocation(loc);
      if (newItemLoc.t != 'at') {
        // XXX not sure if this is the right error
        return withErrorExec(state, { code: 'badInputs', blame: actor, loc });
      }
      const [newfs, id, hooks] = createAndInsertItem(state.fs, newItemLoc.id, newItemLoc.pos, newItem);
      state = produce(state, s => { s.fs = newfs; });
      state = processHooks(state, hooks);
      return [state, [{ t: 'playAbstractSound', effect: 'success', loc }], undefined];
    }

    case executables.magnet: {
      const referentId = getItem(state.fs, targets[0]).name;
      const referent: Item | undefined = maybeGetItem(state.fs, referentId);
      if (referent == undefined) {
        return withErrorExec(state, { code: 'badInputs', blame: actor, loc });
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
        return [state, [{ t: 'playAbstractSound', effect: 'success', loc }], undefined];
      }
    }

    case executables.modify: {
      let newName = getItem(state.fs, targets[0]).name;
      const mo = modificationOrder();
      const found = mo.findIndex(x => x == newName);
      if (found != -1) {
        newName = mo[(found + 1) % mo.length];
      }
      return withModifiedTarget(tgt => {
        tgt.name = newName;
      });
    }

    case executables.copy: {
      // Takes one argument.
      // Creates a new file whose name is the same as argument.
      // Doesn't copy attributes or acls or anything.
      const item = getItem(state.fs, targets[0]);
      const newItem: Item = {
        name: item.name,
        content: item.content,
        acls: { pickup: true }, resources: {}, size: 1
      };
      const newItemLoc = nextLocation(loc);
      if (newItemLoc.t != 'at') {
        // XXX not sure if this is the right error
        return withErrorExec(state, { code: 'badInputs', blame: actor, loc });
      }
      const [newfs, id, hooks] = createAndInsertItem(state.fs, newItemLoc.id, newItemLoc.pos, newItem);
      state = produce(state, s => { s.fs = newfs; });
      state = processHooks(state, hooks);
      return [state, [{ t: 'playAbstractSound', effect: 'success', loc }], undefined];
    }

    case executables.automate: {
      return [produce(state, s => {
        if (targets[0] in state.recurring) {
          delete s.recurring[targets[0]];
        }
        else {
          s.recurring[targets[0]] = { startTicks: nowTicks(state.clock) + 20, periodTicks: 20 };
        }
      }), [{ t: 'playAbstractSound', effect: 'success', loc }], undefined];

    }
  }

}
