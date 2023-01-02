import { getInventoryItem, getItem, getLocation, getNumLines, hooksOfLocation, insertId, insertIntoInventory, modifyItemꜝ, removeFromInventory, removeId, setItemꜝ, setTextꜝ } from '../fs/fs';
import { doAgain, logger } from '../util/debug';
import { produce } from '../util/produce';
import { nowTicks } from './clock';
import { ConfigureViewState, putItemConfig, reduceConfigureView } from './configure';
import { ErrorCode, ErrorInfo } from './errors';
import { cancelRecurꜝ, executeInstructions, isExecutable, isRecurring, scheduleRecurꜝ, startExecutable, tryStartExecutable } from './executables';
import { errorsOfFs, Hook, keybindingsOfFs, showOfFs, soundsOfFs } from './hooks';
import { DropLineAction, ExecLineAction, PickupLineAction, SignalAction } from './lines';
import { isLinLog, startLinlog } from './linlog';
import { Action, cancelRecur, Effect, GameAction, GameState, getCurId, getCurLine, getSelectedId, getSelectedLine, Ident, isNearbyGame, mkGameState, UiAction, SceneState, setCurIdꜝ, setCurLineꜝ } from './model';
import { KeyAction } from "./key-actions";
import { reduceTextEditView, TextEditViewState } from './text-edit';

export const EXEC_TICKS = 6;
export const INVENTORY_MAX_ITEMS = 3;

export type ReduceResult = [GameState, Effect[]];
export type ReduceResultErr = [GameState, Effect[], ErrorInfo | undefined];

function noError(rr: ReduceResult): ReduceResultErr {
  const [state, effects] = rr;
  return [state, effects, undefined];
}

function ignoreError(rr: ReduceResultErr): ReduceResult {
  const [state, effects] = rr;
  return [state, effects];
}

export function reduce(state: SceneState, action: Action): [SceneState, Effect[]] {
  switch (state.t) {
    case 'game':
      if (action.t == 'boot') {
        if (state.gameState.power) {
          if (action.onlyTurnOn)
            return [state, []];
          else
            return [produce(state, s => { s.gameState.power = false; }),
            [/* XXX power down sound? */
              { t: 'powerButton' }]];
        }
        else {
          return [produce(
            /* XXX redundant construction? but I do in fact want to
            reconstruct for reboots... */
            mkGameState(), s => { s.gameState.power = true; }),
          [{ t: 'playAbstractSound', effect: 'startup', loc: undefined },
          { t: 'powerButton' }]];
        }
      }
      else {
        if (state.gameState.power) {
          const [gameState, effects] = reduceGameState(state.gameState, action);
          return [produce(state, s => { s.gameState = gameState; s.revision++; }), effects];
        }
        else {
          return [state, []];
        }
      }
  }
}

function advanceLine(state: GameState, amount: number): GameState {
  const len = getNumLines(state.fs, getCurId(state));
  // XXX refactor to use forwardLocation somehow
  return produce(state, s => {
    setCurLineꜝ(s, (getCurLine(state) + len + amount) % len);
  });

}

function makeErrorBanner(state: GameState, code: ErrorCode): GameState {
  const now = nowTicks(state.clock);
  return produce(state, s => {
    s.error = { code };
    // cancel any pending clearError futures
    s.futures = state.futures.filter(f => f.action.t != 'clearError');

    addFutureꜝ(s, now + 3, { t: 'clearError' });
  });
}

export function withError(state: GameState, errorInfo: ErrorInfo): ReduceResult {
  const { code, blame, loc } = errorInfo;
  if (blame != undefined) {
    state = cancelRecur(state, blame);
  }
  if (isNearbyGame(state, loc)) {
    state = makeErrorBanner(state, code);
  }
  return [state, [
    { t: 'playAbstractSound', effect: 'error', loc: errorInfo.loc }
  ]]
}

// imperatively updates state
export function addFutureꜝ(state: GameState, whenTicks: number, action: GameAction, live?: boolean) {
  state.futures.push({
    whenTicks,
    action,
    live: live ?? false,
  });
  // FIXME could be more efficient
  state.futures.sort((a, b) => a.whenTicks - b.whenTicks);
}

