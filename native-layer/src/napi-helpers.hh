#pragma once

#include <napi.h>

#define NFUNC(name) Napi::Value name(const Napi::CallbackInfo &info)
#define NBOILER() Napi::Env env = info.Env()
#define NBOILER_UNUSED()

inline Napi::Value throwJs(Napi::Env env, std::string message) {
  Napi::TypeError::New(env, message).ThrowAsJavaScriptException();
  return env.Null();
}
