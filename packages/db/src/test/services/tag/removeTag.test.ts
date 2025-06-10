import type { AccommodationId, TagId } from '@repo/types';
import { EntityTypeEnum, PermissionEnum } from '@repo/types';
import { type Mocked, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityTagModel } from '../../../models/tag/entity_tag.model';
import { TagService } from '../../../services/tag/tag.service';
import {
    getMockAccommodationId,
    getMockDestinationId,
    getMockEventId,
    getMockPostId,
    getMockPublicUser,
    getMockTagId,
    getMockUser,
    getMockUserId
} from '../mockData';

import {
    expectInfoLog,
    expectNoPermissionLog,
    expectPermissionLog
} from '../../utils/logAssertions';

vi.mock('../../../models/tag/entity_tag.model');

describe('TagService.removeTag', () => {
    const user = getMockUser({
        permissions: [
            PermissionEnum.ACCOMMODATION_TAGS_MANAGE,
            PermissionEnum.DESTINATION_TAGS_MANAGE,
            PermissionEnum.EVENT_UPDATE,
            PermissionEnum.POST_TAGS_MANAGE,
            PermissionEnum.USER_UPDATE_PROFILE
        ]
    });
    const publicUser = getMockPublicUser();
    const tagId = getMockTagId();
    const accommodationId = getMockAccommodationId();
    const destinationId = getMockDestinationId();
    const eventId = getMockEventId();
    const postId = getMockPostId();
    const userId = getMockUserId();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should remove tag from accommodation with correct permission', async () => {
        (EntityTagModel.delete as Mocked<typeof EntityTagModel>['delete']).mockResolvedValue({
            tagId,
            entityId: accommodationId,
            entityType: EntityTypeEnum.ACCOMMODATION
        });
        const result = await TagService.removeTag(
            { tagId, entityId: accommodationId, entityType: EntityTypeEnum.ACCOMMODATION },
            user
        );
        expect(result.removed).toBe(true);
        expectInfoLog(
            {
                input: {
                    tagId,
                    entityId: accommodationId,
                    entityType: EntityTypeEnum.ACCOMMODATION
                },
                actor: user
            },
            'removeTag:start'
        );
        expectInfoLog({ result: { removed: true } }, 'removeTag:end');
    });

    it('should remove tag from destination with correct permission', async () => {
        (EntityTagModel.delete as Mocked<typeof EntityTagModel>['delete']).mockResolvedValue({
            tagId,
            entityId: destinationId,
            entityType: EntityTypeEnum.DESTINATION
        });
        const result = await TagService.removeTag(
            { tagId, entityId: destinationId, entityType: EntityTypeEnum.DESTINATION },
            user
        );
        expect(result.removed).toBe(true);
        expectInfoLog(
            {
                input: { tagId, entityId: destinationId, entityType: EntityTypeEnum.DESTINATION },
                actor: user
            },
            'removeTag:start'
        );
        expectInfoLog({ result: { removed: true } }, 'removeTag:end');
    });

    it('should remove tag from event with correct permission', async () => {
        (EntityTagModel.delete as Mocked<typeof EntityTagModel>['delete']).mockResolvedValue({
            tagId,
            entityId: eventId,
            entityType: EntityTypeEnum.EVENT
        });
        const result = await TagService.removeTag(
            { tagId, entityId: eventId, entityType: EntityTypeEnum.EVENT },
            user
        );
        expect(result.removed).toBe(true);
        expectInfoLog(
            { input: { tagId, entityId: eventId, entityType: EntityTypeEnum.EVENT }, actor: user },
            'removeTag:start'
        );
        expectInfoLog({ result: { removed: true } }, 'removeTag:end');
    });

    it('should remove tag from post with correct permission', async () => {
        (EntityTagModel.delete as Mocked<typeof EntityTagModel>['delete']).mockResolvedValue({
            tagId,
            entityId: postId,
            entityType: EntityTypeEnum.POST
        });
        const result = await TagService.removeTag(
            { tagId, entityId: postId, entityType: EntityTypeEnum.POST },
            user
        );
        expect(result.removed).toBe(true);
        expectInfoLog(
            { input: { tagId, entityId: postId, entityType: EntityTypeEnum.POST }, actor: user },
            'removeTag:start'
        );
        expectInfoLog({ result: { removed: true } }, 'removeTag:end');
    });

    it('should remove tag from user with correct permission', async () => {
        (EntityTagModel.delete as Mocked<typeof EntityTagModel>['delete']).mockResolvedValue({
            tagId,
            entityId: userId,
            entityType: EntityTypeEnum.USER
        });
        const result = await TagService.removeTag(
            { tagId, entityId: userId, entityType: EntityTypeEnum.USER },
            user
        );
        expect(result.removed).toBe(true);
        expectInfoLog(
            { input: { tagId, entityId: userId, entityType: EntityTypeEnum.USER }, actor: user },
            'removeTag:start'
        );
        expectInfoLog({ result: { removed: true } }, 'removeTag:end');
    });

    it('should return removed: false if relation does not exist', async () => {
        (EntityTagModel.delete as Mocked<typeof EntityTagModel>['delete']).mockResolvedValue(
            undefined
        );
        const result = await TagService.removeTag(
            { tagId, entityId: accommodationId, entityType: EntityTypeEnum.ACCOMMODATION },
            user
        );
        expect(result.removed).toBe(false);
        expectInfoLog(
            {
                input: {
                    tagId,
                    entityId: accommodationId,
                    entityType: EntityTypeEnum.ACCOMMODATION
                },
                actor: user
            },
            'removeTag:start'
        );
        expectInfoLog({ result: { removed: false } }, 'removeTag:end');
    });

    it('should throw error if user lacks permission', async () => {
        const noPermUser = getMockUser({ permissions: [] });
        await expect(
            TagService.removeTag(
                { tagId, entityId: accommodationId, entityType: EntityTypeEnum.ACCOMMODATION },
                noPermUser
            )
        ).rejects.toThrow('Forbidden: insufficient permission to remove tag');
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_TAGS_MANAGE,
            userId: noPermUser.id,
            role: noPermUser.role,
            extraData: expect.anything()
        });
    });

    it('should throw error for invalid input', async () => {
        await expect(
            TagService.removeTag(
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
            TagService.removeTag(
                {
                    tagId,
                    entityId: accommodationId,
                    entityType: 'SOMETHING_ELSE' as unknown as EntityTypeEnum
                },
                user
            )
        ).rejects.toThrowError();
        expectNoPermissionLog();
    });

    it('should throw error if public user tries to remove tag', async () => {
        await expect(
            TagService.removeTag(
                { tagId, entityId: accommodationId, entityType: EntityTypeEnum.ACCOMMODATION },
                publicUser
            )
        ).rejects.toThrow('Forbidden: insufficient permission to remove tag');
        expect(mockServiceLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                permission: 'UNKNOWN_PERMISSION',
                role: 'GUEST',
                userId: 'public',
                extraData: expect.objectContaining({
                    error: 'Forbidden: insufficient permission to remove tag'
                })
            })
        );
    });
});
