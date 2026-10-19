import { describe, expect, it } from 'vitest';
import { ENTITLEMENT_KEY_DEFINITIONS, LIMIT_KEY_DEFINITIONS } from '../../src/catalog/index.js';
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
});
