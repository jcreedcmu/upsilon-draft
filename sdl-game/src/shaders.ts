import { readFileSync } from 'fs';
import * as path from 'path';

export const fragPost = readFileSync(path.join(__dirname, '../../public/assets/fragPost.frag'), 'utf8');
export const vertex = `
#version 300 es
in vec2 i_uv;
out vec2 v_uv;

uniform vec2 u_offset;
uniform vec2 u_size;
uniform vec2 u_viewport_size;

void main() {
  // negating y-coord means (0,0) at top left of screen
  vec2 pos = (i_uv * u_size + u_offset) / u_viewport_size;
  gl_Position = vec4(2. * pos.x - 1., -(2. * pos.y - 1.), 0., 1.);
  v_uv = i_uv;
};
`

export const vertexFlip = `
#version 300 es
in vec2 i_uv;
out vec2 v_uv;

uniform vec2 u_offset;
uniform vec2 u_size;
uniform vec2 u_viewport_size;

void main() {
  vec2 pos = (i_uv * u_size + u_offset) / u_viewport_size;
  gl_Position = vec4(2. * pos.x - 1., 2. * pos.y - 1., 0., 1.);
  v_uv = i_uv;
};
`

export const fragmentTexture = `
#version 300 es

precision mediump float;

uniform sampler2D u_sampler;

in vec2 v_uv;
out vec4 o_color;
void main() {
  o_color = texture(u_sampler, v_uv) ;
};
`;

export const fragmentSynthetic = `
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
