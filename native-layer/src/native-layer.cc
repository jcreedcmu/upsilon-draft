#include <napi.h>

#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>

Napi::Value initGame(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  SDL_Init(SDL_INIT_VIDEO);
  return env.Null();
}

Napi::Value finishGame(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  SDL_Quit();
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
