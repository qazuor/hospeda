import { AccommodationReviewModel, listingReviewsShownCondition } from '@repo/db';
import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service.js';
import { createActor } from '../../factories/actorFactory.js';
import { getMockId } from '../../factories/utilsFactory.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';

describe('AC:1686:2 AC:1686:3 the public review readers pass the PURGED rule', () => {
    let service: AccommodationReviewService;
    let reviewModel: AccommodationReviewModel;
    const actorId = getMockId('user', 'purged-review-reader');
    const condition = () => listingReviewsShownCondition({ vertical: VerticalEnum.ACCOMMODATION });

    beforeEach(() => {
        vi.clearAllMocks();
        reviewModel = createTypedModelMock(AccommodationReviewModel, [
            'findAll',
            'findAllWithUser'
        ]);
        service = new AccommodationReviewService({ logger: createLoggerMock() });
        // @ts-expect-error test model injection
        service.model = reviewModel;
        (reviewModel.findAll as ReturnType<typeof vi.fn>).mockResolvedValue({
            items: [],
            total: 0
        });
        (reviewModel.findAllWithUser as ReturnType<typeof vi.fn>).mockResolvedValue({
            items: [],
            total: 0
        });
    });

    it('passes the SQL condition to listWithUser, search, and count', async () => {
        const actor = createActor({
            id: actorId,
            permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE]
        });
        await service.listWithUser(actor, { page: 1, pageSize: 10 });
        const testimonialsCall = (reviewModel.findAllWithUser as ReturnType<typeof vi.fn>).mock
            .calls[0];
        expect(testimonialsCall?.[3]).toEqual([condition()]);

        await service.search(actor, { page: 1, pageSize: 10 });
        const searchCall = (reviewModel.findAll as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(searchCall?.[2]).toEqual([condition()]);

        await service.count(actor, { page: 1, pageSize: 10 });
        const countCall = (reviewModel.count as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(countCall?.[1]).toEqual({ additionalConditions: [condition()] });
    });

    it('does not add the public condition to author or per-listing readers', async () => {
        const actor = createActor({
            id: actorId,
            permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE]
        });
        await service.listByUser(actor, {
            userId: actorId,
            page: 1,
            pageSize: 10,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });
        expect(
            (reviewModel.findAll as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]
        ).toBeUndefined();

        await service.listByAccommodation(
            actor,
            {
                accommodationId: getMockId('accommodation', 'purged-review-listing'),
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            },
            { includeAllStates: true }
        );
        expect(
            (reviewModel.findAll as ReturnType<typeof vi.fn>).mock.calls[1]?.[2]
        ).toBeUndefined();
    });
});
