/**
 * @file editor-registry.test.ts
 * @description Guards the vertical-agnostic core of the section registry
 * (HOS-1080).
 *
 * The accommodation and commerce registries each have their own suite; this one
 * pins the behaviour they share, against a fixture registry rather than a real
 * one. That matters for the visibility rules in particular: the live registries
 * have at most one conditional section between them, so asserting fail-closed
 * against them would be asserting a coincidence.
 */

import { describe, expect, it } from 'vitest';
import {
    buildEditorHubUrl,
    buildEditorSectionPath,
    buildEditorSectionUrl,
    type EditorRegistry,
    type EditorSection,
    findEditorSectionBySlug,
    getVisibleEditorSections,
    isEditorSectionVisible
} from '@/lib/editor/editor-registry';

const ALWAYS: EditorSection = {
    id: 'always',
    slug: 'siempre',
    group: 'property',
    labelKey: 'fixture.always'
};

const CONDITIONAL: EditorSection = {
    id: 'conditional',
    slug: 'condicional',
    group: 'content',
    labelKey: 'fixture.conditional',
    visibilityKey: 'hasThing'
};

const REGISTRY: EditorRegistry = {
    id: 'fixture',
    sections: [ALWAYS, CONDITIONAL],
    groups: ['property', 'content', 'management'],
    groupLabelKeys: {
        property: 'fixture.group.property',
        content: 'fixture.group.content',
        management: 'fixture.group.management'
    },
    indexPath: 'mi-cuenta/cosas',
    indexLabelKey: 'fixture.index',
    buildHubPath: ({ entityId }) => `mi-cuenta/cosas/${entityId}/editar`
};

describe('findEditorSectionBySlug', () => {
    it('should find a section by its slug', () => {
        expect(findEditorSectionBySlug({ registry: REGISTRY, slug: 'condicional' })).toBe(
            CONDITIONAL
        );
    });

    it('should return undefined for a slug the registry does not have', () => {
        // The resolver turns this into a redirect to the hub, which is what
        // stops a route file from rendering a page claiming to be a section
        // that does not exist for this vertical.
        expect(findEditorSectionBySlug({ registry: REGISTRY, slug: 'inventado' })).toBeUndefined();
    });

    it('should not match on the section id by mistake', () => {
        // The two vocabularies are deliberately different (`id` is the React
        // key and the guard's name, `slug` is the URL segment). Matching either
        // would make `…/editar/conditional` resolve as well as
        // `…/editar/condicional`, and one of those is not a route.
        expect(
            findEditorSectionBySlug({ registry: REGISTRY, slug: 'conditional' })
        ).toBeUndefined();
    });
});

describe('isEditorSectionVisible', () => {
    it('should show a section with no visibility key regardless of the map', () => {
        expect(isEditorSectionVisible({ section: ALWAYS, visibility: {} })).toBe(true);
    });

    it('should show a conditional section when its key is true', () => {
        expect(
            isEditorSectionVisible({ section: CONDITIONAL, visibility: { hasThing: true } })
        ).toBe(true);
    });

    it('should hide a conditional section when its key is false', () => {
        expect(
            isEditorSectionVisible({ section: CONDITIONAL, visibility: { hasThing: false } })
        ).toBe(false);
    });

    it('should FAIL CLOSED when the key is absent from the map', () => {
        // The dangerous direction is showing a link the page cannot honour: the
        // nav item leads somewhere that renders an empty shell, and the owner
        // has no way to tell that from a broken page. A missing answer is
        // therefore "no", never "probably yes".
        expect(isEditorSectionVisible({ section: CONDITIONAL, visibility: {} })).toBe(false);
    });
});

describe('getVisibleEditorSections', () => {
    it('should keep registry order', () => {
        const visible = getVisibleEditorSections({
            registry: REGISTRY,
            visibility: { hasThing: true }
        });

        expect(visible.map((section) => section.id)).toEqual(['always', 'conditional']);
    });

    it('should drop only the section whose condition fails', () => {
        const visible = getVisibleEditorSections({ registry: REGISTRY, visibility: {} });

        expect(visible.map((section) => section.id)).toEqual(['always']);
    });
});

describe('URL builders', () => {
    it('should build a section path from the registry, with no locale', () => {
        expect(
            buildEditorSectionPath({ registry: REGISTRY, entityId: 'e-1', section: CONDITIONAL })
        ).toBe('mi-cuenta/cosas/e-1/editar/condicional');
    });

    it('should build a locale-prefixed, trailing-slashed section URL', () => {
        expect(
            buildEditorSectionUrl({
                locale: 'pt',
                registry: REGISTRY,
                entityId: 'e-1',
                section: CONDITIONAL
            })
        ).toBe('/pt/mi-cuenta/cosas/e-1/editar/condicional/');
    });

    it('should build the hub URL from the same base as the sections', () => {
        // The two must not be written twice: a hub at one path and sections at
        // another is how a breadcrumb ends up linking somewhere that 404s.
        const hub = buildEditorHubUrl({ locale: 'es', registry: REGISTRY, entityId: 'e-1' });
        const section = buildEditorSectionUrl({
            locale: 'es',
            registry: REGISTRY,
            entityId: 'e-1',
            section: ALWAYS
        });

        expect(hub).toBe('/es/mi-cuenta/cosas/e-1/editar/');
        expect(section.startsWith(hub)).toBe(true);
    });
});
