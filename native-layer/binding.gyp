{
  "targets": [{
    "target_name": "native-layer",
    "cflags!": [ "-fno-exceptions" ],
    "cflags_cc!": [ "-fno-exceptions" ],
    "sources": [
      "src/native-layer.cc",
      "src/stb.cc"
    ],
    'include_dirs': [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    'libraries': [
      '-lSDL2',
      '-lGL',
      '-lGLU'
    ],
    'dependencies': [
      "<!(node -p \"require('node-addon-api').gyp\")"
    ],
    'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS', 'GL_GLEXT_PROTOTYPES' ]
  }]
}
