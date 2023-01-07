import * as nat from 'native-layer';
import { NativeLayer } from 'native-layer';
import * as shader from './shaders';
import * as palette from '../../src/ui/palette';
import { Screen } from '../../src/ui/screen';
import { ColorCode } from '../../src/ui/ui-constants';
import { Action, Effect, GameState, getConcreteSound, isNearby, mkGameState, mkState, SceneState, State } from "../../src/core/model";
import { finalRender, getRenderable, render } from '../../src/ui/render';

const width = 1280;
const height = 800;
const ROWS = 18;
const COLS = 48;

const SCALE = 3;
const screen_width = COLS * 6 * SCALE;
const screen_height = ROWS * 12 * SCALE;

const nativeLayer = new NativeLayer(width, height);

enum TextureUnit {
  FB = 1,
  BUTTON,
  FONT,
  TEXT_PAGE,
}

const button1 = new nat.Texture();
button1.loadFile('public/assets/button-down.png');
const button2 = new nat.Texture();
button2.loadFile('public/assets/button-up.png');

//  const buttonTexture = (Math.floor(time()) % 2 == 0) ? button1 : button2;

const fbTexture = new nat.Texture();
fbTexture.makeBlank(width, height);
fbTexture.bind(TextureUnit.FB);

const textPageTexture = new nat.Texture();
textPageTexture.makeBlank(COLS, ROWS);
textPageTexture.bind(TextureUnit.TEXT_PAGE);

const fontTexture = new nat.Texture();
fontTexture.loadFile('public/assets/vga.png');
fontTexture.bind(TextureUnit.FONT);

const fb = new nat.Framebuffer();
fb.setOutputTexture(fbTexture.textureId());
fb.unbind();

const programText = new nat.Program(shader.vertexFlip, shader.fragText);
nativeLayer.configShaders(programText.programId());
nat.glUniform2f(programText.getUniformLocation("u_offset"), 0, 0);
nat.glUniform2f(programText.getUniformLocation("u_size"), width, height);
nat.glUniform2f(programText.getUniformLocation("u_viewport_size"), width, height);
nat.glUniform2f(programText.getUniformLocation("u_canvasSize"), screen_width, screen_height);
nat.glUniform1i(programText.getUniformLocation("u_fontTexture"), TextureUnit.FONT);
nat.glUniform1i(programText.getUniformLocation("u_textPageTexture"), TextureUnit.TEXT_PAGE);
nat.glUniform4fv(programText.getUniformLocation("u_palette"), palette.paletteDataFloat());

const state = mkGameState();
const screen = render(state);

nat.glActiveTexture(TextureUnit.TEXT_PAGE);
nat.glTexImage2d(48, 18, screen.imdat.data);

const programSynth = new nat.Program(shader.vertex, shader.fragmentSynthetic);
nativeLayer.configShaders(programSynth.programId());
nat.glUniform2f(programSynth.getUniformLocation("u_offset"), 0, 0);
nat.glUniform2f(programSynth.getUniformLocation("u_size"), width, height);
nat.glUniform2f(programSynth.getUniformLocation("u_viewport_size"), width, height);

const programTexture = new nat.Program(shader.vertex, shader.fragmentTexture);
nativeLayer.configShaders(programTexture.programId());
button1.bind(TextureUnit.BUTTON);

const u_sampler = programTexture.getUniformLocation('u_sampler');

const programPost = new nat.Program(shader.vertexFlip, shader.fragPost);
nativeLayer.configShaders(programPost.programId());
nat.glUniform2f(programPost.getUniformLocation("u_offset"), (width - screen_width) / 2, (height - screen_height) / 2);
nat.glUniform2f(programPost.getUniformLocation("u_size"), screen_width, screen_height);
nat.glUniform2f(programPost.getUniformLocation("u_viewport_size"), width, height);
nat.glUniform1i(programPost.getUniformLocation("u_screenTexture"), TextureUnit.FB);
nat.glUniform1f(programPost.getUniformLocation("u_beamScale"), 1.0);
nat.glUniform1f(programPost.getUniformLocation("u_fade"), 1.0);
nat.glUniform2f(programPost.getUniformLocation("windowSize"), screen_width, screen_height);

const progStart = Date.now();
function time(): number {
  return (Date.now() - progStart) / 1000;
}

while (nativeLayer.pollEvent()) {
  nativeLayer.clear();

  // Draw underlying screen data to framebuffer
  fb.bind();
  programText.use();
  nativeLayer.drawTriangles();
  fb.unbind();

  // Draw screen postprocessing
  programPost.use();
  nat.glUniform1f(programPost.getUniformLocation("u_time"), time());
  nativeLayer.drawTriangles();

  // Draw power button
  programTexture.use();
  nat.glUniform2f(programTexture.getUniformLocation("u_offset"), width - 100, height - 75);
  nat.glUniform2f(programTexture.getUniformLocation("u_size"), 100, 75);
  nat.glUniform2f(programTexture.getUniformLocation("u_viewport_size"), width, height);
  nat.glUniform1i(u_sampler, TextureUnit.BUTTON);
  nativeLayer.drawTriangles();

  nativeLayer.swapWindow();
}

nativeLayer.finish();
