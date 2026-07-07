/**
 * @file auth-context.test.tsx
 * @description Tests the Sentry user-context wiring in AuthProvider: an
 * authenticated user (with anonymized email) must be attached to Sentry, and
 * cleared when the user is no longer authenticated (logout).
 */

import { render, waitFor } from '@testing-library/react';
import { type ReactNode, useContext } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const isSentryInitializedMock = vi.fn(() => true);
const setSentryUserMock = vi.fn();

vi.mock('@/lib/sentry', () => ({
    isSentryInitialized: () => isSentryInitializedMock(),
    setSentryUser: (user: unknown) => setSentryUserMock(user)
}));

vi.mock('../utils/logger', () => ({
    adminLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('@/lib/api/client', () => ({
    fetchApi: vi.fn().mockResolvedValue({ status: 200, data: { success: false } })
}));

const useSessionMock = vi.fn();
vi.mock('@/lib/auth-client', () => ({
    useSession: () => useSessionMock(),
    signOut: vi.fn()
}));

import { AuthContext, AuthProvider } from '@/contexts/auth-context';

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

describe('AuthProvider Sentry integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isSentryInitializedMock.mockReturnValue(true);
        useSessionMock.mockReturnValue({ data: null, isPending: false });
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
            expect(useSessionMock).toHaveBeenCalled();
        });
        expect(setSentryUserMock).not.toHaveBeenCalled();
    });
});
