import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareProductResources } from './resources.js';
import catalog from '../../assets/catalog.json' with { type: 'json' };
import i18nConfig from '../../../desktop/src/common/config/i18n-config.json' with { type: 'json' };
import { t as listArchive } from 'tar';
import {
  QIANJI_FILES_MARKER,
  QIANJI_SESSIONS_MARKER,
  QIANJI_SESSION_MESSAGE_MARKER,
} from '../../../desktop/src/common/config/constants';

const assets = fileURLToPath(new URL('../../assets', import.meta.url));
const temporary: string[] = [];
function directory(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'qianji-resources-test-'));
  temporary.push(root);
  return root;
}
afterEach(() => temporary.forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('product runtime resources', () => {
  it('keeps frontend message markers aligned with the actual backend source', async () => {
    let source = '';
    await listArchive({
      file: path.join(assets, 'qianjicore-source.tar.gz'),
      onReadEntry: (entry) => {
        if (entry.path === 'crates/qianji-common/src/constants.rs')
          entry.on('data', (chunk: Buffer) => {
            source += chunk.toString();
          });
      },
    });
    const names = ['QIANJI_FILES_MARKER', 'QIANJI_SESSIONS_MARKER', 'QIANJI_SESSION_MESSAGE_MARKER'];
    const values = names.map((name) => new RegExp(`pub const ${name}: &str = "([^"]+)"`).exec(source)?.[1]);
    expect(values).toEqual([QIANJI_FILES_MARKER, QIANJI_SESSIONS_MARKER, QIANJI_SESSION_MESSAGE_MARKER]);
  });
  it('delivers the reviewed business skills and renamed support skills on repeated starts', async () => {
    const dataDir = directory();
    const first = await prepareProductResources(assets, dataDir);
    const second = await prepareProductResources(assets, dataDir);
    expect(second).toEqual(first);
    const names = [
      ...readdirSync(first.skills).filter((name) => name !== 'auto-inject'),
      ...readdirSync(path.join(first.skills, 'auto-inject')),
    ];
    expect(names.toSorted()).toEqual(catalog.skills.toSorted());
    expect(readFileSync(path.join(first.skills, 'auto-inject/qianji-config/SKILL.md'), 'utf8')).toContain(
      '$QIANJI_HELPER_BIN'
    );
  });

  it('ships complete assistant assets without references to removed skills', async () => {
    const resources = await prepareProductResources(assets, directory());
    const manifest = JSON.parse(readFileSync(path.join(resources.assistants, 'assistants.json'), 'utf8'));
    const unavailable: string[] = [];
    for (const assistant of manifest.assistants) {
      for (const skill of assistant.enabled_skills || []) if (!catalog.skills.includes(skill)) unavailable.push(skill);
      if (
        assistant.rule_file &&
        !existsSync(path.join(resources.assistants, assistant.rule_file.replace('{locale}', 'en-US')))
      )
        unavailable.push(assistant.rule_file);
      if (assistant.avatar?.includes('/') && !existsSync(path.join(resources.assistants, assistant.avatar)))
        unavailable.push(assistant.avatar);
    }
    expect(unavailable).toEqual([]);
    expect(
      manifest.assistants.some((assistant: { id: string }) => catalog.removedAssistants.includes(assistant.id))
    ).toBe(false);
    expect(
      manifest.assistants.find((assistant: { id: string }) => assistant.id === 'qianji-assistant').enabled_skills
    ).toEqual(['qianji-config', 'qianji-troubleshooting']);
  });

  it('ships only the reviewed business assistants and removes their retired template files', async () => {
    const resources = await prepareProductResources(assets, directory());
    const manifest = JSON.parse(readFileSync(path.join(resources.assistants, 'assistants.json'), 'utf8')) as {
      assistants: Array<{ id: string }>;
    };
    expect(manifest.assistants.map((assistant) => assistant.id).toSorted()).toEqual(catalog.assistants.toSorted());
    for (const id of ['game-3d', 'human-3-coach', 'ui-ux-pro-max']) {
      expect(manifest.assistants.some((assistant) => assistant.id === id)).toBe(false);
      expect(existsSync(path.join(resources.assistants, id))).toBe(false);
    }
  });

  it('uses localized business presentation and task-planning suggestions', async () => {
    const resources = await prepareProductResources(assets, directory());
    const manifest = JSON.parse(readFileSync(path.join(resources.assistants, 'assistants.json'), 'utf8')) as {
      assistants: Array<{ id: string; prompts: string[]; prompts_i18n: Record<string, string[]> }>;
    };
    const locales = fileURLToPath(new URL('../../../desktop/src/renderer/services/i18n/locales/', import.meta.url));
    for (const [id, scenarioKeys] of Object.entries(catalog.assistantScenarios)) {
      const assistant = manifest.assistants.find((entry) => entry.id === id);
      expect(assistant).toBeDefined();
      for (const locale of i18nConfig.supportedLanguages) {
        const { product } = JSON.parse(readFileSync(path.join(locales, locale, 'common.json'), 'utf8')) as {
          product: Record<string, string>;
        };
        expect(assistant?.prompts_i18n[locale]).toEqual(scenarioKeys.map((key) => product[key]));
      }
    }
  });

  it('removes unrelated sample questions from the retained assistants', async () => {
    const resources = await prepareProductResources(assets, directory());
    const manifest = JSON.parse(readFileSync(path.join(resources.assistants, 'assistants.json'), 'utf8')) as {
      assistants: Array<{ prompts_i18n: Record<string, string[]> }>;
    };
    const prompts = manifest.assistants.flatMap((assistant) => Object.values(assistant.prompts_i18n).flat()).join('\n');
    expect(prompts).not.toMatch(
      /学术论文|咖啡品牌|医疗问诊|电商|3D 平台游戏|academic research paper|coffee brand|medical intake|e-commerce/i
    );
  });

  it('rejects a cached corpus with an extra unreviewed assistant definition', async () => {
    const dataDir = directory();
    const resources = await prepareProductResources(assets, dataDir);
    const filename = path.join(resources.assistants, 'assistants.json');
    const manifest = JSON.parse(readFileSync(filename, 'utf8'));
    manifest.assistants.push({ id: 'game-3d', enabled_skills: [] });
    writeFileSync(filename, JSON.stringify(manifest));
    await expect(prepareProductResources(assets, dataDir)).rejects.toThrow('assistants do not match');
  });

  it('rejects retired assistant files even when omitted from the manifest', async () => {
    const dataDir = directory();
    const resources = await prepareProductResources(assets, dataDir);
    mkdirSync(path.join(resources.assistants, 'game-3d'));
    await expect(prepareProductResources(assets, dataDir)).rejects.toThrow('unreviewed assistant assets');
  });

  it('rejects a cached corpus with a missing business assistant', async () => {
    const dataDir = directory();
    const resources = await prepareProductResources(assets, dataDir);
    const filename = path.join(resources.assistants, 'assistants.json');
    const manifest = JSON.parse(readFileSync(filename, 'utf8'));
    manifest.assistants.pop();
    writeFileSync(filename, JSON.stringify(manifest));
    await expect(prepareProductResources(assets, dataDir)).rejects.toThrow('assistants do not match');
  });

  it('rejects an altered archive before touching user data', async () => {
    const altered = directory();
    const dataDir = directory();
    writeFileSync(path.join(altered, 'runtime.tar.gz'), 'altered archive');
    await expect(prepareProductResources(altered, dataDir)).rejects.toThrow('checksum');
    expect(readdirSync(dataDir)).toEqual([]);
  });

  it('rejects a cached corpus with a missing required skill', async () => {
    const dataDir = directory();
    const resources = await prepareProductResources(assets, dataDir);
    rmSync(path.join(resources.skills, 'pdf'), { recursive: true });
    await expect(prepareProductResources(assets, dataDir)).rejects.toThrow('reviewed catalog');
  });
});
