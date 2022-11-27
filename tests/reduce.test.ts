import { mkGameState, State } from '../src/core/model';
import { reduceExecAction } from '../src/core/reduce';

describe('reduce', () => {
  test(`shouldn't duplicate sounds for named executable`, () => {

    // XXX maybe use a more parsimonious initial state here for
    // testing instead of the full initial default fs
    const state = mkGameState() as State & { t: 'game' };
    const [, effects] = reduceExecAction(state.gameState, { t: 'exec', ident: 'item.43' });
    expect(effects.filter(x => x.t == 'playSound').length).toEqual(1);
  });

});
