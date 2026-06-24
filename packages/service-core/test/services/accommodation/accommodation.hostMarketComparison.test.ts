/**
 * @fileoverview
 * Regression test for AccommodationService.getHostMarketComparison().
 *
 * SPEC-207 smoke found the host dashboard "market comparison" widget returned
 * 403 for every real host: the method gated on ACCOMMODATION_VIEW_ALL, a
 * permission SPEC-169 removed from HOST (replaced by ACCOMMODATION_VIEW_OWN).
 * These tests pin the corrected gate (VIEW_OWN), matching the sibling host
 * analytics endpoints (views, favorites).
 */
import type { AccommodationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import {
    createLoggerMock,
    createModelMock,
    makeMediaModelStub
} from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const sampleRows = [
    {
        accommodationId: '11111111-1111-4111-8111-111111111111',
        accommodationName: 'Cabaña del Río',
        accommodationType: 'CABIN',
        destinationId: '22222222-2222-4222-8222-222222222222',
        destinationName: 'Concepción del Uruguay',
        yourRating: 4.5,
        yourReviews: 12,
        destinationAvgRating: 4.1,
        destinationReviewsTotal: 340,
        yourPrice: 18000,
        destinationAvgPrice: 21000
    }
] as const;

describe('AccommodationService.getHostMarketComparison()', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;
    let marketSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.restoreAllMocks();
        model = createModelMock();
        marketSpy = vi.fn().mockResolvedValue(sampleRows);
        model.getMarketComparisonByOwnerId = marketSpy;
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            // biome-ignore lint/suspicious/noExplicitAny: test stub
            makeMediaModelStub() as any
        );
    });

    // Regression: this is the exact actor shape that used to 403 (HOST holds
    // VIEW_OWN since SPEC-169, never VIEW_ALL).
    it('allows a HOST actor holding ACCOMMODATION_VIEW_OWN', async () => {
        const actor = new ActorFactoryBuilder()
            .withId('host-view-own-1')
            .withPermissions([PermissionEnum.ACCOMMODATION_VIEW_OWN])
            .build();

        const result = await service.getHostMarketComparison(actor);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual(sampleRows);
        expect(marketSpy).toHaveBeenCalled();
        expect(marketSpy.mock.calls[0]?.[0]).toBe(actor.id);
    });

    it('rejects an actor without ACCOMMODATION_VIEW_OWN', async () => {
        const actor = new ActorFactoryBuilder().withId('no-view-own-1').withPermissions([]).build();

        const result = await service.getHostMarketComparison(actor);

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.error?.message).toContain('ACCOMMODATION_VIEW_OWN');
        expect(marketSpy).not.toHaveBeenCalled();
    });
});
