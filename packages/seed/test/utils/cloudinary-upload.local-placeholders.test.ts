/**
 * @file cloudinary-upload.local-placeholders.test.ts
 * @description Guard for the seed half of the HOS-1144 CI cost guard — the
 * LARGER half.
 *
 * The render-layer rewrite never reaches this pipeline: `uploadSeedImage`
 * `fetch`es the fixture URL directly, and the fixture URLs are themselves
 * `res.cloudinary.com` originals (468 of them, none carrying a transform),
 * downloaded in full only to be uploaded straight back. The on-disk cache that
 * would normally absorb the second run is gitignored, so a clean CI checkout
 * misses on 100% of images every single run.
 *
 * What these tests pin is therefore a NEGATIVE: with the mode on, this function
 * performs no network call at all — no delivery fetch, no upload, no Admin API.
 *
 * It DOES return the original URL unchanged, and that is deliberate rather than
 * a compromise: the value is written into `media.*.url`, which `seedFactory`
 * then validates against `MediaSchema` (`z.url({ protocol: /^https?$/ })`),
 * rethrowing on failure — a root-relative placeholder aborts the whole seed.
 * The chain from here to that schema is pinned in
 * `cloudinary-image-processor.local-placeholders.test.ts`; these cases stop at
 * this function's own contract.
 *
 * Every case restores `HOSPEDA_USE_LOCAL_MEDIA_PLACEHOLDERS` afterwards.
 * Nothing here reads `process.env.CI`.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR } from '@repo/media';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CacheEntry, ImageCache } from '../../src/utils/cloudinary-cache.js';
import { uploadSeedImage } from '../../src/utils/cloudinary-upload.js';

/** A fixture URL of the exact shape the seed data actually carries. */
const SEED_FIXTURE_URL =
    'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/prod/seed/accommodations/acc-1/featured.webp';

let originalValue: string | undefined;
let tmpDir: string;
let cachePath: string;

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

/**
 * Builds the standard upload input, letting each case vary what it cares about.
 */
function makeInput(overrides: Partial<Parameters<typeof uploadSeedImage>[0]> = {}) {
    return {
        originalUrl: SEED_FIXTURE_URL,
        entityType: 'accommodations',
        entityId: 'acc-1',
        role: 'featured',
        provider: new InMemoryImageProvider({ cloudName: 'demo' }),
        cache: {} as ImageCache,
        cachePath,
        env: 'dev',
        ...overrides
    } satisfies Parameters<typeof uploadSeedImage>[0];
}

beforeEach(() => {
    originalValue = process.env[LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR];
    tmpDir = mkdtempSync(join(tmpdir(), 'seed-placeholder-test-'));
    cachePath = join(tmpDir, '.cloudinary-cache.json');
    vi.unstubAllGlobals();
});

afterEach(() => {
    setMode(originalValue);
    vi.unstubAllGlobals();
});

describe('uploadSeedImage with the mode OFF (default)', () => {
    beforeEach(() => {
        setMode(undefined);
    });

    it('still fetches the original and uploads it', async () => {
        // Arrange
        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            arrayBuffer: async () => new ArrayBuffer(8)
        } as Response);
        vi.stubGlobal('fetch', fetchSpy);

        // Act
        const outcome = await uploadSeedImage(makeInput());

        // Assert — the expensive behaviour is intact when the mode is off.
        expect(outcome.status).toBe('uploaded');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy).toHaveBeenCalledWith(SEED_FIXTURE_URL);
    });
});

describe('uploadSeedImage with the mode ON', () => {
    beforeEach(() => {
        setMode('true');
    });

    it('makes NO network call of any kind — this is the whole point', async () => {
        // Arrange — any call at all fails the test loudly rather than silently
        // returning something plausible.
        const fetchSpy = vi.fn(() => {
            throw new Error('fetch must not be called while local-placeholder mode is on');
        });
        vi.stubGlobal('fetch', fetchSpy);

        // Act
        const outcome = await uploadSeedImage(makeInput());

        // Assert
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(outcome.status).toBe('skipped');
    });

    it('never reaches the provider — no upload, no Admin API', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                arrayBuffer: async () => new ArrayBuffer(8)
            } as Response)
        );
        const provider = new InMemoryImageProvider({ cloudName: 'demo' });
        const uploadSpy = vi.spyOn(provider, 'upload');

        // Act
        await uploadSeedImage(makeInput({ provider }));

        // Assert
        expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('returns the ORIGINAL URL unchanged, so the media block keeps its shape', async () => {
        // Arrange / Act — a root-relative placeholder here fails
        // `MediaSchema`'s `z.url({ protocol: /^https?$/ })` in `seedFactory`
        // and aborts the entire seed on the first entity with a media block.
        const outcome = await uploadSeedImage(makeInput());

        // Assert
        expect(outcome.cloudinaryUrl).toBe(SEED_FIXTURE_URL);
    });

    it('returns a URL the media schema can accept — an absolute http(s) one', async () => {
        // Act
        const outcome = await uploadSeedImage(makeInput());

        // Assert — asserted as a PROPERTY, not as the literal input, so a
        // future change of the replacement value still has to satisfy it.
        expect(new URL(outcome.cloudinaryUrl).protocol).toMatch(/^https?:$/);
    });

    it('reports "skipped", NOT "failed" — nothing failed', async () => {
        // Act
        const outcome = await uploadSeedImage(makeInput());

        // Assert
        expect(outcome.status).toBe('skipped');
        expect(outcome.status).not.toBe('failed');
    });

    it('does not throw even on the required track with throwOnFailure', async () => {
        // Arrange / Act — a skipped image is not a failure, so the loud
        // required-track path must stay quiet.
        const outcome = await uploadSeedImage(makeInput({ throwOnFailure: true }));

        // Assert
        expect(outcome.status).toBe('skipped');
    });

    it('cuts AHEAD of the cache lookup — the cached URL is never consulted', async () => {
        // Arrange — a cache entry whose stored URL differs from the input, so
        // returning it would be visible.
        const fullPublicId = 'hospeda/dev/seed/accommodations/acc-1/featured';
        const entry: CacheEntry = {
            originalUrl: SEED_FIXTURE_URL,
            cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/v1/cached.jpg',
            uploadedAt: '2024-01-01T00:00:00.000Z',
            fileModifiedAt: null
        };
        const cache: ImageCache = { [fullPublicId]: entry };

        // Act
        const outcome = await uploadSeedImage(makeInput({ cache }));

        // Assert — `'skipped'`, not `'cached'`, and the input URL rather than
        // the cache's.
        expect(outcome.status).toBe('skipped');
        expect(outcome.cloudinaryUrl).toBe(SEED_FIXTURE_URL);
    });

    it('skips a non-allowlisted URL the same way, without reporting a failure', async () => {
        // Arrange — the SSRF-allowlist branch reports `'failed'`, and it sits
        // after the cut, so it must never be reached.
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);

        // Act
        const outcome = await uploadSeedImage(
            makeInput({ originalUrl: 'https://evil.example.test/a.jpg' })
        );

        // Assert
        expect(outcome.status).toBe('skipped');
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
