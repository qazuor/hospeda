import { REntityTagModel, TagModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
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

describe('TagService.getTagsForEntity', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let relModelMock: REntityTagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const tag = TagFactoryBuilder.create({ name: 'Tag' });
    const input = { entityId: 'entity-1', entityType: 'POST' };
    const relation = { id: 'rel-1', tag };

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['findById']);
        relModelMock = createTypedModelMock(REntityTagModel, ['findAllWithTags']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, relModelMock);
        actor = createActor({ permissions: [PermissionEnum.TAG_UPDATE] });
    });

    it('should return tags for an entity (success)', async () => {
        asMock(relModelMock.findAllWithTags).mockResolvedValue([relation]);
        const result = await service.getTagsForEntity(actor, input);
        expectSuccess(result);
        expect(result.data?.tags).toHaveLength(1);
        expect(result.data?.tags[0]).toEqual(tag);
    });

    it('should return an empty array if no tags are found', async () => {
        asMock(relModelMock.findAllWithTags).mockResolvedValue([]);
        const result = await service.getTagsForEntity(actor, input);
        expectSuccess(result);
        expect(result.data?.tags).toHaveLength(0);
    });

    it('should return FORBIDDEN if actor lacks TAG_UPDATE permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.getTagsForEntity(actor, input);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.getTagsForEntity(actor, {
            entityId: '',
            entityType: 'POST'
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        } as any);
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(relModelMock.findAllWithTags).mockRejectedValue(new Error('DB error'));
        const result = await service.getTagsForEntity(actor, input);
        expectInternalError(result);
    });
});
