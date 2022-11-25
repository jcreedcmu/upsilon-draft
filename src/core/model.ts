import { Resources } from '../fs/resources';
import { SoundEffect } from '../ui/sound';
import { ClockState, mkClockState } from './clock';
import { Fs, getContents, getFullContents, getItem, getLocation } from '../fs/fs';
import { initialFs, SpecialId } from '../fs/initialFs';
import { FullLine, getLines } from './lines';

export type Acl =
  | 'open'
  | 'pickup'
  | 'exec'
  | 'instr'
  | 'unlock';
export type Acls = { [P in Acl]?: boolean };

export type UserError = {
  code: number,
};

export type ExecProgress = {
  targetIds: Ident[],
  totalTicks: number,
  startTicks: number,
}

export type Ident = string;

// Every item is either located at another item,
// or is the root item.
export type Location =
  | { t: 'at', id: Ident, pos: number }
  | { t: 'is_root' };

// A hook is an extra piece of code that should be run any time a
// directory has its contents changed.
export type Hook =
  | 'LENS'
  | 'KEY';

export type Value = number | string;

export type Item = {
  name: string, // displayable name

  contents: Ident[],

  // Other game-relevant attributes
  acls: Acls, // Permissions bits
  resources: Resources, // "resources" stored in this item

  stack?: Value[], // some stack-machine values

  // This becomes defined when item is a currently-executing
  // executable.
  progress?: ExecProgress,

  // This is potentially defined for executables,
  // should be interpreted as default 1 if absent.
  numTargets?: number,

  size: number,
  text?: string,

  hooks?: Hook[],
};

export type Action =
  | { t: 'key', code: string }
  | { t: 'clockUpdate', tick: number }
  | { t: 'finishExecution', actorId: Ident, targetIds: Ident[] }
  | { t: 'clearError' }
  ;

export enum KeyAction {
  prevLine = 'prev-line',
  nextLine = 'next-line',
  back = 'back',
  exec = 'exec',
  pickupDrop = 'pickup-drop', // Maybe want separate pickup and drop actions?
}

export type Effect =
  | { t: 'redraw' }
  | { t: 'playSound', effect: SoundEffect }
  | { t: 'reschedule' }
  ;

export type State =
  | { t: 'title' }
  | { t: 'game', gameState: GameState };

export type Future = { whenTicks: number, action: Action, live?: boolean };

export type GameState = {
  curId: Ident,
  curLine: number,
  fs: Fs,
  error: UserError | undefined,
  clock: ClockState,
  path: string[],
  futures: Future[],
  _cached_keybindings: Record<string, KeyAction>,
  _cached_show: Show,
};

export function mkState(): State {
  return { t: 'title' };
}

export function keybindingsOfFs(fs: Fs): Record<string, KeyAction> {
  const cont = getFullContents(fs, SpecialId.keys);
  const rv: Record<string, KeyAction> = {};
  cont.forEach(item => {
    if (item.contents.length == 1) {
      const inner = getItem(fs, item.contents[0]);
      if (Object.values(KeyAction).includes(inner.name as KeyAction)) {
        rv[item.name] = inner.name as KeyAction;
      }
    }
  });
  return rv;
}

export function showOfFs(fs: Fs): Show {
  const cont = getFullContents(fs, SpecialId.lens);
  return {
    size: cont.some(x => x.name == 'show-size'),
    charge: cont.some(x => x.name == 'show-charge'),
    network: cont.some(x => x.name == 'show-network'),
    cwd: cont.some(x => x.name == 'show-cwd'),
    inventory: cont.some(x => x.name == 'show-inventory'),
    info: cont.some(x => x.name == 'show-info'),
  }
}

export function mkGameState(): State {
  const fs = initialFs();
  return {
    t: 'game', gameState: {
      clock: mkClockState(),
      error: undefined,
      curId: SpecialId.root,
      curLine: 0,
      fs,
      path: [],
      futures: [],
      _cached_keybindings: keybindingsOfFs(fs),
      _cached_show: showOfFs(fs),
    }
  };
}

export function getSelectedId(state: GameState): Ident {
  const contents = getContents(state.fs, state.curId);
  return contents[state.curLine];
}

export function getSelectedLine(state: GameState): FullLine {
  // This is kind of inefficient, since we compute all lines, discarding most.
  return getLines(state, state.curId)[state.curLine];

  //// Not sure what I was thinking here; doesn't work for '..'
  //
  // const ident = getSelectedId(state);
  // return getLineOfItem(ident, getItem(state.fs, ident), state.curLine);
}

export function numTargetsOfExecutable(item: Item): number {
  return item.numTargets ?? 1;
}

export function nextLocation(loc: Location): Location {
  switch (loc.t) {
    case 'at': return { t: 'at', id: loc.id, pos: loc.pos + 1 };
    case 'is_root': return { t: 'is_root' };
  }
}

export type Show = {
  size: boolean,
  charge: boolean,
  network: boolean,
  cwd: boolean,
  inventory: boolean,
  info: boolean,
};

export function showAll(): Show {
  return {
    size: true,
    charge: true,
    network: true,
    cwd: true,
    inventory: true,
    info: true
  };
}
