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
          GlFramebuffer::InstanceMethod("unbind", &GlFramebuffer::unbind),
          GlFramebuffer::InstanceMethod("setOutputTexture", &GlFramebuffer::setOutputTexture),
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

NFUNC(GlFramebuffer::unbind) {
  NBOILER();

  glBindFramebuffer(GL_FRAMEBUFFER, 0);

  return env.Null();
}

NFUNC(GlFramebuffer::setOutputTexture) {
  NBOILER();

  if (info.Length() < 1) {
    throwJs(env, "usage: setOutputTexture(texture: number)");
  }

  if (!info[0].IsNumber()) {
    throwJs(env, "argument 0 should be a number");
  }

  unsigned int texture_id = info[0].As<Napi::Number>().Uint32Value();

  glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, texture_id, 0);

  return env.Null();
}
