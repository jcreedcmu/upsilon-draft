import { Fs, getContents, getItem, insertId, insertPlans, ItemPlan, mkFs, removeId } from '../src/fs/fs';
import { SpecialId } from '../src/fs/initialFs';
import { testFile } from './fs.test';

const fs = (() => {
  let fs = mkFs();
  [fs,] = insertPlans(fs, SpecialId.root, [
    { t: 'virtual', id: 'vroot' },
    {
      t: 'dir', name: 'dir', forceId: 'dir', contents: [
        testFile('foo_a'),
      ]
    }
  ]);
  return fs;
})();

describe('virtual filesystem', () => {
  test('should work correctly', () => {
    expect(getItem(fs, '_gen_vroot').contents).toEqual([
      "_gen_vroot/foo",
      "_gen_vroot/bar",
    ]);
  });
});
