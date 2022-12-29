#include <iostream>
#include <napi.h>

#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>
#include <SDL2/SDL_opengl_glext.h>

#include "gl-utils.hh"

class Nonce : public Napi::ObjectWrap<Nonce> {
public:
  Nonce(const Napi::CallbackInfo &info): ObjectWrap(info) {

  }
  Napi::Value hello(Napi::Env env) {
    return Napi::String::New(env, "Hello World from Nonce");
  }

  static Napi::Function GetClass(Napi::Env env) {
    return DefineClass(env, "Nonce", {});
  }

private:
};

typedef enum t_attrib_id { attrib_uv } t_attrib_id;

static const int width = 800;
static const int height = 600;

class NativeLayer : public Napi::ObjectWrap<NativeLayer> {
public:
  NativeLayer(const Napi::CallbackInfo &);
  Napi::Value finish(const Napi::CallbackInfo &);
  Napi::Value compileShaders(const Napi::CallbackInfo &);
  Napi::Value pollEvent(const Napi::CallbackInfo &);
  Napi::Value renderFrame(const Napi::CallbackInfo &);

  Napi::Value hello(Napi::Env);

  static Napi::Function GetClass(Napi::Env);

private:
  SDL_Window *_window;
  SDL_GLContext _context;
  GLuint _vs, _fs, _program;
  GLuint _vao, _vbo;
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

  glBindAttribLocation(program, attrib_uv, "i_uv");
  glLinkProgram(program);
  glUseProgram(program);

  glDisable(GL_DEPTH_TEST);
  glClearColor(0.5, 0.0, 0.0, 0.0);
  glViewport(0, 0, width, height);

  glGenVertexArrays(1, &this->_vao);
  glGenBuffers(1, &this->_vbo);
  glBindVertexArray(this->_vao);
  glBindBuffer(GL_ARRAY_BUFFER, this->_vbo);

  glEnableVertexAttribArray(attrib_uv);

  glVertexAttribPointer(attrib_uv, 2, GL_FLOAT, GL_FALSE, sizeof(float) * 2,
                        (void *)(0 * sizeof(float)));

  // comments prevent clang-format from wrapping while preserving
  // alignment
  const GLfloat g_vertex_buffer_data[] = {
      0, 0, //
      1, 0, //
      1, 1, //
      0, 0, //
      1, 1, //
      0, 1  //
  };

  glBufferData(GL_ARRAY_BUFFER, sizeof(g_vertex_buffer_data),
               g_vertex_buffer_data, GL_STATIC_DRAW);

  t_mat4x4 projection_matrix;
  mat4x4_ortho(projection_matrix, 0.0f, (float)width, (float)height, 0.0f, 0.0f,
               100.0f);
  glUniformMatrix4fv(glGetUniformLocation(program, "u_projection_matrix"), 1,
                     GL_FALSE, projection_matrix);

  return env.Null();
}

// Returns true if we should keep going
Napi::Value NativeLayer::pollEvent(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  SDL_Event event;

  while (SDL_PollEvent(&event)) {
    switch (event.type) {
    case SDL_KEYUP:
      if (event.key.keysym.sym == SDLK_ESCAPE || event.key.keysym.sym == SDLK_q)
        return Napi::Boolean::New(env, false);
      break;
    }
  }
  return Napi::Boolean::New(env, true);
}

Napi::Value NativeLayer::renderFrame(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  glClear(GL_COLOR_BUFFER_BIT);

  glBindVertexArray(this->_vao);
  glDrawArrays(GL_TRIANGLES, 0, 6);

  SDL_GL_SwapWindow(this->_window);
  SDL_Delay(1);
  return Napi::Boolean::New(env, true);
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
          NativeLayer::InstanceMethod("pollEvent", &NativeLayer::pollEvent),
          NativeLayer::InstanceMethod("renderFrame", &NativeLayer::renderFrame),
      });
}

Napi::Value NativeLayer::hello(Napi::Env env) {
  return Napi::String::New(env, "Hello World");
}

Napi::Value foo(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  Napi::Object nl = info[0].As<Napi::Object>();
  NativeLayer *nat = Napi::ObjectWrap<NativeLayer>::Unwrap(nl);

  return nat->hello(env);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "NativeLayer"),
              NativeLayer::GetClass(env));
  exports.Set(Napi::String::New(env, "Nonce"),
              Nonce::GetClass(env));

  exports.Set("foo", Napi::Function::New(env, foo));
  return exports;
}

NODE_API_MODULE(native_layer, Init)
