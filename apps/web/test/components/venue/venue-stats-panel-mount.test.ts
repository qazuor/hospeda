import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(
    resolve(import.meta.dirname, '../../../src/pages/[lang]/mi-cuenta/comercio/index.astro'),
    'utf8'
);

describe('venue stats panel mount (HOS-2261 AC-12)', () => {
    it('mounts only when the owner has at least one venue listing', () => {
        expect(page).toMatch(
            /venueListings\.length\s*>\s*0\s*&&\s*venueStatsUnlockingPlanName\s*!==\s*null\s*&&\s*\(\s*<VenueListingStatsPanel/
        );
        expect(page).toMatch(/listings=\{venueListings\.map\(/);
    });

    it('does not mount from the shared venue/experience listings collection', () => {
        expect(page).not.toMatch(/<VenueListingStatsPanel[\s\S]{0,500}listings=\{listings\.map/);
    });
});
