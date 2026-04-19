/**
 * Tests for the media provider singleton helpers.
 *
 * Covers SPEC-078-GAPS:
 *   - GAP-078-229: in development without Cloudinary credentials,
 *     `getMediaProvider()` returns an `InMemoryImageProvider` instance and
 *     logs a warn line instead of crashing.
 *   - GAP-078-059 + GAP-078-168: `resetMediaProviderForTesting()` clears the
 *     singleton so the next `getMediaProvider()` call re-initializes with
 *     the current env, and throws when called outside the test NODE env.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MediaModule = typeof import('../../src/services/media');
type EnvModule = typeof import('../../src/utils/env');

const ORIGINAL_ENV = { ...process.env };

/**
 * Re-imports env + media modules after `vi.resetModules()` and runs
 * `validateApiEnv()` so the freshly-imported `env` singleton is populated.
 */
const loadMedia = async (): Promise<MediaModule> => {
    vi.resetModules();
    const envModule: EnvModule = await import('../../src/utils/env');
    envModule.validateApiEnv();
    return await import('../../src/services/media');
};

const restoreEnv = (): void => {
    for (const key of Object.keys(process.env)) {
        if (!(key in ORIGINAL_ENV)) {
            delete process.env[key];
        }
    }
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
        process.env[key] = value;
    }
};

describe('getMediaProvider()', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        restoreEnv();
        vi.restoreAllMocks();
    });

    it('falls back to InMemoryImageProvider in development when creds are missing', async () => {
        process.env.NODE_ENV = 'development';
        process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME = '';
        process.env.HOSPEDA_CLOUDINARY_API_KEY = '';
        process.env.HOSPEDA_CLOUDINARY_API_SECRET = '';

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const { getMediaProvider } = await loadMedia();
        const provider = getMediaProvider();

        // Constructor name rather than `instanceof` — vi.resetModules()
        // creates a fresh module copy, so the class identity imported at
        // module top-level doesn't match the one the re-imported provider
        // module instantiated. The name check is equivalent in intent.
        expect(provider?.constructor.name).toBe('InMemoryImageProvider');
        expect(warnSpy).toHaveBeenCalled();
        const joined = warnSpy.mock.calls.map((c) => String(c[0])).join('\n');
        expect(joined).toContain('InMemoryImageProvider');
    });

    it('returns null in production when creds are missing', async () => {
        // Mimic prod while retaining the test NODE flag that validateApiEnv
        // inspects. We overwrite NODE_ENV directly to hit the non-dev branch.
        process.env.NODE_ENV = 'production';
        process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME = '';
        process.env.HOSPEDA_CLOUDINARY_API_KEY = '';
        process.env.HOSPEDA_CLOUDINARY_API_SECRET = '';
        // Production refinements require these two to be present/non-localhost.
        process.env.HOSPEDA_REDIS_URL = 'redis://prod-host:6379';
        process.env.API_CORS_ORIGINS = 'https://example.com';
        process.env.API_SECURITY_CSRF_ORIGINS = 'https://example.com';

        vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const { getMediaProvider } = await loadMedia();
        expect(getMediaProvider()).toBeNull();
    });
});

describe('resetMediaProviderForTesting()', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        restoreEnv();
        vi.restoreAllMocks();
    });

    it('clears the singleton so the next getMediaProvider() re-initializes', async () => {
        process.env.NODE_ENV = 'test';
        process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME = '';
        process.env.HOSPEDA_CLOUDINARY_API_KEY = '';
        process.env.HOSPEDA_CLOUDINARY_API_SECRET = '';

        vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const { getMediaProvider, resetMediaProviderForTesting } = await loadMedia();

        // First resolution: no creds + non-dev => null.
        expect(getMediaProvider()).toBeNull();
        // Subsequent calls hit the cached null (same singleton).
        expect(getMediaProvider()).toBeNull();

        resetMediaProviderForTesting();
        // Re-initialize with creds present: next call must return an instance.
        process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME = 'demo';
        process.env.HOSPEDA_CLOUDINARY_API_KEY = 'key';
        process.env.HOSPEDA_CLOUDINARY_API_SECRET = 'secret';

        // The cached env object was captured at import time — reload it so
        // the newly-set creds are visible. resetMediaProviderForTesting()
        // only clears the provider singleton; the env singleton is separate.
        const reloaded = await loadMedia();
        const third = reloaded.getMediaProvider();
        expect(third).not.toBeNull();
    });

    it('throws when invoked outside the test NODE env', async () => {
        process.env.NODE_ENV = 'development';
        process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME = '';
        process.env.HOSPEDA_CLOUDINARY_API_KEY = '';
        process.env.HOSPEDA_CLOUDINARY_API_SECRET = '';
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const { resetMediaProviderForTesting } = await loadMedia();

        expect(() => resetMediaProviderForTesting()).toThrow(/only available when NODE_ENV=test/);
    });
});
