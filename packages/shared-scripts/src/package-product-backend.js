#!/usr/bin/env node
/** Package a maintained product source tree into the reviewed offline source snapshot. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const tar = require('tar');

async function main() {
  const source = process.argv[2];
  if (!source)
    throw new Error('Usage: node packages/shared-scripts/src/package-product-backend.js <QianjiCore source>');
  const root = path.resolve(__dirname, '../../..');
  const assets = path.join(root, 'packages/web-host/assets');
  const manifestPath = path.join(assets, 'backend.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const files = ['Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', 'LICENSE', 'crates', 'vendor', '.cargo'];
  const resolved = path.resolve(source);
  for (const file of files)
    if (!fs.existsSync(path.join(resolved, file))) throw new Error(`Missing product source: ${file}`);
  await tar.c(
    {
      file: path.join(assets, 'qianjicore-source.tar.gz'),
      cwd: resolved,
      gzip: true,
      portable: true,
      mtime: new Date(0),
      filter: (name) => !name.split('/').includes('target'),
    },
    files
  );
  manifest.sourceSha256 = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(assets, 'qianjicore-source.tar.gz')))
    .digest('hex');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Packaged product source ${manifest.sourceSha256}`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
