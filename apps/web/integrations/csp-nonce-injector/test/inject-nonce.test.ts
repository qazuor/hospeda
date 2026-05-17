/**
 * @file inject-nonce.test.ts
 * @description Unit tests for the injectNonce HTML walker (SPEC-046 T-004).
 * Covers the 10 cases enumerated in the spec plus a few defensive ones.
 * AAA pattern. Fixtures live as string constants at the top of the file.
 */

import { describe, expect, it } from 'vitest';
import { injectNonce } from '../inject-nonce';

const NONCE = 'abc123XYZ';

const FIXTURE_PLAIN_SCRIPT =
    '<!doctype html><html><body><script>console.log(1)</script></body></html>';

const FIXTURE_EXTERNAL_SCRIPT =
    '<!doctype html><html><body><script src="https://cdn.example.com/lib.js"></script></body></html>';

const FIXTURE_SCRIPT_WITH_NONCE =
    '<!doctype html><html><body><script nonce="existing-nonce">console.log(1)</script></body></html>';

const FIXTURE_PLAIN_STYLE =
    '<!doctype html><html><head><style>body { color: red; }</style></head></html>';

const FIXTURE_STYLE_WITH_NONCE =
    '<!doctype html><html><head><style nonce="existing-nonce">body { color: red; }</style></head></html>';

const FIXTURE_SCRIPT_INSIDE_NOSCRIPT =
    '<!doctype html><html><body><noscript><script>fallback()</script></noscript></body></html>';

const FIXTURE_SCRIPT_WITH_STYLE_LITERAL =
    '<!doctype html><html><body><script>const html = "<style>foo</style>";</script></body></html>';

const FIXTURE_MALFORMED = '<!doctype html><html><body><script>oops()'; // unclosed script

const FIXTURE_MIXED =
    '<!doctype html><html><head><style>a{}</style><style nonce="kept">b{}</style></head><body><script src="/a.js"></script><script nonce="kept">c</script><script>d</script></body></html>';

describe('injectNonce', () => {
    it('stamps the nonce on a plain inline <script>', () => {
        const { html } = injectNonce({ html: FIXTURE_PLAIN_SCRIPT, nonce: NONCE });

        expect(html).toContain(`<script nonce="${NONCE}">console.log(1)</script>`);
    });

    it('stamps the nonce on an external <script src="...">', () => {
        const { html } = injectNonce({ html: FIXTURE_EXTERNAL_SCRIPT, nonce: NONCE });

        expect(html).toContain(`nonce="${NONCE}"`);
        expect(html).toContain('src="https://cdn.example.com/lib.js"');
    });

    it('leaves a <script nonce="..."> tag untouched', () => {
        const { html } = injectNonce({ html: FIXTURE_SCRIPT_WITH_NONCE, nonce: NONCE });

        expect(html).toContain('nonce="existing-nonce"');
        expect(html).not.toContain(`nonce="${NONCE}"`);
    });

    it('stamps the nonce on a <style> block', () => {
        const { html } = injectNonce({ html: FIXTURE_PLAIN_STYLE, nonce: NONCE });

        expect(html).toContain(`<style nonce="${NONCE}">body { color: red; }</style>`);
    });

    it('leaves a <style nonce="..."> tag untouched', () => {
        const { html } = injectNonce({ html: FIXTURE_STYLE_WITH_NONCE, nonce: NONCE });

        expect(html).toContain('nonce="existing-nonce"');
        expect(html).not.toContain(`nonce="${NONCE}"`);
    });

    it('does NOT modify <script> inside <noscript>', () => {
        const { html } = injectNonce({ html: FIXTURE_SCRIPT_INSIDE_NOSCRIPT, nonce: NONCE });

        expect(html).not.toContain(`nonce="${NONCE}"`);
        // The original noscript content survives, just without nonce.
        expect(html).toContain('fallback()');
    });

    it('does not corrupt script content containing a literal <style> string', () => {
        const { html } = injectNonce({ html: FIXTURE_SCRIPT_WITH_STYLE_LITERAL, nonce: NONCE });

        // The literal text inside the script body must round-trip intact.
        expect(html).toContain('const html = "<style>foo</style>";');
        // Exactly one nonce-stamped tag — the outer <script>, not the literal.
        const occurrences = html.match(new RegExp(`nonce="${NONCE}"`, 'g')) ?? [];
        expect(occurrences.length).toBe(1);
    });

    it('does not throw on malformed (unclosed) HTML', () => {
        expect(() => injectNonce({ html: FIXTURE_MALFORMED, nonce: NONCE })).not.toThrow();
    });

    it('returns empty html unchanged (no-op on empty input)', () => {
        const { html } = injectNonce({ html: '', nonce: NONCE });

        expect(html).toBe('');
    });

    it('is a no-op when nonce is empty (defensive guard)', () => {
        const { html } = injectNonce({ html: FIXTURE_PLAIN_SCRIPT, nonce: '' });

        expect(html).not.toContain('nonce=');
    });

    it('escapes special characters in the nonce value', () => {
        // Base64-like nonce with =, +, /. These are valid in HTML attribute
        // values when quoted, so parse5 must preserve them verbatim. A nonce
        // containing a literal `"` MUST be HTML-escaped by the serializer to
        // avoid attribute injection.
        const trickyNonce = 'abc+/==';
        const { html: safeHtml } = injectNonce({ html: FIXTURE_PLAIN_SCRIPT, nonce: trickyNonce });
        expect(safeHtml).toContain(`nonce="${trickyNonce}"`);

        const evilNonce = 'a"><script>alert(1)</script>';
        const { html: evilHtml } = injectNonce({ html: FIXTURE_PLAIN_SCRIPT, nonce: evilNonce });
        // The dangerous `"` must be escaped — no raw closing quote of the
        // attribute should appear before the intended end of value.
        expect(evilHtml).not.toContain('"><script>alert(1)</script>');
        expect(evilHtml).toContain('&quot;');
    });

    it('handles a mixed document: stamps unguarded, preserves existing nonces, respects noscript', () => {
        const { html } = injectNonce({ html: FIXTURE_MIXED, nonce: NONCE });

        // Existing nonces survive.
        const keptCount = (html.match(/nonce="kept"/g) ?? []).length;
        expect(keptCount).toBe(2);

        // The two unguarded tags (<style>a{}</style>, <script src="/a.js">, <script>d</script>) get stamped.
        const stampedCount = (html.match(new RegExp(`nonce="${NONCE}"`, 'g')) ?? []).length;
        expect(stampedCount).toBe(3);
    });
});
