import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listOpenFixRequests } = vi.hoisted(() => ({ listOpenFixRequests: vi.fn() }));
vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/db')>()),
    listOpenFixRequests
}));

import { listAdminFixRequests } from '../../../src/services/listing-publication/listing-fix-request-list.service.js';

const openedAt = new Date('2026-11-01T12:00:00.000Z');
const row = (suggestedDate: string | null) => ({
    id: '00000000-0000-4000-8000-000000000001',
    vertical: 'accommodation' as const,
    listingId: '00000000-0000-4000-8000-000000000002',
    listingName: 'Listing',
    listingSlug: 'listing',
    publicationStatus: 'PUBLISHED',
    reason: 'Fix this',
    suggestedDate,
    openedAt,
    ownerReportedFixedAt: null
});

describe('TEST:1704: listing fix request service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listOpenFixRequests.mockResolvedValue({ items: [row('2026-11-01')], total: 1 });
    });

    it('uses the market-local day at the UTC date boundary for age and overdue', async () => {
        const response = await listAdminFixRequests({
            query: { page: 1, pageSize: 50 },
            now: new Date('2026-11-02T02:30:00.000Z')
        });
        expect(response.items[0]?.ageDays).toBe(0);
        expect(response.items[0]?.overdue).toBe(false);
    });

    it('marks only dates strictly before today as overdue, and null never overdue', async () => {
        listOpenFixRequests.mockResolvedValue({
            items: [row('2026-11-02'), row('2026-11-01'), row(null)],
            total: 3
        });
        const response = await listAdminFixRequests({
            query: { page: 1, pageSize: 50 },
            now: new Date('2026-11-02T15:00:00.000Z')
        });
        expect(response.items.map((item) => item.overdue)).toEqual([false, true, false]);
    });

    it('maps vertical, owner and overdue filters to the model', async () => {
        const query = {
            page: 2,
            pageSize: 7,
            vertical: VerticalEnum.VENUE as typeof VerticalEnum.VENUE,
            ownerReported: 'yes' as const,
            overdue: 'true' as const
        };
        await listAdminFixRequests({ query, now: new Date('2026-11-02T15:00:00.000Z') });
        expect(listOpenFixRequests).toHaveBeenCalledWith({
            verticals: ['venue'],
            ownerReported: true,
            suggestedBefore: '2026-11-02',
            page: 2,
            pageSize: 7
        });
    });

    it('maps ownerReported=no and the unfiltered vertical set exactly', async () => {
        await listAdminFixRequests({
            query: { page: 1, pageSize: 50, ownerReported: 'no' },
            now: new Date('2026-11-02T15:00:00.000Z')
        });
        expect(listOpenFixRequests).toHaveBeenCalledWith({
            verticals: [VerticalEnum.ACCOMMODATION, VerticalEnum.VENUE, VerticalEnum.EXPERIENCE],
            ownerReported: false,
            page: 1,
            pageSize: 50
        });
    });
});
