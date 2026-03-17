/**
 * Tests for SignUpForm component.
 *
 * Covers hydration skeleton, email/password sign-up, OAuth buttons,
 * error handling, loading states, and redirect behavior.
 *
 * @module sign-up-form.test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResult, SignInMethods, SignUpMethods } from '../src/types';

// Mock i18n - returns the key as-is
vi.mock('@repo/i18n', () => ({
    useTranslations: () => ({
        t: (key: string) => key
    })
}));

// Mock authLogger
vi.mock('../src/logger', () => ({
    authLogger: {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Helper to import after mocks are set up
const importSignUpForm = async () => {
    const mod = await import('../src/sign-up-form');
    return mod.SignUpForm;
};

describe('SignUpForm', () => {
    const mockLocationReplace = vi.fn();

    const createMockSignUp = (): SignUpMethods => ({
        email: vi
            .fn<
                (params: { email: string; password: string; name: string }) => Promise<AuthResult>
            >()
            .mockResolvedValue({
                data: { session: { id: 'sess-1' }, user: { id: 'u-1', email: 'test@example.com' } }
            })
    });

    const createMockSignIn = (): Pick<SignInMethods, 'social'> => ({
        social: vi
            .fn<(params: { provider: string; callbackURL: string }) => Promise<unknown>>()
            .mockResolvedValue({})
    });

    beforeEach(() => {
        vi.restoreAllMocks();

        Object.defineProperty(window, 'location', {
            value: {
                replace: mockLocationReplace,
                href: '',
                pathname: '/'
            },
            writable: true,
            configurable: true
        });
    });

    it('shows skeleton before hydration (isClientReady pattern)', async () => {
        const SignUpForm = await importSignUpForm();
        const { container } = render(
            <SignUpForm
                signUp={createMockSignUp()}
                signIn={createMockSignIn()}
            />
        );

        // The skeleton includes loading text and placeholder divs
        // After useEffect fires, the real form replaces it
        // We verify the form eventually renders
        await waitFor(() => {
            expect(screen.getByLabelText(/auth-ui\.signUp\.name/i)).toBeInTheDocument();
        });

        // Verify the skeleton is gone (no more placeholder divs with bg-gray-50)
        expect(container.querySelector('.bg-gray-50')).not.toBeInTheDocument();
    });

    it('renders name, email, and password fields after hydration', async () => {
        const SignUpForm = await importSignUpForm();
        render(
            <SignUpForm
                signUp={createMockSignUp()}
                signIn={createMockSignIn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/auth-ui\.signUp\.name/i)).toBeInTheDocument();
        });

        expect(screen.getByLabelText(/auth-ui\.signUp\.email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/auth-ui\.signUp\.password/i)).toBeInTheDocument();
    });

    it('calls signUp.email with name, email, and password on submit', async () => {
        const user = userEvent.setup();
        const mockSignUp = createMockSignUp();
        const SignUpForm = await importSignUpForm();

        render(
            <SignUpForm
                signUp={mockSignUp}
                signIn={createMockSignIn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/auth-ui\.signUp\.name/i)).toBeInTheDocument();
        });

        await user.type(screen.getByLabelText(/auth-ui\.signUp\.name/i), 'John Doe');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.email/i), 'john@example.com');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.password/i), 'securepassword123');

        await user.click(screen.getByRole('button', { name: /auth-ui\.signUp\.signUpButton/i }));

        await waitFor(() => {
            expect(mockSignUp.email).toHaveBeenCalledWith({
                name: 'John Doe',
                email: 'john@example.com',
                password: 'securepassword123'
            });
        });
    });

    it('shows error on failure (result.error.message)', async () => {
        const user = userEvent.setup();
        const mockSignUp = createMockSignUp();
        vi.mocked(mockSignUp.email).mockResolvedValue({
            error: { message: 'Email already registered' }
        });
        const SignUpForm = await importSignUpForm();

        render(
            <SignUpForm
                signUp={mockSignUp}
                signIn={createMockSignIn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/auth-ui\.signUp\.name/i)).toBeInTheDocument();
        });

        await user.type(screen.getByLabelText(/auth-ui\.signUp\.name/i), 'John');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.email/i), 'john@example.com');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.password/i), 'password123');
        await user.click(screen.getByRole('button', { name: /auth-ui\.signUp\.signUpButton/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Email already registered');
        });
    });

    it('shows loading state during submit', async () => {
        const user = userEvent.setup();
        let resolveSignUp: (value: AuthResult) => void;
        const signUpPromise = new Promise<AuthResult>((resolve) => {
            resolveSignUp = resolve;
        });
        const mockSignUp = createMockSignUp();
        vi.mocked(mockSignUp.email).mockReturnValue(signUpPromise);
        const SignUpForm = await importSignUpForm();

        render(
            <SignUpForm
                signUp={mockSignUp}
                signIn={createMockSignIn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/auth-ui\.signUp\.name/i)).toBeInTheDocument();
        });

        await user.type(screen.getByLabelText(/auth-ui\.signUp\.name/i), 'John');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.email/i), 'john@example.com');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.password/i), 'password123');
        await user.click(screen.getByRole('button', { name: /auth-ui\.signUp\.signUpButton/i }));

        await waitFor(() => {
            expect(screen.getByText(/auth-ui\.signUp\.loading/i)).toBeInTheDocument();
        });

        // Resolve to clean up
        resolveSignUp!({ data: null });

        await waitFor(() => {
            expect(screen.getByText(/auth-ui\.signUp\.signUpButton/i)).toBeInTheDocument();
        });
    });

    it('shows OAuth buttons when showOAuth is true (default)', async () => {
        const SignUpForm = await importSignUpForm();
        render(
            <SignUpForm
                signUp={createMockSignUp()}
                signIn={createMockSignIn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText('Sign up with Google')).toBeInTheDocument();
        });

        expect(screen.getByLabelText('Sign up with Facebook')).toBeInTheDocument();
    });

    it('hides OAuth buttons when showOAuth is false', async () => {
        const SignUpForm = await importSignUpForm();
        render(
            <SignUpForm
                signUp={createMockSignUp()}
                signIn={createMockSignIn()}
                showOAuth={false}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/auth-ui\.signUp\.name/i)).toBeInTheDocument();
        });

        expect(screen.queryByLabelText('Sign up with Google')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Sign up with Facebook')).not.toBeInTheDocument();
    });

    it('calls signIn.social for Google OAuth', async () => {
        const user = userEvent.setup();
        const mockSignIn = createMockSignIn();
        const SignUpForm = await importSignUpForm();

        render(
            <SignUpForm
                signUp={createMockSignUp()}
                signIn={mockSignIn}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText('Sign up with Google')).toBeInTheDocument();
        });

        await user.click(screen.getByLabelText('Sign up with Google'));

        await waitFor(() => {
            expect(mockSignIn.social).toHaveBeenCalledWith({
                provider: 'google',
                callbackURL: '/'
            });
        });
    });

    it('calls signIn.social for Facebook OAuth', async () => {
        const user = userEvent.setup();
        const mockSignIn = createMockSignIn();
        const SignUpForm = await importSignUpForm();

        render(
            <SignUpForm
                signUp={createMockSignUp()}
                signIn={mockSignIn}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText('Sign up with Facebook')).toBeInTheDocument();
        });

        await user.click(screen.getByLabelText('Sign up with Facebook'));

        await waitFor(() => {
            expect(mockSignIn.social).toHaveBeenCalledWith({
                provider: 'facebook',
                callbackURL: '/'
            });
        });
    });

    it('calls onSuccess on successful sign-up', async () => {
        const user = userEvent.setup();
        const onSuccess = vi.fn();
        const SignUpForm = await importSignUpForm();

        render(
            <SignUpForm
                signUp={createMockSignUp()}
                signIn={createMockSignIn()}
                onSuccess={onSuccess}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/auth-ui\.signUp\.name/i)).toBeInTheDocument();
        });

        await user.type(screen.getByLabelText(/auth-ui\.signUp\.name/i), 'John');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.email/i), 'john@example.com');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.password/i), 'password123');
        await user.click(screen.getByRole('button', { name: /auth-ui\.signUp\.signUpButton/i }));

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledOnce();
        });
    });

    it('redirects via window.location.replace on success with redirectTo', async () => {
        const user = userEvent.setup();
        const SignUpForm = await importSignUpForm();

        render(
            <SignUpForm
                signUp={createMockSignUp()}
                signIn={createMockSignIn()}
                redirectTo="/dashboard"
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/auth-ui\.signUp\.name/i)).toBeInTheDocument();
        });

        await user.type(screen.getByLabelText(/auth-ui\.signUp\.name/i), 'John');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.email/i), 'john@example.com');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.password/i), 'password123');
        await user.click(screen.getByRole('button', { name: /auth-ui\.signUp\.signUpButton/i }));

        await waitFor(() => {
            expect(mockLocationReplace).toHaveBeenCalledWith('/dashboard');
        });
    });

    it('handles signUp.email exception gracefully', async () => {
        const user = userEvent.setup();
        const mockSignUp = createMockSignUp();
        const thrownError = new Error('Network failure');
        vi.mocked(mockSignUp.email).mockRejectedValue(thrownError);
        const SignUpForm = await importSignUpForm();

        const { authLogger } = await import('../src/logger');

        render(
            <SignUpForm
                signUp={mockSignUp}
                signIn={createMockSignIn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/auth-ui\.signUp\.name/i)).toBeInTheDocument();
        });

        await user.type(screen.getByLabelText(/auth-ui\.signUp\.name/i), 'John');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.email/i), 'john@example.com');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.password/i), 'password123');
        await user.click(screen.getByRole('button', { name: /auth-ui\.signUp\.signUpButton/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Network failure');
        });

        expect(authLogger.error).toHaveBeenCalledWith('Sign up error', thrownError);
    });

    it('handles OAuth non-Error exception with fallback message', async () => {
        const user = userEvent.setup();
        const mockSignIn = createMockSignIn();
        vi.mocked(mockSignIn.social).mockRejectedValue('string-error');
        const SignUpForm = await importSignUpForm();

        render(
            <SignUpForm
                signUp={createMockSignUp()}
                signIn={mockSignIn}
                redirectTo="/home"
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText('Sign up with Google')).toBeInTheDocument();
        });

        await user.click(screen.getByLabelText('Sign up with Google'));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('OAuth authentication failed');
        });
    });

    it('does not change submit button background on hover when loading', async () => {
        const user = userEvent.setup();
        let resolveSignUp: (value: AuthResult) => void;
        const signUpPromise = new Promise<AuthResult>((resolve) => {
            resolveSignUp = resolve;
        });
        const mockSignUp = createMockSignUp();
        vi.mocked(mockSignUp.email).mockReturnValue(signUpPromise);
        const SignUpForm = await importSignUpForm();

        render(
            <SignUpForm
                signUp={mockSignUp}
                signIn={createMockSignIn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/auth-ui\.signUp\.name/i)).toBeInTheDocument();
        });

        await user.type(screen.getByLabelText(/auth-ui\.signUp\.name/i), 'John');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.email/i), 'john@example.com');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.password/i), 'password123');
        await user.click(screen.getByRole('button', { name: /auth-ui\.signUp\.signUpButton/i }));

        // Wait for loading state
        await waitFor(() => {
            expect(screen.getByText(/auth-ui\.signUp\.loading/i)).toBeInTheDocument();
        });

        // Hover over the disabled button - background should NOT change
        const submitButton = screen.getByRole('button', {
            name: /auth-ui\.signUp\.(loading|signUpButton)/
        });
        const originalBackground = submitButton.style.background;
        await user.hover(submitButton);
        expect(submitButton.style.background).toBe(originalBackground);
        await user.unhover(submitButton);
        expect(submitButton.style.background).toBe(originalBackground);

        // Cleanup
        resolveSignUp!({ data: null });
    });

    it('shows fallback error "Sign up failed" when result.error has no message', async () => {
        const user = userEvent.setup();
        const mockSignUp = createMockSignUp();
        vi.mocked(mockSignUp.email).mockResolvedValue({
            error: { message: '' }
        });
        const SignUpForm = await importSignUpForm();

        render(
            <SignUpForm
                signUp={mockSignUp}
                signIn={createMockSignIn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/auth-ui\.signUp\.name/i)).toBeInTheDocument();
        });

        await user.type(screen.getByLabelText(/auth-ui\.signUp\.name/i), 'John');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.email/i), 'john@example.com');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.password/i), 'password123');
        await user.click(screen.getByRole('button', { name: /auth-ui\.signUp\.signUpButton/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Sign up failed');
        });
    });

    it('handles non-Error exception in signUp.email with String fallback', async () => {
        const user = userEvent.setup();
        const mockSignUp = createMockSignUp();
        vi.mocked(mockSignUp.email).mockRejectedValue('string-thrown-error');
        const SignUpForm = await importSignUpForm();

        const { authLogger } = await import('../src/logger');

        render(
            <SignUpForm
                signUp={mockSignUp}
                signIn={createMockSignIn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/auth-ui\.signUp\.name/i)).toBeInTheDocument();
        });

        await user.type(screen.getByLabelText(/auth-ui\.signUp\.name/i), 'John');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.email/i), 'john@example.com');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.password/i), 'password123');
        await user.click(screen.getByRole('button', { name: /auth-ui\.signUp\.signUpButton/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('string-thrown-error');
        });

        expect(authLogger.error).toHaveBeenCalledWith('Sign up error', 'string-thrown-error');
    });

    it('does not redirect when redirectTo is undefined on success', async () => {
        const user = userEvent.setup();
        const SignUpForm = await importSignUpForm();

        render(
            <SignUpForm
                signUp={createMockSignUp()}
                signIn={createMockSignIn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/auth-ui\.signUp\.name/i)).toBeInTheDocument();
        });

        await user.type(screen.getByLabelText(/auth-ui\.signUp\.name/i), 'John');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.email/i), 'john@example.com');
        await user.type(screen.getByLabelText(/auth-ui\.signUp\.password/i), 'password123');
        await user.click(screen.getByRole('button', { name: /auth-ui\.signUp\.signUpButton/i }));

        await waitFor(() => {
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
        expect(mockLocationReplace).not.toHaveBeenCalled();
    });

    it('uses redirectTo as callbackURL for OAuth when provided', async () => {
        const user = userEvent.setup();
        const mockSignIn = createMockSignIn();
        const SignUpForm = await importSignUpForm();

        render(
            <SignUpForm
                signUp={createMockSignUp()}
                signIn={mockSignIn}
                redirectTo="/my-redirect"
            />
        );

        await waitFor(() => {
            expect(screen.getByLabelText('Sign up with Google')).toBeInTheDocument();
        });

        await user.click(screen.getByLabelText('Sign up with Google'));

        await waitFor(() => {
            expect(mockSignIn.social).toHaveBeenCalledWith({
                provider: 'google',
                callbackURL: '/my-redirect'
            });
        });
    });
});