export function toggleItem(state: GameState, ident: Ident): ReduceResult {
  const loc = getLocation(state.fs, ident);
  state = produce(state, s => {
    modifyItemꜝ(s.fs, ident, item => {
      const content = item.content;
      if (content.t != 'checkbox')
        throw new Error(`invariant violation, tried to toggle a non-checkbox`);
      content.checked = !content.checked;
    });
  });
  state = processHooks(state, hooksOfLocation(state.fs, loc));
  return [state,
    [{ t: 'playAbstractSound', effect: 'toggle', loc: loc }]];
}

const INCREMENT_RANGE = 16;

export function incrementItem(state: GameState, ident: Ident, amount: number): ReduceResult {
  const loc = getLocation(state.fs, ident);
  state = produce(state, s => {
    modifyItemꜝ(s.fs, ident, item => {
      const content = item.content;
      if (content.t != 'numeric')
        throw new Error(`invariant violation, tried to increment a non-numeric`);
      content.value = (content.value + INCREMENT_RANGE + amount) % INCREMENT_RANGE;
    });
  });
  state = processHooks(state, hooksOfLocation(state.fs, loc));
  return [state,
    [{ t: 'playAbstractSound', effect: 'toggle', loc: loc }]];
}

export function playAudioItem(state: GameState, ident: Ident): ReduceResult {
  const item = getItem(state.fs, ident);
  const loc = getLocation(state.fs, ident);
  if (item.content.t == 'sound') {
    return [state,
      [{ t: 'playSound', effect: item.content.effect, loc: loc }]];
  }
  else {
    return [state, []];
  }
}

// Something to note is that we're not checking the executability acl
// *here* in reduceExecAction; it's being checked in execActionForItem
// already when we construct lines for a directory. May want to
// reconsider this, although it is in some way convenient knowing
// whether a file is executable very early.
export function reduceExecAction(state: GameState, action: ExecLineAction): ReduceResult {

  switch (action.t) {
    case 'descend': {
      const selectedId = getSelectedId(state);
      const item = getItem(state.fs, selectedId);
      return [produce(state, s => {
        setCurIdꜝ(s, selectedId);
        setCurLineꜝ(s, item.stickyCurrentPos ?? 0);
        s.path.push(item.name);
      }), [
        { t: 'playAbstractSound', effect: 'go-into', loc: undefined }
      ]];
    }
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
      else if (isLinLog(actor.content)) {
        return startLinlog(state, actorId, actor.content);
      }

      return withError(state, { code: 'badExecutable', blame: actorId, loc });
    }
    case 'back': return ignoreError(reduceKeyAction(state, 'back'));
    case 'toggle': return toggleItem(state, action.ident);
    case 'increment': return incrementItem(state, action.ident, 1);
    case 'play': return playAudioItem(state, action.ident);
  }

}

function processHook(state: GameState, hook: Hook): GameState {
  switch (hook) {
    case 'LENS': return produce(state, s => { s._cached_show = showOfFs(state.fs); });
    case 'KEY': return produce(state, s => { s._cached_keybindings = keybindingsOfFs(state.fs); });
    case 'SOUND': return produce(state, s => { s._cached_sounds = soundsOfFs(state.fs); });
    case 'ERROR': return produce(state, s => { s._cached_errors = errorsOfFs(state.fs); });
  }
}

export function processHooks(state: GameState, hooks: Hook[]): GameState {
  for (const hook of hooks) {
    state = processHook(state, hook);
  }
  return state;
}

function reducePickupAction(state: GameState, action: PickupLineAction): ReduceResult {
  switch (action.t) {
    case 'error': return withError(state, { code: action.code });
    case 'pickup': {
      let fs = state.fs;
      let ident: Ident, hooks: Hook[];
      // FIXME: abstract this away into an fs move function
      [fs, ident, hooks] = removeId(fs, action.loc, action.ix);
      fs = insertIntoInventory(fs, ident, state.inventoryState.curSlot);
      state = produce(state, s => {
        s.fs = fs;
        cancelRecurꜝ(s, ident); // automation doesn't play nice in inventory
      });
      state = processHooks(state, hooks);
      return [
        state,
        [
          { t: 'playAbstractSound', effect: 'pickup', loc: undefined },
        ]
      ];
    }

    case 'addInventorySlot': {
      let fs = state.fs;
      let ident, hooks;
      // FIXME: abstract this away into an fs move function
      [fs, ident, hooks] = removeId(fs, action.loc, action.ix);
      state = produce(state, s => {
        s.fs = fs;
        s.inventoryState.numSlots = Math.min(INVENTORY_MAX_ITEMS, state.inventoryState.numSlots + 1);
      });
      state = processHooks(state, hooks);
      return [
        state,
        [
          { t: 'playAbstractSound', effect: 'pickup', loc: undefined },
        ]
      ];
    }
  }
}

