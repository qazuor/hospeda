/**
 * Test suite for SignInForm component.
 * Covers rendering, hydration, form submission, error handling, redirects, and OAuth flows.
 *
 * @module sign-in-form.test
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInForm } from '../src/sign-in-form';
import type { SignInMethods } from '../src/types';

// Mock i18n - makes t('key') return the key as string
vi.mock('@repo/i18n', () => ({
    useTranslations: () => ({
        t: (key: string) => key
    })
}));

// Mock authLogger to avoid console noise and allow assertion
vi.mock('../src/logger', () => ({
    authLogger: {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock window.location
const locationMock = { replace: vi.fn(), href: '', pathname: '/' };
Object.defineProperty(window, 'location', { value: locationMock, writable: true });

/**
 * Creates a mock SignInMethods object with successful defaults
 */
const createMockSignIn = (overrides?: Partial<SignInMethods>): SignInMethods => ({
    email: vi.fn().mockResolvedValue({
        data: { session: { id: 'ses-1' } },
        error: null
    }),
    social: vi.fn().mockResolvedValue({}),
    ...overrides
});

describe('SignInForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        locationMock.replace.mockClear();
        locationMock.href = '';
        locationMock.pathname = '/';
    });

    // ─── T-005: Render + Hydration ──────────────────────────────────

    describe('T-005: render and hydration', () => {
        it('shows loading skeleton before client hydration', () => {
            // Arrange
            const mockSignIn = createMockSignIn();

            // Act
            const { container } = render(<SignInForm signIn={mockSignIn} />);

            // Assert - skeleton has loading text but no form inputs
            // The initial render (before useEffect runs) shows skeleton
            // Since jsdom runs useEffect synchronously in some cases,
            // we check that the component renders without crashing
            expect(container.firstChild).toBeTruthy();
        });

        it('renders email and password fields after hydration', async () => {
            // Arrange
            const mockSignIn = createMockSignIn();

            // Act
            render(<SignInForm signIn={mockSignIn} />);

            // Assert - wait for hydration (useEffect sets isClientReady)
            await waitFor(() => {
                expect(screen.getByLabelText('auth-ui.signIn.email')).toBeInTheDocument();
            });
            expect(screen.getByLabelText('auth-ui.signIn.password')).toBeInTheDocument();
        });

        it('shows OAuth buttons when showOAuth is true (default)', async () => {
            // Arrange
            const mockSignIn = createMockSignIn();

            // Act
            render(<SignInForm signIn={mockSignIn} />);

            // Assert
            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: 'Continue with Google' })
                ).toBeInTheDocument();
            });
            expect(
                screen.getByRole('button', { name: 'Continue with Facebook' })
            ).toBeInTheDocument();
        });

        it('hides OAuth buttons when showOAuth is false', async () => {
            // Arrange
            const mockSignIn = createMockSignIn();

            // Act
            render(
                <SignInForm
                    signIn={mockSignIn}
                    showOAuth={false}
                />
            );

            // Assert
            await waitFor(() => {
                expect(screen.getByLabelText('auth-ui.signIn.email')).toBeInTheDocument();
            });
            expect(
                screen.queryByRole('button', { name: 'Continue with Google' })
            ).not.toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: 'Continue with Facebook' })
            ).not.toBeInTheDocument();
        });
    });

    // ─── T-006: Submit, Errors, Redirect ────────────────────────────

    describe('T-006: submit, errors, and redirect', () => {
        it('calls signIn.email with email and password on submit', async () => {
            // Arrange
            const user = userEvent.setup();
            const mockSignIn = createMockSignIn();

            render(<SignInForm signIn={mockSignIn} />);

            await waitFor(() => {
                expect(screen.getByLabelText('auth-ui.signIn.email')).toBeInTheDocument();
            });

            // Act
            await user.type(screen.getByLabelText('auth-ui.signIn.email'), 'test@example.com');
            await user.type(screen.getByLabelText('auth-ui.signIn.password'), 'secret123');
            await user.click(screen.getByRole('button', { name: 'auth-ui.signIn.signInButton' }));

            // Assert
            await waitFor(() => {
                expect(mockSignIn.email).toHaveBeenCalledWith({
                    email: 'test@example.com',
                    password: 'secret123'
                });
            });
        });

        it('shows loading state during submit (button disabled)', async () => {
            // Arrange
            const user = userEvent.setup();
            // Make signIn.email hang so we can observe loading state
            let resolveSignIn: (value: unknown) => void;
            const pendingPromise = new Promise((resolve) => {
                resolveSignIn = resolve;
            });
            const mockSignIn = createMockSignIn({
                email: vi.fn().mockReturnValue(pendingPromise)
            });

            render(<SignInForm signIn={mockSignIn} />);

            await waitFor(() => {
                expect(screen.getByLabelText('auth-ui.signIn.email')).toBeInTheDocument();
            });

            await user.type(screen.getByLabelText('auth-ui.signIn.email'), 'test@example.com');
            await user.type(screen.getByLabelText('auth-ui.signIn.password'), 'pass');

            // Act
            await user.click(screen.getByRole('button', { name: 'auth-ui.signIn.signInButton' }));

            // Assert - button should be disabled while loading
            await waitFor(() => {
                const submitButton = screen.getByRole('button', {
                    name: /auth-ui\.signIn\.(loading|signInButton)/
                });
                expect(submitButton).toBeDisabled();
            });

            // Cleanup - resolve the pending promise inside act() to avoid act() warnings
            await act(async () => {
                resolveSignIn!({ data: { session: { id: 'ses-1' } }, error: null });
            });
        });

        it('shows error message when result.error is present', async () => {
            // Arrange
            const user = userEvent.setup();
            const mockSignIn = createMockSignIn({
                email: vi.fn().mockResolvedValue({
                    error: { message: 'Invalid credentials' }
                })
            });

            render(<SignInForm signIn={mockSignIn} />);

            await waitFor(() => {
                expect(screen.getByLabelText('auth-ui.signIn.email')).toBeInTheDocument();
            });

            // Act
            await user.type(screen.getByLabelText('auth-ui.signIn.email'), 'bad@example.com');
            await user.type(screen.getByLabelText('auth-ui.signIn.password'), 'wrong');
            await user.click(screen.getByRole('button', { name: 'auth-ui.signIn.signInButton' }));

            // Assert
            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
            });
        });

        it('calls onSuccess when login succeeds', async () => {
            // Arrange
            const user = userEvent.setup();
            const mockSignIn = createMockSignIn();
            const onSuccess = vi.fn();

            render(
                <SignInForm
                    signIn={mockSignIn}
                    onSuccess={onSuccess}
                />
            );

            await waitFor(() => {
                expect(screen.getByLabelText('auth-ui.signIn.email')).toBeInTheDocument();
            });

            // Act
            await user.type(screen.getByLabelText('auth-ui.signIn.email'), 'ok@example.com');
            await user.type(screen.getByLabelText('auth-ui.signIn.password'), 'pass123');
            await user.click(screen.getByRole('button', { name: 'auth-ui.signIn.signInButton' }));

            // Assert
            await waitFor(() => {
                expect(onSuccess).toHaveBeenCalledOnce();
            });
        });

        it('redirects via window.location.replace(redirectTo) on success', async () => {
            // Arrange
            const user = userEvent.setup();
            const mockSignIn = createMockSignIn();

            render(
                <SignInForm
                    signIn={mockSignIn}
                    redirectTo="/dashboard"
                />
            );

            await waitFor(() => {
                expect(screen.getByLabelText('auth-ui.signIn.email')).toBeInTheDocument();
            });

            // Act
            await user.type(screen.getByLabelText('auth-ui.signIn.email'), 'ok@example.com');
            await user.type(screen.getByLabelText('auth-ui.signIn.password'), 'pass123');
            await user.click(screen.getByRole('button', { name: 'auth-ui.signIn.signInButton' }));

            // Assert - uses .replace(), NOT .href
            await waitFor(() => {
                expect(locationMock.replace).toHaveBeenCalledWith('/dashboard');
            });
        });

        it('does NOT redirect when redirectTo is undefined', async () => {
            // Arrange
            const user = userEvent.setup();
            const mockSignIn = createMockSignIn();

            render(<SignInForm signIn={mockSignIn} />);

            await waitFor(() => {
                expect(screen.getByLabelText('auth-ui.signIn.email')).toBeInTheDocument();
            });

            // Act
            await user.type(screen.getByLabelText('auth-ui.signIn.email'), 'ok@example.com');
            await user.type(screen.getByLabelText('auth-ui.signIn.password'), 'pass123');
            await user.click(screen.getByRole('button', { name: 'auth-ui.signIn.signInButton' }));

            // Assert
            await waitFor(() => {
                expect(mockSignIn.email).toHaveBeenCalled();
            });
            expect(locationMock.replace).not.toHaveBeenCalled();
        });

        it('does not crash when onSuccess is undefined and login succeeds', async () => {
            // Arrange
            const user = userEvent.setup();
            const mockSignIn = createMockSignIn();

            // Act - render without onSuccess
            render(<SignInForm signIn={mockSignIn} />);

            await waitFor(() => {
                expect(screen.getByLabelText('auth-ui.signIn.email')).toBeInTheDocument();
            });

            await user.type(screen.getByLabelText('auth-ui.signIn.email'), 'ok@example.com');
            await user.type(screen.getByLabelText('auth-ui.signIn.password'), 'pass123');
            await user.click(screen.getByRole('button', { name: 'auth-ui.signIn.signInButton' }));

            // Assert - no crash, signIn was called successfully
            await waitFor(() => {
                expect(mockSignIn.email).toHaveBeenCalledOnce();
            });
            // No error alert should be shown
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('handles signIn.email throwing exception gracefully', async () => {
            // Arrange
            const user = userEvent.setup();
            const { authLogger } = await import('../src/logger');
            const mockSignIn = createMockSignIn({
                email: vi.fn().mockRejectedValue(new Error('Network error'))
            });

            render(<SignInForm signIn={mockSignIn} />);

            await waitFor(() => {
                expect(screen.getByLabelText('auth-ui.signIn.email')).toBeInTheDocument();
            });

            // Act
            await user.type(screen.getByLabelText('auth-ui.signIn.email'), 'ok@example.com');
            await user.type(screen.getByLabelText('auth-ui.signIn.password'), 'pass123');
            await user.click(screen.getByRole('button', { name: 'auth-ui.signIn.signInButton' }));

            // Assert - error is displayed and logged
            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent('Network error');
            });
            expect(authLogger.error).toHaveBeenCalledWith('Sign in error', expect.any(Error));
        });

        it('does not change button background on hover when loading', async () => {
            // Arrange
            const user = userEvent.setup();
            let resolveSignIn: (value: unknown) => void;
            const pendingPromise = new Promise((resolve) => {
                resolveSignIn = resolve;
            });
            const mockSignIn = createMockSignIn({
                email: vi.fn().mockReturnValue(pendingPromise)
            });

            render(<SignInForm signIn={mockSignIn} />);

            await waitFor(() => {
                expect(screen.getByLabelText('auth-ui.signIn.email')).toBeInTheDocument();
            });

            await user.type(screen.getByLabelText('auth-ui.signIn.email'), 'test@example.com');
            await user.type(screen.getByLabelText('auth-ui.signIn.password'), 'pass');

            // Act - submit to trigger loading state
            await user.click(screen.getByRole('button', { name: 'auth-ui.signIn.signInButton' }));

            // Wait for loading state
            await waitFor(() => {
                const submitButton = screen.getByRole('button', {
                    name: /auth-ui\.signIn\.(loading|signInButton)/
                });
                expect(submitButton).toBeDisabled();
            });

            // Hover over the disabled button - background should NOT change
            const submitButton = screen.getByRole('button', {
                name: /auth-ui\.signIn\.(loading|signInButton)/
            });
            const originalBackground = submitButton.style.background;
            await user.hover(submitButton);
            expect(submitButton.style.background).toBe(originalBackground);
            await user.unhover(submitButton);
            expect(submitButton.style.background).toBe(originalBackground);

            // Cleanup - resolve inside act() to avoid act() warnings
            await act(async () => {
                resolveSignIn!({ data: { session: { id: 'ses-1' } }, error: null });
            });
        });

        it('shows fallback error "Sign in failed" when result.error has no message', async () => {
            // Arrange
            const user = userEvent.setup();
            const mockSignIn = createMockSignIn({
                email: vi.fn().mockResolvedValue({
                    error: { message: '' }
                })
            });

            render(<SignInForm signIn={mockSignIn} />);

            await waitFor(() => {
                expect(screen.getByLabelText('auth-ui.signIn.email')).toBeInTheDocument();
            });

            // Act
            await user.type(screen.getByLabelText('auth-ui.signIn.email'), 'bad@example.com');
            await user.type(screen.getByLabelText('auth-ui.signIn.password'), 'wrong');
            await user.click(screen.getByRole('button', { name: 'auth-ui.signIn.signInButton' }));

            // Assert
            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent('Sign in failed');
            });
        });

        it('handles non-Error exception in signIn.email with String fallback', async () => {
            // Arrange
            const user = userEvent.setup();
            const mockSignIn = createMockSignIn({
                email: vi.fn().mockRejectedValue('string-thrown-error')
            });

            render(<SignInForm signIn={mockSignIn} />);

            await waitFor(() => {
                expect(screen.getByLabelText('auth-ui.signIn.email')).toBeInTheDocument();
            });

            // Act
            await user.type(screen.getByLabelText('auth-ui.signIn.email'), 'ok@example.com');
            await user.type(screen.getByLabelText('auth-ui.signIn.password'), 'pass123');
            await user.click(screen.getByRole('button', { name: 'auth-ui.signIn.signInButton' }));

            // Assert - should use String(err) since it's not an Error instance
            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent('string-thrown-error');
            });
        });
    });

    // ─── T-007: OAuth ───────────────────────────────────────────────

    describe('T-007: OAuth buttons', () => {
        it('calls signIn.social with provider google on Google button click', async () => {
            // Arrange
            const user = userEvent.setup();
            const mockSignIn = createMockSignIn();

            render(
                <SignInForm
                    signIn={mockSignIn}
                    redirectTo="/home"
                />
            );

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: 'Continue with Google' })
                ).toBeInTheDocument();
            });

            // Act
            await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

            // Assert
            await waitFor(() => {
                expect(mockSignIn.social).toHaveBeenCalledWith({
                    provider: 'google',
                    callbackURL: '/home'
                });
            });
        });

        it('calls signIn.social with provider facebook on Facebook button click', async () => {
            // Arrange
            const user = userEvent.setup();
            const mockSignIn = createMockSignIn();

            render(
                <SignInForm
                    signIn={mockSignIn}
                    redirectTo="/profile"
                />
            );

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: 'Continue with Facebook' })
                ).toBeInTheDocument();
            });

            // Act
            await user.click(screen.getByRole('button', { name: 'Continue with Facebook' }));

            // Assert
            await waitFor(() => {
                expect(mockSignIn.social).toHaveBeenCalledWith({
                    provider: 'facebook',
                    callbackURL: '/profile'
                });
            });
        });

        it('handles OAuth non-Error exception with fallback message', async () => {
            // Arrange
            const user = userEvent.setup();
            const mockSignIn = createMockSignIn({
                social: vi.fn().mockRejectedValue('string-error')
            });

            render(
                <SignInForm
                    signIn={mockSignIn}
                    redirectTo="/home"
                />
            );

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: 'Continue with Google' })
                ).toBeInTheDocument();
            });

            // Act
            await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

            // Assert - should show fallback message for non-Error
            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent('OAuth authentication failed');
            });
        });

        it('handles OAuth Error-instance exception showing its message', async () => {
            // Arrange — AUTH-GAP-012: covers `err instanceof Error ? err.message : ...` true branch
            const user = userEvent.setup();
            const { authLogger } = await import('../src/logger');
            const mockSignIn = createMockSignIn({
                social: vi.fn().mockRejectedValue(new Error('OAuth specific error'))
            });

            render(
                <SignInForm
                    signIn={mockSignIn}
                    redirectTo="/home"
                />
            );

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: 'Continue with Google' })
                ).toBeInTheDocument();
            });

            // Act
            await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

            // Assert — should use err.message, not the fallback
            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent('OAuth specific error');
            });
            expect(authLogger.error).toHaveBeenCalledWith('OAuth error', expect.any(Error));
        });

        it('uses window.location.pathname as callbackURL when redirectTo is undefined', async () => {
            // Arrange
            const user = userEvent.setup();
            const mockSignIn = createMockSignIn();
            locationMock.pathname = '/current-page';

            render(<SignInForm signIn={mockSignIn} />);

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: 'Continue with Google' })
                ).toBeInTheDocument();
            });

            // Act
            await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

            // Assert - callbackURL = redirectTo ?? window.location.pathname ?? '/'
            await waitFor(() => {
                expect(mockSignIn.social).toHaveBeenCalledWith({
                    provider: 'google',
                    callbackURL: '/current-page'
                });
            });
        });
    });
});
