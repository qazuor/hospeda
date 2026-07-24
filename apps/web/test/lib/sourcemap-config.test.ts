/**
 * @fileoverview
 * Regression test for BETA-66 (Sentry source maps hardening): the web app
 * must only ever generate `.map` files when it can also delete them after
 * upload (i.e. when `SENTRY_AUTH_TOKEN` is present). Without a token, no
 * maps must be generated at all — the previous unconditional `'hidden'`
 * setting leaked `.map` files publicly whenever the token was missing.
 */

import { describe, expect, it } from 'vitest';
import {
    resolveSentrySourcemapsOption,
    resolveSourcemapSetting
} from '../../src/lib/sourcemap-config.js';

describe('resolveSourcemapSetting', () => {
    it('returns "hidden" when a Sentry auth token is present', () => {
        expect(resolveSourcemapSetting({ authToken: 'test-token' })).toBe('hidden');
    });

    it('returns false when the Sentry auth token is undefined', () => {
        expect(resolveSourcemapSetting({ authToken: undefined })).toBe(false);
    });

    it('returns false when the Sentry auth token is an empty string', () => {
        // BETA-66 regression: an empty-string token must not falsely enable
        // hidden source-map generation.
        expect(resolveSourcemapSetting({ authToken: '' })).toBe(false);
    });
});

describe('resolveSentrySourcemapsOption', () => {
    it('enables upload + post-upload cleanup when a Sentry auth token is present', () => {
        expect(resolveSentrySourcemapsOption({ authToken: 'test-token' })).toEqual({
            filesToDeleteAfterUpload: ['**/*.map']
        });
    });

    it('disables source-map functionality when the auth token is undefined', () => {
        // Regression: the integration still runs (so client/server
        // instrumentation is injected), but source-map upload is disabled so
        // the Vite plugin does not warn about the missing token.
        expect(resolveSentrySourcemapsOption({ authToken: undefined })).toEqual({ disable: true });
    });

    it('disables source-map functionality when the auth token is an empty string', () => {
        expect(resolveSentrySourcemapsOption({ authToken: '' })).toEqual({ disable: true });
    });
});
