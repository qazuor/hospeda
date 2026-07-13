/**
 * Google Calendar OAuth Credential Repository Tests (HOS-157 Phase 2 — Layer 2)
 *
 * Unit tests for the encrypt/decrypt bridge between the encryption-agnostic
 * `accommodationCalendarSyncModel` and apps/api's OAuth vault.
 *
 * Mocked collaborators:
 * - `@repo/db` — a stub `accommodationCalendarSyncModel` with spies on
 *   `findByAccommodationAndProvider`, `updateTokens`, and `upsertConnection`.
 * - `../../../src/utils/oauth-vault.js` — deterministic `encryptSecret` /
 *   `decryptSecret` so the ciphertext↔plaintext mapping is assertable without
 *   real crypto.
 *
 * Scenarios covered (AAA pattern):
 * 1. getGoogleCredential returns null when no row exists.
 * 2. getGoogleCredential decrypts access + refresh tokens and maps fields.
 * 3. getGoogleCredential returns refreshToken=null when the refresh triplet is incomplete.
 * 4. saveRefreshedGoogleTokens omits refresh-token columns when no refresh token is passed.
 * 5. saveRefreshedGoogleTokens includes refresh-token columns when one is passed.
 * 6. saveGoogleConnection encrypts both secrets and delegates to upsertConnection.
 *
 * @module test/services/google-calendar/google-calendar-credential.repository
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockFindByAccommodationAndProvider, mockUpdateTokens, mockUpsertConnection } = vi.hoisted(
    () => ({
        mockFindByAccommodationAndProvider: vi.fn(),
        mockUpdateTokens: vi.fn().mockResolvedValue(undefined),
        mockUpsertConnection: vi.fn().mockResolvedValue({})
    })
);

vi.mock('@repo/db', () => ({
    accommodationCalendarSyncModel: {
        findByAccommodationAndProvider: mockFindByAccommodationAndProvider,
        updateTokens: mockUpdateTokens,
        upsertConnection: mockUpsertConnection
    }
}));

// Deterministic vault: ciphertext = `enc:<plaintext>`, reversed on decrypt.
vi.mock('../../../src/utils/oauth-vault.js', () => ({
    encryptSecret: vi.fn(({ plaintext }: { plaintext: string }) => ({
        ciphertext: `enc:${plaintext}`,
        iv: `iv:${plaintext}`,
        authTag: `tag:${plaintext}`
    })),
    decryptSecret: vi.fn(({ ciphertext }: { ciphertext: string }) => ({
        plaintext: ciphertext.replace(/^enc:/, '')
    }))
}));

const ACCOMMODATION_ID = 'acc-1234';

describe('google-calendar-credential.repository', () => {
    let getGoogleCredential: typeof import('../../../src/services/google-calendar/google-calendar-credential.repository.js').getGoogleCredential;
    let saveRefreshedGoogleTokens: typeof import('../../../src/services/google-calendar/google-calendar-credential.repository.js').saveRefreshedGoogleTokens;
    let saveGoogleConnection: typeof import('../../../src/services/google-calendar/google-calendar-credential.repository.js').saveGoogleConnection;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockUpdateTokens.mockResolvedValue(undefined);
        mockUpsertConnection.mockResolvedValue({});
        ({ getGoogleCredential, saveRefreshedGoogleTokens, saveGoogleConnection } = await import(
            '../../../src/services/google-calendar/google-calendar-credential.repository.js'
        ));
    });

    describe('getGoogleCredential', () => {
        it('should return null when no connection row exists', async () => {
            // Arrange
            mockFindByAccommodationAndProvider.mockResolvedValue(null);

            // Act
            const result = await getGoogleCredential({ accommodationId: ACCOMMODATION_ID });

            // Assert
            expect(result).toBeNull();
            expect(mockFindByAccommodationAndProvider).toHaveBeenCalledWith({
                accommodationId: ACCOMMODATION_ID,
                provider: 'GOOGLE_CALENDAR'
            });
        });

        it('should decrypt access + refresh tokens and map connection state', async () => {
            // Arrange
            const expiresAt = new Date('2030-01-01T00:00:00Z');
            mockFindByAccommodationAndProvider.mockResolvedValue({
                accessTokenCiphertext: 'enc:access-plain',
                accessTokenIv: 'iv',
                accessTokenAuthTag: 'tag',
                refreshTokenCiphertext: 'enc:refresh-plain',
                refreshTokenIv: 'iv',
                refreshTokenAuthTag: 'tag',
                tokenExpiresAt: expiresAt,
                externalCalendarId: 'primary',
                syncToken: 'sync-token-abc',
                isActive: true
            });

            // Act
            const result = await getGoogleCredential({ accommodationId: ACCOMMODATION_ID });

            // Assert
            expect(result).toEqual({
                accessToken: 'access-plain',
                refreshToken: 'refresh-plain',
                expiresAt,
                externalCalendarId: 'primary',
                syncToken: 'sync-token-abc',
                isActive: true
            });
        });

        it('should return refreshToken=null when the refresh triplet is incomplete', async () => {
            // Arrange
            mockFindByAccommodationAndProvider.mockResolvedValue({
                accessTokenCiphertext: 'enc:access-plain',
                accessTokenIv: 'iv',
                accessTokenAuthTag: 'tag',
                refreshTokenCiphertext: null,
                refreshTokenIv: null,
                refreshTokenAuthTag: null,
                tokenExpiresAt: null,
                externalCalendarId: null,
                syncToken: null,
                isActive: false
            });

            // Act
            const result = await getGoogleCredential({ accommodationId: ACCOMMODATION_ID });

            // Assert
            expect(result?.accessToken).toBe('access-plain');
            expect(result?.refreshToken).toBeNull();
            expect(result?.expiresAt).toBeNull();
            expect(result?.isActive).toBe(false);
        });
    });

    describe('saveRefreshedGoogleTokens', () => {
        it('should encrypt the access token and NOT touch refresh columns when no refresh token is passed', async () => {
            // Arrange
            const tokenExpiresAt = new Date('2030-06-01T00:00:00Z');

            // Act
            await saveRefreshedGoogleTokens({
                accommodationId: ACCOMMODATION_ID,
                accessToken: 'fresh-access',
                tokenScope: 'scope-x',
                tokenExpiresAt
            });

            // Assert
            expect(mockUpdateTokens).toHaveBeenCalledTimes(1);
            const input = mockUpdateTokens.mock.calls[0]?.[0];
            expect(input).toMatchObject({
                accommodationId: ACCOMMODATION_ID,
                provider: 'GOOGLE_CALENDAR',
                accessTokenCiphertext: 'enc:fresh-access',
                accessTokenIv: 'iv:fresh-access',
                accessTokenAuthTag: 'tag:fresh-access',
                tokenScope: 'scope-x',
                tokenExpiresAt
            });
            // No refresh-token columns → the model leaves the stored ones intact.
            expect(input).not.toHaveProperty('refreshTokenCiphertext');
            expect(input).not.toHaveProperty('refreshTokenIv');
            expect(input).not.toHaveProperty('refreshTokenAuthTag');
        });

        it('should encrypt and include refresh-token columns when a refresh token is passed', async () => {
            // Act
            await saveRefreshedGoogleTokens({
                accommodationId: ACCOMMODATION_ID,
                accessToken: 'fresh-access',
                refreshToken: 'rotated-refresh',
                tokenExpiresAt: new Date('2030-06-01T00:00:00Z')
            });

            // Assert
            const input = mockUpdateTokens.mock.calls[0]?.[0];
            expect(input).toMatchObject({
                refreshTokenCiphertext: 'enc:rotated-refresh',
                refreshTokenIv: 'iv:rotated-refresh',
                refreshTokenAuthTag: 'tag:rotated-refresh'
            });
        });
    });

    describe('saveGoogleConnection', () => {
        it('should encrypt both secrets and delegate to upsertConnection', async () => {
            // Arrange
            const tokenExpiresAt = new Date('2030-01-01T00:00:00Z');

            // Act
            await saveGoogleConnection({
                accommodationId: ACCOMMODATION_ID,
                externalCalendarId: 'primary',
                accessToken: 'conn-access',
                refreshToken: 'conn-refresh',
                tokenScope: 'scope-y',
                tokenExpiresAt,
                createdById: 'host-1'
            });

            // Assert
            expect(mockUpsertConnection).toHaveBeenCalledTimes(1);
            expect(mockUpsertConnection.mock.calls[0]?.[0]).toMatchObject({
                accommodationId: ACCOMMODATION_ID,
                provider: 'GOOGLE_CALENDAR',
                externalCalendarId: 'primary',
                accessTokenCiphertext: 'enc:conn-access',
                accessTokenIv: 'iv:conn-access',
                accessTokenAuthTag: 'tag:conn-access',
                refreshTokenCiphertext: 'enc:conn-refresh',
                refreshTokenIv: 'iv:conn-refresh',
                refreshTokenAuthTag: 'tag:conn-refresh',
                tokenScope: 'scope-y',
                tokenExpiresAt,
                createdById: 'host-1'
            });
        });

        it('should omit refresh columns when no refresh token is issued on connect', async () => {
            // Act
            await saveGoogleConnection({
                accommodationId: ACCOMMODATION_ID,
                externalCalendarId: 'primary',
                accessToken: 'conn-access',
                createdById: 'host-1'
            });

            // Assert
            const input = mockUpsertConnection.mock.calls[0]?.[0];
            expect(input).not.toHaveProperty('refreshTokenCiphertext');
            expect(input.accessTokenCiphertext).toBe('enc:conn-access');
        });
    });
});
