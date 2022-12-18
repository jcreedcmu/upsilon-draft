import { Point } from '../util/types';
import { Effect, GameAction } from './model';


export type TextDialogViewState = {
  text: string;
  cursor: Point;
};
type TextDialogReduceResult = { t: 'normal'; state: TextDialogViewState; effects: Effect[]; } |
{ t: 'quit'; text: string; };
export function reduceTextDialogView(state: TextDialogViewState, action: GameAction): TextDialogReduceResult {
  switch (action.t) {
    case 'key': return { t: 'quit', text: state.text };
    default: return { t: 'normal', state, effects: [] };
  }
}
