#include "gl-texture.hh"

Napi::FunctionReference GlTexture::constructor;

Napi::Object GlTexture::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func =
      DefineClass(env, "Texture",
                  {
                      GlTexture::InstanceMethod("load", &GlTexture::load),
                      GlTexture::InstanceMethod("bind", &GlTexture::bind),
                  });

  GlTexture::constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set(Napi::String::New(env, "Texture"), func);

  return exports;
}

GlTexture::GlTexture(const Napi::CallbackInfo &info) : ObjectWrap(info) {}
NFUNC(GlTexture::load) { NBOILER(); return env.Null(); }
NFUNC(GlTexture::bind) { NBOILER(); return env.Null(); }
