#include <napi.h>

#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>

class ObjectWrapDemo : public Napi::ObjectWrap<ObjectWrapDemo> {
 public:
  ObjectWrapDemo(const Napi::CallbackInfo&);
  Napi::Value Greet(const Napi::CallbackInfo&);

  static Napi::Function GetClass(Napi::Env);

 private:
  std::string _greeterName;
};

ObjectWrapDemo::ObjectWrapDemo(const Napi::CallbackInfo& info)
    : ObjectWrap(info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return;
  }

  if (!info[0].IsString()) {
    Napi::TypeError::New(env, "You need to name yourself")
        .ThrowAsJavaScriptException();
    return;
  }

  this->_greeterName = info[0].As<Napi::String>().Utf8Value();
}

Napi::Value ObjectWrapDemo::Greet(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsString()) {
    Napi::TypeError::New(env, "You need to introduce yourself to greet")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::String name = info[0].As<Napi::String>();

  printf("Hello %s\n", name.Utf8Value().c_str());
  printf("I am %s\n", this->_greeterName.c_str());

  return Napi::String::New(env, this->_greeterName);
}

Napi::Function ObjectWrapDemo::GetClass(Napi::Env env) {
  return DefineClass(
      env,
      "ObjectWrapDemo",
      {
          ObjectWrapDemo::InstanceMethod("greet", &ObjectWrapDemo::Greet),
      });
}

class NativeLayer {
private:
  SDL_Window *window;
  SDL_GLContext context;

public:
  NativeLayer() {
    SDL_Init(SDL_INIT_VIDEO);
    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
    SDL_GL_SetAttribute(SDL_GL_ACCELERATED_VISUAL, 1);
    SDL_GL_SetAttribute(SDL_GL_RED_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_GREEN_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_BLUE_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_ALPHA_SIZE, 8);

    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 3);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 2);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK,
                        SDL_GL_CONTEXT_PROFILE_CORE);

    static const int width = 800;
    static const int height = 600;

    this->window =
        SDL_CreateWindow("", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
                         width, height, SDL_WINDOW_OPENGL | SDL_WINDOW_SHOWN);
    this->context = SDL_GL_CreateContext(window);
  }

  void finish() {
    SDL_GL_DeleteContext(this->context);
    SDL_DestroyWindow(this->window);
    SDL_Quit();
  }
};

NativeLayer *nativeLayer = nullptr;

Napi::Value initGame(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  nativeLayer = new NativeLayer();
  return env.Null();
}

Napi::Value finishGame(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  nativeLayer->finish();
  return env.Null();
}

Napi::String Hello(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::String returnValue = Napi::String::New(env, "Hello World!\n");

  return returnValue;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("hello", Napi::Function::New(env, Hello));
  exports.Set("init", Napi::Function::New(env, initGame));
  exports.Set("finish", Napi::Function::New(env, finishGame));

  exports.Set(Napi::String::New(env, "ObjectWrapDemo"), ObjectWrapDemo::GetClass(env));

  return exports;
}

NODE_API_MODULE(native_layer, Init)
