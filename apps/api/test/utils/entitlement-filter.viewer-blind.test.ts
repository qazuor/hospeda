/**
 * HOS-353 — static guard: `entitlement-filter.ts` must stay VIEWER-BLIND.
 *
 * Every gate in that module runs on a payload served from
 * `PUBLIC_CACHE_ENDPOINTS`, whose cache key carries no actor and which is
 * consulted before the auth middleware. A result that depends on the READER is
 * therefore replayed to every later visitor for the TTL — that is HOS-288, it is
 * how `richDescriptionI18n` regressed during HOS-339, and it is what the video
 * gate did until HOS-353.
 *
 * The module now has no way to reach the viewer: `filterAccommodationByEntitlements`
 * does not take the Hono context, and the file imports neither `Context` nor
 * `hasEntitlement`. This guard pins that absence.
 *
 * Why a source-level check and not a behavioral one: viewer-independence cannot be
 * asserted behaviorally any more, because there is no viewer to vary. A test
 * claiming to prove it would first have to re-introduce the hazard it exists to
 * forbid. So the property is checked where it now lives — in what the module is
 * allowed to import.
 *
 * @module test/utils/entitlement-filter.viewer-blind
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const FILTER_SRC = fileURLToPath(new URL('../../src/utils/entitlement-filter.ts', import.meta.url));

/** Source with comments blanked, so prose mentioning a symbol does not count. */
function code(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

describe('entitlement-filter — viewer-blind guard (HOS-353)', () => {
    const source = readFileSync(FILTER_SRC, 'utf8');
    const stripped = code(source);

    it('reads the module (non-vacuity)', () => {
        // A guard whose file read silently returned empty passes every assertion
        // below while checking nothing. Anchor on symbols that must be there.
        expect(source.length).toBeGreaterThan(1000);
        expect(stripped).toContain('export function filterAccommodationByEntitlements');
        expect(stripped).toContain('CAN_EMBED_VIDEO');
    });

    it('does not import the Hono context type', () => {
        expect(stripped).not.toMatch(/import[^;]*\bContext\b[^;]*from\s*'hono'/);
    });

    it('does not import hasEntitlement or any middleware that resolves the viewer', () => {
        expect(stripped).not.toContain('hasEntitlement');
        expect(stripped).not.toMatch(/from\s*'\.\.\/middlewares\/entitlement'/);
    });

    it('does not read viewer entitlements off a request context', () => {
        // The concrete shape the removed code used: `c.get('userEntitlements')`.
        expect(stripped).not.toContain('userEntitlements');
    });

    it('gates video on the owner entitlement set, not on a context lookup', () => {
        // Pin the replacement too: dropping the imports while leaving the video
        // block reading something else off a request would satisfy the assertions
        // above and still be the bug.
        expect(stripped).toMatch(/ownerEntitlements[\s\S]{0,120}CAN_EMBED_VIDEO/);
    });

    it('the blanking helper does not swallow the code it checks', () => {
        const sample = [
            "const url = 'https://example.com/x'; // hasEntitlement",
            'const real = hasEntitlement(c, KEY);'
        ].join('\n');

        const out = code(sample);

        expect(out).toContain('hasEntitlement(c, KEY)');
        expect(out.match(/hasEntitlement/g)).toHaveLength(1);
    });
});
