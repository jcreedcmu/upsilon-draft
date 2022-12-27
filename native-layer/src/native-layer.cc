#include <iostream>
#include <napi.h>

#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>
#include <SDL2/SDL_opengl_glext.h>

#include "gl-utils.hh"

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

  static const int width = 800;
  static const int height = 600;

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
  GLuint vs, fs;


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
