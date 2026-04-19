import type { ImageProvider, UploadOptions, UploadResult } from '@repo/media/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageCache } from '../../src/utils/cloudinary-cache.js';
import { processEntityImages } from '../../src/utils/cloudinary-image-processor.js';
import {
    type ImageProcessingCounters,
    createImageProcessingCounters
} from '../../src/utils/seedContext.js';

/**
 * Minimal {@link ImageProvider} double that records upload calls.
 */
function createProviderMock() {
    const uploads: UploadOptions[] = [];
    const provider: ImageProvider = {
        upload: vi.fn(async (opts: UploadOptions): Promise<UploadResult> => {
            uploads.push(opts);
            return {
                url: `https://cdn.example.com/${opts.folder}/${opts.publicId}.jpg`,
                publicId: `${opts.folder}/${opts.publicId}`,
                bytes: 1,
                format: 'jpg',
                width: 10,
                height: 10
            } as unknown as UploadResult;
        }),
        delete: vi.fn(async () => undefined),
        deleteByPrefix: vi.fn(async () => undefined)
    } as unknown as ImageProvider;
    return { provider, uploads };
}

describe('processEntityImages — SPEC-078-GAPS T-022', () => {
    const fetchMock = vi.fn();
    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            arrayBuffer: async () => new ArrayBuffer(4)
        } as Response);
        vi.stubGlobal('fetch', fetchMock);
    });

    describe('when seedSource is "example"', () => {
        it('returns data unchanged and never calls the provider (skips Cloudinary)', async () => {
            // Arrange
            const { provider } = createProviderMock();
            const cache: ImageCache = {};
            const counters = createImageProcessingCounters();
            const data = {
                id: 'evt-1',
                media: {
                    featuredImage: {
                        url: 'https://source.example/photo.jpg',
                        photographer: 'Jane Doe',
                        sourceUrl: 'https://source.example/profile',
                        license: 'Unsplash'
                    },
                    gallery: [
                        { url: 'https://source.example/g1.jpg' },
                        { url: 'https://source.example/g2.jpg' }
                    ]
                }
            };

            // Act
            const result = await processEntityImages({
                data,
                entityType: 'events',
                entityId: 'evt-1',
                provider,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'example',
                counters
            });

            // Assert
            expect(result).toBe(data);
            expect(provider.upload).not.toHaveBeenCalled();
            expect(fetchMock).not.toHaveBeenCalled();
            // Attribution metadata preserved on featuredImage.
            const media = (result as typeof data).media;
            expect(media.featuredImage?.photographer).toBe('Jane Doe');
            expect(media.featuredImage?.sourceUrl).toBe('https://source.example/profile');
            expect(media.featuredImage?.license).toBe('Unsplash');
            // Counter reflects all 3 image jobs (1 featured + 2 gallery).
            expect(counters.skippedExample).toBe(3);
            expect(counters.uploaded).toBe(0);
            expect(counters.cached).toBe(0);
            expect(counters.failures).toBe(0);
        });
    });

    describe('when seedSource is "required"', () => {
        it('uploads and builds gallery roles as "gallery/{index}" (GAP-078-037)', async () => {
            // Arrange
            const { provider, uploads } = createProviderMock();
            const cache: ImageCache = {};
            const counters: ImageProcessingCounters = createImageProcessingCounters();
            const data = {
                id: 'acc-1',
                media: {
                    featuredImage: { url: 'https://src/featured.jpg' },
                    gallery: [
                        { url: 'https://src/g0.jpg' },
                        { url: 'https://src/g1.jpg' },
                        { url: 'https://src/g2.jpg' }
                    ]
                }
            };

            // Act
            const result = await processEntityImages({
                data,
                entityType: 'accommodations',
                entityId: 'acc-1',
                provider,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'required',
                counters
            });

            // Assert: role encoded as "gallery/{index}" at index 2.
            const gallery2Upload = uploads.find(
                (u) =>
                    u.folder === 'hospeda/dev/seed/accommodations/acc-1/gallery' &&
                    u.publicId === '2'
            );
            expect(gallery2Upload, 'expected a gallery/2 upload').toBeDefined();
            // featuredImage keeps its own role.
            const featuredUpload = uploads.find(
                (u) =>
                    u.folder === 'hospeda/dev/seed/accommodations/acc-1' &&
                    u.publicId === 'featured'
            );
            expect(featuredUpload).toBeDefined();
            // All 4 jobs upload; counter reflects uploads, not skipped.
            expect(counters.uploaded).toBe(4);
            expect(counters.skippedExample).toBe(0);
            // Gallery URLs replaced.
            const media = (result as typeof data).media;
            expect(media.gallery?.[2]?.url).toMatch(/cdn\.example\.com/);
        });

        it('falls back to original URL and increments `failures` when allowRequiredFallback=true', async () => {
            // Arrange
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 503,
                arrayBuffer: async () => new ArrayBuffer(0)
            } as Response);
            const { provider } = createProviderMock();
            const cache: ImageCache = {};
            const counters = createImageProcessingCounters();
            const data = {
                id: 'acc-2',
                media: {
                    featuredImage: { url: 'https://src/broken.jpg' }
                }
            };

            // Act
            const result = await processEntityImages({
                data,
                entityType: 'accommodations',
                entityId: 'acc-2',
                provider,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'required',
                allowRequiredFallback: true,
                counters
            });

            // Assert
            const media = (result as typeof data).media;
            expect(media.featuredImage?.url).toBe('https://src/broken.jpg');
            expect(counters.failures).toBe(1);
            expect(counters.uploaded).toBe(0);
        });

        it('throws when allowRequiredFallback is false (default) and fetch fails', async () => {
            // Arrange
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 503,
                arrayBuffer: async () => new ArrayBuffer(0)
            } as Response);
            const { provider } = createProviderMock();
            const cache: ImageCache = {};
            const counters = createImageProcessingCounters();
            const data = {
                id: 'acc-3',
                media: {
                    featuredImage: { url: 'https://src/broken.jpg' }
                }
            };

            // Act + Assert
            await expect(
                processEntityImages({
                    data,
                    entityType: 'accommodations',
                    entityId: 'acc-3',
                    provider,
                    cache,
                    cachePath: '/tmp/cache.json',
                    env: 'dev',
                    seedSource: 'required',
                    counters
                })
            ).rejects.toThrow(/Failed to fetch image/);
        });
    });

    describe('when provider is null (no Cloudinary configured) and source is required', () => {
        it('returns data unchanged', async () => {
            // Arrange
            const cache: ImageCache = {};
            const data = { media: { featuredImage: { url: 'https://src/x.jpg' } } };

            // Act
            const result = await processEntityImages({
                data,
                entityType: 'events',
                entityId: 'evt-2',
                provider: null,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'required'
            });

            // Assert
            expect(result).toBe(data);
        });
    });

    // -----------------------------------------------------------------------
    // SPEC-078-GAPS T-023 — avatar path override + moderationState default
    // -----------------------------------------------------------------------

    describe('SPEC-078-GAPS T-023 — avatars seed path (GAP-078-008)', () => {
        it('uploads avatars under hospeda/{env}/seed/avatars/{userId} (no role suffix)', async () => {
            // Arrange
            const { provider, uploads } = createProviderMock();
            const cache: ImageCache = {};
            const counters = createImageProcessingCounters();
            const userId = 'user-001';
            const data = {
                id: userId,
                profile: { avatar: 'https://src/avatar.jpg' }
            };

            // Act
            await processEntityImages({
                data,
                // The seedFactory calls this with the entity name lowercased
                // ('users'), but the processor MUST override to 'avatars' for
                // the avatar branch per REQ-02.
                entityType: 'users',
                entityId: userId,
                provider,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'required',
                counters
            });

            // Assert: the upload landed in the flat avatars folder with the
            // userId as the public ID leaf (no `/avatar` role segment).
            expect(uploads).toHaveLength(1);
            const upload = uploads[0];
            expect(upload?.folder).toBe('hospeda/dev/seed/avatars');
            expect(upload?.publicId).toBe(userId);

            // The cached entry key is the full publicId; assert it matches the
            // documented REQ-02 shape.
            const cacheKeys = Object.keys(cache);
            expect(cacheKeys).toContain(`hospeda/dev/seed/avatars/${userId}`);

            // Counter reflects the single upload.
            expect(counters.uploaded).toBe(1);
        });
    });

    describe('SPEC-078-GAPS T-023 — moderationState default (GAP-078-063)', () => {
        it('injects moderationState: APPROVED on featured image when missing', async () => {
            // Arrange
            const { provider } = createProviderMock();
            const cache: ImageCache = {};
            const data = {
                id: 'acc-mod-1',
                media: {
                    featuredImage: { url: 'https://src/featured.jpg' }
                }
            };

            // Act
            const result = await processEntityImages({
                data,
                entityType: 'accommodations',
                entityId: 'acc-mod-1',
                provider,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'required'
            });

            // Assert
            const media = (result as typeof data).media as {
                featuredImage?: { url?: string; moderationState?: string };
            };
            expect(media.featuredImage?.moderationState).toBe('APPROVED');
        });

        it('preserves an explicit moderationState (does NOT overwrite)', async () => {
            // Arrange
            const { provider } = createProviderMock();
            const cache: ImageCache = {};
            const data = {
                id: 'acc-mod-2',
                media: {
                    featuredImage: {
                        url: 'https://src/pending.jpg',
                        moderationState: 'PENDING' as const
                    },
                    gallery: [
                        {
                            url: 'https://src/g0.jpg',
                            moderationState: 'REJECTED' as const
                        },
                        // No moderationState — should be defaulted.
                        { url: 'https://src/g1.jpg' }
                    ]
                }
            };

            // Act
            const result = await processEntityImages({
                data,
                entityType: 'accommodations',
                entityId: 'acc-mod-2',
                provider,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'required'
            });

            // Assert
            const media = (result as typeof data).media as {
                featuredImage?: { moderationState?: string };
                gallery?: Array<{ moderationState?: string }>;
            };
            expect(media.featuredImage?.moderationState).toBe('PENDING');
            expect(media.gallery?.[0]?.moderationState).toBe('REJECTED');
            expect(media.gallery?.[1]?.moderationState).toBe('APPROVED');
        });
    });
});
