import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import SettingsSider from '@/renderer/pages/settings/components/SettingsSider';
import SettingsPageWrapper from '@/renderer/pages/settings/components/SettingsPageWrapper';
import SettingsModal from '@/renderer/components/settings/SettingsModal';
import SiderFooter from '@/renderer/components/layout/Sider/SiderFooter';

const environment = vi.hoisted(() => ({
  isMobile: false,
  extensionTabs: [
    { id: 'ext-business', label: 'Business extension', position: { relativeTo: 'channels', placement: 'after' } },
  ],
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: environment.isMobile }),
}));
vi.mock('@/renderer/hooks/system/useExtensionSettingsTabs', () => ({
  useExtensionSettingsTabs: () => environment.extensionTabs,
}));
vi.mock('@/renderer/hooks/system/useExtI18n', () => ({
  useExtI18n: () => ({ resolveExtTabName: (tab: { label: string }) => tab.label }),
}));
vi.mock('@/renderer/components/base/QianjiScrollArea', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/renderer/components/base/QianjiModal', () => ({
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <div>{children}</div> : null,
}));
vi.mock('@/renderer/components/settings/SettingsModal/contents/ModelModalContent', () => ({
  default: () => <div>Model settings content</div>,
}));
vi.mock('@/renderer/components/settings/SettingsModal/contents/AgentModalContent', () => ({ default: () => null }));
vi.mock('@/renderer/components/settings/SettingsModal/contents/ToolsModalContent', () => ({
  default: () => <div>Tools settings content</div>,
}));
vi.mock('@/renderer/components/settings/SettingsModal/contents/SystemModalContent', () => ({
  default: () => <div>System settings content</div>,
}));
vi.mock('@/renderer/components/settings/SettingsModal/contents/AboutModalContent', () => ({ default: () => null }));
vi.mock('@/renderer/components/settings/SettingsModal/contents/ExtensionSettingsTabContent', () => ({
  default: () => <div>Extension settings content</div>,
}));

const Location = () => <output data-testid='location'>{useLocation().pathname}</output>;
const expectWebNavigation = () => {
  for (const key of ['settings.appearancePanel', 'settings.webui', 'pet.desktopPet', 'settings.channels']) {
    expect(screen.queryByText(key)).not.toBeInTheDocument();
  }
  expect(screen.getByText('settings.model')).toBeInTheDocument();
  expect(screen.getByText('settings.system')).toBeInTheDocument();
};

describe('Web settings navigation', () => {
  beforeEach(() => {
    environment.isMobile = false;
  });

  it('hides channels, appearance and desktop tabs while retaining system settings', () => {
    render(
      <MemoryRouter>
        <SettingsSider />
        <Location />
      </MemoryRouter>
    );
    expectWebNavigation();
    fireEvent.click(screen.getByText('settings.system'));
    expect(screen.getByTestId('location')).toHaveTextContent('/settings/system');
  });

  it('uses the same Web settings on small screens', () => {
    environment.isMobile = true;
    render(
      <MemoryRouter>
        <SettingsPageWrapper>Page content</SettingsPageWrapper>
      </MemoryRouter>
    );
    expectWebNavigation();
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('keeps extension settings reachable when their anchor has been removed', () => {
    render(
      <MemoryRouter>
        <SettingsSider />
        <Location />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Business extension'));
    expect(screen.getByTestId('location')).toHaveTextContent('/settings/ext/ext-business');
  });

  it.each(['appearance', 'display', 'pet', 'webui', 'channels', 'unknown'])(
    'falls back to model settings for removed or invalid modal tab %s',
    (tab) => {
      render(
        <MemoryRouter>
          <SettingsModal visible onCancel={vi.fn()} defaultTab={tab} />
        </MemoryRouter>
      );
      expect(screen.getByText('Model settings content')).toBeInTheDocument();
      expectWebNavigation();
    }
  );

  it('opens the requested settings when the modal is reused', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <SettingsModal visible onCancel={vi.fn()} defaultTab='tools' />
      </MemoryRouter>
    );
    expect(screen.getByText('Tools settings content')).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <SettingsModal visible onCancel={vi.fn()} defaultTab='system' />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('System settings content')).toBeInTheDocument());
  });

  it('offers settings navigation and sign-out without a quick theme switch', () => {
    const onLogoutClick = vi.fn();
    render(
      <SiderFooter
        isMobile={false}
        isSettings
        siderTooltipProps={{}}
        onSettingsClick={vi.fn()}
        showLogout
        onLogoutClick={onLogoutClick}
      />
    );
    expect(screen.queryByTestId('theme-toggle')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('settings.googleLogout'));
    expect(onLogoutClick).toHaveBeenCalledOnce();
  });
});
