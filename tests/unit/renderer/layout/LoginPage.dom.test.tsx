import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ login: vi.fn(), navigate: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'zh-CN' } }),
}));
vi.mock('@/renderer/services/i18n', () => ({ changeLanguage: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => auth.navigate }));
vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({ status: 'unauthenticated', login: auth.login }),
}));

import LoginPage from '@/renderer/pages/login';

const fillAccount = () => {
  fireEvent.change(screen.getByLabelText('login.username'), { target: { value: '  analyst  ' } });
  fireEvent.change(screen.getByLabelText('login.password'), { target: { value: 'test-password' } });
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  auth.login.mockResolvedValue({ success: true });
});
afterEach(cleanup);

describe('internal workspace login', () => {
  it('does not submit an empty account', async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'login.submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('login.errors.empty');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('keeps failed sign-ins on the login screen with a localized error', async () => {
    auth.login.mockResolvedValue({ success: false, code: 'invalidCredentials' });
    render(<LoginPage />);
    fillAccount();
    fireEvent.click(screen.getByRole('button', { name: 'login.submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('login.errors.invalidCredentials');
    expect(auth.navigate).not.toHaveBeenCalled();
  });

  it('remembers only the account hint after a successful sign-in', async () => {
    render(<LoginPage />);
    fillAccount();
    fireEvent.click(screen.getByRole('checkbox', { name: 'login.rememberMe' }));
    fireEvent.click(screen.getByRole('button', { name: 'login.submit' }));
    await waitFor(() => expect(auth.navigate).toHaveBeenCalledWith('/guid', { replace: true }));
    expect(auth.login).toHaveBeenCalledWith({ username: 'analyst', password: 'test-password', remember: true });
    expect(localStorage.getItem('rememberedPassword')).toBeNull();
    cleanup();
    render(<LoginPage />);
    expect(screen.getByLabelText('login.username')).toHaveValue('analyst');
    expect(screen.getByLabelText('login.password')).toHaveValue('');
  });

  it('clears a legacy cached password without restoring it to the form', () => {
    localStorage.setItem('rememberMe', 'true');
    localStorage.setItem('rememberedPassword', 'old-password-cache');
    localStorage.setItem('rememberedUsername', 'invalid-cache');
    render(<LoginPage />);
    expect(localStorage.getItem('rememberedPassword')).toBeNull();
    expect(screen.getByLabelText('login.password')).toHaveValue('');
    expect(screen.getByLabelText('login.username')).toHaveValue('');
  });

  it('allows retry after a network exception', async () => {
    auth.login.mockRejectedValueOnce(new Error('offline'));
    render(<LoginPage />);
    fillAccount();
    fireEvent.click(screen.getByRole('button', { name: 'login.submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('login.errors.networkError');
    fireEvent.click(screen.getByRole('button', { name: 'login.submit' }));
    await waitFor(() => expect(auth.navigate).toHaveBeenCalledWith('/guid', { replace: true }));
  });
});
