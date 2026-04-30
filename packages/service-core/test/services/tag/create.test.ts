import { REntityTagModel, TagModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, TagColorEnum, TagTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Intercept withTransaction so USER tag quota check works without a real DB.
// The mock calls the callback with a fake DrizzleClient (execute returns []).
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        withTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
            const fakeTx = { execute: vi.fn().mockResolvedValue([]) };
            return callback(fakeTx);
        })
    };
});
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

    // Valid SYSTEM tag input — no slug, no notes, requires type
    const input = {
        name: 'Tag',
        type: TagTypeEnum.SYSTEM,
        color: TagColorEnum.BLUE,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        ownerId: null
    };
    const createdTag = TagFactoryBuilder.create({ ...input });

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, [
            'create',
            'findByType',
            'countActiveByOwner'
        ]);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, new REntityTagModel());
        actor = createActor({ permissions: [PermissionEnum.TAG_SYSTEM_CREATE] });

        // No cross-type collision by default
        asMock(tagModelMock.findByType).mockResolvedValue([]);
    });

    it('should create a SYSTEM tag (success)', async () => {
        asMock(tagModelMock.create).mockResolvedValue(createdTag);
        const result = await service.create(actor, input);
        expectSuccess(result);
        expect(result.data).toMatchObject({ name: 'Tag', type: TagTypeEnum.SYSTEM });
    });

    it('should return FORBIDDEN if actor lacks TAG_SYSTEM_CREATE', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.create(actor, input);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for empty name', async () => {
        const result = await service.create(actor, { ...input, name: '' });
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws during create', async () => {
        asMock(tagModelMock.create).mockRejectedValue(new Error('DB error'));
        const result = await service.create(actor, input);
        expectInternalError(result);
    });

    it('should create a USER tag with ownerId', async () => {
        const ownerId = 'a1b2c3d4-0000-4000-a000-000000000001';
        const userActor = createActor({
            id: ownerId,
            permissions: [PermissionEnum.TAG_USER_CREATE]
        });
        const userInput = {
            name: 'My Tag',
            type: TagTypeEnum.USER,
            color: TagColorEnum.GREEN,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            ownerId
        };
        const userTag = TagFactoryBuilder.createUserTag('a1b2c3d4-0000-4000-a000-000000000001', {
            name: 'My Tag'
        });
        asMock(tagModelMock.findByType).mockResolvedValue([]);
        // USER tag quota check: countActiveByOwner returns 0 (quota not exceeded)
        asMock(tagModelMock.countActiveByOwner).mockResolvedValue(0);
        asMock(tagModelMock.create).mockResolvedValue(userTag);

        const result = await service.create(userActor, userInput);
        expectSuccess(result);
        expect(result.data?.type).toBe(TagTypeEnum.USER);
        expect(result.data?.ownerId).toBe(ownerId);
    });

    it('should not include slug in created tag (slug removed per D-002)', async () => {
        asMock(tagModelMock.create).mockResolvedValue(createdTag);
        const result = await service.create(actor, input);
        expectSuccess(result);
        expect(result.data).not.toHaveProperty('slug');
    });
});
