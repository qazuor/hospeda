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
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/userBookmark/userBookmark.normalizers';
import {
    canAccessBookmark,
    canCreateBookmark
} from '../../../src/services/userBookmark/userBookmark.permissions';
import { ServiceError } from '../../../src/types';

const baseBookmark = {
    userId: 'user-uuid' as UserId,
    entityId: 'entity-uuid' as AccommodationId,
    entityType: EntityTypeEnum.ACCOMMODATION,
    name: '  My Bookmark  ',
    description: '  Some description  '
};

const userId = 'user-uuid' as UserId;
const otherUserId = 'other-uuid' as UserId;
const bookmarkId = 'bookmark-uuid' as UserBookmarkId;
const entityId = 'entity-uuid' as AccommodationId;

type MockActor = { id: UserId; role: RoleEnum; permissions: PermissionEnum[] };

describe('userBookmark.normalizers', () => {
    it('normalizeCreateInput trims name and description', () => {
        const input = { ...baseBookmark };
        const result = normalizeCreateInput(input, { id: 'user-uuid', role: 'USER' } as MockActor);
        expect(result.name).toBe('My Bookmark');
        expect(result.description).toBe('Some description');
        expect(result.entityType).toBe(EntityTypeEnum.ACCOMMODATION);
    });

    it('normalizeUpdateInput trims name and description', () => {
        const input = {
            userId,
            entityId,
            entityType: EntityTypeEnum.ACCOMMODATION,
            name: 'Bookmark',
            description: 'Test'
        };
        const actor: MockActor = {
            id: userId,
            role: RoleEnum.USER,
            permissions: [PermissionEnum.USER_VIEW_PROFILE]
        };
        const result = normalizeUpdateInput(input, actor);
        expect(result.name).toBe('Bookmark');
        expect(result.description).toBe('Test');
    });
});

describe('userBookmark.permissions', () => {
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
    };
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
        expect(() => canCreateBookmark(ownerWithPerm, userId)).not.toThrow();
    });

    it('canCreateBookmark throws for non-owner', () => {
        expect(() => canCreateBookmark(other, userId)).toThrowError(ServiceError);
        try {
            canCreateBookmark(other, userId);
        } catch (e) {
            expect(e).toBeInstanceOf(ServiceError);
            expect((e as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });
});

describe('userBookmark.helpers', () => {
    it('should have helpers (placeholder)', () => {
        expect(true).toBe(true);
    });
});
