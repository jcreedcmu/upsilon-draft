#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>
#include <SDL2/SDL_opengl_glext.h>

#include "gl-program.hh"
#include "stb_image.h"

Napi::FunctionReference GlProgram::constructor;

Napi::Object GlProgram::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func =
      DefineClass(env, "Program",
                  {
                      GlProgram::InstanceMethod("programId", &GlProgram::programId),
                  });

  GlProgram::constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set(Napi::String::New(env, "Program"), func);

  return exports;
}

GlProgram::GlProgram(const Napi::CallbackInfo &info) : ObjectWrap(info) {
  NBOILER();

}

NFUNC(GlProgram::programId) {
  NBOILER();
  return Napi::Number::New(env, this->_program);
}
