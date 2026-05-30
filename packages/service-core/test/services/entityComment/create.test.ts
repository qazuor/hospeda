import { EntityCommentModel, PostModel } from '@repo/db';
import { EntityTypeEnum, ModerationStatusEnum, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EntityCommentService } from '../../../src/services/entityComment/entityComment.service';
import { createActor } from '../../factories/actorFactory';
import {
    expectForbiddenError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const POST_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const AUTHOR_ID = '33333333-3333-4333-8333-333333333333';
const COMMENT_ID = '44444444-4444-4444-8444-444444444444';

function makeComment(overrides: Record<string, unknown> = {}) {
    return {
        id: COMMENT_ID,
        entityType: EntityTypeEnum.POST,
        entityId: POST_ID,
        authorId: AUTHOR_ID,
        content: 'A valid comment',
        moderationState: ModerationStatusEnum.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: AUTHOR_ID,
        updatedById: null,
        deletedAt: null,
        deletedById: null,
        ...overrides
    };
}

describe('EntityCommentService.create', () => {
    let service: EntityCommentService;
    let modelMock: EntityCommentModel;
    let postModelMock: PostModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityCommentModel);
        postModelMock = createTypedModelMock(PostModel);
        actor = createActor({
            id: AUTHOR_ID,
            permissions: [PermissionEnum.POST_COMMENT_CREATE, PermissionEnum.EVENT_COMMENT_CREATE]
        });
        service = new EntityCommentService(
            { logger: createLoggerMock() },
            modelMock,
            postModelMock
        );
    });

    it('creates a POST comment as APPROVED and increments posts.comments by 1 (AC-11)', async () => {
        asMock(modelMock.create).mockResolvedValue(makeComment());
        const result = await service.create(actor, {
            entityType: EntityTypeEnum.POST,
            entityId: POST_ID,
            content: 'A valid comment'
        });
        expectSuccess(result);
        // _beforeCreate injects authorId + APPROVED state into the insert payload.
        const insertPayload = asMock(modelMock.create).mock.calls[0][0];
        expect(insertPayload.authorId).toBe(AUTHOR_ID);
        expect(insertPayload.moderationState).toBe(ModerationStatusEnum.APPROVED);
        // counter bumped exactly once, +1, for the post.
        expect(asMock(postModelMock.adjustCommentCount)).toHaveBeenCalledTimes(1);
        expect(asMock(postModelMock.adjustCommentCount)).toHaveBeenCalledWith(
            { id: POST_ID, delta: 1 },
            undefined
        );
    });

    it('does NOT touch any counter when creating an EVENT comment (AC-26)', async () => {
        asMock(modelMock.create).mockResolvedValue(
            makeComment({ entityType: EntityTypeEnum.EVENT, entityId: EVENT_ID })
        );
        const result = await service.create(actor, {
            entityType: EntityTypeEnum.EVENT,
            entityId: EVENT_ID,
            content: 'An event comment'
        });
        expectSuccess(result);
        expect(asMock(postModelMock.adjustCommentCount)).not.toHaveBeenCalled();
    });

    it('rejects an unsupported entityType without inserting (AC-3)', async () => {
        const result = await service.create(actor, {
            // biome-ignore lint/suspicious/noExplicitAny: deliberately passing a disallowed entity type
            entityType: EntityTypeEnum.ACCOMMODATION as any,
            entityId: POST_ID,
            content: 'Not allowed here'
        });
        expectValidationError(result);
        expect(asMock(modelMock.create)).not.toHaveBeenCalled();
    });

    it('rejects content longer than 2000 chars without inserting (AC-13)', async () => {
        const result = await service.create(actor, {
            entityType: EntityTypeEnum.POST,
            entityId: POST_ID,
            content: 'x'.repeat(2001)
        });
        expectValidationError(result);
        expect(asMock(modelMock.create)).not.toHaveBeenCalled();
    });

    it('returns FORBIDDEN when the actor lacks POST_COMMENT_CREATE', async () => {
        actor = createActor({ id: AUTHOR_ID, permissions: [] });
        const result = await service.create(actor, {
            entityType: EntityTypeEnum.POST,
            entityId: POST_ID,
            content: 'A valid comment'
        });
        expectForbiddenError(result);
        expect(asMock(modelMock.create)).not.toHaveBeenCalled();
    });
});
