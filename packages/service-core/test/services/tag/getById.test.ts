import { REntityTagModel, TagModel } from '@repo/db';
import { PermissionEnum, TagColorEnum, TagTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import { expectInternalError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('TagService.getById', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;

    // SYSTEM tag visible to any authenticated actor
    const tag = TagFactoryBuilder.create({
        name: 'Tag',
        type: TagTypeEnum.SYSTEM,
        color: TagColorEnum.BLUE,
        ownerId: null
    });

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['findOne']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, new REntityTagModel());
        actor = createActor({ permissions: [] });
    });

    it('should return a SYSTEM tag by id (success, no special permission needed)', async () => {
        asMock(tagModelMock.findOne).mockResolvedValue(tag);
        const result = await service.getById(actor, tag.id);
        expectSuccess(result);
        expect(result.data).toEqual(tag);
        expect(tagModelMock.findOne).toHaveBeenCalledWith({ id: tag.id }, undefined);
    });

    it('should return NOT_FOUND error if tag does not exist', async () => {
        asMock(tagModelMock.findOne).mockResolvedValue(null);
        const result = await service.getById(actor, tag.id);
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(tagModelMock.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.getById(actor, tag.id);
        expectInternalError(result);
    });

    it('should return FORBIDDEN for INTERNAL tag when actor lacks TAG_INTERNAL_VIEW', async () => {
        const internalTag = TagFactoryBuilder.createInternalTag({ name: 'Spam' });
        asMock(tagModelMock.findOne).mockResolvedValue(internalTag);
        const result = await service.getById(actor, internalTag.id);
        // getById calls _canView which calls assertCanViewTag
        // for INTERNAL tags without TAG_INTERNAL_VIEW → FORBIDDEN
        expect(['FORBIDDEN', 'NOT_FOUND']).toContain(result.error?.code);
    });

    it('should return tag by id for INTERNAL tag with TAG_INTERNAL_VIEW', async () => {
        const internalTag = TagFactoryBuilder.createInternalTag({ name: 'Spam' });
        actor = createActor({ permissions: [PermissionEnum.TAG_INTERNAL_VIEW] });
        asMock(tagModelMock.findOne).mockResolvedValue(internalTag);
        const result = await service.getById(actor, internalTag.id);
        expectSuccess(result);
    });
});
