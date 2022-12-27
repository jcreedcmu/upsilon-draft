const nativeLayer = require('native-layer');

nativeLayer.init();
console.log(nativeLayer.hello());
setTimeout(() => nativeLayer.finish(), 1000);
