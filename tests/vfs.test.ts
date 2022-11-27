import { Fs, getContents, getFullContents, getItem, insertId, insertPlans, ItemPlan, mkFs, removeId } from '../src/fs/fs';
import { SpecialId } from '../src/fs/initialFs';
import { testFile } from "./test-utils";

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


const fs2 = (() => {
  let fs = mkFs();
  [fs,] = insertPlans(fs, SpecialId.root, [
    {
      t: 'dir', name: 'dir', forceId: 'dir', contents: [
        { t: 'virtual', id: 'vroot' },
        testFile('foo_a'),
      ]
    }
  ]);
  return fs;
})();


describe('virtual filesystem', () => {
  test('should work correctly', () => {
    expect(getItem(fs, '_gen_vroot').contents.length > 0).toBe(true);
    expect(getFullContents(fs, '_gen_vroot').map(x => x.name))
      .toEqual([
        'dir-20',
        'dir-1',
        'dir-18',
        'dir-9',
        'dir-3',
        '\x81\x95\x83\x9D\x95'
      ]);

    expect(getFullContents(fs, '_root').map(x => x.name))
      .toEqual([
        'virtual',
        'dir',
      ]);

    expect(getFullContents(fs2, 'dir').map(x => x.name))
      .toEqual([
        'virtual',
        'foo_a',
      ]);

  });
});
