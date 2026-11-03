/**
 * @file venue-public-reads-gate-menu-file.guard.test.ts
 * @description HOS-1792. Every public venue route that serializes a venue
 * listing (`VenuePublicSchema`) can carry `menuFileUrl`/`menuFileKind`, which
 * are plan-gated. It must therefore pass through the section-aware public
 * listing projector, which resolves the owner's menu state once per page.
 *
 * Source-text predicate, so its limit is a gate spelled some other way. The
 * public readers must keep using the projector, and the catalog must retain
 * the legacy response fields as read-only menu fields.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(__dirname, '../../src/routes/venue/public');
const GATE = /projectPublicListings/;
const PUBLIC_READERS = ['getById.ts', 'getBySlug.ts', 'list.ts', 'getByDestination.ts'];

describe('public venue reads gate the menu file (HOS-1792)', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'));
    const serializers = files.filter((f) =>
        readFileSync(join(DIR, f), 'utf8').includes('responseSchema: VenuePublicSchema')
    );

    it('finds the venue-listing routes (guard is not vacuous)', () => {
        expect(serializers).toEqual(expect.arrayContaining(PUBLIC_READERS));
    });

    it.each(PUBLIC_READERS)('%s passes the listing through the menu projection', (file) => {
        expect(readFileSync(join(DIR, file), 'utf8')).toMatch(GATE);
    });

    it('the venue menu catalog declares its read-only response fields', () => {
        const catalog = readFileSync(
            join(DIR, '../../../../../../packages/schemas/src/catalog/listing-sections.ts'),
            'utf8'
        );
        const venueStart = catalog.indexOf('venue: [');
        const experienceStart = catalog.indexOf('experience: [', venueStart);
        const menuStart = catalog.indexOf("id: 'menu'", venueStart);
        expect(venueStart).toBeGreaterThanOrEqual(0);
        expect(menuStart).toBeGreaterThan(venueStart);
        expect(menuStart).toBeLessThan(experienceStart);

        const menuSection = catalog.slice(menuStart).match(/readOnlyFields:\s*\[([^\]]*)\]/)?.[1];
        expect(menuSection).toBeDefined();
        expect(menuSection).toMatch(/\bmenuFileUrl\b/);
        expect(menuSection).toMatch(/\bmenuFileKind\b/);
        expect(menuSection).toMatch(/\bmenuSections\b/);
    });
});
