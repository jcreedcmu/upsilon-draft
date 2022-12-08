import { produce } from '../util/produce';
import { State, Action, Effect, mkInGameState, GameState, getSelectedLine, getSelectedId, numTargetsOfExecutable, Ident, KeyAction, Hook, showOfFs, keybindingsOfFs, GameAction, deactivateItem, isNearby, isNearbyGame, SceneState } from './model';
import { getContents, getFullContents, getItem, getItemIdsAfter, getLocation, insertId, modifyItemꜝ, removeId } from '../fs/fs';
import { canPickup, DropLineAction, ExecLineAction, getLines, PickupLineAction } from './lines';
import { ErrorCode, errorCodes, ErrorInfo } from './errors';
import { nowTicks } from './clock';
import { logger } from '../util/debug';
import { getResource, modifyResourceꜝ } from '../fs/resources';
import { ExecutableName, executableProperties, ExecutableSpec, executeInstructions, isExecutable } from './executables';
import { SpecialId } from '../fs/initialFs';

export const EXEC_TICKS = 6;


export function reduce(state: SceneState, action: Action): [SceneState, Effect[]] {
  switch (state.t) {
    case 'game':
      if (action.t == 'boot') {
        if (state.gameState.power) {
          return [produce(state, s => { s.gameState.power = false; }),
          [/* XXX power down sound? */
            { t: 'powerButton' }]];
        }
        else {
          return [produce(
            /* XXX redundant construction? but I do in fact want to
            reconstruct for reboots... */
            mkInGameState(), s => { s.gameState.power = true; }),
          [{ t: 'playSound', effect: 'startup', locx: undefined },
          { t: 'powerButton' }]];
        }
      }
      else {
        if (state.gameState.power) {
          const [gameState, effects] = reduceGameState(state.gameState, action);
          return [produce(state, s => { s.gameState = gameState; }), effects];
        }
        else {
          return [state, []];
        }
      }
  }
}

function advanceLine(state: GameState, amount: number): GameState {
  const len = getLines(state, state.curId).length;
  return produce(state, s => { s.curLine = (s.curLine + len + amount) % len; });
}

function makeErrorBanner(state: GameState, code: ErrorCode): GameState {
  const now = nowTicks(state.clock);
  return produce(state, s => {
    s.error = {
      code: errorCodes[code],
    };
    // cancel any pending clearError futures
    s.futures = state.futures.filter(f => f.action.t != 'clearError');

    addFutureꜝ(s, now + 3, { t: 'clearError' });
  });
}

export function withError(state: GameState, errorInfo: ErrorInfo): [GameState, Effect[]] {
  const { code, blame, loc } = errorInfo;
  if (blame != undefined) {
    state = deactivateItem(state, blame);
  }
  if (isNearbyGame(state, loc)) {
    state = makeErrorBanner(state, code);
  }
  return [state, [
    { t: 'playSound', effect: 'error', locx: errorInfo.loc }
  ]]
}

// imperatively updates state
function addFutureꜝ(state: GameState, whenTicks: number, action: GameAction, live?: boolean) {
  state.futures.push({
    whenTicks,
    action,
    live: live ?? false,
  });
  // FIXME could be more efficient
  state.futures.sort((a, b) => a.whenTicks - b.whenTicks);
}

function startExecutable(state: GameState, id: Ident, name: ExecutableName): [GameState, Effect[]] {

  const { cycles, cpuCost, numTargets } = executableProperties[name];
  const loc = getLocation(state.fs, id);

  const targetIds = getItemIdsAfter(state.fs, id, numTargets ?? 1);
  if (targetIds == undefined) {
    return withError(state, { code: 'noArgument', blame: id, loc });
  }

  const targets = targetIds.map(tid => getItem(state.fs, tid));

  const actor = getItem(state.fs, id);
  if (!targets.every(target => canPickup(target, actor))) { // XXX not sure about this logic
    return withError(state, { code: 'itemLocked', blame: id, loc });
  }

  if (getResource(getItem(state.fs, id), 'cpu') < cpuCost) {
    return withError(state, { code: 'noCharge', blame: id, loc }); // XXX insufficient charge, really
  }

  state = produce(state, s => {
    modifyResourceꜝ(getItem(s.fs, id), 'cpu', x => x - cpuCost);
  });

  const action: GameAction = {
    t: 'finishExecution',
    actorId: id,
    targetIds,
    instr: name,
  };

  if (cycles == 0) {
    let effects;
    [state, effects] = reduceGameStateFs(state, action);
    return [state, [...effects, { t: 'playSound', effect: 'rising', locx: loc }]];
  }
  else {
    // defer execution
    const now = nowTicks(state.clock);
    state = produce(state, s => {
      modifyItemꜝ(s.fs, id, item => {
        item.progress = {
          startTicks: now,
          targetIds,
          totalTicks: cycles
        };
      });
      addFutureꜝ(s, now + cycles, action, true);
    });
    return [state, [{ t: 'playSound', effect: 'rising', locx: loc }]];
  }
}

