/**
 * @file editor-routes.test.ts
 * @description Guards the editor's page routes (HOS-318 T-027 / T-031).
 *
 * Rehomed from `editar-astro.test.ts`, `AccommodationEditor.faq-mount.test.ts`
 * and `AccommodationEditor.featured-mount.test.ts`, which asserted against the
 * single page those three tested. Their assertions survive here, now spread
 * across the eleven routes that replaced it.
 *
 * The last block is the new one and the most valuable: a static guard that no
 * page mounts a section it does not own (AC-7). Without it a future edit could
 * quietly re-import the calendar into another route and undo the weight win with
 * nothing failing.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCOMMODATION_EDITOR_SECTIONS } from '@/lib/editor/accommodation-editor-sections';

const ROUTES_DIR = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/propiedades/[id]/editar');

/** Reads one route file's source. */
function readRoute(file: string): string {
    return readFileSync(resolve(ROUTES_DIR, file), 'utf8');
}

/** Every `.astro` route file in the editor directory. */
const ROUTE_FILES = readdirSync(ROUTES_DIR).filter((file) => file.endsWith('.astro'));

/** Section components that must appear on exactly one route each. */
const SECTION_COMPONENTS: Readonly<Record<string, string>> = {
    PhotoSection: 'fotos.astro',
    VideoSection: 'fotos.astro',
    FaqSection: 'preguntas.astro',
    CalendarSection: 'calendario.astro',
    TranslationPanel: 'traducciones.astro',
    ExternalReputationSection: 'reputacion.astro',
    BasicsForm: 'datos.astro',
    CapacityPricingForm: 'capacidad-precio.astro',
    LocationForm: 'ubicacion.astro',
    ServicesForm: 'servicios.astro',
    ContactForm: 'contacto.astro',
    SeoForm: 'seo.astro'
};

describe('editor routes — one file per section', () => {
    it('should have a route file for every registry section, plus the hub', () => {
        const expected = ACCOMMODATION_EDITOR_SECTIONS.map((section) => `${section.slug}.astro`);

        for (const file of expected) {
            expect(ROUTE_FILES, `missing route file ${file}`).toContain(file);
        }
        expect(ROUTE_FILES).toContain('index.astro');
    });

    it('should have no route file without a matching registry section', () => {
        const known = new Set([
            ...ACCOMMODATION_EDITOR_SECTIONS.map((section) => `${section.slug}.astro`),
            'index.astro'
        ]);

        for (const file of ROUTE_FILES) {
            expect(known, `route file ${file} matches no registry section`).toContain(file);
        }
    });

    it('should render every route through the shared editor layout', () => {
        for (const file of ROUTE_FILES) {
            expect(readRoute(file), `${file} does not use EditorSectionLayout`).toContain(
                'EditorSectionLayout'
            );
        }
    });

    it('should be SSR on every route', () => {
        for (const file of ROUTE_FILES) {
            expect(readRoute(file), file).toContain('export const prerender = false');
        }
    });
});

