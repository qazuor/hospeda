import { REntityTagModel, TagModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
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

describe('TagService.addTagToEntity', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let relModelMock: REntityTagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const tag = TagFactoryBuilder.create({ name: 'Tag' });
    const input = {
        tagId: tag.id,
        entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        entityType: 'POST'
    };

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['findById']);
        relModelMock = createTypedModelMock(REntityTagModel, ['findOne', 'create']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, relModelMock);
        actor = createActor({ permissions: [PermissionEnum.TAG_UPDATE] });
    });

    it('should associate a tag to an entity (success)', async () => {
        asMock(tagModelMock.findById).mockResolvedValue(tag);
        asMock(relModelMock.findOne).mockResolvedValue(null);
        asMock(relModelMock.create).mockResolvedValue({});
        const result = await service.addTagToEntity(actor, input);
        expectSuccess(result);
    });

    it('should return FORBIDDEN if actor lacks TAG_UPDATE permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.addTagToEntity(actor, input);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.addTagToEntity(actor, {
            tagId: '',
            entityId: 'e',
            entityType: 'POST'
        } as any);
        expectValidationError(result);
    });

    it('should return NOT_FOUND if tag does not exist', async () => {
        asMock(tagModelMock.findById).mockResolvedValue(null);
        const result = await service.addTagToEntity(actor, input);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return VALIDATION_ERROR if tag is already associated', async () => {
        asMock(tagModelMock.findById).mockResolvedValue(tag);
        asMock(relModelMock.findOne).mockResolvedValue({ id: 'rel-1' });
        const result = await service.addTagToEntity(actor, input);
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(tagModelMock.findById).mockRejectedValue(new Error('DB error'));
        const result = await service.addTagToEntity(actor, input);
        expectInternalError(result);
    });
});
