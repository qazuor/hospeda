/**
 * Tests for the PostHog identify/reset wiring in auth-context.tsx.
 *
 * Scope: only the two effects added for analytics — identifying the staff
 * user once the session resolves, and clearing the identity on sign-out.
 * The rest of AuthProvider's session-sync behavior already has coverage
 * elsewhere (integration tests under test/integration/, HeaderUser tests).
 */

import { fireEvent, render, waitFor } from '@testing-library/react';
import { useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, AuthProvider } from '@/contexts/auth-context';

// `@/hooks/use-auth-context` is globally stubbed in test/setup.tsx (a fixed
// authenticated-ADMIN shape with no `signOut`, for page-level tests), so the
// sign-out test below reads `AuthContext` directly via `useContext` instead
// of going through that mocked hook.

const mockUseSession = vi.fn();
const mockAuthSignOut = vi.fn().mockResolvedValue(undefined);
const mockIdentifyUser = vi.fn();
const mockResetUser = vi.fn();

vi.mock('@/lib/auth-client', () => ({
    useSession: () => mockUseSession(),
    signOut: () => mockAuthSignOut()
}));

vi.mock('@/lib/api/client', () => ({
    fetchApi: vi.fn().mockResolvedValue({ status: 401, data: null })
}));

vi.mock('@/lib/analytics/posthog-client', () => ({
    identifyUser: (...args: unknown[]) => mockIdentifyUser(...args),
    resetUser: () => mockResetUser()
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

describe('AuthProvider — PostHog identify/reset wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // AuthProvider persists to sessionStorage (SESSION_KEYS.USER) so a
        // prior test's authenticated state does not leak into the next one.
        sessionStorage.clear();
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
