import { GameAction, GameState } from '../src/core/model';

import * as fs from 'fs';
import * as path from 'path';
import { reduceGameState } from '../src/core/reduce';
import { getContents } from '../src/fs/fs';


describe('reduceGameState', () => {
  it('should not introduce more undefineds into content', () => {
    const beforeState: GameState = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/undefined-example-state.json'), 'utf8'));

    const action: GameAction = { t: 'finishExecution', actorId: 'item.101', instr: 'robot' };

    const [state2, effect] = reduceGameState(beforeState, action);

    expect(getContents(state2.fs, 'item.99').some(x => x == undefined)).toEqual(false);
  });
});
