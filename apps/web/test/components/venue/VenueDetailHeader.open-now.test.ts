/**
 * @file VenueDetailHeader.open-now.test.ts
 * @description HOS-2257 AC-13 / AC-12: the venue detail header mounts the same
 * client island (never computing the status on the server, which is edge-cached).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/venue/VenueDetailHeader.astro'),
    'utf8'
);

describe('VenueDetailHeader open-now badge', () => {
    it('mounts the shared island with client:idle and the inline variant', () => {
        expect(src).toMatch(
            /<VenueOpenNowBadge\s+client:idle\s+locale=\{locale\}\s+openingHours=\{venue\.openingHours\}\s+variant="inline"\s*\/>/
        );
    });

    it('only mounts it when there are opening hours', () => {
        expect(src).toContain('venue.openingHours && Object.keys(venue.openingHours).length > 0');
    });

    it('does not compute the status on the server', () => {
        expect(src).not.toContain('computeOpenNowStatus');
        expect(src).not.toContain('computeOpenStatusDetail');
        expect(src).not.toContain('venue.card.openNow');
    });
});
