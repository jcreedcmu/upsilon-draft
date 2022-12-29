const NativeLayer = require('native-layer').NativeLayer;

const nativeLayer = new NativeLayer();

const vertexShader = `
#version 130
in vec2 i_position;
in vec2 i_uv;

out vec2 v_uv;
uniform mat4 u_projection_matrix;
void main() {
  gl_Position = u_projection_matrix * vec4( i_position, 0.0, 1.0 );

  v_uv = i_uv;
};
`

const fragmentShader = `
#version 130

in vec4 v_color;
in vec2 v_uv;
out vec4 o_color;
void main() {
    o_color = vec4(1.0, v_uv.y, v_uv.x, 1.);
};
`;

nativeLayer.compileShaders(vertexShader, fragmentShader);

while (nativeLayer.renderFrame()) {
}

nativeLayer.finish();
