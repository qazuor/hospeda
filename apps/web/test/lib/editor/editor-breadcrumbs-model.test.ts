/**
 * @file editor-breadcrumbs-model.test.ts
 * @description Guards the editor breadcrumb trail (HOS-318 T-009).
 */

import { describe, expect, it } from 'vitest';
import { ACCOMMODATION_EDITOR_SECTIONS } from '@/lib/editor/accommodation-editor-sections';
import { buildEditorBreadcrumbs } from '@/lib/editor/editor-breadcrumbs-model';

/** Builds a trail with defaults for the case under test. */
function build(currentSectionSlug: string | null) {
    return buildEditorBreadcrumbs({
        locale: 'es',
        accommodationId: 'acc-uuid',
        accommodationName: 'Casa del Sol',
        currentSectionSlug
    });
}

describe('buildEditorBreadcrumbs — hub', () => {
    it('should render two crumbs', () => {
        expect(build(null)).toHaveLength(2);
    });

    it('should make the accommodation the current crumb', () => {
        const crumbs = build(null);

        expect(crumbs[1]?.isCurrent).toBe(true);
        expect(crumbs[1]?.label).toBe('Casa del Sol');
    });

    it('should not link the current crumb to itself', () => {
        expect(build(null)[1]?.href).toBeNull();
    });

    it('should link back to the properties list', () => {
        expect(build(null)[0]?.href).toBe('/es/mi-cuenta/propiedades/');
    });
});

describe('buildEditorBreadcrumbs — section page', () => {
    it('should render three crumbs', () => {
        expect(build('fotos')).toHaveLength(3);
    });

    it('should make the section the current crumb', () => {
        const crumbs = build('fotos');

        expect(crumbs[2]?.isCurrent).toBe(true);
        expect(crumbs[2]?.href).toBeNull();
    });

    it('should turn the accommodation crumb into a link back to the hub', () => {
        const crumbs = build('fotos');

        expect(crumbs[1]?.isCurrent).toBe(false);
        expect(crumbs[1]?.href).toBe('/es/mi-cuenta/propiedades/acc-uuid/editar/');
    });

    it('should mark exactly one crumb as current, for every section', () => {
        for (const section of ACCOMMODATION_EDITOR_SECTIONS) {
            const current = build(section.slug).filter((crumb) => crumb.isCurrent);

            expect(current, `section ${section.slug}`).toHaveLength(1);
        }
    });

    it('should label the last crumb with the section label key', () => {
        for (const section of ACCOMMODATION_EDITOR_SECTIONS) {
            const crumbs = build(section.slug);

            expect(crumbs[2]?.labelKey, `section ${section.slug}`).toBe(section.labelKey);
        }
    });
});

describe('buildEditorBreadcrumbs — robustness', () => {
    it('should degrade to the hub trail for an unknown slug', () => {
        // A bad URL segment must not produce a crumb naming a section that does
        // not exist.
        const crumbs = build('no-existe');

        expect(crumbs).toHaveLength(2);
        expect(crumbs[1]?.isCurrent).toBe(true);
    });

    it('should give every crumb exactly one of label or labelKey', () => {
        for (const crumb of build('calendario')) {
            const hasLabel = crumb.label !== undefined;
            const hasKey = crumb.labelKey !== undefined;

            expect(hasLabel !== hasKey).toBe(true);
        }
    });

    it('should never link the last crumb', () => {
        for (const slug of [null, 'fotos', 'calendario', 'no-existe']) {
            const crumbs = build(slug);

            expect(crumbs[crumbs.length - 1]?.href, `slug ${slug}`).toBeNull();
        }
    });

    it('should honour the locale on every link', () => {
        const crumbs = buildEditorBreadcrumbs({
            locale: 'en',
            accommodationId: 'acc-uuid',
            accommodationName: 'Casa del Sol',
            currentSectionSlug: 'fotos'
        });

        for (const crumb of crumbs) {
            if (crumb.href) expect(crumb.href.startsWith('/en/')).toBe(true);
        }
    });
});
