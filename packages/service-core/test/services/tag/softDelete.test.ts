import { REntityTagModel, TagModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, TagColorEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import { expectForbiddenError, expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('TagService.softDelete', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const tag = TagFactoryBuilder.create({ name: 'Tag', slug: 'tag', color: TagColorEnum.BLUE });

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['findById', 'softDelete']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, new REntityTagModel());
        actor = createActor({ permissions: [PermissionEnum.TAG_DELETE] });
    });

    it('should soft delete a tag (success)', async () => {
        asMock(tagModelMock.findById).mockResolvedValue(tag);
        asMock(tagModelMock.softDelete).mockResolvedValue(1);
        const result = await service.softDelete(actor, tag.id);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return FORBIDDEN if actor lacks TAG_DELETE permission', async () => {
        actor = createActor({ permissions: [] });
        asMock(tagModelMock.findById).mockResolvedValue(tag);
        const result = await service.softDelete(actor, tag.id);
        expectForbiddenError(result);
    });

    it('should return NOT_FOUND if tag does not exist', async () => {
        asMock(tagModelMock.findById).mockResolvedValue(null);
        const result = await service.softDelete(actor, tag.id);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(tagModelMock.findById).mockRejectedValue(new Error('DB error'));
        const result = await service.softDelete(actor, tag.id);
        expectInternalError(result);
    });
});
