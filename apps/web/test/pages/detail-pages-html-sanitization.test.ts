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
import { describe, expect, it } from 'vitest';
import { renderContent } from '@/lib/render-content';

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

        /**
         * HOS-817 SUPERSEDES SPEC-187 FR-2 FOR THIS PAGE.
         *
         * FR-2 made `accommodation.description` a PLAIN-TEXT sink (`renderPlain`,
         * escape-only) back when the admin config had reverted the field from
         * RICH_TEXT to TEXTAREA. That premise no longer holds: the host editor
         * binds its `<RichTextEditor>` to `data.description` for owners holding
         * `CAN_USE_RICH_DESCRIPTION`, so the field legitimately carries markdown
         * and the escape-only sink published literal `**asterisks**` on a paid
         * feature.
         *
         * The XSS guarantee FR-2 was protecting is NOT relaxed — it moves from
         * "escape everything" to "sanitize everything" via the same
         * `renderContent` pipeline (`marked` -> `sanitizeHtml`) the other detail
         * pages already use. The payload-level proof lives in
         * `test/pages/accommodation-description-markdown.test.ts`, which executes
         * that pipeline against `<script>`, `onerror=`, `javascript:` and friends.
         *
         * The entitlement is enforced upstream at WRITE time by
         * `gateRichDescription` (apps/api/src/middlewares/accommodation-entitlements.ts),
         * so the page needs no entitlement check — and must keep having none.
         */
        it('routes accommodation.description through the sanitizing markdown pipeline (HOS-817)', () => {
            expect(src).toMatch(
                /import\s*\{\s*renderContent\s+as\s+renderRich\s*\}\s*from\s*['"]@\/lib\/render-content['"]/
            );
            expect(src).toMatch(
                /const\s+safeDescriptionHtml\s*=\s*accommodation\.description[\s\S]{0,120}?renderRich\(\{/
            );
        });

        it('passes the sanitized HTML to Description as descriptionHtml (HOS-817)', () => {
            expect(src).toMatch(/descriptionHtml=\{safeDescriptionHtml\}/);
        });

        it('never pipes the raw description field straight into set:html', () => {
            // The one shape that would actually be a stored-XSS hole: the raw API
            // field reaching the DOM without passing the sanitizer first.
            expect(src).not.toMatch(/set:html=\{\s*accommodation\.description/);
            expect(src).not.toMatch(/set:html=\{\s*accommodation\.richDescription/);
            expect(src).not.toMatch(/marked\.parse\(/);
        });
    });

    describe('Description.astro (accommodation) — HOS-817 sanitized-HTML sink', () => {
        const descSrc = readFileSync(
            resolve(__dirname, '../../src/components/accommodation/Description.astro'),
            'utf8'
        );

        it('accepts a descriptionHtml prop and no longer a plain-text one', () => {
            expect(descSrc).toMatch(/descriptionHtml:\s*string/);
            expect(descSrc).not.toMatch(/readonly\s+descriptionText\s*:/);
        });

        it('renders the body via set:html bound to the sanitized prop only', () => {
            expect(descSrc).toMatch(/set:html=\{descriptionHtml\}/);
            // Nothing else may reach set:html in this component. Counts real
            // BINDINGS (`set:html={`) rather than the token, which also appears
            // in this component's security JSDoc.
            expect(descSrc.match(/set:html=\{/g) ?? []).toHaveLength(1);
        });

        it('keeps summary an auto-escaped text child (no write-time gate strips it)', () => {
            expect(descSrc).toMatch(/<p>\{summary\}<\/p>/);
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
