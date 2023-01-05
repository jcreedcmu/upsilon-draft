import * as nat from 'native-layer';
import { NativeLayer } from 'native-layer';
import * as shader from './shaders';

const width = 800;
const height = 600;

const SCALE = 2;
const screen_width = 48 * 6 * SCALE;
const screen_height = 18 * 12 * SCALE;

const nativeLayer = new NativeLayer();

enum TextureUnit {
  FB = 0,
  BUTTON,
}

const button1 = new nat.Texture();
button1.loadFile('public/assets/button-down.png');
const button2 = new nat.Texture();
button2.loadFile('public/assets/button-up.png');

const fbTexture = new nat.Texture();
fbTexture.makeBlank(width, height);

const fb = new nat.Framebuffer();
fb.setOutputTexture(fbTexture.textureId());
fb.unbind();

const programSynth = new nat.Program(shader.vertex, shader.fragmentSynthetic);
nativeLayer.configShaders(programSynth.programId());
nat.glUniform2f(programSynth.getUniformLocation("u_offset"), 0, 0);
nat.glUniform2f(programSynth.getUniformLocation("u_size"), width, height);
nat.glUniform2f(programSynth.getUniformLocation("u_viewport_size"), width, height);

const programTexture = new nat.Program(shader.vertex, shader.fragmentTexture);
nativeLayer.configShaders(programTexture.programId());

const u_sampler = programTexture.getUniformLocation('u_sampler');

const programPost = new nat.Program(shader.vertex, shader.fragPost);
nativeLayer.configShaders(programPost.programId());


while (nativeLayer.pollEvent()) {
  nativeLayer.clear();

  // Draw underlying screen data to framebuffer
  fb.bind();
  programSynth.use();
  nativeLayer.drawTriangles();
  fb.unbind();

  // Draw screen postprocessing
  programTexture.use();
  nat.glUniform2f(programTexture.getUniformLocation("u_offset"), (width - screen_width) / 2, (height - screen_height) / 2);
  nat.glUniform2f(programTexture.getUniformLocation("u_size"), screen_width, screen_height);
  nat.glUniform2f(programTexture.getUniformLocation("u_viewport_size"), width, height);
  nat.glUniform1i(u_sampler, TextureUnit.FB);
  fbTexture.bind(TextureUnit.FB);
  nativeLayer.drawTriangles();

  // Draw power button
  const buttonTexture = (Math.floor(Date.now() / 1000) % 2 == 0) ? button1 : button2;
  programTexture.use();
  nat.glUniform2f(programTexture.getUniformLocation("u_offset"), width - 100, height - 75);
  nat.glUniform2f(programTexture.getUniformLocation("u_size"), 100, 75);
  nat.glUniform2f(programTexture.getUniformLocation("u_viewport_size"), width, height);
  nat.glUniform1i(u_sampler, TextureUnit.BUTTON);
  buttonTexture.bind(TextureUnit.BUTTON);
  nativeLayer.drawTriangles();

  nativeLayer.swapWindow();
}

nativeLayer.finish();
