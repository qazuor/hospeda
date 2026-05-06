/**
 * @file sanitize-html.test.ts
 * @description Unit tests for HTML sanitization.
 */

import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../../src/lib/sanitize-html';

describe('sanitizeHtml', () => {
    describe('safe tags', () => {
        it('should preserve paragraph tags', () => {
            expect(sanitizeHtml({ html: '<p>Hello</p>' })).toContain('<p>Hello</p>');
        });

        it('should preserve strong and em tags', () => {
            expect(sanitizeHtml({ html: '<strong>Bold</strong> <em>italic</em>' })).toContain(
                '<strong>Bold</strong>'
            );
        });

        it('should preserve heading tags', () => {
            expect(sanitizeHtml({ html: '<h2>Title</h2>' })).toContain('<h2>Title</h2>');
        });

        it('should preserve list tags', () => {
            const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
            const result = sanitizeHtml({ html });
            expect(result).toContain('<ul>');
            expect(result).toContain('<li>Item 1</li>');
        });

        it('should preserve links with href', () => {
            const result = sanitizeHtml({ html: '<a href="https://example.com">Link</a>' });
            expect(result).toContain('href="https://example.com"');
        });
    });

    describe('dangerous content removal', () => {
        it('should strip script tags', () => {
            const result = sanitizeHtml({ html: '<p>Hello</p><script>alert(1)</script>' });
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('alert');
            expect(result).toContain('<p>Hello</p>');
        });

        it('should strip iframe tags', () => {
            const result = sanitizeHtml({ html: '<iframe src="evil.com"></iframe>' });
            expect(result).not.toContain('<iframe');
        });

        it('should strip event handler attributes', () => {
            const result = sanitizeHtml({ html: '<div onmouseover="alert(1)">test</div>' });
            expect(result).not.toContain('onmouseover');
        });

        it('should strip javascript: URLs', () => {
            const result = sanitizeHtml({ html: '<a href="javascript:alert(1)">click</a>' });
            expect(result).not.toContain('javascript:');
        });
    });

    describe('link security', () => {
        it('should add rel="noopener noreferrer" to links', () => {
            const result = sanitizeHtml({ html: '<a href="https://example.com">Link</a>' });
            expect(result).toContain('rel="noopener noreferrer"');
        });

        it('should add target="_blank" to links', () => {
            const result = sanitizeHtml({ html: '<a href="https://example.com">Link</a>' });
            expect(result).toContain('target="_blank"');
        });
    });

    /** Gap 1 — Allow <figure> + <figcaption> for captioned media. */
    describe('figure / figcaption support', () => {
        it('preserves a figure with an image and a caption', () => {
            const html =
                '<figure><img src="https://cdn.example.com/x.jpg" alt="foo"><figcaption>caption</figcaption></figure>';
            const result = sanitizeHtml({ html });
            expect(result).toContain('<figure>');
            expect(result).toContain('<figcaption>caption</figcaption>');
            expect(result).toContain('src="https://cdn.example.com/x.jpg"');
            expect(result).toContain('alt="foo"');
        });

        it('preserves figure class for styling', () => {
            const html = '<figure class="post-figure"><figcaption>x</figcaption></figure>';
            const result = sanitizeHtml({ html });
            expect(result).toContain('class="post-figure"');
        });
    });

    /** Gap 2 — YouTube iframe whitelist (and only YouTube). */
    describe('iframe whitelist (YouTube only)', () => {
        it('preserves a youtube.com/embed iframe', () => {
            const html = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';
            const result = sanitizeHtml({ html });
            expect(result).toContain('<iframe');
            expect(result).toContain('src="https://www.youtube.com/embed/dQw4w9WgXcQ"');
        });

        it('preserves a youtube-nocookie.com/embed iframe', () => {
            const html = '<iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe>';
            const result = sanitizeHtml({ html });
            expect(result).toContain('src="https://www.youtube-nocookie.com/embed/abc123"');
        });

        it('preserves a youtube embed with benign query params', () => {
            const html =
                '<iframe src="https://www.youtube.com/embed/abc?start=10&amp;autoplay=0"></iframe>';
            const result = sanitizeHtml({ html });
            expect(result).toContain('<iframe');
            expect(result).toContain('start=10');
        });

        it('preserves common iframe attributes on a youtube embed', () => {
            const html =
                '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315" allowfullscreen title="player" loading="lazy"></iframe>';
            const result = sanitizeHtml({ html });
            expect(result).toContain('width="560"');
            expect(result).toContain('height="315"');
            expect(result).toContain('allowfullscreen');
            expect(result).toContain('title="player"');
            expect(result).toContain('loading="lazy"');
        });

        it('removes iframes pointing at non-youtube origins', () => {
            const html = '<iframe src="https://evil.com/embed/x"></iframe>';
            const result = sanitizeHtml({ html });
            expect(result).not.toContain('<iframe');
            expect(result).not.toContain('evil.com');
        });

        it('removes iframes with javascript: src', () => {
            const html = '<iframe src="javascript:alert(1)"></iframe>';
            const result = sanitizeHtml({ html });
            expect(result).not.toContain('<iframe');
            expect(result).not.toContain('javascript:');
            expect(result).not.toContain('alert');
        });

        it('removes iframes pointing at the youtube root (not /embed/)', () => {
            const html = '<iframe src="https://www.youtube.com/watch?v=abc"></iframe>';
            const result = sanitizeHtml({ html });
            expect(result).not.toContain('<iframe');
        });
    });

    /** Gap 3 — data-* attributes on every retained tag. */
    describe('data-* attributes', () => {
        it('preserves well-formed data-* attributes', () => {
            const html = '<p data-type="paragraph" data-id="abc">x</p>';
            const result = sanitizeHtml({ html });
            expect(result).toContain('data-type="paragraph"');
            expect(result).toContain('data-id="abc"');
        });

        it('treats data-onclick as a normal data-* attribute (inert in HTML)', () => {
            // A `data-` prefixed name is just an attribute, not a handler, so
            // it should be retained. The actual onclick attribute must NOT.
            const html = '<p data-onclick="not-a-handler">x</p>';
            const result = sanitizeHtml({ html });
            expect(result).toContain('data-onclick="not-a-handler"');
        });

        it('still strips the real onclick attribute', () => {
            const html = '<p onclick="alert(1)" data-id="ok">x</p>';
            const result = sanitizeHtml({ html });
            expect(result).not.toContain('onclick=');
            expect(result).toContain('data-id="ok"');
        });

        it('preserves data-* on a heading', () => {
            const html = '<h2 data-toc-id="my-section">Title</h2>';
            const result = sanitizeHtml({ html });
            expect(result).toContain('data-toc-id="my-section"');
        });
    });

    /** Gap 4 — target="_blank" only for external links when siteOrigin is provided. */
    describe('link target policy with siteOrigin', () => {
        const siteOrigin = 'https://hospeda.com.ar';

        it('does not add target/rel on relative links', () => {
            const result = sanitizeHtml({ html: '<a href="/foo">x</a>', siteOrigin });
            expect(result).not.toContain('target=');
            expect(result).not.toContain('rel=');
        });

        it('does not add target/rel on anchor-only links', () => {
            const result = sanitizeHtml({ html: '<a href="#section">x</a>', siteOrigin });
            expect(result).not.toContain('target=');
            expect(result).not.toContain('rel=');
        });

        it('does not add target/rel on mailto: links', () => {
            const result = sanitizeHtml({
                html: '<a href="mailto:foo@bar.com">x</a>',
                siteOrigin
            });
            expect(result).toContain('href="mailto:foo@bar.com"');
            expect(result).not.toContain('target=');
            expect(result).not.toContain('rel=');
        });

        it('does not add target/rel on tel: links', () => {
            const result = sanitizeHtml({ html: '<a href="tel:+123">x</a>', siteOrigin });
            expect(result).toContain('href="tel:+123"');
            expect(result).not.toContain('target=');
        });

        it('does not add target/rel on absolute same-origin links', () => {
            const result = sanitizeHtml({
                html: '<a href="https://hospeda.com.ar/foo">x</a>',
                siteOrigin
            });
            expect(result).toContain('href="https://hospeda.com.ar/foo"');
            expect(result).not.toContain('target=');
            expect(result).not.toContain('rel=');
        });

        it('adds target="_blank" + rel on absolute external links', () => {
            const result = sanitizeHtml({
                html: '<a href="https://google.com">x</a>',
                siteOrigin
            });
            expect(result).toContain('target="_blank"');
            expect(result).toContain('rel="noopener noreferrer"');
        });

        it('strips javascript: hrefs entirely', () => {
            const result = sanitizeHtml({
                html: '<a href="javascript:alert(1)">x</a>',
                siteOrigin
            });
            expect(result).not.toContain('javascript:');
            expect(result).not.toContain('alert');
        });

        it('treats all absolute http(s) links as external when siteOrigin is omitted', () => {
            const result = sanitizeHtml({ html: '<a href="https://example.com">x</a>' });
            expect(result).toContain('target="_blank"');
            expect(result).toContain('rel="noopener noreferrer"');
        });
    });

    /** Gap 5 — id attribute restricted to safe slug format. */
    describe('id attribute safety', () => {
        it('preserves a safe slug id on a heading', () => {
            const result = sanitizeHtml({ html: '<h2 id="my-section">Title</h2>' });
            expect(result).toContain('id="my-section"');
        });

        it('preserves a snake_case id', () => {
            const result = sanitizeHtml({ html: '<h2 id="my_section">Title</h2>' });
            expect(result).toContain('id="my_section"');
        });

        it('strips ids containing colon characters', () => {
            const result = sanitizeHtml({ html: '<h2 id="javascript:alert(1)">Title</h2>' });
            expect(result).toContain('<h2');
            expect(result).not.toContain('javascript:');
            expect(result).not.toContain('id="javascript');
        });

        it('strips ids that start with a digit or special char', () => {
            const r1 = sanitizeHtml({ html: '<h2 id="1bad">Title</h2>' });
            expect(r1).not.toContain('id="1bad"');
            const r2 = sanitizeHtml({ html: '<h2 id="-bad">Title</h2>' });
            expect(r2).not.toContain('id="-bad"');
        });

        it('strips ids containing whitespace', () => {
            const result = sanitizeHtml({ html: '<h2 id="bad id">Title</h2>' });
            expect(result).not.toContain('id="bad id"');
            expect(result).not.toContain('id="bad');
        });
    });

    describe('edge cases', () => {
        it('should return empty string for empty input', () => {
            expect(sanitizeHtml({ html: '' })).toBe('');
        });

        it('should handle plain text (no tags)', () => {
            expect(sanitizeHtml({ html: 'Plain text' })).toBe('Plain text');
        });

        it('should preserve allowed attributes (class, id, aria-*)', () => {
            const result = sanitizeHtml({
                html: '<div class="test" id="main" aria-label="section">Content</div>'
            });
            expect(result).toContain('class="test"');
            expect(result).toContain('id="main"');
            expect(result).toContain('aria-label="section"');
        });
    });

    /**
     * Regression tests for the XSS vulnerability that existed in
     * `apps/web/src/pages/[lang]/publicaciones/[slug].astro` and
     * `apps/web/src/pages/[lang]/eventos/[slug].astro`, where backend-supplied
     * HTML was injected via `set:html` without sanitization. These tests pin
     * the contract those pages now rely on: dangerous payloads are neutralized
     * while legitimate TipTap-rendered HTML is preserved.
     */
    describe('regression: post and event detail set:html payloads', () => {
        it('should neutralize <script>alert(1)</script> payloads', () => {
            const payload = '<p>intro</p><script>alert(1)</script><p>outro</p>';
            const result = sanitizeHtml({ html: payload });
            expect(result).not.toContain('<script');
            expect(result).not.toContain('alert(1)');
            expect(result).toContain('<p>intro</p>');
            expect(result).toContain('<p>outro</p>');
        });

        it('should neutralize <img src=x onerror=alert(1)> payloads', () => {
            const payload = '<img src="x" onerror="alert(1)" alt="x">';
            const result = sanitizeHtml({ html: payload });
            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert(1)');
        });

        it('should preserve a realistic TipTap-rendered article body', () => {
            const html = [
                '<h2>Section title</h2>',
                '<p>This is a <strong>bold</strong> paragraph with an',
                ' <a href="https://example.com">external link</a>.</p>',
                '<ul><li>First item</li><li>Second item</li></ul>',
                '<img src="https://cdn.example.com/photo.jpg" alt="Photo">'
            ].join('');
            const result = sanitizeHtml({ html });

            expect(result).toContain('<h2>Section title</h2>');
            expect(result).toContain('<strong>bold</strong>');
            expect(result).toContain('<p>');
            expect(result).toContain('href="https://example.com"');
            expect(result).toContain('<ul>');
            expect(result).toContain('<li>First item</li>');
            expect(result).toContain('<li>Second item</li>');
            expect(result).toContain('src="https://cdn.example.com/photo.jpg"');
            expect(result).toContain('alt="Photo"');
            expect(result).not.toContain('onerror');
        });
    });
});
