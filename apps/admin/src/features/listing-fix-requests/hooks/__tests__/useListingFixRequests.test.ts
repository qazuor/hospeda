import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildListingFixRequestsPath } from '../useListingFixRequests';

describe('buildListingFixRequestsPath', () => {
    it('omits filters when none are selected', () => {
        expect(buildListingFixRequestsPath({ filters: {}, page: 1, pageSize: 50 })).toEqual(
            '/api/v1/admin/listing-fix-requests?page=1&pageSize=50'
        );
    });
    it('adds filters in stable order', () => {
        expect(
            buildListingFixRequestsPath({
                filters: { vertical: VerticalEnum.VENUE, ownerReported: 'yes', overdue: 'true' },
                page: 2,
                pageSize: 50
            })
        ).toEqual(
            '/api/v1/admin/listing-fix-requests?page=2&pageSize=50&vertical=venue&ownerReported=yes&overdue=true'
        );
    });
    it.each([
        [{ vertical: VerticalEnum.ACCOMMODATION }, 'vertical=accommodation'],
        [{ ownerReported: 'no' }, 'ownerReported=no'],
        [{ overdue: 'true' }, 'overdue=true']
    ] as const)('adds each individual filter', (filters, expected) => {
        expect(buildListingFixRequestsPath({ filters, page: 1, pageSize: 50 })).toEqual(
            `/api/v1/admin/listing-fix-requests?page=1&pageSize=50&${expected}`
        );
    });
});
