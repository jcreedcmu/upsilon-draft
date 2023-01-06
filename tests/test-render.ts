import { Item } from "../src/core/model";
import { getLineOfItem, getRenderableLineOfItem } from "../src/core/lines";

const item: Item = {
  name: 'treadmill',
  acls: {
    exec: true,
    pickup: true
  },
  content: {
    t: 'file',
    text: '',
    contents: []
  },
  resources: {
    cpu: 1,
    network: 0
  },
  size: 1,
  flashUntilTick: 33,
  progress: {
    startTicks: 46,
    totalTicks: 50
  }
};

const item2: Item = {
  name: '{red}[{CHECKMARK}]{/}',
  acls: {
    exec: true,
    pickup: true
  },
  content: {
    t: 'file',
    text: '',
    contents: []
  },
  resources: {},
  size: 1,
};

describe('rendering', () => {
  it('should show resources of in progress executables', () => {
    const line = getLineOfItem('item-id', item, 'loc-id', 0, 48, {});

    if (line.t != 'item') {
      expect(line.t).toBe('item');
      throw 'failure';
    }
    expect(line.resources).toEqual({ cpu: 1, network: 0 });
  });

  it('should render entities in filenames correctly', () => {
    const line = getRenderableLineOfItem('foo', item2, 0, {});
    expect(line.str).toEqual('* {red}[{CHECKMARK}]{/}');
  });
});
