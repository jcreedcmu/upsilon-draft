#version 300 es

precision mediump float;
out vec4 outputColor;

const int ROWS = 18;
const int COLS = 48;

uniform sampler2D u_screenTexture;

const int SCALE = 3; // how big a single pixel is
// How big a glyph is in the font
const ivec2 char_size = ivec2(6, 12);

const vec2 windowSize = vec2(SCALE * COLS * char_size.x, SCALE * ROWS * char_size.y);

vec2 warp(vec2 pos, vec2 amount){
  pos = pos * 2.0 - 1.0;
  pos *= vec2(1.0 + (pos.y * pos.y) * amount.x,
              1.0 + (pos.x * pos.x) * amount.y);
  return pos * 0.51 + 0.5;
}

void main() {
  float offset = int(gl_FragCoord.y) % 3 == 0 ? 0.5 : 0.0;
  vec2 pos = (vec2(gl_FragCoord) + vec2(0.1 + float(offset), 0)) / windowSize;
  pos = warp(pos, vec2(1.0/64.0,1.0/32.0));
  if (pos.x <= 0.0 || pos.y <= 0.0 || pos.x >= 1.0 || pos.y >= 1.0) {
    outputColor = vec4(vec3(0.0), 1.0);
  }
  else {
    outputColor = texture(u_screenTexture, pos);
  }
}
