import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listingTranslationsApi } from '@/lib/api/endpoints-protected-translations';

const { getProtected, put, postProtected } = vi.hoisted(() => ({
    getProtected: vi.fn(),
    put: vi.fn(),
    postProtected: vi.fn()
}));
vi.mock('@/lib/api/client', () => ({ apiClient: { getProtected, put, postProtected } }));

const ID = '0c9f4d2e-1b6a-4c3d-9e8f-7a6b5c4d3e2f';

describe('listingTranslationsApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([
        ['accommodation', 'accommodations'],
        ['venue', 'venues'],
        ['experience', 'experiences']
    ] as const)('get reads the %s translations path', async (vertical, segment) => {
        // Arrange
        const result = { ok: true, data: { listingId: ID } };
        getProtected.mockResolvedValue(result);

        // Act
        const actual = await listingTranslationsApi.get({ vertical, id: ID });

        // Assert
        expect(actual).toBe(result);
        expect(getProtected).toHaveBeenCalledTimes(1);
        expect(getProtected).toHaveBeenCalledWith({
            path: `/api/v1/protected/${segment}/${ID}/translations`
        });
    });

    it('saveManual PUTs exactly one field, locale and value', async () => {
        // Arrange
        put.mockResolvedValue({ ok: true, data: {} });

        // Act
        await listingTranslationsApi.saveManual({
            vertical: 'venue',
            id: ID,
            field: 'description',
            locale: 'en',
            value: 'Fixed'
        });

        // Assert
        expect(put).toHaveBeenCalledTimes(1);
        expect(put).toHaveBeenCalledWith({
            path: `/api/v1/protected/venues/${ID}/translations`,
            body: { field: 'description', locale: 'en', value: 'Fixed' }
        });
    });

    it('translateWithAi POSTs to the ai sub-path with the long timeout', async () => {
        // Arrange
        postProtected.mockResolvedValue({ ok: true, data: {} });

        // Act
        await listingTranslationsApi.translateWithAi({
            vertical: 'experience',
            id: ID,
            field: 'name',
            locales: ['en', 'pt']
        });

        // Assert
        expect(postProtected).toHaveBeenCalledTimes(1);
        expect(postProtected).toHaveBeenCalledWith({
            path: `/api/v1/protected/experiences/${ID}/translations/ai`,
            body: { field: 'name', locales: ['en', 'pt'] },
            timeoutMs: 90_000
        });
    });

    it('encodes the listing id in the path', async () => {
        // Arrange
        getProtected.mockResolvedValue({ ok: true, data: {} });

        // Act
        await listingTranslationsApi.get({ vertical: 'accommodation', id: 'a/b' });

        // Assert
        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/accommodations/a%2Fb/translations'
        });
    });
});
