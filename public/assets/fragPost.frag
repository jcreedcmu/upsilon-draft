#version 300 es

precision mediump float;
in vec2 v_uv; // range is [0,1] x [0,1]
out vec4 outputColor;

uniform sampler2D u_screenTexture;

uniform float u_time;

uniform float u_beamScale; // When u_beamScale is 1.0, show normal
                           // size. When small positive, draw small
                           // image. Don't let it be zero or else we
                           // divide by zero.
uniform float u_fade; // When u_fade is 1.0, show standard brightness.
                      // When 0.0, paint black.

uniform vec2 windowSize;

vec2 warp(vec2 pos, vec2 amount){
  pos = pos * 2.0 - 1.0;
  pos *= vec2(1.0 + (pos.y * pos.y) * amount.x,
              1.0 + (pos.x * pos.x) * amount.y);
  return pos * 0.51 / u_beamScale + 0.5;
}

const float freq = 1.0 / 2.0;

vec4 samp(vec2 pos) {


  vec2 epos = (vec2(pos) ) / windowSize;

  epos = warp(epos, vec2(1.0/40.0, 1.0/30.0));

  float offset =  0.5 * sin(6.28 * u_time * freq)  * (int (epos.y * 648.0) % 3 < 1  ? 1.0 : -1.0);

  float darken = 0.9;

  if (mod(epos.y + u_time / 25., 1./3.) < 1./150.) {
    darken = 1.0;
  }

  epos.x += offset / 900.0;

  if (epos.x <= 0.0 || epos.y <= 0.0 || epos.x >= 1.0 || epos.y >= 1.0) {
    return vec4(vec3(0.0), 1.0);
  }
  else {
    return vec4(vec3(darken), 1.0) * texture(u_screenTexture, epos);
  }
}

void main() {
  vec2 pos = v_uv * windowSize;
  vec4 fade = vec4(vec3(u_fade / 1.8), 1.0);
  outputColor = fade * (samp(pos) + 0.5 * samp(pos + vec2(1.0, 0.1)) + 0.5 * samp(pos + vec2(-1.0, 0.1))) ;
}
