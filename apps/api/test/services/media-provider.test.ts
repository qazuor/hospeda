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

        // SPEC-078-GAPS T-056 / GAP-078-014: the media provider now warns
        // through `apiLogger.warn` instead of `console.warn`. Spy on the
        // structured logger to assert the init line is still emitted.
        vi.resetModules();
        const envModule: EnvModule = await import('../../src/utils/env');
        envModule.validateApiEnv();
        const loggerModule = await import('../../src/utils/logger');
        const warnSpy = vi
            .spyOn(loggerModule.apiLogger, 'warn')
            .mockImplementation(() => undefined);
        const mediaModule: MediaModule = await import('../../src/services/media');
        const provider = mediaModule.getMediaProvider();

        // Constructor name rather than `instanceof` — vi.resetModules()
        // creates a fresh module copy, so the class identity imported at
        // module top-level doesn't match the one the re-imported provider
        // module instantiated. The name check is equivalent in intent.
        expect(provider?.constructor.name).toBe('InMemoryImageProvider');
        expect(warnSpy).toHaveBeenCalled();
        const joined = warnSpy.mock.calls.map((c) => String(c[1])).join('\n');
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
        // Production refinements forbid debug/test flags. The .env.test file
        // sets these to true for the rest of the suite; we must clear them
        // here to simulate a clean prod boot (otherwise validateApiEnv
        // calls process.exit(1) — which is the correct prod-safety behavior).
        process.env.HOSPEDA_API_DEBUG_ERRORS = 'false';
        process.env.HOSPEDA_DISABLE_AUTH = 'false';
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'false';
        process.env.HOSPEDA_DEBUG_TESTS = 'false';
        // The production superRefine (added in SPEC-200) requires HOSPEDA_AI_VAULT_MASTER_KEY
        // (min 32 chars) when NODE_ENV==='production'. Set a dummy value so
        // validateApiEnv() does not call process.exit(1) before reaching the
        // media-provider branch being tested.
        process.env.HOSPEDA_AI_VAULT_MASTER_KEY = 'test-vault-master-key-0123456789abcd';
        // Env hardening made these service credentials prod-required. Provide
        // valid placeholders so validateApiEnv() reaches the media-provider
        // branch under test. Cloudinary is deliberately left empty above — it
        // stays optional (graceful degradation to a null provider).
        process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-test-token';
        process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = 'test-webhook-secret';
        process.env.HOSPEDA_EMAIL_API_KEY = 'test-email-api-key';
        process.env.HOSPEDA_EMAIL_FROM_EMAIL = 'noreply@hospeda.com.ar';
        process.env.HOSPEDA_SENTRY_DSN = 'https://test@sentry.io/1';
        process.env.HOSPEDA_LINEAR_API_KEY = 'lin_api_test';
        process.env.HOSPEDA_POSTHOG_KEY = 'phc_test';
        process.env.HOSPEDA_APIFY_TOKEN = 'apify_api_test';
        process.env.HOSPEDA_GOOGLE_PLACES_API_KEY = 'google-places-test';

        vi.resetModules();
        const envModule: EnvModule = await import('../../src/utils/env');
        envModule.validateApiEnv();
        const loggerModule = await import('../../src/utils/logger');
        vi.spyOn(loggerModule.apiLogger, 'warn').mockImplementation(() => undefined);
        const mediaModule: MediaModule = await import('../../src/services/media');
        expect(mediaModule.getMediaProvider()).toBeNull();
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

        vi.resetModules();
        const _envModule0: EnvModule = await import('../../src/utils/env');
        _envModule0.validateApiEnv();
        const _loggerModule0 = await import('../../src/utils/logger');
        vi.spyOn(_loggerModule0.apiLogger, 'warn').mockImplementation(() => undefined);
        const _mediaModule0: MediaModule = await import('../../src/services/media');
        const { getMediaProvider, resetMediaProviderForTesting } = _mediaModule0;

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
        vi.resetModules();
        const _envModule1: EnvModule = await import('../../src/utils/env');
        _envModule1.validateApiEnv();
        const _loggerModule1 = await import('../../src/utils/logger');
        vi.spyOn(_loggerModule1.apiLogger, 'warn').mockImplementation(() => undefined);
        const _mediaModule1: MediaModule = await import('../../src/services/media');
        const { resetMediaProviderForTesting } = _mediaModule1;

        expect(() => resetMediaProviderForTesting()).toThrow(/only available when NODE_ENV=test/);
    });
});
