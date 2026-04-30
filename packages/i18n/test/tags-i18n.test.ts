/**
 * Test suite for tags i18n translations
 *
 * Validates that all locale files (es/en/pt) for the `tags` namespace contain
 * the complete set of required keys defined in {@link TagI18nKeysSchema}, with
 * no missing keys, no extra keys, and no empty string values.
 *
 * @see SPEC-086 AC-F19, D-015, D-024
 */

import { describe, expect, it } from 'vitest';
// Resolve TagI18nKeysSchema from the schemas package source directly.
// The i18n package does not depend on @repo/schemas at runtime; this import
// is test-only and resolves via the relative monorepo path.
import { TagI18nKeysSchema } from '../../schemas/src/entities/tag/tag.i18n.schema';
import tagsEn from '../src/locales/en/tags.json';
import tagsEs from '../src/locales/es/tags.json';
import tagsPt from '../src/locales/pt/tags.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively extracts all leaf keys from an object into dot-notation paths.
 */
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];

    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
        } else {
            keys.push(fullKey);
        }
    }

    return keys.sort();
}

/**
 * Checks that no string value in the object is empty (after trimming).
 * Returns an array of dot-paths where empty values were found.
 */
function findEmptyValues(obj: Record<string, unknown>, path = ''): string[] {
    const empties: string[] = [];

    for (const key in obj) {
        const currentPath = path ? `${path}.${key}` : key;
        const value = obj[key];

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            empties.push(...findEmptyValues(value as Record<string, unknown>, currentPath));
        } else if (typeof value === 'string' && value.trim() === '') {
            empties.push(currentPath);
        }
    }

    return empties;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const locales = [
    { name: 'es', data: tagsEs },
    { name: 'en', data: tagsEn },
    { name: 'pt', data: tagsPt }
] as const;

// Extract the canonical key set from the ES baseline.
const esKeys = extractKeys(tagsEs as unknown as Record<string, unknown>);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tags i18n — schema conformance', () => {
    it('should parse correctly against TagI18nKeysSchema for each locale', () => {
        // ES
        const esResult = TagI18nKeysSchema.safeParse(tagsEs);
        expect(
            esResult.success,
            `ES parse failed: ${esResult.success ? '' : JSON.stringify(esResult.error.issues)}`
        ).toBe(true);

        // EN
        const enResult = TagI18nKeysSchema.safeParse(tagsEn);
        expect(
            enResult.success,
            `EN parse failed: ${enResult.success ? '' : JSON.stringify(enResult.error.issues)}`
        ).toBe(true);

        // PT
        const ptResult = TagI18nKeysSchema.safeParse(tagsPt);
        expect(
            ptResult.success,
            `PT parse failed: ${ptResult.success ? '' : JSON.stringify(ptResult.error.issues)}`
        ).toBe(true);
    });
});

