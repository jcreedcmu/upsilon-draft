import { gameStateOfFs } from '../src/core/model';
import { reduceExecAction } from '../src/core/reduce';
import { initialFs } from '../src/fs/initialFs';
import { Fs, getContents, insertId, insertPlans, ItemPlan, mkFs, removeId } from '../src/fs/fs';
import { SpecialId } from '../src/fs/initialFs';
import { testFile } from './fs.test';

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

describe('reduce', () => {
  test(`shouldn't duplicate sounds for named executable`, () => {

    const state = gameStateOfFs(fs);
    const [, effects] = reduceExecAction(state, { t: 'exec', ident: 'text-dialog' });
    expect(effects.filter(x => x.t == 'playSound').length).toEqual(1);
  });

});
