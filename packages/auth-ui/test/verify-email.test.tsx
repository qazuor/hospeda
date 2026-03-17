/**
 * Tests for VerifyEmail component.
 *
 * Covers automatic verification on mount, loading/success/error states,
 * redirect behavior with delay, and callback invocations.
 *
 * @module verify-email.test
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifyEmail } from '../src/verify-email';

describe('VerifyEmail', () => {
    const createMockOnVerifyEmail = () =>
        vi
            .fn<
                (params: { token: string }) => Promise<{
                    data?: unknown;
                    error?: { message?: string; code?: string } | null;
                }>
            >()
            .mockResolvedValue({ data: {} });

    const mockLocationHref = vi.fn();

    beforeEach(() => {
        vi.restoreAllMocks();

        Object.defineProperty(window, 'location', {
            value: {
                href: '',
                replace: vi.fn(),
                pathname: '/'
            },
            writable: true,
            configurable: true
        });

        // Use a setter to track window.location.href assignments
        Object.defineProperty(window.location, 'href', {
            set: mockLocationHref,
            get: () => '',
            configurable: true
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows "Invalid or missing verification token" when token is empty', async () => {
        const mockOnVerifyEmail = createMockOnVerifyEmail();

        render(
            <VerifyEmail
                token=""
                onVerifyEmail={mockOnVerifyEmail}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Verification failed')).toBeInTheDocument();
        });

        expect(screen.getByText('Invalid or missing verification token')).toBeInTheDocument();

        expect(mockOnVerifyEmail).not.toHaveBeenCalled();
    });

    it('calls onVerifyEmail with token automatically on mount', async () => {
        const mockOnVerifyEmail = createMockOnVerifyEmail();

        render(
            <VerifyEmail
                token="my-verify-token"
                onVerifyEmail={mockOnVerifyEmail}
            />
        );

        await waitFor(() => {
            expect(mockOnVerifyEmail).toHaveBeenCalledWith({ token: 'my-verify-token' });
        });
    });

    it('shows loading state: "Verifying your email..." initially', () => {
        // Use a never-resolving promise to keep loading state
        const mockOnVerifyEmail = createMockOnVerifyEmail();
        mockOnVerifyEmail.mockReturnValue(new Promise(() => {}));

        render(
            <VerifyEmail
                token="valid-token"
                onVerifyEmail={mockOnVerifyEmail}
            />
        );

        expect(screen.getByText('Verifying your email...')).toBeInTheDocument();
        expect(
            screen.getByText('Please wait while we verify your email address.')
        ).toBeInTheDocument();
    });

    it('shows success state with "Email verified" and message', async () => {
        render(
            <VerifyEmail
                token="valid-token"
                onVerifyEmail={createMockOnVerifyEmail()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Email verified')).toBeInTheDocument();
        });

        const paragraph = screen.getByText(/Your email has been verified successfully/);
        expect(paragraph).toBeInTheDocument();
    });

    it('success state appends " Redirecting..." when redirectDelay > 0', async () => {
        render(
            <VerifyEmail
                token="valid-token"
                onVerifyEmail={createMockOnVerifyEmail()}
                redirectDelay={3000}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Email verified')).toBeInTheDocument();
        });

        const paragraph = screen.getByText(/Your email has been verified successfully/);
        expect(paragraph.textContent).toContain('Redirecting...');
    });

    it('success state does NOT show "Redirecting..." when redirectDelay is 0', async () => {
        render(
            <VerifyEmail
                token="valid-token"
                onVerifyEmail={createMockOnVerifyEmail()}
                redirectDelay={0}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Email verified')).toBeInTheDocument();
        });

        // The paragraph should contain just the success text without "Redirecting..."
        const paragraph = screen.getByText(/Your email has been verified successfully/);
        expect(paragraph.textContent).not.toContain('Redirecting...');
    });

    it('shows "Continue" button in success state', async () => {
        render(
            <VerifyEmail
                token="valid-token"
                onVerifyEmail={createMockOnVerifyEmail()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Continue')).toBeInTheDocument();
        });

        expect(screen.getByText('Continue')).toHaveAttribute('href', '/');
    });

    it('shows error with message: "Verification failed" heading and error body', async () => {
        const mockOnVerifyEmail = createMockOnVerifyEmail();
        mockOnVerifyEmail.mockResolvedValue({
            error: { message: 'Token has expired' }
        });

        render(
            <VerifyEmail
                token="expired-token"
                onVerifyEmail={mockOnVerifyEmail}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Verification failed')).toBeInTheDocument();
        });

        expect(screen.getByText('Token has expired')).toBeInTheDocument();
    });

    it('shows error without message: body shows "Verification failed"', async () => {
        const mockOnVerifyEmail = createMockOnVerifyEmail();
        mockOnVerifyEmail.mockResolvedValue({
            error: {}
        });

        render(
            <VerifyEmail
                token="bad-token"
                onVerifyEmail={mockOnVerifyEmail}
            />
        );

        await waitFor(() => {
            // Both the heading h3 and the error message p contain "Verification failed"
            const failedElements = screen.getAllByText('Verification failed');
            expect(failedElements.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('shows "An unexpected error occurred during verification." on exception', async () => {
        const mockOnVerifyEmail = createMockOnVerifyEmail();
        mockOnVerifyEmail.mockRejectedValue(new Error('Network error'));

        render(
            <VerifyEmail
                token="valid-token"
                onVerifyEmail={mockOnVerifyEmail}
            />
        );

        await waitFor(() => {
            expect(
                screen.getByText('An unexpected error occurred during verification.')
            ).toBeInTheDocument();
        });
    });

    it('all error states show retry hint about signing in again', async () => {
        const mockOnVerifyEmail = createMockOnVerifyEmail();
        mockOnVerifyEmail.mockResolvedValue({
            error: { message: 'Some error' }
        });

        render(
            <VerifyEmail
                token="bad-token"
                onVerifyEmail={mockOnVerifyEmail}
            />
        );

        await waitFor(() => {
            expect(
                screen.getByText('Please try signing in again to receive a new verification email.')
            ).toBeInTheDocument();
        });
    });

    it('calls onSuccess on successful verification', async () => {
        const onSuccess = vi.fn();

        render(
            <VerifyEmail
                token="valid-token"
                onVerifyEmail={createMockOnVerifyEmail()}
                onSuccess={onSuccess}
            />
        );

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledOnce();
        });
    });

    it('redirects to redirectTo via window.location.href after redirectDelay ms', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });

        render(
            <VerifyEmail
                token="valid-token"
                onVerifyEmail={createMockOnVerifyEmail()}
                redirectTo="/dashboard"
                redirectDelay={3000}
            />
        );

        // Wait for verification to complete
        await waitFor(() => {
            expect(screen.getByText('Email verified')).toBeInTheDocument();
        });

        // Not yet redirected
        expect(mockLocationHref).not.toHaveBeenCalled();

        // Advance timer past the delay
        vi.advanceTimersByTime(3000);

        expect(mockLocationHref).toHaveBeenCalledWith('/dashboard');
    });

    it('does not redirect when redirectDelay is 0', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });

        render(
            <VerifyEmail
                token="valid-token"
                onVerifyEmail={createMockOnVerifyEmail()}
                redirectTo="/dashboard"
                redirectDelay={0}
            />
        );

        // Wait for verification to complete
        await waitFor(() => {
            expect(screen.getByText('Email verified')).toBeInTheDocument();
        });

        // Advance time significantly
        vi.advanceTimersByTime(10000);

        expect(mockLocationHref).not.toHaveBeenCalled();
    });

    it('no token error also shows retry hint', async () => {
        render(
            <VerifyEmail
                token=""
                onVerifyEmail={createMockOnVerifyEmail()}
            />
        );

        await waitFor(() => {
            expect(
                screen.getByText('Please try signing in again to receive a new verification email.')
            ).toBeInTheDocument();
        });
    });

    it('exception error also shows retry hint', async () => {
        const mockOnVerifyEmail = createMockOnVerifyEmail();
        mockOnVerifyEmail.mockRejectedValue(new Error('Network error'));

        render(
            <VerifyEmail
                token="valid-token"
                onVerifyEmail={mockOnVerifyEmail}
            />
        );

        await waitFor(() => {
            expect(
                screen.getByText('Please try signing in again to receive a new verification email.')
            ).toBeInTheDocument();
        });
    });

    it('uses default redirectTo of "/" for Continue link', async () => {
        render(
            <VerifyEmail
                token="valid-token"
                onVerifyEmail={createMockOnVerifyEmail()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Continue')).toHaveAttribute('href', '/');
        });
    });

    it('uses custom redirectTo for Continue link', async () => {
        render(
            <VerifyEmail
                token="valid-token"
                onVerifyEmail={createMockOnVerifyEmail()}
                redirectTo="/home"
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Continue')).toHaveAttribute('href', '/home');
        });
    });
});
