import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ recalculate: vi.fn(), invalidate: vi.fn(), ports: vi.fn() }));
vi.mock('../../../src/utils/effective-set-cache', () => ({
    invalidateEffectiveSetsForUser: mocks.invalidate
}));
vi.mock('../../../src/utils/listing-publication/ports', () => ({
    getListingPublicationPorts: mocks.ports
}));
vi.mock('../../../../../packages/verticals/src/publication/coverage-recalculation', () => ({
    recalculateCoverage: mocks.recalculate
}));

import { createScheduledChangeSurplusStep } from '../../../src/utils/listing-publication/scheduled-change-surplus-step';

describe('TEST:B8b:15 scheduled change surplus step', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.ports.mockReturnValue({ unitOfWork: {}, afterCommit: {}, billing: {}, clock: {} });
        mocks.invalidate.mockResolvedValue(undefined);
        mocks.recalculate.mockResolvedValue({});
    });

    it('invalidates the old effective set and recalculates with the keep selection', async () => {
        const keepListingIds = ['listing-a', 'listing-b'];
        await createScheduledChangeSurplusStep().reconcile({
            userId: 'owner-1',
            vertical: VerticalEnum.ACCOMMODATION,
            keepListingIds
        });
        expect(mocks.invalidate).toHaveBeenCalledWith('owner-1');
        expect(mocks.recalculate).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-1',
                vertical: VerticalEnum.ACCOMMODATION,
                keepListingIds: new Set(keepListingIds),
                correlationId: expect.any(String)
            })
        );
    });

    it('propagates recalculation failures to S38 finish handling', async () => {
        const failure = new Error('recalculation failed');
        mocks.recalculate.mockRejectedValue(failure);
        await expect(
            createScheduledChangeSurplusStep().reconcile({
                userId: 'owner-1',
                vertical: VerticalEnum.ACCOMMODATION,
                keepListingIds: ['listing-a']
            })
        ).rejects.toBe(failure);
    });
});
