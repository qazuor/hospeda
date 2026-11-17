import { describe, expect, it } from 'vitest';
import {
    LEGACY_CATEGORY_TO_SLUGS,
    resolveLegacyCategorySlugs
} from '../host-trade-category-legacy-map.js';

describe('resolveLegacyCategorySlugs', () => {
    it('returns the mapped slugs for a legacy value', () => {
        expect(resolveLegacyCategorySlugs('PLOMERIA')).toEqual(['plomeria']);
        expect(resolveLegacyCategorySlugs('PILETA_JARDIN')).toEqual([
            'piletas',
            'parque-jardineria'
        ]);
    });

    it.each([
        'constructor',
        'toString',
        '__proto__',
        'hasOwnProperty',
        'NOPE',
        ''
    ])('returns undefined for %j, never an Object.prototype member', (key) => {
        expect(resolveLegacyCategorySlugs(key)).toBeUndefined();
    });

    it('returns undefined for null and undefined', () => {
        expect(resolveLegacyCategorySlugs(null)).toBeUndefined();
        expect(resolveLegacyCategorySlugs(undefined)).toBeUndefined();
    });

    it('stays in sync with the map', () => {
        for (const key of Object.keys(LEGACY_CATEGORY_TO_SLUGS)) {
            expect(resolveLegacyCategorySlugs(key)).toBe(LEGACY_CATEGORY_TO_SLUGS[key]);
        }
    });
});
