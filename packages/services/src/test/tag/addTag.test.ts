import { EntityTagModel } from '@repo/db';
import type { AccommodationId, TagId } from '@repo/types';
import { EntityTypeEnum, PermissionEnum } from '@repo/types';
import { type Mocked, beforeEach, describe, expect, it, vi } from 'vitest';
import { TagService } from '../../tag/tag.service';
import { createMockEntityTag } from '../factories';
import { getMockAccommodationId } from '../factories/accommodationFactory';
import { getMockDestinationId } from '../factories/destinationFactory';
import { getMockEventId } from '../factories/eventFactory';
import { getMockPostId } from '../factories/postFactory';
import { getMockTagId } from '../factories/tagFactory';
import { createMockUser, getMockUserId } from '../factories/userFactory';
import { expectInfoLog, expectNoPermissionLog, expectPermissionLog } from '../utils/log-assertions';

vi.mock('@repo/db', () => ({
    EntityTagModel: {
        create: vi.fn()
    }
}));

describe('TagService.addTag', () => {
    const user = createMockUser({
        permissions: [
            PermissionEnum.ACCOMMODATION_TAGS_MANAGE,
            PermissionEnum.DESTINATION_TAGS_MANAGE,
            PermissionEnum.EVENT_UPDATE,
            PermissionEnum.POST_TAGS_MANAGE,
            PermissionEnum.USER_UPDATE_PROFILE
        ]
    });
    const publicUser = createMockUser({ role: 'GUEST' });
    const tagId = getMockTagId();
    const accommodationId = getMockAccommodationId();
    const destinationId = getMockDestinationId();
    const eventId = getMockEventId();
    const postId = getMockPostId();
    const userId = getMockUserId();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should add tag to accommodation with correct permission', async () => {
        const entityTag = createMockEntityTag({
            tagId,
            entityId: accommodationId,
            entityType: EntityTypeEnum.ACCOMMODATION
        });
        (EntityTagModel.create as Mocked<typeof EntityTagModel>['create']).mockResolvedValue(
            entityTag
        );
        const result = await TagService.addTag(
            { tagId, entityId: accommodationId, entityType: EntityTypeEnum.ACCOMMODATION },
            user
        );
        expect(result.entityTag).toEqual(entityTag);
        expectInfoLog(
            {
                input: {
                    tagId,
                    entityId: accommodationId,
                    entityType: EntityTypeEnum.ACCOMMODATION
                },
                actor: user
            },
            'addTag:start'
        );
        expectInfoLog({ result: { entityTag } }, 'addTag:end');
    });

    it('should add tag to destination with correct permission', async () => {
        const entityTag = createMockEntityTag({
            tagId,
            entityId: destinationId,
            entityType: EntityTypeEnum.DESTINATION
        });
        (EntityTagModel.create as Mocked<typeof EntityTagModel>['create']).mockResolvedValue(
            entityTag
        );
        const result = await TagService.addTag(
            { tagId, entityId: destinationId, entityType: EntityTypeEnum.DESTINATION },
            user
        );
        expect(result.entityTag).toEqual(entityTag);
        expectInfoLog(
            {
                input: { tagId, entityId: destinationId, entityType: EntityTypeEnum.DESTINATION },
                actor: user
            },
            'addTag:start'
        );
        expectInfoLog({ result: { entityTag } }, 'addTag:end');
    });

    it('should add tag to event with correct permission', async () => {
        const entityTag = createMockEntityTag({
            tagId,
            entityId: eventId,
            entityType: EntityTypeEnum.EVENT
        });
        (EntityTagModel.create as Mocked<typeof EntityTagModel>['create']).mockResolvedValue(
            entityTag
        );
        const result = await TagService.addTag(
            { tagId, entityId: eventId, entityType: EntityTypeEnum.EVENT },
            user
        );
        expect(result.entityTag).toEqual(entityTag);
        expectInfoLog(
            { input: { tagId, entityId: eventId, entityType: EntityTypeEnum.EVENT }, actor: user },
            'addTag:start'
        );
        expectInfoLog({ result: { entityTag } }, 'addTag:end');
    });

    it('should add tag to post with correct permission', async () => {
        const entityTag = createMockEntityTag({
            tagId,
            entityId: postId,
            entityType: EntityTypeEnum.POST
        });
        (EntityTagModel.create as Mocked<typeof EntityTagModel>['create']).mockResolvedValue(
            entityTag
        );
        const result = await TagService.addTag(
            { tagId, entityId: postId, entityType: EntityTypeEnum.POST },
            user
        );
        expect(result.entityTag).toEqual(entityTag);
        expectInfoLog(
            { input: { tagId, entityId: postId, entityType: EntityTypeEnum.POST }, actor: user },
            'addTag:start'
        );
        expectInfoLog({ result: { entityTag } }, 'addTag:end');
    });

    it('should add tag to user with correct permission', async () => {
        const entityTag = createMockEntityTag({
            tagId,
            entityId: userId,
            entityType: EntityTypeEnum.USER
        });
        (EntityTagModel.create as Mocked<typeof EntityTagModel>['create']).mockResolvedValue(
            entityTag
        );
        const result = await TagService.addTag(
            { tagId, entityId: userId, entityType: EntityTypeEnum.USER },
            user
        );
        expect(result.entityTag).toEqual(entityTag);
        expectInfoLog(
            { input: { tagId, entityId: userId, entityType: EntityTypeEnum.USER }, actor: user },
            'addTag:start'
        );
        expectInfoLog({ result: { entityTag } }, 'addTag:end');
    });

    it('should throw error if user lacks permission', async () => {
        const noPermUser = createMockUser({ permissions: [] });
        await expect(
            TagService.addTag(
                { tagId, entityId: accommodationId, entityType: EntityTypeEnum.ACCOMMODATION },
                noPermUser
            )
        ).rejects.toThrow('Forbidden: insufficient permission to add tag');
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_TAGS_MANAGE,
            userId: noPermUser.id,
            role: noPermUser.role,
            extraData: expect.anything()
        });
    });

    it('should throw error for invalid input', async () => {
        await expect(
            TagService.addTag(
                {
                    tagId: '' as TagId,
                    entityId: '' as AccommodationId,
                    entityType: 'INVALID' as EntityTypeEnum
                },
                user
            )
        ).rejects.toThrow();
        expectNoPermissionLog();
    });

    it('should throw error for unsupported entity type', async () => {
        await expect(
            TagService.addTag(
                {
                    tagId: getMockTagId(),
                    entityId: getMockAccommodationId(),
                    entityType: 'SOMETHING_ELSE' as unknown as EntityTypeEnum
                },
                user
            )
        ).rejects.toThrowError();
        expectNoPermissionLog();
    });

    it('should throw error if public user tries to add tag', async () => {
        await expect(
            TagService.addTag(
                { tagId, entityId: accommodationId, entityType: EntityTypeEnum.ACCOMMODATION },
                publicUser
            )
        ).rejects.toThrow('Forbidden: insufficient permission to add tag');
        expect(mockServiceLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: 'UNKNOWN_PERMISSION',
                role: 'GUEST',
                userId: 'public',
                extraData: expect.objectContaining({
                    error: 'Forbidden: insufficient permission to add tag'
                })
            })
        );
    });
});
