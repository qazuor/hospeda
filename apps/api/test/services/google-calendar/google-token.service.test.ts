/**
 * Google Calendar OAuth Token Service Tests (HOS-157 Phase 2 — Layer 2)
 *
 * Unit tests for `getValidGoogleToken` (read/cache path + refresh path +
 * per-accommodation single-flight guard) and the pure `needsRefresh` helper.
 *
 * Mocked collaborators:
 * - `../../../src/services/google-calendar/google-calendar-credential.repository.js`
 *   — controlled `getGoogleCredential` return values and a spy on
 *   `saveRefreshedGoogleTokens`.
 * - `../../../src/services/google-calendar/google-oauth-client.js` — controlled
 *   `refreshAccessToken` behavior (success, failure, delayed resolution).
 *
 * Scenarios covered (AAA pattern):
 * 1. No connection → throws terminal GoogleTokenRefreshError.
 * 2. Far from expiry → returns cached accessToken, no refresh.
 * 3. Within the 5-minute margin → refreshes, persists WITHOUT a refresh token
 *    (Google omits it), returns the new access token.
 * 4. Already expired / null expiry → same refresh behavior.
 * 5. Google rotates the refresh token → the rotated token is persisted.
 * 6. Refresh failure → classified GoogleTokenRefreshError, never persists.
 * 7. Near-expiry with no stored refresh token → terminal (reconnect required).
 * 8. Concurrency — two overlapping calls for the SAME accommodation share one
 *    refresh; two calls for DIFFERENT accommodations refresh independently.
 * 9. Sequential calls for the same accommodation each trigger a fresh refresh.
 * 10. Staggered caller re-reads fresh credential inside its critical section.
 * 11. needsRefresh — boundaries + null.
 *
 * @module test/services/google-calendar/google-token.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleCredential } from '../../../src/services/google-calendar/google-calendar-credential.repository.js';
import type { GoogleTokenResponse } from '../../../src/services/google-calendar/google-oauth-client.js';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetGoogleCredential, mockSaveRefreshedGoogleTokens, mockRefreshAccessToken } =
    vi.hoisted(() => ({
        mockGetGoogleCredential: vi.fn(),
        mockSaveRefreshedGoogleTokens: vi.fn().mockResolvedValue(undefined),
        mockRefreshAccessToken: vi.fn()
    }));

vi.mock('../../../src/services/google-calendar/google-calendar-credential.repository.js', () => ({
    getGoogleCredential: mockGetGoogleCredential,
    saveRefreshedGoogleTokens: mockSaveRefreshedGoogleTokens
}));

vi.mock('../../../src/services/google-calendar/google-oauth-client.js', () => ({
    refreshAccessToken: mockRefreshAccessToken
}));

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ACCOMMODATION_A = 'acc-aaaa-1111';
const ACCOMMODATION_B = 'acc-bbbb-2222';

const buildCredential = (overrides?: Partial<GoogleCredential>): GoogleCredential => ({
    accessToken: 'cached-access-token',
    refreshToken: 'cached-refresh-token',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    externalCalendarId: 'primary',
    syncToken: null,
    isActive: true,
    createdById: 'host-1',
    ...overrides
});

const buildTokenResponse = (overrides?: Partial<GoogleTokenResponse>): GoogleTokenResponse => ({
    accessToken: 'new-access-token',
    expiresIn: 3599,
    tokenType: 'Bearer',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    ...overrides
});

describe('google-token.service', () => {
    let getValidGoogleToken: typeof import('../../../src/services/google-calendar/google-token.service.js').getValidGoogleToken;
    let needsRefresh: typeof import('../../../src/services/google-calendar/google-token.service.js').needsRefresh;
    let GoogleTokenRefreshError: typeof import('../../../src/services/google-calendar/google-token.errors.js').GoogleTokenRefreshError;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        mockSaveRefreshedGoogleTokens.mockResolvedValue(undefined);
        ({ getValidGoogleToken, needsRefresh } = await import(
            '../../../src/services/google-calendar/google-token.service.js'
        ));
        ({ GoogleTokenRefreshError } = await import(
            '../../../src/services/google-calendar/google-token.errors.js'
        ));
    });

    describe('getValidGoogleToken', () => {
        it('should throw a terminal GoogleTokenRefreshError when no connection exists', async () => {
            // Arrange
            mockGetGoogleCredential.mockResolvedValue(null);

            // Act & Assert
            await expect(
                getValidGoogleToken({ accommodationId: ACCOMMODATION_A })
            ).rejects.toMatchObject({
                kind: 'terminal',
                message: expect.stringContaining('connect the calendar first')
            });
        });

        it('should return the cached accessToken directly when far from expiry', async () => {
            // Arrange
            mockGetGoogleCredential.mockResolvedValue(buildCredential());

            // Act
            const token = await getValidGoogleToken({ accommodationId: ACCOMMODATION_A });

            // Assert
            expect(token).toBe('cached-access-token');
            expect(mockGetGoogleCredential).toHaveBeenCalledTimes(1);
            expect(mockRefreshAccessToken).not.toHaveBeenCalled();
        });

        it('should refresh and persist WITHOUT a refresh token when Google omits it', async () => {
            // Arrange
            const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 min → within margin
            mockGetGoogleCredential.mockResolvedValue(buildCredential({ expiresAt }));
            mockRefreshAccessToken.mockResolvedValue(buildTokenResponse());
            const beforeCallMs = Date.now();

            // Act
            const token = await getValidGoogleToken({ accommodationId: ACCOMMODATION_A });
            const afterCallMs = Date.now();

            // Assert
            expect(token).toBe('new-access-token');
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
            expect(mockRefreshAccessToken).toHaveBeenCalledWith({
                refreshToken: 'cached-refresh-token'
            });
            expect(mockSaveRefreshedGoogleTokens).toHaveBeenCalledTimes(1);
            const saveInput = mockSaveRefreshedGoogleTokens.mock.calls[0]?.[0];
            expect(saveInput.accommodationId).toBe(ACCOMMODATION_A);
            expect(saveInput.accessToken).toBe('new-access-token');
            // Google's refresh grant carries no refresh token → the stored one
            // must be preserved (key absent, not overwritten with undefined).
            expect(saveInput).not.toHaveProperty('refreshToken');
            expect(saveInput.tokenExpiresAt).toBeInstanceOf(Date);
            expect(saveInput.tokenExpiresAt.getTime()).toBeGreaterThanOrEqual(
                beforeCallMs + 3599 * 1000
            );
            expect(saveInput.tokenExpiresAt.getTime()).toBeLessThanOrEqual(
                afterCallMs + 3599 * 1000
            );
        });

        it('should persist a rotated refresh token when Google unexpectedly issues one', async () => {
            // Arrange
            mockGetGoogleCredential.mockResolvedValue(
                buildCredential({ expiresAt: new Date(Date.now() - 1000) })
            );
            mockRefreshAccessToken.mockResolvedValue(
                buildTokenResponse({ refreshToken: 'rotated-refresh-token' })
            );

            // Act
            await getValidGoogleToken({ accommodationId: ACCOMMODATION_A });

            // Assert
            const saveInput = mockSaveRefreshedGoogleTokens.mock.calls[0]?.[0];
            expect(saveInput.refreshToken).toBe('rotated-refresh-token');
        });

        it('should refresh when the access token is already expired', async () => {
            // Arrange
            mockGetGoogleCredential.mockResolvedValue(
                buildCredential({ expiresAt: new Date(Date.now() - 1000) })
            );
            mockRefreshAccessToken.mockResolvedValue(buildTokenResponse());

            // Act
            const token = await getValidGoogleToken({ accommodationId: ACCOMMODATION_A });

            // Assert
            expect(token).toBe('new-access-token');
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
        });

        it('should refresh when expiry is unknown (null)', async () => {
            // Arrange
            mockGetGoogleCredential.mockResolvedValue(buildCredential({ expiresAt: null }));
            mockRefreshAccessToken.mockResolvedValue(buildTokenResponse());

            // Act
            const token = await getValidGoogleToken({ accommodationId: ACCOMMODATION_A });

            // Assert
            expect(token).toBe('new-access-token');
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
        });

        it('should throw a terminal error and never refresh when the connection has no stored refresh token', async () => {
            // Arrange
            mockGetGoogleCredential.mockResolvedValue(
                buildCredential({ expiresAt: new Date(Date.now() - 1000), refreshToken: null })
            );

            // Act & Assert
            await expect(
                getValidGoogleToken({ accommodationId: ACCOMMODATION_A })
            ).rejects.toMatchObject({
                kind: 'terminal',
                message: expect.stringContaining('must reconnect')
            });
            expect(mockRefreshAccessToken).not.toHaveBeenCalled();
            expect(mockSaveRefreshedGoogleTokens).not.toHaveBeenCalled();
        });

        it('should throw a classified GoogleTokenRefreshError and never persist when refresh fails', async () => {
            // Arrange
            mockGetGoogleCredential.mockResolvedValue(
                buildCredential({ expiresAt: new Date(Date.now() - 1000) })
            );
            mockRefreshAccessToken.mockRejectedValue(
                Object.assign(new Error('bad refresh token'), {
                    status: 400,
                    body: { error: 'invalid_grant' }
                })
            );

            // Act & Assert
            await expect(
                getValidGoogleToken({ accommodationId: ACCOMMODATION_A })
            ).rejects.toBeInstanceOf(GoogleTokenRefreshError);
            await expect(
                getValidGoogleToken({ accommodationId: ACCOMMODATION_A })
            ).rejects.toMatchObject({ kind: 'terminal' });
            expect(mockSaveRefreshedGoogleTokens).not.toHaveBeenCalled();
        });

        it('should call refreshAccessToken exactly once when two calls for the SAME accommodation overlap (single-flight)', async () => {
            // Arrange
            mockGetGoogleCredential.mockResolvedValue(
                buildCredential({ expiresAt: new Date(Date.now() - 1000) })
            );
            mockRefreshAccessToken.mockImplementation(
                () =>
                    new Promise<GoogleTokenResponse>((resolve) => {
                        setTimeout(() => resolve(buildTokenResponse()), 0);
                    })
            );

            // Act
            const [tokenA, tokenB] = await Promise.all([
                getValidGoogleToken({ accommodationId: ACCOMMODATION_A }),
                getValidGoogleToken({ accommodationId: ACCOMMODATION_A })
            ]);

            // Assert
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
            expect(tokenA).toBe('new-access-token');
            expect(tokenB).toBe('new-access-token');
        });

        it('should refresh independently for two DIFFERENT accommodations overlapping', async () => {
            // Arrange
            mockGetGoogleCredential.mockResolvedValue(
                buildCredential({ expiresAt: new Date(Date.now() - 1000) })
            );
            mockRefreshAccessToken.mockImplementation(
                () =>
                    new Promise<GoogleTokenResponse>((resolve) => {
                        setTimeout(() => resolve(buildTokenResponse()), 0);
                    })
            );

            // Act
            await Promise.all([
                getValidGoogleToken({ accommodationId: ACCOMMODATION_A }),
                getValidGoogleToken({ accommodationId: ACCOMMODATION_B })
            ]);

            // Assert — one refresh per distinct accommodation, not collapsed.
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(2);
        });

        it('should trigger a fresh refresh for a new near-expiry call after a prior refresh completed', async () => {
            // Arrange
            mockGetGoogleCredential.mockResolvedValue(
                buildCredential({ expiresAt: new Date(Date.now() - 1000) })
            );
            mockRefreshAccessToken
                .mockResolvedValueOnce(buildTokenResponse({ accessToken: 'access-1' }))
                .mockResolvedValueOnce(buildTokenResponse({ accessToken: 'access-2' }));

            // Act
            const tokenA = await getValidGoogleToken({ accommodationId: ACCOMMODATION_A });
            const tokenB = await getValidGoogleToken({ accommodationId: ACCOMMODATION_A });

            // Assert
            expect(tokenA).toBe('access-1');
            expect(tokenB).toBe('access-2');
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(2);
        });

        it("should re-read fresh and return the already-refreshed token when a staggered caller's read resolves late", async () => {
            // Arrange — caller B's outer read is issued before, but resolves
            // after, caller A's refresh completes. B must re-read and return the
            // already-fresh token instead of redundantly refreshing.
            const staleCredential = buildCredential({ expiresAt: new Date(Date.now() - 1000) });
            const freshCredential = buildCredential({
                accessToken: 'already-refreshed-access-token',
                expiresAt: new Date(Date.now() + 60 * 60 * 1000)
            });

            type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
            const createDeferred = <T>(): Deferred<T> => {
                let resolve!: (value: T) => void;
                const promise = new Promise<T>((res) => {
                    resolve = res;
                });
                return { promise, resolve };
            };
            const callerBOuterRead = createDeferred<GoogleCredential>();

            let callCount = 0;
            mockGetGoogleCredential.mockImplementation(() => {
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
            const tokenA = await getValidGoogleToken({ accommodationId: ACCOMMODATION_A });
            const callerBPromise = getValidGoogleToken({ accommodationId: ACCOMMODATION_A });
            callerBOuterRead.resolve(staleCredential);
            const tokenB = await callerBPromise;

            // Assert
            expect(tokenA).toBe('new-access-token');
            expect(tokenB).toBe('already-refreshed-access-token');
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
        });
    });

    describe('needsRefresh', () => {
        it('should return false when well outside the margin (1 hour left)', () => {
            expect(needsRefresh(new Date(Date.now() + 60 * 60 * 1000))).toBe(false);
        });

        it('should return false when just outside the margin (margin + 1s left)', () => {
            expect(needsRefresh(new Date(Date.now() + FIVE_MINUTES_MS + 1000))).toBe(false);
        });

        it('should return true exactly at the margin boundary', () => {
            expect(needsRefresh(new Date(Date.now() + FIVE_MINUTES_MS))).toBe(true);
        });

        it('should return true when just inside the margin (margin - 1s left)', () => {
            expect(needsRefresh(new Date(Date.now() + FIVE_MINUTES_MS - 1000))).toBe(true);
        });

        it('should return true when already past expiry', () => {
            expect(needsRefresh(new Date(Date.now() - 60 * 1000))).toBe(true);
        });

        it('should return true when expiry is unknown (null)', () => {
            expect(needsRefresh(null)).toBe(true);
        });
    });
});
