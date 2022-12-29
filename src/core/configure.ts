import { Chars } from '../ui/screen';
import { produce } from '../util/produce';
import { Action } from './lines';
import { Effect, GameAction, Ident, Item, ViewState } from './model';

export type ConfigureWidgetState = {
  item: Item,
  cursor: number,
  config: ItemConfig,
}

export type ConfigureViewState = {
  t: 'configureView',
  back: ViewState,
  target: Ident,
  state: ConfigureWidgetState
}

type ConfigureReduceResult =
  | { t: 'normal', state: ConfigureWidgetState, effects: Effect[] }
  | { t: 'save', item: Item, config: ItemConfig }
  | { t: 'cancel' }
  ;

function cancelResult(state: ConfigureWidgetState): ConfigureReduceResult {
  return { t: 'cancel' };
}

function nopResult(state: ConfigureWidgetState): ConfigureReduceResult {
  return { t: 'normal', state, effects: [] };
}

export function reduceConfigureView(state: ConfigureWidgetState, action: GameAction): ConfigureReduceResult {
  switch (action.t) {
    case 'key': return reduceConfigureViewKey(state, action.code);
    default: return { t: 'normal', state, effects: [] };
  }
}

function moveCursor(state: ConfigureWidgetState, amount: number): ConfigureWidgetState {
  const numLines = getItemConfigLines(state.config).length;
  return produce(state, s => {
    s.cursor = (s.cursor + numLines + amount) % numLines;
  })
}

function toggleConfig(state: ConfigureWidgetState): ConfigureWidgetState {
  switch (state.config.t) {
    case 'none': return state;
    case 'modify': return produce(state, s => {
      if (s.config.t == 'modify') { // XXX bummer that I have to do this for typing reasons
        s.config.increment *= -1;
      }
    });
  }
}

function reduceConfigAction(state: ConfigureWidgetState, action: ConfigAction): ConfigureReduceResult {
  switch (action.t) {
    case 'cancel': return { t: 'cancel' };
    case 'save': return { t: 'save', item: state.item, config: state.config };
    case 'toggle': return {
      t: 'normal',
      state: toggleConfig(state),
      effects: [{ t: 'playAbstractSound', effect: 'change-slot', loc: undefined }]
    };
  }
}

function reduceConfigureViewKey(state: ConfigureWidgetState, code: string): ConfigureReduceResult {
  switch (code) {
    case '<esc>': return cancelResult(state);
    case '<left>': return cancelResult(state);
    case '<up>': return { t: 'normal', state: moveCursor(state, -1), effects: [{ t: 'playAbstractSound', effect: 'change-file', loc: undefined }] };
    case '<down>': return { t: 'normal', state: moveCursor(state, 1), effects: [{ t: 'playAbstractSound', effect: 'change-file', loc: undefined }] };
    case '<right>': {
      const action = getItemConfigLines(state.config)[state.cursor].action;
      return reduceConfigAction(state, action);
    }
  }
  console.log(code);
  return nopResult(state);
}

// Some lens-like operations to get/put config for an item

export type ItemConfig =
  | { t: 'none' }
  | { t: 'modify', increment: number };

function defaultItemConfig(name: string): ItemConfig {
  if (name == 'modify') {
    return { t: 'modify', increment: 1 };
  }
  return { t: 'none' };
}

export function getItemConfig(item: Item): ItemConfig {
  // XXX maybe do some more checking here
  if (item.config != undefined)
    return item.config;
  else
    return defaultItemConfig(item.name);
}

export function putItemConfig(item: Item, config: ItemConfig): Item {
  // XXX maybe do some more checking here
  return produce(item, it => { it.config = config; });
}

// for rendering

export type ConfigAction =
  | { t: 'cancel' }
  | { t: 'save' }
  | { t: 'toggle' }
  ;

export type ItemConfigLine = { tagStr: string, action: ConfigAction };

function modifyLines(state: { increment: number }): ItemConfigLine[] {
  const char = state.increment > 0 ? Chars.ARROW_DOWN : Chars.ARROW_UP;
  return [{ tagStr: `direction: ${char}`, action: { t: 'toggle' } }];
}

export function getItemConfigLines(config: ItemConfig): ItemConfigLine[] {
  const basicLines: ItemConfigLine[] = [
    { tagStr: '[{bblack}cancel{/}]', action: { t: 'cancel' } },
    { tagStr: '[{green}save{/}]', action: { t: 'save' } }
  ];
  switch (config.t) {
    case 'none': return basicLines;
    case 'modify': return [...modifyLines(config), ...basicLines];
  }
}
