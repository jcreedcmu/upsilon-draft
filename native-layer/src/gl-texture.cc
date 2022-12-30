#include "gl-texture.hh"
#include "stb_image.h"

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
NFUNC(GlTexture::load) {
  NBOILER();

  int width, height, nrChannels;
  unsigned char *data = stbi_load("public/assets/button-down.png", &width,
                                  &height, &nrChannels, 0);
  if (data) {
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA,
                 GL_UNSIGNED_BYTE, data);
    glGenerateMipmap(GL_TEXTURE_2D);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
  }
  else {
    std::cout << "Failed to load texture" << std::endl;
  }

  return env.Null();
}
NFUNC(GlTexture::bind) { NBOILER(); return env.Null(); }
