#include <napi.h>

#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>

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

  return exports;
}

NODE_API_MODULE(native_layer, Init)
