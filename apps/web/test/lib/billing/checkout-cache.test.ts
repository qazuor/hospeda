/**
 * @file checkout-cache.test.ts
 * @description Unit tests for the checkout return-page cache policy (H-15).
 *
 * The static guard in `test/pages/checkout-return-no-store.guard.test.ts`
 * asserts that every return page CALLS this helper. That is a guard over the
 * set of call sites and says nothing about what the helper actually writes —
 * so these tests pin the value itself. Without them, changing the helper to
 * set a cacheable header would leave every existing assertion green.
 */

import { describe, expect, it } from 'vitest';

import { setCheckoutReturnNoStore } from '../../../src/lib/billing/checkout-cache';

describe('setCheckoutReturnNoStore (H-15)', () => {
    it('bars shared caches AND the browser disk cache', () => {
        const response = { headers: new Headers() };

        setCheckoutReturnNoStore({ response });

        const value = response.headers.get('Cache-Control');
        // `private` bars Cloudflare and any intermediary proxy — the leak that
        // would serve one buyer's payment state to the next. `no-store` also
        // bars the browser's own disk cache, so a back navigation after logout
        // cannot resurrect the rendered result.
        expect(value).toContain('private');
        expect(value).toContain('no-store');
    });

    it('overwrites a cacheable header already set upstream', () => {
        // A layout or middleware that had already marked the response
        // cacheable must not win: this helper runs to make the page private,
        // and "it was already set" is not a reason to leave it that way.
        const response = { headers: new Headers({ 'Cache-Control': 'public, s-maxage=300' }) };

        setCheckoutReturnNoStore({ response });

        expect(response.headers.get('Cache-Control')).not.toContain('public');
        expect(response.headers.get('Cache-Control')).not.toContain('s-maxage');
    });
});
