module.exports = require('bindings')('native-layer');

module.exports.glUniform4fv = function(uniformLoc, values) {
  console.log(values);
}
