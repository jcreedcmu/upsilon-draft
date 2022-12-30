#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>
#include <SDL2/SDL_opengl_glext.h>

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

GlTexture::GlTexture(const Napi::CallbackInfo &info) : ObjectWrap(info) {
  glGenTextures(1, &this->_texture);
}

NFUNC(GlTexture::load) {
  NBOILER();

  // XXX Maybe I should move argument checking into a js wrapper?
  if (info.Length() < 1) {
    return throwJs(env, "expected 1 argument");
  }

  if (!info[0].IsString()) {
    return throwJs(env, "argument 0 should be a string");
  }

  std::string filename = info[0].As<Napi::String>().Utf8Value();

  glBindTexture(GL_TEXTURE_2D, this->_texture);

  int width, height, nrChannels;
  unsigned char *data =
      stbi_load(filename.c_str(), &width, &height, &nrChannels, 0);
  if (data) {
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA,
                 GL_UNSIGNED_BYTE, data);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
  }
  else {
    return throwJs(env, "Failed to load texture");
  }

  return env.Null();
}

NFUNC(GlTexture::bind) {
  NBOILER();
  return env.Null();
}
