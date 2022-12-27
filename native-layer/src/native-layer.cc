#include <napi.h>

#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>

class NativeLayer : public Napi::ObjectWrap<NativeLayer> {
public:
  NativeLayer(const Napi::CallbackInfo &);
  Napi::Value finish(const Napi::CallbackInfo &);

  static Napi::Function GetClass(Napi::Env);

private:
  SDL_Window *_window;
  SDL_GLContext _context;
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
  this->_context = SDL_GL_CreateContext(window);

  this->_window = window;
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
      });
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "NativeLayer"),
              NativeLayer::GetClass(env));

  return exports;
}

NODE_API_MODULE(native_layer, Init)