function reduceDropAction(state: GameState, action: DropLineAction): ReduceResult {
  switch (action.t) {
    case 'error':
      return withError(state, { code: action.code });
    case 'drop': {
      let fs = state.fs;
      let ident, hooks1, hooks;
      [fs, ident] = removeFromInventory(fs, state.inventoryState.curSlot);
      [fs, hooks] = insertId(fs, action.loc, action.ix, ident, { noUpdateCursorMark: true });
      state = produce(state, s => { s.fs = fs; });
      state = processHooks(state, hooks);
      return [
        state,
        [
          { t: 'playAbstractSound', effect: 'drop', loc: undefined }
        ]
      ];
    }
  }
}

function reduceActions(state: GameState, actions: GameAction[]): ReduceResult {
  console.log('reduceActions', actions.map(a => a.t));
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

function modifyInventorySlotꜝ(state: GameState, increment: number): void {
  const numItems = state.inventoryState.numSlots;
  state.inventoryState.curSlot = (state.inventoryState.curSlot + increment + numItems) % numItems;
}

function shouldDropVersusPickup(state: GameState): boolean {
  return getInventoryItem(state.fs, state.inventoryState.curSlot) != undefined;
}

function reduceSignalAction(state: GameState, action: SignalAction | undefined): ReduceResult {
  if (action == undefined)
    return withError(state, { code: 'unhandledSignal' }); // XXX loc, maybe?
  switch (action.t) {
    case 'none': return withError(state, { code: 'unhandledSignal' }); // XXX loc, maybe?
    case 'decrement': return incrementItem(state, action.ident, -1);
  }
}

export function reduceFsKeyAction(state: GameState, action: KeyAction): ReduceResult {
  if (typeof action != 'string') {
    // don't do anything with other keys
    return [state, []];
  }
  switch (action) {
    case 'prevLine':
      return [advanceLine(state, -1),
      [
        { t: 'playAbstractSound', effect: 'change-file', loc: undefined },
      ]];
    case 'nextLine':
      return [advanceLine(state, 1),
      [
        { t: 'playAbstractSound', effect: 'change-file', loc: undefined },
      ]];
    case 'exec': return reduceExecAction(state, getSelectedLine(state).actions.exec);

    case 'pickupDrop':
      if (shouldDropVersusPickup(state))
        return reduceDropAction(state, getSelectedLine(state).actions.drop);
      else
        return reducePickupAction(state, getSelectedLine(state).actions.pickup);

    case 'back': {
      const loc = getLocation(state.fs, getCurId(state));
      if (loc == undefined || loc.t == 'is_root' || loc.t == 'inventory') {
        return withError(state, { code: 'cantGoBack' });
      }
      else {
        return [produce(state, s => {
          modifyItemꜝ(s.fs, getCurId(state), item => {
            item.stickyCurrentPos = getCurLine(state);
          });
          setCurIdꜝ(s, loc.id);
          setCurLineꜝ(s, loc.pos);
          s.path.pop();
        }), [
          { t: 'playAbstractSound', effect: 'go-back', loc: undefined }
        ]];
      }
    }
    case 'prevInventorySlot':
      return [produce(state, s => { modifyInventorySlotꜝ(s, -1) }),
      [{ t: 'playAbstractSound', effect: 'change-slot', loc: undefined }]];
    case 'nextInventorySlot':
      return [produce(state, s => { modifyInventorySlotꜝ(s, 1) }),
      [{ t: 'playAbstractSound', effect: 'change-slot', loc: undefined }]];
    case 'debug': {
      if ((window as any).ff !== undefined) {
        ((window as any).ff)(state);
      }
      else {
        console.log(state);
      }
      doAgain('...');
      return [state, [{ t: 'playSound', effect: 'high', loc: undefined }]];
    }
    case 'qsignal': {
      return reduceSignalAction(state, getSelectedLine(state).actions.signals?.q);
    }
  }
}

export function reduceGameState(state: GameState, action: GameAction): ReduceResultErr {
  // First we deal with some actions that have a uniform consequence
  // regardless of what mode we're in. These are the difference between
  // GameAction and NarrowGameAction
  switch (action.t) {
    case 'clearError': {
      return [produce(state, s => {
        s.error = undefined;
      }), [], undefined];
    }
    case 'clockUpdate': {
      logger('clockUpdate', `clockUpdate ${action.tick}`);
      if (state.futures.length + Object.keys(state.recurring).length > 0) {
        const actions = state.futures.filter(f => f.whenTicks == action.tick).map(x => x.action);
        state = produce(state, s => {
          s.futures = state.futures.filter(f => f.whenTicks > action.tick);
        });

        // XXX Might want to think about doing something smarter if I
        // have effects that are intended to be idempotent (even
        // though I don't think I do right now)
        return noError(reduceActions(state, actions));
      }
      else {
        return [state, [], undefined];
      }
    }
    case 'finishExecution': {
      let effects, error;
      [state, effects, error] = executeInstructions(state, action.instr, action.actorId);

      // deactivate item's progressbar
      state = produce(state, s => {
        modifyItemꜝ(s.fs, action.actorId, item => { item.progress = undefined; });
      });

      if (error != undefined) {
        // unsuccessful execution
        state = cancelRecur(state, action.actorId);
        return [state, effects, error];
      }
      else {
        // successful execution

        // Schedule recurrent execution if appropriate
        if (isRecurring(state, action.actorId)) {
          state = produce(state, s => {
            scheduleRecurꜝ(s, action.actorId);
          });
        }
        return [state, effects, undefined];
      }
    }

    case 'none':
      return [state, [], undefined];

    case 'recur': {
      return tryStartExecutable(state, action.ident);
    }

    case 'key': {
      return reduceKeyAction(state, action.code);
    }
  }
}

function reduceKeyAction(state: GameState, code: string): ReduceResultErr {
  const vs = state.viewState;
  const action: GameAction = { t: 'key', code };
  switch (vs.t) {
    case 'fsView': return reduceFsView(state, action);
    case 'configureView': {
      const orig: ConfigureViewState = vs;
      const result = reduceConfigureView(vs.state, action);
      switch (result.t) {
        case 'normal': {
          const nvs = produce(orig, s => { s.state = result.state; });
          return noError([
            produce(state, s => {
              s.viewState = nvs;
            }),
            result.effects
          ]);
        }
        case 'cancel': {
          return noError([
            produce(state, s => {
              s.viewState = vs.back;
            }),
            [{ t: 'playAbstractSound', effect: 'go-back', loc: undefined }]
          ]);
        }
        case 'save': {
          return noError([
            produce(state, s => {
              s.viewState = vs.back;
              // There's maybe something subtle going on here in that
              // we're using result.item (which will be the state of
              // the item at the time that the configure dialog was
              // opened) as a basis for setting result.config on it,
              // rather than looking up vs.target in the fs as it
              // exists at the present moment. Something tells me this
              // is the thing to do that is less likely to have weird
              // invariant violations if the type of the config we're
              // trying to set is no longer compatible with the item
              // in its current state.
              setItemꜝ(s.fs, vs.target, putItemConfig(result.item, result.config));
            }),
            [{ t: 'playAbstractSound', effect: 'success', loc: undefined }]
          ]);
        }
      }
    }

    case 'textEditView': {
      const orig: TextEditViewState = vs;
      const result = reduceTextEditView(vs.state, action);
      switch (result.t) {
        case 'normal': {
          const nvs = produce(orig, s => { s.state = result.state; });
          return noError([
            produce(state, s => {
              s.viewState = nvs;
            }),
            result.effects
          ]);
        }
        case 'quit': {
          return noError([
            produce(state, s => {
              s.viewState = vs.back;
              setTextꜝ(s.fs, vs.target, vs.state.text);
            }),
            [{ t: 'playAbstractSound', effect: 'go-back', loc: undefined }]
          ]);
        }
      }
    }
  }
}

function reduceFsView(state: GameState, action: UiAction): ReduceResultErr {
  const noChange: ReduceResultErr = [state, [], undefined];
  switch (action.t) {
    case 'key': {
      logger('keys', action.code);
      const keyAction = actionOfKey(state, action.code);
      if (keyAction != undefined)
        return noError(reduceFsKeyAction(state, keyAction));
      else
        return noChange;
    }
  }
}
