/**
 * @file CommerceListingEditor.cards.test.ts
 * @description Structural guard (HOS-371) for the per-section cards.
 *
 * Asserted on the SOURCE, not on rendered output, for two reasons: CSS Modules
 * `composes` is resolved at build time (jsdom sees only the local class name,
 * so a rendered-DOM assertion could not tell a composed card from a bare div),
 * and the page is an `.astro` file, which Vitest cannot render — the project's
 * documented convention for both cases (see `apps/web/CLAUDE.md` → Testing).
 *
 * @module test/components/commerce/CommerceListingEditor.cards
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const COMMERCE_DIR = resolve(__dirname, '../../../src/components/commerce');
const EDITOR_DIR = resolve(COMMERCE_DIR, 'editor');

const read = (path: string) => readFileSync(path, 'utf8');

const fieldsCss = read(resolve(EDITOR_DIR, 'editor-fields.module.css'));
const editorCss = read(resolve(COMMERCE_DIR, 'CommerceListingEditor.module.css'));
const translationPanelCss = read(resolve(COMMERCE_DIR, 'CommerceTranslationPanel.module.css'));
const editorPage = read(
    resolve(__dirname, '../../../src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar.astro')
);

/** Every section component the orchestrator composes the form out of (HOS-258). */
const SECTION_FILES = readdirSync(EDITOR_DIR).filter((name) => name.endsWith('Section.client.tsx'));

/** Strips comments so this file's own prose about `<fieldset>` is not scanned. */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Reads the body of the first `.section { ... }` rule in a CSS module. */
function sectionRule(css: string): string {
    return css.match(/\.section\s*\{[^}]*\}/)?.[0] ?? '';
}

describe('CommerceListingEditor — per-section cards (HOS-371)', () => {
    it('composes the canonical AccountSection card recipe rather than redefining one', () => {
        expect(sectionRule(fieldsCss)).toMatch(
            /composes:\s*card from ["']\.\.\/\.\.\/account\/AccountSection\.module\.css["']/
        );
    });

    it('does not reset padding/border on .section, which would silently cancel the card', () => {
        // `composes` only adds a class name; conflicts resolve by source order,
        // and this file is emitted after the composed one. A `padding: 0` or
        // `border: none` here would win and the "card" would render exactly like
        // the pre-HOS-371 stacked divs — visually a no-op, with green tests.
        const rule = sectionRule(fieldsCss);
        expect(rule).not.toMatch(/padding:\s*0/);
        expect(rule).not.toMatch(/border:\s*none/);
    });

    it('pulls the fieldset legend back into normal flow so it cannot escape the card', () => {
        // A UA paints a <legend> ON the fieldset's top border, outside the
        // padding box — invisible on a borderless fieldset, but against a real
        // card it slices the brand accent bar in half.
        expect(fieldsCss).toMatch(/\.section\s*>\s*legend\s*\{[^}]*float:\s*left/);
        expect(fieldsCss).toMatch(/\.section\s*>\s*legend\s*\+\s*\*\s*\{[^}]*clear:\s*both/);
    });

    it('lets the form fill its column instead of capping it narrower than its own cards', () => {
        // A 720px cap would inset every card from the page header above and from
        // the full-width FAQ card below, on the same page, at two visibly
        // different widths.
        const editorRule = editorCss.match(/\.editor\s*\{[^}]*\}/)?.[0] ?? '';
        expect(editorRule).not.toMatch(/max-width/);
    });

    it('gives every top-level section element of every section component a card', () => {
        // Anything rendered as a top-level <section> without the section class is
        // the one block that would be missing its card. Nested <fieldset>s that
        // are deliberately NOT cards (the amenity catalog groups, the phone pair)
        // are allowed — they are never <section> elements.
        let carded = 0;

        for (const file of SECTION_FILES) {
            const code = stripComments(read(resolve(EDITOR_DIR, file)));

            for (const tag of code.match(/<section\b[^>]*>/g) ?? []) {
                expect(tag, `${file}: <section> without the card class`).toMatch(
                    /(styles|fieldStyles)\.section/
                );
                carded += 1;
            }

            // The component's ROOT element must be a card too — a section whose
            // root is a <fieldset> (contact, social networks) is still a card.
            const firstTag = code.match(/<(section|fieldset)\b[^>]*>/)?.[0] ?? '';
            expect(firstTag, `${file}: root element is not a card`).toMatch(
                /(styles|fieldStyles)\.section/
            );
            if (firstTag.startsWith('<fieldset')) {
                carded += 1;
            }
        }

        // Non-vacuity: the guard must actually have inspected the real form.
        expect(SECTION_FILES.length).toBeGreaterThanOrEqual(7);
        expect(carded).toBeGreaterThan(10);
    });

    it('makes the translation panel its own card instead of a bare fieldset', () => {
        // It sits among the section cards in the same form, so it has to read as
        // one of them. Composing the recipe on its own root beats wrapping it in
        // an extra <section>, which would nest two boxes for one section.
        expect(sectionRule(translationPanelCss)).toMatch(
            /composes:\s*card from ["']\.\.\/account\/AccountSection\.module\.css["']/
        );
        expect(translationPanelCss).toMatch(/\.section\s*>\s*legend\s*\{[^}]*float:\s*left/);
    });

    it('drops the translation panel resets and margin that would cancel or hollow the card', () => {
        const rule = sectionRule(translationPanelCss);
        expect(rule).not.toMatch(/padding:\s*0/);
        expect(rule).not.toMatch(/border:\s*none/);
        // The form owns the gap between sections; this margin would render as
        // dead space INSIDE the card.
        expect(rule).not.toMatch(/margin:\s*0\s+0\s+var\(--space-5/);
        expect(rule).toContain('margin: 0;');
    });

    it('the page no longer wraps the editor in an outer AccountSectionCard', () => {
        // The editor renders its own cards now; an outer one would nest them —
        // double border, double padding, two stacked brand accent bars.
        expect(editorPage).not.toMatch(
            /<AccountSectionCard>\s*(\{\s*\/\*[\s\S]*?\*\/\s*\}\s*)?<CommerceListingEditor/
        );
        // ...while the FAQ block below it legitimately keeps its own card.
        expect(editorPage).toMatch(/<AccountSectionCard>\s*<CommerceFaqManager/);
    });
});
