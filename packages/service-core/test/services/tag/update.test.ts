import { REntityTagModel, TagModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, TagColorEnum } from '@repo/types';
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
    const tag = TagFactoryBuilder.create({ name: 'Tag', slug: 'tag', color: TagColorEnum.BLUE });
    const updateInput = { name: 'Updated Tag', slug: 'updated-tag', color: TagColorEnum.BLUE };

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, new REntityTagModel());
        actor = createActor({ permissions: [PermissionEnum.TAG_UPDATE] });
    });

    it('should update a tag (success)', async () => {
        asMock(tagModelMock.findById).mockResolvedValue(tag);
        asMock(tagModelMock.update).mockResolvedValue({ ...tag, ...updateInput });
        const result = await service.update(actor, tag.id, updateInput);
        expectSuccess(result);
        expect(result.data).toMatchObject(updateInput);
    });

    it('should return FORBIDDEN if actor lacks TAG_UPDATE permission', async () => {
        actor = createActor({ permissions: [] });
        asMock(tagModelMock.findById).mockResolvedValue(tag);
        const result = await service.update(actor, tag.id, updateInput);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // name empty
        const result = await service.update(actor, tag.id, { ...updateInput, name: '' });
        expectValidationError(result);
    });

    it('should return NOT_FOUND if tag does not exist', async () => {
        asMock(tagModelMock.findById).mockResolvedValue(null);
        const result = await service.update(actor, tag.id, updateInput);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(tagModelMock.findById).mockRejectedValue(new Error('DB error'));
        const result = await service.update(actor, tag.id, updateInput);
        expectInternalError(result);
    });
});
