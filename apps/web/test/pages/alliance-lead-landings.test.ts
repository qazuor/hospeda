/**
 * @file alliance-lead-landings.test.ts
 * @description Shared guards for the four alliance-lead landings.
 *
 * One file for all four on purpose: the invariants below are identical across
 * them, and four copies drift. The per-page suites keep the page-specific
 * assertions (namespace, `kind`, island wiring).
 *
 * Why these particular assertions exist:
 *
 *  - `expect(src).toContain('Breadcrumbs')` — which every per-page suite had —
 *    passed for the entire time the breadcrumb rendered NOTHING. `Breadcrumbs`
 *    drops the last item (it is the page's own `<h1>`) and returns an empty trail
 *    when only "Inicio" would remain, so a page passing ONE item mounts a
 *    component that emits zero HTML. Mounting is not rendering. The guard has to
 *    count the levels.
 *  - Making the trail render is exactly what trips
 *    `breadcrumbs-coverage.test.ts`: an indexable page with a VISIBLE trail must
 *    also emit `BreadcrumbList`. That guard is what turned CI red on the first
 *    attempt at this fix, so the JSON-LD is asserted here alongside the trail
 *    that requires it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The four landings that mount `AllianceLead`. */
const LANDINGS = [
    'sumate/partner',
    'sumate/proveedor',
    'sumate/sponsor',
    'colaborar/editores'
] as const;

const sources = new Map<string, string>(
    LANDINGS.map((rel) => [
        rel,
        readFileSync(resolve(__dirname, `../../src/pages/[lang]/${rel}/index.astro`), 'utf8')
    ])
);

/** Number of `{ label: … }` entries the page hands to `<Breadcrumbs>`. */
function visibleTrailLevels(src: string): number {
    const start = src.indexOf('<Breadcrumbs');
    if (start === -1) return 0;
    const slice = src.slice(start, start + 1200);
    const items = slice.match(/items=\{(\[[\s\S]*?\])\}/);
    if (!items) return 0;
    return (items[1].match(/\{\s*label:/g) ?? []).length;
}

/** The `breadcrumbItems` array literal, as source text. */
function structuredTrail(src: string): string {
    return /const breadcrumbItems = \[([\s\S]*?)\];/.exec(src)?.[1] ?? '';
}

describe('alliance-lead landings — the guard reads a real page set', () => {
    it('finds all four pages, non-empty', () => {
        // Complementary half: every per-page loop below is vacuous if this set
        // is empty or a path silently stopped resolving.
        expect(sources.size).toBe(4);
        for (const [rel, src] of sources) {
            expect(src.length, `${rel} is empty`).toBeGreaterThan(500);
        }
    });
});

describe('alliance-lead landings — the visible trail actually renders', () => {
    for (const rel of LANDINGS) {
        it(`${rel} passes a parent level, so the trail is not dropped`, () => {
            // 1 level collapses to "Inicio" alone and renders nothing at all.
            expect(visibleTrailLevels(sources.get(rel) as string)).toBeGreaterThanOrEqual(2);
        });

        it(`${rel} wraps the trail in a container`, () => {
            // `Breadcrumbs` brings no container of its own, so without a wrapper
            // the trail sits flush against the viewport edge.
            expect(sources.get(rel)).toContain('class="sumate__breadcrumbs"');
        });
    }
});

describe('alliance-lead landings — the structured trail matches the visible one', () => {
    for (const rel of LANDINGS) {
        it(`${rel} emits BreadcrumbList`, () => {
            const src = sources.get(rel) as string;
            expect(src).toContain("from '@/components/seo/BreadcrumbJsonLd.astro'");
            expect(src).toMatch(/<BreadcrumbJsonLd[^>]*slot="head"[^>]*items=\{breadcrumbItems\}/);
        });

        it(`${rel} starts the structured trail at home and ends at this page`, () => {
            const trail = structuredTrail(sources.get(rel) as string);
            expect(trail.length).toBeGreaterThan(0);
            // The leaf is the whole point: the visible component drops it, so the
            // BreadcrumbList is the only place the full hierarchy survives.
            expect(trail).toContain("t('nav.home'");
            expect(trail).toContain('url: canonicalUrl');
        });
    }

    it('the /sumate/ landings do NOT invent a URL for the "Sumate" level', () => {
        // There is no /sumate/ index page. It is context for a human and a 404
        // for a crawler, so the structured trail is home → this page, two levels,
        // while the VISIBLE trail shows three.
        for (const rel of ['sumate/partner', 'sumate/proveedor', 'sumate/sponsor'] as const) {
            const trail = structuredTrail(sources.get(rel) as string);
            expect((trail.match(/\{\s*name:/g) ?? []).length, `${rel} structured levels`).toBe(2);
            expect(trail, `${rel} must not link /sumate/`).not.toContain("path: 'sumate'");
        }
    });

    it('the editores landing DOES link its real parent page', () => {
        const src = sources.get('colaborar/editores') as string;
        const trail = structuredTrail(src);
        expect((trail.match(/\{\s*name:/g) ?? []).length).toBe(3);
        expect(trail).toContain('url: collaborateUrl');
        expect(src).toContain("buildUrl({ locale, path: 'colaborar' })");
    });
});

describe('alliance-lead landings — the form is not pushed below the fold', () => {
    for (const rel of LANDINGS) {
        it(`${rel} uses compact section padding`, () => {
            const src = sources.get(rel) as string;
            // 120px above the hero, 120px below it and 120px again above the form
            // put the <form> at 765px on a 1366x800 screen. The compact value is
            // the one TestimonialsSection and CategoryTiles already use.
            expect(src).not.toContain('padding-block: var(--space-section, 120px)');
            expect(src).toContain('padding-block: clamp(3rem, 6vw, 4.5rem)');
        });
    }
});
