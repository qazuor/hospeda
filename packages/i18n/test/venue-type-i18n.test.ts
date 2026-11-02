import { VenueTypeEnum } from '@repo/schemas';
import { vi } from 'vitest';

// The package setup replaces fs/path reads with locale-loading stubs.
vi.unmock('node:fs');
vi.unmock('node:path');

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const locales = ['es', 'en', 'pt'] as const;

type TranslationObject = Record<string, unknown>;

function readLocaleJson(locale: (typeof locales)[number], file: string): TranslationObject {
    const path = resolve(import.meta.dirname, `../src/locales/${locale}/${file}.json`);
    return JSON.parse(readFileSync(path, 'utf8')) as TranslationObject;
}

function getNestedValue(source: TranslationObject, path: readonly string[]): unknown {
    let value: unknown = source;
    for (const key of path) {
        if (typeof value !== 'object' || value === null) return undefined;
        value = (value as TranslationObject)[key];
    }
    return value;
}

describe('venue type translations', () => {
    it('provides labels and descriptions for every venue type in every locale', () => {
        for (const locale of locales) {
            const venue = readLocaleJson(locale, 'venue');
            const adminEntities = readLocaleJson(locale, 'admin-entities');
            for (const type of Object.values(VenueTypeEnum)) {
                for (const [file, root, path] of [
                    ['venue', venue, ['types', type]],
                    ['venue', venue, ['typeDescriptions', type]],
                    ['admin-entities', adminEntities, ['venue', 'types', type]],
                    ['admin-entities', adminEntities, ['venue', 'typeDescriptions', type]]
                ] as const) {
                    const value = getNestedValue(root, path);
                    expect(
                        typeof value === 'string' && value.trim().length > 0,
                        `${locale}/${file}: ${path.join('.')} must be a non-empty string`
                    ).toBe(true);
                }
            }
        }
    });
});
