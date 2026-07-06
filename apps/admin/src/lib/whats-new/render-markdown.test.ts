import { describe, expect, it } from 'vitest';

import { renderMarkdownToHtml } from './render-markdown';

/**
 * The What's New renderer constructs a real headless TipTap `Editor` with
 * `[StarterKit, Markdown]` — the same bare-construction pattern that would
 * surface a Tiptap #1890-style cross-major mismatch. If extensions ever diverge
 * from core, construction throws and the function degrades to escaped plain
 * text, so any assertion below that expects real HTML tags doubles as a v3
 * compatibility canary.
 */
describe('renderMarkdownToHtml (admin)', () => {
    it('renders basic markdown formatting', () => {
        const html = renderMarkdownToHtml('**Hola**\n\n- uno\n- dos');

        expect(html).toContain('<strong>');
        expect(html).toContain('Hola');
        expect(html).toContain('uno');
        expect(html).toContain('dos');
    });

    it('sanitizes script tags', () => {
        const html = renderMarkdownToHtml('<script>alert(1)</script>');

        expect(html).not.toContain('<script');
    });

    it('does not create links for javascript: URLs', () => {
        const html = renderMarkdownToHtml('[x](javascript:alert(1))');

        // TipTap's markdown extension does not parse javascript: URLs as links —
        // it renders the literal text. No <a> tag is created, so no attack surface.
        expect(html).not.toMatch(/<a\s/i);
    });

    it('renders http(s) markdown links as anchors under Tiptap v3', () => {
        // v3 behavior lock: StarterKit v3 bundles the Link mark, so a normal
        // markdown link now serializes as an <a> (under v2, StarterKit had no
        // Link mark here and the link was dropped to plain text). The DOMPurify
        // allowlist already permits `a` + `href`, so the anchor survives.
        const html = renderMarkdownToHtml('[Hospeda](https://hospeda.com.ar)');

        expect(html).toMatch(/<a\s/i);
        expect(html).toContain('href="https://hospeda.com.ar"');
        expect(html).toContain('Hospeda');
    });

    it('renders headings and blockquotes', () => {
        const html = renderMarkdownToHtml('## Novedades\n\n> Una cita');

        expect(html).toContain('<h2>');
        expect(html).toContain('Novedades');
        expect(html).toContain('<blockquote>');
    });
});
