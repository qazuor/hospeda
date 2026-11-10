import { vi } from 'vitest';
import { BUSINESS_LINES } from '../../schemas/src/catalog/business-lines';

// The package setup replaces fs/path reads with locale-loading stubs.
vi.unmock('node:fs');
vi.unmock('node:path');

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const locales = ['es', 'en', 'pt'] as const;
const KEYS = ['message', 'viewAll', 'publish'] as const;

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

function readString(source: TranslationObject, path: readonly string[]): string {
    const value = getNestedValue(source, path);
    if (typeof value !== 'string') throw new Error(`Missing string key: ${path.join('.')}`);
    return value;
}

/**
 * The line labels are APPROVED copy already present in every locale; the empty
 * state must reference them through `{{line}}`, never by writing one by hand.
 */
function businessLineLabels(locale: (typeof locales)[number]): readonly string[] {
    const venue = readVenue(locale);
    return BUSINESS_LINES.venue.map((line) =>
        readString(venue, ['owner', 'businessLines', line.value, 'label'])
    );
}

describe('venue collection empty-state copy (HOS-1787 leaf 6.9)', () => {
    it('provides the three keys, non-empty, in every locale', () => {
        for (const locale of locales) {
            const venue = readVenue(locale);

            for (const key of KEYS) {
                const value = readString(venue, ['listing', 'collectionEmpty', key]);
                expect(
                    value.trim().length,
                    `${locale} listing.collectionEmpty.${key}`
                ).toBeGreaterThan(0);
            }
        }
    });

    it('keeps the line and vertical interpolated instead of baked in', () => {
        for (const locale of locales) {
            const venue = readVenue(locale);

            expect(readString(venue, ['listing', 'collectionEmpty', 'message'])).toContain(
                '{{line}}'
            );
            expect(readString(venue, ['listing', 'collectionEmpty', 'viewAll'])).toContain(
                '{{vertical}}'
            );
        }
    });

    it('writes no business-line label by hand', () => {
        for (const locale of locales) {
            const venue = readVenue(locale);
            const labels = businessLineLabels(locale);

            for (const key of KEYS) {
                const value = readString(venue, [
                    'listing',
                    'collectionEmpty',
                    key
                ]).toLocaleLowerCase(locale);
                for (const label of labels) {
                    expect(
                        value,
                        `${locale} listing.collectionEmpty.${key} names "${label}" literally`
                    ).not.toContain(label.toLocaleLowerCase(locale));
                }
            }
        }
    });
});
