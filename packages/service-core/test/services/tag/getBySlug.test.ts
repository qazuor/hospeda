import { REntityTagModel, TagModel } from '@repo/db';
import { TagColorEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import { expectInternalError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('TagService.getBySlug', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const tag = TagFactoryBuilder.create({
        name: 'Tag',
        slug: 'tag-slug',
        color: TagColorEnum.BLUE
    });

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['findOne']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, new REntityTagModel());
        actor = createActor({ permissions: [] });
    });

    it('should return a tag by slug (success)', async () => {
        asMock(tagModelMock.findOne).mockResolvedValue(tag);
        const result = await service.getBySlug(actor, tag.slug);
        expectSuccess(result);
        expect(result.data).toEqual(tag);
    });

    it('should return NOT_FOUND error if tag does not exist', async () => {
        asMock(tagModelMock.findOne).mockResolvedValue(null);
        const result = await service.getBySlug(actor, tag.slug);
        expectNotFoundError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(tagModelMock.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.getBySlug(actor, tag.slug);
        expectInternalError(result);
    });
});
