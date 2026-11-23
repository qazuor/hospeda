/**
 * Tests for the editor switcher model and the nav statuses (HOS-2486).
 */

import { describe, expect, it } from 'vitest';
import { ACCOMMODATION_EDITOR_REGISTRY } from '@/lib/editor/accommodation-editor-sections';
import { buildEditorNavModel, toEditorNavStatus } from '@/lib/editor/editor-route-nav-model';
import { buildEditorSwitcherModel } from '@/lib/editor/editor-switcher-model';

const ID = '11111111-1111-4111-8111-111111111111';

/** Builds the nav groups for one active section. */
function groupsFor(currentSectionId: string | null) {
    return buildEditorNavModel({
        locale: 'es',
        registry: ACCOMMODATION_EDITOR_REGISTRY,
        entityId: ID,
        currentSectionId,
        visibility: { translations: true }
    });
}

describe('buildEditorSwitcherModel', () => {
    it('walks every visible section in nav order', () => {
        // Arrange
        const groups = groupsFor('basicInfo');
        const order = groups.flatMap((group) => group.links.map((link) => link.sectionId));

        // Act
        const model = buildEditorSwitcherModel({ groups });

        // Assert
        expect(model.total).toBe(order.length);
        expect(model.position).toBe(order.indexOf('basicInfo') + 1);
        expect(model.current?.sectionId).toBe('basicInfo');
        expect(model.next?.sectionId).toBe(order[order.indexOf('basicInfo') + 1]);
    });

    it('crosses group boundaries for previous and next', () => {
        const groups = groupsFor(null);
        const firstOfSecondGroup = groups[1]?.links[0]?.sectionId ?? '';
        const lastOfFirstGroup = groups[0]?.links.at(-1)?.sectionId;

        const model = buildEditorSwitcherModel({ groups: groupsFor(firstOfSecondGroup) });

        expect(model.previous?.sectionId).toBe(lastOfFirstGroup);
    });

    it('has no previous on the first section and no next on the last', () => {
        const order = groupsFor(null).flatMap((group) => group.links.map((l) => l.sectionId));

        expect(buildEditorSwitcherModel({ groups: groupsFor(order[0] ?? '') }).previous).toBeNull();
        expect(buildEditorSwitcherModel({ groups: groupsFor(order.at(-1) ?? '') }).next).toBeNull();
    });

    it('on the hub has no position and points next at the first section', () => {
        const groups = groupsFor(null);

        const model = buildEditorSwitcherModel({ groups });

        expect(model.position).toBeNull();
        expect(model.previous).toBeNull();
        expect(model.next?.sectionId).toBe(groups[0]?.links[0]?.sectionId);
    });
});

describe('toEditorNavStatus', () => {
    it.each([
        ['warning', 'incomplete'],
        ['blocking', 'incomplete'],
        ['locked', 'locked'],
        ['neutral', 'complete']
    ] as const)('maps a %s hub line to %s', (tone, expected) => {
        expect(toEditorNavStatus({ status: { labelKey: 'x', tone } })).toBe(expected);
    });

    it('says nothing without a hub line', () => {
        expect(toEditorNavStatus({ status: undefined })).toBeUndefined();
    });

    it('carries the status onto the nav link only when known', () => {
        const groups = buildEditorNavModel({
            locale: 'es',
            registry: ACCOMMODATION_EDITOR_REGISTRY,
            entityId: ID,
            currentSectionId: null,
            statuses: { photos: { labelKey: 'x', tone: 'warning' } }
        });
        const links = groups.flatMap((group) => group.links);

        expect(links.find((link) => link.sectionId === 'photos')?.status).toBe('incomplete');
        expect(links.find((link) => link.sectionId === 'basicInfo')).not.toHaveProperty('status');
    });
});
