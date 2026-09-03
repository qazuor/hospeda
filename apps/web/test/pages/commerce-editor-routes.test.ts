/**
 * @file commerce-editor-routes.test.ts
 * @description Guards the commerce editor's page routes (HOS-1080, closing
 * HOS-892).
 *
 * The commerce counterpart of `editor-routes.test.ts`. Two of these blocks are
 * the ones worth having:
 *
 *  - **every nav link resolves to a route file that exists.** The registry
 *    builds hrefs from slugs; nothing in TypeScript notices when a slug has no
 *    matching `.astro`, and the failure is a 404 reached from a link the editor
 *    itself drew.
 *  - **no page mounts a section it does not own.** Without it a future edit
 *    could quietly re-import the media manager into another route and undo the
 *    weight win with nothing failing.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCommerceEditorSections } from '@/lib/editor/commerce-editor-sections';

const ROUTES_DIR = resolve(
    __dirname,
    '../../src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar'
);

/** Reads one route file's source. */
function readRoute(file: string): string {
    return readFileSync(resolve(ROUTES_DIR, file), 'utf8');
}

/** Every `.astro` route file in the commerce editor directory. */
const ROUTE_FILES = readdirSync(ROUTES_DIR).filter((file) => file.endsWith('.astro'));

/**
 * The union of both verticals' sections.
 *
 * Both share one `[vertical]` route tree, so the experience-only pages are real
 * files that a gastronomy request redirects out of rather than files that do not
 * exist. The registry is what refuses them, not the filesystem.
 *
 * A REAL union since HOS-895, not the experience build alone. That shortcut was
 * correct only while every vertical-exclusive section belonged to the same
 * vertical: `carta` exists for gastronomy and not for experiences, so the
 * experience build no longer contains every slug that has a file. Reading it
 * alone made `carta.astro` look like a route matching no registry section —
 * the guard failing on the exact drift it exists to catch, with the drift
 * being the guard's own assumption.
 */
const ALL_SECTIONS = [
    ...new Map(
        (['gastronomy', 'experience'] as const)
            .flatMap((vertical) => buildCommerceEditorSections({ vertical }))
            .map((section) => [section.slug, section] as const)
    ).values()
];

/** Components that must appear on exactly one route each. */
const SECTION_COMPONENTS: Readonly<Record<string, string>> = {
    MediaSection: 'fotos.astro',
    CommerceFaqManager: 'preguntas.astro',
    // HOS-895. Listed for the same reason as the two above: the panel fetches
    // its own carta on mount, so a stray re-import onto another route would put
    // a `GET .../menu` on a page that does not show one — the weight the split
    // was meant to remove, re-added with nothing failing.
    CommerceMenuManager: 'carta.astro',
    // HOS-1042 — the mirror of `CommerceMenuManager` above, for the venue's
    // own agenda: it fetches `.../events` on mount, so a stray re-import onto
    // another route puts that request on a page that never shows the agenda.
    CommerceVenueEventsManager: 'eventos.astro',
    EditorHub: 'index.astro'
};

describe('commerce editor routes — one file per section', () => {
    it('should have a route file for every registry section, plus the hub', () => {
        for (const section of ALL_SECTIONS) {
            expect(ROUTE_FILES, `missing route file ${section.slug}.astro`).toContain(
                `${section.slug}.astro`
            );
        }
        expect(ROUTE_FILES).toContain('index.astro');
    });

    it('should have no route file without a matching registry section', () => {
        const known = new Set([
            ...ALL_SECTIONS.map((section) => `${section.slug}.astro`),
            'index.astro'
        ]);

        for (const file of ROUTE_FILES) {
            expect(known, `route file ${file} matches no registry section`).toContain(file);
        }
    });

    it('should point every nav link at a route file that exists', () => {
        // The nav builds hrefs from slugs, and a slug with no file is a 404
        // reached from a link the editor drew itself — invisible to typecheck.
        for (const vertical of ['gastronomy', 'experience'] as const) {
            for (const section of buildCommerceEditorSections({ vertical })) {
                expect(
                    ROUTE_FILES,
                    `${vertical}: the nav links to "${section.slug}" and no route renders it`
                ).toContain(`${section.slug}.astro`);
            }
        }
    });

    it('should render every route through the shared editor layout', () => {
        for (const file of ROUTE_FILES) {
            expect(readRoute(file), `${file} does not use CommerceEditorSectionLayout`).toContain(
                'CommerceEditorSectionLayout'
            );
        }
    });

    it('should be SSR on every route', () => {
        for (const file of ROUTE_FILES) {
            expect(readRoute(file), file).toContain('export const prerender = false');
        }
    });
});

