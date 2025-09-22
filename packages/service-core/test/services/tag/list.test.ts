import { REntityTagModel, TagModel } from '@repo/db';
import { PermissionEnum, TagColorEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('TagService.list', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const tag = TagFactoryBuilder.create({ name: 'Tag', slug: 'tag', color: TagColorEnum.BLUE });
    const paginated = { items: [tag], total: 1 };

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, new REntityTagModel());
        actor = createActor({ permissions: [PermissionEnum.TAG_UPDATE] });
    });

    it('should return a paginated list of tags (success)', async () => {
        asMock(tagModelMock.findAll).mockResolvedValue(paginated);
        const result = await service.list(actor, {});
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
        expect(result.data?.total).toBe(1);
    });

    it('should succeed even if actor lacks TAG_UPDATE permission (public list)', async () => {
        actor = createActor({ permissions: [] });
        asMock(tagModelMock.findAll).mockResolvedValue(paginated);
        const result = await service.list(actor, {});
        expectSuccess(result);
        expect(result.data?.items).toHaveLength(1);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(tagModelMock.findAll).mockRejectedValue(new Error('DB error'));
        const result = await service.list(actor, {});
        expectInternalError(result);
    });
});
