#include <SDL2/SDL_opengles2_gl2platform.h>
#include <SDL2/SDL_opengl_glext.h>
#include <SDL2/SDL_opengl.h>
#include <SDL2/SDL_opengles2_gl2.h>

char *shader_fragment[] = {
  "uniform float time;",
  "uniform vec2 resolution;",
  " main() {",
  "    vec2 uv = gl_FragCoord.xy/resolution.xy;",
  "    vec3 col = 0.5 + 0.5*cos(time+uv.xyx+vec3(0,2,4));",
  "    gl_FragColor = vec4(col,1.0);",
  "}"
};

void shader(char **src, int type, int program) {
  int shader = glCreateShader(type);
  glShaderSource(shader, 1, src, 0);
  glCompileShader(shader);
  glAttachShader(program, shader);
}
