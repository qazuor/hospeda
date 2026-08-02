/**
 * @fileoverview
 * Drift guard for the static sitemap.
 *
 * WHY THIS EXISTS: the previous sitemap silently shipped ZERO pages for months.
 * `@astrojs/sitemap` enumerates only routes rendered to static HTML at build
 * time, and this app prerenders none, so its `<urlset>` was empty and nobody
 * noticed — there was no test that could fail. Replacing it with a hand-curated
 * list fixes today's sitemap but introduces the opposite failure mode: a page
 * added next month is simply forgotten.
 *
 * So this guard walks `src/pages/[lang]` and asserts that EVERY parameter-free
 * page is accounted for — either emitted in `STATIC_SITEMAP_PAGES` or listed in
 * `NON_SITEMAP_STATIC_PAGES` with a reason. Adding a page without classifying
 * it fails CI with the exact path to classify.
 *
 * It deliberately does NOT try to infer indexability from the source. Whether a
 * page belongs in a sitemap depends on its `noindex` prop, in-page auth guards
 * and redirects; a regex over `.astro` files would be confidently wrong (the
 * listing pages, for instance, pass `noindex={facetSeoDecision.noindex}` — a
 * runtime value that is `false` on the canonical URL). A human classifies once;
 * the guard only ensures nobody skips that step.
 */

import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    NON_SITEMAP_STATIC_PAGES,
    STATIC_SITEMAP_PAGES
} from '../../../src/lib/seo/static-sitemap-pages.js';
import { isExcludedSitemapPage } from '../../../src/lib/seo-config.js';

const PAGES_ROOT = resolve(__dirname, '../../../src/pages/[lang]');

/**
 * Collect every `.astro` file under `src/pages/[lang]`, as paths relative to
 * that directory.
 */
function collectAstroFiles(dir: string, prefix = ''): string[] {
    const found: string[] = [];

    for (const entry of readdirSync(dir)) {
        const absolute = join(dir, entry);
        const relative = prefix ? `${prefix}/${entry}` : entry;

        if (statSync(absolute).isDirectory()) {
            found.push(...collectAstroFiles(absolute, relative));
        } else if (entry.endsWith('.astro')) {
            found.push(relative);
        }
    }

    return found;
}

/**
 * Convert a page file path into the locale-agnostic URL path it serves.
 *
 * `index.astro` -> `/`, `nueva.astro` -> `/nueva/`, `legal/cookies/index.astro`
 * -> `/legal/cookies/`. Mirrors Astro's file routing plus this app's enforced
 * trailing slash.
 */
function routePathFor(file: string): string {
    const withoutExtension = file.replace(/\.astro$/, '');
    const withoutIndex = withoutExtension.replace(/(^|\/)index$/, '$1');

    return withoutIndex === '' ? '/' : `/${withoutIndex}/`.replace(/\/{2,}/g, '/');
}

/** Every parameter-free route under `[lang]`, minus the robots-disallowed prefixes. */
function classifiableRoutes(): string[] {
    return collectAstroFiles(PAGES_ROOT)
        .filter((file) => !file.includes('['))
        .map(routePathFor)
        .filter((path) => !isExcludedSitemapPage(`/es${path}`))
        .sort();
}

describe('static sitemap page classification', () => {
    const emitted = new Set(STATIC_SITEMAP_PAGES.map((page) => page.path));
    const excluded = new Set(Object.keys(NON_SITEMAP_STATIC_PAGES));

    it('finds the pages directory (guard is not vacuously passing)', () => {
        const routes = classifiableRoutes();

        // A broken path or a changed layout would make every assertion below
        // pass over an empty set. Pin a floor and two known members.
        expect(routes.length).toBeGreaterThan(30);
        expect(routes).toContain('/nosotros/');
        expect(routes).toContain('/legal/terminos/');
    });

    it('classifies every parameter-free page as emitted or excluded', () => {
        const unclassified = classifiableRoutes().filter(
            (path) => !emitted.has(path) && !excluded.has(path)
        );

        expect(
            unclassified,
            [
                'These pages exist under src/pages/[lang] but are in neither list.',
                'Add each to STATIC_SITEMAP_PAGES (if it is an indexable landing page)',
                'or to NON_SITEMAP_STATIC_PAGES with a reason, in',
                'src/lib/seo/static-sitemap-pages.ts.'
            ].join(' ')
        ).toEqual([]);
    });

    it('does not reference pages that no longer exist', () => {
        const routes = new Set(classifiableRoutes());
        const stale = [...emitted, ...excluded].filter((path) => !routes.has(path));

        expect(stale, 'These classified paths have no page file behind them.').toEqual([]);
    });

    it('never classifies the same page twice', () => {
        const both = [...emitted].filter((path) => excluded.has(path));

        expect(both, 'A page cannot be both emitted and excluded.').toEqual([]);
    });

    it('emits well-formed paths only', () => {
        for (const { path, priority } of STATIC_SITEMAP_PAGES) {
            expect(path.startsWith('/'), `${path} must start with a slash`).toBe(true);
            expect(path.endsWith('/'), `${path} must end with a slash`).toBe(true);
            expect(path.includes('['), `${path} must not be a dynamic route`).toBe(false);
            expect(priority).toBeGreaterThan(0);
            expect(priority).toBeLessThanOrEqual(1);
        }
    });

    it('gives the home page top priority', () => {
        const home = STATIC_SITEMAP_PAGES.find((page) => page.path === '/');

        expect(home?.priority).toBe(1.0);
    });
});
