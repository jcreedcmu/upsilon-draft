import { GameAction, GameState } from '../src/core/model';

import * as fs from 'fs';
import * as path from 'path';
import { reduceGameState } from '../src/core/reduce';
import { getContents, getLocation } from '../src/fs/fs';

const beforeState: GameState = {
  "power": true,
  "viewState": {
    "t": "mainView"
  },
  "clock": {
    "originEpochMs": 1671408655027,
    "timeoutId": 47
  },
  "fs": {
    "counter": 0,
    "idToItem": {
      "_debugDir": {
        "name": "debug",
        "acls": {
          "open": true
        },
        "content": {
          "t": "file",
          "text": "",
          "contents": [
            "_automate",
            "_robot"
          ]
        },
        "resources": {},
        "size": 1
      },
      "_automate": {
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
          "cpu": 5,
          "network": 0
        },
        "size": 1
      },
      "_robot": {
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
          "cpu": 4,
          "network": 0
        },
        "size": 1,
        "progress": {
          "startTicks": 12,
          "totalTicks": 5
        }
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
      "_debugDir": {
        "t": "is_root",
      },
      "_automate": {
        "t": "at",
        "id": "_debugDir",
        "pos": 0
      },
      "_robot": {
        "t": "at",
        "id": "_debugDir",
        "pos": 1
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
  _cached_enums: {},
  error: undefined,
};

describe('reduceGameState', () => {
  it('should not lead to bad location information', () => {

    const action: GameAction = { "t": "finishExecution", "actorId": "_robot", "instr": "robot" };

    const [state2, effect] = reduceGameState(beforeState, action);

    // Specifically, robot should be at position 1 after this
    expect(getLocation(state2.fs, '_robot')).toEqual({
      t: "at",
      id: "_debugDir",
      pos: 0,
    });
    // Generally, nobody should be at position 2
    const locs = ['_automate', '_robot']
      .map(it => {
        const loc = getLocation(state2.fs, it);
        if (loc.t != 'at') return -1000;
        if (loc.id != '_debugDir') return -1000;
        return loc.pos;
      });
    locs.sort((a, b) => a - b);
    expect(locs).toEqual([0, 1]);
  });
});
