import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/venue/VenuePromotions.astro'),
    'utf8'
);

describe('VenuePromotions.astro', () => {
    it('renders no section for an empty list', () => {
        expect(source).toContain('if (items.length === 0) return;');
    });

    it('renders the public promotion fields and shared benefit formatting', () => {
        expect(source).toContain('item.title');
        expect(source).toContain('item.description');
        expect(source).toContain('formatPromotionBenefit');
        expect(source).toContain('venue.detail.promotions.validUntil');
        expect(source).toContain('venue.detail.promotions.noEndDate');
    });
});
