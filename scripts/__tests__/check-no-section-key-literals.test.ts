import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    EXEMPTIONS,
    forbiddenSourcePaths,
    hasForbiddenKeyLiteral,
    inventoryIsExact,
    run
} from '../check-no-section-key-literals';

const ROOT = path.resolve(import.meta.dirname, '../..');
const key = 'manage_experience_directions';

describe('TEST:3.6:5 — GUARD:G-FAC-04 section key literals', () => {
    it('accepts the repository with an empty exemption list (HOS-1809)', () => {
        const inventory = JSON.parse(readFileSync(path.join(ROOT, EXEMPTIONS), 'utf8'));
        expect(inventory).toEqual({ count: 0, files: [] });
        expect(inventoryIsExact(inventory)).toBe(true);
        const result = run();
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('0 exact exemptions');
    });
    it('rejects any exemption: the list is closed at zero', () => {
        expect(
            inventoryIsExact({ count: 1, files: ['apps/api/src/utils/entitlement-filter.ts'] })
        ).toBe(false);
        expect(inventoryIsExact({ count: 1, files: [] })).toBe(false);
        expect(
            inventoryIsExact({ count: 0, files: ['apps/api/src/routes/accommodation/new.ts'] })
        ).toBe(false);
    });
    it.each([
        `listingAccess: { capabilities: ['${key}'] }`,
        `step6Key: '${key}'`,
        `const KEY = '${key}'; enforceUserGate({ keys: [KEY] })`,
        `enforceUserGate({ keys: ['${key}'] })`,
        `readEffectiveKeys({ keys: ['${key}'] })`
    ])('rejects %s', (source) => {
        expect(hasForbiddenKeyLiteral(source, [key])).toBe(true);
    });
    it('accepts a catalog-derived value at the same gate sites', () => {
        expect(
            hasForbiddenKeyLiteral(
                'const KEY = trait.entitlementKey; readEffectiveKeys({ keys: [KEY] })',
                [key]
            )
        ).toBe(false);
    });
    it.each([
        'public',
        'protected'
    ])('rejects a new accommodation route with a key literal in %s/', (visibility) => {
        const route = `apps/api/src/routes/accommodation/${visibility}/newRoute.ts`;
        expect(
            forbiddenSourcePaths(
                [{ path: route, source: `enforceUserGate({ keys: ['${key}'] })` }],
                [],
                [key]
            )
        ).toEqual([route]);
    });
    it('rejects the calendar key literal that the occupancy routes used before HOS-1809', () => {
        const route = 'apps/api/src/routes/accommodation/protected/addOccupancy.ts';
        expect(
            forbiddenSourcePaths(
                [{ path: route, source: "listingAccess: { capabilities: ['can_use_calendar'] }" }],
                [],
                ['can_use_calendar']
            )
        ).toEqual([route]);
    });
});
