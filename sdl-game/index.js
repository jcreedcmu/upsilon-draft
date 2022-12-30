const nat = require('native-layer');
const NativeLayer = nat.NativeLayer;

const nativeLayer = new NativeLayer();

const vertexShader = `
#version 300 es
in vec2 i_uv;
out vec2 v_uv;
void main() {
  // negating y-coord means (0,0) at top left of screen
  gl_Position = vec4(2. * i_uv.x - 1., - (2. * i_uv.y - 1.), 0., 1.);
  v_uv = i_uv;
};
`

const fragmentShader = `
#version 300 es

precision mediump float;

in vec2 v_uv;
out vec4 o_color;
void main() {
    o_color = vec4(v_uv.y, (v_uv.x + v_uv.y) / 2., v_uv.x, 1.0);
};
`;

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