describe('editor routes — shared front door', () => {
    it('should resolve auth, id and data through resolveEditorPage on every route', () => {
        // The guard, the id check and the load live in one place precisely so a
        // new route cannot forget one of them.
        for (const file of ROUTE_FILES) {
            expect(readRoute(file), file).toContain('resolveEditorPage');
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
});

describe('editor routes — the hub never redirects (D-8)', () => {
    it('should not redirect the hub to a section', () => {
        // A redirect here traps the back button: section → hub → forward again.
        const hub = readRoute('index.astro');
        const code = hub.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

        for (const section of ACCOMMODATION_EDITOR_SECTIONS) {
            expect(code, `hub redirects to ${section.slug}`).not.toContain(
                `Astro.redirect('${section.slug}`
            );
        }
    });

    it('should render the hub list component', () => {
        expect(readRoute('index.astro')).toContain('EditorHub');
    });
});

describe('editor routes — section isolation (AC-7)', () => {
    it('should mount each section component on exactly one route', () => {
        for (const [component, owner] of Object.entries(SECTION_COMPONENTS)) {
            const importers = ROUTE_FILES.filter((file) =>
                new RegExp(`import\\s*\\{[^}]*\\b${component}\\b`).test(readRoute(file))
            );

            expect(
                importers,
                `${component} should be imported only by ${owner}, but is imported by: ${importers.join(', ')}`
            ).toEqual([owner]);
        }
    });

    it('should keep the heaviest components off every other route', () => {
        // The whole weight argument of HOS-318: the calendar, the reputation
        // panel, the FAQ editor and the translation panel are the four biggest
        // components in the editor. Each must load on its own route only.
        const heavy = [
            'CalendarSection',
            'ExternalReputationSection',
            'FaqSection',
            'TranslationPanel'
        ];

        for (const component of heavy) {
            const owner = SECTION_COMPONENTS[component];
            for (const file of ROUTE_FILES) {
                if (file === owner) continue;
                expect(readRoute(file), `${file} pulls in ${component}`).not.toContain(
                    `import { ${component} }`
                );
            }
        }
    });
});

describe('editor pages follow the /mi-cuenta conventions', () => {
    const LAYOUT = readFileSync(
        resolve(__dirname, '../../src/layouts/EditorSectionLayout.astro'),
        'utf8'
    );

    /** Strips comments — an absence claim must be made against code, not prose. */
    function codeOf(source: string): string {
        return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
    }

    it('should NOT wrap content in the public-site section wrapper', () => {
        // `.section` carries `padding-block: var(--space-section)` — 120px, the
        // public-site rhythm. The pre-split editor used it and every editor page
        // started far down the viewport. Account pages render their content
        // directly inside AccountLayout instead.
        expect(codeOf(LAYOUT)).not.toMatch(/class="section"/);
        expect(codeOf(LAYOUT)).not.toMatch(/class="section__container"/);

        for (const file of ROUTE_FILES) {
            expect(
                codeOf(readRoute(file)),
                `${file} reintroduces the .section wrapper`
            ).not.toMatch(/class="section"/);
        }
    });

    it('should have a comment-stripper that actually strips (guard on the guard)', () => {
        // The assertion above is only meaningful if codeOf really drops
        // comments — the layout's own JSDoc explains why it avoids `.section`.
        expect(LAYOUT).toContain('class="section"');
        expect(codeOf(LAYOUT).length).toBeLessThan(LAYOUT.length);
    });

    it('should use the canonical account page header for its single h1', () => {
        expect(LAYOUT).toContain('AccountPageHeader');
    });

    it('should render no bespoke h1 on any route', () => {
        // AccountPageHeader owns that role; a second one would give the page two
        // top-level headings.
        for (const file of ROUTE_FILES) {
            expect(readRoute(file), `${file} renders its own <h1>`).not.toMatch(/<h1[\s>]/);
        }
    });

    it('should use the shared breadcrumbs component, not a bespoke one', () => {
        expect(LAYOUT).toContain("from '@/components/shared/navigation/Breadcrumbs.astro'");
    });
});

describe('editor routes — navigation feel (T-025)', () => {
    it('should inherit View Transitions through the layout chain', () => {
        // Every editor page renders through EditorSectionLayout → AccountLayout
        // → BaseLayout, and BaseLayout mounts ClientRouter. So navigating
        // between sections animates instead of flashing — a hard page swap
        // reads to this editor's audience as "the screen got away from me".
        // Asserted here so a future layout change cannot quietly drop it.
        const base = readFileSync(resolve(__dirname, '../../src/layouts/BaseLayout.astro'), 'utf8');
        const account = readFileSync(
            resolve(__dirname, '../../src/layouts/AccountLayout.astro'),
            'utf8'
        );
        const editor = readFileSync(
            resolve(__dirname, '../../src/layouts/EditorSectionLayout.astro'),
            'utf8'
        );

        expect(base).toContain('<ClientRouter />');
        expect(account).toContain('BaseLayout');
        expect(editor).toContain('AccountLayout');
    });
});

describe('editor routes — preserved behaviours', () => {
    it('should preload FAQs on the questions route (HOS-393 SSR-first)', () => {
        const source = readRoute('preguntas.astro');

        expect(source).toContain("'faqs'");
        expect(source).toContain('initialFaqs={data.faqs}');
    });

    it('should keep the entitlement gate around the calendar', () => {
        const source = readRoute('calendario.astro');

        expect(source).toContain('PlanEntitlementGate');
        expect(source).toContain('can_use_calendar');
    });

    it('should mount the featured toggle on the hub with no nav item (D-10)', () => {
        expect(readRoute('index.astro')).toContain('FeaturedToggleSection');
        expect(ACCOMMODATION_EDITOR_SECTIONS.map((section) => section.id)).not.toContain(
            'featured'
        );
    });

    it('should request the amenity catalog on the services route only', () => {
        for (const file of ROUTE_FILES) {
            const wantsCatalog = readRoute(file).includes("'catalog'");

            expect(wantsCatalog, `${file} requests the catalog`).toBe(file === 'servicios.astro');
        }
    });
});
