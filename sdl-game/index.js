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

const button = new nat.Texture('public/assets/button-up.png');

nativeLayer.compileShaders(vertexShader, fragmentShader);

while (nativeLayer.pollEvent()) {
  nativeLayer.renderFrame();
}

nativeLayer.finish();

const nonce = new nat.Nonce();

console.log(nat.foo(nativeLayer));

try {
  console.log(nat.foo(nonce));
}
catch (e) {
  console.log(`[${e}]`);
}