// Something to note is that we're not checking the executability acl
// *here*; it's being checked in execActionForItem already when we
// construct lines for a directory. May want to reconsider this,
// although it is in some way convenient knowing whether a file is
// executable very early.
export function reduceExecAction(state: GameState, action: ExecLineAction): [GameState, Effect[]] {

  switch (action.t) {
    case 'descend': return [produce(state, s => {
      s.curId = getSelectedId(state);
      const item = getItem(state.fs, s.curId);
      s.curLine = item.stickyCurrentPos ?? 0;
      s.path.push(item.name);
    }), [
      { t: 'playSound', effect: 'rising', locx: undefined }
    ]];
    case 'none': return [state, []];
    case 'error': return withError(state, { code: action.code }); // XXX does this arise? does withError want an id?
    case 'exec': {
      const actorId = action.ident;
      const actor = getItem(state.fs, action.ident);
      const loc = getLocation(state.fs, action.ident);

      if (actor.progress) {
        return withError(state, { code: 'alreadyExecuting', blame: actorId, loc });
      }

      if (isExecutable(actor.name)) {
        return startExecutable(state, actorId, actor.name);
      }

      return withError(state, { code: 'badExecutable', blame: actorId, loc });
    }
    case 'back': return reduceKeyAction(state, KeyAction.back);
  }
}

function processHook(state: GameState, hook: Hook): GameState {
  switch (hook) {
    case 'LENS': return produce(state, s => { s._cached_show = showOfFs(state.fs); });
    case 'KEY': return produce(state, s => { s._cached_keybindings = keybindingsOfFs(state.fs); });
  }
}

export function processHooks(state: GameState, hooks: Hook[]): GameState {
  for (const hook of hooks) {
    state = processHook(state, hook);
  }
  return state;
}

function reducePickupAction(state: GameState, action: PickupLineAction): [GameState, Effect[]] {
  switch (action.t) {
    case 'error': return withError(state, { code: action.code });
    case 'pickup': {
      let fs = state.fs;
      let ident, hooks1, hooks2;
      // FIXME: abstract this away into an fs move function
      [fs, ident, hooks1] = removeId(fs, action.loc, action.ix);
      [fs, hooks2] = insertId(fs, SpecialId.inventory, 0, ident);
      state = produce(state, s => { s.fs = fs; });
      state = processHooks(state, hooks1);
      state = processHooks(state, hooks2);
      return [
        state,
        [
          { t: 'playSound', effect: 'pickup', locx: undefined },
        ]
      ];
    }
  }
}

function reduceDropAction(state: GameState, action: DropLineAction): [GameState, Effect[]] {
  switch (action.t) {
    case 'error':
      return withError(state, { code: action.code });
    case 'drop': {
      let fs = state.fs;
      let ident, hooks1, hooks2;
      [fs, ident, hooks1] = removeId(fs, SpecialId.inventory, 0);
      [fs, hooks2] = insertId(fs, action.loc, action.ix, ident);
      state = produce(state, s => { s.fs = fs; });
      state = processHooks(state, hooks1);
      state = processHooks(state, hooks2);
      return [
        state,
        [
          { t: 'playSound', effect: 'drop', locx: undefined }
        ]
      ];
    }
  }
}

function reduceActions(state: GameState, actions: GameAction[]): [GameState, Effect[]] {
  let effects: Effect[] = [];
  for (const action of actions) {
    let moreEffects;
    [state, moreEffects] = reduceGameState(state, action);
    effects = [...effects, ...moreEffects];
  }
  return [state, effects];
}

function actionOfKey(state: GameState, keyCode: string): KeyAction | undefined {
  return state._cached_keybindings[keyCode];
}

