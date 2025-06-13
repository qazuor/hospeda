import { EntityTagModel } from '@repo/db';
import { EntityTypeEnum, PermissionEnum } from '@repo/types';
import { type Mocked, beforeEach, describe, expect, it, vi } from 'vitest';
import { TagService } from '../../tag/tag.service';
import { getMockAccommodationId } from '../factories/accommodationFactory';
import { getMockDestinationId } from '../factories/destinationFactory';
import { getMockEventId } from '../factories/eventFactory';
import { getMockPostId } from '../factories/postFactory';
import { getMockTagId } from '../factories/tagFactory';
import { createMockUser, getMockUserId } from '../factories/userFactory';
import { mockServiceLogger } from '../setupTest';
import { expectInfoLog, expectNoPermissionLog, expectPermissionLog } from '../utils/log-assertions';

vi.mock('@repo/db', () => ({
    EntityTagModel: {
        delete: vi.fn()
    }
}));

beforeEach(() => {
    mockServiceLogger.permission.mockClear();
});

describe('TagService.removeTag', () => {
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

    it('should remove tag from accommodation with correct permission', async () => {
        (EntityTagModel.delete as Mocked<typeof EntityTagModel>['delete']).mockResolvedValue({
            tagId: getMockTagId(),
            entityId: getMockAccommodationId(),
            entityType: EntityTypeEnum.ACCOMMODATION
        });
        const result = await TagService.removeTag(
            {
                tagId: getMockTagId(),
                entityId: getMockAccommodationId(),
                entityType: EntityTypeEnum.ACCOMMODATION
            },
            user
        );
        expect(result.removed).toBe(true);
        expectInfoLog(
            {
                input: {
                    tagId: getMockTagId(),
                    entityId: getMockAccommodationId(),
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
            tagId: getMockTagId(),
            entityId: getMockDestinationId(),
            entityType: EntityTypeEnum.DESTINATION
        });
        const result = await TagService.removeTag(
            {
                tagId: getMockTagId(),
                entityId: getMockDestinationId(),
                entityType: EntityTypeEnum.DESTINATION
            },
            user
        );
        expect(result.removed).toBe(true);
        expectInfoLog(
            {
                input: {
                    tagId: getMockTagId(),
                    entityId: getMockDestinationId(),
                    entityType: EntityTypeEnum.DESTINATION
                },
                actor: user
            },
            'removeTag:start'
        );
        expectInfoLog({ result: { removed: true } }, 'removeTag:end');
    });

    it('should remove tag from event with correct permission', async () => {
        (EntityTagModel.delete as Mocked<typeof EntityTagModel>['delete']).mockResolvedValue({
            tagId: getMockTagId(),
            entityId: getMockEventId(),
            entityType: EntityTypeEnum.EVENT
        });
        const result = await TagService.removeTag(
            { tagId: getMockTagId(), entityId: getMockEventId(), entityType: EntityTypeEnum.EVENT },
            user
        );
        expect(result.removed).toBe(true);
        expectInfoLog(
            {
                input: {
                    tagId: getMockTagId(),
                    entityId: getMockEventId(),
                    entityType: EntityTypeEnum.EVENT
                },
                actor: user
            },
            'removeTag:start'
        );
        expectInfoLog({ result: { removed: true } }, 'removeTag:end');
    });

    it('should remove tag from post with correct permission', async () => {
        (EntityTagModel.delete as Mocked<typeof EntityTagModel>['delete']).mockResolvedValue({
            tagId: getMockTagId(),
            entityId: getMockPostId(),
            entityType: EntityTypeEnum.POST
        });
        const result = await TagService.removeTag(
            { tagId: getMockTagId(), entityId: getMockPostId(), entityType: EntityTypeEnum.POST },
            user
        );
        expect(result.removed).toBe(true);
        expectInfoLog(
            {
                input: {
                    tagId: getMockTagId(),
                    entityId: getMockPostId(),
                    entityType: EntityTypeEnum.POST
                },
                actor: user
            },
            'removeTag:start'
        );
        expectInfoLog({ result: { removed: true } }, 'removeTag:end');
    });

    it('should remove tag from user with correct permission', async () => {
        (EntityTagModel.delete as Mocked<typeof EntityTagModel>['delete']).mockResolvedValue({
            tagId: getMockTagId(),
            entityId: getMockUserId(),
            entityType: EntityTypeEnum.USER
        });
        const result = await TagService.removeTag(
            { tagId: getMockTagId(), entityId: getMockUserId(), entityType: EntityTypeEnum.USER },
            user
        );
        expect(result.removed).toBe(true);
        expectInfoLog(
            {
                input: {
                    tagId: getMockTagId(),
                    entityId: getMockUserId(),
                    entityType: EntityTypeEnum.USER
                },
                actor: user
            },
            'removeTag:start'
        );
        expectInfoLog({ result: { removed: true } }, 'removeTag:end');
    });

    it('should return removed: false if relation does not exist', async () => {
        (EntityTagModel.delete as Mocked<typeof EntityTagModel>['delete']).mockResolvedValue(
            undefined
        );
        const result = await TagService.removeTag(
            {
                tagId: getMockTagId(),
                entityId: getMockAccommodationId(),
                entityType: EntityTypeEnum.ACCOMMODATION
            },
            user
        );
        expect(result.removed).toBe(false);
        expectInfoLog(
            {
                input: {
                    tagId: getMockTagId(),
                    entityId: getMockAccommodationId(),
                    entityType: EntityTypeEnum.ACCOMMODATION
                },
                actor: user
            },
            'removeTag:start'
        );
        expectInfoLog({ result: { removed: false } }, 'removeTag:end');
    });

    it('should throw error if user lacks permission', async () => {
        const noPermUser = createMockUser({ permissions: [] });
        await expect(
            TagService.removeTag(
                {
                    tagId: getMockTagId(),
                    entityId: getMockAccommodationId(),
                    entityType: EntityTypeEnum.ACCOMMODATION
                },
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
                    tagId: getMockTagId(''),
                    entityId: getMockAccommodationId(''),
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
                    tagId: getMockTagId(),
                    entityId: getMockAccommodationId(),
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
                {
                    tagId: getMockTagId(),
                    entityId: getMockAccommodationId(),
                    entityType: EntityTypeEnum.ACCOMMODATION
                },
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
