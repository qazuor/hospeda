/**
 * @module test/pages/presentacion-mobile
 * @description HOS-1766 item 08. The six `/presentacion/*` pages were measured
 * on a 320px and a 375px viewport: the tier tables hid their Premium column
 * with no cue that they scroll, the closing CTA printed a raw URL that ran off
 * the right edge, a third fact sat alone on its own row with no divider, and
 * the floating theme button rode over the table. These parse the real CSS and
 * assert the contract that fixes each, plus that every page's CTA uses an
 * i18n label instead of a URL.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { baseValue, parseFile, parseRules, readSrc, styleOf } from '../helpers/css-contract';

const rules = parseFile({ path: 'styles/presentacion.css' });
const MOBILE = '@media (max-width: 40rem)';

/** Declarations that apply to `selector` inside the 40rem mobile block. */
function mobileDecls({
    all,
    selector
}: {
    readonly all: ReturnType<typeof parseRules>;
    readonly selector: string;
}): Readonly<Record<string, string>> {
    return Object.assign(
        {},
        ...all
            .filter((r) => r.selector === selector && r.media.some((m) => m.includes(MOBILE)))
            .sort((a, b) => a.order - b.order)
            .map((r) => r.decls)
    );
}

describe('.tablewrap scroll affordance', () => {
    it('scrolls horizontally', () => {
        expect(baseValue({ rules, selector: '.tablewrap', prop: 'overflow-x' })).toBe('auto');
    });

    it('paints scroll shadows: two local covers over two scroll-attached edge shadows', () => {
        // Arrange
        const attachment = baseValue({
            rules,
            selector: '.tablewrap',
            prop: 'background-attachment'
        });
        const image = baseValue({ rules, selector: '.tablewrap', prop: 'background-image' });

        // Assert: covers move with the content (local), shadows stay on the box (scroll)
        expect(attachment?.split(',').map((v) => v.trim())).toEqual([
            'local',
            'local',
            'scroll',
            'scroll'
        ]);
        expect(image?.match(/linear-gradient\(/g)).toHaveLength(4);
    });

    it('derives the shadow from the theme ink, so it reads in light and dark', () => {
        const edge = baseValue({ rules, selector: '.tablewrap', prop: '--shadow-edge' });

        expect(edge).toContain('var(--ink)');
    });
});

describe('.cta never runs off a narrow screen', () => {
    it('is capped to its column and allowed to wrap', () => {
        expect(baseValue({ rules, selector: '.cta', prop: 'max-width' })).toBe('100%');
        expect(baseValue({ rules, selector: '.cta', prop: 'white-space' })).toBe('normal');
        expect(baseValue({ rules, selector: '.cta', prop: 'overflow-wrap' })).toBe('anywhere');
    });

    it('stretches to the full column on a phone', () => {
        expect(mobileDecls({ all: rules, selector: '.cta' })['align-self']).toBe('stretch');
    });
});

describe('long tokens cannot widen a grid track', () => {
    it('lets the page column break long words', () => {
        expect(baseValue({ rules, selector: '.wrap', prop: 'overflow-wrap' })).toBe('break-word');
    });

    it('lets the steps text track shrink below its content', () => {
        expect(baseValue({ rules, selector: 'ol.steps li', prop: 'grid-template-columns' })).toBe(
            '2.6rem minmax(0, 1fr)'
        );
    });
});

describe('factsheet on a phone', () => {
    it('uses two fixed columns and lets an odd last fact span the row', () => {
        expect(mobileDecls({ all: rules, selector: '.factsheet' })['grid-template-columns']).toBe(
            'repeat(2, minmax(0, 1fr))'
        );
        expect(
            mobileDecls({ all: rules, selector: '.fact:last-child:nth-child(odd)' })['grid-column']
        ).toBe('1 / -1');
    });

    it('divides the rows (the stranded third fact had no divider)', () => {
        expect(mobileDecls({ all: rules, selector: '.fact' })['border-bottom']).toContain(
            'var(--line)'
        );
    });
});

describe('tables are compacted on a phone', () => {
    it('tightens cell padding and header type', () => {
        expect(mobileDecls({ all: rules, selector: 'th' })['font-size']).toBe('0.72rem');
        expect(mobileDecls({ all: rules, selector: 'td' }).padding).toBe('0.7rem 0.65rem');
    });
});

describe('theme toggle does not ride over content on a phone', () => {
    const toggle = parseRules({
        css: styleOf({
            source: readSrc({ path: 'components/presentacion/PresentationThemeToggle.astro' })
        })
    });

    it('is pinned to the viewport on desktop and scrolls with the page on mobile', () => {
        expect(baseValue({ rules: toggle, selector: '.theme-toggle', prop: 'position' })).toBe(
            'fixed'
        );
        expect(mobileDecls({ all: toggle, selector: '.theme-toggle' }).position).toBe('absolute');
    });
});

describe('closing CTA label', () => {
    const PAGES = {
        aliados: 'partners',
        alojamientos: 'accommodations',
        editores: 'editors',
        experiencias: 'seePlans',
        gastronomia: 'seePlans',
        proveedores: 'providers'
    } as const;
    const LOCALES = ['es', 'en', 'pt'] as const;
    const pricing = Object.fromEntries(
        LOCALES.map((l) => [
            l,
            JSON.parse(
                readFileSync(
                    resolve(__dirname, `../../../../packages/i18n/src/locales/${l}/pricing.json`),
                    'utf8'
                )
            ) as { presentation: { cta: Record<string, string> } }
        ])
    );

    it.each(Object.entries(PAGES))('%s renders an i18n label, not the raw URL', (page, key) => {
        // Arrange
        const source = readSrc({ path: `pages/[lang]/presentacion/${page}/index.astro` });
        const cta = source.match(/<a class="cta" href="[^"]+">([^<]*)<\/a>/);

        // Assert: the link text is the resolved label expression, never literal text
        expect(cta?.[1]).toBe('{ctaLabel}');
        expect(source).toContain(`createT('es')('pricing.presentation.cta.${key}')`);
    });

    it.each(
        Object.entries(PAGES)
    )('%s label exists, is human text, in every locale', (_page, key) => {
        for (const locale of LOCALES) {
            const label = pricing[locale]?.presentation.cta[key];

            expect(label, `${locale}.${key}`).toBeTruthy();
            expect(label).not.toMatch(/https?:|hospeda\.com\.ar|\//);
        }
    });
});
