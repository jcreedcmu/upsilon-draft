import { gameStateOfFs } from '../src/core/model';
import { reduceExecAction, reduceGameState, reduceGameStateFs } from '../src/core/reduce';
import { getFullContents, insertPlans, mkFs, moveId } from '../src/fs/fs';
import { SpecialId } from '../src/fs/initial-fs';
import { getResource } from '../src/fs/resources';
import { produce } from '../src/util/produce';
import { testFile } from "./testing-utils";

const fs = (() => {
  let fs = mkFs();
  [fs,] = insertPlans(fs, SpecialId.root, [
    { t: 'virtual', id: 'vroot' },
    testFile('mov-cpu-5', { cpu: 10 }),
    testFile('receiver'),
  ]);
  return fs;
})();

describe('mov-cpu-5', () => {
  test(`should be able to move cpu out of virtual file`, () => {

    let state = gameStateOfFs(fs);


    let [fs_,] = moveId(fs, { t: 'at', id: '_gen_vroot', pos: 5 }, { t: 'at', id: '_root', pos: 2 }); // ignore hooks

    state = produce(state, s => { s.fs = fs_; });

    expect(getFullContents(state.fs, '_gen_vroot').map(x => x.name))
      .toEqual([
        'dir-20',
        'dir-1',
        'dir-18',
        'dir-9',
        'dir-3',
      ]);

    expect(getResource(getFullContents(state.fs, '_root')[2], 'cpu')).toEqual(3);

    let effects;
    [state, effects] = reduceExecAction(state, { t: 'exec', ident: 'mov-cpu-5' });

    expect(state.futures.length).toEqual(1);
    expect(state.futures[0].action).toEqual({
      actorId: "mov-cpu-5", instr: "mov-cpu-5", t: "finishExecution"
    });

    [state, effects] = reduceGameState(state, state.futures[0].action);

    expect(getResource(getFullContents(state.fs, '_root')[2], 'cpu')).toEqual(0);

  });

});
