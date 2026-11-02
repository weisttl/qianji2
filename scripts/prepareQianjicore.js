/** Build the reviewed product backend or use an explicitly supplied product bundle. */

const path = require('path');
const { prepareQianjicore } = require('../packages/shared-scripts/src/prepare-qianjicore.js');
const { resolveQianjicoreVersion } = require('./resolveQianjicoreVersion.js');

const projectRoot = path.resolve(__dirname, '..');
const platform = process.platform;
// Support cross-compilation: QIANJI_BACKEND_ARCH > npm_config_target_arch > process.arch
const arch = process.env.QIANJI_BACKEND_ARCH || process.env.npm_config_target_arch || process.arch;
const version = resolveQianjicoreVersion(projectRoot);

try {
  prepareQianjicore({ projectRoot, platform, arch, version });
} catch (error) {
  console.error('❌ prepareQianjicore failed:', error.message);
  process.exit(1);
}

module.exports = function () {
  try {
    return prepareQianjicore({ projectRoot, platform, arch, version });
  } catch (error) {
    console.error('❌ prepareQianjicore failed:', error.message);
    throw error;
  }
};
