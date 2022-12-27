#include <iostream>
#include <napi.h>

#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>
#include <SDL2/SDL_opengl_glext.h>

#include "gl-utils.hh"

typedef enum t_attrib_id { attrib_position, attrib_color } t_attrib_id;

static const int width = 800;
static const int height = 600;

class NativeLayer : public Napi::ObjectWrap<NativeLayer> {
public:
  NativeLayer(const Napi::CallbackInfo &);
  Napi::Value finish(const Napi::CallbackInfo &);
  Napi::Value compileShaders(const Napi::CallbackInfo &);

  static Napi::Function GetClass(Napi::Env);

private:
  SDL_Window *_window;
  SDL_GLContext _context;
  GLuint _vs, _fs, _program;
};

NativeLayer::NativeLayer(const Napi::CallbackInfo &info) : ObjectWrap(info) {
  SDL_Init(SDL_INIT_VIDEO);
  SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
  SDL_GL_SetAttribute(SDL_GL_ACCELERATED_VISUAL, 1);
  SDL_GL_SetAttribute(SDL_GL_RED_SIZE, 8);
  SDL_GL_SetAttribute(SDL_GL_GREEN_SIZE, 8);
  SDL_GL_SetAttribute(SDL_GL_BLUE_SIZE, 8);
  SDL_GL_SetAttribute(SDL_GL_ALPHA_SIZE, 8);

  SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 3);
  SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 2);
  SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);

  SDL_Window *window =
      SDL_CreateWindow("", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
                       width, height, SDL_WINDOW_OPENGL | SDL_WINDOW_SHOWN);
  SDL_GLContext context = SDL_GL_CreateContext(window);

  printf("GL VERSION [%s]\n", glGetString(GL_VERSION));

  this->_context = context;
  this->_window = window;
}

Napi::Value NativeLayer::compileShaders(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  GLuint vs, fs, program;

  if (info.Length() < 2) {
    Napi::TypeError::New(
        env,
        "usage: compileShaders(vertexShader: string, fragmentShader: string)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsString()) {
    Napi::TypeError::New(env, "argument 0 should be a string")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[1].IsString()) {
    Napi::TypeError::New(env, "argument 1 should be a string")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  // Set up vertex shader
  {
    this->_vs = vs = glCreateShader(GL_VERTEX_SHADER);
    std::string shader = info[0].As<Napi::String>().Utf8Value();
    int length = shader.size();
    const char *cstr = shader.c_str();
    glShaderSource(vs, 1, &cstr, &length);
    glCompileShader(vs);

    GLint status;
    glGetShaderiv(vs, GL_COMPILE_STATUS, &status);
    if (status == GL_FALSE) {
      printShaderLog(vs);
      Napi::TypeError::New(env, "vertex compilation failed")
          .ThrowAsJavaScriptException();
      return env.Null();
    }
  }

  // Set up fragment shader
  {
    this->_fs = fs = glCreateShader(GL_FRAGMENT_SHADER);
    std::string shader = info[1].As<Napi::String>().Utf8Value();
    int length = shader.size();
    const char *cstr = shader.c_str();
    glShaderSource(fs, 1, &cstr, &length);
    glCompileShader(fs);

    GLint status;
    glGetShaderiv(fs, GL_COMPILE_STATUS, &status);
    if (status == GL_FALSE) {
      printShaderLog(fs);
      Napi::TypeError::New(env, "fragment compilation failed")
          .ThrowAsJavaScriptException();
      return env.Null();
    }
  }

  printf("Successfully compiled shaders\n");

  this->_program = program = glCreateProgram();
  glAttachShader(program, vs);
  glAttachShader(program, fs);

  glBindAttribLocation(program, attrib_position, "i_position");
  glBindAttribLocation(program, attrib_color, "i_color");
  glLinkProgram(program);

  glUseProgram(program);

  glDisable(GL_DEPTH_TEST);
  glClearColor(0.5, 0.0, 0.0, 0.0);
  glViewport(0, 0, width, height);

  GLuint vao, vbo;

  glGenVertexArrays(1, &vao);
  glGenBuffers(1, &vbo);
  glBindVertexArray(vao);
  glBindBuffer(GL_ARRAY_BUFFER, vbo);

  glEnableVertexAttribArray(attrib_position);
  glEnableVertexAttribArray(attrib_color);

  glVertexAttribPointer(attrib_color, 4, GL_FLOAT, GL_FALSE, sizeof(float) * 6,
                        0);
  glVertexAttribPointer(attrib_position, 2, GL_FLOAT, GL_FALSE,
                        sizeof(float) * 6, (void *)(4 * sizeof(float)));

  const GLfloat g_vertex_buffer_data[] = {
      /*  R, G, B, A, X, Y  */
      1, 0, 0, 1, 0, 0, 0, 1, 0, 1, width, 0,      0, 0, 1, 1, width, height,

      1, 0, 0, 1, 0, 0, 0, 0, 1, 1, width, height, 1, 1, 1, 1, 0,     height};

  glBufferData(GL_ARRAY_BUFFER, sizeof(g_vertex_buffer_data),
               g_vertex_buffer_data, GL_STATIC_DRAW);

  t_mat4x4 projection_matrix;
  mat4x4_ortho(projection_matrix, 0.0f, (float)width, (float)height, 0.0f, 0.0f,
               100.0f);
  glUniformMatrix4fv(glGetUniformLocation(program, "u_projection_matrix"), 1,
                     GL_FALSE, projection_matrix);

  return env.Null();
}

Napi::Value NativeLayer::finish(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  SDL_GL_DeleteContext(this->_context);
  SDL_DestroyWindow(this->_window);
  SDL_Quit();

  return env.Null();
}

Napi::Function NativeLayer::GetClass(Napi::Env env) {
  return DefineClass(
      env, "NativeLayer",
      {
          NativeLayer::InstanceMethod("finish", &NativeLayer::finish),
          NativeLayer::InstanceMethod("compileShaders",
                                      &NativeLayer::compileShaders),
      });
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "NativeLayer"),
              NativeLayer::GetClass(env));

  return exports;
}

NODE_API_MODULE(native_layer, Init)
