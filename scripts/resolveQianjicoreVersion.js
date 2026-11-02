/**
 * Resolve the qianjicore version tag to build for packaging.
 *
 * Order:
 *   1. QIANJI_BACKEND_VERSION env (ad-hoc override, e.g. CI dispatch input)
 *   2. "qianjicoreVersion" field in repo-root package.json (the pin)
 *   3. Fail when no reviewed version is configured.
 *
 * Keep this file tiny and dependency-free — it's required from both
 * scripts/prepareQianjicore.js and scripts/pack-web-cli.js before
 * any project-level install has necessarily completed.
 */

const fs = require('fs');
const path = require('path');

function resolveQianjicoreVersion(projectRoot) {
  const envOverride = process.env.QIANJI_BACKEND_VERSION;
  if (envOverride && envOverride.trim()) {
    return envOverride.trim();
  }

  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg && typeof pkg.qianjicoreVersion === 'string' && pkg.qianjicoreVersion.trim()) {
      return pkg.qianjicoreVersion.trim();
    }
  } catch {
    // fall through
  }

  throw new Error('A reviewed qianjicoreVersion is required');
}

module.exports = { resolveQianjicoreVersion };
