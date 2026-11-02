#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const tar = require('tar');

async function main() {
  const root = path.resolve(__dirname, '../../..');
  const assets = path.join(root, 'packages/web-host/assets');
  const catalog = JSON.parse(fs.readFileSync(path.join(assets, 'catalog.json'), 'utf8'));
  const source = process.argv[2];
  if (!source)
    throw new Error('Usage: node packages/shared-scripts/src/prepare-product-resources.js <QianjiCore source>');
  const version = require(path.join(root, 'package.json')).qianjicoreVersion;
  if (version !== catalog.backendVersion) throw new Error('Product catalog and backend versions must match');
  const sourceAssets = path.resolve(source, 'crates/qianji-app/assets');
  const localeRoot = path.join(root, 'packages/desktop/src/renderer/services/i18n/locales');
  const { supportedLanguages } = require(path.join(root, 'packages/desktop/src/common/config/i18n-config.json'));
  const productTexts = Object.fromEntries(
    supportedLanguages.map((locale) => [
      locale,
      JSON.parse(fs.readFileSync(path.join(localeRoot, locale, 'common.json'), 'utf8')).product,
    ])
  );
  const localize = (keys) =>
    Object.fromEntries(
      supportedLanguages.map((locale) => [
        locale,
        keys.map((key) => {
          const text = productTexts[locale][key];
          if (typeof text !== 'string' || !text.trim()) throw new Error(`Missing business scenario: ${locale}/${key}`);
          return text;
        }),
      ])
    );
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'qianji-corpus-'));
  try {
    fs.cpSync(path.join(sourceAssets, 'builtin-skills'), path.join(temporary, 'skills'), { recursive: true });
    const sourceAssistants = path.join(sourceAssets, 'builtin-assistants');
    const manifest = JSON.parse(fs.readFileSync(path.join(sourceAssistants, 'assistants.json'), 'utf8'));
    const sourceById = new Map(manifest.assistants.map((assistant) => [assistant.id, assistant]));
    const targetAssistants = path.join(temporary, 'assistants');
    fs.mkdirSync(targetAssistants);
    manifest.assistants = catalog.assistants.map((id) => {
      const assistant = sourceById.get(id);
      if (!assistant) throw new Error(`Required product assistant is missing: ${id}`);
      fs.cpSync(path.join(sourceAssistants, id), path.join(targetAssistants, id), { recursive: true });
      const promptIndices = catalog.assistantPromptIndices[id];
      if (promptIndices) {
        const select = (prompts) =>
          promptIndices.map((index) => {
            if (typeof prompts[index] !== 'string') throw new Error(`Missing business prompt: ${id}/${index}`);
            return prompts[index];
          });
        assistant.prompts = select(assistant.prompts);
        assistant.prompts_i18n = Object.fromEntries(
          Object.entries(assistant.prompts_i18n).map(([locale, prompts]) => [locale, select(prompts)])
        );
      }
      const scenarios = catalog.assistantScenarios[id];
      if (scenarios) {
        assistant.prompts_i18n = localize(scenarios);
        assistant.prompts = assistant.prompts_i18n['en-US'];
      }
      const descriptionKey = catalog.assistantDescriptions[id];
      if (descriptionKey) {
        assistant.description_i18n = Object.fromEntries(
          Object.entries(localize([descriptionKey])).map(([locale, texts]) => [locale, texts[0]])
        );
        assistant.description = assistant.description_i18n['en-US'];
      }
      return assistant;
    });
    for (const assistant of manifest.assistants) {
      if (
        catalog.removedAssistants.includes(assistant.id) ||
        (assistant.enabled_skills || []).some((name) => !catalog.skills.includes(name))
      )
        throw new Error(`Assistant ${assistant.id} is outside the product catalog`);
    }
    fs.writeFileSync(path.join(targetAssistants, 'assistants.json'), JSON.stringify(manifest, null, 2) + '\n');
    await tar.c(
      { gzip: true, portable: true, mtime: new Date(0), cwd: temporary, file: path.join(assets, 'runtime.tar.gz') },
      ['skills', 'assistants']
    );
    catalog.sha256 = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(assets, 'runtime.tar.gz')))
      .digest('hex');
    fs.writeFileSync(path.join(assets, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
    console.log(`Prepared ${catalog.skills.length} product skills and ${manifest.assistants.length} assistants`);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
