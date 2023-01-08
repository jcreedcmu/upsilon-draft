import * as nat from 'native-layer';
import { NativeLayer } from 'native-layer';
import * as shader from './shaders';
import * as palette from '../../src/ui/palette';
import { Screen } from '../../src/ui/screen';
import { ColorCode } from '../../src/ui/ui-constants';
import { Action, Effect, GameState, getConcreteSound, isNearby, mkGameState, mkState, SceneState, State } from "../../src/core/model";
import { finalRender, render } from '../../src/ui/render';
import { nativeLayer, paintFrame } from './graphics';

while (1) {
  const key = nativeLayer.pollEvent();
  if (key != null) {
    console.log(key);
    if (key == 'Q' || key == 'Escape')
      break;
  }
  nativeLayer.clear();

  paintFrame();
}

nativeLayer.finish();
