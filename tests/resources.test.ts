import { getItem, insertPlans, mkFs } from '../src/fs/fs';
import { SpecialId } from '../src/fs/initialFs';
import { produce } from '../src/util/produce';
import { getResource, modifyResource, Resources, resourcesPlus } from '../src/fs/resources';

const fs = (() => {
  let fs = mkFs();
  [fs,] = insertPlans(fs, SpecialId.root, [
    { t: 'exec', name: 'foo', forceId: 'foo', contents: [], resources: { cpu: 4, network: 3 } },
    { t: 'exec', name: 'bar', forceId: 'bar', contents: [], resources: { cpu: 10, network: 1 } },
  ]);
  return fs;
})();


describe('getResource', () => {
  test('should work correctly', () => {
    expect(getResource(getItem(fs, 'foo'), 'cpu')).toEqual(4);
  });
});

describe('modifyResource', () => {
  test('should work correctly', () => {
    const fs2 = produce(fs, fs => {
      modifyResource(getItem(fs, 'bar'), 'cpu', x => x + 10);
    });
    expect(getResource(getItem(fs2, 'bar'), 'cpu')).toEqual(20);
  });
});

describe('modifyResource', () => {
  test('should work correctly', () => {
    const resources1: Resources = { network: 3, data: 1 };
    const resources2: Resources = { cpu: 10, data: 5 };
    expect(resourcesPlus(resources1, resources2)).toEqual({ cpu: 10, data: 6, network: 3 });
  });
});
