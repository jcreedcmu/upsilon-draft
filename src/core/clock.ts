// The idea here is that we want to have a clock that ticks every
// MILLISECONDS_PER_TICK ms, but we also want to manage a timeout that
// triggers on the soonest tick when anything interesting could
// possibly happen.

export const MILLISECONDS_PER_TICK = 200;

export type ClockState = {
  originEpochMs: number,
  timeoutId: number | undefined,
}

export function mkClockState(): ClockState {
  return {
    originEpochMs: Date.now(),
    timeoutId: undefined,
  }
}

export function nowTicks(clock: ClockState): number {
  return Math.floor((Date.now() - clock.originEpochMs) / MILLISECONDS_PER_TICK);
}

export type WakeTime =
  | { t: 'live' } // there's something actively updating itself in the UI:
  // do updates as often as possible
  | { t: 'infinite' } // there's active updates. Don't update until this fact changes.
  | { t: 'tick', tick: number }; // the next active update is at tick `tick`.

export function clockedNextWake(clock: ClockState, nextWake: WakeTime): number {
  switch (nextWake.t) {
    case 'live': return nowTicks(clock) + 1;
    case 'infinite': return Infinity;
    case 'tick': return nextWake.tick;
  }
}

export function delayUntilTickMs(clock: ClockState, tick: number): number {
  return clock.originEpochMs + MILLISECONDS_PER_TICK * tick - Date.now();
}
