/**
 * Tests for ForgotPasswordForm component.
 *
 * Covers form rendering, email submission, success/error states,
 * loading indicators, validation, and sign-in link.
 *
 * @module forgot-password-form.test
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordForm } from '../src/forgot-password-form';

describe('ForgotPasswordForm', () => {
    const createMockOnForgotPassword = () =>
        vi
            .fn<
                (params: { email: string; redirectTo: string }) => Promise<{
                    data?: unknown;
                    error?: { message?: string; code?: string } | null;
                }>
            >()
            .mockResolvedValue({ data: {} });

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('renders email field with placeholder "you@example.com"', () => {
        render(<ForgotPasswordForm onForgotPassword={createMockOnForgotPassword()} />);

        const emailInput = screen.getByPlaceholderText('you@example.com');
        expect(emailInput).toBeInTheDocument();
    });

    it('renders heading "Reset your password"', () => {
        render(<ForgotPasswordForm onForgotPassword={createMockOnForgotPassword()} />);

        expect(screen.getByText('Reset your password')).toBeInTheDocument();
    });

    it('renders "Back to sign in" link using signInUrl prop (default /auth/signin)', () => {
        render(<ForgotPasswordForm onForgotPassword={createMockOnForgotPassword()} />);

        const link = screen.getByText('Back to sign in');
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/auth/signin');
    });

    it('renders "Back to sign in" link with custom signInUrl', () => {
        render(
            <ForgotPasswordForm
                onForgotPassword={createMockOnForgotPassword()}
                signInUrl="/custom/signin"
            />
        );

        const link = screen.getByText('Back to sign in');
        expect(link).toHaveAttribute('href', '/custom/signin');
    });

    it('calls onForgotPassword with email and default redirectTo on submit', async () => {
        const user = userEvent.setup();
        const mockOnForgotPassword = createMockOnForgotPassword();

        render(<ForgotPasswordForm onForgotPassword={mockOnForgotPassword} />);

        await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
        await user.click(screen.getByRole('button', { name: 'Send reset link' }));

        await waitFor(() => {
            expect(mockOnForgotPassword).toHaveBeenCalledWith({
                email: 'test@example.com',
                redirectTo: '/auth/reset-password'
            });
        });
    });

    it('calls onForgotPassword with custom redirectTo', async () => {
        const user = userEvent.setup();
        const mockOnForgotPassword = createMockOnForgotPassword();

        render(
            <ForgotPasswordForm
                onForgotPassword={mockOnForgotPassword}
                redirectTo="/custom/reset"
            />
        );

        await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
        await user.click(screen.getByRole('button', { name: 'Send reset link' }));

        await waitFor(() => {
            expect(mockOnForgotPassword).toHaveBeenCalledWith({
                email: 'test@example.com',
                redirectTo: '/custom/reset'
            });
        });
    });

    it('shows success message after email is sent', async () => {
        const user = userEvent.setup();

        render(<ForgotPasswordForm onForgotPassword={createMockOnForgotPassword()} />);

        await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
        await user.click(screen.getByRole('button', { name: 'Send reset link' }));

        await waitFor(() => {
            expect(screen.getByText('Check your email')).toBeInTheDocument();
        });

        const paragraph = screen.getByText(/If an account exists for/);
        expect(paragraph.textContent).toContain(
            'If an account exists for test@example.com, you will receive a password reset link shortly.'
        );
    });

    it('shows error from result.error.message', async () => {
        const user = userEvent.setup();
        const mockOnForgotPassword = createMockOnForgotPassword();
        mockOnForgotPassword.mockResolvedValue({
            error: { message: 'Rate limit exceeded' }
        });

        render(<ForgotPasswordForm onForgotPassword={mockOnForgotPassword} />);

        await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
        await user.click(screen.getByRole('button', { name: 'Send reset link' }));

        await waitFor(() => {
            expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
        });
    });

    it('shows loading state: button shows "Sending..." during submit', async () => {
        const user = userEvent.setup();
        let resolvePromise: (value: { data?: unknown }) => void;
        const pendingPromise = new Promise<{ data?: unknown }>((resolve) => {
            resolvePromise = resolve;
        });
        const mockOnForgotPassword = createMockOnForgotPassword();
        mockOnForgotPassword.mockReturnValue(pendingPromise);

        render(<ForgotPasswordForm onForgotPassword={mockOnForgotPassword} />);

        await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
        await user.click(screen.getByRole('button', { name: 'Send reset link' }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Sending...' })).toBeInTheDocument();
        });

        // Resolve to clean up
        resolvePromise!({ data: {} });

        await waitFor(() => {
            expect(screen.getByText('Check your email')).toBeInTheDocument();
        });
    });

    it('validates empty email: shows "Please enter your email address"', async () => {
        const mockOnForgotPassword = createMockOnForgotPassword();

        render(<ForgotPasswordForm onForgotPassword={mockOnForgotPassword} />);

        const emailInput = screen.getByPlaceholderText('you@example.com');

        // The input is type="email" with required, so native validation prevents
        // empty submission. We fire a submit event directly on the form to bypass
        // native validation and reach the component's own !email.trim() check.
        const form = emailInput.closest('form') as HTMLFormElement;
        await act(async () => {
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(submitEvent);
        });

        await waitFor(() => {
            expect(screen.getByText('Please enter your email address')).toBeInTheDocument();
        });

        expect(mockOnForgotPassword).not.toHaveBeenCalled();
    });

    it('shows "An unexpected error..." on exception', async () => {
        const user = userEvent.setup();
        const mockOnForgotPassword = createMockOnForgotPassword();
        mockOnForgotPassword.mockRejectedValue(new Error('Network error'));

        render(<ForgotPasswordForm onForgotPassword={mockOnForgotPassword} />);

        await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
        await user.click(screen.getByRole('button', { name: 'Send reset link' }));

        await waitFor(() => {
            expect(
                screen.getByText('An unexpected error occurred. Please try again.')
            ).toBeInTheDocument();
        });
    });

    it('success state shows "Back to sign in" link with signInUrl', async () => {
        const user = userEvent.setup();

        render(
            <ForgotPasswordForm
                onForgotPassword={createMockOnForgotPassword()}
                signInUrl="/my-signin"
            />
        );

        await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
        await user.click(screen.getByRole('button', { name: 'Send reset link' }));

        await waitFor(() => {
            expect(screen.getByText('Check your email')).toBeInTheDocument();
        });

        const link = screen.getByText('Back to sign in');
        expect(link).toHaveAttribute('href', '/my-signin');
    });
});
