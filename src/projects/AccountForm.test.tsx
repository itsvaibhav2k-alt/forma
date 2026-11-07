// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AccountForm } from './ProjectApp';
import { configureBackend } from './client';

afterEach(cleanup);
it('handles email confirmation without pretending an account is signed in', async () => {
  const signUp = vi.fn().mockResolvedValue({ data: { user: {}, session: null }, error: null });
  render(<AccountForm client={{ auth: { signUp } } as unknown as SupabaseClient} recovery={false} onRecovered={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Create an account' }));
  await user.type(screen.getByLabelText('Email'), 'new@example.test');
  await user.type(screen.getByLabelText('Password'), 'synthetic-password');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('status')).toHaveTextContent('confirm your account');
  expect(screen.getByLabelText('Password')).toHaveValue('');
});
it('requests recovery without revealing whether an email has an account', async () => {
  const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
  render(<AccountForm client={{ auth: { resetPasswordForEmail } } as unknown as SupabaseClient} recovery={false} onRecovered={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
  expect(screen.getByRole('alert')).toHaveTextContent('email first');
  await user.type(screen.getByLabelText('Email'), 'new@example.test');
  await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
  expect(await screen.findByRole('status')).toHaveTextContent('If this account exists');
});
it('uses the recovery session to update the password and clears the password field', async () => {
  const updateUser = vi.fn().mockResolvedValue({ data: { user: {} }, error: null }), recovered = vi.fn();
  render(<AccountForm client={{ auth: { updateUser } } as unknown as SupabaseClient} recovery onRecovered={recovered} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('New password'), 'synthetic-new-password');
  await user.click(screen.getByRole('button', { name: 'Update password' }));
  expect(updateUser).toHaveBeenCalledWith({ password: 'synthetic-new-password' });
  expect(recovered).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('New password')).toHaveValue('');
});
it('rejects incomplete configuration and server-only credentials', () => {
  expect(configureBackend()).toEqual({ status: 'unconfigured' });
  expect(configureBackend('https://example.supabase.co')).toMatchObject({ status: 'error' });
  expect(configureBackend('http://untrusted.test', 'sb_publishable_test')).toMatchObject({ status: 'error' });
  expect(configureBackend('https://example.supabase.co', 'sb_secret_test')).toMatchObject({ status: 'error' });
  const serviceKey = `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`;
  expect(configureBackend('https://example.supabase.co', serviceKey)).toMatchObject({ status: 'error' });
});
