import { Effect, GameAction, Ident, Item, ViewState } from './model';

export type ConfigureWidgetState = {
  item: Item,
}

export type ConfigureViewState = {
  t: 'configureView',
  back: ViewState,
  target: Ident,
  state: ConfigureWidgetState
}

type ConfigureReduceResult =
  | { t: 'normal', state: ConfigureWidgetState, effects: Effect[] }
  | { t: 'quit', item: Item }
  ;

function quitResult(state: ConfigureWidgetState): ConfigureReduceResult {
  return { t: 'quit', item: state.item };
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

function reduceConfigureViewKey(state: ConfigureWidgetState, code: string): ConfigureReduceResult {
  if (code == '<esc>')
    return quitResult(state);
  if (code == '<left>')
    return quitResult(state);

  console.log(code);
  return nopResult(state);
}
