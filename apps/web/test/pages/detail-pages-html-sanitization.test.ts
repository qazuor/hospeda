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
 *
 * Phase 3 (SPEC-187 FR-8): Additional XSS test suite covering 6 malicious
 * payloads that must be stripped/neutralized and 9 allowed-subset survival
 * cases that must render correctly through the `renderContent` pipeline.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderContent } from '@/lib/render-content';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src/pages/[lang]');

function readPage(relativePath: string): string {
    return readFileSync(resolve(SRC_DIR, relativePath), 'utf8');
}

describe('detail pages — HTML sanitization (XSS regression)', () => {
    /**
     * After the markdown-rendering refactor (PR #1174 + follow-up), every detail
     * page that emits user-authored body text routes it through the shared
     * `renderContent` helper at `@/lib/render-content`. The helper composes
     * `marked.parse(...)` + `sanitizeHtml(...)` — exercised functionally in
     * `publicaciones-content-markdown.test.ts`. These assertions guarantee that
     * each page actually wires up the helper instead of piping raw API data into
     * `set:html`.
     */

    describe('publicaciones/[slug].astro', () => {
        const src = readPage('publicaciones/[slug].astro');

        it('imports renderContent from the shared lib', () => {
            expect(src).toMatch(
                /import\s*\{\s*renderContent\s*\}\s*from\s*['"]@\/lib\/render-content['"]/
            );
        });

        it('sources content from post.contentHtml || post.content || summary', () => {
            expect(src).toMatch(/post\.contentHtml\s*\|\|\s*post\.content\s*\|\|\s*summary/);
        });

        it('builds safeContentHtml via renderContent and passes it to PostContent', () => {
            expect(src).toMatch(/safeContentHtml\s*=\s*renderContent\(/);
            expect(src).toContain('safeContentHtml={safeContentHtml}');
        });

        it('does not bypass the helper with a raw set:html on the API field', () => {
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

    describe('alojamientos/[slug].astro', () => {
        const src = readPage('alojamientos/[slug].astro');

        it('imports renderPlain from the new helper module (FR-2)', () => {
            expect(src).toMatch(
                /import\s*\{\s*renderPlain\s*\}\s*from\s*['"]@\/lib\/render-plain['"]/
            );
        });

        it('builds safeDescriptionText via renderPlain for the description field (FR-2)', () => {
            // The plain-text path replaces the previous renderContent call.
            // Variable name may differ but the helper call must use the description
            // field as input.
            expect(src).toMatch(/renderPlain\(\{[^}]*raw:\s*accommodation\.description/);
        });

        it('passes the escaped text to Description as descriptionText', () => {
            expect(src).toMatch(/descriptionText=\{safeDescriptionText\}/);
        });

        it('does NOT route accommodation.description through renderContent or marked (FR-2)', () => {
            // Negative test — the entire point of the FR-2 flip. The page must
            // never pipe the raw description into the markdown pipeline; it goes
            // through renderPlain (text sink) instead.
            expect(src).not.toMatch(/renderContent\(\{[^}]*raw:\s*accommodation\.description/);
            expect(src).not.toMatch(/marked\.parse\([^)]*accommodation\.description/);
        });
    });

    describe('Description.astro (accommodation) — FR-2 plain-text sink', () => {
        const descSrc = readFileSync(
            resolve(__dirname, '../../src/components/accommodation/Description.astro'),
            'utf8'
        );

        it('accepts a descriptionText prop (escaped text, not sanitized HTML)', () => {
            expect(descSrc).toMatch(/descriptionText:\s*string/);
            // PD-6 invariant: the description is plain text, never raw, never HTML.
            expect(descSrc).not.toMatch(/descriptionHtml:\s*string/);
            expect(descSrc).not.toMatch(/description:\s*string/);
        });

        it('renders the escaped text via text interpolation, not set:html (PD-6)', () => {
            // The output of renderPlain is plain text. It MUST be interpolated as
            // a text child, never piped into set:html. set:html would re-parse
            // the escaped entities as HTML and a future migration to a markdown
            // sink would silently re-introduce XSS.
            expect(descSrc).not.toMatch(/set:html=\{descriptionText\}/);
            expect(descSrc).not.toMatch(/set:html=\{descriptionHtml\}/);
            // The text is interpolated directly — assert the interpolation is present.
            expect(descSrc).toMatch(/\{descriptionText\}/);
        });
    });

    describe('destinos/[...path].astro', () => {
        const src = readPage('destinos/[...path].astro');

        it('imports renderContent', () => {
            expect(src).toMatch(
                /import\s*\{\s*renderContent\s*\}\s*from\s*['"]@\/lib\/render-content['"]/
            );
        });

        it('builds safeDescriptionHtml via renderContent (covers both contentHtml and description)', () => {
            expect(src).toMatch(/safeDescriptionHtml\s*=\s*renderContent\(/);
            // Either contentHtml or description must reach the helper as input.
            expect(src).toMatch(/dest\.contentHtml/);
        });

        it('does not bypass sanitization for the rich-HTML branch any more', () => {
            // Before the refactor the page had `<div set:html={richDescription} />`
            // with `richDescription = dest.contentHtml`. Bug fix asserted here.
            expect(src).not.toMatch(/set:html=\{richDescription\}/);
            expect(src).toContain('set:html={safeDescriptionHtml}');
        });
    });

    describe('eventos/[slug].astro', () => {
        const src = readPage('eventos/[slug].astro');

        it('imports renderContent', () => {
            expect(src).toMatch(
                /import\s*\{\s*renderContent\s*\}\s*from\s*['"]@\/lib\/render-content['"]/
            );
        });

        it('builds safeDescriptionHtml via renderContent from event content fields', () => {
            expect(src).toMatch(/safeDescriptionHtml\s*=\s*renderContent\(/);
            // The destructured event props (contentHtml, description, summary) must
            // be the input to the helper.
            expect(src).toMatch(/renderContent\([\s\S]*?contentHtml\s*\|\|\s*description/);
        });

        it('passes the sanitized variable to set:html', () => {
            expect(src).toContain('set:html={safeDescriptionHtml}');
            expect(src).not.toContain('set:html={String(event.contentHtml || description)}');
        });
    });
});

// ============================================================================
// Phase 3 (SPEC-187 FR-8): XSS sanitization test suite
// 6 malicious cases that must be stripped/neutralized + 9 allowed-subset survival
// ============================================================================

describe('Phase 3 — XSS sanitization via renderContent (FR-8)', () => {
    describe('malicious payloads must be stripped/neutralized', () => {
        const maliciousCases = [
            {
                name: 'script tag',
                input: '<script>alert(1)</script>',
                expectNotContain: '<script>'
            },
            {
                name: 'javascript: protocol in link',
                input: '[evil](javascript:alert(1))',
                expectNotContain: 'javascript:'
            },
            {
                name: 'onerror handler on img',
                input: '<img src=x onerror="alert(1)">',
                expectNotContain: 'onerror'
            },
            {
                name: 'non-YouTube iframe',
                input: '<iframe src="https://evil.com"></iframe>',
                expectNotContain: '<iframe'
            },
            {
                name: 'onclick event handler',
                input: '<a href="#" onclick="steal()">click</a>',
                expectNotContain: 'onclick'
            },
            {
                name: 'data: URI in link',
                input: '[data](data:text/html,<script>alert(1)</script>)',
                expectNotContain: 'data:text/html'
            }
        ] as const;

        for (const tc of maliciousCases) {
            it(`strips ${tc.name}`, () => {
                const result = renderContent({ raw: tc.input, siteOrigin: 'https://example.com' });
                expect(result).not.toContain(tc.expectNotContain);
            });
        }
    });

    describe('allowed subset must survive and render correctly', () => {
        const allowedCases = [
            {
                name: 'bold markdown',
                input: '**bold**',
                expectContain: '<strong>bold</strong>'
            },
            {
                name: 'italic markdown',
                input: '*italic*',
                expectContain: '<em>italic</em>'
            },
            {
                name: 'underline via HTML',
                input: '<u>underline</u>',
                expectContain: '<u>underline</u>'
            },
            {
                name: 'heading',
                input: '## Heading',
                expectContain: '<h2>Heading</h2>'
            },
            {
                name: 'unordered list',
                input: '- item 1\n- item 2',
                expectContain: '<ul>'
            },
            {
                name: 'ordered list',
                input: '1. item 1\n2. item 2',
                expectContain: '<ol>'
            },
            {
                name: 'blockquote',
                input: '> quote',
                expectContain: '<blockquote>'
            },
            {
                name: 'external link gets target=_blank rel=noopener noreferrer',
                input: '[text](https://external.com)',
                expectContain: 'target="_blank" rel="noopener noreferrer"'
            },
            {
                name: 'internal link does NOT get target=_blank',
                input: '[text](/internal-page)',
                expectNotContain: 'target="_blank"'
            }
        ] as const;

        for (const tc of allowedCases) {
            it(`renders ${tc.name} correctly`, () => {
                const result = renderContent({ raw: tc.input, siteOrigin: 'https://example.com' });
                if ('expectContain' in tc) {
                    expect(result).toContain(tc.expectContain);
                }
                if ('expectNotContain' in tc) {
                    expect(result).not.toContain(tc.expectNotContain);
                }
            });
        }
    });
});
