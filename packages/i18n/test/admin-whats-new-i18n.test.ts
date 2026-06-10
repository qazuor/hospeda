/**
 * Key-parity test for the `admin-whats-new` i18n namespace (SPEC-175 T-010).
 *
 * Verifies that all three locale files (es/en/pt) have the same key set as
 * defined in SPEC-175 §8.1 and that no key has an empty value.
 *
 * Note: the generic `key-coverage.test.ts` already runs parity checks across
 * ALL namespaces; this test is a dedicated, explicit assertion for the
 * `admin-whats-new` namespace so a reviewer can immediately confirm coverage
 * without scanning the full generic suite output.
 *
 * @see packages/i18n/src/locales/es/admin-whats-new.json — baseline
 * @see packages/i18n/src/locales/en/admin-whats-new.json
 * @see packages/i18n/src/locales/pt/admin-whats-new.json
 * @see SPEC-175 §8.1, §12.5
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES_DIR = path.resolve(__dirname, '../src/locales');
const NAMESPACE = 'admin-whats-new';

// ---------------------------------------------------------------------------
// Required keys as specified in SPEC-175 §8.1
// ---------------------------------------------------------------------------

const REQUIRED_KEYS = [
    'badge.label',
    'badge.labelNone',
    'modal.title',
    'modal.close',
    'panel.title',
    'panel.markAllRead',
    'panel.empty',
    'panel.seeEntry',
    'card.seeAll',
    'status.new',
    'status.seen'
] as const;

// ---------------------------------------------------------------------------
// Helpers (mirrors key-coverage.test.ts utilities)
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

function resolveKey(obj: Record<string, unknown>, key: string): unknown {
    return key.split('.').reduce<unknown>((current, part) => {
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

describe('admin-whats-new i18n namespace', () => {
    const locales = ['es', 'en', 'pt'] as const;
    const esData = loadJson('es');
    const esKeys = collectLeafKeys(esData);

    it('es locale has all required keys from SPEC-175 §8.1', () => {
        // Arrange / Act
        const keySet = new Set(esKeys);

        // Assert
        for (const key of REQUIRED_KEYS) {
            expect(keySet, `Missing required key '${key}' in es/${NAMESPACE}.json`).toContain(key);
        }
    });

    for (const locale of locales) {
        describe(`${locale} locale`, () => {
            const data = loadJson(locale);
            const keys = collectLeafKeys(data);

            it('has the same key set as es (parity)', () => {
                // Arrange
                const esKeySet = new Set(esKeys);
                const localeKeySet = new Set(keys);

                // Assert — no missing keys
                const missingKeys = esKeys.filter((k) => !localeKeySet.has(k));
                expect(missingKeys, `Keys missing in ${locale}/${NAMESPACE}.json`).toEqual([]);

                // Assert — no extra keys
                const extraKeys = keys.filter((k) => !esKeySet.has(k));
                expect(extraKeys, `Extra keys in ${locale}/${NAMESPACE}.json`).toEqual([]);
            });

            it('has no empty string values', () => {
                // Arrange / Act
                const emptyKeys = keys.filter((key) => {
                    const value = resolveKey(data, key);
                    return value === '';
                });

                // Assert
                expect(emptyKeys, `Empty values in ${locale}/${NAMESPACE}.json`).toEqual([]);
            });

            it('preserves the {{count}} interpolation placeholder in badge.label', () => {
                // Arrange
                const value = resolveKey(data, 'badge.label');

                // Act / Assert
                expect(typeof value).toBe('string');
                expect(value as string).toContain('{{count}}');
            });
        });
    }
});
