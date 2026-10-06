/**
 * @file experience-editor-sections.test.ts
 * @description Guards the experience editor's section registry (HOS-1080).
 *
 * The gastronomy-only sections must not merely be hidden from an experience's
 * nav, they must not exist for it, or the route stays reachable by typing the
 * URL.
 */

import { describe, expect, it } from 'vitest';
import { buildEditorHubUrl, findEditorSectionBySlug } from '@/lib/editor/editor-registry';
import {
    buildExperienceEditorRegistry,
    buildExperienceEditorSections
} from '@/lib/editor/experience-editor-sections';
import { buildGastronomyEditorSections } from '@/lib/editor/gastronomy-editor-sections';
import { buildListingEditorRegistry } from '@/lib/editor/listing-editor-registry';

const gastronomy = buildGastronomyEditorSections();
const experience = buildExperienceEditorSections();

describe('buildExperienceEditorSections: the vertical split', () => {
    it('should give an experience the two sections only it has', () => {
        expect(experience.map((section) => section.id)).toContain('meetingPoint');
        expect(experience.map((section) => section.id)).toContain('practicalInfo');
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

    it('should give an experience NONE of the gastronomy-only sections', () => {
        for (const id of ['menu', 'dailySpecials', 'venueEvents']) {
            expect(experience.map((section) => section.id)).not.toContain(id);
        }
    });

    it('should make the gastronomy-only slugs unresolvable on an experience registry', () => {
        // Absent, not hidden: otherwise the URL stays reachable by typing it and
        // renders a panel whose every write the API refuses.
        const registry = buildExperienceEditorRegistry();

        expect(findEditorSectionBySlug({ registry, slug: 'carta' })).toBeUndefined();
        expect(findEditorSectionBySlug({ registry, slug: 'eventos' })).toBeUndefined();
        expect(findEditorSectionBySlug({ registry, slug: 'menu-del-dia' })).toBeUndefined();
    });
});

describe('buildExperienceEditorRegistry: paths', () => {
    it('should put the hub under the experience vertical', () => {
        expect(
            buildEditorHubUrl({
                locale: 'es',
                registry: buildExperienceEditorRegistry(),
                entityId: 'abc'
            })
        ).toBe('/es/mi-cuenta/comercio/experience/abc/editar/');
    });
});

describe('buildListingEditorRegistry: dispatch by vertical', () => {
    it('should return the registry that matches the vertical', () => {
        expect(buildListingEditorRegistry({ vertical: 'experience' }).sections).toEqual(experience);
        expect(buildListingEditorRegistry({ vertical: 'gastronomy' }).sections).toEqual(gastronomy);
    });
});
