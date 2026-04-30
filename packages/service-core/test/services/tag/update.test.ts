import { REntityTagModel, TagModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, TagColorEnum, TagTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('TagService.update', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;

    // SYSTEM tag — update requires TAG_SYSTEM_UPDATE
    const tag = TagFactoryBuilder.create({
        name: 'Tag',
        type: TagTypeEnum.SYSTEM,
        color: TagColorEnum.BLUE,
        ownerId: null
    });
    // Update input: type and ownerId are immutable and not in TagUpdateInputSchema
    const updateInput = { name: 'Updated Tag', color: TagColorEnum.BLUE };

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['findById', 'update', 'findByType']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, new REntityTagModel());
        actor = createActor({ permissions: [PermissionEnum.TAG_SYSTEM_UPDATE] });
    });

    it('should update a SYSTEM tag (success)', async () => {
        asMock(tagModelMock.findById).mockResolvedValue(tag);
        asMock(tagModelMock.findByType).mockResolvedValue([]);
        asMock(tagModelMock.update).mockResolvedValue({ ...tag, ...updateInput });
        const result = await service.update(actor, tag.id, updateInput);
        expectSuccess(result);
        expect(result.data).toMatchObject(updateInput);
    });

    it('should return FORBIDDEN if actor lacks TAG_SYSTEM_UPDATE', async () => {
        actor = createActor({ permissions: [] });
        asMock(tagModelMock.findById).mockResolvedValue(tag);
        const result = await service.update(actor, tag.id, updateInput);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input (empty name)', async () => {
        const result = await service.update(actor, tag.id, { ...updateInput, name: '' });
        expectValidationError(result);
    });

    it('should return NOT_FOUND if tag does not exist', async () => {
        asMock(tagModelMock.findById).mockResolvedValue(null);
        const result = await service.update(actor, 'nonexistent-id', updateInput);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(tagModelMock.findById).mockResolvedValue(tag);
        asMock(tagModelMock.findByType).mockResolvedValue([]);
        asMock(tagModelMock.update).mockRejectedValue(new Error('DB error'));
        const result = await service.update(actor, tag.id, updateInput);
        expectInternalError(result);
    });

    it('should allow updating description field (replaces notes)', async () => {
        const descInput = { description: 'Updated description' };
        asMock(tagModelMock.findById).mockResolvedValue(tag);
        asMock(tagModelMock.findByType).mockResolvedValue([]);
        asMock(tagModelMock.update).mockResolvedValue({ ...tag, ...descInput });
        const result = await service.update(actor, tag.id, descInput);
        expectSuccess(result);
        expect(result.data).toMatchObject(descInput);
    });

    it('should require TAG_USER_UPDATE_OWN for own USER tag', async () => {
        const ownerId = 'actor-id';
        const userTag = TagFactoryBuilder.createUserTag(ownerId, {
            name: 'My Tag',
            color: TagColorEnum.GREEN
        });
        actor = createActor({ id: ownerId, permissions: [PermissionEnum.TAG_USER_UPDATE_OWN] });
        asMock(tagModelMock.findById).mockResolvedValue(userTag);
        asMock(tagModelMock.findByType).mockResolvedValue([]);
        asMock(tagModelMock.update).mockResolvedValue({ ...userTag, name: 'My Updated Tag' });
        const result = await service.update(actor, userTag.id, { name: 'My Updated Tag' });
        expectSuccess(result);
    });
});
