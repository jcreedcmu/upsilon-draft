#include "hello.hh"

namespace functionexample {

std::string hello() { return "Hello World"; }

Napi::String HelloWrapped(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::String returnValue = Napi::String::New(env, hello());

  return returnValue;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("hello", Napi::Function::New(env, HelloWrapped));

  return exports;
}

} // namespace functionexample
