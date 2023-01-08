import { State } from '../core/model';
import { produce } from '../util/produce';
import { lerp } from '../util/util';

export type DrawParams = {
  beamScale: number,
  fade: number,
}

export function drawParamsOfState(state: State): DrawParams {
  const ga = state.globalAnimationState;
  if (ga.shrinkFade == 1.0) {
    return { beamScale: 1.0, fade: 1.0 };
  }
  return {
    beamScale: ga.shrinkFade + 0.001,
    fade: Math.pow(ga.shrinkFade, 2),
  };
}

export function animatePowerState(state: State): State {
  const ga = state.globalAnimationState;
  const nextShrinkFade = (state.sceneState.gameState.power) ?
    (Math.min(lerp(ga.shrinkFade, 1.05, 0.01), 1.0)) :
    (Math.max(lerp(ga.shrinkFade, -0.05, 0.05), 0.0));

  return produce(state, s => {
    s.globalAnimationState.shrinkFade = nextShrinkFade;
  });
}
