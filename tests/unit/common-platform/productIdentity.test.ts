import { describe, expect, it, vi } from 'vitest';
import {
  BROWSER_SESSION_PARTITION,
  BUILTIN_BROWSER_MCP_NAME,
  QIANJI_FILES_MARKER,
  QIANJI_SESSIONS_MARKER,
  QIANJI_SESSION_MESSAGE_MARKER,
} from '@/common/config/constants';

vi.mock('@/common', () => ({ ipcBridge: { deepLink: { received: { emit: vi.fn() } } } }));
import { parseDeepLinkUrl } from '@/process/utils/deepLink';

describe('product identity', () => {
  it('uses the product namespace for browser sessions and tools', () => {
    expect(BROWSER_SESSION_PARTITION).toBe('persist:qianji-browser');
    expect(BUILTIN_BROWSER_MCP_NAME).toBe('qianji-browser');
  });

  it('uses the product protocol for file and cross-session messages', () => {
    expect([QIANJI_FILES_MARKER, QIANJI_SESSIONS_MARKER, QIANJI_SESSION_MESSAGE_MARKER]).toEqual([
      '[[QIANJI_FILES]]',
      '[[QIANJI_SESSIONS]]',
      '[[QIANJI_SESSION_MESSAGE]]',
    ]);
  });

  it('accepts product provider links', () => {
    expect(parseDeepLinkUrl('qianji://add-provider?name=Example')).toEqual({
      action: 'add-provider',
      params: { name: 'Example' },
    });
  });

  it('rejects unrelated URL schemes', () => {
    expect(parseDeepLinkUrl('https://example.com/add-provider')).toBeNull();
  });
});
