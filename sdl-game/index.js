const nat = require('native-layer');
const NativeLayer = nat.NativeLayer;

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
//    o_color = vec4(v_uv.y, (v_uv.x + v_uv.y) / 2., v_uv.x, 1.0);
o_color = texture(u_sampler, v_uv) ;
};
`;

const button1 = new nat.Texture('public/assets/button-down.png');
const button2 = new nat.Texture('public/assets/button-up.png');

const program = new nat.Program(vertexShader, fragmentShader);
const u_sampler = program.getUniformLocation('u_sampler');

nativeLayer.configShaders(program.programId());
nat.glUniform1i(u_sampler, 1); // texture UNIT not button.textureId()

while (nativeLayer.pollEvent()) {
  const b = (  Math.floor(Date.now() / 1000) % 2 == 0) ? button1 : button2;
  b.bind(1);
  nativeLayer.renderFrame();
}

nativeLayer.finish();
