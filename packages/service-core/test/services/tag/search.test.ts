import { REntityTagModel, TagModel } from '@repo/db';
import { TagColorEnum, TagTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('TagService.search', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;

    const tag = TagFactoryBuilder.create({
        name: 'Tag',
        type: TagTypeEnum.SYSTEM,
        color: TagColorEnum.BLUE,
        ownerId: null
    });
    const paginated = { items: [tag], total: 1 };
    const searchParams = {
        page: 1,
        pageSize: 10,
        filters: { nameContains: 'Tag' },
        fuzzySearch: true
    };

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, new REntityTagModel());
        actor = createActor({ permissions: [] });
    });

    it('should return a paginated list of tags matching search params (success)', async () => {
        asMock(tagModelMock.findAll).mockResolvedValue(paginated);
        const result = await service.search(actor, searchParams);
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
        expect(result.data?.total).toBe(1);
    });

    it('should succeed for any authenticated actor (visibility scoped at service layer)', async () => {
        actor = createActor({ permissions: [] });
        asMock(tagModelMock.findAll).mockResolvedValue(paginated);
        const result = await service.search(actor, searchParams);
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(tagModelMock.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.search(actor, searchParams);
        expectInternalError(result);
    });
});
