#version 300 es

precision mediump float;
out vec4 outputColor;

const int ROWS = 18;
const int COLS = 48;

uniform sampler2D u_screenTexture;

uniform float u_time;

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

const float freq = 1.0 / 2.0;

vec4 samp(vec2 pos) {
  float offset =  0.5 * sin(6.28 * u_time * freq)  * (int(pos.y) % 3 == 0 ? 1.0 : -1.0);

  vec2 epos = (vec2(pos) + vec2(float(offset), 0)) / windowSize;

  epos = warp(epos, vec2(1.0/50.0,1.0/25.0));


  if (epos.x <= 0.0 || epos.y <= 0.0 || epos.x >= 1.0 || epos.y >= 1.0) {
    return vec4(vec3(0.0), 1.0);
  }
  else {
    return texture(u_screenTexture, epos);
  }

}

void main() {
  vec2 pos = gl_FragCoord.xy;

  outputColor = (samp(pos) + 0.5 * samp(pos + vec2(1.0, 0.0)) + 0.5 * samp(pos + vec2(-1.0, 0.0))) / 1.5;
}
