import { describe, expect, it } from 'vitest';
import {
    VenueListingStatsSchema,
    VenueStatsWindowSchema
} from '../../../src/entities/venue/venue.query.schema.js';

const EMPTY_STATS = {
    window: '90d',
    views: { unique: 0, total: 0 },
    dailyViews: [{ date: '2026-11-18', total: 0 }],
    clicks: {
        total: 0,
        byKind: {
            PHONE_CLICK: { unique: 0, total: 0 },
            MAP_CLICK: { unique: 0, total: 0 },
            WEBSITE_CLICK: { unique: 0, total: 0 },
            INSTAGRAM_CLICK: { unique: 0, total: 0 },
            TICKET_CLICK: { unique: 0, total: 0 },
            WHATSAPP_CLICK: { unique: 0, total: 0 }
        }
    },
    clickRate: null
} as const;

describe('venue listing stats schemas (HOS-2261)', () => {
    it('accepts only 7, 30 and 90 day windows', () => {
        expect(VenueStatsWindowSchema.safeParse('90d').success).toBe(true);
        expect(VenueStatsWindowSchema.safeParse('1y').success).toBe(false);
    });

    it('accepts the full zero-filled response shape', () => {
        expect(VenueListingStatsSchema.safeParse(EMPTY_STATS).success).toBe(true);
    });

    it('requires all six supported click channels', () => {
        const { WHATSAPP_CLICK: _removed, ...byKind } = EMPTY_STATS.clicks.byKind;
        expect(
            VenueListingStatsSchema.safeParse({
                ...EMPTY_STATS,
                clicks: { total: 0, byKind }
            }).success
        ).toBe(false);
    });

    it('rejects click rates outside zero through one', () => {
        expect(VenueListingStatsSchema.safeParse({ ...EMPTY_STATS, clickRate: 1.1 }).success).toBe(
            false
        );
    });
});
