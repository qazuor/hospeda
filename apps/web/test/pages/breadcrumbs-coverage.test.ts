/**
 * @file breadcrumbs-coverage.test.ts
 * @description Integration test asserting that all sub-routes and detail pages
 * declared in SPEC-096 REQ-096-19 (T-029, T-030, T-031) have a Breadcrumbs
 * import and usage in their source.
 *
 * These are source-based assertions (read file, check content) — no DOM
 * renderer is used because Astro components cannot be rendered in Vitest.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_DIR = resolve(__dirname, '../../src/pages/[lang]');

/**
 * Reads an Astro page source file relative to the [lang] pages directory.
 */
function readPage(relativePath: string): string {
    return readFileSync(resolve(PAGES_DIR, relativePath), 'utf8');
}

/**
 * Checks that a page source imports Breadcrumbs from the shared navigation
 * component and uses it.
 */
function assertHasBreadcrumbs(src: string, pageDescription: string): void {
    expect(src, `${pageDescription}: must import Breadcrumbs`).toContain('Breadcrumbs.astro');
    expect(src, `${pageDescription}: must use <Breadcrumbs`).toContain('<Breadcrumbs');
}

// ─── T-029: Accommodation pages ─────────────────────────────────────────────

describe('T-029 — Accommodation sub-routes and detail pages', () => {
    it('alojamientos/[slug] has Breadcrumbs with accommodation name', () => {
        const src = readPage('alojamientos/[slug].astro');
        assertHasBreadcrumbs(src, 'alojamientos/[slug]');
        // Items must include accommodations and the entity name
        expect(src).toContain('accommodation.name');
    });

    it('alojamientos/tipo/[type] has Breadcrumbs with type name', () => {
        const src = readPage('alojamientos/tipo/[type]/index.astro');
        assertHasBreadcrumbs(src, 'alojamientos/tipo/[type]');
        // SPEC-306: renamed from `typeLabel` to `typeName`, now sourced from
        // `accommodations.byType.types.{ENUM}.name` instead of the generic
        // `common.enums.accommodationType.*` key.
        expect(src).toContain('typeName');
    });

    it('alojamientos/comodidades/[slug] has Breadcrumbs with amenities level and amenity name', () => {
        const src = readPage('alojamientos/comodidades/[slug]/index.astro');
        assertHasBreadcrumbs(src, 'alojamientos/comodidades/[slug]');
        // Must include the intermediate "Comodidades" level
        expect(src).toContain("t('accommodations.amenities'");
        expect(src).toContain('amenityName');
    });

    it('alojamientos/caracteristicas/[slug] has Breadcrumbs with features level and feature name', () => {
        const src = readPage('alojamientos/caracteristicas/[slug]/index.astro');
        assertHasBreadcrumbs(src, 'alojamientos/caracteristicas/[slug]');
        // Must include the intermediate "Características" level
        expect(src).toContain("t('accommodations.features'");
        expect(src).toContain('featureName');
    });
});

// ─── T-030: Destination and attraction pages ────────────────────────────────

describe('T-030 — Destination and attraction pages', () => {
    it('destinos/[...path] has Breadcrumbs with path segments', () => {
        const src = readPage('destinos/[...path].astro');
        assertHasBreadcrumbs(src, 'destinos/[...path]');
        expect(src).toContain('breadcrumbItems');
    });

    it('destinos/[slug]/alojamientos has Breadcrumbs with destination name', () => {
        const src = readPage('destinos/[slug]/alojamientos/index.astro');
        assertHasBreadcrumbs(src, 'destinos/[slug]/alojamientos');
        expect(src).toContain('destName');
    });

    it('destinos/[slug]/eventos has Breadcrumbs with destination name', () => {
        const src = readPage('destinos/[slug]/eventos/index.astro');
        assertHasBreadcrumbs(src, 'destinos/[slug]/eventos');
        expect(src).toContain('destName');
    });

    it('destinos/atraccion/[slug] has Breadcrumbs with attraction name', () => {
        const src = readPage('destinos/atraccion/[slug]/index.astro');
        assertHasBreadcrumbs(src, 'destinos/atraccion/[slug]');
        expect(src).toContain('name');
    });
});

// ─── T-031: Events, posts, and author pages ──────────────────────────────────

