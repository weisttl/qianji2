import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import QuickActionButtons from '@/renderer/pages/guid/components/QuickActionButtons';

afterEach(() => {
  cleanup();
  navigate.mockClear();
});

describe('internal workspace shortcuts', () => {
  it.each([
    ['common.product.modelSettings', '/settings/model'],
    ['common.product.assistantSettings', '/assistants'],
    ['common.product.platformSettings', '/settings/system'],
  ])('opens %s within the product', (name, route) => {
    render(<QuickActionButtons />);
    fireEvent.click(screen.getByRole('button', { name }));
    expect(navigate).toHaveBeenCalledWith(route);
  });

  it('shows the use notice without an upstream external link', () => {
    render(<QuickActionButtons />);
    expect(screen.getByText('common.product.usageNotice')).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
