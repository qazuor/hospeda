/**
 * @file experience-editor-sections.test.ts
 * @description Guards the experience editor's section registry (HOS-1080).
 *
 * The venue-only sections must not merely be hidden from an experience's
 * nav, they must not exist for it, or the route stays reachable by typing the
 * URL.
 */

import { describe, expect, it } from 'vitest';
import { buildEditorHubUrl, findEditorSectionBySlug } from '@/lib/editor/editor-registry';
import {
    buildListingEditorRegistry,
    buildListingEditorSections
} from '@/lib/editor/listing-editor-registry';

/** Empty state map: every catalog section is present. */
const sectionStates = {};

const venue = buildListingEditorSections({ vertical: 'venue', sectionStates });
const experience = buildListingEditorSections({ vertical: 'experience', sectionStates });

describe('buildExperienceEditorSections: the vertical split', () => {
    it('should give an experience the two sections only it has', () => {
        expect(experience.map((section) => section.id)).toContain('meetingPoint');
        expect(experience.map((section) => section.id)).toContain('practicalInfo');
    });

    it('should differ from the venue list by exactly those two sections', () => {
        const extra = experience
            .map((section) => section.id)
            .filter((id) => !venue.some((section) => section.id === id));

        expect(extra).toEqual(['meetingPoint', 'practicalInfo']);
    });

    it('should place them right after basic info', () => {
        const ids = experience.map((section) => section.id);

        expect(ids.indexOf('meetingPoint')).toBe(ids.indexOf('basicInfo') + 1);
        expect(ids.indexOf('practicalInfo')).toBe(ids.indexOf('meetingPoint') + 1);
    });

    it('should give an experience NONE of the venue-only sections', () => {
        for (const id of ['menu', 'dailySpecials', 'venueEvents', 'nightInfo']) {
            expect(experience.map((section) => section.id)).not.toContain(id);
        }
    });

    it('should make the venue-only slugs unresolvable on an experience registry', () => {
        // Absent, not hidden: otherwise the URL stays reachable by typing it and
        // renders a panel whose every write the API refuses.
        const registry = buildListingEditorRegistry({ vertical: 'experience', sectionStates });

        expect(findEditorSectionBySlug({ registry, slug: 'carta' })).toBeUndefined();
        expect(findEditorSectionBySlug({ registry, slug: 'eventos' })).toBeUndefined();
        expect(findEditorSectionBySlug({ registry, slug: 'menu-del-dia' })).toBeUndefined();
        expect(findEditorSectionBySlug({ registry, slug: 'de-noche' })).toBeUndefined();
    });
});

describe('buildExperienceEditorRegistry: paths', () => {
    it('should put the hub under the experience vertical', () => {
        expect(
            buildEditorHubUrl({
                locale: 'es',
                registry: buildListingEditorRegistry({ vertical: 'experience', sectionStates }),
                entityId: 'abc'
            })
        ).toBe('/es/mi-cuenta/comercio/experience/abc/editar/');
    });
});

describe('buildListingEditorRegistry: dispatch by vertical', () => {
    it('should return the registry that matches the vertical', () => {
        expect(
            buildListingEditorRegistry({ vertical: 'experience', sectionStates }).sections
        ).toEqual(experience);
        expect(buildListingEditorRegistry({ vertical: 'venue', sectionStates }).sections).toEqual(
            venue
        );
    });
});