describe('commerce editor routes — shared front door', () => {
    it('should resolve auth, ownership and the listing through one resolver', () => {
        // The auth guard, the commerce-access gate, the vertical check, the id
        // check, the load and the ownership check live in one place precisely so
        // a new route cannot forget one of them. The pre-split page was the only
        // page, so nothing enforced this.
        for (const file of ROUTE_FILES) {
            expect(readRoute(file), file).toContain('resolveCommerceEditorPage');
        }
    });

    it('should return the resolver redirect on every route', () => {
        for (const file of ROUTE_FILES) {
            expect(readRoute(file), file).toMatch(
                /if \(resolution\.redirect\) return resolution\.redirect/
            );
        }
    });

    it('should not call fetch() directly in any route', () => {
        // The pre-split page did, in violation of apps/web's own rule. Copying
        // that into ten pages is exactly what the shared loader prevents.
        for (const file of ROUTE_FILES) {
            expect(readRoute(file), `${file} calls fetch() directly`).not.toMatch(/\bfetch\(/);
        }
    });

    it('should declare the section slug it renders, matching its filename', () => {
        // The slug the resolver is told decides which nav item is marked active
        // and what the last breadcrumb says. A page whose declared slug does not
        // match its filename highlights someone else's nav item.
        for (const file of ROUTE_FILES) {
            if (file === 'index.astro') {
                expect(readRoute(file), file).toContain('sectionSlug: null');
                continue;
            }

            const slug = file.replace(/\.astro$/, '');
            expect(readRoute(file), file).toContain(`sectionSlug: '${slug}'`);
            expect(readRoute(file), file).toContain(`currentSectionSlug="${slug}"`);
        }
    });
});

describe('commerce editor routes — the hub never redirects', () => {
    it('should not redirect the hub to a section', () => {
        // A redirect here traps the back button: section → hub → forward again
        // (HOS-318 D-8, and the reason the accommodation hub is a real page).
        const code = readRoute('index.astro')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

        for (const section of ALL_SECTIONS) {
            expect(code, `hub redirects to ${section.slug}`).not.toContain(
                `Astro.redirect('${section.slug}`
            );
        }
    });

    it('should render the hub list component', () => {
        expect(readRoute('index.astro')).toContain('EditorHub');
    });
});

describe('commerce editor routes — section isolation', () => {
    it('should mount each self-persisting component on exactly one route', () => {
        for (const [component, owner] of Object.entries(SECTION_COMPONENTS)) {
            // Both import shapes: `EditorHub` is an `.astro` default import,
            // the two islands are named ones. Matching only the braced form
            // would report zero importers for the hub and read as a pass.
            const importers = ROUTE_FILES.filter((file) =>
                new RegExp(`import\\s+(?:\\{[^}]*\\b)?${component}\\b`).test(readRoute(file))
            );

            expect(
                importers,
                `${component} should be imported only by ${owner}, but is imported by: ${importers.join(', ')}`
            ).toEqual([owner]);
        }
    });

    it('should give each form route the section id it declares in its slug', () => {
        // The `sectionId` prop decides what the island renders AND which PATCH
        // keys the save may carry. A page whose id disagrees with its route
        // renders one section and saves for another.
        const bySlug = new Map(ALL_SECTIONS.map((section) => [section.slug, section.id]));

        for (const file of ROUTE_FILES) {
            const source = readRoute(file);
            if (!source.includes('<CommerceListingEditor')) continue;

            const slug = file.replace(/\.astro$/, '');
            expect(source, file).toContain(`sectionId="${bySlug.get(slug)}"`);
        }
    });

    it('should request the amenity catalog on the services route only', () => {
        for (const file of ROUTE_FILES) {
            const wantsCatalog = readRoute(file).includes("'catalog'");

            expect(wantsCatalog, `${file} requests the catalog`).toBe(file === 'servicios.astro');
        }
    });

    it('should request the destination catalog on the basic-info route only', () => {
        for (const file of ROUTE_FILES) {
            const wantsDestinations = readRoute(file).includes("'destinations'");

            expect(wantsDestinations, `${file} requests destinations`).toBe(file === 'datos.astro');
        }
    });
});

describe('commerce editor routes — the E2E suite points at routes that exist', () => {
    /**
     * The section slugs `apps/e2e` names, read out of its own source.
     *
     * The E2E package cannot import this registry — it resolves `@repo/*` to
     * built dist and knows nothing about `apps/web/src` — so the two spell the
     * slugs independently and nothing but a full browser run connects them.
     * That gap is not theoretical: HOS-1080 shipped with all six commerce specs
     * still opening `…/editar/`, which had become the form-less hub, and the
     * only thing that reported it was a red E2E shard.
     */
    const E2E_HELPERS = readFileSync(
        resolve(__dirname, '../../../e2e/fixtures/commerce-editor-helpers.ts'),
        'utf8'
    );

    /** The `CommerceEditorSection` union members, minus the `hub` sentinel. */
    function e2eSectionSlugs(): readonly string[] {
        const union = E2E_HELPERS.match(/export type CommerceEditorSection =([\s\S]*?);/)?.[1];
        if (!union) throw new Error('CommerceEditorSection union not found in the E2E helpers');

        return [...union.matchAll(/'([a-z0-9-]+)'/g)]
            .map((match) => match[1])
            .filter((slug): slug is string => Boolean(slug) && slug !== 'hub');
    }

    it('should have parsed the real union, not an empty match', () => {
        // The scan is a regex over source; without this every assertion below
        // would pass vacuously over an empty list.
        expect(e2eSectionSlugs().length).toBe(ALL_SECTIONS.length);
    });

    it('should give every slug the E2E suite names a route file', () => {
        for (const slug of e2eSectionSlugs()) {
            expect(ROUTE_FILES, `the E2E suite opens "${slug}" and no route renders it`).toContain(
                `${slug}.astro`
            );
        }
    });

    it('should have an E2E slug for every section the registry declares', () => {
        // The other direction: a section the E2E cannot name is a page no
        // browser test can ever reach.
        const e2e = new Set(e2eSectionSlugs());

        for (const section of ALL_SECTIONS) {
            expect(
                e2e.has(section.slug),
                `"${section.slug}" is a real section the E2E suite cannot address`
            ).toBe(true);
        }
    });

    it('should keep the E2E hydration gate off the hub, which renders no form', () => {
        // The gate waits on the editor island's `data-hydrated` form. The hub
        // mounts no island at all, so a spec that gates there waits out its
        // full timeout — which is exactly how the six failures read.
        expect(E2E_HELPERS).toContain('form[data-hydrated="true"]');
        expect(readRoute('index.astro')).not.toContain('<CommerceListingEditor');
    });
});

describe('commerce editor routes — preserved behaviours', () => {
    it('should preload FAQs on the questions route so the manager paints real data', () => {
        const source = readRoute('preguntas.astro');

        expect(source).toContain('readCommerceListingFaqs');
        expect(source).toContain('initialFaqs={initialFaqs}');
    });

    it('should state the address rule where the name is edited, and nowhere else', () => {
        // HOS-834: the notice describes what renaming does to the URL, so it
        // belongs on the page that can rename. A page that cannot has nothing
        // to say about it.
        for (const file of ROUTE_FILES) {
            const mentions = readRoute(file).includes('slugFollowsNameNotice');

            expect(mentions, `${file} states the address rule`).toBe(file === 'datos.astro');
        }
    });

    it('should render no bespoke h1 on any route', () => {
        // `AccountPageHeader`, reached through the shell, owns that role; a
        // second one would give the page two top-level headings.
        for (const file of ROUTE_FILES) {
            expect(readRoute(file), `${file} renders its own <h1>`).not.toMatch(/<h1[\s>]/);
        }
    });

    it('should not reintroduce the public-site section wrapper', () => {
        // `.section` carries `padding-block: var(--space-section)` — 120px, the
        // public-site rhythm — and pushes every account page down the viewport.
        for (const file of ROUTE_FILES) {
            expect(readRoute(file), `${file} reintroduces the .section wrapper`).not.toMatch(
                /class="section"/
            );
        }
    });
});
