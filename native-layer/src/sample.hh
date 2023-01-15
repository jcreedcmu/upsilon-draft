#pragma once

#include <SDL2/SDL.h>
#include <SDL2/SDL_mixer.h>

#include "napi-helpers.hh"
#include <napi.h>

class Sample : public Napi::ObjectWrap<Sample> {
public:
  Sample(const Napi::CallbackInfo &info);
  ~Sample();

  NFUNC(play);
  static Napi::Object Init(Napi::Env env, Napi::Object exports);

  static Napi::FunctionReference constructor;

private:
  short *buffer;
  Mix_Chunk *chunk;
};
