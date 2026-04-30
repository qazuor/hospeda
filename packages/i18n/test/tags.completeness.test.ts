/**
 * T-046: tags i18n completeness — smoke assertions (AC-F19)
 *
 * COVERAGE NOTE
 * =============
 * AC-F19 ("i18n keys for tags.* and postTags.* present in es/en/pt") is
 * already covered comprehensively by the primary suite at:
 *
 *   packages/i18n/test/tags-i18n.test.ts  (17 tests)
 *
 * That suite validates:
 *   - TagI18nKeysSchema.safeParse passes for all three locale files (es/en/pt)
 *   - Every required key group is present and non-empty in each locale
 *   - Key parity: EN and PT match ES (same sorted leaf-key set)
 *   - No empty string values in any locale
 *   - Interpolation markers ({{count}}, {{used}}, {{limit}}) are present
 *
 * This file adds a lightweight cross-check that the locale JSON files can be
 * imported and each top-level namespace is non-empty, confirming the files are
 * syntactically valid and contain data. It intentionally avoids duplicating the
 * detailed assertions already in tags-i18n.test.ts.
 *
 * @see SPEC-086 AC-F19, D-015, D-024
 * @see packages/i18n/test/tags-i18n.test.ts  (primary AC-F19 coverage)
 */

import { describe, expect, it } from 'vitest';
import tagsEn from '../src/locales/en/tags.json';
import tagsEs from '../src/locales/es/tags.json';
import tagsPt from '../src/locales/pt/tags.json';

// ---------------------------------------------------------------------------
// Locale fixtures
// ---------------------------------------------------------------------------

const locales = [
    { name: 'es', data: tagsEs },
    { name: 'en', data: tagsEn },
    { name: 'pt', data: tagsPt }
] as const;

// ---------------------------------------------------------------------------
// Smoke: top-level namespace presence
// ---------------------------------------------------------------------------

describe('tags i18n completeness (AC-F19) — smoke', () => {
    it('should have a non-empty tags namespace in all locales', () => {
        for (const { name, data } of locales) {
            expect(data.tags, `${name}: missing tags namespace`).toBeDefined();
            expect(
                Object.keys(data.tags).length,
                `${name}: tags namespace is empty`
            ).toBeGreaterThan(0);
        }
    });

    it('should have a non-empty postTags namespace in all locales', () => {
        for (const { name, data } of locales) {
            expect(data.postTags, `${name}: missing postTags namespace`).toBeDefined();
            expect(
                Object.keys(data.postTags).length,
                `${name}: postTags namespace is empty`
            ).toBeGreaterThan(0);
        }
    });

    it('should have the same top-level structure in ES, EN, and PT', () => {
        const esTopKeys = Object.keys(tagsEs).sort();
        const enTopKeys = Object.keys(tagsEn).sort();
        const ptTopKeys = Object.keys(tagsPt).sort();

        expect(enTopKeys, 'EN top-level keys must match ES').toEqual(esTopKeys);
        expect(ptTopKeys, 'PT top-level keys must match ES').toEqual(esTopKeys);
    });

    it('should include all required tags key groups in each locale', () => {
        const requiredGroups = [
            'type',
            'lifecycle',
            'errors',
            'picker',
            'manager',
            'admin',
            'delete'
        ] as const;

        for (const { name, data } of locales) {
            for (const group of requiredGroups) {
                expect(data.tags[group], `${name}: missing tags.${group} group`).toBeDefined();
            }
        }
    });

    it('should include all required postTags key groups in each locale', () => {
        for (const { name, data } of locales) {
            expect(data.postTags.admin, `${name}: missing postTags.admin group`).toBeDefined();
        }
    });
});
