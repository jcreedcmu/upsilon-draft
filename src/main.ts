import { produce } from "./util/produce";
import { logger } from './util/debug';
import { Buffer, buffer } from './util/dutil';
import { make_pane } from './ui/gl-pane';
import { key } from './ui/key';
import { clockedNextWake, ClockState, delayUntilTickMs, MILLISECONDS_PER_TICK, nowTicks, WakeTime } from './core/clock';
import { Action as NewAction, Effect, GameState, mkState, State as NewState } from "./core/model";
import { reduce } from './core/reduce';
import { render } from "./ui/render";
import { initSound, playBeep } from './ui/sound';

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
  if (state.futures.length > 0) {
    if (state.futures.some(x => x.live))
      return { t: 'live' };
    return { t: 'tick', tick: state.futures[0].whenTicks };
  }
  return { t: 'infinite' };

  //// FIXME: error should put up a non-live future for clearing the error
  // return state.error == undefined ?
  //   { t: 'infinite' } :
  //   { t: 'tick', tick: state.error.expiresAtTick };
}

function reschedule(dispatch: (a: NewAction) => void, state: GameState): ClockState {
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

async function go() {

  const sound = initSound();

  const pane = await make_pane(document.getElementById('c') as HTMLCanvasElement);

  const powerButton = document.getElementById('power-button')! as HTMLImageElement;
  powerButton.className = 'button';
  powerButton.src = 'assets/button-up.png';
  powerButton.onclick = () => dispatch({ t: 'clockUpdate', tick: 0 });

  const state: NewState[] = [mkState()];

  function handleEffect(state: NewState, effect: Effect): NewState {
    switch (effect.t) {
      case 'redraw':
        const screen = render(state);
        pane.draw(screen);
        return state;
      case 'playSound':
        playBeep(sound, effect.effect);
        return state;
      case 'reschedule':
        if (state.t == 'game') {
          const newClock = reschedule(dispatch, state.gameState);
          return produce(state, s => {
            s.gameState.clock = newClock;
          });
        }
        else return state;
      case 'powerButton':
        (document.getElementById('power-button')! as HTMLImageElement).src = 'assets/button-down.png';
        return state;
    }
  }

  function dispatch(action: NewAction): void {
    const [newState, effects] = reduce(state[0], action);
    state[0] = newState;
    effects.forEach(e => {
      state[0] = handleEffect(state[0], e);
    });
  }
  window.onkeydown = (k: KeyboardEvent) => {
    dispatch({ t: 'key', code: key(k) });
  }
  state[0] = handleEffect(state[0], { t: 'redraw' });


}

window.onload = go;
