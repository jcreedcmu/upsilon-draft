{
  "targets": [{
    "target_name": "native-layer",
    "cflags!": [ "-fno-exceptions" ],
    "cflags_cc!": [ "-fno-exceptions" ],
    "sources": [
      "src/native-layer.cc",
      "src/stb.cc",
      "src/gl-texture.cc",
      "src/gl-framebuffer.cc",
      "src/gl-program.cc",
      "src/sample.cc",
    ],
    'include_dirs': [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    'libraries': [
      '-lSDL2',
      '-lSDL2_mixer',
      '-lGL',
      '-lGLU',
      '-lm'
    ],
    'dependencies': [
      "<!(node -p \"require('node-addon-api').gyp\")"
    ],
    'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS', 'GL_GLEXT_PROTOTYPES' ]
  }]
}
