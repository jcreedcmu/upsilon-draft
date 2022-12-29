const NativeLayer = require('native-layer').NativeLayer;

const nativeLayer = new NativeLayer();

const vertexShader = `
#version 130
in vec2 i_position;

out vec4 v_color;
uniform mat4 u_projection_matrix;
void main() {
    gl_Position = u_projection_matrix * vec4( i_position, 0.0, 1.0 );

    v_color = vec4(i_position.x / 800.,i_position.y / 600.,1.,1.);

};
`

const fragmentShader = `
#version 130

in vec4 v_color;
out vec4 o_color;
void main() {
    o_color = v_color;
};
`;

nativeLayer.compileShaders(vertexShader, fragmentShader);

while (nativeLayer.renderFrame()) {
}

nativeLayer.finish();
