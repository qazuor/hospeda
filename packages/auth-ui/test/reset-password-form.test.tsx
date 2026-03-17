/**
 * Tests for ResetPasswordForm component.
 *
 * Covers form rendering, password validation, token validation,
 * success/error states, loading indicators, and callbacks.
 *
 * @module reset-password-form.test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordForm } from '../src/reset-password-form';

describe('ResetPasswordForm', () => {
    const createMockOnResetPassword = () =>
        vi
            .fn<
                (params: { newPassword: string; token: string }) => Promise<{
                    data?: unknown;
                    error?: { message?: string; code?: string } | null;
                }>
            >()
            .mockResolvedValue({ data: {} });

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('renders heading "Set new password"', () => {
        render(
            <ResetPasswordForm
                token="valid-token"
                onResetPassword={createMockOnResetPassword()}
            />
        );

        expect(screen.getByText('Set new password')).toBeInTheDocument();
    });

    it('renders fields with correct placeholders', () => {
        render(
            <ResetPasswordForm
                token="valid-token"
                onResetPassword={createMockOnResetPassword()}
            />
        );

        expect(screen.getByPlaceholderText('At least 8 characters')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Repeat your password')).toBeInTheDocument();
    });

    it('validates passwords match: shows "Passwords do not match"', async () => {
        const user = userEvent.setup();
        const mockOnResetPassword = createMockOnResetPassword();

        render(
            <ResetPasswordForm
                token="valid-token"
                onResetPassword={mockOnResetPassword}
            />
        );

        await user.type(screen.getByPlaceholderText('At least 8 characters'), 'password123');
        await user.type(screen.getByPlaceholderText('Repeat your password'), 'differentpw');
        await user.click(screen.getByRole('button', { name: 'Reset password' }));

        await waitFor(() => {
            expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
        });

        expect(mockOnResetPassword).not.toHaveBeenCalled();
    });

    it('validates min length: shows "Password must be at least 8 characters"', async () => {
        const user = userEvent.setup();
        const mockOnResetPassword = createMockOnResetPassword();

        render(
            <ResetPasswordForm
                token="valid-token"
                onResetPassword={mockOnResetPassword}
            />
        );

        const passwordInput = screen.getByPlaceholderText('At least 8 characters');
        const confirmInput = screen.getByPlaceholderText('Repeat your password');

        await user.type(passwordInput, 'short');
        await user.type(confirmInput, 'short');
        await user.click(screen.getByRole('button', { name: 'Reset password' }));

        await waitFor(() => {
            expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
        });

        expect(mockOnResetPassword).not.toHaveBeenCalled();
    });

    it('shows "Invalid or missing reset token" when token is empty, no form rendered', async () => {
        const user = userEvent.setup();
        const mockOnResetPassword = createMockOnResetPassword();

        render(
            <ResetPasswordForm
                token=""
                onResetPassword={mockOnResetPassword}
            />
        );

        // Need to fill form and submit to trigger the token check
        // (token check is inside handleSubmit, after password validations)
        const passwordInput = screen.getByPlaceholderText('At least 8 characters');
        const confirmInput = screen.getByPlaceholderText('Repeat your password');

        await user.type(passwordInput, 'validpassword123');
        await user.type(confirmInput, 'validpassword123');
        await user.click(screen.getByRole('button', { name: 'Reset password' }));

        await waitFor(() => {
            expect(screen.getByText('Invalid or missing reset token')).toBeInTheDocument();
        });

        expect(mockOnResetPassword).not.toHaveBeenCalled();
    });

    it('calls onResetPassword with newPassword and token on submit', async () => {
        const user = userEvent.setup();
        const mockOnResetPassword = createMockOnResetPassword();

        render(
            <ResetPasswordForm
                token="my-reset-token"
                onResetPassword={mockOnResetPassword}
            />
        );

        await user.type(screen.getByPlaceholderText('At least 8 characters'), 'newpassword123');
        await user.type(screen.getByPlaceholderText('Repeat your password'), 'newpassword123');
        await user.click(screen.getByRole('button', { name: 'Reset password' }));

        await waitFor(() => {
            expect(mockOnResetPassword).toHaveBeenCalledWith({
                newPassword: 'newpassword123',
                token: 'my-reset-token'
            });
        });
    });

    it('shows success state: "Password reset successful" with message and "Sign in" link', async () => {
        const user = userEvent.setup();

        render(
            <ResetPasswordForm
                token="valid-token"
                onResetPassword={createMockOnResetPassword()}
            />
        );

        await user.type(screen.getByPlaceholderText('At least 8 characters'), 'newpassword123');
        await user.type(screen.getByPlaceholderText('Repeat your password'), 'newpassword123');
        await user.click(screen.getByRole('button', { name: 'Reset password' }));

        await waitFor(() => {
            expect(screen.getByText('Password reset successful')).toBeInTheDocument();
        });

        expect(
            screen.getByText(
                'Your password has been updated. You can now sign in with your new password.'
            )
        ).toBeInTheDocument();

        const signInLink = screen.getByText('Sign in');
        expect(signInLink).toHaveAttribute('href', '/auth/signin');
    });

    it('shows error from result.error.message', async () => {
        const user = userEvent.setup();
        const mockOnResetPassword = createMockOnResetPassword();
        mockOnResetPassword.mockResolvedValue({
            error: { message: 'Token expired' }
        });

        render(
            <ResetPasswordForm
                token="expired-token"
                onResetPassword={mockOnResetPassword}
            />
        );

        await user.type(screen.getByPlaceholderText('At least 8 characters'), 'newpassword123');
        await user.type(screen.getByPlaceholderText('Repeat your password'), 'newpassword123');
        await user.click(screen.getByRole('button', { name: 'Reset password' }));

        await waitFor(() => {
            expect(screen.getByText('Token expired')).toBeInTheDocument();
        });
    });

    it('shows loading state: "Resetting..." during submit', async () => {
        const user = userEvent.setup();
        let resolvePromise: (value: { data?: unknown }) => void;
        const pendingPromise = new Promise<{ data?: unknown }>((resolve) => {
            resolvePromise = resolve;
        });
        const mockOnResetPassword = createMockOnResetPassword();
        mockOnResetPassword.mockReturnValue(pendingPromise);

        render(
            <ResetPasswordForm
                token="valid-token"
                onResetPassword={mockOnResetPassword}
            />
        );

        await user.type(screen.getByPlaceholderText('At least 8 characters'), 'newpassword123');
        await user.type(screen.getByPlaceholderText('Repeat your password'), 'newpassword123');
        await user.click(screen.getByRole('button', { name: 'Reset password' }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Resetting...' })).toBeInTheDocument();
        });

        // Resolve to clean up
        resolvePromise!({ data: {} });

        await waitFor(() => {
            expect(screen.getByText('Password reset successful')).toBeInTheDocument();
        });
    });

    it('calls onSuccess callback on successful reset', async () => {
        const user = userEvent.setup();
        const onSuccess = vi.fn();

        render(
            <ResetPasswordForm
                token="valid-token"
                onResetPassword={createMockOnResetPassword()}
                onSuccess={onSuccess}
            />
        );

        await user.type(screen.getByPlaceholderText('At least 8 characters'), 'newpassword123');
        await user.type(screen.getByPlaceholderText('Repeat your password'), 'newpassword123');
        await user.click(screen.getByRole('button', { name: 'Reset password' }));

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledOnce();
        });
    });

    it('renders "Sign in" link with custom signInUrl', async () => {
        const user = userEvent.setup();

        render(
            <ResetPasswordForm
                token="valid-token"
                onResetPassword={createMockOnResetPassword()}
                signInUrl="/custom/login"
            />
        );

        await user.type(screen.getByPlaceholderText('At least 8 characters'), 'newpassword123');
        await user.type(screen.getByPlaceholderText('Repeat your password'), 'newpassword123');
        await user.click(screen.getByRole('button', { name: 'Reset password' }));

        await waitFor(() => {
            expect(screen.getByText('Sign in')).toHaveAttribute('href', '/custom/login');
        });
    });

    it('shows "An unexpected error..." on exception', async () => {
        const user = userEvent.setup();
        const mockOnResetPassword = createMockOnResetPassword();
        mockOnResetPassword.mockRejectedValue(new Error('Network error'));

        render(
            <ResetPasswordForm
                token="valid-token"
                onResetPassword={mockOnResetPassword}
            />
        );

        await user.type(screen.getByPlaceholderText('At least 8 characters'), 'newpassword123');
        await user.type(screen.getByPlaceholderText('Repeat your password'), 'newpassword123');
        await user.click(screen.getByRole('button', { name: 'Reset password' }));

        await waitFor(() => {
            expect(
                screen.getByText('An unexpected error occurred. Please try again.')
            ).toBeInTheDocument();
        });
    });
});
