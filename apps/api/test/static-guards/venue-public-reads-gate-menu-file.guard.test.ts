/**
 * @file venue-public-reads-gate-menu-file.guard.test.ts
 * @description HOS-1792. Every public venue route that serializes a venue
 * listing (`VenuePublicSchema`) can carry `menuFileUrl`/`menuFileKind`, which
 * are plan-gated. It must therefore pass through the section-aware public
 * listing projector, which resolves the owner's menu state once per page.
 *
 * Source-text predicate, so its limit is a gate spelled some other way; the
 * counter-assertion proves the two tokens still exist in the gate module.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(__dirname, '../../src/routes/venue/public');
const GATE = /projectPublicListings/;

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

    it('the shared projector owns the legacy menu file fields', () => {
        const projector = readFileSync(
            join(DIR, '../../../utils/public-listing-projector.ts'),
            'utf8'
        );
        expect(projector).toMatch(/menuFileUrl/);
        expect(projector).toMatch(/menuFileKind/);
    });
});
