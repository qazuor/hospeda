/**
 * HOS-2410 (owner decision on PR-3 deviation 4): the editor pages that are not
 * catalog sections (`EDITOR_NON_SECTION_PAGE_SLUGS`) are reachable through a
 * `listingEditor` destination, and each one is a real page of `apps/web`,
 * checked per vertical against that vertical's own editor folder.
 *
 * The reverse (a web editor page missing from the lists) is predicate (b2) of
 * `scripts/check-portal-routes.ts`, which lists the editor folders.
 */
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildPortalUrl,
    EDITOR_NON_SECTION_PAGE_SLUGS,
    EDITOR_SECTION_SLUGS,
    EDITOR_SECTION_TEMPLATE_BY_VERTICAL,
    editorSlugOf,
    PORTAL_ROUTE_TEMPLATES,
    PORTAL_SECTION_PLACEHOLDER
} from '../src/index';

const SITE = 'https://hospeda.test';
const WEB = path.resolve(import.meta.dirname, '../../../apps/web');

describe('EDITOR_NON_SECTION_PAGE_SLUGS', () => {
    it('holds politicas for accommodation and preguntas-ia for every vertical', () => {
        expect(EDITOR_NON_SECTION_PAGE_SLUGS).toEqual({
            accommodation: { policies: 'politicas', aiQuestions: 'preguntas-ia' },
            venue: { aiQuestions: 'preguntas-ia' },
            experience: { aiQuestions: 'preguntas-ia' }
        });
    });

    it('never repeats an id or a slug of the catalog sections of the same vertical', () => {
        for (const vertical of ['accommodation', 'venue', 'experience'] as const) {
            const sections: Readonly<Record<string, string>> = EDITOR_SECTION_SLUGS[vertical];
            for (const [id, slug] of Object.entries(EDITOR_NON_SECTION_PAGE_SLUGS[vertical])) {
                expect(Object.hasOwn(sections, id), `${vertical}/${id}`).toBe(false);
                expect(Object.values(sections), `${vertical}/${slug}`).not.toContain(slug);
            }
        }
    });

    it.each([
        'accommodation',
        'venue',
        'experience'
    ] as const)('%s keeps its own «Preguntas a la IA» entry, and every page it lists is a file under its own editor folder', (vertical) => {
        // Arrange: the vertical's own entries and its own section template, nothing shared.
        const entries = Object.entries(EDITOR_NON_SECTION_PAGE_SLUGS[vertical]);
        const template = PORTAL_ROUTE_TEMPLATES[EDITOR_SECTION_TEMPLATE_BY_VERTICAL[vertical]];

        // Assert
        expect(EDITOR_NON_SECTION_PAGE_SLUGS[vertical]).toHaveProperty(
            'aiQuestions',
            'preguntas-ia'
        );
        for (const [id, slug] of entries) {
            const file = path.join(
                WEB,
                'src/pages/[lang]',
                `${template.replace(PORTAL_SECTION_PLACEHOLDER, slug)}.astro`
            );
            expect(existsSync(file) && statSync(file).isFile(), `${vertical}/${id}: ${file}`).toBe(
                true
            );
        }
    });
});

describe('a listingEditor destination naming a non-section page', () => {
    it('links the accommodation «Políticas» page', () => {
        expect(
            buildPortalUrl({
                destination: {
                    kind: 'listingEditor',
                    vertical: 'accommodation',
                    id: 'a1',
                    section: 'policies'
                },
                siteUrl: SITE
            })
        ).toBe(`${SITE}/es/mi-cuenta/propiedades/a1/editar/politicas/`);
    });

    it('links the venue «Preguntas a la IA» page', () => {
        expect(
            buildPortalUrl({
                destination: {
                    kind: 'listingEditor',
                    vertical: 'venue',
                    id: 'v1',
                    section: 'aiQuestions'
                },
                siteUrl: SITE
            })
        ).toBe(`${SITE}/es/mi-cuenta/comercio/venue/v1/editar/preguntas-ia/`);
    });

    it('falls back to the hub for a page the vertical does not have', () => {
        expect(
            buildPortalUrl({
                destination: {
                    kind: 'listingEditor',
                    vertical: 'venue',
                    id: 'v1',
                    section: 'policies'
                },
                siteUrl: SITE
            })
        ).toBe(`${SITE}/es/mi-cuenta/comercio/venue/v1/editar/`);
    });
});

describe('editorSlugOf', () => {
    it('resolves catalog sections first, then non-section pages, else undefined', () => {
        expect(editorSlugOf({ vertical: 'accommodation', section: 'amenities' })).toBe('servicios');
        expect(editorSlugOf({ vertical: 'accommodation', section: 'policies' })).toBe('politicas');
        expect(editorSlugOf({ vertical: 'experience', section: 'aiQuestions' })).toBe(
            'preguntas-ia'
        );
        expect(editorSlugOf({ vertical: 'experience', section: 'policies' })).toBeUndefined();
    });
});
