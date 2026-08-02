/**
 * @file CommerceListingEditor.cards.test.ts
 * @description Structural guard (HOS-371) for the per-section cards.
 *
 * Asserted on the SOURCE, not on rendered output, for two reasons: CSS Modules
 * `composes` is resolved at build time (jsdom sees only the local class name,
 * so a rendered-DOM assertion could not tell a composed card from a bare div),
 * and the page is an `.astro` file, which Vitest cannot render — the project's
 * documented convention for both cases (see `apps/web/CLAUDE.md` → Testing).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const editorCss = readFileSync(
    resolve(__dirname, '../../../src/components/commerce/CommerceListingEditor.module.css'),
    'utf8'
);

const editorTsx = readFileSync(
    resolve(__dirname, '../../../src/components/commerce/CommerceListingEditor.client.tsx'),
    'utf8'
);

const editorPage = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar.astro'),
    'utf8'
);

const translationPanelCss = readFileSync(
    resolve(__dirname, '../../../src/components/commerce/CommerceTranslationPanel.module.css'),
    'utf8'
);

describe('CommerceListingEditor — per-section cards (HOS-371)', () => {
    it('composes the canonical AccountSection card recipe rather than redefining one', () => {
        expect(editorCss).toMatch(
            /\.section\s*\{[^}]*composes:\s*card from ["']\.\.\/account\/AccountSection\.module\.css["']/
        );
    });

    it('does not reset padding/border on .section, which would silently cancel the card', () => {
        // `composes` only adds a class name; conflicts resolve by source order,
        // and this file is emitted after the composed one. A `padding: 0` or
        // `border: none` here would win and the "card" would render exactly like
        // the pre-HOS-371 stacked divs — visually a no-op, with green tests.
        const sectionRule = editorCss.match(/\.section\s*\{[^}]*\}/)?.[0] ?? '';
        expect(sectionRule).not.toMatch(/padding:\s*0/);
        expect(sectionRule).not.toMatch(/border:\s*none/);
    });

    it('applies the section class to every top-level section and fieldset of the form', () => {
        // Anything rendered directly under <form> without styles.section is the
        // one block that would be missing its card.
        //
        // Comments are stripped first: this file's own prose mentions tags like
        // `<fieldset>` when explaining the markup, and matching those produced a
        // failure with nothing wrong in the code. Widening the tag regex to
        // dodge that would have blinded the guard instead — the stripping is
        // what keeps it strict AND accurate.
        const code = editorTsx.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        const tags = code.match(/<(section|fieldset)\b[^>]*>/g) ?? [];

        expect(tags.length).toBeGreaterThan(10);
        for (const tag of tags) {
            expect(tag).toContain('styles.section');
        }
    });

    it('wraps the translation panel so it reads as a card like every sibling', () => {
        expect(editorTsx).toMatch(
            /<section className=\{styles\.section\}>\s*\{?\s*\/?\*?[\s\S]{0,40}?<CommerceTranslationPanel/
        );
    });

    it('drops the translation panel fieldset margin that would become dead space inside the card', () => {
        const sectionRule = translationPanelCss.match(/\.section\s*\{[^}]*\}/)?.[0] ?? '';
        expect(sectionRule).toContain('margin: 0;');
        expect(sectionRule).not.toMatch(/margin:\s*0\s+0\s+var\(--space-5/);
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
