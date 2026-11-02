/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AboutModalContent from '@/renderer/components/settings/SettingsModal/contents/AboutModalContent';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const Location = () => <span>{useLocation().pathname}</span>;
beforeEach(() => vi.stubGlobal('__APP_VERSION__', '2.2.2'));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('internal product information', () => {
  it('shows the organization, product version and source notice', () => {
    render(
      <MemoryRouter>
        <AboutModalContent />
      </MemoryRouter>
    );
    expect(screen.getByText(/common.product.organization/)).toBeTruthy();
    expect(screen.getByText('v2.2.2')).toBeTruthy();
    expect(screen.getByText('common.product.upstreamNotice')).toBeTruthy();
  });

  it('opens model configuration from the internal product panel', () => {
    render(
      <MemoryRouter>
        <AboutModalContent />
        <Location />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('common.product.modelSettings'));
    expect(screen.getByText('/settings/model')).toBeTruthy();
  });

  it('offers internal support when no public update or feedback service is configured', () => {
    render(
      <MemoryRouter>
        <AboutModalContent />
      </MemoryRouter>
    );
    expect(screen.getByText('common.product.support')).toBeTruthy();
    expect(screen.queryByText('settings.checkForUpdates')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
