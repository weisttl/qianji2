/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from '@arco-design/web-react';

const { configServiceMock, nativeReadMock } = vi.hoisted(() => ({
  nativeReadMock: vi.fn(() => Promise.resolve({ success: false })),
  configServiceMock: {
    get: vi.fn<(key: string) => unknown>(() => undefined),
    set: vi.fn(() => Promise.resolve()),
    setLocal: vi.fn(),
  },
}));
const clientBusinessSettingsMocks = vi.hoisted(() => ({
  getClientBusinessSetting: vi.fn(),
  setClientBusinessSetting: vi.fn(() => Promise.resolve()),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));
vi.mock('@/common', () => ({
  ipcBridge: {
    application: {
      systemInfo: { invoke: nativeReadMock },
      getStartOnBootStatus: { invoke: nativeReadMock },
      getGpuStatus: { invoke: nativeReadMock },
      getCdpStatus: { invoke: nativeReadMock },
    },
    systemSettings: { getCloseToTray: { invoke: nativeReadMock } },
  },
}));
vi.mock('@/renderer/components/base/QianjiScrollArea', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/renderer/components/settings/LanguageSwitcher', () => ({
  default: () => <div>LanguageSwitcher</div>,
}));
vi.mock('@/renderer/components/settings/SettingsModal/contents/SystemModalContent/VoiceInputSection', () => ({
  default: () => <div>VoiceInputSection</div>,
}));
vi.mock('@/renderer/hooks/chat/useCrossSessionMessageEnabled', () => ({
  useCrossSessionMessageEnabled: () => ({ enabled: true, setEnabled: vi.fn(() => Promise.resolve()) }),
}));
vi.mock('@/renderer/services/clientBusinessSettings', () => clientBusinessSettingsMocks);
vi.mock('@/common/config/configService', () => ({ configService: configServiceMock }));

import SystemModalContent from '@/renderer/components/settings/SettingsModal/contents/SystemModalContent';

const renderContent = () =>
  render(
    <ConfigProvider>
      <SystemModalContent />
    </ConfigProvider>
  );

describe('SystemModalContent Web preferences', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    configServiceMock.get.mockImplementation(() => undefined);
    configServiceMock.set.mockResolvedValue(undefined);
    clientBusinessSettingsMocks.getClientBusinessSetting.mockResolvedValue(undefined);
    clientBusinessSettingsMocks.setClientBusinessSetting.mockResolvedValue(undefined);
  });

  it('offers browser preferences without native desktop controls or native status calls', async () => {
    renderContent();
    await screen.findByDisplayValue('300');
    for (const key of [
      'startOnBoot',
      'closeToTray',
      'hardwareAcceleration',
      'workDir',
      'logDir',
      'browserData.title',
    ]) {
      expect(screen.queryByText(`settings.${key}`)).not.toBeInTheDocument();
    }
    expect(nativeReadMock).not.toHaveBeenCalled();
    expect(screen.getByText('LanguageSwitcher')).toBeInTheDocument();
  });

  it('rolls back the upload preference if saving fails', async () => {
    configServiceMock.set.mockRejectedValueOnce(new Error('offline'));
    renderContent();
    const row = screen.getByText('settings.saveUploadToWorkspace').parentElement?.parentElement;
    const control = within(row as HTMLElement).getByRole('switch');
    fireEvent.click(control);
    await waitFor(() => expect(control).not.toHaveClass('arco-switch-checked'));
    expect(configServiceMock.setLocal).toHaveBeenCalledWith('upload.saveToWorkspace', false);
  });

  it('preserves decimal preview limits when saved', async () => {
    const user = userEvent.setup();
    renderContent();
    const input = (await screen.findAllByRole('spinbutton'))[2];
    await user.clear(input);
    await user.type(input, '1.5');
    fireEvent.blur(input);
    await waitFor(() =>
      expect(clientBusinessSettingsMocks.setClientBusinessSetting).toHaveBeenCalledWith('preview.textSizeLimitMb', 1.5)
    );
  });

  it('loads ACP timeouts from backend client settings', async () => {
    clientBusinessSettingsMocks.getClientBusinessSetting.mockImplementation(async (key: string) => {
      if (key === 'acp.promptTimeout') return 640;
      if (key === 'acp.agentIdleTimeout') return 9;
      return undefined;
    });

    renderContent();

    expect(await screen.findByDisplayValue('640')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('9')).toBeInTheDocument();
  });

  it('does not fall back to legacy configService ACP timeout keys', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'acp.promptTimeout') return 777;
      if (key === 'acp.agentIdleTimeout') return 13;
      return undefined;
    });

    renderContent();

    expect(await screen.findByDisplayValue('300')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('5')).toBeInTheDocument();
    expect(configServiceMock.get).not.toHaveBeenCalledWith('acp.promptTimeout');
    expect(configServiceMock.get).not.toHaveBeenCalledWith('acp.agentIdleTimeout');
  });

  it('persists ACP timeout changes through backend client settings', async () => {
    const user = userEvent.setup();
    renderContent();

    const timeoutInputs = await screen.findAllByRole('spinbutton');
    const promptTimeoutInput = timeoutInputs[0];
    const agentIdleTimeoutInput = timeoutInputs[1];

    await user.clear(promptTimeoutInput);
    await user.type(promptTimeoutInput, '450');
    fireEvent.blur(promptTimeoutInput);

    await waitFor(() => {
      expect(clientBusinessSettingsMocks.setClientBusinessSetting).toHaveBeenCalledWith('acp.promptTimeout', 450);
    });

    await user.clear(agentIdleTimeoutInput);
    await user.type(agentIdleTimeoutInput, '7');
    fireEvent.blur(agentIdleTimeoutInput);

    await waitFor(() => {
      expect(clientBusinessSettingsMocks.setClientBusinessSetting).toHaveBeenCalledWith('acp.agentIdleTimeout', 7);
    });
  });
});
