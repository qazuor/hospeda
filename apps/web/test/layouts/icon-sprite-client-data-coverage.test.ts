/**
 * @file icon-sprite-client-data-coverage.test.ts
 * @description Guard for the client-side icon-sprite hand-off (HOS-369 W3-6).
 *
 * Two properties, both invisible at runtime here:
 *
 *  1. Every standalone HTML shell renders `<IconSpriteClientData>`, inside
 *     `<head>`. Islands resolve the sprite URL from the global that component's
 *     script assigns; a shell that forgets it lets its islands render icons
 *     INLINE on top of server-rendered `<use>` markup — a hydration mismatch on
 *     every icon in every island on that page.
 *  2. The script is INLINE and CLASSIC, and its source comes through `set:html`.
 *     A module or `defer` script is deferred, and would then race the island
 *     hydration modules; and Astro treats the children of an `is:inline` script
 *     as raw text, so an expression written between the tags is emitted verbatim
 *     and never executes (the exact failure the feedback nav bootstrap hit).
 *
 * Sibling of `i18n-client-data-coverage.test.ts`, same reasoning: nothing at
 * runtime in this suite renders a full shell, so a source-level assertion is the
 * only thing that can catch either.
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

const COMPONENT_PATH = resolve(__dirname, '../../src/components/shared/IconSpriteClientData.astro');

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

describe('IconSpriteClientData coverage across HTML shells', () => {
    for (const layout of SHELL_LAYOUTS) {
        it(`${layout} imports and renders <IconSpriteClientData>`, () => {
            const src = readLayout(layout);

            expect(src).toContain(
                "import IconSpriteClientData from '@/components/shared/IconSpriteClientData.astro'"
            );
            expect(src).toContain('<IconSpriteClientData />');
        });

        it(`${layout} renders it inside <head>, not <body>`, () => {
            const { template } = splitAstro(readLayout(layout));
            const headStart = template.indexOf('<head>');
            const headEnd = template.indexOf('</head>');
            const tagAt = template.indexOf('<IconSpriteClientData');

            // Non-vacuity: a template that failed to parse, or a shell whose
            // head we could not locate, must not satisfy the range check by
            // accident (-1 < -1 is false, but -1 < 0 is not).
            expect(headStart, `${layout}: no <head> found`).toBeGreaterThanOrEqual(0);
            expect(headEnd, `${layout}: no </head> found`).toBeGreaterThan(headStart);
            expect(
                tagAt,
                `${layout}: <IconSpriteClientData> not found in the template`
            ).toBeGreaterThan(-1);

            expect(
                tagAt > headStart && tagAt < headEnd,
                `${layout}: <IconSpriteClientData> must render inside <head>. From <body> it can land after an island has already hydrated, and that island re-inlines every glyph it draws.`
            ).toBe(true);
        });
    }
});

describe('IconSpriteClientData.astro', () => {
    const source = readFileSync(COMPONENT_PATH, 'utf8');
    const { frontmatter, template } = splitAstro(source);

    it('emits an inline classic script carrying the builder output', () => {
        // The TAG, not a mention of it. `is:inline` + `set:html` + no `defer`
        // and no `type="module"` is the contract: a script that runs during
        // parse, unconditionally before every deferred island bundle.
        expect(template).toContain('<script is:inline set:html={script}></script>');
        expect(template).not.toContain('defer');
        expect(template).not.toContain('type="module"');
    });

    it('resolves the URL through the shared builder', () => {
        expect(stripComments({ source: frontmatter })).toContain(
            "import { iconSpriteClientScript } from '@/lib/icon-sprite'"
        );
    });

    it('never inlines the sprite itself into the page', () => {
        // The sprite is ~500 KB. Inlining it would undo the entire change, and
        // then some — it would be byte-identical on every page.
        const code = stripComments({ source });

        expect(code).not.toMatch(/getIconSpriteBody\s*\(/);
        expect(code).not.toContain('<symbol');
    });
});
