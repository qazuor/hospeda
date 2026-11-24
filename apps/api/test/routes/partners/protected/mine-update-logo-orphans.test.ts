/**
 * Owner decision 16: `PATCH /partners/mine` deletes the pending logo a new
 * submission replaced, after the row is written.
 */
import type { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    updateOwn: vi.fn(),
    deleteOrphans: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        PartnerService: class MockPartnerService extends orig.PartnerService {
            override updateOwn = mocks.updateOwn;
        }
    };
});

vi.mock('../../../../src/services/partner-presence/partner-logo-orphan-cleanup', () => ({
    deletePartnerLogoOrphans: mocks.deleteOrphans
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: () => ({ id: 'owner-1', permissions: [] })
}));

const { handleUpdateMyPartner } = await import('../../../../src/routes/partners/protected/mine');

describe('handleUpdateMyPartner — orphaned logos', () => {
    beforeEach(() => {
        mocks.updateOwn.mockReset();
        mocks.deleteOrphans.mockReset().mockResolvedValue({ deleted: [], skipped: 0, failed: [] });
    });

    it('hands the discarded logo URLs to the cleanup', async () => {
        // Arrange
        mocks.updateOwn.mockResolvedValue({
            data: { partner: { id: 'partner-1' }, discardedLogoUrls: ['https://old'] }
        });

        // Act
        const result = await handleUpdateMyPartner({} as Context, { logoUrl: 'https://new' });

        // Assert
        expect(result).toEqual({ partner: { id: 'partner-1' } });
        expect(mocks.deleteOrphans).toHaveBeenCalledWith({
            partnerId: 'partner-1',
            urls: ['https://old']
        });
    });

    it('deletes nothing when the service fails', async () => {
        mocks.updateOwn.mockResolvedValue({
            error: { code: 'NOT_FOUND', message: 'No partner listing is owned by this account' }
        });

        await expect(handleUpdateMyPartner({} as Context, {})).rejects.toThrow();
        expect(mocks.deleteOrphans).not.toHaveBeenCalled();
    });
});
