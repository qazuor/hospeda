import { describe, expect, it } from 'vitest';
import {
    AdminListingFixRequestItemSchema,
    AdminListingFixRequestListQuerySchema
} from '../../src/common/listing-fix-request-list.schema.js';

describe('TEST:1704: schema for admin fix-request list', () => {
    it('defaults the page and page size', () => {
        expect(AdminListingFixRequestListQuerySchema.parse({})).toEqual({
            page: 1,
            pageSize: 50
        });
    });

    it('rejects an oversized page and a vertical without listings', () => {
        expect(AdminListingFixRequestListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(
            false
        );
        expect(
            AdminListingFixRequestListQuerySchema.safeParse({ vertical: 'partner' }).success
        ).toBe(false);
    });

    it('accepts an item without a suggested date', () => {
        expect(
            AdminListingFixRequestItemSchema.safeParse({
                fixRequestId: '00000000-0000-4000-8000-000000000001',
                vertical: 'accommodation',
                listingId: '00000000-0000-4000-8000-000000000002',
                listingName: 'Listing',
                listingSlug: 'listing',
                publicationStatus: 'PUBLISHED',
                reason: 'Repair this',
                suggestedDate: null,
                overdue: false,
                ageDays: 0,
                openedAt: '2026-11-02T00:00:00.000Z',
                ownerReportedFixedAt: null
            }).success
        ).toBe(true);
    });
});
