import { produce } from "./util/produce";
import { DEBUG, logger } from './util/debug';
import { Buffer, buffer } from './util/dutil';
import { DrawParams, make_pane } from './ui/gl-pane';
import { key } from './ui/key';
import { clockedNextWake, ClockState, delayUntilTickMs, MILLISECONDS_PER_TICK, nowTicks, WakeTime } from './core/clock';
import { Action, Effect, GameState, getConcreteSound, isNearby, mkState, SceneState, State } from "./core/model";
import { reduce } from './core/reduce';
import { render } from "./ui/render";
import { initSound, playSound } from './ui/sound';
import { lerp } from "./util/util";

// Do a little startup-time preprocessing on the font image so I can
// edit it more conveniently.
function bufferFromImage(image: HTMLImageElement): Buffer {
  const buf = buffer({ x: image.width, y: image.height });
  buf.d.drawImage(image, 0, 0);
  const imdata = buf.d.getImageData(0, 0, image.width, image.height);
  const data = imdata.data;

  // assume all pixels are fully opaque black or white; convert any
  // white pixels to transparent.
  for (let i = 0; i < image.width; i++) {
    for (let j = 0; j < image.height; j++) {
      const off = 4 * (i + j * image.width);
      if (data[off] == 255)
        data[off + 3] = 0;
    }
  }

  buf.d.putImageData(imdata, 0, 0);
  return buf;
}

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

function drawParamsOfState(state: State): DrawParams {
  const ga = state.globalAnimationState;
  if (ga.shrinkFade == 1.0) {
    return { beamScale: 1.0, fade: 1.0 };
  }
  return {
    beamScale: ga.shrinkFade + 0.001,
    fade: Math.pow(ga.shrinkFade, 2),
  };
}

function powerButtonImageOfState(state: SceneState): string {
  return state.gameState.power ? 'assets/button-down.png' : 'assets/button-up.png';
}

async function go() {

  const sound = initSound();

  const pane = await make_pane(document.getElementById('c') as HTMLCanvasElement);

  const state: State[] = [mkState()];

  const powerButton = document.getElementById('power-button')! as HTMLImageElement;
  powerButton.className = 'button';
  powerButton.src = powerButtonImageOfState(state[0].sceneState);
  powerButton.onclick = () => dispatch({ t: 'boot' });

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
      return { t: 'game', gameState: maybeRescheduleGame(priorState.gameState, state.gameState) };
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
    const screen = render(state[0].sceneState);
    pane.draw(screen, drawParamsOfState(state[0]));

    const ga = state[0].globalAnimationState;
    const nextShrinkFade = (state[0].sceneState.gameState.power) ?
      (Math.min(lerp(ga.shrinkFade, 1.05, 0.01), 1.0)) :
      (Math.max(lerp(ga.shrinkFade, -0.05, 0.05), 0.0));

    state[0] = produce(state[0], s => {
      s.globalAnimationState.shrinkFade = nextShrinkFade;
    });

    requestAnimationFrame(repaint);
  }

  requestAnimationFrame(repaint);
}

window.onload = go;
