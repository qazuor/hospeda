/**
 * @file i18n-client-data-coverage.test.ts
 * @description Guard for the client translation dictionary (HOS-160 lever A,
 * reworked by HOS-369 Wave D). Two properties, both invisible at runtime here:
 *
 *  1. Every standalone HTML shell renders `<I18nClientData>`, and renders it
 *     inside `<head>`. Client islands read their translations from the global
 *     that component's script assigns; a shell that forgets it renders raw keys
 *     in production, and a shell that emits it from `<body>` can place it AFTER
 *     an island's hydration module — a `<script defer>` only precedes deferred
 *     module scripts if it comes first in document order — so that island
 *     hydrates against an empty dictionary.
 *  2. `I18nClientData.astro` links the dictionary instead of inlining it. The
 *     inline form was ~632 KB of byte-identical HTML on every page.
 *
 * The global test seed in `test/setup.ts` masks both failures at runtime, so
 * these source-level assertions are the only thing that can catch them.
 *
 * Assertions are made against the parsed frontmatter/template, with comments
 * stripped. The component's own JSDoc DESCRIBES the inline design it replaced
 * (`<script type="application/json">`, `getInlineLocaleMessages`), so a guard
 * that scanned raw text would fail on prose explaining an absent call — the
 * exact false positive a W2-7 guard already produced.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../static-guards/cacheable-responses-declare-tags';

const SHELL_LAYOUTS = [
    'BaseLayout.astro',
    'AuthLayout.astro',
    'ErrorLayout.astro',
    'StandaloneLayout.astro'
] as const;

const COMPONENT_PATH = resolve(__dirname, '../../src/components/shared/I18nClientData.astro');

/**
 * Splits an `.astro` file at its real frontmatter fence: the opening `---` on
 * line 1 and the first later line that is exactly `---`.
 *
 * Deliberately NOT `source.split('---')[1]`: comment banners like
 * `// --- Parallel fetches ---` contain the fence, so the naive split truncates
 * at the first one and the guard then passes on the strength of text it never
 * looked at.
 */
function splitAstro(source: string): { readonly frontmatter: string; readonly template: string } {
    const lines = source.split('\n');
    if (lines[0]?.trim() !== '---') return { frontmatter: '', template: source };

    for (let i = 1; i < lines.length; i++) {
        if (lines[i]?.trimEnd() === '---') {
            return {
                frontmatter: lines.slice(1, i).join('\n'),
                template: lines.slice(i + 1).join('\n')
            };
        }
    }
    return { frontmatter: '', template: source };
}

const readLayout = (layout: string): string =>
    readFileSync(resolve(__dirname, `../../src/layouts/${layout}`), 'utf8');

describe('I18nClientData coverage across HTML shells', () => {
    for (const layout of SHELL_LAYOUTS) {
        it(`${layout} imports and renders <I18nClientData>`, () => {
            const src = readLayout(layout);

            expect(src).toContain(
                "import I18nClientData from '@/components/shared/I18nClientData.astro'"
            );
            expect(src).toContain('<I18nClientData locale={locale} />');
        });

        it(`${layout} renders it inside <head>, not <body>`, () => {
            const { template } = splitAstro(readLayout(layout));
            const headStart = template.indexOf('<head>');
            const headEnd = template.indexOf('</head>');
            const tagAt = template.indexOf('<I18nClientData');

            // Non-vacuity: a template that failed to parse, or a shell whose
            // head we could not locate, must not satisfy the range check by
            // accident (-1 < -1 is false, but -1 < 0 is not).
            expect(headStart, `${layout}: no <head> found`).toBeGreaterThanOrEqual(0);
            expect(headEnd, `${layout}: no </head> found`).toBeGreaterThan(headStart);
            expect(tagAt, `${layout}: <I18nClientData> not found in the template`).toBeGreaterThan(
                -1
            );

            expect(
                tagAt > headStart && tagAt < headEnd,
                `${layout}: <I18nClientData> must render inside <head>. From <body> a \`<script defer>\` can land after an island's hydration module, and that island hydrates with an empty dictionary.`
            ).toBe(true);
        });
    }
});

describe('I18nClientData.astro links the dictionary instead of inlining it', () => {
    const source = readFileSync(COMPONENT_PATH, 'utf8');
    const { frontmatter, template } = splitAstro(source);

    it('emits a deferred classic script pointing at the hashed asset', () => {
        // The TAG, not a mention of it. `defer` + `src` + no `type="module"` is
        // the contract: a classic script that assigns a global before any
        // island hydrates, which is what keeps the reader synchronous.
        expect(template).toContain('<script defer src={i18nAssetUrl(locale)} is:inline></script>');
    });

    it('resolves that URL through the shared builder', () => {
        expect(stripComments({ source: frontmatter })).toContain(
            "import { i18nAssetUrl } from '@/lib/i18n-asset'"
        );
    });

    it('never serializes the dictionary into the page', () => {
        const code = stripComments({ source });

        // Each of these is one way the ~632 KB payload could come back: reading
        // the catalog, writing raw HTML into the tag, or re-emitting the JSON
        // data block. Comments are stripped first because the file's own JSDoc
        // names all three while describing the design it replaced.
        expect(code).not.toMatch(/getInlineLocaleMessages\s*\(/);
        expect(code).not.toContain('set:html');
        expect(code).not.toContain('application/json');
    });

    it('the comment stripping is load-bearing, not decoration', () => {
        // If this ever stops holding, the previous test has become a check on
        // text that is not there rather than on code that is not there.
        expect(source).toContain('application/json');
    });
});
