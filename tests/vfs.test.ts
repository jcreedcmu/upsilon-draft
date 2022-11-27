import { Fs, getContents, getFullContents, getItem, insertId, insertPlans, ItemPlan, mkFs, removeId } from '../src/fs/fs';
import { SpecialId } from '../src/fs/initialFs';
import { testFile } from "./test-utils";

const jestConsole = console;


describe('virtual filesystem', () => {
  test('should work correctly', () => {

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

  });

  test('should permit virtual filesystem occurring not at root', () => {

    const fs = (() => {
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

    // XXX This is wrong and I'm simply enshrining the wrong behavior
    // in a test to remind me when I feel like fixing it.
    // What's going wrong is that I'm equivocating between setting up
    // the contents of a directory right away, and after its initial insertion.
    expect(getFullContents(fs, 'dir').map(x => x.name))
      .toEqual([
        'virtual',
        'virtual',
        'foo_a',
      ]);
  });
});
