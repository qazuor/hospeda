import { REntityTagModel, TagModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('TagService.count', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const countParams = { filters: { name: 'Tag' } };

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['count']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, new REntityTagModel());
        actor = createActor({ permissions: [PermissionEnum.TAG_UPDATE] });
    });

    it('should return the count of tags (success)', async () => {
        asMock(tagModelMock.count).mockResolvedValue(1);
        const result = await service.count(actor, countParams);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should succeed even if actor lacks TAG_UPDATE permission (public count)', async () => {
        actor = createActor({ permissions: [] });
        asMock(tagModelMock.count).mockResolvedValue(1);
        const result = await service.count(actor, countParams);
        expectSuccess(result);
        expect(result.data?.count).toBe(1);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(tagModelMock.count).mockRejectedValue(new Error('DB error'));
        const result = await service.count(actor, countParams);
        expectInternalError(result);
    });
});
