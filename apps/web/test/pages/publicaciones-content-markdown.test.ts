/**
 * @file publicaciones-content-markdown.test.ts
 * @description Functional regression for the `renderContent` helper that all
 * four entity detail pages (post, accommodation, destination, event) call to
 * turn user-authored body text into safe HTML for `set:html`.
 *
 * Astro components cannot be rendered through Vitest, but `renderContent` is a
 * pure function, so we can exercise it directly to prove that markdown reaches
 * the DOM as formatted HTML, that TipTap HTML passes through untouched, and
 * that the sanitize step still strips XSS payloads.
 */

import { describe, expect, it } from 'vitest';
import { renderContent } from '../../src/lib/render-content';

const SITE_ORIGIN = 'https://hospeda.com.ar';

const render = (raw: string) => renderContent({ raw, siteOrigin: SITE_ORIGIN });

describe('renderContent — body field rendering pipeline', () => {
    describe('markdown input (current authoring format)', () => {
        it('converts **bold** into <strong>', () => {
            const out = render('Hola **mundo**');
            expect(out).toContain('<strong>mundo</strong>');
            expect(out).not.toContain('**mundo**');
        });

        it('converts *italic* / _italic_ into <em>', () => {
            const out = render('Esto es *importante* y _también_');
            expect(out).toContain('<em>importante</em>');
            expect(out).toContain('<em>también</em>');
        });

        it('converts ATX headings into <h2>/<h3>', () => {
            const out = render('## Federación\n\n### Sub');
            expect(out).toMatch(/<h2[^>]*>Federación<\/h2>/);
            expect(out).toMatch(/<h3[^>]*>Sub<\/h3>/);
        });

        it('groups blank-line-separated lines into paragraphs', () => {
            const out = render('Párrafo uno.\n\nPárrafo dos.');
            const paragraphs = out.match(/<p>/g);
            expect(paragraphs).not.toBeNull();
            expect(paragraphs!.length).toBeGreaterThanOrEqual(2);
        });

        it('renders bullet lists as <ul><li>', () => {
            const out = render('- Federación\n- Colón\n- Gualeguaychú');
            expect(out).toContain('<ul>');
            expect(out).toContain('<li>Federación</li>');
            expect(out).toContain('<li>Colón</li>');
        });

        it('renders the real seed snippet without leaking raw asterisks', () => {
            // Lifted from packages/seed/src/data/post/001-tourism-... (truncated).
            const seedExcerpt =
                'Entre Ríos es una provincia que sorprende.\n\n**1. Federación: El paraíso termal**\nConocida como la "Perla del Uruguay".';
            const out = render(seedExcerpt);
            expect(out).toContain('<strong>1. Federación: El paraíso termal</strong>');
            expect(out).not.toMatch(/\*\*/);
        });
    });

    describe('HTML input (future TipTap admin output)', () => {
        it('passes <p>/<strong>/<em> blocks through untouched', () => {
            const tiptapHtml = '<p>Hola <strong>mundo</strong> con <em>énfasis</em>.</p>';
            const out = render(tiptapHtml);
            expect(out).toContain('<strong>mundo</strong>');
            expect(out).toContain('<em>énfasis</em>');
        });

        it('preserves headings emitted by TipTap', () => {
            const tiptapHtml = '<h2>Sección</h2><p>Cuerpo.</p>';
            const out = render(tiptapHtml);
            expect(out).toMatch(/<h2[^>]*>Sección<\/h2>/);
        });
    });

    describe('plain text input (legacy rows)', () => {
        it('wraps plain text in <p> without altering content', () => {
            const out = render('Solo texto plano sin formato.');
            expect(out).toContain('<p>Solo texto plano sin formato.</p>');
        });
    });

    describe('edge cases', () => {
        it('returns empty string for empty input', () => {
            expect(render('')).toBe('');
        });

        it('returns empty string for non-string input', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(renderContent({ raw: null as any, siteOrigin: SITE_ORIGIN })).toBe('');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(renderContent({ raw: undefined as any, siteOrigin: SITE_ORIGIN })).toBe('');
        });
    });

    describe('security: sanitize step still runs after markdown rendering', () => {
        it('strips <script> tags injected in markdown', () => {
            const malicious = 'Texto OK\n\n<script>alert(1)</script>';
            const out = render(malicious);
            expect(out).not.toContain('<script');
            expect(out).not.toContain('alert(1)');
        });

        it('strips javascript: URLs from links written in markdown', () => {
            const malicious = '[click](javascript:alert(1))';
            const out = render(malicious);
            expect(out).not.toContain('javascript:');
        });

        it('strips inline event handlers from raw HTML input', () => {
            const malicious = '<p onclick="alert(1)">click</p>';
            const out = render(malicious);
            expect(out).not.toContain('onclick');
            expect(out).not.toContain('alert(1)');
        });
    });
});
