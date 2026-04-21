import { AccommodationReviewModel } from '@repo/db';
import type { UserIdType } from '@repo/schemas';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import type { ServiceConfig } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

/**
 * Regression tests for GAP-004 / SPEC-063-gaps T-005.
 *
 * Ensures `_executeSearch` and `_executeCount` force-override `lifecycleState`
 * to ACTIVE regardless of what the caller supplies. Defense-in-depth: guarantees
 * a malicious or buggy caller cannot leak DRAFT / ARCHIVED records on the
 * search path, mirroring the SponsorshipService pattern.
 */
describe('AccommodationReviewService — search/count force-override lifecycleState=ACTIVE', () => {
    let service: AccommodationReviewService;
    let reviewModel: AccommodationReviewModel;
    let logger: ReturnType<typeof createLoggerMock>;
    let ctx: ServiceConfig;

    beforeEach(() => {
        reviewModel = createTypedModelMock(AccommodationReviewModel, ['findAll', 'count']);
        logger = createLoggerMock();
        ctx = { logger } as ServiceConfig;
        service = new AccommodationReviewService(ctx);
        // @ts-expect-error override for test
        service.model = reviewModel;
    });

    it('search(): overrides caller-supplied lifecycleState=DRAFT to ACTIVE', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-1') as UserIdType,
            permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE]
        });
        (reviewModel.findAll as Mock).mockResolvedValue({ items: [], total: 0 });

        // Act — caller tries to request DRAFT records on the search endpoint
        await service.search(actor, {
            page: 1,
            pageSize: 10,
            lifecycleState: LifecycleStatusEnum.DRAFT
        });

        // Assert — model received ACTIVE, NOT DRAFT
        const firstArg = (reviewModel.findAll as Mock).mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(firstArg.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(firstArg.deletedAt).toBeNull();
    });

    it('search(): overrides caller-supplied lifecycleState=ARCHIVED to ACTIVE', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-2') as UserIdType,
            permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE]
        });
        (reviewModel.findAll as Mock).mockResolvedValue({ items: [], total: 0 });

        // Act
        await service.search(actor, {
            page: 1,
            pageSize: 10,
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        });

        // Assert
        const firstArg = (reviewModel.findAll as Mock).mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(firstArg.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('count(): overrides caller-supplied lifecycleState to ACTIVE', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-3') as UserIdType,
            permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE]
        });
        (reviewModel.count as Mock).mockResolvedValue(0);

        // Act
        await service.count(actor, {
            page: 1,
            pageSize: 10,
            lifecycleState: LifecycleStatusEnum.DRAFT
        });

        // Assert — model.count received ACTIVE
        const firstArg = (reviewModel.count as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
        expect(firstArg.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('search(): still forces ACTIVE even when caller supplies no lifecycleState', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-4') as UserIdType,
            permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE]
        });
        (reviewModel.findAll as Mock).mockResolvedValue({ items: [], total: 0 });

        // Act — no lifecycleState supplied
        await service.search(actor, { page: 1, pageSize: 10 });

        // Assert
        const firstArg = (reviewModel.findAll as Mock).mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(firstArg.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });
});
