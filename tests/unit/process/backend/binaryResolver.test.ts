/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveBinaryPath } from '@/process/backend/binaryResolver';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

const originalResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
const originalBackendBin = process.env.QIANJI_BACKEND_BIN;

function setResourcesPath(resourcesPath: string | undefined): void {
  Object.defineProperty(process, 'resourcesPath', {
    configurable: true,
    value: resourcesPath,
  });
}

function restoreBackendBin(): void {
  if (originalBackendBin === undefined) {
    delete process.env.QIANJI_BACKEND_BIN;
  } else {
    process.env.QIANJI_BACKEND_BIN = originalBackendBin;
  }
}

function dirEntry(name: string, isDirectory = false): ReturnType<typeof readdirSync>[number] {
  return {
    name,
    isDirectory: () => isDirectory,
  } as unknown as ReturnType<typeof readdirSync>[number];
}

describe('resolveBinaryPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.QIANJI_BACKEND_BIN;
  });

  afterEach(() => {
    setResourcesPath(originalResourcesPath);
    restoreBackendBin();
  });

  it('returns the QIANJI_BACKEND_BIN override when the file exists', () => {
    const overrideInput = '/custom/qianjicore';
    // Resolve mirrors the implementation so the expectation holds on Windows too.
    const overridePath = resolve(overrideInput);
    process.env.QIANJI_BACKEND_BIN = overrideInput;
    vi.mocked(existsSync).mockImplementation((path) => path === overridePath);

    expect(resolveBinaryPath()).toBe(overridePath);
    // Override wins before bundled/PATH lookup runs.
    expect(execSync).not.toHaveBeenCalled();
  });

  it('trims whitespace around QIANJI_BACKEND_BIN before use', () => {
    const overrideInput = '/custom/qianjicore';
    const overridePath = resolve(overrideInput);
    process.env.QIANJI_BACKEND_BIN = `  ${overrideInput}  `;
    vi.mocked(existsSync).mockImplementation((path) => path === overridePath);

    expect(resolveBinaryPath()).toBe(overridePath);
  });

  it('resolves a relative QIANJI_BACKEND_BIN against process.cwd', () => {
    process.env.QIANJI_BACKEND_BIN = 'rel/qianjicore';
    const absolute = resolve('rel/qianjicore');
    vi.mocked(existsSync).mockImplementation((path) => path === absolute);

    expect(resolveBinaryPath()).toBe(absolute);
  });

  it('throws with override diagnostics when QIANJI_BACKEND_BIN points at a missing file', () => {
    const overrideInput = '/custom/missing-qianjicore';
    const overridePath = resolve(overrideInput);
    process.env.QIANJI_BACKEND_BIN = overrideInput;
    vi.mocked(existsSync).mockReturnValue(false);

    // Error message quotes the raw input, diagnostics carry the resolved path.
    expect(() => resolveBinaryPath()).toThrow(`QIANJI_BACKEND_BIN is set to "${overrideInput}"`);

    try {
      resolveBinaryPath();
    } catch (error) {
      expect(error).toMatchObject({
        name: 'BackendBinaryResolveError',
        diagnostics: expect.objectContaining({
          envOverridePath: overridePath,
          envOverrideExists: false,
        }),
      });
    }
    // A missing explicit override fails loudly instead of falling back.
    expect(execSync).not.toHaveBeenCalled();
  });

  it('ignores a blank QIANJI_BACKEND_BIN and falls back to the normal search order', () => {
    process.env.QIANJI_BACKEND_BIN = '   ';
    const resolved = '/usr/local/bin/qianjicore';

    setResourcesPath(undefined);
    vi.mocked(execSync).mockReturnValue(`${resolved}\n`);
    vi.mocked(existsSync).mockImplementation((path) => path === resolved);

    expect(resolveBinaryPath()).toBe(resolved);
  });

  it('attaches bundled path diagnostics when qianjicore cannot be resolved', () => {
    const resourcesPath = '/app/resources';
    const runtimeKey = `${process.platform}-${process.arch}`;
    const binaryName = process.platform === 'win32' ? 'qianjicore.exe' : 'qianjicore';
    const bundledDir = join(resourcesPath, 'bundled-qianjicore');
    const runtimeDir = join(bundledDir, runtimeKey);
    const checkedBundledPath = join(runtimeDir, binaryName);

    setResourcesPath(resourcesPath);
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readdirSync).mockImplementation((path) => {
      if (path === resourcesPath) return [dirEntry('bundled-qianjicore', true)];
      if (path === runtimeDir) return [dirEntry('manifest.json')];
      return [] as ReturnType<typeof readdirSync>;
    });
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not found on PATH');
    });

    expect(() => resolveBinaryPath()).toThrow('Cannot find "qianjicore" binary');

    try {
      resolveBinaryPath();
    } catch (error) {
      expect(error).toMatchObject({
        name: 'BackendBinaryResolveError',
        diagnostics: expect.objectContaining({
          resourcesPath,
          runtimeKey,
          binaryName,
          checkedBundledPath,
          bundledDirExists: false,
          runtimeDirExists: false,
          resourcesDirEntries: ['bundled-qianjicore/'],
          runtimeDirEntries: ['manifest.json'],
          pathLookupCommand: process.platform === 'win32' ? 'where qianjicore' : 'which qianjicore',
          pathLookupError: expect.stringContaining('not found on PATH'),
        }),
      });
    }
  });
});
