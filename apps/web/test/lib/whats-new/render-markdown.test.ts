import { describe, expect, it } from 'vitest';

import { renderMarkdownToHtml } from '../../../src/lib/whats-new/render-markdown';

describe('renderMarkdownToHtml', () => {
    it('renders basic markdown formatting', () => {
        const html = renderMarkdownToHtml('**Hola**\n\n- uno\n- dos');

        expect(html).toContain('<strong>Hola</strong>');
        expect(html).toContain('<ul>');
        expect(html).toContain('<li>uno</li>');
    });

    it('sanitizes dangerous content', () => {
        const html = renderMarkdownToHtml('<script>alert(1)</script> [x](javascript:alert(1))');

        expect(html).not.toContain('<script');
        expect(html).not.toContain('javascript:alert');
        expect(html).toContain('href="#"');
    });
});
