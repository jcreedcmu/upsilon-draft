#include <iostream>
#include <napi.h>

#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>
#include <SDL2/SDL_opengl_glext.h>

#include "gl-texture.hh"
#include "gl-program.hh"
#include "napi-helpers.hh"
#include "stb_image.h"

class Nonce : public Napi::ObjectWrap<Nonce> {
public:
  Nonce(const Napi::CallbackInfo &info) : ObjectWrap(info) {}
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
  static Napi::Object Init(Napi::Env env, Napi::Object exports);

  // This pattern of statically storing a funcRef to the constructor
  // in the class is cargo-culted from
  // https://github.com/nodejs/node-addon-examples/blob/main/inherits_from_event_emitter/node-addon-api/src/native-emitter.h
  // My goal is to be able to call InstanceOf to check whether I'm
  // being passed the right type of wrapped Napi::Object.
  static Napi::FunctionReference constructor;

private:
  SDL_Window *_window;
  SDL_GLContext _context;
  GLuint _vao, _vbo;
};

Napi::FunctionReference NativeLayer::constructor;

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

  if (info.Length() < 1) {
    throwJs(env,
            "usage: compileShaders(program: number)");
  }

  if (!info[0].IsNumber()) {
    throwJs(env, "argument 0 should be a number");
  }

  unsigned int program = info[0].As<Napi::Number>().Uint32Value();

  glBindAttribLocation(program, attrib_uv, "i_uv");

  glDisable(GL_DEPTH_TEST);
  // #877a6a
  glClearColor(0x87 / 255., 0x7a / 255., 0x6a / 255., 1.);
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

  // Set some uniforms
  glUniform2f(glGetUniformLocation(program, "u_offset"), width - 100,
              height - 75);
  glUniform2f(glGetUniformLocation(program, "u_size"), 100, 75);
  glUniform2f(glGetUniformLocation(program, "u_viewport_size"), width, height);

  // Setup textures
  unsigned int texture;
  glGenTextures(1, &texture);
  glActiveTexture(GL_TEXTURE0);
  glBindTexture(GL_TEXTURE_2D, texture);
  glUniform1i(glGetUniformLocation(program, "u_sampler"), 0);

  int width, height, nrChannels;
  unsigned char *data = stbi_load("public/assets/button-down.png", &width,
                                  &height, &nrChannels, 0);
  if (data) {
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA,
                 GL_UNSIGNED_BYTE, data);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
  }
  else {
    std::cout << "Failed to load texture" << std::endl;
  }
  stbi_image_free(data);

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

Napi::Object NativeLayer::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "NativeLayer",
      {
          NativeLayer::InstanceMethod("finish", &NativeLayer::finish),
          NativeLayer::InstanceMethod("compileShaders",
                                      &NativeLayer::compileShaders),
          NativeLayer::InstanceMethod("pollEvent", &NativeLayer::pollEvent),
          NativeLayer::InstanceMethod("renderFrame", &NativeLayer::renderFrame),
      });

  NativeLayer::constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set(Napi::String::New(env, "NativeLayer"), func);

  return exports;
}

Napi::Value NativeLayer::hello(Napi::Env env) {
  return Napi::String::New(env, "Hello World");
}

// Napi::Value getUniformLocation(const Napi::CallbackInfo &info) {
//   Napi::Env env = info.Env();

//   Napi::Object nl = info[0].As<Napi::Object>();

//   if (nl.InstanceOf(NativeLayer::constructor.Value())) {
//     NativeLayer *nat = Napi::ObjectWrap<NativeLayer>::Unwrap(nl);
//     return nat->hello(env);
//   }
//   else {
//     return throwJs(env, "Argument is not a NativeLayer");
//   }
// }

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  NativeLayer::Init(env, exports);
  GlTexture::Init(env, exports);
  GlProgram::Init(env, exports);
  exports.Set(Napi::String::New(env, "Nonce"), Nonce::GetClass(env));

  //  exports.Set("foo", Napi::Function::New(env, foo));
  return exports;
}

NODE_API_MODULE(native_layer, Init)
