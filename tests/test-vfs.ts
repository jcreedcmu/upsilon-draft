import { getContents, getFullContents, getItem, insertPlans, mkFs } from '../src/fs/fs';
import { SpecialId } from '../src/fs/initial-fs';
import { testFile } from "./testing-utils";

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

    expect(getContents(fs, '_gen_vroot').length > 0).toBe(true);
    expect(getFullContents(fs, '_gen_vroot').map(x => x.name))
      .toEqual([
        "gbar",
        "zdbaz",
        "sfoo",
        "gbaz",
        "jgbaz",
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

    expect(getFullContents(fs, 'dir').map(x => x.name))
      .toEqual([
        'virtual',
        'foo_a',
      ]);
  });
});
