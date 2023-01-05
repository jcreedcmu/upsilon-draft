#pragma once

#include <napi.h>

#include "napi-helpers.hh"

class GlTexture : public Napi::ObjectWrap<GlTexture> {
public:
  GlTexture(const Napi::CallbackInfo &info);
  NFUNC(textureId);
  NFUNC(bind);
  NFUNC(loadFile);
  static Napi::Object Init(Napi::Env env, Napi::Object exports);

  static Napi::FunctionReference constructor;

private:
  unsigned int _texture;
};
