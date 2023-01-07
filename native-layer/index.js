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
