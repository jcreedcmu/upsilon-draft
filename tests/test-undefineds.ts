import { GameAction, GameState } from '../src/core/model';

import * as fs from 'fs';
import * as path from 'path';
import { reduceGameState } from '../src/core/reduce';
import { getContents } from '../src/fs/fs';

const beforeState: GameState = {
  "power": true,
  "viewState": {
    "t": "fsView"
  },
  "clock": {
    "originEpochMs": 1671408655027,
    "timeoutId": 47
  },
  "fs": {
    "counter": 0,
    "idToItem": {
      "item.99": {
        "name": "empty",
        "acls": {
          "open": true
        },
        "content": {
          "t": "file",
          "text": "",
          "contents": [
            "item.100",
            "item.101"
          ]
        },
        "resources": {},
        "size": 1
      },
      "item.100": {
        "name": "automate",
        "acls": {
          "exec": true,
          "pickup": true
        },
        "content": {
          "t": "file",
          "text": "",
          "contents": []
        },
        "resources": {
          "cpu": 4,
          "network": 0
        },
        "size": 1,
      },
      "item.101": {
        "name": "robot",
        "acls": {
          "exec": true,
          "pickup": true
        },
        "content": {
          "t": "file",
          "text": "",
          "contents": []
        },
        "resources": {
          "cpu": 3,
          "network": 0
        },
        "size": 1,
        "progress": {
          "startTicks": 24,
          "totalTicks": 5
        },
      }
    },
    "marks": {
      "_cursorMark": {
        "t": "at",
        "id": "item.99",
        "pos": 1
      }
    },
    "_cached_locmap": {
      "item.99": {
        "t": "is_root"
      },
      "item.100": {
        "t": "at",
        "id": "item.99",
        "pos": 0
      },
      "item.101": {
        "t": "at",
        "id": "item.99",
        "pos": 2
      }
    },
    "inventory": []
  },
  "path": [],
  "futures": [],
  "recurring": {},
  "inventoryState": {
    "curSlot": 0,
    "numSlots": 1
  },
  "_cached_keybindings": {},
  "_cached_sounds": {},
  "_cached_show": {
    "size": true,
    "charge": true,
    "network": true,
    "cwd": true,
    "inventory": true,
    "info": true
  },
  _cached_errors: {},
  error: undefined,
};

describe('reduceGameState', () => {
  it('should not introduce more undefineds into content', () => {


    const action: GameAction = { t: 'finishExecution', actorId: 'item.101', instr: 'robot' };

    const [state2, effect] = reduceGameState(beforeState, action);

    expect(getContents(state2.fs, 'item.99').some(x => x == undefined)).toEqual(false);
  });
});
