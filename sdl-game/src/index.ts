import * as nat from 'native-layer';
import { NativeLayer } from 'native-layer';
import * as shader from './shaders';

const width = 800;
const height = 600;

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

const programX = new nat.Program(shader.vertex, shader.fragmentX);
nativeLayer.configShaders(programX.programId());
nat.glUniform2f(programX.getUniformLocation("u_offset"), 0, 0);
nat.glUniform2f(programX.getUniformLocation("u_size"), width, height);
nat.glUniform2f(programX.getUniformLocation("u_viewport_size"), width, height);

const program = new nat.Program(shader.vertex, shader.fragment);

nat.glUniform2f(program.getUniformLocation("u_offset"), width - 100, height - 75);
nat.glUniform2f(program.getUniformLocation("u_size"), 100, 75);
nat.glUniform2f(program.getUniformLocation("u_viewport_size"), width, height);

const u_sampler = program.getUniformLocation('u_sampler');
nativeLayer.configShaders(program.programId());
nat.glUniform1i(u_sampler, TextureUnit.BUTTON);

while (nativeLayer.pollEvent()) {
  const buttonTexture = (Math.floor(Date.now() / 1000) % 2 == 0) ? button1 : button2;
  fb.bind();
  programX.use();
  nativeLayer.renderFrame();

  fb.unbind();
  program.use();
  if (0) {
    buttonTexture.bind(TextureUnit.BUTTON);
  }
  else {
    fbTexture.bind(TextureUnit.BUTTON);
  }
  nativeLayer.renderFrame();

  nativeLayer.swapWindow();
}

nativeLayer.finish();
