import { EntityCommentModel, PostModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EntityCommentService } from '../../../src/services/entityComment/entityComment.service';
import { createActor } from '../../factories/actorFactory';
import { expectForbiddenError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const POST_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';

describe('EntityCommentService.countApprovedByPostId', () => {
    let service: EntityCommentService;
    let modelMock: EntityCommentModel;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createTypedModelMock(EntityCommentModel);
        actor = createActor({ id: ACTOR_ID, permissions: [PermissionEnum.POST_COMMENT_VIEW] });
        service = new EntityCommentService(
            { logger: createLoggerMock() },
            modelMock,
            createTypedModelMock(PostModel)
        );
    });

    it('returns the recomputed approved count for a view-permitted actor', async () => {
        asMock(modelMock.countApprovedByPostId).mockResolvedValue(7);
        const result = await service.countApprovedByPostId(actor, { postId: POST_ID });
        expectSuccess(result);
        if ('data' in result && result.data) {
            expect(result.data.count).toBe(7);
        }
        expect(asMock(modelMock.countApprovedByPostId)).toHaveBeenCalledWith({
            postId: POST_ID,
            tx: undefined
        });
    });

    it('returns FORBIDDEN when the actor holds no comment view permission', async () => {
        actor = createActor({ id: ACTOR_ID, permissions: [] });
        const result = await service.countApprovedByPostId(actor, { postId: POST_ID });
        expectForbiddenError(result);
        expect(asMock(modelMock.countApprovedByPostId)).not.toHaveBeenCalled();
    });
});
