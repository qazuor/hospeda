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

    // -----------------------------------------------------------------------
    // SPEC-078-GAPS T-024 — sponsor + organizer logos (GAP-078-077)
    // -----------------------------------------------------------------------

    describe('SPEC-078-GAPS T-024 — postSponsor logo (GAP-078-077)', () => {
        it('uploads logo at hospeda/{env}/seed/postSponsor/{entityId}/logo and rewrites url', async () => {
            // Arrange
            const { provider, uploads } = createProviderMock();
            const cache: ImageCache = {};
            const counters = createImageProcessingCounters();
            const sponsorId = '016-postSponsor-advertiser-turismo-entrerriano';
            const data = {
                id: sponsorId,
                name: 'Turismo Entrerriano',
                logo: {
                    url: 'https://images.pexels.com/photos/675764/pexels-photo-675764.jpeg',
                    caption: 'Logo oficial',
                    description: 'Logotipo de la agencia',
                    moderationState: 'APPROVED'
                }
            };

            // Act
            const result = await processEntityImages({
                data,
                // Seed factory passes the lowercased plural entityName.
                entityType: 'postsponsors',
                entityId: sponsorId,
                provider,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'required',
                counters
            });

            // Assert
            expect(uploads).toHaveLength(1);
            const upload = uploads[0];
            // The override forces the FULL public ID. Folder is the path
            // prefix (everything before the last slash) and publicId is the
            // leaf segment; together they reconstruct the spec-mandated path.
            expect(upload?.folder).toBe(`hospeda/dev/seed/postSponsor/${sponsorId}`);
            expect(upload?.publicId).toBe('logo');
            expect(Object.keys(cache)).toContain(`hospeda/dev/seed/postSponsor/${sponsorId}/logo`);

            // Result preserves the rest of the logo object and rewrites url.
            const logo = (result as typeof data).logo;
            expect(logo.url).toMatch(/cdn\.example\.com/);
            expect(logo.caption).toBe('Logo oficial');
            expect(logo.description).toBe('Logotipo de la agencia');
            expect(logo.moderationState).toBe('APPROVED');

            expect(counters.uploaded).toBe(1);
        });
    });

    describe('SPEC-078-GAPS T-024 — eventOrganizer logo (GAP-078-077)', () => {
        it('uploads logo at hospeda/{env}/seed/eventOrganizer/{entityId}/logo and rewrites string', async () => {
            // Arrange
            const { provider, uploads } = createProviderMock();
            const cache: ImageCache = {};
            const counters = createImageProcessingCounters();
            const organizerId = '001-eventOrganizer-turismo-de-gualeguaychu';
            const data = {
                id: organizerId,
                name: 'Cámara de Turismo de Gualeguaychú',
                logo: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43'
            };

            // Act
            const result = await processEntityImages({
                data,
                entityType: 'eventorganizers',
                entityId: organizerId,
                provider,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'required',
                counters
            });

            // Assert
            expect(uploads).toHaveLength(1);
            expect(Object.keys(cache)).toContain(
                `hospeda/dev/seed/eventOrganizer/${organizerId}/logo`
            );

            // Logo string replaced with cloudinary URL.
            const logo = (result as typeof data).logo;
            expect(typeof logo).toBe('string');
            expect(logo).toMatch(/cdn\.example\.com/);

            expect(counters.uploaded).toBe(1);
        });
    });

    // -----------------------------------------------------------------------
    // SPEC-078-GAPS T-064 — countImageJobs accuracy via skippedExample counter
    // -----------------------------------------------------------------------

    describe('SPEC-078-GAPS T-064 — countImageJobs (skippedExample counter)', () => {
        it('counts featured + gallery + avatar + sponsor logo + organizer logo', async () => {
            // Arrange: a synthetic entity hitting every countable branch.
            const { provider } = createProviderMock();
            const cache: ImageCache = {};
            const counters = createImageProcessingCounters();
            const data = {
                id: 'multi',
                media: {
                    featuredImage: { url: 'https://src/featured.jpg' },
                    gallery: [
                        { url: 'https://src/g0.jpg' },
                        { url: 'https://src/g1.jpg' },
                        // No URL → does NOT count.
                        { caption: 'broken' }
                    ]
                },
                profile: { avatar: 'https://src/avatar.jpg' },
                // Both sponsor (object) and organizer (string) shapes
                // co-exist here; only one would in a real fixture but the
                // counter must tally based on shape, not branch selection.
                logo: { url: 'https://src/logo.jpg' }
            };

            // Act
            await processEntityImages({
                data,
                entityType: 'mixed',
                entityId: 'multi',
                provider,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'example',
                counters
            });

            // Assert: 1 featured + 2 gallery (entry without URL skipped) + 1 avatar + 1 logo = 5
            expect(counters.skippedExample).toBe(5);
        });

        it('returns 0 jobs for an entity with no images', async () => {
            // Arrange
            const { provider } = createProviderMock();
            const cache: ImageCache = {};
            const counters = createImageProcessingCounters();
            const data = { id: 'empty', name: 'No images here' };

            // Act
            await processEntityImages({
                data,
                entityType: 'misc',
                entityId: 'empty',
                provider,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'example',
                counters
            });

            // Assert
            expect(counters.skippedExample).toBe(0);
        });

        it('counts an organizer-style string `logo` field in example mode', async () => {
            // Arrange
            const { provider } = createProviderMock();
            const cache: ImageCache = {};
            const counters = createImageProcessingCounters();
            const data = { id: 'org', logo: 'https://src/logo.jpg' };

            // Act
            await processEntityImages({
                data,
                entityType: 'eventorganizers',
                entityId: 'org',
                provider,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'example',
                counters
            });

            // Assert
            expect(counters.skippedExample).toBe(1);
        });
    });

    // -----------------------------------------------------------------------
    // SPEC-078-GAPS T-064 — counters across all outcome kinds
    // -----------------------------------------------------------------------

    describe('SPEC-078-GAPS T-064 — counter increments per outcome kind', () => {
        it('increments `cached` counter on cache hit and skips the provider', async () => {
            // Arrange: pre-seed the cache so featured is a hit.
            const { provider, uploads } = createProviderMock();
            const cachedUrl = 'https://cdn.example.com/cached/url.jpg';
            const cache: ImageCache = {
                'hospeda/dev/seed/accommodations/acc-cached/featured': {
                    originalUrl: 'https://src/featured.jpg',
                    cloudinaryUrl: cachedUrl,
                    uploadedAt: '2024-01-01T00:00:00.000Z',
                    fileModifiedAt: null
                }
            };
            const counters = createImageProcessingCounters();
            const data = {
                id: 'acc-cached',
                media: { featuredImage: { url: 'https://src/featured.jpg' } }
            };

            // Act
            const result = await processEntityImages({
                data,
                entityType: 'accommodations',
                entityId: 'acc-cached',
                provider,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'required',
                counters
            });

            // Assert
            expect(counters.cached).toBe(1);
            expect(counters.uploaded).toBe(0);
            expect(uploads).toHaveLength(0);
            const media = (result as typeof data).media as {
                featuredImage?: { url?: string };
            };
            expect(media.featuredImage?.url).toBe(cachedUrl);
        });

        it('mixes uploaded + cached across multiple media entries', async () => {
            // Arrange: cache featured but NOT gallery → uploaded:2, cached:1.
            const { provider } = createProviderMock();
            const cache: ImageCache = {
                'hospeda/dev/seed/accommodations/acc-mix/featured': {
                    originalUrl: 'https://src/featured.jpg',
                    cloudinaryUrl: 'https://cdn.example.com/cached.jpg',
                    uploadedAt: '2024-01-01T00:00:00.000Z',
                    fileModifiedAt: null
                }
            };
            const counters = createImageProcessingCounters();
            const data = {
                id: 'acc-mix',
                media: {
                    featuredImage: { url: 'https://src/featured.jpg' },
                    gallery: [{ url: 'https://src/g0.jpg' }, { url: 'https://src/g1.jpg' }]
                }
            };

            // Act
            await processEntityImages({
                data,
                entityType: 'accommodations',
                entityId: 'acc-mix',
                provider,
                cache,
                cachePath: '/tmp/cache.json',
                env: 'dev',
                seedSource: 'required',
                counters
            });

            // Assert
            expect(counters.cached).toBe(1);
            expect(counters.uploaded).toBe(2);
            expect(counters.failures).toBe(0);
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
