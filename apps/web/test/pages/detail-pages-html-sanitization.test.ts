/**
 * @file detail-pages-html-sanitization.test.ts
 * @description Regression tests for the XSS vulnerability where post and event
 * detail pages injected backend-supplied HTML via `set:html` without first
 * passing it through the project's `sanitizeHtml()` helper.
 *
 * Astro components cannot be rendered by Vitest's jsdom environment, so we
 * assert against the page source text. The behavioral guarantees of the
 * sanitizer itself are covered by `test/lib/sanitize-html.test.ts`; here we
 * verify that the two affected pages actually wire it up.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src/pages/[lang]');

function readPage(relativePath: string): string {
    return readFileSync(resolve(SRC_DIR, relativePath), 'utf8');
}

describe('detail pages — HTML sanitization (XSS regression)', () => {
    describe('publicaciones/[slug].astro', () => {
        const src = readPage('publicaciones/[slug].astro');

        it('imports sanitizeHtml from the project sanitizer module', () => {
            expect(src).toMatch(
                /import\s*\{\s*sanitizeHtml\s*\}\s*from\s*['"]@\/lib\/sanitize-html['"]/
            );
        });

        it('builds a sanitized content variable from post.contentHtml', () => {
            expect(src).toContain('sanitizeHtml(');
            expect(src).toMatch(/sanitizeHtml\s*\(\s*\{\s*[\s\S]*post\.contentHtml/);
        });

        it('passes the sanitized variable to PostContent component (not raw set:html)', () => {
            // After B3.2 refactor: safeContentHtml is now passed to PostContent component.
            // The set:html is inside PostContent.astro — verified separately below.
            expect(src).toContain('safeContentHtml');
            expect(src).not.toContain(
                'set:html={String(post.contentHtml || post.content || summary)}'
            );
        });
    });

    describe('PostContent.astro', () => {
        const postContentSrc = readFileSync(
            resolve(__dirname, '../../src/components/post/PostContent.astro'),
            'utf8'
        );

        it('renders the sanitized HTML via set:html={safeContentHtml}', () => {
            expect(postContentSrc).toContain('set:html={safeContentHtml}');
        });
    });

    describe('eventos/[slug].astro', () => {
        const src = readPage('eventos/[slug].astro');

        it('imports sanitizeHtml from the project sanitizer module', () => {
            expect(src).toMatch(
                /import\s*\{\s*sanitizeHtml\s*\}\s*from\s*['"]@\/lib\/sanitize-html['"]/
            );
        });

        it('builds a sanitized description variable from event.contentHtml', () => {
            expect(src).toContain('sanitizeHtml(');
            // The page destructures event props (contentHtml, description, summary)
            // before passing them to sanitizeHtml; accept either the destructured
            // or the direct-access form.
            const hasSanitizeCall = /sanitizeHtml\s*\(\s*\{/.test(src);
            const referencesContentHtml =
                /sanitizeHtml\s*\(\s*\{[\s\S]*(?:contentHtml|event\.contentHtml)/.test(src);
            expect(hasSanitizeCall).toBe(true);
            expect(referencesContentHtml).toBe(true);
        });

        it('passes the sanitized variable to set:html (not the raw event.contentHtml)', () => {
            expect(src).toContain('set:html={safeDescriptionHtml}');
            expect(src).not.toContain('set:html={String(event.contentHtml || description)}');
        });
    });
});
