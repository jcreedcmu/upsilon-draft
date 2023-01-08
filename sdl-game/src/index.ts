import * as nat from 'native-layer';
import { NativeLayer } from 'native-layer';
import * as shader from './shaders';
import * as palette from '../../src/ui/palette';
import { Screen } from '../../src/ui/screen';
import { ColorCode } from '../../src/ui/ui-constants';
import { Action, Effect, GameState, getConcreteSound, isNearby, mkGameState, mkState, SceneState, State } from "../../src/core/model";
import { finalRender, render } from '../../src/ui/render';
import { nativeLayer, paintFrame, updateTextPage } from './graphics';
import { reduce } from '../../src/core/reduce';
import { produce } from '../../src/util/produce';

const state: State[] = [mkState()];

function dispatch(action: Action): void {
  let [sceneState, effects] = reduce(state[0].sceneState, action);
  state[0] = produce(state[0], s => { s.sceneState = sceneState; });
}

let prevSceneState: SceneState | null = null;

function repaint() {
  let screen: Screen | undefined = undefined;
  if (state[0].sceneState == prevSceneState) {
    // Do nothing
  }
  else {
    prevSceneState = state[0].sceneState;
    updateTextPage(render(prevSceneState));
  }
  paintFrame();
}

function convertSdlKey(key: string): string {
  const lower = key.toLowerCase();
  return lower.length == 1 ? lower : `<${lower}>`;
}

while (1) {
  const key = nativeLayer.pollEvent();
  if (key != null) {
    if (key == 'Q' || key == 'Escape')
      break;
    if (key == '1') {
      dispatch({ t: 'boot' });
    }
    dispatch({ t: 'key', code: convertSdlKey(key) });
  }
  repaint();
}

nativeLayer.finish();
