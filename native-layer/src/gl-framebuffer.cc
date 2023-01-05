#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>
#include <SDL2/SDL_opengl_glext.h>

#include "gl-framebuffer.hh"
#include "vendor/stb_image.h"

Napi::FunctionReference GlFramebuffer::constructor;

Napi::Object GlFramebuffer::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "Framebuffer",
      {
          GlFramebuffer::InstanceMethod("framebufferId", &GlFramebuffer::framebufferId),
          GlFramebuffer::InstanceMethod("bind", &GlFramebuffer::bind),
      });

  GlFramebuffer::constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set(Napi::String::New(env, "Framebuffer"), func);

  return exports;
}

GlFramebuffer::GlFramebuffer(const Napi::CallbackInfo &info) : ObjectWrap(info) {
  NBOILER_UNUSED();

  glGenFramebuffers(1, &this->_framebuffer);
  glBindFramebuffer(GL_FRAMEBUFFER, this->_framebuffer);
}

NFUNC(GlFramebuffer::framebufferId) {
  NBOILER();

  return Napi::Number::New(env, this->_framebuffer);
}

NFUNC(GlFramebuffer::bind) {
  NBOILER();

  glBindFramebuffer(GL_FRAMEBUFFER, this->_framebuffer);

  return env.Null();
}
