/**
 * @file accommodation-editor-sections.test.ts
 * @description Guards the accommodation editor's section registry (HOS-318).
 *
 * The registry is the single source of truth behind the route nav, the hub and
 * the breadcrumbs. These assertions exist so a section cannot be added to one
 * surface and forgotten on the others.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    ACCOMMODATION_EDITOR_SECTIONS,
    buildEditorHubUrl,
    buildEditorSectionUrl,
    EDITOR_SECTION_GROUP_LABEL_KEYS,
    EDITOR_SECTION_GROUPS,
    findEditorSectionBySlug,
    getVisibleEditorSections
} from '@/lib/editor/accommodation-editor-sections';

/**
 * The real `es` dictionary. Asserting the key SHAPE (that it starts with the
 * right prefix) is not enough — an invented key passes that and then renders
 * raw in the UI. These tests resolve every key against the actual JSON.
 */
const HOST_ES = JSON.parse(
    readFileSync(
        resolve(__dirname, '../../../../../packages/i18n/src/locales/es/host.json'),
        'utf8'
    )
) as Record<string, unknown>;

/**
 * Resolves a dotted i18n key against the loaded dictionary.
 *
 * @param key - Full key including the `host.` namespace prefix.
 * @returns The resolved string, or `undefined` when any segment is missing.
 */
function resolveHostKey(key: string): string | undefined {
    // The `host.` prefix names the file itself, so it is not a path segment.
    const path = key.replace(/^host\./, '').split('.');
    let current: unknown = HOST_ES;

    for (const segment of path) {
        if (typeof current !== 'object' || current === null) return undefined;
        current = (current as Record<string, unknown>)[segment];
    }

    return typeof current === 'string' ? current : undefined;
}

