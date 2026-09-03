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

    // ── The other direction (HOS-895) ───────────────────────────────────────
    //
    // Until the carta, every vertical-exclusive section belonged to the SAME
    // vertical, so "experience minus gastronomy" doubled as "everything
    // exclusive". `carta` broke that symmetry, and the block above still passes
    // with it — it only ever looks one way. These assert the mirror, which is
    // what fails if someone moves `carta` into `SHARED_SECTIONS` and hands
    // every experience a menu page.

    it('should give a restaurant the one section only it has', () => {
        expect(gastronomy.map((section) => section.id)).toContain('menu');
    });

    it('should give an experience NO carta', () => {
        expect(experience.map((section) => section.id)).not.toContain('menu');
    });

    it('should make the carta slug unresolvable on an experience registry', () => {
        const registry = buildCommerceEditorRegistry({ vertical: 'experience' });

        expect(findEditorSectionBySlug({ registry, slug: 'carta' })).toBeUndefined();
    });

    it('should differ from the experience list by exactly the carta and the menú del día', () => {
        const extra = gastronomy
            .map((section) => section.id)
            .filter((id) => !experience.some((section) => section.id === id));

        // HOS-1041 added the second gastronomy-only section. Asserted as an
        // exact list rather than two `toContain`s so a THIRD one cannot be
        // added to `GASTRONOMY_ONLY_SECTIONS` without this failing and someone
        // deciding whether an experience should have it.
        expect(extra).toEqual(['menu', 'dailySpecials']);
    });

    it('should place the carta next to its structural twin, the FAQ page', () => {
        // Both are self-persisting managers with their own endpoints, mounted
        // bare with no form and no save button. Adjacency is the visible half
        // of that decision.
        //
        // HOS-1041 inserted `dailySpecials` BETWEEN them, so the carta is now
        // two before the FAQs rather than one. The relationship being asserted
        // is unchanged — the carta still leads the gastronomy-only run that
        // ends at the FAQ page.
        const ids = gastronomy.map((section) => section.id);

        expect(ids.indexOf('menu')).toBe(ids.indexOf('dailySpecials') - 1);
        expect(ids.indexOf('dailySpecials')).toBe(ids.indexOf('faqs') - 1);
    });

    // ── The menú del día (HOS-1041) ─────────────────────────────────────────

    it('should give a restaurant the menú del día section', () => {
        expect(gastronomy.map((section) => section.id)).toContain('dailySpecials');
    });

    it('should give an experience NO menú del día', () => {
        expect(experience.map((section) => section.id)).not.toContain('dailySpecials');
    });

    it('should make the menú-del-día slug unresolvable on an experience registry', () => {
        // Absent, not hidden — otherwise `/experience/<id>/editar/menu-del-dia`
        // stays reachable by typing the URL and renders a panel whose every
        // write the API refuses.
        const registry = buildCommerceEditorRegistry({ vertical: 'experience' });

        expect(findEditorSectionBySlug({ registry, slug: 'menu-del-dia' })).toBeUndefined();
    });

    it('should resolve the menú-del-día slug on a gastronomy registry', () => {
        // The positive half: without it, the three assertions above all pass
        // against a registry that lost the section entirely.
        const registry = buildCommerceEditorRegistry({ vertical: 'gastronomy' });

        expect(findEditorSectionBySlug({ registry, slug: 'menu-del-dia' })?.id).toBe(
            'dailySpecials'
        );
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
