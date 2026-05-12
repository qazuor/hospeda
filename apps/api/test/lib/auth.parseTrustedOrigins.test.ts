/**
 * @file auth.parseTrustedOrigins.test.ts
 *
 * Unit tests for the pure trusted-origins parser used by Better Auth
 * config (src/lib/auth.ts). The function is exported as
 * `parseTrustedOriginsFromConfig` and takes a plain config object so
 * tests can vary each input without mocking `env` or `logger` modules.
 *
 * Covers SPEC-103 T-055 (spec 3.D.1):
 * - well-formed entries are accepted
 * - empty / whitespace entries are skipped
 * - missing scheme triggers a warning and is skipped
 * - non-http(s) scheme triggers a warning and is skipped
 * - duplicates against siteUrl/adminUrl are skipped silently
 * - duplicates within extraOrigins are deduplicated
 * - trailing/leading commas + extra whitespace tolerated
 * - empty config falls back to localhost in dev, throws in production
 */

import { describe, expect, it, vi } from 'vitest';
import {
    type TrustedOriginsConfig,
    parseTrustedOriginsFromConfig
} from '../../src/lib/auth-trusted-origins';

/**
 * Build a TrustedOriginsConfig with sensible defaults and an `onWarn`
 * spy that the test can inspect.
 */
function buildConfig(overrides: Partial<Omit<TrustedOriginsConfig, 'onWarn'>> = {}): {
    config: TrustedOriginsConfig;
    onWarn: ReturnType<typeof vi.fn>;
} {
    const onWarn = vi.fn();
    const config: TrustedOriginsConfig = {
        siteUrl: undefined,
        adminUrl: undefined,
        extraOrigins: undefined,
        nodeEnv: 'test',
        onWarn,
        ...overrides
    };
    return { config, onWarn };
}

