/**
 * Security regression tests for outbound-link scheme filtering.
 *
 * Context: `z.string().url()` does NOT restrict the URL scheme — verified
 * empirically against the repo's own Zod version, which accepts
 * `javascript:alert(1)`, `data:text/html,…` and `vbscript:` as valid URLs.
 * So any owner-authored URL rendered straight into an `href` is a stored XSS
 * sink, and schema validation is not the control that stops it.
 *
 * This matters for accommodation contact info (H-118) because the value is
 * authored by the host themself through the editor — no staff review stands
 * between the input and the public page.
 */
import { describe, expect, it } from 'vitest';
import { resolveSafeExternalUrl } from '../../src/lib/safe-external-url.js';

describe('resolveSafeExternalUrl — scheme filtering', () => {
    it.each([
        'javascript:alert(1)',
        'JaVaScRiPt:alert(1)',
        '  javascript:alert(1)',
        // Leading whitespace and control characters are stripped by the HTML
        // parser before the scheme is read, so the browser still sees
        // `javascript:`. A naive `startsWith('http')` on the raw string would
        // pass a live payload through.
        '\tjavascript:alert(1)',
        '\njavascript:alert(1)',
        '\rjavascript:alert(1)',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd',
        'blob:https://hospeda.com.ar/abc'
    ])('rejects %j', (value) => {
        expect(resolveSafeExternalUrl(value)).toBeUndefined();
    });

    it.each([
        'https://cheroga.com.ar',
        'http://cheroga.com.ar',
        'HTTPS://CHEROGA.COM.AR',
        'https://instagram.com/cheroga.cdelu?utm=1'
    ])('accepts %j', (value) => {
        expect(resolveSafeExternalUrl(value)).toBe(value.trim());
    });

    it('rejects a value that is not a URL at all', () => {
        expect(resolveSafeExternalUrl('no-es-una-url')).toBeUndefined();
    });

    it.each([undefined, null, '', '   '])('returns undefined for %j', (value) => {
        expect(resolveSafeExternalUrl(value)).toBeUndefined();
    });

    it('does not treat a path-relative value as safe', () => {
        // Relative URLs are same-origin and therefore not "external"; letting one
        // through would mean an owner could point the "their website" link at an
        // internal route and pass it off as their own site.
        expect(resolveSafeExternalUrl('/es/alojamientos')).toBeUndefined();
    });

    it('rejects a protocol-relative URL, whose scheme is decided by the page', () => {
        expect(resolveSafeExternalUrl('//evil.example.com')).toBeUndefined();
    });
});