describe('ACCOMMODATION_EDITOR_SECTIONS', () => {
    it('should declare exactly the ten sections the spec defines', () => {
        expect(ACCOMMODATION_EDITOR_SECTIONS).toHaveLength(10);
    });

    it('should have a unique slug per section', () => {
        const slugs = ACCOMMODATION_EDITOR_SECTIONS.map((section) => section.slug);

        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('should have a unique id per section', () => {
        const ids = ACCOMMODATION_EDITOR_SECTIONS.map((section) => section.id);

        expect(new Set(ids).size).toBe(ids.length);
    });

    it('should only use groups declared in EDITOR_SECTION_GROUPS', () => {
        const used = ACCOMMODATION_EDITOR_SECTIONS.map((section) => section.group);

        for (const group of used) {
            expect(EDITOR_SECTION_GROUPS).toContain(group);
        }
    });

    it('should have every declared group actually used by at least one section', () => {
        const used = new Set(ACCOMMODATION_EDITOR_SECTIONS.map((section) => section.group));

        for (const group of EDITOR_SECTION_GROUPS) {
            expect(used).toContain(group);
        }
    });

    it('should map every group to a heading i18n key', () => {
        for (const group of EDITOR_SECTION_GROUPS) {
            expect(EDITOR_SECTION_GROUP_LABEL_KEYS[group]).toBeTruthy();
        }
    });

    it('should carry a non-empty label key on every section', () => {
        for (const section of ACCOMMODATION_EDITOR_SECTIONS) {
            expect(section.labelKey).toMatch(/^host\.properties\.editor\./);
        }
    });

    it('should resolve every section label key against the real es dictionary', () => {
        // The prefix assertion above only checks the key's SHAPE. This one is
        // the guard that matters: a key that does not exist renders raw in the
        // nav, the hub and the breadcrumbs at once.
        for (const section of ACCOMMODATION_EDITOR_SECTIONS) {
            expect(
                resolveHostKey(section.labelKey),
                `missing i18n key for section "${section.id}": ${section.labelKey}`
            ).toBeTruthy();
        }
    });

    it('should resolve every group heading key against the real es dictionary', () => {
        for (const group of EDITOR_SECTION_GROUPS) {
            const key = EDITOR_SECTION_GROUP_LABEL_KEYS[group];

            expect(
                resolveHostKey(key),
                `missing i18n key for group "${group}": ${key}`
            ).toBeTruthy();
        }
    });

    it('should give each section a distinct label (no two nav items read alike)', () => {
        const labels = ACCOMMODATION_EDITOR_SECTIONS.map((section) =>
            resolveHostKey(section.labelKey)
        );

        expect(new Set(labels).size).toBe(labels.length);
    });

    it('should use lowercase kebab-case slugs (they are URL segments)', () => {
        for (const section of ACCOMMODATION_EDITOR_SECTIONS) {
            expect(section.slug).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
        }
    });

    it('should keep each group contiguous so the nav renders three blocks, not six', () => {
        // The nav renders groups in EDITOR_SECTION_GROUPS order and sections in
        // registry order. If a group's entries were interleaved with another's,
        // the visual order would silently diverge from the declared order.
        const firstIndexOf = new Map<string, number>();
        const lastIndexOf = new Map<string, number>();

        ACCOMMODATION_EDITOR_SECTIONS.forEach((section, index) => {
            if (!firstIndexOf.has(section.group)) firstIndexOf.set(section.group, index);
            lastIndexOf.set(section.group, index);
        });

        for (const group of EDITOR_SECTION_GROUPS) {
            const first = firstIndexOf.get(group) as number;
            const last = lastIndexOf.get(group) as number;
            const span = ACCOMMODATION_EDITOR_SECTIONS.slice(first, last + 1);

            expect(span.every((section) => section.group === group)).toBe(true);
        }
    });

    it('should NOT include the featured-listing toggle (HOS-318 D-10)', () => {
        // It self-hides for every owner without a FEATURED_LISTING entitlement,
        // so a nav item would dead-end for the majority. It belongs at the foot
        // of the hub, not in the registry.
        const ids = ACCOMMODATION_EDITOR_SECTIONS.map((section) => section.id);

        expect(ids).not.toContain('featured');
        expect(ids).not.toContain('featuredToggle');
    });

    it('should mark translations as the only conditional section', () => {
        const conditional = ACCOMMODATION_EDITOR_SECTIONS.filter((section) => section.conditional);

        expect(conditional.map((section) => section.id)).toEqual(['translations']);
    });
});

describe('findEditorSectionBySlug', () => {
    it('should find a section by its slug', () => {
        const section = findEditorSectionBySlug({ slug: 'fotos' });

        expect(section?.id).toBe('photos');
    });

    it('should return undefined for an unknown slug', () => {
        expect(findEditorSectionBySlug({ slug: 'no-existe' })).toBeUndefined();
    });
});

describe('buildEditorSectionUrl', () => {
    it('should build a locale-prefixed, trailing-slashed section URL', () => {
        const section = findEditorSectionBySlug({ slug: 'calendario' });

        const url = buildEditorSectionUrl({
            locale: 'es',
            accommodationId: 'acc-uuid',
            section: section as NonNullable<typeof section>
        });

        expect(url).toBe('/es/mi-cuenta/propiedades/acc-uuid/editar/calendario/');
    });

    it('should honour the requested locale', () => {
        const section = findEditorSectionBySlug({ slug: 'fotos' });

        const url = buildEditorSectionUrl({
            locale: 'en',
            accommodationId: 'acc-uuid',
            section: section as NonNullable<typeof section>
        });

        expect(url.startsWith('/en/')).toBe(true);
    });

    it('should produce a distinct URL for every section', () => {
        const urls = ACCOMMODATION_EDITOR_SECTIONS.map((section) =>
            buildEditorSectionUrl({ locale: 'es', accommodationId: 'acc-uuid', section })
        );

        expect(new Set(urls).size).toBe(urls.length);
    });
});

describe('buildEditorHubUrl', () => {
    it('should build the hub URL with a trailing slash', () => {
        const url = buildEditorHubUrl({ locale: 'es', accommodationId: 'acc-uuid' });

        expect(url).toBe('/es/mi-cuenta/propiedades/acc-uuid/editar/');
    });

    it('should never equal a section URL (the hub is its own page, not a redirect)', () => {
        const hub = buildEditorHubUrl({ locale: 'es', accommodationId: 'acc-uuid' });
        const sectionUrls = ACCOMMODATION_EDITOR_SECTIONS.map((section) =>
            buildEditorSectionUrl({ locale: 'es', accommodationId: 'acc-uuid', section })
        );

        expect(sectionUrls).not.toContain(hub);
    });
});

describe('getVisibleEditorSections', () => {
    it('should include translations when translation data exists', () => {
        const visible = getVisibleEditorSections({ hasTranslations: true });

        expect(visible).toHaveLength(10);
        expect(visible.map((section) => section.id)).toContain('translations');
    });

    it('should drop translations when there is no translation data', () => {
        const visible = getVisibleEditorSections({ hasTranslations: false });

        expect(visible).toHaveLength(9);
        expect(visible.map((section) => section.id)).not.toContain('translations');
    });

    it('should preserve registry order', () => {
        const visible = getVisibleEditorSections({ hasTranslations: true });

        expect(visible.map((section) => section.id)).toEqual(
            ACCOMMODATION_EDITOR_SECTIONS.map((section) => section.id)
        );
    });
});
