/**
 * Unit tests for DestinationService.updateAccommodationsCount (SPEC-167 m-1 fix).
 *
 * Verifies that the visibility filter passed to `accommodationModel.count()` now
 * excludes restricted and suspended accommodations — the pre-fix implementation
 * counted ALL non-deleted active accommodations, inflating the public-visible count.
 *
 * @module test/services/destination/updateAccommodationsCount
 */
import type { AccommodationModel, DestinationModel } from '@repo/db';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as Mock;

const mockLogger = createLoggerMock();

describe('DestinationService.updateAccommodationsCount', () => {
    let service: DestinationService;
    let destModelMock: ReturnType<typeof createModelMock>;
    let accModelMock: { count: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.clearAllMocks();

        destModelMock = createModelMock(['updateById']);
        accModelMock = { count: vi.fn().mockResolvedValue(3) };

        service = new DestinationService(
            { logger: mockLogger },
            destModelMock as unknown as DestinationModel
        );

        // Override private accommodationModel — no injection path in constructor.
        // @ts-expect-error: override private field for test
        service.accommodationModel = accModelMock as unknown as AccommodationModel;
    });

    it('m-1: passes visibility filters (deletedAt=null, lifecycleState=ACTIVE, ownerSuspended=false, planRestricted=false) to count()', async () => {
        const DEST_ID = 'dest-001';
        asMock(destModelMock.updateById).mockResolvedValue(undefined as any);
        asMock(accModelMock.count).mockResolvedValue(3);

        await service.updateAccommodationsCount(DEST_ID);

        expect(accModelMock.count).toHaveBeenCalledTimes(1);
        expect(accModelMock.count).toHaveBeenCalledWith({
            destinationId: DEST_ID,
            deletedAt: null,
            lifecycleState: 'ACTIVE',
            ownerSuspended: false,
            planRestricted: false
        });
    });

    it('m-1: writes the returned count to the destination row via updateById', async () => {
        const DEST_ID = 'dest-002';
        asMock(accModelMock.count).mockResolvedValue(7);
        asMock(destModelMock.updateById).mockResolvedValue(undefined as any);

        await service.updateAccommodationsCount(DEST_ID);

        expect(destModelMock.updateById).toHaveBeenCalledTimes(1);
        expect(destModelMock.updateById).toHaveBeenCalledWith(
            DEST_ID,
            { accommodationsCount: 7 },
            undefined // no tx
        );
    });

    it('m-1: count=0 when all accommodations are restricted (planRestricted filter excludes them)', async () => {
        const DEST_ID = 'dest-003';
        // All accommodations in this destination are plan-restricted → count returns 0.
        asMock(accModelMock.count).mockResolvedValue(0);
        asMock(destModelMock.updateById).mockResolvedValue(undefined as any);

        await service.updateAccommodationsCount(DEST_ID);

        expect(destModelMock.updateById).toHaveBeenCalledWith(
            DEST_ID,
            { accommodationsCount: 0 },
            undefined
        );
    });
});
