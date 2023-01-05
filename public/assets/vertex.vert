#version 300 es

in vec3 pos;
out vec2 v_uv;
void main() {
  gl_Position = vec4(pos, 1.0);
  v_uv = (pos.xy + 1.) / 2.;
}