describe('T-031 — Events, posts, and author pages', () => {
    it('eventos/[slug] has Breadcrumbs with event title', () => {
        const src = readPage('eventos/[slug].astro');
        assertHasBreadcrumbs(src, 'eventos/[slug]');
        // Event name/title is stored in `name`
        expect(src).toContain('{ label: name }');
    });

    it('eventos/categoria/[category] has Breadcrumbs with category name', () => {
        const src = readPage('eventos/categoria/[category]/index.astro');
        assertHasBreadcrumbs(src, 'eventos/categoria/[category]');
        // SPEC-306: promoted to a first-class landing; the category name comes
        // from `events.categoryPage.categories.{ENUM}.name`.
        expect(src).toContain('categoryName');
    });

    it('publicaciones/[slug] has Breadcrumbs with post title', () => {
        const src = readPage('publicaciones/[slug].astro');
        assertHasBreadcrumbs(src, 'publicaciones/[slug]');
        expect(src).toContain('{ label: title }');
    });

    it('publicaciones/categoria/[category] has Breadcrumbs with category label', () => {
        const src = readPage('publicaciones/categoria/[category]/index.astro');
        assertHasBreadcrumbs(src, 'publicaciones/categoria/[category]');
        expect(src).toContain('catLabel');
    });

    it('publicaciones/etiqueta/[tag] has Breadcrumbs with tags level and tag label', () => {
        const src = readPage('publicaciones/etiqueta/[tag]/index.astro');
        assertHasBreadcrumbs(src, 'publicaciones/etiqueta/[tag]');
        // Must include the intermediate "Etiquetas" level
        expect(src).toContain("t('blog.detail.tags'");
        expect(src).toContain('tagName');
    });

    it('autores/[slug] has Breadcrumbs with the author name and NO intermediate level', () => {
        // HOS-375 §8: the author page moved out of the blog subtree to
        // `/autores/<slug>/`, and there is no `/autores/` index (NG-1) — so the
        // trail is Inicio → <displayName>, with no grouping level between them.
        const src = readPage('autores/[slug]/index.astro');
        assertHasBreadcrumbs(src, 'autores/[slug]');
        expect(src).toContain('authorName');

        // Non-vacuity guard: the old page carried an "Autor" grouping level that
        // linked nowhere. Re-adding one would put a dead step back in the trail.
        //
        // Scanned against the markup only. Fences are matched as whole lines,
        // not with `indexOf('---')`: this page's docblock holds a markdown table
        // whose separator row contains `---`, which would cut the file in the
        // middle of a comment.
        const lines = src.split('\n');
        const fences: number[] = [];
        lines.forEach((line, index) => {
            if (line.trim() === '---') fences.push(index);
        });
        const template = lines.slice(fences[1] + 1).join('\n');

        expect(template).toContain('<Breadcrumbs');
        expect(template).not.toContain("t('blog.details.author'");
    });
});

// ─── Structural contract ─────────────────────────────────────────────────────

describe('Breadcrumbs component contract', () => {
    const breadcrumbsSrc = readFileSync(
        resolve(__dirname, '../../src/components/shared/navigation/Breadcrumbs.astro'),
        'utf8'
    );

    it('shared/navigation/Breadcrumbs.astro uses locale-aware home label', () => {
        // Must auto-prepend a localized home level
        expect(breadcrumbsSrc).toContain("homeLabel: t('nav.home'");
        // Must accept locale prop
        expect(breadcrumbsSrc).toContain('locale');
        // Must render nav with breadcrumb role
        expect(breadcrumbsSrc).toContain('aria-label');
    });

    it('delegates trail construction to the tested builder, not inline template logic', () => {
        // The drop-the-current-page and hide-a-lone-home rules are unit-tested in
        // test/lib/navigation/breadcrumb-trail.test.ts. Keeping them out of the
        // template is what makes them testable at all — Astro components cannot
        // be rendered in Vitest.
        expect(breadcrumbsSrc).toContain('buildBreadcrumbTrail');
        // The old `path ?? ''` fallback silently linked pathless levels to the
        // homepage; it must not come back.
        expect(breadcrumbsSrc).not.toContain("item.path ?? ''");
    });

    it('renders nothing when the trail carries no hierarchy', () => {
        expect(breadcrumbsSrc).toContain('entries.length > 0');
    });

    it('truncates long levels with an ellipsis instead of stretching the trail', () => {
        expect(breadcrumbsSrc).toContain('text-overflow: ellipsis');
        expect(breadcrumbsSrc).toContain('white-space: nowrap');
        // Full label must stay reachable when clipped
        expect(breadcrumbsSrc).toContain('title={entry.label}');
    });
});

