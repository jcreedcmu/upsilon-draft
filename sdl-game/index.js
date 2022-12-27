const NativeLayer = require('native-layer').NativeLayer;

const nativeLayer = new NativeLayer();

setTimeout(() => {
  nativeLayer.finish();
}, 1000);
