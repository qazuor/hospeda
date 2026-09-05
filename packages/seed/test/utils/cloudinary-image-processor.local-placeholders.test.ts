/**
 * @file cloudinary-image-processor.local-placeholders.test.ts
 * @description Regression + contract tests for the HOS-1144 seed cut at the
 * level that actually ships: the whole chain from `processEntityImages` down to
 * the `MediaSchema.parse` that `seedFactory` runs on its result.
 *
 * ## Why this file exists
 *
 * The first cut returned a ROOT-RELATIVE placeholder (`/assets/images/…svg`)
 * from `uploadSeedImage`, and `processEntityImages` wrote it into
 * `media.featuredImage.url` and every `media.gallery[n].url`. `seedFactory`
 * then validates that block unconditionally, AFTER the rewrite
 * (`seedFactory.ts` → `MediaSchema.parse(processedMedia)`, rethrowing on
 * failure), and `mediaAssetUrl` in `@repo/schemas` is
 * `z.url({ protocol: /^https?$/ })` — which rejects a relative path outright.
 *
 * So the flag aborted the entire e2e seed on the FIRST entity carrying a media
 * block. It went unnoticed because every test exercised `uploadSeedImage` in
 * isolation and nothing walked the chain to the schema.
 *
 * The unit tests one level down cannot catch this class of bug by construction:
 * they assert what the function RETURNS, and the defect was in what a caller
 * then DID with that value. Hence these tests parse with the real schema.
 */

import { LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR } from '@repo/media';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { MediaSchema } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { processEntityImages } from '../../src/utils/cloudinary-image-processor.js';
import { createImageProcessingCounters } from '../../src/utils/seedContext.js';

/** Fixture URLs of the exact shape `packages/seed/src/data/**` actually holds. */
const FEATURED_URL =
    'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/prod/seed/destinations/colon/featured.webp';
const GALLERY_URL_A =
    'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/prod/seed/destinations/colon/gallery-0.webp';
const GALLERY_URL_B =
    'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/prod/seed/destinations/colon/gallery-1.webp';

let originalValue: string | undefined;

/**
 * Sets (or clears) the mode variable. The helper reads the environment on every
 * call, so there is no cache to invalidate.
 *
 * @param value - Raw string to set, or `undefined` to delete the variable.
 */
function setMode(value: string | undefined): void {
    if (value === undefined) {
        delete process.env[LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR];
    } else {
        process.env[LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR] = value;
    }
}

/** A seed entity shaped like a real destination fixture. */
function makeEntityData(): Record<string, unknown> {
    return {
        id: 'destination-colon',
        media: {
            featuredImage: { url: FEATURED_URL, caption: 'Costanera' },
            gallery: [{ url: GALLERY_URL_A }, { url: GALLERY_URL_B }]
        }
    };
}

/** Standard params for the required track with a configured provider. */
function makeParams(overrides: Record<string, unknown> = {}) {
    return {
        data: makeEntityData(),
        entityType: 'destinations',
        entityId: 'destination-colon',
        provider: new InMemoryImageProvider({ cloudName: 'demo' }),
        cache: {},
        cachePath: '/tmp/hos-1144-does-not-exist.json',
        env: 'dev',
        seedSource: 'required' as const,
        ...overrides
    } as Parameters<typeof processEntityImages>[0];
}

beforeEach(() => {
    originalValue = process.env[LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR];
    vi.unstubAllGlobals();
});

afterEach(() => {
    setMode(originalValue);
    vi.unstubAllGlobals();
});

describe('processEntityImages with the mode ON — HOS-1144', () => {
    beforeEach(() => {
        setMode('true');
    });

    it('produces a media block that MediaSchema accepts — the seed must not abort', () => {
        // Arrange / Act — this is precisely what `seedFactory` does with the
        // processed data, unconditionally and after the rewrite.
        return processEntityImages(makeParams()).then((processed) => {
            // Assert
            expect(() => MediaSchema.parse(processed.media)).not.toThrow();
        });
    });

    it('leaves the featured image URL untouched', async () => {
        // Act
        const processed = await processEntityImages(makeParams());
        const media = processed.media as { featuredImage: { url: string } };

        // Assert — the download is what costs; the stored URL costs nothing
        // until something renders it, and the render layer intercepts that.
        expect(media.featuredImage.url).toBe(FEATURED_URL);
    });

    it('leaves every gallery URL untouched', async () => {
        // Act
        const processed = await processEntityImages(makeParams());
        const media = processed.media as { gallery: ReadonlyArray<{ url: string }> };

        // Assert
        expect(media.gallery.map((entry) => entry.url)).toEqual([GALLERY_URL_A, GALLERY_URL_B]);
    });

    it('preserves the caption and injects the moderation default as usual', async () => {
        // Act
        const processed = await processEntityImages(makeParams());
        const media = processed.media as {
            featuredImage: { caption?: string; moderationState?: string };
        };

        // Assert — the mode must not change the SHAPE of the data, only skip
        // the network work.
        expect(media.featuredImage.caption).toBe('Costanera');
        expect(media.featuredImage.moderationState).toBe('APPROVED');
    });

    it('makes NO network call while producing that block', async () => {
        // Arrange
        const fetchSpy = vi.fn(() => {
            throw new Error('fetch must not be called while local-placeholder mode is on');
        });
        vi.stubGlobal('fetch', fetchSpy);

        // Act
        await processEntityImages(makeParams());

        // Assert — the saving, which is the point of the whole change.
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('counts the images as skipped, never as failures', async () => {
        // Arrange
        const counters = createImageProcessingCounters();

        // Act
        await processEntityImages(makeParams({ counters }));

        // Assert — one featured + two gallery.
        expect(counters.skippedPlaceholder).toBe(3);
        expect(counters.failures).toBe(0);
        expect(counters.uploaded).toBe(0);
    });

    it('does not abort on the loud required track (no --allow-required-fallback)', async () => {
        // Act / Assert — `allowRequiredFallback: false` makes a genuine failure
        // throw. A skipped image is not a failure and must stay quiet.
        await expect(
            processEntityImages(makeParams({ allowRequiredFallback: false }))
        ).resolves.toBeDefined();
    });

    it('leaves a user avatar untouched too', async () => {
        // Arrange
        const avatarUrl = 'https://res.cloudinary.com/hospeda/image/upload/v1/avatars/u1.webp';
        const params = makeParams({
            data: { id: 'user-1', profile: { avatar: avatarUrl } },
            entityType: 'users',
            entityId: 'user-1'
        });

        // Act
        const processed = await processEntityImages(params);
        const profile = processed.profile as { avatar: string };

        // Assert
        expect(profile.avatar).toBe(avatarUrl);
    });
});

describe('processEntityImages with the mode OFF (default) — HOS-1144', () => {
    beforeEach(() => {
        setMode(undefined);
    });

    it('still rewrites URLs to Cloudinary, and the result still validates', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                arrayBuffer: async () => new ArrayBuffer(8)
            } as Response)
        );

        // Act
        const processed = await processEntityImages(makeParams());
        const media = processed.media as { featuredImage: { url: string } };

        // Assert — the normal path is untouched by the flag.
        expect(media.featuredImage.url).not.toBe(FEATURED_URL);
        expect(media.featuredImage.url).toContain('res.cloudinary.com');
        expect(() => MediaSchema.parse(processed.media)).not.toThrow();
    });
});
