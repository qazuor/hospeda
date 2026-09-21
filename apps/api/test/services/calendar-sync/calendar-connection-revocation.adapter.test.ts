/**
 * HOS-663 — the adapter that actually closes a host's calendar grant.
 *
 * Deactivating a connection stops US from using the token; only revocation
 * ends the provider's grant. This file pins the three answers that matter and
 * that a future refactor could quietly get wrong:
 *
 *  1. Google revokes the REFRESH token when there is one. Revoking only the
 *     access token would leave the refresh token free to mint new ones — the
 *     exact access the issue is about closing.
 *  2. A Google `400 invalid_token` counts as revoked. A grant Google no longer
 *     recognises cannot be used; reporting it as a failure would fill the
 *     failure column with rows that are already closed.
 *  3. An iCal provider reports `revoked: false` WITH a reason. There is no
 *     revocation endpoint for a secret feed URL, and claiming success for an
 *     act never performed is the silent failure this issue exists to prevent.
 *
 * @module test/services/calendar-sync/calendar-connection-revocation.adapter
 */

import { OccupancySourceEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getGoogleCredential, revokeToken } = vi.hoisted(() => ({
    getGoogleCredential: vi.fn(),
    revokeToken: vi.fn()
}));

vi.mock('../../../src/services/google-calendar/google-calendar-credential.repository.js', () => ({
    getGoogleCredential
}));

vi.mock('../../../src/services/google-calendar/google-oauth-client.js', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../../src/services/google-calendar/google-oauth-client.js')
        >();
    return {
        // The real GoogleOAuthClientError is kept: the adapter branches on
        // `instanceof`, and a stubbed class would make that branch unreachable
        // while every assertion still passed.
        ...actual,
        revokeToken
    };
});

import { calendarConnectionRevocationAdapter } from '../../../src/services/calendar-sync/calendar-connection-revocation.adapter.js';
import { GoogleOAuthClientError } from '../../../src/services/google-calendar/google-oauth-client.js';

const googleCredential = (overrides: Record<string, unknown> = {}) => ({
    accessToken: 'access-token-value',
    refreshToken: 'refresh-token-value',
    expiresAt: null,
    externalCalendarId: 'primary',
    syncToken: null,
    isActive: false,
    createdById: 'user-1',
    ...overrides
});

describe('calendarConnectionRevocationAdapter — Google', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('revokes the REFRESH token, not the access token', async () => {
        getGoogleCredential.mockResolvedValue(googleCredential());
        revokeToken.mockResolvedValue(undefined);

        const result = await calendarConnectionRevocationAdapter.revoke({
            accommodationId: 'acc-1',
            provider: OccupancySourceEnum.GOOGLE_CALENDAR
        });

        expect(result).toEqual({ revoked: true });
        expect(revokeToken).toHaveBeenCalledWith({ token: 'refresh-token-value' });
    });

    it('falls back to the access token when the connection has no refresh token', async () => {
        getGoogleCredential.mockResolvedValue(googleCredential({ refreshToken: null }));
        revokeToken.mockResolvedValue(undefined);

        const result = await calendarConnectionRevocationAdapter.revoke({
            accommodationId: 'acc-2',
            provider: OccupancySourceEnum.GOOGLE_CALENDAR
        });

        expect(result).toEqual({ revoked: true });
        expect(revokeToken).toHaveBeenCalledWith({ token: 'access-token-value' });
    });

    it('treats an already-invalid token as revoked', async () => {
        getGoogleCredential.mockResolvedValue(googleCredential());
        revokeToken.mockRejectedValue(
            new GoogleOAuthClientError(
                'Google OAuth token revocation failed with status 400',
                400,
                {
                    error: 'invalid_token'
                }
            )
        );

        const result = await calendarConnectionRevocationAdapter.revoke({
            accommodationId: 'acc-3',
            provider: OccupancySourceEnum.GOOGLE_CALENDAR
        });

        expect(result).toEqual({ revoked: true });
    });

    it('reports a real Google failure instead of claiming success', async () => {
        getGoogleCredential.mockResolvedValue(googleCredential());
        revokeToken.mockRejectedValue(
            new GoogleOAuthClientError('Google OAuth token revocation failed with status 503', 503)
        );

        const result = await calendarConnectionRevocationAdapter.revoke({
            accommodationId: 'acc-4',
            provider: OccupancySourceEnum.GOOGLE_CALENDAR
        });

        expect(result.revoked).toBe(false);
        expect(result.revoked === false && result.reason).toContain('503');
    });

    it('never leaks the token into the failure reason', async () => {
        getGoogleCredential.mockResolvedValue(googleCredential());
        revokeToken.mockRejectedValue(new Error('network unreachable'));

        const result = await calendarConnectionRevocationAdapter.revoke({
            accommodationId: 'acc-5',
            provider: OccupancySourceEnum.GOOGLE_CALENDAR
        });

        expect(result.revoked).toBe(false);
        expect(result.revoked === false && result.reason).not.toContain('refresh-token-value');
        expect(result.revoked === false && result.reason).not.toContain('access-token-value');
    });

    it('reports a failure when the stored credential cannot be read', async () => {
        getGoogleCredential.mockRejectedValue(new Error('vault key missing'));

        const result = await calendarConnectionRevocationAdapter.revoke({
            accommodationId: 'acc-6',
            provider: OccupancySourceEnum.GOOGLE_CALENDAR
        });

        expect(result.revoked).toBe(false);
        expect(result.revoked === false && result.reason).toContain('vault key missing');
        expect(revokeToken).not.toHaveBeenCalled();
    });

    it('counts a missing connection row as nothing left to close', async () => {
        getGoogleCredential.mockResolvedValue(null);

        const result = await calendarConnectionRevocationAdapter.revoke({
            accommodationId: 'acc-7',
            provider: OccupancySourceEnum.GOOGLE_CALENDAR
        });

        expect(result).toEqual({ revoked: true });
        expect(revokeToken).not.toHaveBeenCalled();
    });
});

describe('calendarConnectionRevocationAdapter — iCal providers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        OccupancySourceEnum.AIRBNB,
        OccupancySourceEnum.BOOKING,
        OccupancySourceEnum.OTHER
    ])('reports %s as NOT revoked, with the reason recorded', async (provider) => {
        const result = await calendarConnectionRevocationAdapter.revoke({
            accommodationId: 'acc-8',
            provider
        });

        expect(result.revoked).toBe(false);
        expect(result.revoked === false && result.reason).toContain('iCal feed');
        // No Google call is made for an iCal provider.
        expect(revokeToken).not.toHaveBeenCalled();
        expect(getGoogleCredential).not.toHaveBeenCalled();
    });
});
