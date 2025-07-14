import type { AccommodationId, UserBookmarkId, UserBookmarkType, UserId } from '@repo/types';
import {
    EntityTypeEnum,
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
    canAccessBookmark,
    canCreateBookmark
} from '../../../src/services/userBookmark/userBookmark.permissions';
import { ServiceError } from '../../../src/types';

const userId = 'user-uuid' as UserId;
const bookmarkId = 'bookmark-uuid' as UserBookmarkId;
const entityId = 'entity-uuid' as AccommodationId;
const otherUserId = 'other-uuid' as UserId;

type MockActor = { id: UserId; role: RoleEnum; permissions: PermissionEnum[] };

const owner: MockActor = {
    id: userId,
    role: RoleEnum.USER,
    permissions: [PermissionEnum.USER_VIEW_PROFILE]
};
const other: MockActor = {
    id: otherUserId,
    role: RoleEnum.USER,
    permissions: [PermissionEnum.USER_VIEW_PROFILE]
};

const bookmark: UserBookmarkType = {
    id: bookmarkId,
    userId,
    entityId,
    entityType: EntityTypeEnum.ACCOMMODATION,
    name: 'Bookmark',
    description: 'Test',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: userId,
    updatedById: userId,
    lifecycleState: LifecycleStatusEnum.ACTIVE
} as UserBookmarkType;

describe('userBookmark.permissions', () => {
    it('canAccessBookmark allows owner', () => {
        expect(() => canAccessBookmark(owner, bookmark)).not.toThrow();
    });

    it('canAccessBookmark throws for non-owner', () => {
        expect(() => canAccessBookmark(other, bookmark)).toThrowError(ServiceError);
        try {
            canAccessBookmark(other, bookmark);
        } catch (e) {
            expect(e).toBeInstanceOf(ServiceError);
            expect((e as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });

    it('canCreateBookmark allows owner', () => {
        const ownerWithPerm = { ...owner, permissions: [PermissionEnum.USER_BOOKMARK_MANAGE] };
        expect(() => canCreateBookmark(ownerWithPerm, bookmark.userId)).not.toThrow();
    });

    it('canCreateBookmark throws for non-owner', () => {
        expect(() => canCreateBookmark(other, bookmark.userId)).toThrowError(ServiceError);
        try {
            canCreateBookmark(other, bookmark.userId);
        } catch (e) {
            expect(e).toBeInstanceOf(ServiceError);
            expect((e as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });
});
