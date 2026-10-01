/**
 * @file VerifyEmail.client.test.tsx
 * @description HOS-1206 regression: verifying the email signs the visitor in
 * (`autoSignInAfterVerification` in the API), so the guest `/auth/me`
 * snapshot cached in this tab must be dropped before the redirect. Otherwise
 * a session-blind target page trusts it and paints the visitor as anonymous.
 */

import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifyEmail } from '../../../src/components/auth/VerifyEmail.client';

vi.mock('../../../src/components/auth/VerifyEmail.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    return { createTranslations: () => ({ t }) };
});

const verifyEmailMock = vi.fn();
vi.mock('../../../src/lib/auth-client', () => ({
    verifyEmail: (...args: unknown[]) => verifyEmailMock(...args)
}));

const GUEST_SNAPSHOT = JSON.stringify({
    isAuthenticated: false,
    user: null,
    permissions: [],
    roles: [],
    cachedAt: Date.now()
});

function renderIsland() {
    return render(
        <VerifyEmail
            locale="es"
            token="tok-123"
            redirectTo="/es/alojamientos/"
            // Long enough that the redirect never fires inside the test.
            redirectDelay={60_000}
        />
    );
}

describe('VerifyEmail invalidates the cached /auth/me snapshot (HOS-1206)', () => {
    beforeEach(() => {
        verifyEmailMock.mockReset();
        sessionStorage.clear();
        sessionStorage.setItem('authMeSnapshot', GUEST_SNAPSHOT);
    });

    it('drops the guest snapshot once verification succeeds (the visitor is now signed in)', async () => {
        // Arrange
        verifyEmailMock.mockResolvedValue({ data: { status: true } });

        // Act
        renderIsland();

        // Assert
        await waitFor(() => expect(verifyEmailMock).toHaveBeenCalledWith({ token: 'tok-123' }));
        await waitFor(() => expect(sessionStorage.getItem('authMeSnapshot')).toBeNull());
    });

    it('keeps the snapshot when verification fails (no session was created)', async () => {
        // Arrange
        verifyEmailMock.mockResolvedValue({ error: { message: 'INVALID_TOKEN' } });

        // Act
        const { findByText } = renderIsland();

        // Assert
        await findByText(/INVALID_TOKEN|verificación falló/);
        expect(sessionStorage.getItem('authMeSnapshot')).toBe(GUEST_SNAPSHOT);
    });
});
