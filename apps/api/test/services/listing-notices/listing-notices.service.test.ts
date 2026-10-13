import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    listListingNotices,
    reportFixed
} from '../../../src/services/listing-notices/listing-notices.service';

const mocks = vi.hoisted(() => ({
    readOwnerListingNotices: vi.fn(),
    readListing: vi.fn(),
    lock: vi.fn(),
    reportFixed: vi.fn(),
    coverage: vi.fn(),
    trialRows: [] as unknown[]
}));

vi.mock('@repo/db', () => {
    const chain = {
        select: () => chain,
        from: () => chain,
        where: () => chain,
        limit: async () => mocks.trialRows
    };
    const db = {
        ...chain,
        transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db)
    };
    return {
        getDb: () => db,
        domainEvent: {},
        trials: {},
        trialRedemptions: {},
        listingNoticesModel: { readOwnerListingNotices: mocks.readOwnerListingNotices },
        listingPublicationModel: { readListing: mocks.readListing, lock: mocks.lock },
        listingModerationModel: { reportFixed: mocks.reportFixed }
    };
});
vi.mock('drizzle-orm', () => ({ and: () => ({}), eq: () => ({}) }));
vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);
vi.mock('../../../src/utils/clock', () => ({
    getClock: () => ({ clock: { now: () => new Date('2026-10-13T12:00:00.000Z') } })
}));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ billing: { coverage: mocks.coverage } })
}));

const OWNER = '77777777-7777-4777-8777-777777777777';
const LISTING = '88888888-8888-4888-8888-888888888888';

describe('TEST:V8a:7 listListingNotices fails closed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.trialRows = [];
        mocks.readOwnerListingNotices.mockResolvedValue([]);
    });

    it('throws when the coverage read fails, instead of inventing covered', async () => {
        // Arrange
        mocks.coverage.mockRejectedValue(new Error('billing down'));

        // Act + Assert
        await expect(
            listListingNotices({ userId: OWNER, vertical: VerticalEnum.ACCOMMODATION })
        ).rejects.toThrow('billing down');
    });

    it('reads coverage ONCE for the owner and vertical', async () => {
        // Arrange
        mocks.coverage.mockResolvedValue({ covered: false, sources: [] });

        // Act
        const result = await listListingNotices({
            userId: OWNER,
            vertical: VerticalEnum.GASTRONOMY
        });

        // Assert
        expect(result).toEqual({ trialRunning: false, items: [] });
        expect(mocks.coverage).toHaveBeenCalledTimes(1);
        expect(mocks.coverage).toHaveBeenCalledWith({
            userId: OWNER,
            vertical: VerticalEnum.GASTRONOMY
        });
        expect(mocks.readOwnerListingNotices).toHaveBeenCalledWith({
            vertical: VerticalEnum.GASTRONOMY,
            ownerId: OWNER
        });
    });
});

describe('TEST:V8a:7 reportFixed (row 30, H4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.readListing.mockResolvedValue({ id: LISTING, ownerId: OWNER });
    });

    it('takes the owner lock and answers the written instant', async () => {
        // Arrange
        const at = new Date('2026-10-13T12:00:00.000Z');
        mocks.reportFixed.mockResolvedValue({ status: 'REPORTED', at });

        // Act
        const result = await reportFixed({
            vertical: VerticalEnum.EXPERIENCE,
            listingId: LISTING
        });

        // Assert
        expect(result).toEqual({ ownerReportedFixedAt: '2026-10-13T12:00:00.000Z' });
        expect(mocks.lock).toHaveBeenCalledWith(
            expect.objectContaining({ key: `trial-start:${OWNER}:experience` })
        );
        expect(mocks.readListing).toHaveBeenCalledTimes(2);
    });

    it('answers the first instant on a repeat', async () => {
        // Arrange
        const first = new Date('2026-10-10T08:00:00.000Z');
        mocks.reportFixed.mockResolvedValue({ status: 'ALREADY', at: first });

        // Act
        const result = await reportFixed({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: LISTING
        });

        // Assert
        expect(result).toEqual({ ownerReportedFixedAt: first.toISOString() });
    });

    it('is a 409 NO_OPEN_FIX_REQUEST without an open request', async () => {
        // Arrange
        mocks.reportFixed.mockResolvedValue({ status: 'NO_OPEN' });

        // Act
        const error = await reportFixed({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: LISTING
        }).catch((caught: unknown) => caught);

        // Assert
        expect(error).toMatchObject({
            code: ServiceErrorCode.ALREADY_EXISTS,
            reason: 'NO_OPEN_FIX_REQUEST'
        });
    });

    it('is a 404 when the listing is gone', async () => {
        // Arrange
        mocks.readListing.mockResolvedValue(null);

        // Act
        const error = await reportFixed({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: LISTING
        }).catch((caught: unknown) => caught);

        // Assert
        expect(error).toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        expect(mocks.reportFixed).not.toHaveBeenCalled();
    });
});
