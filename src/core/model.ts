import { Fs, getContents, getFullContents, getItem, itemContents } from '../fs/fs';
import { initialFs, SpecialId } from '../fs/initialFs';
import { Resources } from '../fs/resources';
import { ImgData } from '../ui/image';
import { AbstractSoundEffect, allSoundEffects, SoundEffect } from '../ui/sound';
import { DEBUG } from '../util/debug';
import { produce } from '../util/produce';
import { ClockState, mkClockState } from './clock';
import { cancelRecurꜝ, ExecutableName } from './executables';
import { FullLine, getLines } from './lines';

export type Acl =
  | 'open'
  | 'pickup'
  | 'exec'
  | 'instr'
  | 'unlock'
  ;
export type Acls = { [P in Acl]?: boolean };

export type UserError = {
  code: number,
};

export type ExecProgress = {
  totalTicks: number,
  startTicks: number,
}

export type Ident = string;

// Every item is either located at another item,
// or is the root item.
export type Location =
  | { t: 'at', id: Ident, pos: number }
  | { t: 'inventory', pos: number }
  | { t: 'is_root' };

// A hook is an extra piece of code that should be run any time a
// directory has its contents changed.
export type Hook =
  | 'LENS'
  | 'KEY'
  | 'SOUND'
  ;

export type Value = number | string;

export type ItemContent =
  | { t: 'text', text: string }
  | { t: 'dir', contents: Ident[] }
  | { t: 'checkbox', checked: boolean }
  | { t: 'sound', effect: SoundEffect }
  | { t: 'image', data: ImgData }
  | { t: 'inventorySlot' }
  ;

export type Item = {
  name: string, // displayable name

  content: ItemContent,

  // Other game-relevant attributes
  acls: Acls, // Permissions bits
  resources: Resources, // "resources" stored in this item

  stack?: Value[], // some stack-machine values

  // This becomes defined when item is a currently-executing
  // executable.
  progress?: ExecProgress,

  size: number,

  // --- transient animation experiment ---
  // When defined, and the current time is <= this value,
  // highlight the item somehow.
  flashUntilTick?: number,

  hooks?: Hook[],

  // If we go up a directory and then back in here, preserve
  // the selected line.
  stickyCurrentPos?: number,
};

export type GameAction =
  | { t: 'key', code: string }
  | { t: 'clockUpdate', tick: number }
  | { t: 'finishExecution', actorId: Ident, instr: ExecutableName }
  | { t: 'clearError' }
  | { t: 'none' }
  | { t: 'recur', ident: Ident }
  ;

export type Action =
  | GameAction
  | { t: 'boot', onlyTurnOn?: boolean }
  ;

export enum KeyAction {
  prevInventorySlot = 'prev-inventory-slot',
  nextInventorySlot = 'next-inventory-slot',
  prevLine = 'prev-line',
  nextLine = 'next-line',
  back = 'back',
  exec = 'exec',
  pickupDrop = 'pickup-drop', // Maybe want separate pickup and drop actions?,
  debug = 'debug',
}

export type Effect =
  | { t: 'playSound', effect: SoundEffect, loc: Location | undefined }
  | { t: 'playAbstractSound', effect: AbstractSoundEffect, loc: Location | undefined }
  | { t: 'powerButton' }
  ;

// If I need to add more state around settings, menus, saving, etc.,
// it might go here.
export type SceneState =
  | {
    t: 'game', gameState: GameState,

    // NOTE: this is sort of unused for now, but I'm leaving it here
    // in case I need a finer-grained equality check on SceneState.
    // It's updated in reduce.ts.
    revision: number,
  };

export type State = {
  sceneState: SceneState,
  globalAnimationState: {
    shrinkFade: number, // should be in the interval [0,1]
  }
};

export type Future = { whenTicks: number, action: GameAction, live?: boolean };

export type Recurring = Record<Ident, { periodTicks: number }>;

// This is for alternate modal states within the game interface, which
// are triggered by "diagetic" controls.
export type ViewState =
  | { t: 'fsView' }
  | { t: 'textDialogView', back: ViewState };

export type InventoryState = {
  curSlot: number, // active inventory slot index
  numSlots: number,
};

export function getCurLine(state: GameState): number {
  return state.curLine;
}

export function setCurLineꜝ(state: GameState, curline: number): void {
  state.curLine = curline;
}

export function getCurId(state: GameState): Ident {
  return state.curId;
}

export function setCurIdꜝ(state: GameState, curid: Ident): void {
  state.curId = curid;
}

export type GameState = {
  power: boolean, // are we powered on
  fs: Fs,
  viewState: ViewState,

  curId: Ident, // maybe these things belong in fsView ViewState
  curLine: number,
  error: UserError | undefined,
  path: string[],

  inventoryState: InventoryState,

  // Timing-related state
  clock: ClockState,
  futures: Future[], // generic future events that happen on a timer
  recurring: Recurring, // active executables that execute recurringly

  // Cached copies of some derived state. For now, all of it is Hooks-related.
  _cached_keybindings: Record<string, KeyAction>,
  _cached_sounds: Record<string, SoundEffect>,
  _cached_show: Show,
};

