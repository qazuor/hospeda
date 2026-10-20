/**
 * @file gastronomy-editor-sections.test.ts
 * @description Guards the gastronomy editor's section registry (HOS-1080,
 * HOS-895, HOS-1041, HOS-1042).
 *
 * The registry is the single source the nav, the hub and the breadcrumbs all
 * read, so a mistake here is a mistake on three surfaces at once. The one that
 * matters most is the vertical split: a section a restaurant has no fields for
 * must not merely be hidden from its nav, it must not exist for it, or the
 * route stays reachable by typing the URL.
 */

import { describe, expect, it } from 'vitest';
import { buildEditorHubUrl, findEditorSectionBySlug } from '@/lib/editor/editor-registry';
import { buildExperienceEditorSections } from '@/lib/editor/experience-editor-sections';
import {
    buildGastronomyEditorRegistry,
    buildGastronomyEditorSections
} from '@/lib/editor/gastronomy-editor-sections';
import {
    LISTING_EDITOR_GROUP_LABEL_KEYS,
    LISTING_EDITOR_SECTION_GROUPS
} from '@/lib/editor/listing-editor-sections';

const gastronomy = buildGastronomyEditorSections();
const experience = buildExperienceEditorSections();

describe('buildGastronomyEditorSections: the vertical split', () => {
    it('should give a restaurant NEITHER of the experience-only sections', () => {
        // Not "hidden": absent. `findEditorSectionBySlug` then misses, and the
        // resolver's unknown-slug branch redirects to the hub, which stops a
        // typed URL from rendering a page whose every field the API strips.
        expect(gastronomy.map((section) => section.id)).not.toContain('meetingPoint');
        expect(gastronomy.map((section) => section.id)).not.toContain('practicalInfo');
    });

    it('should make the experience-only slugs unresolvable on a gastronomy registry', () => {
        const registry = buildGastronomyEditorRegistry();

        expect(findEditorSectionBySlug({ registry, slug: 'punto-de-encuentro' })).toBeUndefined();
        expect(findEditorSectionBySlug({ registry, slug: 'datos-practicos' })).toBeUndefined();
    });

    it('should give a restaurant the three sections only it has', () => {
        expect(gastronomy.map((section) => section.id)).toContain('menu');
        expect(gastronomy.map((section) => section.id)).toContain('dailySpecials');
        expect(gastronomy.map((section) => section.id)).toContain('venueEvents');
    });

    it('should differ from the experience list by exactly the three gastronomy-only sections', () => {
        const extra = gastronomy
            .map((section) => section.id)
            .filter((id) => !experience.some((section) => section.id === id));

        // Asserted as an exact list rather than N `toContain`s so a FOURTH cannot
        // be added without this failing and someone deciding whether an
        // experience should have it.
        expect(extra).toEqual(['menu', 'dailySpecials', 'venueEvents']);
    });

    it('should place the gastronomy-only run in order, ending at the FAQ page', () => {
        const ids = gastronomy.map((section) => section.id);

        expect(ids.indexOf('menu')).toBe(ids.indexOf('dailySpecials') - 1);
        expect(ids.indexOf('dailySpecials')).toBe(ids.indexOf('venueEvents') - 1);
        expect(ids.indexOf('venueEvents')).toBe(ids.indexOf('faqs') - 1);
    });

    it('should resolve the menú-del-día slug on a gastronomy registry', () => {
        const registry = buildGastronomyEditorRegistry();

        expect(findEditorSectionBySlug({ registry, slug: 'menu-del-dia' })?.id).toBe(
            'dailySpecials'
        );
    });
});

describe('buildGastronomyEditorSections: registry shape', () => {
    it('should give every section a distinct id and a distinct slug', () => {
        expect(new Set(gastronomy.map((section) => section.id)).size).toBe(gastronomy.length);
        expect(new Set(gastronomy.map((section) => section.slug)).size).toBe(gastronomy.length);
    });

    it('should give every section an i18n label key, never a literal', () => {
        for (const section of gastronomy) {
            expect(section.labelKey).toMatch(/^listing\.owner\.editor\./);
        }
    });

    it('should use URL-safe, lowercase slugs', () => {
        for (const section of gastronomy) {
            expect(section.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        }
    });

    it('should put every section in a declared group', () => {
        for (const section of gastronomy) {
            expect(LISTING_EDITOR_SECTION_GROUPS).toContain(section.group);
        }
    });

    it('should label every declared group', () => {
        for (const group of LISTING_EDITOR_SECTION_GROUPS) {
            expect(LISTING_EDITOR_GROUP_LABEL_KEYS[group]).toMatch(
                /^listing\.owner\.editor\.group\./
            );
        }
    });

    it('should carry no runtime visibility key', () => {
        for (const section of gastronomy) {
            expect(section.visibilityKey).toBeUndefined();
        }
    });
});

describe('buildGastronomyEditorRegistry: paths', () => {
    it('should put the hub under the gastronomy vertical', () => {
        expect(
            buildEditorHubUrl({
                locale: 'es',
                registry: buildGastronomyEditorRegistry(),
                entityId: 'abc'
            })
        ).toBe('/es/mi-cuenta/comercio/gastronomy/abc/editar/');
    });

    it('should point the breadcrumb index at the owner listing page', () => {
        expect(buildGastronomyEditorRegistry().indexPath).toBe('mi-cuenta/comercio');
    });
});
