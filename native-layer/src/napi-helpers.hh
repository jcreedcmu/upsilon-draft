#pragma once

#define NFUNC(name) Napi::Value name(const Napi::CallbackInfo &info)
#define NBOILER()   Napi::Env env = info.Env()