describe('Breadcrumbs is the single implementation', () => {
    it('LegalLayout uses the shared component instead of hand-rolling a trail', () => {
        const legalSrc = readFileSync(
            resolve(__dirname, '../../src/layouts/LegalLayout.astro'),
            'utf8'
        );

        expect(legalSrc).toContain('navigation/Breadcrumbs.astro');
        expect(legalSrc).toContain('<Breadcrumbs');
        // The hand-rolled markup and its duplicated styling must not come back.
        expect(legalSrc).not.toContain('legal-breadcrumbs__list');
        expect(legalSrc).not.toContain('legal-breadcrumbs__link');
        expect(legalSrc).not.toContain('legal-breadcrumbs__item');
    });

    it('no page or layout hand-rolls a breadcrumb nav of its own', () => {
        // Any `aria-label="Breadcrumb"` outside the shared component means a
        // second implementation has appeared — exactly what this change removed.
        const offenders: string[] = [];
        for (const dir of ['../../src/pages', '../../src/layouts', '../../src/components']) {
            const base = resolve(__dirname, dir);
            const stack = [base];
            while (stack.length > 0) {
                const current = stack.pop();
                if (!current) continue;
                for (const entry of readdirSync(current, { withFileTypes: true })) {
                    const full = resolve(current, entry.name);
                    if (entry.isDirectory()) {
                        stack.push(full);
                    } else if (entry.name.endsWith('.astro')) {
                        if (full.endsWith('shared/navigation/Breadcrumbs.astro')) continue;
                        const src = readFileSync(full, 'utf8');
                        if (/aria-label=["']Breadcrumb["']/i.test(src)) {
                            offenders.push(full.slice(base.length + 1));
                        }
                    }
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});

/**
 * Number of levels a page passes to <Breadcrumbs>, or `'dynamic'` when the
 * array is built in the frontmatter and cannot be counted statically.
 */
function visibleTrailLevels(src: string): number | 'dynamic' {
    const start = src.indexOf('<Breadcrumbs');
    if (start === -1) return 0;
    const match = src.slice(start, start + 1500).match(/items=\{(\[[\s\S]*?\])\}/);
    if (!match) return 'dynamic';
    const labels = (match[1].match(/\{\s*label:/g) ?? []).length;
    const spreads = (match[1].match(/\.\.\./g) ?? []).length;
    // A spread adds at least one more conditional level.
    return spreads > 0 ? labels + 1 : labels;
}

describe('BreadcrumbList JSON-LD coverage', () => {
    // A page that shows a trail to users must expose the same hierarchy to
    // crawlers. The visible component deliberately drops the leaf, so the
    // BreadcrumbList is the ONLY place the full hierarchy survives — an
    // indexable page without it exposes no breadcrumb hierarchy at all.
    // `noindex` pages are exempt: structured data on them is inert.

    const pageFiles: string[] = [];
    const stack = [PAGES_DIR];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const full = resolve(current, entry.name);
            if (entry.isDirectory()) stack.push(full);
            else if (entry.name.endsWith('.astro')) pageFiles.push(full);
        }
    }

    it('finds the page set (guard is not scanning an empty tree)', () => {
        expect(pageFiles.length).toBeGreaterThan(50);
    });

    it('every indexable page with a visible trail emits BreadcrumbList', () => {
        const offenders: string[] = [];

        for (const file of pageFiles) {
            const src = readFileSync(file, 'utf8');
            if (!src.includes('<Breadcrumbs')) continue;

            const levels = visibleTrailLevels(src);
            // 1 level means the trail collapses to home alone and is not rendered.
            if (levels !== 'dynamic' && levels < 2) continue;

            // Exempt: explicitly noindex, or behind the account area (never indexed).
            if (src.includes('noindex={true}') || src.includes('noindex={facetSeoDecision'))
                continue;
            const rel = file.slice(PAGES_DIR.length + 1);
            if (rel.startsWith('mi-cuenta/')) continue;

            if (!src.includes('BreadcrumbJsonLd')) offenders.push(rel);
        }

        expect(offenders).toEqual([]);
    });
});
