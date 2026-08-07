/**
 * @file rewrite-async-stylesheets.test.ts
 * @description Unit tests for `rewriteAsyncStylesheets` and the allowlist
 * predicate it is built on (HOS-369 async-CSS).
 *
 * AAA pattern. Fixtures live as string constants at the top of the file.
 */

import { describe, expect, it } from 'vitest';
import {
    ASYNC_CSS_ACTIVATION_SCRIPT_CONTENT,
    BLOCKING_STYLESHEET_ALLOWLIST_PATTERNS,
    isBlockingStylesheetName,
    rewriteAsyncStylesheets
} from '../rewrite-async-stylesheets';

const stylesheetLink = (name: string, hash = 'HASH1234'): string =>
    `<link rel="stylesheet" href="/_astro/${name}.${hash}.css">`;

const wrapInDocument = (headContent: string): string =>
    `<!doctype html><html><head>${headContent}</head><body><h1>hi</h1></body></html>`;

describe('isBlockingStylesheetName — allowlist criterion', () => {
    it('keeps the page-level "index" stylesheet blocking', () => {
        expect(isBlockingStylesheetName({ name: 'index' })).toBe(true);
    });

    it('keeps any *Layout stylesheet blocking (BaseLayout, ListingLayout, DetailLayout, ...)', () => {
        expect(isBlockingStylesheetName({ name: 'BaseLayout' })).toBe(true);
        expect(isBlockingStylesheetName({ name: 'ListingLayout' })).toBe(true);
        expect(isBlockingStylesheetName({ name: 'DetailLayout' })).toBe(true);
    });

    it('keeps WaveHeader and ListingPageHeader blocking (above-the-fold bands)', () => {
        expect(isBlockingStylesheetName({ name: 'WaveHeader' })).toBe(true);
        expect(isBlockingStylesheetName({ name: 'ListingPageHeader' })).toBe(true);
    });

    it('does NOT allowlist an arbitrary component stylesheet', () => {
        expect(isBlockingStylesheetName({ name: 'AccommodationCard' })).toBe(false);
        expect(isBlockingStylesheetName({ name: 'SearchBar' })).toBe(false);
        expect(isBlockingStylesheetName({ name: '_astro_transitions' })).toBe(false);
    });

    it('does not false-positive on a name that merely CONTAINS "Layout" mid-word without ending in it', () => {
        // Guards the `Layout$` anchor: a hypothetical "LayoutSwitcher" component
        // must NOT be treated as a layout shell.
        expect(isBlockingStylesheetName({ name: 'LayoutSwitcher' })).toBe(false);
    });

    it('exposes the allowlist patterns as a non-empty, readonly array', () => {
        expect(BLOCKING_STYLESHEET_ALLOWLIST_PATTERNS.length).toBeGreaterThan(0);
    });
});

describe('rewriteAsyncStylesheets — defers non-allowlisted component stylesheets', () => {
    it('adds media="print" + data-async-css to a non-allowlisted stylesheet link', () => {
        const html = wrapInDocument(stylesheetLink('AccommodationCard'));

        const { html: result } = rewriteAsyncStylesheets({ html });

        expect(result).toContain(
            '<link rel="stylesheet" href="/_astro/AccommodationCard.HASH1234.css" media="print" data-async-css>'
        );
    });

    it('leaves an allowlisted stylesheet link COMPLETELY untouched (no media, no marker)', () => {
        const html = wrapInDocument(stylesheetLink('index') + stylesheetLink('BaseLayout'));

        const { html: result } = rewriteAsyncStylesheets({ html });

        expect(result).toContain('<link rel="stylesheet" href="/_astro/index.HASH1234.css">');
        expect(result).toContain('<link rel="stylesheet" href="/_astro/BaseLayout.HASH1234.css">');
        expect(result).not.toContain('href="/_astro/index.HASH1234.css" media="print"');
        expect(result).not.toContain('href="/_astro/BaseLayout.HASH1234.css" media="print"');
    });

    it('emits a <noscript> fallback with a plain (unconditionally blocking) link for each deferred stylesheet', () => {
        const html = wrapInDocument(stylesheetLink('SearchBar'));

        const { html: result } = rewriteAsyncStylesheets({ html });

        expect(result).toContain(
            '<noscript><link rel="stylesheet" href="/_astro/SearchBar.HASH1234.css"></noscript>'
        );
    });

    it('does NOT touch a non-/_astro/ stylesheet (e.g. the Google Fonts link)', () => {
        const html = wrapInDocument(
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geologica">'
        );

        const { html: result, deferredHrefs } = rewriteAsyncStylesheets({ html });

        expect(result).toContain(
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geologica">'
        );
        expect(result).not.toContain('data-async-css>');
        expect(deferredHrefs).toEqual([]);
    });

    it('leaves a stylesheet <link> that carries EXTRA attributes untouched (fails closed, stays blocking)', () => {
        // A shape the regex does not recognize must default to "no-op", never
        // to a malformed rewrite — the conservative failure mode this module's
        // JSDoc promises.
        const html = wrapInDocument(
            '<link rel="stylesheet" href="/_astro/SomeComponent.HASH1234.css" crossorigin="anonymous">'
        );

        const { html: result, deferredHrefs } = rewriteAsyncStylesheets({ html });

        expect(result).toContain(
            '<link rel="stylesheet" href="/_astro/SomeComponent.HASH1234.css" crossorigin="anonymous">'
        );
        expect(deferredHrefs).toEqual([]);
    });

    it('returns the deferred hrefs list for observability', () => {
        const html = wrapInDocument(stylesheetLink('SearchBar') + stylesheetLink('index'));

        const { deferredHrefs } = rewriteAsyncStylesheets({ html });

        expect(deferredHrefs).toEqual(['/_astro/SearchBar.HASH1234.css']);
    });

    it('handles multiple non-allowlisted stylesheets in one document', () => {
        const html = wrapInDocument(
            stylesheetLink('SearchBar') +
                stylesheetLink('AccommodationCard') +
                stylesheetLink('index')
        );

        const { deferredHrefs } = rewriteAsyncStylesheets({ html });

        expect(deferredHrefs).toEqual([
            '/_astro/SearchBar.HASH1234.css',
            '/_astro/AccommodationCard.HASH1234.css'
        ]);
    });
});

