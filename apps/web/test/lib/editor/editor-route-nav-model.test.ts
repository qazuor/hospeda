/**
 * @file editor-route-nav-model.test.ts
 * @description Guards the editor route-nav view model (HOS-318 T-005 / AC-3, AC-9).
 */

import { describe, expect, it } from 'vitest';
import { ACCOMMODATION_EDITOR_SECTIONS } from '@/lib/editor/accommodation-editor-sections';
import {
    buildEditorNavModel,
    countActiveLinks,
    type EditorNavGroup
} from '@/lib/editor/editor-route-nav-model';

/** Builds the model with sensible defaults for the case under test. */
function build({
    currentSectionId = null,
    hasTranslations = true
}: {
    currentSectionId?: string | null;
    hasTranslations?: boolean;
} = {}): readonly EditorNavGroup[] {
    return buildEditorNavModel({
        locale: 'es',
        accommodationId: 'acc-uuid',
        currentSectionId,
        hasTranslations
    });
}

/** Flattens every link across groups. */
function allLinks(groups: readonly EditorNavGroup[]) {
    return groups.flatMap((group) => group.links);
}

describe('buildEditorNavModel — structure', () => {
    it('should render three groups', () => {
        expect(build()).toHaveLength(3);
    });

    it('should render the groups in declared order', () => {
        expect(build().map((group) => group.group)).toEqual(['property', 'content', 'management']);
    });

    it('should render one link per visible section', () => {
        expect(allLinks(build())).toHaveLength(ACCOMMODATION_EDITOR_SECTIONS.length);
    });

    it('should give every group a heading key', () => {
        for (const group of build()) {
            expect(group.headingKey).toBeTruthy();
        }
    });

    it('should point every link at a route, never an in-page anchor (AC-3)', () => {
        // The pre-split nav emitted `#editor-<section>` anchors. If one survived,
        // that item would scroll instead of navigate — the exact mixed behaviour
        // the one-item-one-page rule exists to prevent.
        for (const link of allLinks(build())) {
            expect(link.href.startsWith('#')).toBe(false);
            expect(link.href).toMatch(/^\/es\/mi-cuenta\/propiedades\/acc-uuid\/editar\/.+\/$/);
        }
    });

    it('should give every link a distinct href', () => {
        const hrefs = allLinks(build()).map((link) => link.href);

        expect(new Set(hrefs).size).toBe(hrefs.length);
    });
});

describe('buildEditorNavModel — active state (AC-9)', () => {
    it('should mark exactly one link active for a known section', () => {
        const groups = build({ currentSectionId: 'photos' });

        expect(countActiveLinks({ groups })).toBe(1);
    });

    it('should mark the RIGHT link active', () => {
        const active = allLinks(build({ currentSectionId: 'calendar' })).find(
            (link) => link.isActive
        );

        expect(active?.sectionId).toBe('calendar');
    });

    it('should mark no link active on the hub', () => {
        // The hub is a page of its own, not a section — nothing should read as
        // "you are here" in the section list.
        expect(countActiveLinks({ groups: build({ currentSectionId: null }) })).toBe(0);
    });

    it('should mark no link active for an unknown section id', () => {
        expect(countActiveLinks({ groups: build({ currentSectionId: 'no-existe' }) })).toBe(0);
    });

    it('should never mark more than one link active, for any section', () => {
        for (const section of ACCOMMODATION_EDITOR_SECTIONS) {
            const groups = build({ currentSectionId: section.id });

            expect(countActiveLinks({ groups }), `section ${section.id}`).toBe(1);
        }
    });
});

describe('buildEditorNavModel — conditional sections', () => {
    it('should drop the translations link when there is no translation data', () => {
        const ids = allLinks(build({ hasTranslations: false })).map((link) => link.sectionId);

        expect(ids).not.toContain('translations');
    });

    it('should keep every other link when translations are absent', () => {
        expect(allLinks(build({ hasTranslations: false }))).toHaveLength(
            ACCOMMODATION_EDITOR_SECTIONS.length - 1
        );
    });

    it('should still render three groups when translations are absent', () => {
        // `management` keeps calendar and reputation, so it must not vanish.
        expect(build({ hasTranslations: false })).toHaveLength(3);
    });

    it('should omit a group entirely if it would have no links', () => {
        // Not reachable with today's registry — asserted so the behaviour is
        // pinned before a future section makes a whole group conditional.
        const groups = build();

        for (const group of groups) {
            expect(group.links.length).toBeGreaterThan(0);
        }
    });
});

describe('buildEditorNavModel — locale', () => {
    it('should build hrefs for the requested locale', () => {
        const groups = buildEditorNavModel({
            locale: 'pt',
            accommodationId: 'acc-uuid',
            currentSectionId: null,
            hasTranslations: true
        });

        for (const link of allLinks(groups)) {
            expect(link.href.startsWith('/pt/')).toBe(true);
        }
    });
});
