const bindings = require('bindings')('native-layer');

module.exports = bindings;

module.exports.glUniform4fv = function(uniformLoc, values) {
  if (typeof uniformLoc !== 'number') {
    throw new TypeError('argument 0 to glUniform4fv (uniformLoc) should be a number');
  }
  if (!(values instanceof Array)) {
    throw new TypeError('argument 1 to glUniform4fv (values) should be an array');
  }
  bindings._glUniform4fv(uniformLoc, values.length, new Float32Array(values));
}

module.exports.glTexImage2d = function(width, height, data) {
  if (typeof width !== 'number') {
    throw new TypeError('argument 0 to glTexImage2d (width) should be a number');
  }
  if (typeof height !== 'number') {
    throw new TypeError('argument 1 to glTexImage2d (height) should be an array');
  }
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('argument 2 to glTexImage2d (values) should be a Uint8array');
  }
  bindings._glTexImage2d(width, height, data);
}

module.exports.Sample = function(buffer) {
  if (!(buffer instanceof Int16Array)) {
    throw new TypeError('argument 0 to Sample constructor (buffer) should be an Int16array');
  }
  this._sample = new bindings._Sample(buffer, buffer.length);
  this._buffer = buffer;
}

module.exports.Sample.prototype.play = function() {
  this._sample.play();
}
