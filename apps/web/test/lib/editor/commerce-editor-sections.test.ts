/**
 * @file commerce-editor-sections.test.ts
 * @description Guards the commerce editor's section registry (HOS-1080).
 *
 * The registry is the single source the nav, the hub and the breadcrumbs all
 * read, so a mistake here is a mistake on three surfaces at once — and the one
 * that matters most is the vertical split: a section a restaurant has no fields
 * for must not merely be hidden from its nav, it must not exist for it, or the
 * route stays reachable by typing the URL.
 */

import { describe, expect, it } from 'vitest';
import {
    buildCommerceEditorRegistry,
    buildCommerceEditorSections,
    COMMERCE_EDITOR_GROUP_LABEL_KEYS,
    COMMERCE_EDITOR_SECTION_GROUPS
} from '@/lib/editor/commerce-editor-sections';
import { buildEditorHubUrl, findEditorSectionBySlug } from '@/lib/editor/editor-registry';

const gastronomy = buildCommerceEditorSections({ vertical: 'gastronomy' });
const experience = buildCommerceEditorSections({ vertical: 'experience' });

describe('buildCommerceEditorSections — the vertical split', () => {
    it('should give an experience the two sections only it has', () => {
        expect(experience.map((section) => section.id)).toContain('meetingPoint');
        expect(experience.map((section) => section.id)).toContain('practicalInfo');
    });

    it('should give a restaurant NEITHER of them', () => {
        // Not "hidden": absent. `findEditorSectionBySlug` then misses, and the
        // resolver's unknown-slug branch redirects to the hub — which is what
        // stops a typed URL from rendering a page whose every field the API
        // silently strips.
        expect(gastronomy.map((section) => section.id)).not.toContain('meetingPoint');
        expect(gastronomy.map((section) => section.id)).not.toContain('practicalInfo');
    });

    it('should make the experience-only slugs unresolvable on a gastronomy registry', () => {
        const registry = buildCommerceEditorRegistry({ vertical: 'gastronomy' });

        expect(findEditorSectionBySlug({ registry, slug: 'punto-de-encuentro' })).toBeUndefined();
        expect(findEditorSectionBySlug({ registry, slug: 'datos-practicos' })).toBeUndefined();
    });

    it('should differ from the gastronomy list by exactly those two sections', () => {
        const extra = experience
            .map((section) => section.id)
            .filter((id) => !gastronomy.some((section) => section.id === id));

        expect(extra).toEqual(['meetingPoint', 'practicalInfo']);
    });

    it('should place them right after basic info', () => {
        const ids = experience.map((section) => section.id);

        expect(ids.indexOf('meetingPoint')).toBe(ids.indexOf('basicInfo') + 1);
        expect(ids.indexOf('practicalInfo')).toBe(ids.indexOf('meetingPoint') + 1);
    });
});

describe('buildCommerceEditorSections — registry shape', () => {
    it('should give every section a distinct id and a distinct slug', () => {
        for (const sections of [gastronomy, experience]) {
            expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length);
            expect(new Set(sections.map((section) => section.slug)).size).toBe(sections.length);
        }
    });

    it('should give every section an i18n label key, never a literal', () => {
        for (const section of experience) {
            expect(section.labelKey).toMatch(/^commerce\.owner\.editor\./);
        }
    });

    it('should use URL-safe, lowercase, Spanish slugs', () => {
        // They are route filenames as well as URL segments; an accent or a
        // capital here is a file that does not match the path Astro serves.
        for (const section of experience) {
            expect(section.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        }
    });

    it('should put every section in a declared group', () => {
        for (const section of experience) {
            expect(COMMERCE_EDITOR_SECTION_GROUPS).toContain(section.group);
        }
    });

    it('should label every declared group', () => {
        for (const group of COMMERCE_EDITOR_SECTION_GROUPS) {
            expect(COMMERCE_EDITOR_GROUP_LABEL_KEYS[group]).toMatch(
                /^commerce\.owner\.editor\.group\./
            );
        }
    });

    it('should leave no group empty', () => {
        // The nav and the hub both drop an empty group, so an empty one is not a
        // rendering bug — it is a declared bucket nothing is ever filed under,
        // which means the declaration is wrong.
        for (const group of COMMERCE_EDITOR_SECTION_GROUPS) {
            expect(
                experience.filter((section) => section.group === group).length,
                `group "${group}" holds no section`
            ).toBeGreaterThan(0);
        }
    });

    it('should carry no runtime visibility key', () => {
        // Deliberate, and worth pinning: answering one on the nav would mean
        // fetching the amenity catalogs on all eleven pages to decide whether to
        // draw one link. The `servicios` route carries the empty-catalog case as
        // a visible notice instead.
        for (const section of experience) {
            expect(section.visibilityKey).toBeUndefined();
        }
    });
});

describe('buildCommerceEditorRegistry — paths', () => {
    it('should put the hub under the listing vertical', () => {
        expect(
            buildEditorHubUrl({
                locale: 'es',
                registry: buildCommerceEditorRegistry({ vertical: 'gastronomy' }),
                entityId: 'abc'
            })
        ).toBe('/es/mi-cuenta/comercio/gastronomy/abc/editar/');

        expect(
            buildEditorHubUrl({
                locale: 'es',
                registry: buildCommerceEditorRegistry({ vertical: 'experience' }),
                entityId: 'abc'
            })
        ).toBe('/es/mi-cuenta/comercio/experience/abc/editar/');
    });

    it('should point the breadcrumb index at the owner listing page', () => {
        expect(buildCommerceEditorRegistry({ vertical: 'gastronomy' }).indexPath).toBe(
            'mi-cuenta/comercio'
        );
    });
});
