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
    it('accepts the repository with a closed, counted accommodation inventory', () => {
        const inventory = JSON.parse(readFileSync(path.join(ROOT, EXEMPTIONS), 'utf8'));
        expect(inventory.count).toBe(10);
        expect(inventoryIsExact(inventory)).toBe(true);
        expect(run().exitCode).toBe(0);
    });
    it('rejects a missing, added, or miscounted exemption', () => {
        const inventory = JSON.parse(readFileSync(path.join(ROOT, EXEMPTIONS), 'utf8'));
        expect(inventoryIsExact({ count: 9, files: inventory.files })).toBe(false);
        expect(inventoryIsExact({ count: 10, files: inventory.files.slice(1) })).toBe(false);
        expect(
            inventoryIsExact({
                count: 10,
                files: [...inventory.files, 'apps/api/src/routes/accommodation/new.ts']
            })
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
    ])('rejects a new accommodation route with a key literal outside the exemption list in %s/', (visibility) => {
        const route = `apps/api/src/routes/accommodation/${visibility}/newRoute.ts`;
        expect(
            forbiddenSourcePaths(
                [{ path: route, source: `enforceUserGate({ keys: ['${key}'] })` }],
                ['apps/api/src/routes/accommodation/public/list.ts'],
                [key]
            )
        ).toEqual([route]);
    });
});
