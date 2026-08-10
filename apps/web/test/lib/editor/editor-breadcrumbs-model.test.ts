/**
 * @file editor-breadcrumbs-model.test.ts
 * @description Guards the editor's breadcrumb input (HOS-318 T-009).
 *
 * Rendering belongs to the shared `Breadcrumbs.astro`; this only builds the
 * items it consumes. That component drops the LAST item (it is the page's own
 * `<h1>`) and prepends "Inicio", so what these tests pin is the full trail — the
 * visible result is one item shorter by design.
 */

import { describe, expect, it } from 'vitest';
import { buildEditorBreadcrumbItems } from '@/lib/editor/editor-breadcrumbs-model';

/** Builds a trail with defaults for the case under test. */
function build(currentSectionSlug: string | null, sectionLabel = 'Fotos') {
    return buildEditorBreadcrumbItems({
        accommodationId: 'acc-uuid',
        accommodationName: 'Casa del Sol',
        currentSectionSlug,
        propertiesLabel: 'Mis propiedades',
        sectionLabel
    });
}

describe('buildEditorBreadcrumbItems — hub', () => {
    it('should end at the accommodation, which is the hub page itself', () => {
        const items = build(null);

        expect(items).toHaveLength(2);
        expect(items[1]?.label).toBe('Casa del Sol');
    });

    it('should not give the last item a path (it is the current page)', () => {
        // A path here would render the current page as a link to itself once
        // the shared component stops dropping it.
        expect(build(null)[1]?.path).toBeUndefined();
    });

    it('should link the properties level', () => {
        expect(build(null)[0]?.path).toBe('mi-cuenta/propiedades');
    });
});

describe('buildEditorBreadcrumbItems — section page', () => {
    it('should render three levels', () => {
        expect(build('fotos')).toHaveLength(3);
    });

    it('should put the section last, with no path', () => {
        const items = build('fotos', 'Fotos');

        expect(items[2]?.label).toBe('Fotos');
        expect(items[2]?.path).toBeUndefined();
    });

    it('should turn the accommodation into a link back to the hub', () => {
        expect(build('fotos')[1]?.path).toBe('mi-cuenta/propiedades/acc-uuid/editar');
    });

    it('should use the section label the caller resolved', () => {
        // The label comes from the page title, already translated — this module
        // never touches i18n.
        expect(build('calendario', 'Calendario')[2]?.label).toBe('Calendario');
    });

    it('should never give the last item a path, for any section', () => {
        for (const slug of ['fotos', 'calendario', 'datos', 'contacto']) {
            const items = build(slug);

            expect(items[items.length - 1]?.path, `slug ${slug}`).toBeUndefined();
        }
    });
});

describe('buildEditorBreadcrumbItems — paths are relative', () => {
    it('should not embed a locale prefix (buildUrl adds it downstream)', () => {
        // A path starting with `/es/` would be double-prefixed into
        // `/es/es/mi-cuenta/...` by the shared component's buildUrl call.
        for (const item of build('fotos')) {
            if (item.path) expect(item.path.startsWith('/')).toBe(false);
        }
    });
});
