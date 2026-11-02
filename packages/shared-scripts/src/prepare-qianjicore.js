/** Build the product backend from the reviewed source snapshot; never download a public product binary. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const tar = require('tar');
const { verifyBundledQianjicoreResources } = require('./verify-bundled-qianjicore-resources');

function verifyPreparedQianjicoreBundle(projectRoot, platform, arch) {
  const result = verifyBundledQianjicoreResources({
    resourcesDir: path.join(projectRoot, 'resources'),
    electronPlatformName: platform,
    targetArch: arch,
  });
  if (result.missing.length || result.failures.length) {
    throw new Error(`Prepared qianjicore bundle is incomplete: ${result.missing.join(', ')}`);
  }
  return result;
}

function readProductManifest(projectRoot) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, 'packages/web-host/assets/backend.json'), 'utf8'));
}

function checkBundleIdentity(bundle, manifest, platform, arch) {
  const filename = path.join(bundle, 'manifest.json');
  if (!fs.existsSync(filename)) throw new Error('Product bundle is missing manifest.json');
  const actual = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (
    actual.product !== 'qianji' ||
    actual.sourceSha256 !== manifest.sourceSha256 ||
    actual.platform !== platform ||
    actual.arch !== arch
  ) {
    throw new Error('Product bundle identity does not match the reviewed backend source');
  }
}

function buildProductBackend(projectRoot, manifest) {
  const archive = path.join(projectRoot, 'packages/web-host/assets/qianjicore-source.tar.gz');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
  if (hash !== manifest.sourceSha256) throw new Error('Backend source checksum mismatch');
  const cache = process.env.QIANJI_BACKEND_BUILD_DIR || path.join(os.homedir(), '.cache', 'qianji', 'backend', hash);
  const marker = path.join(cache, '.complete');
  if (!fs.existsSync(marker)) {
    fs.mkdirSync(cache, { recursive: true });
    tar.x({ file: archive, cwd: cache, sync: true, strict: true });
    fs.writeFileSync(marker, hash);
  }
  execFileSync('cargo', [`+${manifest.toolchain}`, 'build', '--locked', '-p', 'qianji-app'], {
    cwd: cache,
    stdio: 'inherit',
    env: {
      ...process.env,
      CARGO_PROFILE_DEV_DEBUG: '0',
      CARGO_PROFILE_DEV_STRIP: 'debuginfo',
      CARGO_PROFILE_DEV_INCREMENTAL: 'false',
    },
  });
  return path.join(cache, 'target/debug', process.platform === 'win32' ? 'qianjicore.exe' : 'qianjicore');
}

function prepareQianjicore({ projectRoot, platform, arch, version }) {
  const manifest = readProductManifest(projectRoot);
  if (version && version.replace(/^v/, '') !== manifest.version.replace(/^v/, '')) {
    throw new Error(`Backend version ${version} is not the reviewed product version ${manifest.version}`);
  }
  const target = path.join(projectRoot, 'resources/bundled-qianjicore', `${platform}-${arch}`);
  const binaryName = platform === 'win32' ? 'qianjicore.exe' : 'qianjicore';
  const localBundle = process.env.QIANJI_BACKEND_LOCAL_BUNDLE_DIR;
  if (localBundle) {
    checkBundleIdentity(localBundle, manifest, platform, arch);
    if (path.resolve(localBundle) !== path.resolve(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      fs.cpSync(localBundle, target, { recursive: true });
    }
    verifyPreparedQianjicoreBundle(projectRoot, platform, arch);
    return { prepared: true, dir: target, sourceType: 'local-bundle' };
  }
  if (fs.existsSync(path.join(target, 'manifest.json'))) {
    try {
      checkBundleIdentity(target, manifest, platform, arch);
      const verification = verifyBundledQianjicoreResources({
        resourcesDir: path.join(projectRoot, 'resources'),
        electronPlatformName: platform,
        targetArch: arch,
      });
      if (!verification.missing.length && !verification.failures.length)
        return { prepared: true, dir: target, sourceType: 'product-source' };
    } catch {
      console.info('Rebuilding the generated backend bundle for the reviewed product source');
    }
  }
  if (platform !== process.platform || arch !== process.arch) {
    throw new Error('Build the product backend on its target platform or supply QIANJI_BACKEND_LOCAL_BUNDLE_DIR');
  }
  const binary = process.env.QIANJI_BACKEND_LOCAL_BINARY || buildProductBackend(projectRoot, manifest);
  const reported = execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim();
  if (!reported.startsWith(`qianjicore ${manifest.version.replace(/^v/, '')}`))
    throw new Error('Local backend does not identify as the reviewed qianjicore version');
  fs.mkdirSync(target, { recursive: true });
  const stagedBinary = path.join(target, `${binaryName}.next`);
  fs.copyFileSync(binary, stagedBinary);
  if (platform !== 'win32') fs.chmodSync(stagedBinary, 0o755);
  fs.renameSync(stagedBinary, path.join(target, binaryName));
  const dataDir = path.join(target, '.prepare-data');
  try {
    execFileSync(
      path.join(target, binaryName),
      ['--data-dir', dataDir, 'prepare-managed-resources', '--bundle-out', path.join(target, 'managed-resources')],
      {
        stdio: 'inherit',
        env: { ...process.env, QIANJI_BUNDLED_MANAGED_RESOURCES: '' },
      }
    );
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  fs.writeFileSync(
    path.join(target, 'manifest.json'),
    JSON.stringify(
      {
        product: 'qianji',
        platform,
        arch,
        version: manifest.version,
        sourceSha256: manifest.sourceSha256,
        sourceType: 'product-source',
        generatedAt: new Date().toISOString(),
        files: [binaryName, 'managed-resources/'],
      },
      null,
      2
    ) + '\n'
  );
  verifyPreparedQianjicoreBundle(projectRoot, platform, arch);
  return { prepared: true, dir: target, sourceType: 'product-source' };
}

module.exports = { prepareQianjicore, verifyPreparedQianjicoreBundle, buildProductBackend, checkBundleIdentity };
