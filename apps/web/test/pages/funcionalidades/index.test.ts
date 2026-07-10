/**
 * @file index.test.ts
 * @description Source-string tests for the public `/[lang]/funcionalidades/`
 * marketing page (HOS-119). Mirrors the lightweight `readFileSync`-based
 * pattern used by `apps/web/test/pages/suscriptores/plan1.test.ts` — this
 * page is SSR (no static build artifact to inspect), so assertions target
 * the `.astro` source directly rather than a rendered DOM.
 *
 * Tasks: T-008
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/funcionalidades/index.astro'),
    'utf8'
);

/**
 * Removes every balanced `var(...)` call from a CSS/astro source string,
 * including nested calls (e.g. `var(--fx-line, var(--border))`) and calls
 * whose fallback argument is itself a color function
 * (e.g. `var(--surface-dark, oklch(0.24 0.04 252))`, a pattern already
 * established elsewhere in this codebase — see `apps/web/src/styles/components.css`
 * and several other pages). Used to verify that no color literal appears
 * *outside* of an allowed `var()` fallback slot.
 */
function stripVarCalls(css: string): string {
    let result = '';
    let i = 0;
    while (i < css.length) {
        const idx = css.indexOf('var(', i);
        if (idx === -1) {
            result += css.slice(i);
            break;
        }
        result += css.slice(i, idx);
        let depth = 1;
        let j = idx + 'var('.length;
        while (j < css.length && depth > 0) {
            if (css[j] === '(') depth++;
            else if (css[j] === ')') depth--;
            j++;
        }
        i = j;
    }
    return result;
}

describe('Funcionalidades marketing page (funcionalidades/index.astro)', () => {
    it('uses StandaloneLayout (page must have zero site chrome, HOS-119)', () => {
        expect(src).toContain('StandaloneLayout');
        expect(src).not.toContain('MarketingLayout');
    });

    it('does not render the site Header, Footer, or nav chrome', () => {
        // The page must be fully standalone — no Header/Footer/nav imports or
        // usage, and no reference to the site's BaseLayout (which is what
        // renders them). StandaloneLayout itself never imports Header/Footer
        // (see its own docblock) — this guards the page source specifically.
        expect(src).not.toMatch(/from ['"].*\/Header\.astro['"]/);
        expect(src).not.toMatch(/from ['"].*\/Footer\.astro['"]/);
        expect(src).not.toContain('<Header');
        expect(src).not.toContain('<Footer');
        expect(src).not.toContain('BaseLayout');
    });

    it('does not opt out of SSR (no prerender = true)', () => {
        expect(src).not.toContain('prerender = true');
    });

    it('uses CSS custom properties (the page-scoped --fx-* token bridge)', () => {
        expect(src).toContain('var(--fx-');
        expect(src).toContain('--fx-river: var(--hospeda-river)');
    });

    it('contains no hardcoded color literal outside of an allowed var() fallback', () => {
        const stripped = stripVarCalls(src);
        expect(stripped).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(stripped).not.toMatch(/rgba?\(/);
        expect(stripped).not.toMatch(/oklch\(/);
        expect(stripped).not.toMatch(/hsl\(/);
    });

    it('uses createTranslations and the features.* i18n namespace', () => {
        expect(src).toContain('createTranslations');
        expect(src).toContain("t('features.");
    });

    it('imports icons from @repo/icons and has no inline <svg>', () => {
        expect(src).toMatch(/from '@repo\/icons'/);
        expect(src).not.toContain('<svg');
    });

    it('renders the audience subnav anchors driven by SUBNAV_LINKS ids', () => {
        expect(src).toContain('href={`#${link.id}`}');
        expect(src).toContain('data-subnav-link={link.id}');
        expect(src).toContain('SUBNAV_LINKS.map((link)');
    });

    it.each([
        ['hero', 'class="fx-hero"'],
        ['subnav', 'class="fx-subnav"'],
        ['viajeros', 'id="viajeros"'],
        ['anfitriones', 'id="anfitriones"'],
        ['gastro', 'id="gastro"'],
        ['marcas', 'id="marcas"'],
        ['ademas', 'id="ademas"'],
        ['proximamente', 'id="proximamente"']
    ])('renders the %s section marker', (_name, marker) => {
        expect(src).toContain(marker);
    });

    it('renders the "un vistazo" section', () => {
        expect(src).toContain("t('features.vistazo.eyebrow'");
    });

    it('renders the closing CTA section', () => {
        expect(src).toContain('class="fx-cta"');
        expect(src).toContain("t('features.cta.title')");
    });

    it('includes the three JSON-LD components', () => {
        expect(src).toContain('CollectionPageJsonLd');
        expect(src).toContain('ItemListJsonLd');
        expect(src).toContain('BreadcrumbJsonLd');
    });

    it('guards the hero blob animation behind prefers-reduced-motion', () => {
        // Two `prefers-reduced-motion` blocks exist on this page (one for the
        // subnav smooth-scroll, one for the blob drift animation) — match the
        // specific block whose body targets `.fx-blob`.
        const blobReducedMotionMatch = src.match(
            /@media \(prefers-reduced-motion: reduce\) \{\s*\.fx-blob \{\s*animation: none[^}]*\}\s*\}/
        );
        expect(blobReducedMotionMatch).not.toBeNull();
    });

    it('links the CTA to /publicar/ via buildUrl (never a hardcoded href)', () => {
        expect(src).toContain("buildUrl({ locale, path: 'publicar' })");
    });
});
