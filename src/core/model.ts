import { Fs, getContents, getMark, setMark } from '../fs/fs';
import { initialFs, SpecialId } from '../fs/initial-fs';
import { Resources } from '../fs/resources';
import { ImgData } from '../ui/image';
import { AbstractSoundEffect, SoundEffect } from '../ui/sound';
import { DEBUG } from '../util/debug';
import { produce } from '../util/produce';
import { ClockState, mkClockState } from './clock';
import { ConfigureViewState, ItemConfig } from './configure';
import { ErrorCode } from './errors';
import { cancelRecurꜝ, ExecutableName } from './executables';
import { enumsOfFs, errorsOfFs, Hook, keybindingsOfFs, showOfFs, soundsOfFs } from './hooks';
import { KeyAction } from './key-actions';
import { FullLine, getLines } from './lines';
import { Linlog, LinlogContent } from './linlog';
import { TextEditViewState } from './text-edit';

export type Acl =
  | 'open' // item can be opened
  | 'pickup' // item can be picked up
  | 'exec' // item can be executed
  | 'instr' // item is an instruction [obsolete]
  | 'unlock' // item can operate on locked arguments
  ;

export type Acls = { [P in Acl]?: boolean };

export type UserError = {
  code: ErrorCode,
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


export type Value = number | string;

export type EnumContent = { tp: string, value: number };

export type ItemContent =
  // 'file' is inclusive of plain files and directories
  | { t: 'file', text: string, contents: Ident[] }
  | { t: 'checkbox', checked: boolean }
  | { t: 'enum' } & EnumContent
  | { t: 'sound', effect: SoundEffect }
  | { t: 'image', data: ImgData }
  | { t: 'inventorySlot' }
  | { t: 'compressed', body: ItemContent, acls: Acls }
  | { t: 'linlog' } & LinlogContent
  ;

export type Item = {
  name: string, // displayable name

  content: ItemContent,
  config?: ItemConfig,

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

// There are UiActions, which might have different behavior depending
// on view state, and other GameActions, which should be treated
// uniformly.
export type GameAction =
  | { t: 'clearError' }
  | { t: 'clockUpdate', tick: number }
  | { t: 'finishExecution', actorId: Ident, instr: ExecutableName }
  | { t: 'none' }
  | { t: 'recur', ident: Ident }
  | UiAction
  ;

// I think I want to migrate some of these up to GameAction
export type UiAction =
  | { t: 'key', code: string }
  ;

export type Action =
  | GameAction
  | { t: 'boot', onlyTurnOn?: boolean }
  ;

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
  | { t: 'mainView' }
  | TextEditViewState
  | ConfigureViewState
  ;

export type InventoryState = {
  curSlot: number, // active inventory slot index
  numSlots: number,
};

// This returns an reference to the mark's data that is safe to update
// inside a produce()
function getCursorMark(state: GameState): { id: Ident, pos: number } {
  const mark = getMark(state.fs, SpecialId.cursorMark);
  if (mark.t != 'at') {
    throw new Error(`invariant violation: cursor mark isn't of 'at' type`);
  }
  return mark;
}

export function getCurLine(state: GameState): number {
  return getCursorMark(state).pos;
}

export function setCurLineꜝ(state: GameState, curline: number): void {
  getCursorMark(state).pos = curline;
}

export function getCurId(state: GameState): Ident {
  return getCursorMark(state).id;
}

export function setCurIdꜝ(state: GameState, curid: Ident): void {
  getCursorMark(state).id = curid;
}

export type EnumData = Record<string, string[]>;

export type GameState = {
  power: boolean, // are we powered on
  fs: Fs,
  viewState: ViewState,

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
  _cached_errors: Record<number, string>,
  _cached_enums: EnumData,
};

export function mkState(): State {
  return {
    sceneState: mkGameState(),
    globalAnimationState: {
      shrinkFade: DEBUG.quickStart ? 1.0 : 0.001
    }
  };
}

export function gameStateOfFs(fs: Fs): GameState {
  const root = getContents(fs, SpecialId.root);

  // add mark for current line
  fs = setMark(fs, SpecialId.cursorMark, {
    t: 'at',
    id: SpecialId.root,
    pos: root.length - 1,
  });

  return {
    power: false || DEBUG.quickStart,
    viewState: { t: 'mainView' },
    clock: mkClockState(),
    error: undefined,
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
    _cached_errors: errorsOfFs(fs),
    _cached_enums: enumsOfFs(fs),
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
