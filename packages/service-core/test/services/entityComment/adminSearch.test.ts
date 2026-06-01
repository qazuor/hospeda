import { EntityCommentModel, PostModel } from '@repo/db';
import {
    EntityCommentAdminSearchSchema,
    EntityTypeEnum,
    ModerationStatusEnum,
    PermissionEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EntityCommentService } from '../../../src/services/entityComment/entityComment.service';
import { createActor } from '../../factories/actorFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const POST_ID = '11111111-1111-4111-8111-111111111111';
const AUTHOR_ID = '33333333-3333-4333-8333-333333333333';

describe('EntityCommentService admin search backing (_executeSearch / _executeCount)', () => {
    let service: EntityCommentService;
    let modelMock: EntityCommentModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityCommentModel);
        actor = createActor({
            id: AUTHOR_ID,
            permissions: [PermissionEnum.POST_COMMENT_VIEW, PermissionEnum.EVENT_COMMENT_VIEW]
        });
        service = new EntityCommentService(
            { logger: createLoggerMock() },
            modelMock,
            createTypedModelMock(PostModel)
        );
        asMock(modelMock.findAll).mockResolvedValue({ items: [], total: 0 });
        asMock(modelMock.count).mockResolvedValue(0);
    });

    it('builds a where clause from all entity filters and excludes deleted by default', async () => {
        const result = await service.search(
            actor,
            EntityCommentAdminSearchSchema.parse({
                page: 1,
                pageSize: 20,
                entityType: EntityTypeEnum.POST,
                entityId: POST_ID,
                authorId: AUTHOR_ID,
                moderationState: ModerationStatusEnum.REJECTED
            })
        );
        expectSuccess(result);
        const where = asMock(modelMock.findAll).mock.calls[0]?.[0] as Record<string, unknown>;
        expect(where).toMatchObject({
            entityType: EntityTypeEnum.POST,
            entityId: POST_ID,
            authorId: AUTHOR_ID,
            moderationState: ModerationStatusEnum.REJECTED,
            deletedAt: null
        });
    });

    it('includes soft-deleted rows when includeDeleted is true and omits unset filters', async () => {
        const result = await service.search(
            actor,
            EntityCommentAdminSearchSchema.parse({ page: 1, pageSize: 20, includeDeleted: true })
        );
        expectSuccess(result);
        const where = asMock(modelMock.findAll).mock.calls[0]?.[0] as Record<string, unknown>;
        expect(where.deletedAt).toBeUndefined();
        expect(where.entityType).toBeUndefined();
    });

    it('counts with the same where clause', async () => {
        const result = await service.count(
            actor,
            EntityCommentAdminSearchSchema.parse({
                page: 1,
                pageSize: 20,
                entityType: EntityTypeEnum.EVENT
            })
        );
        expectSuccess(result);
        expect(asMock(modelMock.count)).toHaveBeenCalledTimes(1);
        const where = asMock(modelMock.count).mock.calls[0]?.[0] as Record<string, unknown>;
        expect(where).toMatchObject({ entityType: EntityTypeEnum.EVENT, deletedAt: null });
    });

    it('constructs with default models when none are injected', () => {
        const svc = new EntityCommentService({ logger: createLoggerMock() });
        expect(svc).toBeInstanceOf(EntityCommentService);
    });
});
