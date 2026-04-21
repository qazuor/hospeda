import { DestinationReviewModel } from '@repo/db';
import type { DestinationIdType, UserIdType } from '@repo/schemas';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { DestinationReviewService } from '../../../src/services/destinationReview/destinationReview.service';
import type { ServiceConfig } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

/**
 * Tests for GAP-002 / SPEC-063-gaps T-003.
 *
 * `listByDestination()` is a new public-tier method that:
 *   1. Force-filters by destinationId (the old route ignored the path param
 *      and returned a global cross-destination list — the bug this closes).
 *   2. Force-filters lifecycleState=ACTIVE unless opts.includeAllStates=true.
 */
describe('DestinationReviewService.listByDestination', () => {
    let service: DestinationReviewService;
    let reviewModel: DestinationReviewModel;
    let logger: ReturnType<typeof createLoggerMock>;
    let ctx: ServiceConfig;

    beforeEach(() => {
        reviewModel = createTypedModelMock(DestinationReviewModel, ['findAll']);
        logger = createLoggerMock();
        ctx = { logger } as ServiceConfig;
        service = new DestinationReviewService(ctx);
        // @ts-expect-error override for test
        service.model = reviewModel;
    });

    it('filters by destinationId + deletedAt=null + lifecycleState=ACTIVE by default', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-1') as UserIdType,
            permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
        });
        const destinationId = getMockId('destination', 'dest-1') as DestinationIdType;
        (reviewModel.findAll as Mock).mockResolvedValue({ items: [], total: 0 });

        // Act
        const result = await service.listByDestination(actor, {
            destinationId,
            page: 1,
            pageSize: 10,
            sortBy: 'createdAt' as const,
            sortOrder: 'desc' as const
        });

        // Assert
        expectSuccess(result);
        const whereArg = (reviewModel.findAll as Mock).mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(whereArg.destinationId).toBe(destinationId);
        expect(whereArg.deletedAt).toBeNull();
        expect(whereArg.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('omits the lifecycleState filter when opts.includeAllStates=true', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-2') as UserIdType,
            permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
        });
        const destinationId = getMockId('destination', 'dest-2') as DestinationIdType;
        (reviewModel.findAll as Mock).mockResolvedValue({ items: [], total: 0 });

        // Act — server-side caller opts in to see all states (e.g. owner panel)
        await service.listByDestination(
            actor,
            {
                destinationId,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt' as const,
                sortOrder: 'desc' as const
            },
            { includeAllStates: true }
        );

        // Assert — lifecycleState NOT in the filter
        const whereArg = (reviewModel.findAll as Mock).mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(whereArg.destinationId).toBe(destinationId);
        expect('lifecycleState' in whereArg).toBe(false);
    });

    it('returns paginated response shape with DestinationReviewListResponse contract', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-3') as UserIdType,
            permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
        });
        const destinationId = getMockId('destination', 'dest-3') as DestinationIdType;
        (reviewModel.findAll as Mock).mockResolvedValue({ items: [], total: 25 });

        // Act
        const result = await service.listByDestination(actor, {
            destinationId,
            page: 2,
            pageSize: 10,
            sortBy: 'createdAt' as const,
            sortOrder: 'desc' as const
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.pagination.page).toBe(2);
        expect(result.data?.pagination.pageSize).toBe(10);
        expect(result.data?.pagination.total).toBe(25);
        expect(result.data?.pagination.totalPages).toBe(3);
        expect(result.data?.pagination.hasNextPage).toBe(true);
        expect(result.data?.pagination.hasPreviousPage).toBe(true);
    });
});
