import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/utils/safe-fetch', () => ({
    safeExternalFetch: vi.fn()
}));

import { safeExternalFetch } from '@repo/utils/safe-fetch';
import { ImageSearchService } from '../../../src/services/media/image-search.service';

const mockSafeExternalFetch = vi.mocked(safeExternalFetch);

describe('ImageSearchService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('normalizes Unsplash results', async () => {
        mockSafeExternalFetch.mockResolvedValue({
            ok: true,
            status: 200,
            finalUrl: 'https://api.unsplash.com/search/photos?query=concert',
            body: JSON.stringify({
                results: [
                    {
                        id: 'uns-1',
                        urls: {
                            small: 'https://images.example.com/small.jpg',
                            full: 'https://images.example.com/full.jpg',
                            regular: 'https://images.example.com/regular.jpg',
                            raw: 'https://images.example.com/raw.jpg'
                        },
                        width: 1200,
                        height: 800,
                        user: {
                            name: 'Alice',
                            links: { html: 'https://unsplash.com/@alice' }
                        },
                        links: {
                            download_location: 'https://api.unsplash.com/photos/uns-1/download'
                        }
                    }
                ]
            })
        });

        const service = new ImageSearchService({
            unsplashAccessKey: 'uns-key',
            pexelsApiKey: 'pex-key'
        });

        const result = await service.search({ provider: 'unsplash', query: 'concert' });

        expect(result).toEqual([
            {
                providerId: 'uns-1',
                provider: 'unsplash',
                thumbUrl: 'https://images.example.com/small.jpg',
                fullUrl: 'https://images.example.com/regular.jpg',
                width: 1200,
                height: 800,
                photographer: 'Alice',
                photographerUrl: 'https://unsplash.com/@alice',
                downloadLocation: 'https://api.unsplash.com/photos/uns-1/download'
            }
        ]);
    });

    it('normalizes Pexels results', async () => {
        mockSafeExternalFetch.mockResolvedValue({
            ok: true,
            status: 200,
            finalUrl: 'https://api.pexels.com/v1/search?query=concert',
            body: JSON.stringify({
                photos: [
                    {
                        id: 42,
                        src: {
                            small: 'https://images.example.com/thumb.jpg',
                            large: 'https://images.example.com/large.jpg',
                            original: 'https://images.example.com/original.jpg'
                        },
                        width: 1600,
                        height: 900,
                        photographer: 'Bob',
                        photographer_url: 'https://pexels.com/@bob'
                    }
                ]
            })
        });

        const service = new ImageSearchService({
            unsplashAccessKey: 'uns-key',
            pexelsApiKey: 'pex-key'
        });

        const result = await service.search({ provider: 'pexels', query: 'concert' });

        expect(result).toEqual([
            {
                providerId: '42',
                provider: 'pexels',
                thumbUrl: 'https://images.example.com/thumb.jpg',
                fullUrl: 'https://images.example.com/large.jpg',
                width: 1600,
                height: 900,
                photographer: 'Bob',
                photographerUrl: 'https://pexels.com/@bob'
            }
        ]);
    });

    it('returns an empty array when provider fetch is blocked', async () => {
        mockSafeExternalFetch.mockResolvedValue({
            ok: false,
            status: 0,
            error: 'Request timed out',
            blocked: true
        });

        const service = new ImageSearchService({
            unsplashAccessKey: 'uns-key',
            pexelsApiKey: 'pex-key'
        });

        const result = await service.search({ provider: 'unsplash', query: 'concert' });

        expect(result).toEqual([]);
    });
});
