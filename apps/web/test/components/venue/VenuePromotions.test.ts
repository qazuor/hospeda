/**
 * HOS-2589 §7.6 / AC-21: the venue detail promotions block carries no promotion
 * data in the cached HTML; it only mounts the per-reader island.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/venue/VenuePromotions.astro'),
    'utf8'
);

describe('VenuePromotions.astro', () => {
    it('mounts the per-reader island for this venue', () => {
        expect(source).toContain('<PlacePromotions client:idle');
        expect(source).toContain('entityType="venue"');
        expect(source).toContain('entityId={venueId}');
    });

    it('receives no promotion rows from SSR', () => {
        expect(source).not.toContain('items');
        expect(source).not.toContain('item.title');
        expect(source).not.toContain('formatPromotionBenefit');
    });
});
