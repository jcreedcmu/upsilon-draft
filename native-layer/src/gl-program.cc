#include <SDL2/SDL.h>
#include <SDL2/SDL_opengl.h>
#include <SDL2/SDL_opengl_glext.h>

#include "gl-program.hh"
#include "gl-utils.hh"

Napi::FunctionReference GlProgram::constructor;

Napi::Object GlProgram::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(
      env, "Program",
      {
          GlProgram::InstanceMethod("programId", &GlProgram::programId),
          GlProgram::InstanceMethod("getUniformLocation",
                                    &GlProgram::getUniformLocation),
          GlProgram::InstanceMethod("use", &GlProgram::use),
      });

  GlProgram::constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set(Napi::String::New(env, "Program"), func);

  return exports;
}

GlProgram::GlProgram(const Napi::CallbackInfo &info) : ObjectWrap(info) {
  NBOILER();

  GLuint vs, fs, program;

  if (info.Length() < 2) {
    throwJs(env,
            "usage: GlProgram(vertexShader: string, fragmentShader: string)");
  }

  if (!info[0].IsString()) {
    throwJs(env, "argument 0 should be a string");
  }

  if (!info[1].IsString()) {
    throwJs(env, "argument 1 should be a string");
  }

  // Set up vertex shader
  {
    this->_vs = vs = glCreateShader(GL_VERTEX_SHADER);
    std::string shader = info[0].As<Napi::String>().Utf8Value();
    int length = shader.size();
    const char *cstr = shader.c_str();
    glShaderSource(vs, 1, &cstr, &length);
    glCompileShader(vs);

    GLint status;
    glGetShaderiv(vs, GL_COMPILE_STATUS, &status);
    if (status == GL_FALSE) {
      printShaderLog(vs);
      throwJs(env, "vertex compilation failed");
    }
  }

  // Set up fragment shader
  {
    this->_fs = fs = glCreateShader(GL_FRAGMENT_SHADER);
    std::string shader = info[1].As<Napi::String>().Utf8Value();
    int length = shader.size();
    const char *cstr = shader.c_str();
    glShaderSource(fs, 1, &cstr, &length);
    glCompileShader(fs);

    GLint status;
    glGetShaderiv(fs, GL_COMPILE_STATUS, &status);
    if (status == GL_FALSE) {
      printShaderLog(fs);
      throwJs(env, "fragment compilation failed");
    }
  }

  printf("Successfully compiled shaders\n");

  this->_program = program = glCreateProgram();
  glAttachShader(program, vs);
  glAttachShader(program, fs);

  glLinkProgram(program);
  glUseProgram(program);
}

NFUNC(GlProgram::programId) {
  NBOILER();
  return Napi::Number::New(env, this->_program);
}

NFUNC(GlProgram::getUniformLocation) {
  NBOILER();

  if (info.Length() < 1) {
    throwJs(env, "usage: getUniformLocation(name: string)");
  }

  if (!info[0].IsString()) {
    return throwJs(env, "argument 0 should be a string");
  }

  std::string name = info[0].As<Napi::String>().Utf8Value();
  unsigned int loc = glGetUniformLocation(this->_program, name.c_str());

  return Napi::Number::New(env, loc);
}

NFUNC(GlProgram::use) {
  NBOILER();

  glUseProgram(this->_program);

  return env.Null();
}
