/**
 * Every editor section declares its save model (HOS-2487, spec HOS-2415 §6.2,
 * AC-3). The expected table is the spec's, keyed by slug, with one recorded
 * deviation: the venue/experience translations page is a field of the
 * ListingEditor form, so it saves through the bar.
 */

import { describe, expect, it } from 'vitest';
import { ACCOMMODATION_EDITOR_REGISTRY } from '@/lib/editor/accommodation-editor-sections';
import { EDITOR_SAVE_MODELS, type EditorSaveModel } from '@/lib/editor/editor-registry';
import { buildListingEditorRegistry } from '@/lib/editor/listing-editor-registry';

/** The spec's §6.2 table, by slug. */
const SPEC_SAVE_MODEL_BY_SLUG: Readonly<Record<string, EditorSaveModel>> = {
    datos: 'bar',
    contacto: 'bar',
    ubicacion: 'bar',
    servicios: 'bar',
    'capacidad-precio': 'bar',
    politicas: 'bar',
    seo: 'bar',
    'datos-practicos': 'bar',
    precio: 'bar',
    horarios: 'bar',
    'punto-de-encuentro': 'bar',
    'de-noche': 'bar',
    carta: 'bar',
    'menu-del-dia': 'bar',
    eventos: 'bar',
    fotos: 'auto',
    preguntas: 'auto',
    calendario: 'auto',
    reputacion: 'auto',
    traducciones: 'auto',
    'preguntas-ia': 'auto',
    promociones: 'auto'
};

/** Recorded deviations from the spec table, per vertical. */
const DEVIATIONS: Readonly<Record<string, Readonly<Record<string, EditorSaveModel>>>> = {
    venue: { traducciones: 'bar' },
    experience: { traducciones: 'bar' }
};

const REGISTRIES = [
    ACCOMMODATION_EDITOR_REGISTRY,
    buildListingEditorRegistry({ vertical: 'venue', sectionStates: {} }),
    buildListingEditorRegistry({ vertical: 'experience', sectionStates: {} })
] as const;

describe('editor save models (HOS-2487)', () => {
    it.each(
        REGISTRIES.map((registry) => [registry.id, registry] as const)
    )('%s: every section declares a known save model', (_id, registry) => {
        // Assert
        expect(registry.sections.length).toBeGreaterThan(0);
        for (const section of registry.sections) {
            expect(EDITOR_SAVE_MODELS, section.slug).toContain(section.saveModel);
        }
    });

    it.each(
        REGISTRIES.map((registry) => [registry.id, registry] as const)
    )('%s: every section follows the spec table (or a recorded deviation)', (id, registry) => {
        for (const section of registry.sections) {
            // Arrange
            const expected =
                DEVIATIONS[id]?.[section.slug] ?? SPEC_SAVE_MODEL_BY_SLUG[section.slug];

            // Assert
            expect(expected, `${id}/${section.slug} is missing from the spec table`).toBeDefined();
            expect(section.saveModel, `${id}/${section.slug}`).toBe(expected);
        }
    });
});
