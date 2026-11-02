import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { x as extract } from 'tar';
import catalog from '../../assets/catalog.json' with { type: 'json' };

export type ProductResources = { skills: string; assistants: string };

function validateResources(root: string): void {
  const names: string[] = [];
  const visit = (directory: string): void => {
    const manifest = path.join(directory, 'SKILL.md');
    if (existsSync(manifest)) {
      const name = /^name:\s*(.+)$/m.exec(readFileSync(manifest, 'utf8'))?.[1]?.trim();
      if (!name) throw new Error(`Product skill has no name: ${manifest}`);
      names.push(name);
      return;
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(path.join(directory, entry.name));
    }
  };
  visit(path.join(root, 'skills'));
  if (names.length !== catalog.skills.length || catalog.skills.some((name) => !names.includes(name))) {
    throw new Error('Product skill corpus does not match the reviewed catalog');
  }
  const manifest = JSON.parse(readFileSync(path.join(root, 'assistants/assistants.json'), 'utf8')) as {
    assistants: Array<{ id: string; enabled_skills?: string[] }>;
  };
  const assistantIds = manifest.assistants.map((assistant) => assistant.id);
  if (
    assistantIds.length !== catalog.assistants.length ||
    new Set(assistantIds).size !== assistantIds.length ||
    catalog.assistants.some((id) => !assistantIds.includes(id))
  ) {
    throw new Error('Product assistants do not match the reviewed catalog');
  }
  const assistantFiles = readdirSync(path.join(root, 'assistants'));
  if (assistantFiles.some((name) => name !== 'assistants.json' && !catalog.assistants.includes(name))) {
    throw new Error('Product corpus contains unreviewed assistant assets');
  }
  for (const assistant of manifest.assistants) {
    if (
      catalog.removedAssistants.includes(assistant.id) ||
      assistant.enabled_skills?.some((name) => !names.includes(name))
    ) {
      throw new Error(`Product assistant has unavailable skills: ${assistant.id}`);
    }
  }
}

/** Materialize the reviewed offline corpus before starting either host's backend. */
export async function prepareProductResources(assetsPath: string, dataDir: string): Promise<ProductResources> {
  const archive = path.join(assetsPath, 'runtime.tar.gz');
  const hash = createHash('sha256').update(readFileSync(archive)).digest('hex');
  if (hash !== catalog.sha256) throw new Error('Product runtime resource checksum mismatch');
  const parent = path.join(dataDir, 'product-resources');
  const root = path.join(parent, hash);
  const marker = path.join(root, '.complete');
  if (!existsSync(marker)) {
    mkdirSync(parent, { recursive: true });
    const temporary = mkdtempSync(path.join(parent, '.prepare-'));
    try {
      await extract({ file: archive, cwd: temporary, strict: true });
      validateResources(temporary);
      writeFileSync(path.join(temporary, '.complete'), hash);
      // A failed previous extraction has never been exposed to the backend.
      if (existsSync(root)) rmSync(root, { recursive: true });
      renameSync(temporary, root);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
  validateResources(root);
  return { skills: path.join(root, 'skills'), assistants: path.join(root, 'assistants') };
}
