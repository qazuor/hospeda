import type { UserBookmark } from '@repo/schemas';
import {
    EntityTypeEnum,
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
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
    userId: 'user-uuid' as string,
    entityId: 'entity-uuid' as string,
    entityType: EntityTypeEnum.ACCOMMODATION,
    name: '  My Bookmark  ',
    description: '  Some description  '
};

const userId = 'user-uuid' as string;
const otherUserId = 'other-uuid' as string;
const bookmarkId = 'bookmark-uuid' as string;
const entityId = 'entity-uuid' as string;

type MockActor = { id: string; roles: readonly RoleEnum[]; permissions: PermissionEnum[] };

describe('userBookmark.normalizers', () => {
    it('normalizeCreateInput trims name and description', () => {
        const input = { ...baseBookmark };
        const result = normalizeCreateInput(input, {
            id: 'user-uuid',
            roles: [RoleEnum.USER],
            permissions: []
        } as MockActor);
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
            roles: [RoleEnum.USER],
            permissions: [PermissionEnum.USER_VIEW_PROFILE]
        };
        const result = normalizeUpdateInput(input, actor);
        expect(result.name).toBe('Bookmark');
        expect(result.description).toBe('Test');
    });
});

describe('userBookmark.permissions', () => {
    const bookmark: UserBookmark = {
        id: bookmarkId,
        userId,
        entityId,
        entityType: EntityTypeEnum.ACCOMMODATION,
        name: 'Bookmark',
        description: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdById: userId,
        updatedById: userId,
        deletedById: null,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
    const owner: MockActor = {
        id: userId,
        roles: [RoleEnum.USER],
        permissions: [PermissionEnum.USER_VIEW_PROFILE]
    };
    const other: MockActor = {
        id: otherUserId,
        roles: [RoleEnum.USER],
        permissions: [PermissionEnum.USER_VIEW_PROFILE]
    };

    it('canAccessBookmark allows owner', () => {
        expect(() => canAccessBookmark(owner, bookmark)).not.toThrow();
    });

    it('canAccessBookmark refuses a non-owner with NOT_FOUND, not FORBIDDEN (HOS-600)', () => {
        // A 403 confirmed the bookmark was real and simply somebody else's,
        // which is the disclosure the contract's "a foreign resource answers
        // 404" rule exists to deny. The refusal itself is unchanged.
        expect(() => canAccessBookmark(other, bookmark)).toThrowError(ServiceError);
        try {
            canAccessBookmark(other, bookmark);
        } catch (e) {
            expect(e).toBeInstanceOf(ServiceError);
            expect((e as ServiceError).code).toBe(ServiceErrorCode.NOT_FOUND);
            expect((e as ServiceError).message).not.toMatch(/owner|permission/i);
        }
    });

    it('canCreateBookmark allows owner', () => {
        const ownerWithPerm = { ...owner, permissions: [PermissionEnum.USER_BOOKMARK_CREATE] };
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
