#pragma once

#include <napi.h>

#include "napi-helpers.hh"

class GlFramebuffer : public Napi::ObjectWrap<GlFramebuffer> {
public:
  GlFramebuffer(const Napi::CallbackInfo &info);
  NFUNC(framebufferId);
  NFUNC(bind);
  NFUNC(unbind);
  NFUNC(setOutputTexture);
  static Napi::Object Init(Napi::Env env, Napi::Object exports);

  static Napi::FunctionReference constructor;

private:
  unsigned int _framebuffer;
};
