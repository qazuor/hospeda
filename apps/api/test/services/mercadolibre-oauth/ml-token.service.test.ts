/**
 * MercadoLibre OAuth Token Service Tests (HOS-45 T-008 read path + T-009
 * refresh path + T-010 admin alert on terminal failure)
 *
 * Unit tests for `getValidMercadoLibreToken` (both the read/cache path and
 * the refresh path, including the single-flight concurrency guard) and the
 * pure `needsRefresh` helper.
 *
 * Mocked collaborators:
 * - `../../../src/services/mercadolibre-oauth/ml-credential.repository.js`
 *   — controlled `getActiveMLCredential` return values and a spy on
 *   `upsertMLCredential`.
 * - `../../../src/services/mercadolibre-oauth/ml-oauth-client.js` —
 *   controlled `refreshAccessToken` behavior (success, failure, and
 *   manually-delayed resolution for the concurrency test).
 * - `../../../src/utils/notification-helper.js` — a spy on `sendNotification`
 *   used to assert the T-010 admin alert on terminal refresh failures.
 * - `../../../src/utils/env.js` — a controlled `env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS`
 *   so the alert payload's `recipientEmail` is deterministic.
 * - `@repo/notifications` — a minimal `NotificationType` stub (the real
 *   package pulls in React Email templates, unnecessary for this unit test).
 *
 * Scenarios covered (AAA pattern):
 * 1. No credential configured → throws `MLTokenRefreshError` with `kind: 'terminal'`.
 * 2. Credential far from expiry → returns cached `accessToken`, only calls
 *    `getActiveMLCredential` once, no other work attempted.
 * 3. Credential within the 5-minute margin → refreshes and returns the new
 *    access token, persisting the rotated pair via `upsertMLCredential`.
 * 4. Credential already expired → same refresh behavior as (3).
 * 5. Refresh failure → the caller receives a classified `MLTokenRefreshError`
 *    and `upsertMLCredential` is never called.
 * 6. Concurrency — two overlapping near-expiry calls share a single
 *    in-flight refresh (`refreshAccessToken` called exactly once).
 * 7. Sequential near-expiry calls (awaited in between) each trigger their
 *    own fresh refresh — the single-flight slot is cleared, not latched.
 * 8. `needsRefresh` — exactly-at-margin boundary, just-inside, just-outside,
 *    already-past, directly and thoroughly.
 * 9. Admin alert (T-010) — terminal failure fires exactly one `sendNotification`
 *    call with the expected payload; transient failure fires none; a
 *    `sendNotification` throw never changes the error the caller receives.
 *
 * @module test/services/mercadolibre-oauth/ml-token.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MLCredential } from '../../../src/services/mercadolibre-oauth/ml-credential.repository.js';
import type { MLTokenResponse } from '../../../src/services/mercadolibre-oauth/ml-oauth-client.js';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
    mockGetActiveMLCredential,
    mockUpsertMLCredential,
    mockRefreshAccessToken,
    mockSendNotification,
    mockEnv
} = vi.hoisted(() => ({
    mockGetActiveMLCredential: vi.fn(),
    mockUpsertMLCredential: vi.fn(),
    mockRefreshAccessToken: vi.fn(),
    mockSendNotification: vi.fn().mockResolvedValue(undefined),
    mockEnv: {
        HOSPEDA_ADMIN_NOTIFICATION_EMAILS: 'admin@hospeda.com.ar',
        HOSPEDA_FEEDBACK_FALLBACK_EMAIL: undefined as string | undefined
    }
}));

vi.mock('../../../src/services/mercadolibre-oauth/ml-credential.repository.js', () => ({
    getActiveMLCredential: mockGetActiveMLCredential,
    upsertMLCredential: mockUpsertMLCredential
}));

vi.mock('../../../src/services/mercadolibre-oauth/ml-oauth-client.js', () => ({
    refreshAccessToken: mockRefreshAccessToken
}));

vi.mock('../../../src/utils/notification-helper.js', () => ({
    sendNotification: mockSendNotification
}));

vi.mock('@repo/notifications', () => ({
    NotificationType: {
        ADMIN_SYSTEM_EVENT: 'admin_system_event'
    }
}));

vi.mock('../../../src/utils/env.js', () => ({
    get env() {
        return mockEnv;
    }
}));

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

const FIVE_MINUTES_MS = 5 * 60 * 1000;

const buildCredential = (expiresAt: Date): MLCredential => ({
    accessToken: 'cached-access-token',
    refreshToken: 'cached-refresh-token',
    expiresAt
});

const buildTokenResponse = (overrides?: Partial<MLTokenResponse>): MLTokenResponse => ({
    accessToken: 'new-access-token',
    refreshToken: 'rotated-refresh-token',
    expiresIn: 3600,
    tokenType: 'bearer',
    ...overrides
});

describe('ml-token.service', () => {
    let getValidMercadoLibreToken: typeof import(
        '../../../src/services/mercadolibre-oauth/ml-token.service.js'
    ).getValidMercadoLibreToken;
    let needsRefresh: typeof import(
        '../../../src/services/mercadolibre-oauth/ml-token.service.js'
    ).needsRefresh;
    let MLTokenRefreshError: typeof import(
        '../../../src/services/mercadolibre-oauth/ml-token.errors.js'
    ).MLTokenRefreshError;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockEnv.HOSPEDA_ADMIN_NOTIFICATION_EMAILS = 'admin@hospeda.com.ar';
        mockEnv.HOSPEDA_FEEDBACK_FALLBACK_EMAIL = undefined;
        mockSendNotification.mockResolvedValue(undefined);
        ({ getValidMercadoLibreToken, needsRefresh } = await import(
            '../../../src/services/mercadolibre-oauth/ml-token.service.js'
        ));
        ({ MLTokenRefreshError } = await import(
            '../../../src/services/mercadolibre-oauth/ml-token.errors.js'
        ));
    });

    describe('getValidMercadoLibreToken', () => {
        it('should throw a terminal MLTokenRefreshError when no credential is configured', async () => {
            // Arrange
            mockGetActiveMLCredential.mockResolvedValue(null);

            // Act & Assert
            await expect(getValidMercadoLibreToken()).rejects.toBeInstanceOf(MLTokenRefreshError);
            await expect(getValidMercadoLibreToken()).rejects.toMatchObject({
                kind: 'terminal',
                message: expect.stringContaining('run the authorization flow first')
            });
        });

        it('should return the cached accessToken directly when far from expiry', async () => {
            // Arrange
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
            mockGetActiveMLCredential.mockResolvedValue(buildCredential(expiresAt));

            // Act
            const token = await getValidMercadoLibreToken();

            // Assert
            expect(token).toBe('cached-access-token');
            expect(mockGetActiveMLCredential).toHaveBeenCalledTimes(1);
            expect(mockRefreshAccessToken).not.toHaveBeenCalled();
        });

        it('should refresh and return the new accessToken when within the 5-minute margin', async () => {
            // Arrange
            const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now
            mockGetActiveMLCredential.mockResolvedValue(buildCredential(expiresAt));
            const tokenResponse = buildTokenResponse();
            mockRefreshAccessToken.mockResolvedValue(tokenResponse);
            const beforeCallMs = Date.now();

            // Act
            const token = await getValidMercadoLibreToken();
            const afterCallMs = Date.now();

            // Assert
            expect(token).toBe('new-access-token');
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
            expect(mockRefreshAccessToken).toHaveBeenCalledWith({
                refreshToken: 'cached-refresh-token'
            });
            expect(mockUpsertMLCredential).toHaveBeenCalledTimes(1);
            const upsertInput = mockUpsertMLCredential.mock.calls[0]?.[0];
            expect(upsertInput).toMatchObject({
                accessToken: 'new-access-token',
                refreshToken: 'rotated-refresh-token'
            });
            expect(upsertInput.expiresAt).toBeInstanceOf(Date);
            expect(upsertInput.expiresAt.getTime()).toBeGreaterThanOrEqual(
                beforeCallMs + tokenResponse.expiresIn * 1000
            );
            expect(upsertInput.expiresAt.getTime()).toBeLessThanOrEqual(
                afterCallMs + tokenResponse.expiresIn * 1000
            );
        });

        it('should refresh and return the new accessToken when the credential is already expired', async () => {
            // Arrange
            const expiresAt = new Date(Date.now() - 1000); // 1 second in the past
            mockGetActiveMLCredential.mockResolvedValue(buildCredential(expiresAt));
            mockRefreshAccessToken.mockResolvedValue(buildTokenResponse());

            // Act
            const token = await getValidMercadoLibreToken();

            // Assert
            expect(token).toBe('new-access-token');
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
            expect(mockRefreshAccessToken).toHaveBeenCalledWith({
                refreshToken: 'cached-refresh-token'
            });
            expect(mockUpsertMLCredential).toHaveBeenCalledTimes(1);
        });

        it('should throw a classified MLTokenRefreshError and never persist when refresh fails', async () => {
            // Arrange
            const expiresAt = new Date(Date.now() - 1000);
            mockGetActiveMLCredential.mockResolvedValue(buildCredential(expiresAt));
            mockRefreshAccessToken.mockRejectedValue(
                Object.assign(new Error('bad refresh token'), {
                    status: 400,
                    body: { error: 'invalid_grant' }
                })
            );

            // Act & Assert
            await expect(getValidMercadoLibreToken()).rejects.toBeInstanceOf(MLTokenRefreshError);
            await expect(getValidMercadoLibreToken()).rejects.toMatchObject({ kind: 'terminal' });
            expect(mockUpsertMLCredential).not.toHaveBeenCalled();
        });

        describe('admin alert on terminal refresh failure (T-010)', () => {
            const buildTerminalRefreshError = () =>
                Object.assign(new Error('bad refresh token'), {
                    status: 400,
                    body: { error: 'invalid_grant' }
                });

            const buildTransientRefreshError = () => new Error('network timeout');

            it('should send exactly one admin notification with the expected payload on a terminal failure', async () => {
                // Arrange
                const expiresAt = new Date(Date.now() - 1000);
                mockGetActiveMLCredential.mockResolvedValue(buildCredential(expiresAt));
                mockRefreshAccessToken.mockRejectedValue(buildTerminalRefreshError());

                // Act
                await expect(getValidMercadoLibreToken()).rejects.toBeInstanceOf(
                    MLTokenRefreshError
                );

                // Assert
                expect(mockSendNotification).toHaveBeenCalledTimes(1);
                expect(mockSendNotification).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: 'admin_system_event',
                        recipientEmail: 'admin@hospeda.com.ar',
                        recipientName: 'Admin',
                        userId: null,
                        severity: 'critical',
                        eventDetails: expect.objectContaining({
                            eventType: 'mercadolibre_oauth_refresh_terminal_failure',
                            reauthorizeUrl: '/api/v1/admin/mercadolibre-oauth/authorize'
                        })
                    })
                );
            });

            it('should NOT send an admin notification when the refresh failure is transient', async () => {
                // Arrange
                const expiresAt = new Date(Date.now() - 1000);
                mockGetActiveMLCredential.mockResolvedValue(buildCredential(expiresAt));
                mockRefreshAccessToken.mockRejectedValue(buildTransientRefreshError());

                // Act
                await expect(getValidMercadoLibreToken()).rejects.toMatchObject({
                    kind: 'transient'
                });

                // Assert
                expect(mockSendNotification).not.toHaveBeenCalled();
            });

            it('should still reject with the original classified MLTokenRefreshError when sendNotification itself throws', async () => {
                // Arrange
                const expiresAt = new Date(Date.now() - 1000);
                mockGetActiveMLCredential.mockResolvedValue(buildCredential(expiresAt));
                mockRefreshAccessToken.mockRejectedValue(buildTerminalRefreshError());
                mockSendNotification.mockRejectedValue(new Error('notification transport down'));

                // Act & Assert — the caller must see the classified refresh error, never
                // the notification-plumbing error, even though sendNotification rejects.
                await expect(getValidMercadoLibreToken()).rejects.toBeInstanceOf(
                    MLTokenRefreshError
                );
                await expect(getValidMercadoLibreToken()).rejects.toMatchObject({
                    kind: 'terminal',
                    message: expect.stringContaining('re-authorization required')
                });

                // Give the fire-and-forget notification promise a tick to settle so its
                // internal catch runs before the test ends (guards against an unhandled
                // rejection leaking from the swallowed notification failure).
                await new Promise((resolve) => setTimeout(resolve, 0));
                expect(mockSendNotification).toHaveBeenCalled();
            });
        });

        it('should call refreshAccessToken exactly once when two near-expiry calls overlap (single-flight)', async () => {
            // Arrange
            const expiresAt = new Date(Date.now() - 1000);
            mockGetActiveMLCredential.mockResolvedValue(buildCredential(expiresAt));
            mockRefreshAccessToken.mockImplementation(function () {
                return new Promise<MLTokenResponse>((resolve) => {
                    setTimeout(() => resolve(buildTokenResponse()), 0);
                });
            });

            // Act
            const [tokenA, tokenB] = await Promise.all([
                getValidMercadoLibreToken(),
                getValidMercadoLibreToken()
            ]);

            // Assert
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
            expect(tokenA).toBe('new-access-token');
            expect(tokenB).toBe('new-access-token');
            expect(mockUpsertMLCredential).toHaveBeenCalledTimes(1);
        });

        it("should NOT redeem a stale refresh token when a staggered caller's read resolves after another caller already refreshed (code review finding)", async () => {
            // Arrange — reproduces the exact race a fresh-context review found:
            // caller B's getActiveMLCredential read is issued before, but
            // resolves after, caller A's refresh has already rotated the
            // stored refresh token. Without the fix, B would redeem the
            // now-consumed refresh token and get a false terminal error.
            const staleExpiresAt = new Date(Date.now() - 1000);
            const freshExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
            const staleCredential = buildCredential(staleExpiresAt);
            const freshCredential: MLCredential = {
                accessToken: 'already-refreshed-access-token',
                refreshToken: 'already-refreshed-refresh-token',
                expiresAt: freshExpiresAt
            };

            type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
            const createDeferred = <T>(): Deferred<T> => {
                let resolve!: (value: T) => void;
                const promise = new Promise<T>((res) => {
                    resolve = res;
                });
                return { promise, resolve };
            };

            const callerBOuterRead = createDeferred<MLCredential>();

            // Call sequence: 1) A's outer read, 2) A's inner re-check (both
            // stale — A is first to actually refresh), 3) B's outer read
            // (deferred — simulates a slow read issued early, resolving
            // late), 4) B's inner re-check (fresh — reflects A's completed
            // write, proving the fix re-reads rather than trusting B's stale
            // outer snapshot).
            let callCount = 0;
            mockGetActiveMLCredential.mockImplementation(function () {
                callCount += 1;
                if (callCount === 1 || callCount === 2) {
                    return Promise.resolve(staleCredential);
                }
                if (callCount === 3) {
                    return callerBOuterRead.promise;
                }
                return Promise.resolve(freshCredential);
            });
            mockRefreshAccessToken.mockResolvedValue(buildTokenResponse());

            // Act
            // 1) Caller A runs to completion first (refreshes, persists, clears the slot).
            const tokenA = await getValidMercadoLibreToken();

            // 2) Caller B's call was already issued (its outer read is in flight,
            //    call #3) but only resolves now, after A finished.
            const callerBPromise = getValidMercadoLibreToken();
            callerBOuterRead.resolve(staleCredential);
            const tokenB = await callerBPromise;

            // Assert
            expect(tokenA).toBe('new-access-token');
            // B must receive the ALREADY-fresh token, not a second refresh result.
            expect(tokenB).toBe('already-refreshed-access-token');
            // Only A's refresh actually hit the ML token endpoint.
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
            expect(mockUpsertMLCredential).toHaveBeenCalledTimes(1);
        });

        it('should trigger a fresh refresh for a new near-expiry call after a prior refresh completed', async () => {
            // Arrange
            const expiresAt = new Date(Date.now() - 1000);
            mockGetActiveMLCredential.mockResolvedValue(buildCredential(expiresAt));
            mockRefreshAccessToken.mockResolvedValueOnce(
                buildTokenResponse({ accessToken: 'access-1', refreshToken: 'refresh-1' })
            );

            // Act
            const tokenA = await getValidMercadoLibreToken();

            mockRefreshAccessToken.mockResolvedValueOnce(
                buildTokenResponse({ accessToken: 'access-2', refreshToken: 'refresh-2' })
            );
            const tokenB = await getValidMercadoLibreToken();

            // Assert
            expect(tokenA).toBe('access-1');
            expect(tokenB).toBe('access-2');
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(2);
        });
    });

    describe('needsRefresh', () => {
        it('should return false when well outside the margin (1 hour left)', () => {
            // Arrange
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

            // Act
            const result = needsRefresh(expiresAt);

            // Assert
            expect(result).toBe(false);
        });

        it('should return false when just outside the margin (margin + 1s left)', () => {
            // Arrange
            const expiresAt = new Date(Date.now() + FIVE_MINUTES_MS + 1000);

            // Act
            const result = needsRefresh(expiresAt);

            // Assert
            expect(result).toBe(false);
        });

        it('should return true exactly at the margin boundary', () => {
            // Arrange
            const expiresAt = new Date(Date.now() + FIVE_MINUTES_MS);

            // Act
            const result = needsRefresh(expiresAt);

            // Assert
            expect(result).toBe(true);
        });

        it('should return true when just inside the margin (margin - 1s left)', () => {
            // Arrange
            const expiresAt = new Date(Date.now() + FIVE_MINUTES_MS - 1000);

            // Act
            const result = needsRefresh(expiresAt);

            // Assert
            expect(result).toBe(true);
        });

        it('should return true when already past expiry', () => {
            // Arrange
            const expiresAt = new Date(Date.now() - 60 * 1000);

            // Act
            const result = needsRefresh(expiresAt);

            // Assert
            expect(result).toBe(true);
        });
    });
});
