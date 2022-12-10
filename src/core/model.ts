import { Fs, getContents, getFullContents, getItem } from '../fs/fs';
import { initialFs, SpecialId } from '../fs/initialFs';
import { Resources } from '../fs/resources';
import { allSoundEffects, SoundEffect } from '../ui/sound';
import { DEBUG } from '../util/debug';
import { produce } from '../util/produce';
import { ClockState, mkClockState } from './clock';
import { ExecutableName } from './executables';
import { FullLine, getLines } from './lines';

export type Acl =
  | 'open'
  | 'pickup'
  | 'exec'
  | 'instr'
  | 'unlock'
  | 'checked';
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

export type ItemType =
  | 'plain'
  | 'checkbox'
  ;

export type Item = {
  name: string, // displayable name

  contents: Ident[],

  itemType: ItemType,

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
  | { t: 'finishExecution', actorId: Ident, targetIds: Ident[], instr: ExecutableName }
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
  pickupDrop = 'pickup-drop', // Maybe want separate pickup and drop actions?
}

export type AbstractSoundEffect =
  | 'change-file'
  | 'go-back'
  | 'change-slot'
  | 'startup'
  | 'error'
  | 'execute'
  | 'go-into'
  | 'pickup'
  | 'drop'
  | 'success'
  | 'toggle'
  ;

export type Effect =
  | { t: 'playSound', effect: SoundEffect, loc: Location | undefined }
  | { t: 'playAbstractSound', effect: AbstractSoundEffect, loc: Location | undefined }
  | { t: 'powerButton' }
  ;

// If I need to add more state around settings, menus, saving, etc.,
// it might go here.
export type SceneState =
  | { t: 'game', gameState: GameState };

export type State = {
  sceneState: SceneState,
  globalAnimationState: {
    shrinkFade: number, // should be in the interval [0,1]
  }
};

export type Future = { whenTicks: number, action: GameAction, live?: boolean };

export type Recurring = Record<Ident, { startTicks: number, periodTicks: number }>;

// This is for alternate modal states within the game interface, which
// are triggered by "diagetic" controls.
export type ViewState =
  | { t: 'fsView' }
  | { t: 'textDialogView', back: ViewState };

export type GameState = {
  power: boolean,
  viewState: ViewState,
  curId: Ident,
  curLine: number,
  fs: Fs,
  error: UserError | undefined,
  clock: ClockState,
  path: string[],
  futures: Future[], // generic future events that happen on a timer
  recurring: Recurring, // active executables that execute recurringly
  inventorySlot: number, // active inventory slot index
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

export function getConcreteSound(state: GameState, sound: AbstractSoundEffect): SoundEffect | undefined {
  return state._cached_sounds[sound];
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

  const ix = cont.findIndex(item => item.itemType == 'checkbox' && item.name == 'sounds');
  if (!(ix != -1 && cont[ix].acls.checked))
    return {}; // disable all sounds

  cont.forEach(item => {
    if (item.contents.length >= 1) {
      const inner = getItem(fs, item.contents[0]);
      if ((allSoundEffects as readonly string[]).includes(inner.name)) {
        rv[item.name] = inner.name as SoundEffect;
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
    curId: SpecialId.root,
    curLine: root.length - 1,
    fs,
    path: [],
    futures: [],
    recurring: {},
    inventorySlot: 0,
    _cached_keybindings: keybindingsOfFs(fs),
    _cached_sounds: soundsOfFs(fs),
    _cached_show: showOfFs(fs),
  };
}

export function mkGameState(): SceneState {
  return { t: 'game', gameState: gameStateOfFs(initialFs()) };
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

    // XXX this is clearly wrong, but god help us if we're executing
    // binaries inside the inventory, I think?
    case 'inventory': return { t: 'inventory', pos: loc.pos };
  }
}

export function deactivateItem(state: GameState, id: Ident): GameState {
  return produce(state, s => {
    delete (s.recurring[id]);
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
  return (state.curId == loc.id);
}
