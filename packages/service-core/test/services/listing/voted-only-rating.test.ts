import { describe, expect, it, vi } from 'vitest';
import { BaseListingService } from '../../../src/services/listing/base-listing.service';

describe('BaseListingService votedOnly recomputation', () => {
    it('averages each dimension over its voters and uses overallRating for the listing average', async () => {
        const update = vi.fn(async (_where: unknown, patch: Record<string, unknown>) => ({
            id: 'venue-id',
            ...patch
        }));
        const service = {
            model: { update },
            _revalidationEntityType: 'venue',
            entityName: 'venue'
        };
        const rows = [
            { food: 4, service: 5, overallRating: 4 },
            { service: 3, overallRating: 3 },
            { overallRating: 5 }
        ];

        const result = await BaseListingService.prototype.recomputeRating.call(
            service as never,
            'venue-id',
            rows
        );

        expect(result.error).toBeUndefined();
        const [, patch] = update.mock.calls[0] ?? [];
        expect(patch.rating).toEqual({
            food: { average: 4, count: 1 },
            service: { average: 4, count: 2 }
        });
        expect(patch.averageRating).toBe(4);
        expect(patch.reviewsCount).toBe(3);
    });
});
