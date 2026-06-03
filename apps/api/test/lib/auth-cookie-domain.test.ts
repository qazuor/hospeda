/**
 * Unit tests for the session-cookie domain resolution (SPEC-182 T-018).
 *
 * The dev-local cross-subdomain recipe (`*.hospeda.local` + /etc/hosts) needs
 * the Better Auth cookie domain to be configurable in development via
 * HOSPEDA_DEV_COOKIE_DOMAIN, while production stays pinned to the real apex.
 */

import { describe, expect, it } from 'vitest';
import { resolveCookieDomain } from '../../src/lib/auth-cookie-domain';

describe('resolveCookieDomain', () => {
    it('always returns the production apex in production, ignoring the dev var', () => {
        expect(
            resolveCookieDomain({ nodeEnv: 'production', devCookieDomain: '.hospeda.local' })
        ).toBe('hospeda.com.ar');
        expect(resolveCookieDomain({ nodeEnv: 'production', devCookieDomain: undefined })).toBe(
            'hospeda.com.ar'
        );
    });

    it('returns the dev cookie domain in development when configured', () => {
        expect(
            resolveCookieDomain({ nodeEnv: 'development', devCookieDomain: '.hospeda.local' })
        ).toBe('.hospeda.local');
    });

    it('returns undefined in development when the dev var is unset (per-host cookies)', () => {
        expect(
            resolveCookieDomain({ nodeEnv: 'development', devCookieDomain: undefined })
        ).toBeUndefined();
    });

    it('treats an empty/whitespace dev value as unset', () => {
        expect(
            resolveCookieDomain({ nodeEnv: 'development', devCookieDomain: '' })
        ).toBeUndefined();
        expect(
            resolveCookieDomain({ nodeEnv: 'development', devCookieDomain: '   ' })
        ).toBeUndefined();
    });

    it('applies the dev domain in test env too (non-production)', () => {
        expect(resolveCookieDomain({ nodeEnv: 'test', devCookieDomain: '.hospeda.local' })).toBe(
            '.hospeda.local'
        );
    });
});
