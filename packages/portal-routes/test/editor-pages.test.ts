/**
 * HOS-2410 (owner decision on PR-3 deviation 4): the editor pages that are not
 * catalog sections (`EDITOR_NON_SECTION_PAGE_SLUGS`) are reachable through a
 * `listingEditor` destination, and each one is a real page of `apps/web` that
 * the web's own editor registry lists.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildPortalUrl,
    EDITOR_NON_SECTION_PAGE_SLUGS,
    EDITOR_SECTION_SLUGS,
    editorSlugOf,
    portalDestinationTemplate
} from '../src/index';

const SITE = 'https://hospeda.test';
const WEB = path.resolve(import.meta.dirname, '../../../apps/web');

/** The web file whose registry adds each vertical's non-section pages. */
const WEB_REGISTRY = {
    accommodation: 'src/lib/editor/accommodation-editor-sections.ts',
    venue: 'src/lib/editor/listing-editor-registry.ts',
    experience: 'src/lib/editor/listing-editor-registry.ts'
} as const;

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

    it('matches a `slug:` of the web editor registry and a page file, per vertical', () => {
        // Arrange: every (vertical, page) of the list, typed (the first test pins the list).
        const cases = [
            ['accommodation', 'policies'],
            ['accommodation', 'aiQuestions'],
            ['venue', 'aiQuestions'],
            ['experience', 'aiQuestions']
        ] as const;

        for (const [vertical, section] of cases) {
            // Act
            const source = readFileSync(path.join(WEB, WEB_REGISTRY[vertical]), 'utf8');
            const template = portalDestinationTemplate({
                destination: { kind: 'listingEditor', vertical, id: 'x', section }
            });
            const file = path.join(WEB, 'src/pages/[lang]', `${template}.astro`);

            // Assert
            expect(source, `${vertical}/${section}`).toContain(
                `slug: '${editorSlugOf({ vertical, section })}'`
            );
            expect(existsSync(file) && statSync(file).isFile(), file).toBe(true);
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