export function reduceKeyAction(state: GameState, action: KeyAction): [GameState, Effect[]] {
  switch (action) {
    case KeyAction.prevLine:
      return [advanceLine(state, -1),
      [
        { t: 'playSound', effect: 'high', locx: undefined },
      ]];
    case KeyAction.nextLine:
      return [advanceLine(state, 1),
      [
        { t: 'playSound', effect: 'high', locx: undefined },
      ]];
    case KeyAction.exec: return reduceExecAction(state, getSelectedLine(state).actions.exec);

    case KeyAction.pickupDrop:
      if (getContents(state.fs, SpecialId.inventory).length > 0)
        return reduceDropAction(state, getSelectedLine(state).actions.drop);
      else
        return reducePickupAction(state, getSelectedLine(state).actions.pickup);

    case KeyAction.back: {
      const loc = getLocation(state.fs, state.curId);
      if (loc == undefined || loc.t == 'is_root') {
        return withError(state, { code: 'cantGoBack' });
      }
      else {
        return [produce(state, s => {
          modifyItemꜝ(s.fs, state.curId, item => {
            item.stickyCurrentPos = state.curLine;
          });

          s.curId = loc.id;
          s.curLine = loc.pos;
          s.path.pop();
        }), [
          { t: 'playSound', effect: 'falling', locx: undefined }
        ]];
      }
    }
  }
}

export function reduceGameState(state: GameState, action: GameAction): [GameState, Effect[]] {
  const vs = state.viewState;
  switch (vs.t) {
    case 'fsView': return reduceGameStateFs(state, action);
    case 'textDialogView': return [produce(state, s => {
      s.viewState = vs.back;
    }), [{ t: 'playSound', effect: 'falling', locx: undefined }]];
  }
}

export function reduceGameStateFs(state: GameState, action: GameAction): [GameState, Effect[]] {
  switch (action.t) {
    case 'key': {
      const keyAction = actionOfKey(state, action.code);
      if (keyAction != undefined)
        return reduceKeyAction(state, keyAction);
      else
        return [state, []];
    }
    case 'clockUpdate':
      logger('clockUpdate', `clockUpdate ${action.tick}`);
      if (state.futures.length + Object.keys(state.recurring).length > 0) {
        const actions = state.futures.filter(f => f.whenTicks == action.tick).map(x => x.action);
        state = produce(state, s => {
          s.futures = state.futures.filter(f => f.whenTicks > action.tick);
        });

        const recurActions: GameAction[] = Object.keys(state.recurring)
          .filter(k => {
            const { startTicks, periodTicks } = state.recurring[k];
            return (action.tick - startTicks) % periodTicks == 0;
          })
          .map(k => ({ t: 'recur', ident: k }));

        logger('recurring', `state.recurring:`, state.recurring);
        logger('recurring', `phases:`, Object.keys(state.recurring).map(k => {
          const { startTicks, periodTicks } = state.recurring[k];
          return [startTicks, periodTicks, action.tick, (action.tick - startTicks) % periodTicks];
        }));
        logger('recurring', `recurActions:`, recurActions);

        actions.push(...recurActions);

        // XXX Might want to think about doing something smarter if I
        // have effects that are intended to be idempotent (even
        // though I don't think I do right now)
        const [s, a] = reduceActions(state, actions);
        return [s, [...a]];
      }
      else {
        return [state, []];
      }

    case 'finishExecution': {
      let effects, error;
      [state, effects, error] = executeInstructions(state, action.instr, action.targetIds, action.actorId);

      // deactivate item
      state = produce(state, s => {
        modifyItemꜝ(s.fs, action.actorId, item => { item.progress = undefined; });
      });

      // FIXME(#7): Sound effects shouldn't be the thing we trust for
      // whether there's an error condition.
      if (error != undefined) {
        state = deactivateItem(state, action.actorId);
        return [state, effects];
      }
      else {
        const later = nowTicks(state.clock) + 1;
        // flash targets if not error
        state = produce(state, s => {
          if (action.targetIds.length > 0)
            addFutureꜝ(s, later, { t: 'none' }, true); // XXX maybe instead of 'none', clear .flashUntilTick for action.targetIds.
          action.targetIds.forEach(targetId => {
            modifyItemꜝ(s.fs, targetId, item => { item.flashUntilTick = later; });
          });
        });
        return [state, effects];
      }
    }

    case 'clearError':
      return [produce(state, s => {
        s.error = undefined;
      }), []];

    case 'none':
      return [state, []];

    case 'recur':
      // XXX more checking should happen here probably
      const id = action.ident;
      const actor = getItem(state.fs, id);
      const loc = getLocation(state.fs, id);
      if (isExecutable(actor.name)) {
        return startExecutable(state, id, actor.name);
      }
      else {
        // XXX not the right error code really
        return withError(state, { code: 'illegalInstr', blame: id, loc });
      }
  }
}
