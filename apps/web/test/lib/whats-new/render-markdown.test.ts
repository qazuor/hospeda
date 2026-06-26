import { describe, expect, it } from 'vitest';

import { renderMarkdownToHtml } from '../../../src/lib/whats-new/render-markdown';

describe('renderMarkdownToHtml', () => {
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
});
