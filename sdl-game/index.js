const nativeLayer = require('native-layer');
const ObjectWrapDemo = nativeLayer.ObjectWrapDemo;

nativeLayer.init();
console.log(nativeLayer.hello());

const owd = new ObjectWrapDemo('alice');
owd.greet('bob');

setTimeout(() => nativeLayer.finish(), 1000);
