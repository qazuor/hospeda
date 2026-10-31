/**
 * @file venue-public-reads-gate-menu-file.guard.test.ts
 * @description HOS-1792. Every public venue route that serializes a venue
 * listing (`VenuePublicSchema`) can carry `menuFileUrl`/`menuFileKind`, which
 * are plan-gated. It must therefore pass through the menu projection:
 * `applyVenueMenuManagementGate` (by-slug) or `gateVenueMenuFile(s)` (the
 * shared wrapper for reads that return the stored row).
 *
 * Source-text predicate, so its limit is a gate spelled some other way; the
 * counter-assertion proves the two tokens still exist in the gate module.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(__dirname, '../../src/routes/venue/public');
const GATE = /applyVenueMenuManagementGate|gateVenueMenuFiles?\b/;

describe('public venue reads gate the menu file (HOS-1792)', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'));
    const serializers = files.filter((f) =>
        readFileSync(join(DIR, f), 'utf8').includes('responseSchema: VenuePublicSchema')
    );

    it('finds the venue-listing routes (guard is not vacuous)', () => {
        expect(serializers).toEqual(
            expect.arrayContaining(['getById.ts', 'getBySlug.ts', 'list.ts', 'getByDestination.ts'])
        );
    });

    it.each(serializers)('%s passes the listing through the menu projection', (file) => {
        expect(readFileSync(join(DIR, file), 'utf8')).toMatch(GATE);
    });

    it('the gate module still spells the tokens the guard looks for', () => {
        expect(readFileSync(join(DIR, 'menu-file-gate.ts'), 'utf8')).toMatch(
            /export async function gateVenueMenuFiles/
        );
        expect(readFileSync(join(DIR, 'menu-projection.ts'), 'utf8')).toMatch(
            /export function applyVenueMenuManagementGate/
        );
    });
});
