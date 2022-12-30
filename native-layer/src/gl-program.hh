#pragma once

#include <napi.h>

#include "napi-helpers.hh"

class GlProgram : public Napi::ObjectWrap<GlProgram> {
public:
  GlProgram(const Napi::CallbackInfo &info);
  NFUNC(programId);
  static Napi::Object Init(Napi::Env env, Napi::Object exports);

  static Napi::FunctionReference constructor;

private:
  unsigned int _program, _vs, _fs;
};
