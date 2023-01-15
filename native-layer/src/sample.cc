#include "sample.hh"
#include <iostream>

Napi::FunctionReference Sample::constructor;

Napi::Object Sample::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func =
      DefineClass(env, "_Sample",
                  {
                      Sample::InstanceMethod("play", &Sample::play),
                  });

  Sample::constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set(Napi::String::New(env, "_Sample"), func);

  return exports;
}

Sample::Sample(const Napi::CallbackInfo &info) : ObjectWrap(info) {
  NBOILER();

  // We rely on the javascript wrapper for two things:
  // - typechecking arguments to this constructor
  // - keeping a reference to the typed array around so the audio data isn't deallocated

  int16_t *data = info[0].As<Napi::TypedArrayOf<int16_t>>().Data();
  this->buffer = data;

  const unsigned int buf_len = info[1].As<Napi::Number>().Uint32Value();

  this->chunk =
      Mix_QuickLoad_RAW((Uint8 *)this->buffer, buf_len * sizeof(int16_t));
  if (!this->chunk) {
    printf("sound could not be loaded!\n"
           "SDL_Error: %s\n",
           SDL_GetError());
    throwJs(env, "couldn't init sound");
  }
  return;
}

Sample::~Sample() {
  std::cerr << "destructed\n";
  Mix_FreeChunk(this->chunk);
}

NFUNC(Sample::play) {
  NBOILER();

  if (Mix_PlayChannel(-1, this->chunk, 0) == -1) {
    printf("Waves sound could not be played!\n"
           "SDL_Error: %s\n",
           SDL_GetError());
    return throwJs(env, "couldn't play sound");
  }

  return env.Null();
}
