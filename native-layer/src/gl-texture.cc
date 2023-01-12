#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>
#include <SDL2/SDL_opengl_glext.h>

#include "gl-texture.hh"
#include "vendor/stb_image.h"

Napi::FunctionReference GlTexture::constructor;

Napi::Object GlTexture::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "Texture",
      {
          GlTexture::InstanceMethod("textureId", &GlTexture::textureId),
          GlTexture::InstanceMethod("bind", &GlTexture::bind),
          GlTexture::InstanceMethod("loadFile", &GlTexture::loadFile),
          GlTexture::InstanceMethod("makeBlank", &GlTexture::makeBlank),
      });

  GlTexture::constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set(Napi::String::New(env, "Texture"), func);

  return exports;
}

GlTexture::GlTexture(const Napi::CallbackInfo &info) : ObjectWrap(info) {
  glGenTextures(1, &this->_texture);
  glActiveTexture(GL_TEXTURE0);
}

NFUNC(GlTexture::loadFile) {
  NBOILER();

  glBindTexture(GL_TEXTURE_2D, this->_texture);

  // XXX Maybe I should move argument checking into a js wrapper?
  if (info.Length() < 1) {
    throwJs(env, "expected 1 argument");
  }

  if (!info[0].IsString()) {
    throwJs(env, "argument 0 should be a string");
  }

  std::string filename = info[0].As<Napi::String>().Utf8Value();

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
    throwJs(env, "Failed to load texture");
  }
  stbi_image_free(data);

  return env.Null();
}

NFUNC(GlTexture::makeBlank) {
  NBOILER();

  glBindTexture(GL_TEXTURE_2D, this->_texture);

  // XXX Maybe I should move argument checking into a js wrapper?
  if (info.Length() < 2) {
    throwJs(env, "expected 2 arguments");
  }

  if (!info[0].IsNumber()) {
    throwJs(env, "argument 0 should be a number");
  }

  if (!info[1].IsNumber()) {
    throwJs(env, "argument 1 should be a number");
  }

  int width = info[0].As<Napi::Number>().Uint32Value();
  int height = info[1].As<Napi::Number>().Uint32Value();

  glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA,
               GL_UNSIGNED_BYTE, NULL);
  // interpolation settings unnecessarily coupled to the loaded vs.
  // uninitialized texture distinction
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

  return env.Null();
}

NFUNC(GlTexture::textureId) {
  NBOILER();
  return Napi::Number::New(env, this->_texture);
}

NFUNC(GlTexture::bind) {
  NBOILER();

  if (info.Length() < 1) {
    throwJs(env, "usage: bind(texture unit: number)");
  }

  if (!info[0].IsNumber()) {
    return throwJs(env, "argument 0 should be a number");
  }

  glActiveTexture(GL_TEXTURE0 + info[0].As<Napi::Number>().Uint32Value());
  glBindTexture(GL_TEXTURE_2D, this->_texture);

  return env.Null();
}
