import { vi } from 'vitest';

// The package setup replaces fs/path reads with locale-loading stubs.
vi.unmock('node:fs');
vi.unmock('node:path');

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const locales = ['es', 'en', 'pt'] as const;

type TranslationObject = Record<string, unknown>;

function readVenue(locale: (typeof locales)[number]): TranslationObject {
    const path = resolve(import.meta.dirname, `../src/locales/${locale}/venue.json`);
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

describe('venue listing amenities label (HOS-1787 leaf 6.10)', () => {
    it('provides a non-empty listing.amenities label in every locale', () => {
        for (const locale of locales) {
            const value = getNestedValue(readVenue(locale), ['listing', 'amenities']);

            expect(typeof value, `${locale} listing.amenities must be a string`).toBe('string');
            expect(
                (value as string).trim().length,
                `${locale} listing.amenities must not be empty`
            ).toBeGreaterThan(0);
        }
    });
});
