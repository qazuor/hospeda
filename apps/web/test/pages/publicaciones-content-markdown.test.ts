/**
 * @file publicaciones-content-markdown.test.ts
 * @description Functional regression for the markdown → HTML → sanitize pipeline
 * used by the post detail page. The page itself cannot be rendered through
 * Vitest (Astro components), but the pipeline is a pure composition of
 * `marked.parse` and `sanitizeHtml`, so we can exercise it directly to prove
 * markdown is not surfaced as plain text any more.
 */

import { marked } from 'marked';
import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../../src/lib/sanitize-html';

const SITE_ORIGIN = 'https://hospeda.com.ar';

function renderPostContent(markdownOrHtml: string): string {
    const rendered = marked.parse(markdownOrHtml, {
        async: false,
        gfm: true,
        breaks: false
    }) as string;
    return sanitizeHtml({ html: rendered, siteOrigin: SITE_ORIGIN });
}

describe('post content rendering pipeline', () => {
    describe('markdown input (current seed format)', () => {
        it('converts **bold** into <strong>', () => {
            const out = renderPostContent('Hola **mundo**');
            expect(out).toContain('<strong>mundo</strong>');
            expect(out).not.toContain('**mundo**');
        });

        it('converts *italic* / _italic_ into <em>', () => {
            const out = renderPostContent('Esto es *importante* y _también_');
            expect(out).toContain('<em>importante</em>');
            expect(out).toContain('<em>también</em>');
        });

        it('converts ATX headings into <h2>/<h3>', () => {
            const out = renderPostContent('## Federación\n\n### Sub');
            expect(out).toMatch(/<h2[^>]*>Federación<\/h2>/);
            expect(out).toMatch(/<h3[^>]*>Sub<\/h3>/);
        });

        it('groups blank-line-separated lines into paragraphs', () => {
            const out = renderPostContent('Párrafo uno.\n\nPárrafo dos.');
            // marked produces two distinct <p> blocks
            const paragraphs = out.match(/<p>/g);
            expect(paragraphs).not.toBeNull();
            expect(paragraphs!.length).toBeGreaterThanOrEqual(2);
        });

        it('renders bullet lists as <ul><li>', () => {
            const out = renderPostContent('- Federación\n- Colón\n- Gualeguaychú');
            expect(out).toContain('<ul>');
            expect(out).toContain('<li>Federación</li>');
            expect(out).toContain('<li>Colón</li>');
        });

        it('renders the real seed snippet without leaking raw asterisks', () => {
            // Lifted from packages/seed/src/data/post/001-tourism-... (truncated).
            const seedExcerpt =
                'Entre Ríos es una provincia que sorprende.\n\n**1. Federación: El paraíso termal**\nConocida como la "Perla del Uruguay".';
            const out = renderPostContent(seedExcerpt);
            expect(out).toContain('<strong>1. Federación: El paraíso termal</strong>');
            // The literal `**` markers must not survive to the DOM.
            expect(out).not.toMatch(/\*\*/);
        });
    });

    describe('HTML input (future TipTap admin output)', () => {
        it('passes <p>/<strong>/<em> blocks through untouched', () => {
            const tiptapHtml = '<p>Hola <strong>mundo</strong> con <em>énfasis</em>.</p>';
            const out = renderPostContent(tiptapHtml);
            expect(out).toContain('<strong>mundo</strong>');
            expect(out).toContain('<em>énfasis</em>');
        });

        it('preserves headings emitted by TipTap', () => {
            const tiptapHtml = '<h2>Sección</h2><p>Cuerpo.</p>';
            const out = renderPostContent(tiptapHtml);
            expect(out).toMatch(/<h2[^>]*>Sección<\/h2>/);
        });
    });

    describe('security: sanitize step still runs after markdown rendering', () => {
        it('strips <script> tags injected in markdown', () => {
            const malicious = 'Texto OK\n\n<script>alert(1)</script>';
            const out = renderPostContent(malicious);
            expect(out).not.toContain('<script');
            expect(out).not.toContain('alert(1)');
        });

        it('strips javascript: URLs from links written in markdown', () => {
            const malicious = '[click](javascript:alert(1))';
            const out = renderPostContent(malicious);
            expect(out).not.toContain('javascript:');
        });
    });
});
