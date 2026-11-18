import { CACHE_TAG_HOST_TRADE_CATEGORIES } from '@repo/cache-tags';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetRevalidationService } = vi.hoisted(() => ({ mockGetRevalidationService: vi.fn() }));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: mockGetRevalidationService
}));

import { purgeHostTradeCategoriesCache } from '../../../src/services/host-trade-category/host-trade-category.cache';

describe('purgeHostTradeCategoriesCache', () => {
    beforeEach(() => {
        mockGetRevalidationService.mockReset();
    });

    it('purges exactly the host-trade-categories tag', async () => {
        // Arrange
        const revalidateTags = vi.fn().mockResolvedValue([]);
        mockGetRevalidationService.mockReturnValue({ revalidateTags });

        // Act
        await purgeHostTradeCategoriesCache({ triggeredBy: 'actor-1' });

        // Assert
        expect(revalidateTags).toHaveBeenCalledTimes(1);
        expect(revalidateTags.mock.calls[0]?.[0]).toMatchObject({
            tags: [CACHE_TAG_HOST_TRADE_CATEGORIES],
            triggeredBy: 'actor-1',
            trigger: 'hook'
        });
    });

    it('is a silent no-op when the revalidation service is not initialized', async () => {
        mockGetRevalidationService.mockReturnValue(undefined);
        await expect(purgeHostTradeCategoriesCache({})).resolves.toBeUndefined();
    });

    it('never throws when the purge fails (best effort)', async () => {
        const revalidateTags = vi.fn().mockRejectedValue(new Error('cloudflare down'));
        mockGetRevalidationService.mockReturnValue({ revalidateTags });
        await expect(purgeHostTradeCategoriesCache({})).resolves.toBeUndefined();
    });
});
