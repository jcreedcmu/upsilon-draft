const NativeLayer = require('native-layer').NativeLayer;

const nativeLayer = new NativeLayer();

const vertexShader = `
#version 130
in vec2 i_uv;
out vec2 v_uv;
void main() {
  // negating y-coord means (0,0) at top left of screen
  gl_Position = vec4(2. * i_uv.x - 1., - (2. * i_uv.y - 1.), 0., 1.);
  v_uv = i_uv;
};
`

const fragmentShader = `
#version 130

in vec2 v_uv;
out vec4 o_color;
void main() {
    o_color = vec4(v_uv.y, (v_uv.x + v_uv.y) / 2., v_uv.x, 1.0);
};
`;

nativeLayer.compileShaders(vertexShader, fragmentShader);

while (nativeLayer.renderFrame()) {
}

nativeLayer.finish();
