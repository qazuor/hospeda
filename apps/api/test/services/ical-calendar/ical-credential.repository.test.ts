/**
 * iCal Feed Credential Repository Tests (HOS-162 Phase 3 — Layer C)
 *
 * Unit tests for the encrypt/decrypt bridge between the encryption-agnostic
 * `accommodationCalendarSyncModel` and apps/api's OAuth vault, mirroring
 * `google-calendar-credential.repository.test.ts` but for the simpler
 * (no-OAuth, no-refresh-token) iCal feed shape.
 *
 * Mocked collaborators:
 * - `@repo/db` — a stub `accommodationCalendarSyncModel` with spies on
 *   `findByAccommodationAndProvider` and `upsertConnection`.
 * - `../../../src/utils/oauth-vault.js` — deterministic `encryptSecret` /
 *   `decryptSecret` so the ciphertext↔plaintext mapping is assertable
 *   without real crypto (also exercises a real encrypt→decrypt round trip).
 *
 * Scenarios covered (AAA pattern):
 * 1. getIcalCredential returns null when no row exists.
 * 2. getIcalCredential decrypts the feed URL and maps connection state.
 * 3. saveIcalConnection encrypts the feed URL and delegates to
 *    upsertConnection with every OAuth-only column explicitly null.
 * 4. Encrypt→decrypt round trip: a feed URL saved then read back resolves
 *    to the exact original plaintext.
 *
 * @module test/services/ical-calendar/ical-credential.repository
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockFindByAccommodationAndProvider, mockUpsertConnection } = vi.hoisted(() => ({
    mockFindByAccommodationAndProvider: vi.fn(),
    mockUpsertConnection: vi.fn().mockResolvedValue({})
}));

vi.mock('@repo/db', () => ({
    accommodationCalendarSyncModel: {
        findByAccommodationAndProvider: mockFindByAccommodationAndProvider,
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
const AIRBNB_FEED_URL = 'https://www.airbnb.com/calendar/ical/12345.ics?s=abcdef';

describe('ical-credential.repository', () => {
    let getIcalCredential: typeof import('../../../src/services/ical-calendar/ical-credential.repository.js').getIcalCredential;
    let saveIcalConnection: typeof import('../../../src/services/ical-calendar/ical-credential.repository.js').saveIcalConnection;
    let OccupancySourceEnum: typeof import('@repo/schemas').OccupancySourceEnum;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockUpsertConnection.mockResolvedValue({});
        ({ getIcalCredential, saveIcalConnection } = await import(
            '../../../src/services/ical-calendar/ical-credential.repository.js'
        ));
        ({ OccupancySourceEnum } = await import('@repo/schemas'));
    });

    describe('getIcalCredential', () => {
        it('should return null when no connection row exists', async () => {
            // Arrange
            mockFindByAccommodationAndProvider.mockResolvedValue(null);

            // Act
            const result = await getIcalCredential({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.AIRBNB
            });

            // Assert
            expect(result).toBeNull();
            expect(mockFindByAccommodationAndProvider).toHaveBeenCalledWith({
                accommodationId: ACCOMMODATION_ID,
                provider: 'AIRBNB'
            });
        });

        it('should decrypt the feed URL and map connection state', async () => {
            // Arrange
            mockFindByAccommodationAndProvider.mockResolvedValue({
                accessTokenCiphertext: `enc:${AIRBNB_FEED_URL}`,
                accessTokenIv: 'iv',
                accessTokenAuthTag: 'tag',
                isActive: true,
                createdById: 'host-1'
            });

            // Act
            const result = await getIcalCredential({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.AIRBNB
            });

            // Assert
            expect(result).toEqual({
                feedUrl: AIRBNB_FEED_URL,
                isActive: true,
                createdById: 'host-1'
            });
        });

        it('should map isActive=false for a deactivated connection', async () => {
            // Arrange
            mockFindByAccommodationAndProvider.mockResolvedValue({
                accessTokenCiphertext: `enc:${AIRBNB_FEED_URL}`,
                accessTokenIv: 'iv',
                accessTokenAuthTag: 'tag',
                isActive: false,
                createdById: 'host-1'
            });

            // Act
            const result = await getIcalCredential({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.BOOKING
            });

            // Assert
            expect(result?.isActive).toBe(false);
        });
    });

    describe('saveIcalConnection', () => {
        it('should encrypt the feed URL and delegate to upsertConnection with OAuth-only columns null', async () => {
            // Act
            await saveIcalConnection({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.AIRBNB,
                feedUrl: AIRBNB_FEED_URL,
                createdById: 'host-1'
            });

            // Assert
            expect(mockUpsertConnection).toHaveBeenCalledTimes(1);
            expect(mockUpsertConnection.mock.calls[0]?.[0]).toEqual({
                accommodationId: ACCOMMODATION_ID,
                provider: 'AIRBNB',
                externalCalendarId: null,
                accessTokenCiphertext: `enc:${AIRBNB_FEED_URL}`,
                accessTokenIv: `iv:${AIRBNB_FEED_URL}`,
                accessTokenAuthTag: `tag:${AIRBNB_FEED_URL}`,
                refreshTokenCiphertext: null,
                refreshTokenIv: null,
                refreshTokenAuthTag: null,
                tokenScope: null,
                tokenExpiresAt: null,
                createdById: 'host-1'
            });
        });

        it('should support the OTHER provider (generic iCal feed)', async () => {
            // Act
            await saveIcalConnection({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.OTHER,
                feedUrl: 'https://pms.example.com/feed.ics',
                createdById: 'host-2'
            });

            // Assert
            expect(mockUpsertConnection.mock.calls[0]?.[0]).toMatchObject({
                provider: 'OTHER',
                createdById: 'host-2'
            });
        });
    });

    describe('encrypt/decrypt round trip', () => {
        it('should read back the exact plaintext feed URL that was saved', async () => {
            // Arrange — capture what saveIcalConnection persisted, then feed it
            // straight back into a findByAccommodationAndProvider mock.
            await saveIcalConnection({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.BOOKING,
                feedUrl: AIRBNB_FEED_URL,
                createdById: 'host-1'
            });
            const persisted = mockUpsertConnection.mock.calls[0]?.[0];
            mockFindByAccommodationAndProvider.mockResolvedValue({
                accessTokenCiphertext: persisted.accessTokenCiphertext,
                accessTokenIv: persisted.accessTokenIv,
                accessTokenAuthTag: persisted.accessTokenAuthTag,
                isActive: true,
                createdById: 'host-1'
            });

            // Act
            const result = await getIcalCredential({
                accommodationId: ACCOMMODATION_ID,
                provider: OccupancySourceEnum.BOOKING
            });

            // Assert
            expect(result?.feedUrl).toBe(AIRBNB_FEED_URL);
        });
    });
});
