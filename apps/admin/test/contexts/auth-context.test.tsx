/**
 * Tests for the analytics/observability side effects wired into
 * auth-context.tsx:
 *
 * - Sentry user-context wiring: an authenticated user (id + anonymized email)
 *   must be attached to Sentry, and cleared when the user is no longer
 *   authenticated (logout). Anonymization itself happens inside
 *   `setSentryUser` (covered by sentry.config.test.ts), not here.
 * - PostHog identify/reset wiring: identifying the staff user once the
 *   session resolves, and clearing the identity on sign-out.
 *
 * Scope: only these two effects. The rest of AuthProvider's session-sync
 * behavior already has coverage elsewhere (integration tests under
 * test/integration/, HeaderUser tests).
 */

import { fireEvent, render, waitFor } from '@testing-library/react';
import { type ReactNode, useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, AuthProvider } from '@/contexts/auth-context';

// `@/hooks/use-auth-context` is globally stubbed in test/setup.tsx (a fixed
// authenticated-ADMIN shape with no `signOut`, for page-level tests), so the
// sign-out test below reads `AuthContext` directly via `useContext` instead
// of going through that mocked hook.

const mockUseSession = vi.fn();
const mockAuthSignOut = vi.fn().mockResolvedValue(undefined);
const isSentryInitializedMock = vi.fn(() => true);
const setSentryUserMock = vi.fn();
const mockIdentifyUser = vi.fn();
const mockResetUser = vi.fn();

vi.mock('@/lib/auth-client', () => ({
    useSession: () => mockUseSession(),
    signOut: () => mockAuthSignOut()
}));

vi.mock('@/lib/api/client', () => ({
    fetchApi: vi.fn().mockResolvedValue({ status: 200, data: { success: false } })
}));

vi.mock('@/lib/sentry', () => ({
    isSentryInitialized: () => isSentryInitializedMock(),
    setSentryUser: (user: unknown) => setSentryUserMock(user)
}));

vi.mock('@/lib/analytics/posthog-client', () => ({
    identifyUser: (...args: unknown[]) => mockIdentifyUser(...args),
    resetUser: () => mockResetUser()
}));

vi.mock('../../src/utils/logger', () => ({
    adminLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

const AUTHENTICATED_SERVER_STATE = {
    userId: 'staff-1',
    isAuthenticated: true,
    role: 'ADMIN',
    permissions: ['some.permission'],
    passwordChangeRequired: false,
    displayName: 'Staff Member',
    email: 'staff@hospeda.com.ar',
    avatar: null,
    emailVerified: true
};

/** Minimal consumer exposing `signOut` behind a button, mirroring how real
 *  header components trigger sign-out (see integrations/header-user.tsx). */
function SignOutButton() {
    const ctx = useContext(AuthContext);
    const signOut = ctx?.signOut;
    return (
        <button
            type="button"
            onClick={() => {
                void signOut?.();
            }}
        >
            sign out
        </button>
    );
}

function Consumer() {
    const ctx = useContext(AuthContext);
    return <div data-testid="authed">{String(ctx?.isAuthenticated)}</div>;
}

function renderWithProvider(
    children: ReactNode,
    initialAuthState?: Parameters<typeof AuthProvider>[0]['initialAuthState']
) {
    return render(<AuthProvider initialAuthState={initialAuthState}>{children}</AuthProvider>);
}

describe('AuthProvider — Sentry user context wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        isSentryInitializedMock.mockReturnValue(true);
        mockUseSession.mockReturnValue({ data: null, isPending: false });
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    it('attaches the user id and email to setSentryUser when authenticated (anonymization happens inside setSentryUser itself, covered by sentry.config.test.ts)', async () => {
        renderWithProvider(<Consumer />, {
            userId: 'user-123',
            isAuthenticated: true,
            role: 'admin',
            permissions: [],
            passwordChangeRequired: false,
            displayName: 'Jane Doe',
            email: 'jane.doe@example.com',
            avatar: null,
            emailVerified: true
        });

        await waitFor(() => {
            expect(setSentryUserMock).toHaveBeenCalledWith({
                id: 'user-123',
                email: 'jane.doe@example.com',
                username: 'Jane Doe'
            });
        });
    });

    it('clears the Sentry user when there is no authenticated session', async () => {
        renderWithProvider(<Consumer />);

        await waitFor(() => {
            expect(setSentryUserMock).toHaveBeenCalledWith(null);
        });
    });

    it('does not touch Sentry when it is not initialized', async () => {
        isSentryInitializedMock.mockReturnValue(false);

        renderWithProvider(<Consumer />, {
            userId: 'user-123',
            isAuthenticated: true,
            role: 'admin',
            permissions: [],
            passwordChangeRequired: false,
            displayName: 'Jane Doe',
            email: 'jane.doe@example.com',
            avatar: null,
            emailVerified: true
        });

        await waitFor(() => {
            expect(mockUseSession).toHaveBeenCalled();
        });
        expect(setSentryUserMock).not.toHaveBeenCalled();
    });
});

describe('AuthProvider — PostHog identify/reset wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // AuthProvider persists to sessionStorage (SESSION_KEYS.USER) so a
        // prior test's authenticated state does not leak into the next one.
        sessionStorage.clear();
        isSentryInitializedMock.mockReturnValue(true);
        mockUseSession.mockReturnValue({
            data: {
                user: {
                    id: 'staff-1',
                    email: 'staff@hospeda.com.ar',
                    name: 'Staff Member',
                    image: null
                },
                session: {}
            },
            isPending: false
        });
        mockAuthSignOut.mockResolvedValue(undefined);
    });

    afterEach(() => {
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it('calls identifyUser with the staff id, role, and email domain once resolved', async () => {
        render(
            <AuthProvider initialAuthState={AUTHENTICATED_SERVER_STATE}>
                <div />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(mockIdentifyUser).toHaveBeenCalledWith('staff-1', {
                role: 'ADMIN',
                emailDomain: 'hospeda.com.ar'
            });
        });
    });

    it('does NOT call identifyUser when there is no authenticated user', () => {
        mockUseSession.mockReturnValue({ data: null, isPending: false });

        render(
            <AuthProvider>
                <div />
            </AuthProvider>
        );

        expect(mockIdentifyUser).not.toHaveBeenCalled();
    });

    it('calls resetUser when signOut() is invoked from the context', async () => {
        const { getByRole } = render(
            <AuthProvider initialAuthState={AUTHENTICATED_SERVER_STATE}>
                <SignOutButton />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(mockIdentifyUser).toHaveBeenCalled();
        });

        fireEvent.click(getByRole('button', { name: 'sign out' }));

        await waitFor(() => {
            expect(mockResetUser).toHaveBeenCalledTimes(1);
        });
    });
});
