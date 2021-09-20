// temporary workaround while we wait for https://github.com/facebook/jest/issues/9771
const enhancedResolve =  require('enhanced-resolve');
const resolver = require('enhanced-resolve').create.sync({
  // When project is converted to ESM, it should be  ['require', 'node', 'default', 'import']
  conditionNames: ["require", "node", "default", "import", "type"],
  fullySpecified: false,
  extensions: [".js", ".json", ".node", ".ts", ".tsx"]
});


module.exports = function (request, options) {
  const resolver = enhancedResolve.create.sync({
    conditionNames: ['node'].concat(options.conditions ?? []),
    fullySpecified: false,
    extensions: [".js", ".json", ".node", ".ts", ".tsx"]
  })
  request = request.replace(/\.js$/, '');
  return resolver(options.basedir, request);
};
