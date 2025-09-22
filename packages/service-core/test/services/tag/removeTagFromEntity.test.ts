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

describe('TagService.removeTagFromEntity', () => {
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
    const relation = { id: 'rel-1', ...input };

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['findById']);
        relModelMock = createTypedModelMock(REntityTagModel, ['findOne', 'hardDelete']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, relModelMock);
        actor = createActor({ permissions: [PermissionEnum.TAG_UPDATE] });
    });

    it('should remove a tag from an entity (success)', async () => {
        asMock(relModelMock.findOne).mockResolvedValue(relation);
        asMock(relModelMock.hardDelete).mockResolvedValue(1);
        const result = await service.removeTagFromEntity(actor, input);
        expectSuccess(result);
    });

    it('should return FORBIDDEN if actor lacks TAG_UPDATE permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.removeTagFromEntity(actor, input);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.removeTagFromEntity(actor, {
            tagId: '',
            entityId: 'e',
            entityType: 'POST'
        } as any);
        expectValidationError(result);
    });

    it('should return NOT_FOUND if relation does not exist', async () => {
        asMock(relModelMock.findOne).mockResolvedValue(null);
        const result = await service.removeTagFromEntity(actor, input);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(relModelMock.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.removeTagFromEntity(actor, input);
        expectInternalError(result);
    });
});
