/**
 * @fileoverview
 * Regression test for BETA-66 (Sentry source maps hardening): in
 * production, the admin app must only ever generate `.map` files when it
 * can also delete them after upload (i.e. when `SENTRY_AUTH_TOKEN` is
 * present). Without a token, no maps must be generated at all in
 * production — the previous unconditional `'hidden'` setting leaked `.map`
 * files publicly whenever the token was missing.
 */

import { describe, expect, it } from 'vitest';
import { resolveSourcemapSetting } from '../../../src/lib/sentry/sourcemap-config.js';

describe('resolveSourcemapSetting', () => {
    it('returns "hidden" in production when a Sentry auth token is present', () => {
        expect(resolveSourcemapSetting({ authToken: 'test-token', isProduction: true })).toBe(
            'hidden'
        );
    });

    it('returns false in production when the Sentry auth token is undefined', () => {
        expect(resolveSourcemapSetting({ authToken: undefined, isProduction: true })).toBe(false);
    });

    it('returns false in production when the Sentry auth token is an empty string', () => {
        // BETA-66 regression: an empty-string token must not falsely enable
        // hidden source-map generation.
        expect(resolveSourcemapSetting({ authToken: '', isProduction: true })).toBe(false);
    });

    it('returns true in non-production regardless of the auth token', () => {
        expect(resolveSourcemapSetting({ authToken: undefined, isProduction: false })).toBe(true);
        expect(resolveSourcemapSetting({ authToken: 'test-token', isProduction: false })).toBe(
            true
        );
    });
});
