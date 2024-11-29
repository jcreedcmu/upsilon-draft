import { initAssets } from "./core/assets";
import { clockedNextWake, ClockState, delayUntilTickMs, nowTicks, WakeTime } from './core/clock';
import { Action, Effect, GameState, getConcreteSound, isNearby, mkState, SceneState, State } from "./core/model";
import { reduce } from './core/reduce';
import { animatePowerState, drawParamsOfState } from './ui/draw-params';
import { make_pane } from './ui/gl-pane';
import { key } from './ui/key';
import { render } from "./ui/render";
import { Screen } from "./ui/screen";
import { initSound, playSound } from './ui/sound';
import { DEBUG, logger } from './util/debug';
import { produce } from "./util/produce";

type CanvasBundle = { c: HTMLCanvasElement, d: CanvasRenderingContext2D };

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
    const timeOutId = window.setTimeout(
      () => {
        const now = nowTicks(clock);
        if (now < whenTicks) {
          console.error(`I didn't expect nowTicks ${now} < whenTicks ${whenTicks}`);
        }

        logger('clockUpdate', `reschedule dispatching clock update now`);
        dispatch({ t: 'clockUpdate', tick: now });

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

function powerButtonImageOfState(state: SceneState): string {
  return state.gameState.power ? 'assets/button-down.png' : 'assets/button-up.png';
}

async function go() {

  const sound = initSound();
  await initAssets();

  let prevSceneState: SceneState | null = null; // think about optimizing rendering

  const c = document.getElementById('c') as HTMLCanvasElement;
  const pane = await make_pane(c);
  const state: State[] = [mkState()];

  const powerButton = document.getElementById('power-button')! as HTMLImageElement;
  powerButton.className = 'button';
  powerButton.src = powerButtonImageOfState(state[0].sceneState);
  powerButton.onclick = () => dispatch({ t: 'boot' });
  c.onclick = () => dispatch({ t: 'boot', onlyTurnOn: true });

  function handleEffect(state: SceneState, effect: Effect): SceneState {
    switch (effect.t) {
      case 'playSound':
        if (isNearby(state, effect.loc))
          playSound(sound, effect.effect);
        return state;
      case 'playAbstractSound': {
        const sound = getConcreteSound(state.gameState, effect.effect);
        if (sound !== undefined) {
          return handleEffect(state, { t: 'playSound', effect: sound, loc: effect.loc });
        }
      }
      case 'powerButton':
        (document.getElementById('power-button')! as HTMLImageElement).src =
          powerButtonImageOfState(state);
        return state;
    }
  }

  // This gets called after every dispatch
  function maybeRescheduleGame(priorState: GameState, state: GameState): GameState {
    if (!equalWake(nextWake(priorState), nextWake(state))) {
      const newClock = reschedule(dispatch, state);
      return produce(state, s => {
        s.clock = newClock;
      });
    }
    else return state;
  }

  // This gets called after every dispatch
  function maybeReschedule(priorState: SceneState, state: SceneState): SceneState {
    if (state.t == 'game' && priorState.t == 'game') {
      return { t: 'game', gameState: maybeRescheduleGame(priorState.gameState, state.gameState), revision: state.revision };
    }
    else return state;
  }

  function dispatch(action: Action): void {
    let [sceneState, effects] = reduce(state[0].sceneState, action);

    if (DEBUG.duplicates) {
      function checkDuplicates(name: Effect['t']) {
        if (effects.filter(x => x.t == name).length > 1) {
          console.log(`duplicate ${name}`);
        }
      }
      // Sound events aren't idempotent, but I don't currently expect
      // one dispatch to produce multiple sounds, and I did once have
      // a bug where that was the symptom, so we might as well check.
      checkDuplicates('playSound');
      checkDuplicates('playAbstractSound');
    }

    sceneState = maybeReschedule(state[0].sceneState, sceneState);

    effects.forEach(e => {
      sceneState = handleEffect(sceneState, e);
    });

    state[0] = produce(state[0], s => { s.sceneState = sceneState; });

  }
  window.onkeydown = (k: KeyboardEvent) => {
    dispatch({ t: 'key', code: key(k) });
  }

  function repaint() {
    let screen: Screen | undefined = undefined;
    if (state[0].sceneState == prevSceneState) {
      // Do nothing here. We don't need to rerender the Screen.
      //
      // this equality check seems to work ok, but I'm a little
      // nervous about whether immer (and/or my pattern of use of it)
      // really guarantees different data
      // to be referentially different.
    }
    else {
      logger('rendering', `Rendering screen. This shouldn't be constant.`);
      screen = render(state[0].sceneState);
      prevSceneState = state[0].sceneState;
    }
    pane.draw(screen, drawParamsOfState(state[0]));

    state[0] = animatePowerState(state[0]);

    requestAnimationFrame(repaint);
  }

  requestAnimationFrame(repaint);
}

window.onload = go;
