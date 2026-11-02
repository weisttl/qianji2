import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { prepareQianjicore, checkBundleIdentity } = require('../../../packages/shared-scripts/src/prepare-qianjicore');

const manifest = {
  product: 'qianji',
  version: 'v0.2.2',
  sourceSha256: 'reviewed-source',
  platform: 'win32',
  arch: 'x64',
};
describe('product backend bundle input', () => {
  it('rejects a local bundle that lacks the managed runtime resource contract', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'qianji-bundle-'));
    const projectRoot = join(tmp, 'project');
    const bundle = join(tmp, 'bundle');
    mkdirSync(join(projectRoot, 'packages/web-host/assets'), { recursive: true });
    mkdirSync(join(bundle, 'managed-resources'), { recursive: true });
    writeFileSync(join(bundle, 'qianjicore.exe'), '');
    writeFileSync(join(bundle, 'manifest.json'), JSON.stringify(manifest));
    writeFileSync(join(projectRoot, 'packages/web-host/assets/backend.json'), JSON.stringify(manifest));
    const previous = process.env.QIANJI_BACKEND_LOCAL_BUNDLE_DIR;
    process.env.QIANJI_BACKEND_LOCAL_BUNDLE_DIR = bundle;
    try {
      expect(() => prepareQianjicore({ projectRoot, platform: 'win32', arch: 'x64', version: 'v0.2.2' })).toThrow(
        /managed-resources\/manifest\.json/
      );
    } finally {
      if (previous === undefined) delete process.env.QIANJI_BACKEND_LOCAL_BUNDLE_DIR;
      else process.env.QIANJI_BACKEND_LOCAL_BUNDLE_DIR = previous;
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('rejects a renamed binary bundle from an unreviewed source', () => {
    const bundle = mkdtempSync(join(tmpdir(), 'qianji-bundle-'));
    writeFileSync(join(bundle, 'manifest.json'), JSON.stringify({ ...manifest, sourceSha256: 'different-source' }));
    try {
      expect(() => checkBundleIdentity(bundle, manifest, 'win32', 'x64')).toThrow('reviewed backend source');
    } finally {
      rmSync(bundle, { recursive: true, force: true });
    }
  });
});
