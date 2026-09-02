import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractPublicId } from '@repo/media';
import type { ImageProvider } from '@repo/media/server';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CacheEntry, ImageCache } from '../../src/utils/cloudinary-cache.js';
import {
    REQUIRED_FALLBACK_HINT,
    SEED_UPLOAD_MAX_ATTEMPTS,
    SEED_UPLOAD_TIMEOUT_MS,
    uploadSeedImage
} from '../../src/utils/cloudinary-upload.js';
import { logger } from '../../src/utils/logger.js';

/**
 * Builds a seeded {@link CacheEntry} with sane defaults for tests.
 */
function makeCacheEntry(overrides: Partial<CacheEntry> = {}): CacheEntry {
    return {
        originalUrl: 'https://images.unsplash.com/photo.jpg',
        cloudinaryUrl: 'https://res.cloudinary.com/test-cloud/image/upload/v1/cached.jpg',
        uploadedAt: '2024-01-01T00:00:00.000Z',
        fileModifiedAt: null,
        ...overrides
    };
}

/**
 * Returns a vi.fn that resolves to a Response-like object carrying the bytes.
 */
function makeFetchOk(bytes = 8) {
    return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(bytes)
    } as Response);
}

describe('uploadSeedImage — SPEC-078-GAPS T-064', () => {
    let tmpDir: string;
    let cachePath: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'seed-upload-test-'));
        cachePath = join(tmpDir, '.cloudinary-cache.json');
        vi.unstubAllGlobals();
    });

    // -----------------------------------------------------------------------
    // status: 'uploaded'
    // -----------------------------------------------------------------------
    describe('status: "uploaded"', () => {
        it('uploads via the provider and returns the cloudinary URL', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const provider = new InMemoryImageProvider({ cloudName: 'demo' });
            const cache: ImageCache = {};

            // Act
            const outcome = await uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/featured.jpg',
                entityType: 'accommodations',
                entityId: 'acc-1',
                role: 'featured',
                provider,
                cache,
                cachePath,
                env: 'dev'
            });

            // Assert
            expect(outcome.status).toBe('uploaded');
            if (outcome.status !== 'uploaded') throw new Error('unreachable');
            expect(outcome.cloudinaryUrl).toMatch(/res\.cloudinary\.com\/demo\//);
            // Provider stored the asset under the constructed publicId.
            expect(provider.has('hospeda/dev/seed/accommodations/acc-1/featured')).toBe(true);
            // Cache entry persisted under the same key.
            expect(cache['hospeda/dev/seed/accommodations/acc-1/featured']).toBeDefined();
        });

        it('builds the public ID as `hospeda/{env}/seed/{entityType}/{entityId}/{role}`', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const provider = new InMemoryImageProvider();
            const cache: ImageCache = {};

            // Act
            const outcome = await uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/g0.jpg',
                entityType: 'destinations',
                entityId: 'colon',
                role: 'gallery/0',
                provider,
                cache,
                cachePath,
                env: 'prod'
            });

            // Assert: round-trip the URL through extractPublicId.
            if (outcome.status !== 'uploaded') throw new Error('expected uploaded');
            expect(extractPublicId(outcome.cloudinaryUrl)).toBe(
                'hospeda/prod/seed/destinations/colon/gallery/0'
            );
        });
    });

    // -----------------------------------------------------------------------
    // status: 'cached'
    // -----------------------------------------------------------------------
    describe('status: "cached"', () => {
        it('returns the cached URL and does NOT call provider.upload or fetch', async () => {
            // Arrange
            const fetchSpy = makeFetchOk();
            vi.stubGlobal('fetch', fetchSpy);
            const cachedUrl =
                'https://res.cloudinary.com/test-cloud/image/upload/v1/hospeda/dev/seed/accommodations/acc-1/featured';
            const cache: ImageCache = {
                'hospeda/dev/seed/accommodations/acc-1/featured': makeCacheEntry({
                    originalUrl: 'https://images.unsplash.com/featured.jpg',
                    cloudinaryUrl: cachedUrl
                })
            };
            const uploadFn = vi.fn();
            const provider = {
                upload: uploadFn,
                delete: vi.fn(),
                deleteByPrefix: vi.fn(),
                healthCheck: vi.fn()
            } as unknown as ImageProvider;

            // Act
            const outcome = await uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/featured.jpg',
                entityType: 'accommodations',
                entityId: 'acc-1',
                role: 'featured',
                provider,
                cache,
                cachePath,
                env: 'dev'
            });

            // Assert
            expect(outcome.status).toBe('cached');
            if (outcome.status !== 'cached') throw new Error('unreachable');
            expect(outcome.cloudinaryUrl).toBe(cachedUrl);
            expect(uploadFn).not.toHaveBeenCalled();
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('treats a different originalUrl as a cache MISS (re-uploads)', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const cache: ImageCache = {
                'hospeda/dev/seed/accommodations/acc-1/featured': makeCacheEntry({
                    originalUrl: 'https://images.unsplash.com/OLD.jpg'
                })
            };
            const provider = new InMemoryImageProvider();

            // Act
            const outcome = await uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/NEW.jpg',
                entityType: 'accommodations',
                entityId: 'acc-1',
                role: 'featured',
                provider,
                cache,
                cachePath,
                env: 'dev'
            });

            // Assert
            expect(outcome.status).toBe('uploaded');
            // Cache replaced with the new originalUrl.
            expect(cache['hospeda/dev/seed/accommodations/acc-1/featured']?.originalUrl).toBe(
                'https://images.unsplash.com/NEW.jpg'
            );
        });
    });

    // -----------------------------------------------------------------------
    // status: 'failed' / throwOnFailure
    // -----------------------------------------------------------------------
    describe('status: "failed"', () => {
        it('returns failed outcome and the original URL when fetch is non-OK and throwOnFailure=false', async () => {
            // Arrange
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 503,
                    arrayBuffer: async () => new ArrayBuffer(0)
                } as Response)
            );
            const provider = new InMemoryImageProvider();
            const cache: ImageCache = {};

            // Act
            const outcome = await uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/down.jpg',
                entityType: 'events',
                entityId: 'evt-1',
                role: 'featured',
                provider,
                cache,
                cachePath,
                env: 'dev',
                throwOnFailure: false
            });

            // Assert
            expect(outcome.status).toBe('failed');
            if (outcome.status !== 'failed') throw new Error('unreachable');
            expect(outcome.cloudinaryUrl).toBe('https://images.unsplash.com/down.jpg');
            expect(outcome.errorMessage).toMatch(/Failed to fetch image \(503\)/);
            // No cache write on failure.
            expect(Object.keys(cache)).toHaveLength(0);
        });

        it('throws when fetch is non-OK and throwOnFailure=true (required-track default)', async () => {
            // Arrange
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 404,
                    arrayBuffer: async () => new ArrayBuffer(0)
                } as Response)
            );
            const provider = new InMemoryImageProvider();
            const cache: ImageCache = {};

            // Act + Assert
            await expect(
                uploadSeedImage({
                    originalUrl: 'https://images.unsplash.com/missing.jpg',
                    entityType: 'events',
                    entityId: 'evt-2',
                    role: 'featured',
                    provider,
                    cache,
                    cachePath,
                    env: 'dev',
                    throwOnFailure: true
                })
            ).rejects.toThrow(/Failed to fetch image \(404\)/);
        });

        it('returns failed outcome when provider.upload throws and throwOnFailure=false', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const provider = {
                upload: vi.fn().mockRejectedValue(new Error('cloudinary down')),
                delete: vi.fn(),
                deleteByPrefix: vi.fn(),
                healthCheck: vi.fn()
            } as unknown as ImageProvider;
            const cache: ImageCache = {};

            // Act
            const outcome = await uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/x.jpg',
                entityType: 'posts',
                entityId: 'p-1',
                role: 'featured',
                provider,
                cache,
                cachePath,
                env: 'dev',
                throwOnFailure: false
            });

            // Assert
            expect(outcome.status).toBe('failed');
            if (outcome.status !== 'failed') throw new Error('unreachable');
            expect(outcome.cloudinaryUrl).toBe('https://images.unsplash.com/x.jpg');
            expect(outcome.errorMessage).toBe('cloudinary down');
        });

        it('rethrows the underlying provider error when throwOnFailure=true', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const original = new Error('cloudinary down');
            const provider = {
                upload: vi.fn().mockRejectedValue(original),
                delete: vi.fn(),
                deleteByPrefix: vi.fn(),
                healthCheck: vi.fn()
            } as unknown as ImageProvider;
            const cache: ImageCache = {};

            // Act + Assert
            await expect(
                uploadSeedImage({
                    originalUrl: 'https://images.unsplash.com/x.jpg',
                    entityType: 'posts',
                    entityId: 'p-2',
                    role: 'featured',
                    provider,
                    cache,
                    cachePath,
                    env: 'dev',
                    throwOnFailure: true
                })
            ).rejects.toBe(original);
        });
    });

    // -----------------------------------------------------------------------
    // publicIdOverride (T-023 avatar branch)
    // -----------------------------------------------------------------------
    describe('publicIdOverride (avatar/sponsor/organizer flat-path)', () => {
        it('overrides the default public ID and uses it verbatim for both folder + leaf', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const provider = new InMemoryImageProvider();
            const cache: ImageCache = {};
            const userId = 'user-001';
            const flatId = `hospeda/dev/seed/avatars/${userId}`;

            // Act
            const outcome = await uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/avatar.jpg',
                // entityType + role are still required by the signature but
                // when publicIdOverride is set they MUST NOT influence the
                // resulting publicId.
                entityType: 'users',
                entityId: userId,
                role: 'avatar',
                provider,
                cache,
                cachePath,
                env: 'dev',
                publicIdOverride: flatId
            });

            // Assert
            expect(outcome.status).toBe('uploaded');
            if (outcome.status !== 'uploaded') throw new Error('unreachable');
            // The provider record is keyed by the override, NOT by the default
            // `users/user-001/avatar` shape.
            expect(provider.has(flatId)).toBe(true);
            expect(provider.has('hospeda/dev/seed/users/user-001/avatar')).toBe(false);
            // Round-trip through extractPublicId for full assurance.
            expect(extractPublicId(outcome.cloudinaryUrl)).toBe(flatId);
            // Cache key is the override.
            expect(cache[flatId]).toBeDefined();
        });

        it('honors the override even when a cache entry exists at the DEFAULT key only', async () => {
            // Arrange — cache has the default key seeded but the override is a
            // different key, so this must MISS and re-upload at the override.
            vi.stubGlobal('fetch', makeFetchOk());
            const provider = new InMemoryImageProvider();
            const cache: ImageCache = {
                'hospeda/dev/seed/users/user-002/avatar': makeCacheEntry({
                    originalUrl: 'https://images.unsplash.com/avatar.jpg'
                })
            };
            const flatId = 'hospeda/dev/seed/avatars/user-002';

            // Act
            const outcome = await uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/avatar.jpg',
                entityType: 'users',
                entityId: 'user-002',
                role: 'avatar',
                provider,
                cache,
                cachePath,
                env: 'dev',
                publicIdOverride: flatId
            });

            // Assert
            expect(outcome.status).toBe('uploaded');
            // Both keys now exist in the cache (default seeded + override new).
            expect(cache[flatId]).toBeDefined();
            expect(cache['hospeda/dev/seed/users/user-002/avatar']).toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    // GAP-078-030: SSRF allowlist
    // -----------------------------------------------------------------------
    describe('SSRF allowlist (GAP-078-030)', () => {
        it('skips fetch + upload when the originalUrl hostname is not allowlisted', async () => {
            // Arrange — fetch would "succeed" if called; the allowlist must
            // short-circuit before any network call.
            const fetchSpy = makeFetchOk();
            vi.stubGlobal('fetch', fetchSpy);
            const upload = vi.fn().mockResolvedValue({ url: 'should-not-be-called' });
            const provider = {
                upload,
                delete: vi.fn(),
                deleteByPrefix: vi.fn(),
                healthCheck: vi.fn()
            } as unknown as ImageProvider;
            const cache: ImageCache = {};

            // Act
            const outcome = await uploadSeedImage({
                originalUrl: 'https://evil.internal.local/secret.jpg',
                entityType: 'accommodations',
                entityId: 'acc-ssrf',
                role: 'featured',
                provider,
                cache,
                cachePath,
                env: 'dev'
            });

            // Assert — behavior: failed outcome, no fetch, no upload, no cache write.
            expect(outcome.status).toBe('failed');
            if (outcome.status !== 'failed') throw new Error('unreachable');
            expect(outcome.cloudinaryUrl).toBe('https://evil.internal.local/secret.jpg');
            expect(outcome.errorMessage).toMatch(/not in allowlist/);
            expect(fetchSpy).not.toHaveBeenCalled();
            expect(upload).not.toHaveBeenCalled();
            expect(Object.keys(cache)).toHaveLength(0);
        });

        it('does NOT throw on disallowed URL even when throwOnFailure=true', async () => {
            // Arrange — a disallowed URL is a fixture/data defect, not a
            // network error; it must never abort a required-track run.
            const fetchSpy = makeFetchOk();
            vi.stubGlobal('fetch', fetchSpy);
            const provider = new InMemoryImageProvider();
            const cache: ImageCache = {};

            // Act
            const outcome = await uploadSeedImage({
                originalUrl: 'http://169.254.169.254/latest/meta-data/',
                entityType: 'users',
                entityId: 'u-ssrf',
                role: 'avatar',
                provider,
                cache,
                cachePath,
                env: 'dev',
                throwOnFailure: true
            });

            // Assert
            expect(outcome.status).toBe('failed');
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('allows fetch when the URL is on the allowlist (happy-path regression)', async () => {
            // Arrange
            const fetchSpy = makeFetchOk();
            vi.stubGlobal('fetch', fetchSpy);
            const provider = new InMemoryImageProvider({ cloudName: 'demo' });
            const cache: ImageCache = {};

            // Act
            const outcome = await uploadSeedImage({
                originalUrl: 'https://images.pexels.com/photos/1/pexels-photo-1.jpeg',
                entityType: 'posts',
                entityId: 'p-1',
                role: 'featured',
                provider,
                cache,
                cachePath,
                env: 'dev'
            });

            // Assert
            expect(outcome.status).toBe('uploaded');
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });
    });

    // -----------------------------------------------------------------------
    // HOS-397 — error serialization, upload retries, and flag discoverability
    // -----------------------------------------------------------------------
    describe('HOS-397: Cloudinary plain-object rejections', () => {
        /**
         * The exact shape the Cloudinary SDK rejects with on a timed-out upload:
         * a plain object, not an `Error`. `String(value)` on it yields
         * `[object Object]`, which is what used to reach the operator.
         */
        function makeCloudinaryTimeoutRejection(): Record<string, unknown> {
            return { message: 'Request Timeout', http_code: 499, name: 'TimeoutError' };
        }

        /** Builds an ImageProvider whose `upload` runs the supplied mock. */
        function makeProvider(upload: ReturnType<typeof vi.fn>): ImageProvider {
            return {
                upload,
                delete: vi.fn(),
                deleteByPrefix: vi.fn(),
                healthCheck: vi.fn()
            } as unknown as ImageProvider;
        }

        // A timeout is retryable, so these cases walk the backoff. Fake timers keep
        // them off the wall clock.
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('serializes a plain-object rejection instead of reporting [object Object]', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const provider = makeProvider(
                vi.fn().mockRejectedValue(makeCloudinaryTimeoutRejection())
            );

            // Act
            const pending = uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/x.jpg',
                entityType: 'destinations',
                entityId: '017-destination-san-justo',
                role: 'featured',
                provider,
                cache: {},
                cachePath,
                env: 'dev',
                throwOnFailure: false
            });
            await vi.runAllTimersAsync();
            const outcome = await pending;

            // Assert
            expect(outcome.status).toBe('failed');
            if (outcome.status !== 'failed') throw new Error('unreachable');
            expect(outcome.errorMessage).not.toContain('[object Object]');
            expect(outcome.errorMessage).toContain('Request Timeout');
            expect(outcome.errorMessage).toContain('499');
            expect(outcome.errorMessage).toContain('TimeoutError');
        });

        it('throws a real Error carrying the serialized cause when throwOnFailure=true', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const rejection = makeCloudinaryTimeoutRejection();
            const provider = makeProvider(vi.fn().mockRejectedValue(rejection));

            // Act
            const pending = uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/x.jpg',
                entityType: 'destinations',
                entityId: '017-destination-san-justo',
                role: 'featured',
                provider,
                cache: {},
                cachePath,
                env: 'dev',
                throwOnFailure: true
            }).catch((error: unknown) => error);
            await vi.runAllTimersAsync();
            const thrown = await pending;

            // Assert
            expect(thrown).toBeInstanceOf(Error);
            const error = thrown as Error;
            expect(error.message).not.toContain('[object Object]');
            expect(error.message).toContain('Request Timeout');
            // The original rejection stays reachable for further inspection.
            expect(error.cause).toBe(rejection);
        });

        it('names --allow-required-fallback when an image failure aborts the seed', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
            const provider = makeProvider(
                vi.fn().mockRejectedValue(makeCloudinaryTimeoutRejection())
            );

            // Act
            const pending = uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/x.jpg',
                entityType: 'destinations',
                entityId: '017-destination-san-justo',
                role: 'featured',
                provider,
                cache: {},
                cachePath,
                env: 'dev',
                throwOnFailure: true
            }).catch(() => undefined);
            await vi.runAllTimersAsync();
            await pending;

            // Assert
            const logged = errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
            expect(logged).toContain('--allow-required-fallback');
            expect(logged).toContain(REQUIRED_FALLBACK_HINT);
            errorSpy.mockRestore();
        });

        it('names --allow-required-fallback when the source fetch aborts the seed', async () => {
            // Arrange
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response)
            );
            const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

            // Act
            await uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/x.jpg',
                entityType: 'destinations',
                entityId: '017-destination-san-justo',
                role: 'featured',
                provider: new InMemoryImageProvider(),
                cache: {},
                cachePath,
                env: 'dev',
                throwOnFailure: true
            }).catch(() => undefined);

            // Assert
            const logged = errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
            expect(logged).toContain('--allow-required-fallback');
            errorSpy.mockRestore();
        });
    });

    describe('HOS-397: transient upload retries', () => {
        /** Builds an ImageProvider whose `upload` runs the supplied mock. */
        function makeProvider(upload: ReturnType<typeof vi.fn>): ImageProvider {
            return {
                upload,
                delete: vi.fn(),
                deleteByPrefix: vi.fn(),
                healthCheck: vi.fn()
            } as unknown as ImageProvider;
        }

        const uploadOk = {
            url: 'https://res.cloudinary.com/demo/image/upload/v1/ok.jpg',
            publicId: 'hospeda/dev/seed/destinations/d-1/featured',
            width: 1,
            height: 1
        };

        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('retries a timeout and succeeds on a later attempt', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const upload = vi
                .fn()
                .mockRejectedValueOnce({
                    message: 'Request Timeout',
                    http_code: 499,
                    name: 'TimeoutError'
                })
                .mockResolvedValueOnce(uploadOk);
            const provider = makeProvider(upload);

            // Act
            const pending = uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/x.jpg',
                entityType: 'destinations',
                entityId: 'd-1',
                role: 'featured',
                provider,
                cache: {},
                cachePath,
                env: 'dev',
                throwOnFailure: true
            });
            await vi.runAllTimersAsync();
            const outcome = await pending;

            // Assert
            expect(outcome.status).toBe('uploaded');
            expect(upload).toHaveBeenCalledTimes(2);
        });

        it('gives up after SEED_UPLOAD_MAX_ATTEMPTS on a persistent timeout', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const upload = vi.fn().mockRejectedValue({
                message: 'Request Timeout',
                http_code: 499,
                name: 'TimeoutError'
            });
            const provider = makeProvider(upload);

            // Act
            const pending = uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/x.jpg',
                entityType: 'destinations',
                entityId: 'd-2',
                role: 'featured',
                provider,
                cache: {},
                cachePath,
                env: 'dev',
                throwOnFailure: false
            });
            await vi.runAllTimersAsync();
            const outcome = await pending;

            // Assert
            expect(outcome.status).toBe('failed');
            expect(upload).toHaveBeenCalledTimes(SEED_UPLOAD_MAX_ATTEMPTS);
        });

        it('retries a 5xx from Cloudinary', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const upload = vi
                .fn()
                .mockRejectedValueOnce({ message: 'Server Error', http_code: 500 })
                .mockResolvedValueOnce(uploadOk);
            const provider = makeProvider(upload);

            // Act
            const pending = uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/x.jpg',
                entityType: 'destinations',
                entityId: 'd-3',
                role: 'featured',
                provider,
                cache: {},
                cachePath,
                env: 'dev'
            });
            await vi.runAllTimersAsync();
            const outcome = await pending;

            // Assert
            expect(outcome.status).toBe('uploaded');
            expect(upload).toHaveBeenCalledTimes(2);
        });

        it('does NOT retry a permanent failure', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const upload = vi
                .fn()
                .mockRejectedValue({ message: 'Invalid image file', http_code: 400 });
            const provider = makeProvider(upload);

            // Act
            const pending = uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/x.jpg',
                entityType: 'destinations',
                entityId: 'd-4',
                role: 'featured',
                provider,
                cache: {},
                cachePath,
                env: 'dev'
            });
            await vi.runAllTimersAsync();
            const outcome = await pending;

            // Assert
            expect(outcome.status).toBe('failed');
            expect(upload).toHaveBeenCalledTimes(1);
        });

        it('hands the provider a bounded per-attempt timeout', async () => {
            // Arrange
            vi.stubGlobal('fetch', makeFetchOk());
            const upload = vi.fn().mockResolvedValue(uploadOk);
            const provider = makeProvider(upload);

            // Act
            const pending = uploadSeedImage({
                originalUrl: 'https://images.unsplash.com/x.jpg',
                entityType: 'destinations',
                entityId: 'd-5',
                role: 'featured',
                provider,
                cache: {},
                cachePath,
                env: 'dev'
            });
            await vi.runAllTimersAsync();
            await pending;

            // Assert
            expect(upload).toHaveBeenCalledWith(
                expect.objectContaining({ timeoutMs: SEED_UPLOAD_TIMEOUT_MS })
            );
        });
    });
});
