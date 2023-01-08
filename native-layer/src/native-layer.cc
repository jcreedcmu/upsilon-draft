#include <iostream>
#include <napi.h>

#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>
#include <SDL2/SDL_opengl_glext.h>

#include "gl-program.hh"
#include "gl-texture.hh"
#include "gl-framebuffer.hh"
#include "napi-helpers.hh"
#include "vendor/stb_image.h"

typedef enum t_attrib_id { attrib_uv } t_attrib_id;


class NativeLayer : public Napi::ObjectWrap<NativeLayer> {
public:
  NativeLayer(const Napi::CallbackInfo &);
  Napi::Value finish(const Napi::CallbackInfo &);
  Napi::Value configShaders(const Napi::CallbackInfo &);
  Napi::Value pollEvent(const Napi::CallbackInfo &);
  Napi::Value drawTriangles(const Napi::CallbackInfo &);
  Napi::Value clear(const Napi::CallbackInfo &);
  Napi::Value swapWindow(const Napi::CallbackInfo &);

  Napi::Value hello(Napi::Env);
  static Napi::Object Init(Napi::Env env, Napi::Object exports);

  // This pattern of statically storing a funcRef to the constructor
  // in the class is cargo-culted from
  // https://github.com/nodejs/node-addon-examples/blob/main/inherits_from_event_emitter/node-addon-api/src/native-emitter.h
  // My goal is to be able to call InstanceOf to check whether I'm
  // being passed the right type of wrapped Napi::Object.
  static Napi::FunctionReference constructor;

private:
  int _width, _height;
  SDL_Window *_window;
  SDL_GLContext _context;
  GLuint _vao, _vbo;
};

Napi::FunctionReference NativeLayer::constructor;

NativeLayer::NativeLayer(const Napi::CallbackInfo &info) : ObjectWrap(info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    throwJs(env, "usage: NativeLayer(width, height: number)");
  }

  if (!info[0].IsNumber()) {
    throwJs(env, "argument 0 should be a number");
  }

  if (!info[1].IsNumber()) {
    throwJs(env, "argument 1 should be a number");
  }

  this->_width = info[0].As<Napi::Number>().Uint32Value();
  this->_height = info[1].As<Napi::Number>().Uint32Value();

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
                       this->_width, this->_height, SDL_WINDOW_OPENGL | SDL_WINDOW_SHOWN);
  SDL_GLContext context = SDL_GL_CreateContext(window);

  printf("GL VERSION [%s]\n", glGetString(GL_VERSION));

  this->_context = context;
  this->_window = window;
}

Napi::Value NativeLayer::configShaders(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    throwJs(env, "usage: configShaders(program: number)");
  }

  if (!info[0].IsNumber()) {
    throwJs(env, "argument 0 should be a number");
  }

  unsigned int program = info[0].As<Napi::Number>().Uint32Value();

  glBindAttribLocation(program, attrib_uv, "i_uv");

  glDisable(GL_DEPTH_TEST);
  // #877a6a
  glClearColor(0x87 / 255., 0x7a / 255., 0x6a / 255., 1.);
  glViewport(0, 0, this->_width, this->_height);

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

  glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  glEnable(GL_BLEND);

  return env.Null();
}

// Returns true if we should keep going
Napi::Value NativeLayer::pollEvent(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  SDL_Event event;

  while (SDL_PollEvent(&event)) {
    switch (event.type) {
    case SDL_KEYDOWN:
      return Napi::String::New(env, SDL_GetKeyName(event.key.keysym.sym));
      break;
    }
  }
  return env.Null();
}

Napi::Value NativeLayer::clear(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  glClear(GL_COLOR_BUFFER_BIT);

  return env.Null();
}

Napi::Value NativeLayer::drawTriangles(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  glBindVertexArray(this->_vao);
  glDrawArrays(GL_TRIANGLES, 0, 6);

  return env.Null();
}

Napi::Value NativeLayer::swapWindow(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  SDL_GL_SwapWindow(this->_window);
  //  SDL_Delay(1);

  return env.Null();
}

Napi::Value NativeLayer::finish(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  SDL_GL_DeleteContext(this->_context);
  SDL_DestroyWindow(this->_window);
  SDL_Quit();

  return env.Null();
}

Napi::Object NativeLayer::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "NativeLayer",
      {
          NativeLayer::InstanceMethod("finish", &NativeLayer::finish),
          NativeLayer::InstanceMethod("configShaders",
                                      &NativeLayer::configShaders),
          NativeLayer::InstanceMethod("pollEvent", &NativeLayer::pollEvent),
          NativeLayer::InstanceMethod("drawTriangles", &NativeLayer::drawTriangles),
          NativeLayer::InstanceMethod("clear", &NativeLayer::clear),
          NativeLayer::InstanceMethod("swapWindow", &NativeLayer::swapWindow),
      });

  NativeLayer::constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set(Napi::String::New(env, "NativeLayer"), func);

  return exports;
}