describe('parseTrustedOriginsFromConfig', () => {
    describe('canonical origins (siteUrl, adminUrl)', () => {
        it('pushes siteUrl when set', () => {
            const { config } = buildConfig({ siteUrl: 'https://hospeda.com.ar' });
            expect(parseTrustedOriginsFromConfig(config)).toEqual(['https://hospeda.com.ar']);
        });

        it('pushes adminUrl when set', () => {
            const { config } = buildConfig({ adminUrl: 'https://admin.hospeda.com.ar' });
            expect(parseTrustedOriginsFromConfig(config)).toEqual(['https://admin.hospeda.com.ar']);
        });

        it('combines siteUrl and adminUrl in order', () => {
            const { config } = buildConfig({
                siteUrl: 'https://hospeda.com.ar',
                adminUrl: 'https://admin.hospeda.com.ar'
            });
            expect(parseTrustedOriginsFromConfig(config)).toEqual([
                'https://hospeda.com.ar',
                'https://admin.hospeda.com.ar'
            ]);
        });
    });

    describe('extraOrigins parsing', () => {
        it('accepts a single well-formed https URL', () => {
            const { config } = buildConfig({
                siteUrl: 'https://hospeda.com.ar',
                extraOrigins: 'https://staging.hospeda.com.ar'
            });
            expect(parseTrustedOriginsFromConfig(config)).toEqual([
                'https://hospeda.com.ar',
                'https://staging.hospeda.com.ar'
            ]);
        });

        it('accepts a comma-separated list of well-formed URLs', () => {
            const { config } = buildConfig({
                siteUrl: 'https://hospeda.com.ar',
                extraOrigins:
                    'https://staging.hospeda.com.ar,https://staging-admin.hospeda.com.ar,https://staging-api.hospeda.com.ar'
            });
            expect(parseTrustedOriginsFromConfig(config)).toEqual([
                'https://hospeda.com.ar',
                'https://staging.hospeda.com.ar',
                'https://staging-admin.hospeda.com.ar',
                'https://staging-api.hospeda.com.ar'
            ]);
        });

        it('trims whitespace around each entry', () => {
            const { config } = buildConfig({
                extraOrigins: '  https://a.example.com  ,  https://b.example.com  '
            });
            expect(parseTrustedOriginsFromConfig(config)).toEqual([
                'https://a.example.com',
                'https://b.example.com'
            ]);
        });

        it('skips empty entries from trailing/leading commas', () => {
            const { config, onWarn } = buildConfig({
                siteUrl: 'https://hospeda.com.ar',
                extraOrigins: ',https://a.example.com,,https://b.example.com,'
            });
            expect(parseTrustedOriginsFromConfig(config)).toEqual([
                'https://hospeda.com.ar',
                'https://a.example.com',
                'https://b.example.com'
            ]);
            // Empty entries skipped silently — no warning emitted for them.
            expect(onWarn).not.toHaveBeenCalled();
        });

        it('deduplicates an entry that matches siteUrl', () => {
            const { config, onWarn } = buildConfig({
                siteUrl: 'https://hospeda.com.ar',
                extraOrigins: 'https://hospeda.com.ar,https://staging.hospeda.com.ar'
            });
            expect(parseTrustedOriginsFromConfig(config)).toEqual([
                'https://hospeda.com.ar',
                'https://staging.hospeda.com.ar'
            ]);
            expect(onWarn).not.toHaveBeenCalled();
        });

        it('deduplicates entries within extraOrigins itself', () => {
            const { config } = buildConfig({
                extraOrigins: 'https://a.example.com,https://a.example.com'
            });
            expect(parseTrustedOriginsFromConfig(config)).toEqual(['https://a.example.com']);
        });
    });

    describe('warning path — invalid extraOrigins entries', () => {
        it('warns and skips a non-http(s) scheme', () => {
            const { config, onWarn } = buildConfig({
                siteUrl: 'https://hospeda.com.ar',
                extraOrigins: 'ftp://files.example.com'
            });
            expect(parseTrustedOriginsFromConfig(config)).toEqual(['https://hospeda.com.ar']);
            expect(onWarn).toHaveBeenCalledTimes(1);
            expect(onWarn).toHaveBeenCalledWith({
                value: 'ftp://files.example.com',
                reason: expect.stringContaining('non-http(s) scheme')
            });
        });

        it('warns and skips an entry without scheme (malformed URL)', () => {
            const { config, onWarn } = buildConfig({
                siteUrl: 'https://hospeda.com.ar',
                extraOrigins: 'staging.hospeda.com.ar'
            });
            expect(parseTrustedOriginsFromConfig(config)).toEqual(['https://hospeda.com.ar']);
            expect(onWarn).toHaveBeenCalledTimes(1);
            expect(onWarn).toHaveBeenCalledWith({
                value: 'staging.hospeda.com.ar',
                reason: expect.stringContaining('malformed URL')
            });
        });

        it('emits one warning per bad entry without aborting good ones', () => {
            const { config, onWarn } = buildConfig({
                siteUrl: 'https://hospeda.com.ar',
                extraOrigins:
                    'ftp://bad-scheme.com,https://ok.example.com,not-a-url,javascript:alert(1)'
            });
            const origins = parseTrustedOriginsFromConfig(config);
            expect(origins).toEqual(['https://hospeda.com.ar', 'https://ok.example.com']);
            expect(onWarn).toHaveBeenCalledTimes(3);
            const calls = onWarn.mock.calls.map(([w]) => w.value);
            expect(calls).toEqual(['ftp://bad-scheme.com', 'not-a-url', 'javascript:alert(1)']);
        });
    });

    describe('fallback behavior when no origin is configured', () => {
        it('falls back to localhost origins in development', () => {
            const { config } = buildConfig({ nodeEnv: 'development' });
            expect(parseTrustedOriginsFromConfig(config)).toEqual([
                'http://localhost:3000',
                'http://localhost:4321'
            ]);
        });

        it('falls back to localhost origins when NODE_ENV is undefined', () => {
            const { config } = buildConfig({ nodeEnv: undefined });
            expect(parseTrustedOriginsFromConfig(config)).toEqual([
                'http://localhost:3000',
                'http://localhost:4321'
            ]);
        });

        it('throws when NODE_ENV=production and no origin is configured', () => {
            const { config } = buildConfig({ nodeEnv: 'production' });
            expect(() => parseTrustedOriginsFromConfig(config)).toThrowError(
                /HOSPEDA_SITE_URL and HOSPEDA_ADMIN_URL must be configured in production/
            );
        });

        it('does NOT fall back to localhost when at least one canonical URL is set, even in production', () => {
            const { config } = buildConfig({
                nodeEnv: 'production',
                siteUrl: 'https://hospeda.com.ar'
            });
            expect(parseTrustedOriginsFromConfig(config)).toEqual(['https://hospeda.com.ar']);
        });
    });
});
