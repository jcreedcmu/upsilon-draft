import { clockedNextWake, ClockState, delayUntilTickMs, nowTicks, WakeTime } from '../../src/core/clock';
import { Action, GameState, mkState, SceneState, State } from '../../src/core/model';
import { reduce } from '../../src/core/reduce';
import { animatePowerState, drawParamsOfState } from '../../src/ui/draw-params';
import { render } from '../../src/ui/render';
import { Screen } from '../../src/ui/screen';
import { logger } from '../../src/util/debug';
import { produce } from '../../src/util/produce';
import { nativeLayer, paintFrame, updateTextPage } from './graphics';

function nextWake(state: GameState): WakeTime {
  // XXX we could check times and be more optimal here
  if (Object.keys(state.recurring).length > 0) {
    return { t: 'live' };
  }

  if (state.futures.length > 0) {
    if (state.futures.some(x => x.live))
      return { t: 'live' };
    return { t: 'tick', tick: state.futures[0].whenTicks };
  }
  return { t: 'infinite' };
}

function reschedule(dispatch: (a: Action) => void, state: GameState): ClockState {
  let { clock } = state;
  if (clock.timeoutId) {
    clearTimeout(clock.timeoutId);
    clock = produce(clock, c => { c.timeoutId = undefined; });
  }
  let whenTicks = clockedNextWake(clock, nextWake(state));
  if (whenTicks != Infinity) {
    const delayMs = delayUntilTickMs(clock, whenTicks);
    logger('reschedule', `scheduling clock update ${delayMs}ms into the future`);
    const timeOutId = setTimeout(
      () => {
        const now = nowTicks(clock);
        if (now < whenTicks) {
          throw new Error(`I didn't expect nowTicks ${nowTicks(clock)} < whenTicks ${whenTicks}`);
        }
        else {
          logger('clockUpdate', `reschedule dispatching clock update now`);
          dispatch({ t: 'clockUpdate', tick: now });
        }
      },
      delayMs
    );
    return produce(clock, c => { c.timeoutId = timeOutId; });
  }
  else {
    return clock;
  }
}

// return whether a evaluated at t-1 is equal to b at time t, sort of?
function equalWake(a: WakeTime, b: WakeTime): boolean {
  switch (a.t) {
    case 'live': return false;
    case 'infinite': return b.t == 'infinite';
    case 'tick': return b.t == 'tick' && b.tick == a.tick;
  }
}

const state: State[] = [mkState()];

function maybeRescheduleGame(priorState: GameState, state: GameState): GameState {
  if (!equalWake(nextWake(priorState), nextWake(state))) {
    const newClock = reschedule(dispatch, state);
    return produce(state, s => {
      s.clock = newClock;
    });
  }
  else return state;
}

function maybeReschedule(priorState: SceneState, state: SceneState): SceneState {
  if (state.t == 'game' && priorState.t == 'game') {
    return { t: 'game', gameState: maybeRescheduleGame(priorState.gameState, state.gameState), revision: state.revision };
  }
  else return state;
}

function dispatch(action: Action): void {
  let [sceneState, effects] = reduce(state[0].sceneState, action);

  sceneState = maybeReschedule(state[0].sceneState, sceneState);

  // handle effects
  state[0] = produce(state[0], s => { s.sceneState = sceneState; });
}

let prevSceneState: SceneState | null = null;

function repaint() {
  let screen: Screen | undefined = undefined;
  if (state[0].sceneState == prevSceneState) {
    // Do nothing
  }
  else {
    prevSceneState = state[0].sceneState;
    updateTextPage(render(prevSceneState));
  }
  paintFrame(drawParamsOfState(state[0]));
}

function convertSdlKey(key: string): string {
  const lower = key.toLowerCase();
  return lower.length == 1 ? lower : `<${lower}>`;
}

function go() {
  const key = nativeLayer.pollEvent();
  if (key != null) {
    if (key == 'Q' || key == 'Escape') {
      nativeLayer.finish();
      return;
    }
    if (key == '1') {
      dispatch({ t: 'boot' });
    }
    dispatch({ t: 'key', code: convertSdlKey(key) });
  }
  repaint();
  state[0] = animatePowerState(state[0]);

  setTimeout(go, 0);
}

go();
