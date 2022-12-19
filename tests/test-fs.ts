import { executables } from '../src/core/executables';
import { GameAction } from '../src/core/model';
import { getContents, getLocation, insertId, insertPlans, mkFs, moveIdForward, removeId } from '../src/fs/fs';
import { namedExec, SpecialId } from '../src/fs/initial-fs';
import { testFile } from './testing-utils';

const fs = (() => {
  let fs = mkFs();
  [fs,] = insertPlans(fs, SpecialId.root, [
    {
      t: 'dir', name: 'dir', forceId: 'dir', contents: [
        testFile('foo_a'),
        testFile('foo_b'),
        testFile('foo_c'),
        testFile('foo_d'),
      ]
    }
  ]);
  return fs;
})();

describe('filesystem', () => {
  test('should have a correct location map', () => {
    expect(fs._cached_locmap).toEqual({
      _root: { t: 'is_root', },
      dir: { t: 'at', id: '_root', pos: 0, },
      foo_a: { t: 'at', id: 'dir', pos: 0, },
      foo_b: { t: 'at', id: 'dir', pos: 1, },
      foo_c: { t: 'at', id: 'dir', pos: 2, },
      foo_d: { t: 'at', id: 'dir', pos: 3, },
    });
  });

  const [fs2, ident, hook] = removeId(fs, 'dir', 1);
  expect(ident).toEqual('foo_b');

  test('should correctly remove items', () => {

    expect(getContents(fs2, 'dir')).toEqual(['foo_a', 'foo_c', 'foo_d']);
    expect(fs2._cached_locmap).toEqual({
      _root: { t: 'is_root', },
      dir: { t: 'at', id: '_root', pos: 0, },
      foo_a: { t: 'at', id: 'dir', pos: 0, },
      foo_b: { t: 'is_root', },
      foo_c: { t: 'at', id: 'dir', pos: 1, },
      foo_d: { t: 'at', id: 'dir', pos: 2, },
    });
  });

  test('should correctly insert items', () => {
    const [fs3, hook] = insertId(fs2, 'dir', 0, 'foo_b');

    expect(getContents(fs3, 'dir')).toEqual(['foo_b', 'foo_a', 'foo_c', 'foo_d']);
    expect(fs3._cached_locmap).toEqual({
      _root: { t: 'is_root', },
      dir: { t: 'at', id: '_root', pos: 0, },
      foo_b: { t: 'at', id: 'dir', pos: 0, },
      foo_a: { t: 'at', id: 'dir', pos: 1, },
      foo_c: { t: 'at', id: 'dir', pos: 2, },
      foo_d: { t: 'at', id: 'dir', pos: 3, },
    });
  });
});

describe('moveIdForward', () => {

  const fs = (() => {
    let fs = mkFs();
    [fs,] = insertPlans(fs, SpecialId.root, [
      {
        t: 'dir', name: 'dir', forceId: '_debugDir', contents: [
          namedExec(executables.automate, { forceId: '_automate', resources: { cpu: 5, network: 0 } }),
          namedExec(executables.robot, { forceId: '_robot', resources: { cpu: 5, network: 0 } }),
        ]
      }
    ]);
    return fs;
  })();

  it('should work correctly', () => {

    const action: GameAction = { "t": "finishExecution", "actorId": "_robot", "instr": "robot" };

    const [newFs, hooks] = moveIdForward(fs, '_robot', 1);

    expect(getLocation(newFs, '_robot')).toEqual({
      t: "at",
      id: "_debugDir",
      pos: 1,
    });
  });
});
