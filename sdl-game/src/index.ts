import * as nat from 'native-layer';
import { NativeLayer } from 'native-layer';

const width = 800;
const height = 600;

const nativeLayer = new NativeLayer();

const vertexShader = `
#version 300 es
in vec2 i_uv;
out vec2 v_uv;

uniform vec2 u_offset;
uniform vec2 u_size;
uniform vec2 u_viewport_size;

void main() {
  // negating y-coord means (0,0) at top left of screen
  vec2 pos = (i_uv * u_size + u_offset) / u_viewport_size;
  gl_Position = vec4(2. * pos.x - 1., - (2. * pos.y - 1.), 0., 1.);
  v_uv = i_uv;
};
`

const fragmentShader = `
#version 300 es

precision mediump float;

uniform sampler2D u_sampler;

in vec2 v_uv;
out vec4 o_color;
void main() {
  o_color = texture(u_sampler, v_uv) ;
};
`;

const fragmentShaderX = `
#version 300 es

precision mediump float;

uniform sampler2D u_sampler;

in vec2 v_uv;
out vec4 o_color;
void main() {
// o_color = (vec4(1., 0., 0., 1.) + texture(u_sampler, v_uv)) / 2. ;
o_color = vec4(v_uv.x, v_uv.y, 1., 1.);
};
`;

const BUTTON_TEXTURE_UNIT = 1;
const button1 = new nat.Texture();
button1.loadFile('public/assets/button-down.png');
const button2 = new nat.Texture();
button2.loadFile('public/assets/button-up.png');

const programX = new nat.Program(vertexShader, fragmentShaderX);
nativeLayer.configShaders(programX.programId());
nat.glUniform2f(programX.getUniformLocation("u_offset"), 0, 0);
nat.glUniform2f(programX.getUniformLocation("u_size"), width, height);
nat.glUniform2f(programX.getUniformLocation("u_viewport_size"), width, height);

const program = new nat.Program(vertexShader, fragmentShader);

nat.glUniform2f(program.getUniformLocation("u_offset"), width - 100, height - 75);
nat.glUniform2f(program.getUniformLocation("u_size"), 100, 75);
nat.glUniform2f(program.getUniformLocation("u_viewport_size"), width, height);

const u_sampler = program.getUniformLocation('u_sampler');
nativeLayer.configShaders(program.programId());
nat.glUniform1i(u_sampler, BUTTON_TEXTURE_UNIT);

while (nativeLayer.pollEvent()) {
  const buttonTexture = (Math.floor(Date.now() / 1000) % 2 == 0) ? button1 : button2;
  if (0) {
    programX.use();
  }
  else {
    program.use();
    buttonTexture.bind(BUTTON_TEXTURE_UNIT);
  }
  nativeLayer.renderFrame();
  nativeLayer.swapWindow();
}

nativeLayer.finish();
