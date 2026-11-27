import { describe, expect, it } from 'vitest';
import {
    ENTITLEMENT_KEY_DEFINITIONS,
    getCatalogKey,
    LIMIT_KEY_DEFINITIONS
} from '../../src/catalog/index.js';
import { EntitlementKeyEnum, LimitKeyEnum } from '../../src/catalog/key-enums.js';

describe('TEST:1626:1 catalog key enums', () => {
    it('mirrors the full entitlement catalog with uppercase member names', () => {
        const enumEntries = Object.entries(EntitlementKeyEnum);
        const enumValues = enumEntries.map(([, value]) => value).sort();
        const catalogValues = ENTITLEMENT_KEY_DEFINITIONS.map(({ key }) => key).sort();

        expect(enumValues.length).toBeGreaterThan(20);
        expect(enumValues).toEqual(catalogValues);
        for (const [name, value] of enumEntries) {
            expect(name).toBe(value.toUpperCase());
        }
    });

    it('mirrors the full limit catalog with uppercase member names', () => {
        const enumEntries = Object.entries(LimitKeyEnum);
        const enumValues = enumEntries.map(([, value]) => value).sort();
        const catalogValues = LIMIT_KEY_DEFINITIONS.map(({ key }) => key).sort();

        expect(enumValues.length).toBeGreaterThan(20);
        expect(enumValues).toEqual(catalogValues);
        for (const [name, value] of enumEntries) {
            expect(name).toBe(value.toUpperCase());
        }
    });

    it.each([
        ['max_photos_per_venue', 'MAX_PHOTOS_PER_VENUE'],
        ['max_photos_per_experience', 'MAX_PHOTOS_PER_EXPERIENCE']
    ] as const)('declares %s as a summed commercial limit scoped to its vertical', (key, member) => {
        const expectedDefinition = {
            key,
            kind: 'limit',
            scope: 'vertical',
            aggregationStrategy: 'SUM',
            enforcementStrategy: 'ARCHIVE',
            keyClass: 'COMMERCIAL'
        };

        const definition = getCatalogKey({ key });
        const enumValue = LimitKeyEnum[member];

        expect(definition).toStrictEqual(expectedDefinition);
        expect(enumValue).toBe(key);
    });
});
