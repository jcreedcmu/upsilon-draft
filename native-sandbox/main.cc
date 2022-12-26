#include <iostream>
#include <vector>
#include <SDL2/SDL.h>
#include <GL/glu.h>
#include "shader.hh"



#define WIDTH 1024
#define HEIGHT 768





void checkError(std::string msg) {
  GLenum code;
  code = glGetError();
  if (code) {
    std::cout << msg << "\n";
    const GLubyte* string;
    string = gluErrorString(code);
    fprintf(stderr, "OpenGL error: %s\n", string);


    GLuint glGetDebugMessageLog(GLuint count, GLsizei bufSize,
   GLenum *sources, GLenum *types, GLuint *ids, GLenum *severities,
GLsizei *lengths, GLchar *messageLog);


    exit(1);
  }
}


int main(int argc, char* argv[]) {

  SDL_Init(SDL_INIT_VIDEO);
  SDL_Window *screen = SDL_CreateWindow("Shaders", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, WIDTH, HEIGHT, 0 | SDL_WINDOW_OPENGL);
  SDL_Renderer *rend = SDL_CreateRenderer(screen, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
  SDL_SetRenderDrawColor(rend, 0, 0, 0, 255);
  glViewport(0,0,WIDTH, HEIGHT);


  glEnable(GL_DEBUG_OUTPUT); // debug

  int p = glCreateProgram();
  shader(shader_fragment, GL_FRAGMENT_SHADER, p);
  checkError("a");
  glLinkProgram(p);
  int status;
  glGetProgramiv(p, GL_LINK_STATUS, &status);
  std::cout << "status " << status << "\n";
  checkError("b");
  glUseProgram(p);
  checkError("c");

  int timeLocation = glGetUniformLocation(p, "time");
  int resolution = glGetUniformLocation(p, "resolution");
  glUniform2f(resolution, WIDTH, HEIGHT);

  SDL_Event e;
  for(;;) {
    SDL_PollEvent(&e);
    if (e.type == SDL_QUIT) break;
    float t = SDL_GetTicks() / 500.0;
    glUniform1f(timeLocation, t);
    glRecti(-1,-1,1,1);
    SDL_GL_SwapWindow(screen);
  }
  SDL_DestroyRenderer(rend);
  SDL_DestroyWindow(screen);
  SDL_Quit();

  std::cout << "done.\n";
  return 0;
}
