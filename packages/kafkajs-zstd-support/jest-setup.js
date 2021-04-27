delete process.env.NODE_ENV;
require('reflect-metadata');
process.env.NODE_CONFIG_DIR = __dirname + '/tests/config';
delete require.cache['config'];
