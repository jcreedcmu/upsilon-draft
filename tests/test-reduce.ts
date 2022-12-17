import { executables, executeInstructions } from '../src/core/executables';
import { gameStateOfFs, getCurId, getSelectedId, KeyAction } from '../src/core/model';
import { reduce, reduceExecAction, reduceGameState, reduceGameStateFs, reduceKeyAction } from '../src/core/reduce';
import { insertPlans, mkFs } from '../src/fs/fs';
import { namedExec, SpecialId } from '../src/fs/initialFs';
import { testFile } from "./testing-utils";

const fs = (() => {
  let fs = mkFs();
  [fs,] = insertPlans(fs, SpecialId.root, [
    {
      t: 'dir', name: 'dir', forceId: 'dir', contents: [
        testFile('text-dialog'),
      ]
    }
  ]);
  return fs;
})();

const fs2 = (() => {
  let fs = mkFs();
  [fs,] = insertPlans(fs, SpecialId.root, [
    namedExec(executables.toggleOpen, { forceId: 'toggle-open' }),
    { t: 'file', name: 'foo', forceId: 'foo' }
  ]);
  return fs;
})();

describe('reduce', () => {
  test(`shouldn't duplicate effects for 0-cycle named executable`, () => {

    const state = gameStateOfFs(fs);
    const [, effects] = reduceExecAction(state, { t: 'exec', ident: 'text-dialog' });
    expect(effects.filter(x => x.t == 'playAbstractSound').length).toEqual(1);
  });

  test(`should descend into toggle-open'ed files correctly`, () => {
    let state = gameStateOfFs(fs2);
    let effects, error;
    [state] = reduceKeyAction(state, KeyAction.prevLine);
    expect(getSelectedId(state)).toEqual('toggle-open');
    [state, effects, error] = executeInstructions(state, executables.toggleOpen, getSelectedId(state));
    [state] = reduceKeyAction(state, KeyAction.nextLine);
    [state] = reduceKeyAction(state, KeyAction.exec);
    expect(state.fs.marks).toEqual({ _cursorMark: { t: 'at', id: 'foo', pos: 0 } });
    [state] = reduceKeyAction(state, KeyAction.nextLine);
    expect(state.fs.marks).toEqual({ _cursorMark: { t: 'at', id: 'foo', pos: 0 } });
    expect(state.path).toEqual(['foo']);
    [state] = reduceKeyAction(state, KeyAction.back);
    expect(state.fs.marks).toEqual({ _cursorMark: { t: 'at', id: '_root', pos: 1 } });
  });
});
