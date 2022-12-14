import { createAndInsertItem, Fs, getItem, getItemIdsAfter, getItemIdsBefore, getLocation, maybeGetItem, modifyItemꜝ, moveIdTo, reifyId, textContent } from "../fs/fs";
import { getResource, modifyResourceꜝ, Resource } from "../fs/resources";
import { produce } from "../util/produce";
import { nowTicks } from "./clock";
import { ErrorInfo } from "./errors";
import { canPickup } from "./lines";
import { Effect, GameAction, GameState, Ident, Item, Location, nextLocation } from "./model";
import { addFutureꜝ, processHooks, reduceGameStateFs, ReduceResult, ReduceResultErr, withError } from "./reduce";

export const RECURRENCE_LENGTH = 10;

export type ExecutableSpec = {
  cycles: number, // how long it takes to execute
  cpuCost: number, // how much cpu quota it costs to execute

  // When `numTargets` is negative, it means "grab `abs(numTargets)`
  // targets from before executable, rather than after"
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
  robot: 'robot',
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
  'robot': { cycles: 5, cpuCost: 1, numTargets: -1 },
}

export function numTargetsOfExecutableName(name: ExecutableName): number {
  return executableProperties[name].numTargets ?? 1;
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
    executables.automate,
    executables.robot
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

function movResource(state: GameState, targets: Ident[], resource: Resource, amount: number, loc: Location): ReduceResultErr {
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

function withErrorExec(state: GameState, errorInfo: ErrorInfo): ReduceResultErr {
  return [...withError(state, errorInfo), errorInfo];
}

export function isRecurring(state: GameState, ident: Ident): boolean {
  return !!state.recurring[ident];
}

export function scheduleRecurꜝ(state: GameState, ident: Ident) {
  addFutureꜝ(state, nowTicks(state.clock) + RECURRENCE_LENGTH, { t: 'recur', ident }, true);
  // NOTE: this periodTicks data is currently unused, but it feels right to me
  // that it should be introspectable.
  state.recurring[ident] = { periodTicks: RECURRENCE_LENGTH };

}

export function cancelRecurꜝ(state: GameState, ident: Ident) {
  delete state.recurring[ident];
}

function getTargetsFor(fs: Fs, loc: Location, instr: ExecutableName): Ident[] | undefined {
  const numTargets = numTargetsOfExecutableName(instr);
  const absNumTargets = Math.abs(numTargets);
  if (numTargets < 0) {
    return getItemIdsBefore(fs, loc, absNumTargets);
  }
  else {
    return getItemIdsAfter(fs, loc, absNumTargets);
  }
}

/*
This is a wrapper around executeInstructionsWithTargets. It is called
after a binary completes its "progress bar" timeout. The job of
executeInstructions is to do any work around the particular action of
the particular executable. Right now this includes:

- gathering what its targets (i.e., arguments) are
- doing a little ui flash of the targets if execution is successful.
*/
export function executeInstructions(state: GameState, instr: ExecutableName, id: Ident): ReduceResultErr {

  const loc = getLocation(state.fs, id);


  const targetIds = getTargetsFor(state.fs, loc, instr);
  if (targetIds == undefined) {
    return withErrorExec(state, { code: 'noArgument', blame: id, loc });
  }

  const targets = targetIds.map(tid => getItem(state.fs, tid));
  const actor = getItem(state.fs, id);
  if (!targets.every(target => canPickup(target, actor))) { // XXX not sure about this logic
    return withErrorExec(state, { code: 'itemLocked', blame: id, loc });
  }

  let effects, error;
  [state, effects, error] = executeInstructionsWithTargets(state, instr, id, targetIds);

  if (error == undefined) {
    // flash targets if not error
    const later = nowTicks(state.clock) + 1;
    state = produce(state, s => {
      if (targetIds.length > 0)
        addFutureꜝ(s, later, { t: 'none' }, true); // XXX maybe instead of 'none', clear .flashUntilTick for action.targetIds.
      targetIds.forEach(targetId => {
        modifyItemꜝ(s.fs, targetId, item => { item.flashUntilTick = later; });
      });
    });
  }

  return [state, effects, error];
}

/*
executeInstructionswithTargets assumes we know what a binary's targets
are, and actually updates the state (well, functionally returns an
updated state) with the real effect of the binary.
*/
export function executeInstructionsWithTargets(state: GameState, instr: ExecutableName, actorId: Ident, targetIds: Ident[]): ReduceResultErr {
  const loc = getLocation(state.fs, actorId);

  function withModifiedTarget(f: (x: Item) => void): ReduceResultErr {
    const target = getItem(state.fs, targetIds[0]);
    const ftgt = produce(target, t => { f(t); });

    // XXX this is wrong if idToItem doesn't already have a location
    return [produce(state, s => {
      s.fs.idToItem[targetIds[0]] = ftgt;
    }), [{ t: 'playAbstractSound', effect: 'success', loc }], undefined];
  }

  switch (instr) {
    case executables.textDialog:
      return [produce(state, s => {
        s.viewState = { t: 'textDialogView', back: state.viewState };
      }), [], undefined];
    case executables.combine:
      return [state, [{ t: 'playAbstractSound', effect: 'success', loc }], undefined];
    case executables.movCpu5: return movResource(state, targetIds, 'cpu', 5, loc);
    case executables.movCpu1: return movResource(state, targetIds, 'cpu', 1, loc);


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
        name: targetIds[0],
        content: textContent(''),
        acls: { pickup: true }, resources: {}, size: 1
      };
      const newItemLoc = nextLocation(loc);
      if (newItemLoc.t != 'at') {
        // XXX not sure if this is the right error
        return withErrorExec(state, { code: 'badInputs', blame: actorId, loc });
      }
      const [newfs, id, hooks] = createAndInsertItem(state.fs, newItemLoc.id, newItemLoc.pos, newItem);
      state = produce(state, s => { s.fs = newfs; });
      state = processHooks(state, hooks);
      return [state, [{ t: 'playAbstractSound', effect: 'success', loc }], undefined];
    }

    case executables.magnet: {
      const referentId = getItem(state.fs, targetIds[0]).name;
      const referent: Item | undefined = maybeGetItem(state.fs, referentId);
      if (referent == undefined) {
        return withErrorExec(state, { code: 'badInputs', blame: actorId, loc });
      }
      else {
        const newItemLoc = nextLocation(getLocation(state.fs, actorId));
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
      let newName = getItem(state.fs, targetIds[0]).name;
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
      const item = getItem(state.fs, targetIds[0]);
      const newItem: Item = {
        name: item.name,
        content: item.content,
        acls: { pickup: true }, resources: {}, size: 1
      };
      const newItemLoc = nextLocation(loc);
      if (newItemLoc.t != 'at') {
        // XXX not sure if this is the right error
        return withErrorExec(state, { code: 'badInputs', blame: actorId, loc });
      }
      const [newfs, id, hooks] = createAndInsertItem(state.fs, newItemLoc.id, newItemLoc.pos, newItem);
      state = produce(state, s => { s.fs = newfs; });
      state = processHooks(state, hooks);
      return [state, [{ t: 'playAbstractSound', effect: 'success', loc }], undefined];
    }

    case executables.automate: {
      const target = targetIds[0];
      return [produce(state, s => {
        if (target in state.recurring) {
          cancelRecurꜝ(s, target);
        }
        else {
          scheduleRecurꜝ(s, target);
        }
      }), [{ t: 'playAbstractSound', effect: 'success', loc }], undefined];

    }

    case executables.robot: {
      const target = getItem(state.fs, targetIds[0]);
      if (isExecutable(target.name)) {
        const numTargets = executableProperties[target.name].numTargets;
        const [state2, effect, error] = tryStartExecutable(state, targetIds[0]);
        const sound: Effect[] = error == undefined ? [{ t: 'playAbstractSound', effect: 'success', loc }] : [];

        // XXX move robot forward `numTargets` spaces...

        return [state2, [...effect, ...sound], error];
      }
      else {
        return withErrorExec(state, { code: 'illegalInstr', blame: actorId, loc });
      }
    }
  }
}

export function startExecutable(state: GameState, id: Ident, name: ExecutableName): ReduceResult {
  const [st, effect] = startExecutableWe(state, id, name);
  return [st, effect];
}

function startExecutableWe(state: GameState, id: Ident, name: ExecutableName): ReduceResultErr {

  const { cycles, cpuCost } = executableProperties[name];
  const loc = getLocation(state.fs, id);

  if (getResource(getItem(state.fs, id), 'cpu') < cpuCost) {
    return withErrorExec(state, { code: 'noCharge', blame: id, loc }); // XXX insufficient charge, really
  }

  state = produce(state, s => {
    modifyResourceꜝ(getItem(s.fs, id), 'cpu', x => x - cpuCost);
  });

  const action: GameAction = {
    t: 'finishExecution',
    actorId: id,
    instr: name,
  };

  if (cycles == 0) {
    let effects;
    [state, effects] = reduceGameStateFs(state, action);
    return [state, [...effects, { t: 'playAbstractSound', effect: 'execute', loc }], undefined];
  }
  else {
    // defer execution
    const now = nowTicks(state.clock);
    state = produce(state, s => {
      modifyItemꜝ(s.fs, id, item => {
        item.progress = {
          startTicks: now,
          totalTicks: cycles
        };
      });
      addFutureꜝ(s, now + cycles, action, true);
    });
    return [state, [{ t: 'playAbstractSound', effect: 'execute', loc }], undefined];
  }
}

export function tryStartExecutable(state: GameState, id: Ident): ReduceResultErr {
  // XXX more checking should happen here probably
  const actor = getItem(state.fs, id);
  const loc = getLocation(state.fs, id);
  if (isExecutable(actor.name)) {
    return startExecutableWe(state, id, actor.name);
  }
  else {
    // XXX not the right error code really
    return withErrorExec(state, { code: 'illegalInstr', blame: id, loc });
  }
}
