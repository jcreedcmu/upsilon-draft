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

const programX = new nat.Program(shader.vertex, shader.fragmentSynthetic);
nativeLayer.configShaders(programX.programId());
nat.glUniform2f(programX.getUniformLocation("u_offset"), 0, 0);
nat.glUniform2f(programX.getUniformLocation("u_size"), width, height);
nat.glUniform2f(programX.getUniformLocation("u_viewport_size"), width, height);

const programTexture = new nat.Program(shader.vertex, shader.fragmentTexture);

nat.glUniform2f(programTexture.getUniformLocation("u_offset"), width - 100, height - 75);
nat.glUniform2f(programTexture.getUniformLocation("u_size"), 100, 75);
nat.glUniform2f(programTexture.getUniformLocation("u_viewport_size"), width, height);

const u_sampler = programTexture.getUniformLocation('u_sampler');
nativeLayer.configShaders(programTexture.programId());
nat.glUniform1i(u_sampler, TextureUnit.BUTTON);

while (nativeLayer.pollEvent()) {
  nativeLayer.clear();

  fb.bind();
  programX.use();
  nativeLayer.drawTriangles();
  fb.unbind();

  const buttonTexture = (Math.floor(Date.now() / 1000) % 2 == 0) ? button1 : button2;
  programTexture.use();
  buttonTexture.bind(TextureUnit.BUTTON);
  nativeLayer.drawTriangles();

  nativeLayer.swapWindow();
}

nativeLayer.finish();