describe('rewriteAsyncStylesheets — activation script injection', () => {
    it('injects the activation <script> right before </body>', () => {
        const html = wrapInDocument(stylesheetLink('SearchBar'));

        const { html: result } = rewriteAsyncStylesheets({ html });
        const scriptIndex = result.indexOf('data-async-css-activator');
        const bodyCloseIndex = result.indexOf('</body>');

        expect(scriptIndex).toBeGreaterThan(-1);
        expect(scriptIndex).toBeLessThan(bodyCloseIndex);
    });

    it('injects the EXACT fixed script content, with no per-request interpolation', () => {
        const html = wrapInDocument(stylesheetLink('SearchBar'));

        const { html: result } = rewriteAsyncStylesheets({ html });

        expect(result).toContain(
            `<script data-async-css-activator>${ASYNC_CSS_ACTIVATION_SCRIPT_CONTENT}</script>`
        );
    });

    it('injects the SAME script content whether or not any stylesheet was deferred (byte-identical across pages)', () => {
        const withDeferrals = wrapInDocument(stylesheetLink('SearchBar'));
        const withoutDeferrals = wrapInDocument(
            stylesheetLink('index') + stylesheetLink('BaseLayout')
        );

        const resultA = rewriteAsyncStylesheets({ html: withDeferrals }).html;
        const resultB = rewriteAsyncStylesheets({ html: withoutDeferrals }).html;

        const extractScript = (html: string): string | null =>
            html.match(/<script data-async-css-activator>([^<]*)<\/script>/)?.[1] ?? null;

        expect(extractScript(resultA)).toBe(ASYNC_CSS_ACTIVATION_SCRIPT_CONTENT);
        expect(extractScript(resultB)).toBe(ASYNC_CSS_ACTIVATION_SCRIPT_CONTENT);
        expect(extractScript(resultA)).toBe(extractScript(resultB));
    });

    it('appends the script at the end when the document has no </body> (defensive fallback)', () => {
        const html = '<div>fragment with no body tag</div>';

        const { html: result } = rewriteAsyncStylesheets({ html });

        expect(result.endsWith('</script>')).toBe(true);
    });
});

describe('rewriteAsyncStylesheets — mutation guard: an inverted allowlist check would fail these', () => {
    it('a page-level index.*.css stylesheet must NOT end up deferred', () => {
        const html = wrapInDocument(stylesheetLink('index'));

        const { deferredHrefs } = rewriteAsyncStylesheets({ html });

        expect(deferredHrefs).not.toContain('/_astro/index.HASH1234.css');
    });

    it('a component stylesheet (AccommodationCard) must NOT stay blocking', () => {
        const html = wrapInDocument(stylesheetLink('AccommodationCard'));

        const { deferredHrefs } = rewriteAsyncStylesheets({ html });

        expect(deferredHrefs).toContain('/_astro/AccommodationCard.HASH1234.css');
    });
});
