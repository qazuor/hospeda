/**
 * Key-parity test for the `tour.*` keys added to the `admin-common` i18n
 * namespace (SPEC-174 T-010).
 *
 * Verifies that all three locale files (es/en/pt) have the same `tour.*` key
 * set as defined in SPEC-174 §7.9 and that no key has an empty value.
 *
 * The generic `key-coverage.test.ts` already runs cross-namespace parity; this
 * test is a dedicated, explicit assertion so a reviewer can immediately confirm
 * tour-chrome coverage without scanning the full generic suite.
 *
 * @see packages/i18n/src/locales/es/admin-common.json — baseline (tour section)
 * @see packages/i18n/src/locales/en/admin-common.json
 * @see packages/i18n/src/locales/pt/admin-common.json
 * @see SPEC-174 §7.9
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES_DIR = path.resolve(__dirname, '../src/locales');
const NAMESPACE = 'admin-common';

// ---------------------------------------------------------------------------
// Required tour chrome keys per SPEC-174 §7.9
// ---------------------------------------------------------------------------

const REQUIRED_TOUR_KEYS = [
    'tour.skip',
    'tour.showMe',
    'tour.next',
    'tour.prev',
    'tour.done',
    'tour.replay',
    'tour.replayPage'
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            keys.push(...collectLeafKeys(value as Record<string, unknown>, fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

function resolveKey(obj: Record<string, unknown>, dotPath: string): unknown {
    return dotPath.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
            return (current as Record<string, unknown>)[part];
        }
        return undefined;
    }, obj);
}

function loadJson(locale: string): Record<string, unknown> {
    const filePath = path.join(LOCALES_DIR, locale, `${NAMESPACE}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin-common tour.* i18n keys (SPEC-174)', () => {
    const locales = ['es', 'en', 'pt'] as const;
    const esData = loadJson('es');
    const esKeys = collectLeafKeys(esData);
    const esTourKeys = esKeys.filter((k) => k.startsWith('tour.'));

    it('es locale has all required tour keys from SPEC-174 §7.9', () => {
        const keySet = new Set(esKeys);
        for (const key of REQUIRED_TOUR_KEYS) {
            expect(keySet, `Missing required key '${key}' in es/${NAMESPACE}.json`).toContain(key);
        }
    });

    for (const locale of locales) {
        describe(`${locale} locale`, () => {
            const data = loadJson(locale);
            const keys = collectLeafKeys(data);
            const tourKeys = keys.filter((k) => k.startsWith('tour.'));

            it('has the same tour.* key set as es (parity)', () => {
                const esTourSet = new Set(esTourKeys);
                const localeTourSet = new Set(tourKeys);

                const missingKeys = esTourKeys.filter((k) => !localeTourSet.has(k));
                expect(missingKeys, `Keys missing in ${locale}/${NAMESPACE}.json`).toEqual([]);

                const extraKeys = tourKeys.filter((k) => !esTourSet.has(k));
                expect(extraKeys, `Extra keys in ${locale}/${NAMESPACE}.json`).toEqual([]);
            });

            it('has no empty string values for tour.* keys', () => {
                const emptyKeys = tourKeys.filter((key) => {
                    const value = resolveKey(data, key);
                    return value === '';
                });
                expect(emptyKeys, `Empty values in ${locale}/${NAMESPACE}.json`).toEqual([]);
            });
        });
    }
});
