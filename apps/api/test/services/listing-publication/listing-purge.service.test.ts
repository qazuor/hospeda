import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    purgeListing: vi.fn(),
    execute: vi.fn()
}));

vi.mock('@repo/db', () => ({ getDb: () => ({ execute: mocks.execute }) }));
vi.mock('../../../../../packages/verticals/src/publication/purge-listing', () => ({
    purgeListing: (...args: unknown[]) => mocks.purgeListing(...args)
}));
vi.mock('../../../src/utils/listing-publication/ports', () => ({
    getListingPublicationPorts: () => ({ unitOfWork: {}, clock: {} })
}));
vi.mock('../../../src/utils/listing-publication/purge-ports', () => ({
    getPurgeAfterCommit: () => ({})
}));

import {
    ListingPurgeService,
    mapPurgeOnRequestFailure
} from '../../../src/services/listing-publication/listing-purge.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ADMIN = '22222222-2222-4222-8222-222222222222';
const LISTING = '33333333-3333-4333-8333-333333333333';
const admin = { id: ADMIN, roles: [], permissions: [] };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.execute.mockResolvedValue({ rows: [{ ownerId: OWNER, createdById: OWNER }] });
});

describe('TEST:V8a:10 action 23 service (purgeOnRequest)', () => {
    it.each([
        ['LISTING_NOT_FOUND', ServiceErrorCode.NOT_FOUND],
        ['NOT_OWNER', ServiceErrorCode.ALREADY_EXISTS],
        ['INVALID_FROM', ServiceErrorCode.NOT_FOUND],
        ['REASON_REQUIRED', ServiceErrorCode.VALIDATION_ERROR],
        ['STATE_CHANGED', ServiceErrorCode.ALREADY_EXISTS]
    ] as const)('maps the PB12 failure %s to %s', (reason, code) => {
        expect(mapPurgeOnRequestFailure(reason).code).toBe(code);
    });

    it('runs PB12 as support, with the authorized subject as the owner PB12 compares under its lock', async () => {
        // Arrange
        mocks.purgeListing.mockResolvedValue({ purged: true, warnings: [] });

        // Act
        const result = await new ListingPurgeService().purgeOnRequest({
            actor: admin,
            vertical: VerticalEnum.ACCOMMODATION,
            id: LISTING,
            reason: 'Juan asked us',
            expectedOwnerId: OWNER
        });

        // Assert
        expect(result).toEqual({ purged: true });
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.purgeListing).toHaveBeenCalledWith(
            expect.objectContaining({
                actor: { kind: 'support', adminId: ADMIN, ownerId: OWNER, reason: 'Juan asked us' },
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: LISTING,
                correlationId: expect.any(String)
            })
        );
    });

    it('answers 404 without calling PB12 when no subject was authorized', async () => {
        await expect(
            new ListingPurgeService().purgeOnRequest({
                actor: admin,
                vertical: VerticalEnum.GASTRONOMY,
                id: LISTING,
                reason: 'x',
                expectedOwnerId: null
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        expect(mocks.purgeListing).not.toHaveBeenCalled();
    });

    it('throws the mapped error when PB12 refuses', async () => {
        mocks.purgeListing.mockResolvedValue({ purged: false, reason: 'INVALID_FROM' });

        await expect(
            new ListingPurgeService().purgeOnRequest({
                actor: admin,
                vertical: VerticalEnum.EXPERIENCE,
                id: LISTING,
                reason: 'x',
                expectedOwnerId: OWNER
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
    });
});
