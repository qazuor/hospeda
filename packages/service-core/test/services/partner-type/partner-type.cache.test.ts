import { CACHE_TAG_PARTNER_TYPES } from '@repo/cache-tags';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetRevalidationService } = vi.hoisted(() => ({ mockGetRevalidationService: vi.fn() }));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: mockGetRevalidationService
}));

import { purgePartnerTypesCache } from '../../../src/services/partner-type/partner-type.cache';

describe('purgePartnerTypesCache (HOS-2336 AC-3.7)', () => {
    beforeEach(() => {
        mockGetRevalidationService.mockReset();
    });

    it('purges exactly the partner-types tag, once', async () => {
        // Arrange
        const revalidateTags = vi.fn().mockResolvedValue([]);
        mockGetRevalidationService.mockReturnValue({ revalidateTags });

        // Act
        await purgePartnerTypesCache({ triggeredBy: 'actor-1' });

        // Assert
        expect(revalidateTags).toHaveBeenCalledTimes(1);
        expect(revalidateTags.mock.calls[0]?.[0]).toMatchObject({
            tags: [CACHE_TAG_PARTNER_TYPES],
            triggeredBy: 'actor-1',
            trigger: 'hook',
            entityType: 'partner_type'
        });
    });

    it('is a silent no-op when the revalidation service is not initialized', async () => {
        mockGetRevalidationService.mockReturnValue(undefined);
        await expect(purgePartnerTypesCache({})).resolves.toBeUndefined();
    });

    it('never throws when the purge fails (best effort)', async () => {
        const revalidateTags = vi.fn().mockRejectedValue(new Error('cloudflare down'));
        mockGetRevalidationService.mockReturnValue({ revalidateTags });
        await expect(purgePartnerTypesCache({})).resolves.toBeUndefined();
    });
});
