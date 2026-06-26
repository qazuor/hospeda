import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/utils/safe-fetch', () => ({
    safeExternalFetch: vi.fn(),
    safeExternalFetchBuffer: vi.fn()
}));

import type { ImageProvider } from '@repo/media/server';
import { safeExternalFetch, safeExternalFetchBuffer } from '@repo/utils/safe-fetch';
import { ImageImportService } from '../../../src/services/media/image-import.service';

const mockSafeExternalFetch = vi.mocked(safeExternalFetch);
const mockSafeExternalFetchBuffer = vi.mocked(safeExternalFetchBuffer);

describe('ImageImportService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('imports an Unsplash image and builds attribution', async () => {
        const upload = vi.fn().mockResolvedValue({
            url: 'https://res.cloudinary.com/hospeda/image/upload/sample.jpg',
            publicId: 'hospeda/posts/sample',
            width: 1200,
            height: 800
        });

        const mediaProvider = {
            upload,
            delete: vi.fn(),
            deleteByPrefix: vi.fn(),
            healthCheck: vi.fn()
        } as unknown as ImageProvider;

        mockSafeExternalFetch.mockResolvedValue({
            ok: true,
            status: 200,
            finalUrl: 'https://api.unsplash.com/photos/abc/download',
            body: '{}'
        });
        mockSafeExternalFetchBuffer.mockResolvedValue({
            ok: true,
            status: 200,
            finalUrl: 'https://images.unsplash.com/photo.jpg',
            body: Buffer.from('fake-image')
        });

        const service = new ImageImportService({ mediaProvider });

        const result = await service.import({
            provider: 'unsplash',
            providerId: 'abc',
            fullUrl: 'https://images.unsplash.com/photo.jpg',
            downloadLocation: 'https://api.unsplash.com/photos/abc/download',
            photographer: 'Alice',
            photographerUrl: 'https://unsplash.com/@alice',
            folder: 'hospeda/posts',
            tags: ['event']
        });

        expect(mockSafeExternalFetch).toHaveBeenCalledTimes(1);
        expect(mockSafeExternalFetchBuffer).toHaveBeenCalledTimes(1);
        expect(upload).toHaveBeenCalledWith({
            file: Buffer.from('fake-image'),
            folder: 'hospeda/posts',
            tags: ['event', 'stock', 'unsplash'],
            overwrite: true
        });
        expect(result.attribution).toEqual({
            photographer: 'Alice',
            sourceUrl: 'https://unsplash.com/@alice',
            license: 'Unsplash License',
            provider: 'unsplash'
        });
    });

    it('skips download trigger for Pexels imports', async () => {
        const mediaProvider = {
            upload: vi.fn().mockResolvedValue({
                url: 'https://res.cloudinary.com/hospeda/image/upload/sample.jpg',
                publicId: 'hospeda/posts/sample',
                width: 1000,
                height: 700
            }),
            delete: vi.fn(),
            deleteByPrefix: vi.fn(),
            healthCheck: vi.fn()
        } as unknown as ImageProvider;

        mockSafeExternalFetchBuffer.mockResolvedValue({
            ok: true,
            status: 200,
            finalUrl: 'https://images.pexels.com/photo.jpg',
            body: Buffer.from('fake-image')
        });

        const service = new ImageImportService({ mediaProvider });

        const result = await service.import({
            provider: 'pexels',
            providerId: '42',
            fullUrl: 'https://images.pexels.com/photo.jpg',
            photographer: 'Bob',
            photographerUrl: 'https://pexels.com/@bob',
            folder: 'hospeda/posts'
        });

        expect(mockSafeExternalFetch).not.toHaveBeenCalled();
        expect(result.attribution.license).toBe('Pexels License');
    });

    it('throws when binary download fails', async () => {
        const mediaProvider = {
            upload: vi.fn(),
            delete: vi.fn(),
            deleteByPrefix: vi.fn(),
            healthCheck: vi.fn()
        } as unknown as ImageProvider;

        mockSafeExternalFetchBuffer.mockResolvedValue({
            ok: false,
            status: 0,
            error: 'Request timed out',
            blocked: true
        });

        const service = new ImageImportService({ mediaProvider });

        await expect(
            service.import({
                provider: 'pexels',
                providerId: '42',
                fullUrl: 'https://images.pexels.com/photo.jpg',
                photographer: 'Bob',
                photographerUrl: 'https://pexels.com/@bob',
                folder: 'hospeda/posts'
            })
        ).rejects.toThrow('Failed to download image: Request timed out');
    });
});
