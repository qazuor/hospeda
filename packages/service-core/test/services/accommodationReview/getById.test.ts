/**
 * @fileoverview
 * Test suite for AccommodationReviewService.getById method.
 * Covers happy path, not-found, permission denied, and internal error scenarios.
 */
import { AccommodationReviewModel } from '@repo/db';
import type { AccommodationReview, AccommodationReviewIdType, UserIdType } from '@repo/schemas';
import { LifecycleStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodationReview/accommodationReview.permissions';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import { ServiceError } from '../../../src/types';
import type { ServiceConfig } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AccommodationReviewService.getById', () => {
    let service: AccommodationReviewService;
    let modelMock: AccommodationReviewModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    const mockReview: AccommodationReview = {
        id: getMockId('destinationReview', 'review-1') as AccommodationReviewIdType,
        accommodationId: getMockId('accommodation', 'acc-1'),
        userId: getMockId('user', 'user-1') as UserIdType,
        title: 'Great place',
        content: 'Really enjoyed my stay.',
        rating: {
            cleanliness: 5,
            hospitality: 4,
            services: 4,
            accuracy: 5,
            communication: 4,
            location: 5
        },
        averageRating: 4.5,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        createdById: getMockId('user', 'user-1') as UserIdType,
        updatedById: getMockId('user', 'user-1') as UserIdType,
        deletedById: undefined,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        adminInfo: undefined
    } as AccommodationReview;

    beforeEach(() => {
        modelMock = createTypedModelMock(AccommodationReviewModel, ['findOneWithRelations']);
        loggerMock = createLoggerMock();
        const ctx = { logger: loggerMock } as ServiceConfig;
        service = new AccommodationReviewService(ctx);
        // @ts-expect-error: override for test
        service.model = modelMock;
        actor = createActor({
            permissions: [PermissionEnum.ACCOMMODATION_REVIEW_VIEW]
        });
        vi.clearAllMocks();
    });

    it('should return an accommodation review by id (success)', async () => {
        asMock(modelMock.findOneWithRelations).mockResolvedValue(mockReview);
        vi.spyOn(permissionHelpers, 'checkCanViewAccommodationReview').mockReturnValue();

        const result = await service.getById(actor, mockReview.id);

        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe(mockReview.id);
        expect(result.error).toBeUndefined();
        expect(modelMock.findOneWithRelations).toHaveBeenCalledWith(
            { id: mockReview.id },
            { user: true, accommodation: true },
            undefined
        );
        expect(modelMock.findOne).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND error if review does not exist', async () => {
        asMock(modelMock.findOneWithRelations).mockResolvedValue(null);
        vi.spyOn(permissionHelpers, 'checkCanViewAccommodationReview').mockReturnValue();

        const result = await service.getById(actor, mockReview.id);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return FORBIDDEN error if actor lacks permission', async () => {
        asMock(modelMock.findOneWithRelations).mockResolvedValue(mockReview);
        vi.spyOn(permissionHelpers, 'checkCanViewAccommodationReview').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });

        const result = await service.getById(actor, mockReview.id);

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(modelMock.findOneWithRelations).mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanViewAccommodationReview').mockReturnValue();

        const result = await service.getById(actor, mockReview.id);

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
