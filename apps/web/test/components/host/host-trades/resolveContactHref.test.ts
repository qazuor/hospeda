/**
 * @file resolveContactHref.test.ts
 * @description Pure unit tests for the `resolveContactHref` helper exported from TradeCard.
 *
 * Regression: SPEC-241 — bare `wa.me/...` contact values were passed through without
 * a scheme, producing invalid relative-URL hrefs in the browser. The fix prepends
 * `https://` to any bare `wa.me/` or `wa.me?` string.
 *
 * These tests run without DOM rendering, making them fast and stable across
 * environment changes.
 */

import { describe, expect, it } from 'vitest';
import { resolveContactHref } from '../../../../src/components/host/host-trades/TradeCard';

// ---------------------------------------------------------------------------
// Already-qualified URLs — pass through unchanged
// ---------------------------------------------------------------------------

describe('resolveContactHref — already-qualified URLs pass through', () => {
    it('returns an https:// URL unchanged', () => {
        expect(resolveContactHref('https://wa.me/5493442567890')).toBe(
            'https://wa.me/5493442567890'
        );
    });

    it('returns an http:// URL unchanged', () => {
        expect(resolveContactHref('http://example.com/contact')).toBe('http://example.com/contact');
    });

    it('returns a tel: value unchanged', () => {
        expect(resolveContactHref('tel:+5493442567890')).toBe('tel:+5493442567890');
    });

    it('handles leading/trailing whitespace before scheme check', () => {
        expect(resolveContactHref('  https://wa.me/5493442567890  ')).toBe(
            'https://wa.me/5493442567890'
        );
    });
});

// ---------------------------------------------------------------------------
// Bare wa.me paths — regression for SPEC-241 bug
// ---------------------------------------------------------------------------

describe('resolveContactHref — bare wa.me paths get https:// prepended (SPEC-241 regression)', () => {
    it('prepends https:// to bare wa.me/ path', () => {
        // This was the regression: stored as "wa.me/5493442567890" → rendered as
        // a relative href that browsers cannot navigate. The fix makes it absolute.
        expect(resolveContactHref('wa.me/5493442567890')).toBe('https://wa.me/5493442567890');
    });

    it('prepends https:// to bare wa.me? query-string path', () => {
        expect(resolveContactHref('wa.me?phone=5493442567890')).toBe(
            'https://wa.me?phone=5493442567890'
        );
    });

    it('handles wa.me/ with trailing path segments', () => {
        // Ensure the regex does not accidentally swallow the full path
        expect(resolveContactHref('wa.me/5493442567890/text=Hola')).toBe(
            'https://wa.me/5493442567890/text=Hola'
        );
    });
});

// ---------------------------------------------------------------------------
// Raw phone numbers — wrap in tel:
// ---------------------------------------------------------------------------

describe('resolveContactHref — raw phone numbers become tel: links', () => {
    it('wraps a numeric string in tel:', () => {
        expect(resolveContactHref('5493442567890')).toBe('tel:5493442567890');
    });

    it('strips spaces from a formatted phone number', () => {
        // "+54 3442 567 890" → "tel:+54344256789 0" (spaces removed)
        expect(resolveContactHref('+54 3442 567 890')).toBe('tel:+543442567890');
    });

    it('strips dashes from a formatted phone number', () => {
        expect(resolveContactHref('+54-3442-567890')).toBe('tel:+543442567890');
    });

    it('strips parentheses from a formatted phone number', () => {
        expect(resolveContactHref('+54 (3442) 567890')).toBe('tel:+543442567890');
    });

    it('strips mixed spaces, dashes, and parentheses', () => {
        expect(resolveContactHref('+54 (344) 2-56-78-90')).toBe('tel:+543442567890');
    });
});
