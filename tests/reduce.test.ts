import { gameStateOfFs } from '../src/core/model';
import { reduceExecAction } from '../src/core/reduce';
import { insertPlans, mkFs } from '../src/fs/fs';
import { SpecialId } from '../src/fs/initialFs';
import { testFile } from "./test-utils";

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
  test(`shouldn't duplicate effects for 0-cycle named executable`, () => {

    const state = gameStateOfFs(fs);
    const [, effects] = reduceExecAction(state, { t: 'exec', ident: 'text-dialog' });
    expect(effects.filter(x => x.t == 'playSound').length).toEqual(1);
  });

});
