import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    effectiveSet: vi.fn(),
    coverage: vi.fn(),
    transaction: vi.fn(),
    summarizeOwnerListings: vi.fn()
}));
vi.mock('@repo/db', () => ({
    getDb: () => ({ transaction: mocks.transaction }),
    listingPublicationModel: { summarizeOwnerListings: mocks.summarizeOwnerListings },
    planCatalogModel: {}
}));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: mocks.effectiveSet,
        billing: { coverage: mocks.coverage }
    })
}));
vi.mock('../../../src/utils/listing-publication/ports', () => ({
    getListingPublicationPorts: () => ({
        unitOfWork: {},
        afterCommit: {},
        billing: { coverage: mocks.coverage },
        clock: { now: () => new Date() }
    })
}));
vi.mock('../../../src/utils/effective-set-cache', () => ({
    invalidateEffectiveSetsForUser: vi.fn(),
    peekEffectiveSetForUser: vi.fn(async () => undefined)
}));
vi.mock('../../../src/utils/cron-heartbeat', () => ({ pingCronMonitor: vi.fn() }));
vi.mock('../../../src/utils/clock', () => ({
    getClock: () => ({ clock: { now: () => new Date('2026-10-11T00:00:00Z') } })
}));

import { getListingReconcilerPorts } from '../../../src/utils/listing-publication/reconciler-ports';

describe('listing reconciler production ports', () => {
    beforeEach(() => {
        mocks.effectiveSet.mockReset();
        mocks.coverage.mockReset().mockResolvedValue({ covered: false, sources: [] });
        mocks.summarizeOwnerListings.mockReset();
        mocks.transaction.mockImplementation((callback) => callback('transaction'));
    });

    it('resolves the publication limit live without the effective-set cache port', async () => {
        const ports = getListingReconcilerPorts();
        await expect(
            ports.liveLimit({ userId: 'owner', vertical: VerticalEnum.ACCOMMODATION })
        ).resolves.toBeNull();
        expect(mocks.coverage).toHaveBeenCalledWith({
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION
        });
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
    });

    it('TEST:V6:10 passes archivedReturnable through the production summary port', async () => {
        mocks.summarizeOwnerListings.mockResolvedValue({
            published: 0,
            unpublishedByBilling: 0,
            archived: 2,
            archivedReturnable: 1
        });
        const ports = getListingReconcilerPorts();
        await expect(
            ports.reader.summarize({ userId: 'owner', vertical: VerticalEnum.ACCOMMODATION })
        ).resolves.toMatchObject({ archivedReturnable: 1 });
    });
});
