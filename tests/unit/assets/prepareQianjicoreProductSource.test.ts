import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { buildProductBackend, prepareQianjicore } = require('../../../packages/shared-scripts/src/prepare-qianjicore');

describe('product backend source preparation', () => {
  it('rejects altered source before executing any compiler', () => {
    const root = mkdtempSync(join(tmpdir(), 'qianji-source-'));
    const assets = join(root, 'packages/web-host/assets');
    mkdirSync(assets, { recursive: true });
    writeFileSync(join(assets, 'qianjicore-source.tar.gz'), 'altered source');
    try {
      expect(() => buildProductBackend(root, { sourceSha256: 'reviewed-source' })).toThrow('checksum mismatch');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects unreviewed version requests instead of downloading a public release', () => {
    const root = mkdtempSync(join(tmpdir(), 'qianji-source-'));
    const assets = join(root, 'packages/web-host/assets');
    mkdirSync(assets, { recursive: true });
    writeFileSync(join(assets, 'backend.json'), JSON.stringify({ version: 'v0.2.2' }));
    try {
      expect(() =>
        prepareQianjicore({ projectRoot: root, platform: 'darwin', arch: 'arm64', version: 'latest' })
      ).toThrow('not the reviewed product version');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