Napi::Value NativeLayer::hello(Napi::Env env) {
  return Napi::String::New(env, "Hello World");
}

NFUNC(wrap_glUniform1i) {
  NBOILER();

  if (info.Length() < 2) {
    throwJs(env,
            "usage: glUniform1i(location: number, value: number)");
  }

  if (!info[0].IsNumber()) {
    return throwJs(env, "argument 0 should be a number");
  }

  if (!info[1].IsNumber()) {
    return throwJs(env, "argument 1 should be a number");
  }

  glUniform1i(
              info[0].As<Napi::Number>().Uint32Value(),
              info[1].As<Napi::Number>().Uint32Value()
              );
  return env.Null();
}

NFUNC(wrap_glUniform1f) {
  NBOILER();

  if (info.Length() < 2) {
    throwJs(env,
            "usage: glUniform1f(location: number, value: number)");
  }

  if (!info[0].IsNumber()) {
    return throwJs(env, "argument 0 should be a number");
  }

  if (!info[1].IsNumber()) {
    return throwJs(env, "argument 1 should be a number");
  }

  glUniform1f(
              info[0].As<Napi::Number>().Uint32Value(),
              info[1].As<Napi::Number>().FloatValue()
              );
  return env.Null();
}

NFUNC(wrap_glUniform2f) {
  NBOILER();

  if (info.Length() < 3) {
    throwJs(env,
            "usage: glUniform2f(location: number, value: number, value2: number)");
  }

  if (!info[0].IsNumber()) {
    return throwJs(env, "argument 0 should be a number");
  }

  if (!info[1].IsNumber()) {
    return throwJs(env, "argument 1 should be a number");
  }

  if (!info[2].IsNumber()) {
    return throwJs(env, "argument 2 should be a number");
  }

  glUniform2f(
              info[0].As<Napi::Number>().Uint32Value(),
              info[1].As<Napi::Number>().FloatValue(),
              info[2].As<Napi::Number>().FloatValue()
              );
  return env.Null();
}

NFUNC(wrap_glActiveTexture) {
  NBOILER();

  if (info.Length() < 1) {
    throwJs(env,
            "usage: glActiveTexture(texture_unit: number)");
  }

  if (!info[0].IsNumber()) {
    return throwJs(env, "argument 0 should be a number");
  }

  unsigned int texture_unit = info[0].As<Napi::Number>().Uint32Value();

  glActiveTexture(GL_TEXTURE0 + texture_unit);


  return env.Null();
}

// !!!!!!!!!!!!! BEGIN UNSAFE

// The following functions are unsafe to call directly
// from javascript. They rely on javascript wrapper functions
// in index.js to check argument types.

NFUNC(wrap_glUniform4fv) {
  NBOILER();

  glUniform4fv(
              info[0].As<Napi::Number>().Uint32Value(),
              info[1].As<Napi::Number>().Uint32Value(),
              info[2].As<Napi::TypedArrayOf<float>>().Data()
              );

  return env.Null();
}

NFUNC(wrap_glTexImage2d) {
  NBOILER();

  const unsigned int width = info[0].As<Napi::Number>().Uint32Value();
  const unsigned int height = info[1].As<Napi::Number>().Uint32Value();
  const uint8_t *data = info[2].As<Napi::TypedArrayOf<uint8_t>>().Data();

  glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA,
               GL_UNSIGNED_BYTE, data);

  return env.Null();
}

// !!!!!!!!!!!!! END UNSAFE

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  NativeLayer::Init(env, exports);
  GlTexture::Init(env, exports);
  GlFramebuffer::Init(env, exports);
  GlProgram::Init(env, exports);

  exports.Set("glUniform1i", Napi::Function::New(env, wrap_glUniform1i));
  exports.Set("glUniform1f", Napi::Function::New(env, wrap_glUniform1f));
  exports.Set("glUniform2f", Napi::Function::New(env, wrap_glUniform2f));
  exports.Set("glActiveTexture", Napi::Function::New(env, wrap_glActiveTexture));

  exports.Set("_glUniform4fv", Napi::Function::New(env, wrap_glUniform4fv));
  exports.Set("_glTexImage2d", Napi::Function::New(env, wrap_glTexImage2d));
  return exports;
}

NODE_API_MODULE(native_layer, Init)