describe('tags i18n — required key groups', () => {
    it('should have tags.type keys (INTERNAL, SYSTEM, USER)', () => {
        for (const { name, data } of locales) {
            expect(data.tags.type, `${name}: missing tags.type`).toBeDefined();
            expect(data.tags.type.INTERNAL, `${name}: missing tags.type.INTERNAL`).toBeTruthy();
            expect(data.tags.type.SYSTEM, `${name}: missing tags.type.SYSTEM`).toBeTruthy();
            expect(data.tags.type.USER, `${name}: missing tags.type.USER`).toBeTruthy();
        }
    });

    it('should have tags.lifecycle keys (ACTIVE, INACTIVE, ARCHIVED)', () => {
        for (const { name, data } of locales) {
            expect(data.tags.lifecycle, `${name}: missing tags.lifecycle`).toBeDefined();
            expect(
                data.tags.lifecycle.ACTIVE,
                `${name}: missing tags.lifecycle.ACTIVE`
            ).toBeTruthy();
            expect(
                data.tags.lifecycle.INACTIVE,
                `${name}: missing tags.lifecycle.INACTIVE`
            ).toBeTruthy();
            expect(
                data.tags.lifecycle.ARCHIVED,
                `${name}: missing tags.lifecycle.ARCHIVED`
            ).toBeTruthy();
        }
    });

    it('should have all tags.errors keys', () => {
        const requiredErrorKeys = [
            'quotaExceeded',
            'nameConflict',
            'internalNotVisible',
            'entityNotAccessible',
            'notFound'
        ] as const;

        for (const { name, data } of locales) {
            expect(data.tags.errors, `${name}: missing tags.errors`).toBeDefined();
            for (const key of requiredErrorKeys) {
                expect(data.tags.errors[key], `${name}: missing tags.errors.${key}`).toBeTruthy();
            }
        }
    });

    it('should have all tags.picker keys', () => {
        const requiredPickerKeys = [
            'title',
            'searchPlaceholder',
            'empty',
            'createNew',
            'quotaReached',
            'groupSystem',
            'groupInternal',
            'groupUser'
        ] as const;

        for (const { name, data } of locales) {
            expect(data.tags.picker, `${name}: missing tags.picker`).toBeDefined();
            for (const key of requiredPickerKeys) {
                expect(data.tags.picker[key], `${name}: missing tags.picker.${key}`).toBeTruthy();
            }
        }
    });

    it('should have all tags.manager keys', () => {
        const requiredManagerKeys = [
            'title',
            'quotaIndicator',
            'emptyState',
            'deleteConfirm'
        ] as const;

        for (const { name, data } of locales) {
            expect(data.tags.manager, `${name}: missing tags.manager`).toBeDefined();
            for (const key of requiredManagerKeys) {
                expect(data.tags.manager[key], `${name}: missing tags.manager.${key}`).toBeTruthy();
            }
        }
    });

    it('should have all tags.admin keys', () => {
        const requiredAdminKeys = [
            'title',
            'createButton',
            'filterByType',
            'filterByLifecycle'
        ] as const;

        for (const { name, data } of locales) {
            expect(data.tags.admin, `${name}: missing tags.admin`).toBeDefined();
            for (const key of requiredAdminKeys) {
                expect(data.tags.admin[key], `${name}: missing tags.admin.${key}`).toBeTruthy();
            }
        }
    });

    it('should have all tags.delete keys', () => {
        const requiredDeleteKeys = [
            'title',
            'confirmButton',
            'cancelButton',
            'impactCount'
        ] as const;

        for (const { name, data } of locales) {
            expect(data.tags.delete, `${name}: missing tags.delete`).toBeDefined();
            for (const key of requiredDeleteKeys) {
                expect(data.tags.delete[key], `${name}: missing tags.delete.${key}`).toBeTruthy();
            }
        }
    });

    it('should have all postTags.admin keys', () => {
        const requiredPostTagsAdminKeys = [
            'title',
            'createButton',
            'slugLabel',
            'duplicateSlugError'
        ] as const;

        for (const { name, data } of locales) {
            expect(data.postTags.admin, `${name}: missing postTags.admin`).toBeDefined();
            for (const key of requiredPostTagsAdminKeys) {
                expect(
                    data.postTags.admin[key],
                    `${name}: missing postTags.admin.${key}`
                ).toBeTruthy();
            }
        }
    });
});

describe('tags i18n — key parity across locales', () => {
    it('should have the same key set in EN as in ES (baseline)', () => {
        const enKeys = extractKeys(tagsEn as unknown as Record<string, unknown>);
        expect(enKeys).toEqual(esKeys);
    });

    it('should have the same key set in PT as in ES (baseline)', () => {
        const ptKeys = extractKeys(tagsPt as unknown as Record<string, unknown>);
        expect(ptKeys).toEqual(esKeys);
    });

    it('should have the same number of keys in all locales', () => {
        const enKeys = extractKeys(tagsEn as unknown as Record<string, unknown>);
        const ptKeys = extractKeys(tagsPt as unknown as Record<string, unknown>);

        expect(enKeys.length).toBe(esKeys.length);
        expect(ptKeys.length).toBe(esKeys.length);
        expect(esKeys.length).toBeGreaterThan(0);
    });
});

describe('tags i18n — value quality', () => {
    it('should have no empty string values in ES', () => {
        const empties = findEmptyValues(tagsEs as unknown as Record<string, unknown>);
        expect(empties, `Empty values in es/tags.json: ${empties.join(', ')}`).toEqual([]);
    });

    it('should have no empty string values in EN', () => {
        const empties = findEmptyValues(tagsEn as unknown as Record<string, unknown>);
        expect(empties, `Empty values in en/tags.json: ${empties.join(', ')}`).toEqual([]);
    });

    it('should have no empty string values in PT', () => {
        const empties = findEmptyValues(tagsPt as unknown as Record<string, unknown>);
        expect(empties, `Empty values in pt/tags.json: ${empties.join(', ')}`).toEqual([]);
    });

    it('should use {{count}} interpolation in tags.delete.impactCount (all locales)', () => {
        for (const { name, data } of locales) {
            expect(
                data.tags.delete.impactCount,
                `${name}: tags.delete.impactCount must contain {{count}}`
            ).toContain('{{count}}');
        }
    });

    it('should use {{used}} and {{limit}} interpolation in tags.manager.quotaIndicator (all locales)', () => {
        for (const { name, data } of locales) {
            expect(
                data.tags.manager.quotaIndicator,
                `${name}: tags.manager.quotaIndicator must contain {{used}}`
            ).toContain('{{used}}');
            expect(
                data.tags.manager.quotaIndicator,
                `${name}: tags.manager.quotaIndicator must contain {{limit}}`
            ).toContain('{{limit}}');
        }
    });
});
