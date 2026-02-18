/**
 * Key-coverage test for i18n translation files
 *
 * Validates that all EN and PT translation files have complete key parity
 * with the ES (baseline) files, and that interpolation placeholders are preserved.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES_DIR = path.resolve(__dirname, '../src/locales');
const BASELINE_LOCALE = 'es';
const TARGET_LOCALES = ['en', 'pt'] as const;

/** Regex to match interpolation placeholders like {{variableName}} */
const PLACEHOLDER_REGEX = /\{\{(\w+)\}\}/g;

/**
 * Recursively collects all leaf keys from a nested object using dot notation
 */
function collectKeys({
    obj,
    prefix = ''
}: {
    obj: Record<string, unknown>;
    prefix?: string;
}): string[] {
    const keys: string[] = [];
    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            keys.push(...collectKeys({ obj: value as Record<string, unknown>, prefix: fullKey }));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

/**
 * Resolves a dot-notation key to its value in a nested object
 */
function resolveKey({
    obj,
    key
}: {
    obj: Record<string, unknown>;
    key: string;
}): unknown {
    return key.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
            return (current as Record<string, unknown>)[part];
        }
        return undefined;
    }, obj);
}

/**
 * Extracts interpolation placeholders from a string
 */
function extractPlaceholders({ text }: { text: string }): string[] {
    const matches = text.match(PLACEHOLDER_REGEX);
    return matches ? matches.sort() : [];
}

/**
 * Loads and parses a JSON translation file
 */
function loadTranslationFile({
    locale,
    namespace
}: {
    locale: string;
    namespace: string;
}): Record<string, unknown> {
    const filePath = path.join(LOCALES_DIR, locale, `${namespace}.json`);
    if (!fs.existsSync(filePath)) {
        return {};
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
}

/**
 * Gets all namespace names from the baseline locale directory
 */
function getNamespaces(): string[] {
    const esDir = path.join(LOCALES_DIR, BASELINE_LOCALE);
    return fs
        .readdirSync(esDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''))
        .sort();
}

describe('i18n Key Coverage', () => {
    const namespaces = getNamespaces();

    for (const targetLocale of TARGET_LOCALES) {
        describe(`${targetLocale.toUpperCase()} locale`, () => {
            for (const namespace of namespaces) {
                describe(`namespace: ${namespace}`, () => {
                    const esData = loadTranslationFile({ locale: BASELINE_LOCALE, namespace });
                    const targetData = loadTranslationFile({ locale: targetLocale, namespace });
                    const esKeys = collectKeys({ obj: esData });

                    it(`should have all ${esKeys.length} keys from ES`, () => {
                        if (esKeys.length === 0) {
                            return;
                        }

                        const targetKeys = new Set(collectKeys({ obj: targetData }));
                        const missingKeys = esKeys.filter((key) => !targetKeys.has(key));

                        expect(
                            missingKeys,
                            `Missing keys in ${targetLocale}/${namespace}.json`
                        ).toEqual([]);
                    });

                    it('should preserve all interpolation placeholders', () => {
                        if (esKeys.length === 0) {
                            return;
                        }

                        const errors: string[] = [];

                        for (const key of esKeys) {
                            const esValue = resolveKey({ obj: esData, key });
                            const targetValue = resolveKey({ obj: targetData, key });

                            if (typeof esValue !== 'string' || typeof targetValue !== 'string') {
                                continue;
                            }

                            const esPlaceholders = extractPlaceholders({ text: esValue });
                            const targetPlaceholders = extractPlaceholders({ text: targetValue });

                            if (
                                esPlaceholders.length > 0 &&
                                esPlaceholders.join(',') !== targetPlaceholders.join(',')
                            ) {
                                errors.push(
                                    `Key "${key}": ES has ${JSON.stringify(esPlaceholders)}, ${targetLocale} has ${JSON.stringify(targetPlaceholders)}`
                                );
                            }
                        }

                        expect(
                            errors,
                            `Placeholder mismatches in ${targetLocale}/${namespace}.json`
                        ).toEqual([]);
                    });

                    it('should not have empty string values', () => {
                        const targetKeys = collectKeys({ obj: targetData });
                        const emptyKeys = targetKeys.filter((key) => {
                            const value = resolveKey({ obj: targetData, key });
                            return value === '';
                        });

                        expect(
                            emptyKeys,
                            `Empty values in ${targetLocale}/${namespace}.json`
                        ).toEqual([]);
                    });

                    it('should not have extra keys missing from ES', () => {
                        const esKeySet = new Set(esKeys);
                        const targetKeys = collectKeys({ obj: targetData });
                        const extraKeys = targetKeys.filter((key) => !esKeySet.has(key));

                        expect(
                            extraKeys,
                            `Extra keys in ${targetLocale}/${namespace}.json not in ES`
                        ).toEqual([]);
                    });
                });
            }
        });
    }
});
