import { produce } from '../util/produce';
import { Point } from '../util/types';
import { Effect, GameAction, Ident, ViewState } from './model';

export type TextWidgetState = {
  text: string;
  cursor: Point;
};

type TextDialogReduceResult =
  | { t: 'normal', state: TextWidgetState, effects: Effect[] }
  | { t: 'quit', text: string }
  ;

function quitResult(state: TextWidgetState): TextDialogReduceResult {
  return { t: 'quit', text: state.text };
}

function nopResult(state: TextWidgetState): TextDialogReduceResult {
  return { t: 'normal', state, effects: [] };
}

export function reduceTextDialogView(state: TextWidgetState, action: GameAction): TextDialogReduceResult {
  switch (action.t) {
    case 'key': return reduceTextDialogViewKey(state, action.code);
    default: return { t: 'normal', state, effects: [] };
  }
}

function reduceTextDialogViewKey(state: TextWidgetState, code: string): TextDialogReduceResult {
  function cursorAdjust(amount: number): TextDialogReduceResult {
    return {
      t: 'normal', state: produce(state, s => {
        s.cursor.x = Math.max(0, Math.min(state.text.length, state.cursor.x + amount));
      }), effects: [{ t: 'playAbstractSound', effect: 'change-file', loc: undefined }]
    }
  }
  function backspace(): TextDialogReduceResult {
    const t = state.text;
    const cr = state.cursor.x;
    if (cr <= 0)
      return nopResult(state);
    const newText = t.substring(0, cr - 1) + t.substring(cr);
    return {
      t: 'normal', state: produce(state, s => {
        s.text = newText;
        s.cursor.x = Math.max(0, state.cursor.x - 1);
      }), effects: [{ t: 'playAbstractSound', effect: 'change-file', loc: undefined }]
    }
  }
  function insertCharacter(char: string): TextDialogReduceResult {
    const t = state.text;
    const cr = state.cursor.x;
    const newText = t.substring(0, cr) + char + t.substring(cr);
    return {
      t: 'normal', state: produce(state, s => {
        s.text = newText;
        s.cursor.x++;
      }), effects: [{ t: 'playAbstractSound', effect: 'change-file', loc: undefined }]
    }
  }
  if (code.length == 1) {
    return insertCharacter(code);
  }
  let m;
  if (m = code.match(/^S-([a-z])$/)) {
    return insertCharacter(m[1].toUpperCase());
  }
  if (code == '<space>' || code == 'S-<space>') {
    return insertCharacter(' ');
  }
  if (code == '<backspace>') {
    return backspace();
  }
  if (code == '<right>') {
    return cursorAdjust(1);
  }
  if (code == '<left>') {
    return cursorAdjust(-1);
  }
  if (code == '<esc>')
    return quitResult(state);
  console.log(code);
  return nopResult(state);
}
