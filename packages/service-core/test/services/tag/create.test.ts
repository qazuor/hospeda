import { REntityTagModel, TagModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, TagColorEnum } from '@repo/schemas';
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

describe('TagService.create', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const input = {
        name: 'Tag',
        slug: 'tag',
        color: TagColorEnum.BLUE,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
    const createdTag = TagFactoryBuilder.create(input);

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['create', 'findOne']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, new REntityTagModel());
        actor = createActor({ permissions: [PermissionEnum.TAG_CREATE] });
    });

    it('should create a tag (success)', async () => {
        asMock(tagModelMock.findOne).mockResolvedValue(null); // slug uniqueness
        asMock(tagModelMock.create).mockResolvedValue(createdTag);
        const result = await service.create(actor, input);
        expectSuccess(result);
        expect(result.data).toMatchObject(input);
    });

    it('should return FORBIDDEN if actor lacks TAG_CREATE permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.create(actor, input);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // name empty
        const result = await service.create(actor, {
            name: '',
            slug: 'tag',
            color: TagColorEnum.BLUE,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(tagModelMock.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.create(actor, input);
        expectInternalError(result);
    });
});