export function mkState(): State {
  return {
    sceneState: mkGameState(),
    globalAnimationState: {
      shrinkFade: DEBUG.quickStart ? 1.0 : 0.001
    }
  };
}

export function keybindingsOfFs(fs: Fs): Record<string, KeyAction> {
  let cont;
  try {
    cont = getFullContents(fs, SpecialId.keys);
  }
  catch (e) {
    return {};
  }
  const rv: Record<string, KeyAction> = {};
  cont.forEach(item => {
    const contents = itemContents(item);
    if (contents.length == 1) {
      const inner = getItem(fs, contents[0]);
      if (Object.values(KeyAction).includes(inner.name as KeyAction)) {
        rv[item.name] = inner.name as KeyAction;
      }
    }
  });
  return rv;
}

export function showOfFs(fs: Fs): Show {
  let cont;
  try {
    cont = getFullContents(fs, SpecialId.lens);
  }
  catch (e) {
    return showAll();
  }
  return {
    size: cont.some(x => x.name == 'show-size'),
    charge: cont.some(x => x.name == 'show-charge'),
    network: cont.some(x => x.name == 'show-network'),
    cwd: cont.some(x => x.name == 'show-cwd'),
    inventory: cont.some(x => x.name == 'show-inventory'),
    info: cont.some(x => x.name == 'show-info'),
  }
}


export function soundsOfFs(fs: Fs): Record<string, SoundEffect> {
  let cont;
  try {
    cont = getFullContents(fs, SpecialId.sounds);
  }
  catch (e) {
    return {};
  }
  const rv: Record<string, SoundEffect> = {};


  const ix = cont.findIndex(item => item.content.t == 'checkbox' && item.name == 'sounds');
  if (ix == -1)
    return {};
  else {
    const content = cont[ix].content;
    if (content.t != 'checkbox') {
      throw new Error(`invariant violation, found checkbox but wasn't checkbox somehow?`);
    }
    if (!content.checked)
      return {};
  }

  cont.forEach(item => {
    const contents = itemContents(item);
    if (contents.length >= 1) {
      const content = getItem(fs, contents[0]).content;
      if (content.t == 'sound') {
        rv[item.name] = content.effect;
      }
    }
  });
  return rv;
}

export function gameStateOfFs(fs: Fs): GameState {
  const root = getContents(fs, SpecialId.root);
  return {
    power: false || DEBUG.quickStart,
    viewState: { t: 'fsView' },
    clock: mkClockState(),
    error: undefined,
    curId: SpecialId.root, // XXX should be a mark
    curLine: root.length - 1, // XXX should be a mark
    fs,
    path: [],
    futures: [],
    recurring: {},
    inventoryState: {
      curSlot: 0,
      numSlots: 1,
    },
    _cached_keybindings: keybindingsOfFs(fs),
    _cached_sounds: soundsOfFs(fs),
    _cached_show: showOfFs(fs),
  };
}

export function mkGameState(): SceneState {
  return { t: 'game', gameState: gameStateOfFs(initialFs()), revision: 0 };
}

export function getSelectedId(state: GameState): Ident {
  const contents = getContents(state.fs, getCurId(state));
  return contents[getCurLine(state)];
}

export function getSelectedLine(state: GameState): FullLine {
  // This is kind of inefficient, since we compute all lines, discarding most.
  return getLines(state, getCurId(state))[getCurLine(state)];

  //// Not sure what I was thinking here; doesn't work for '..'
  //
  // const ident = getSelectedId(state);
  // return getLineOfItem(ident, getItem(state.fs, ident), state.curLine);
}

export function nextLocation(loc: Location): Location {
  switch (loc.t) {
    case 'at': return { t: 'at', id: loc.id, pos: loc.pos + 1 };
    case 'is_root': return { t: 'is_root' };

    // XXX this is clearly wrong, but god help us if we're executing
    // binaries inside the inventory, I think?
    case 'inventory': return { t: 'inventory', pos: loc.pos };
  }
}

export function cancelRecur(state: GameState, id: Ident): GameState {
  return produce(state, s => {
    cancelRecurꜝ(s, id);
  });
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

// Returns true if location `loc` is "near" our current location in `state`.
// Used for deciding whether to play sounds.
export function isNearby(state: SceneState, loc: Location | undefined): boolean {
  // `loc` being undefined means play sound unconditionally
  switch (state.t) {
    case 'game': return isNearbyGame(state.gameState, loc);
  }
}

export function isNearbyGame(state: GameState, loc: Location | undefined): boolean {
  if (loc == undefined)
    return true;
  if (loc.t != 'at') {
    console.error(`unexpected isNearby check for ${loc.t}`);
    return false; // XXX this would also be a surprising case
  }
  return (getCurId(state) == loc.id);
}

export function getConcreteSound(state: GameState, sound: AbstractSoundEffect): SoundEffect | undefined {
  return state._cached_sounds[sound];
}
