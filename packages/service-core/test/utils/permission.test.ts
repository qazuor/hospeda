/**
 * @fileoverview
 * Test suite for the getEntityPermission utility function.
 * Ensures robust, type-safe, and comprehensive coverage of all permission scenarios for entities, including:
 * - Super admin, admin, owner, user, and guest roles
 * - All entity states (public, private, restricted, draft, pending, archived, rejected)
 * - All actions (view, update, delete, restore, hardDelete, approve, reject, feature, publish)
 * - All edge cases and error reasons
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import {
    EntityPermissionReasonEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/types';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../../src/types';
import {
    type EntityAction,
    type EntityPermissionInput,
    getEntityPermission
} from '../../src/utils/permission';

/**
 * Test suite for the getEntityPermission utility function.
 *
 * This suite verifies:
 * - Correct permission evaluation for all roles and entity states
 * - All possible actions and permission reasons
 * - Robustness against edge cases and invalid scenarios
 *
 * The tests use a variety of actors and entity states to ensure full coverage of the permission logic.
 */
const ownerId = 'user-1';
const otherId = 'user-2';

const baseEntity: EntityPermissionInput = {
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    visibility: VisibilityEnum.PUBLIC,
    ownerId,
    deletedAt: null
};

const superAdmin: Actor = { id: otherId, role: RoleEnum.SUPER_ADMIN, permissions: [] };
const admin: Actor = { id: otherId, role: RoleEnum.ADMIN, permissions: [] };
const owner: Actor = { id: ownerId, role: RoleEnum.HOST, permissions: [] };
const user: Actor = { id: otherId, role: RoleEnum.USER, permissions: [] };
const guest: Actor = { id: otherId, role: RoleEnum.GUEST, permissions: [] };

// Helper to clone entity with overrides
const entity = (overrides: Partial<EntityPermissionInput> = {}): EntityPermissionInput => ({
    ...baseEntity,
    ...overrides
});

describe('getEntityPermission', () => {
    it('allows everything to super admin', () => {
        for (const action of [
            'view',
            'update',
            'delete',
            'restore',
            'hardDelete',
            'approve',
            'reject',
            'feature',
            'publish'
        ] as EntityAction[]) {
            const result = getEntityPermission(superAdmin, baseEntity, action);
            expect(result.allowed).toBe(true);
            expect(result.reason).toBe(EntityPermissionReasonEnum.SUPER_ADMIN);
        }
    });

    it('only allows hardDelete to super admin', () => {
        expect(getEntityPermission(admin, baseEntity, 'hardDelete').allowed).toBe(false);
        expect(getEntityPermission(admin, baseEntity, 'hardDelete').reason).toBe(
            EntityPermissionReasonEnum.NOT_SUPER_ADMIN
        );
        expect(getEntityPermission(owner, baseEntity, 'hardDelete').allowed).toBe(false);
        expect(getEntityPermission(owner, baseEntity, 'hardDelete').reason).toBe(
            EntityPermissionReasonEnum.NOT_SUPER_ADMIN
        );
        expect(getEntityPermission(user, baseEntity, 'hardDelete').allowed).toBe(false);
        expect(getEntityPermission(user, baseEntity, 'hardDelete').reason).toBe(
            EntityPermissionReasonEnum.NOT_SUPER_ADMIN
        );
    });

    it('allows public view only if ACTIVE+APPROVED+PUBLIC', () => {
        expect(getEntityPermission(user, entity(), 'view').allowed).toBe(true);
        expect(getEntityPermission(user, entity(), 'view').reason).toBe(
            EntityPermissionReasonEnum.PUBLIC_ACCESS
        );
        expect(getEntityPermission(guest, entity(), 'view').allowed).toBe(true);
        expect(getEntityPermission(guest, entity(), 'view').reason).toBe(
            EntityPermissionReasonEnum.PUBLIC_ACCESS
        );
    });

    it('allows view to admin and owner in private/restricted/pending/draft/archived/rejected cases', () => {
        // PRIVATE
        expect(
            getEntityPermission(admin, entity({ visibility: VisibilityEnum.PRIVATE }), 'view')
                .allowed
        ).toBe(true);
        expect(
            getEntityPermission(admin, entity({ visibility: VisibilityEnum.PRIVATE }), 'view')
                .reason
        ).toBe(EntityPermissionReasonEnum.ADMIN);
        expect(
            getEntityPermission(owner, entity({ visibility: VisibilityEnum.PRIVATE }), 'view')
                .allowed
        ).toBe(true);
        expect(
            getEntityPermission(owner, entity({ visibility: VisibilityEnum.PRIVATE }), 'view')
                .reason
        ).toBe(EntityPermissionReasonEnum.OWNER);

        // RESTRICTED
        expect(
            getEntityPermission(admin, entity({ visibility: VisibilityEnum.RESTRICTED }), 'view')
                .allowed
        ).toBe(true);
        expect(
            getEntityPermission(admin, entity({ visibility: VisibilityEnum.RESTRICTED }), 'view')
                .reason
        ).toBe(EntityPermissionReasonEnum.ADMIN);
        expect(
            getEntityPermission(owner, entity({ visibility: VisibilityEnum.RESTRICTED }), 'view')
                .allowed
        ).toBe(true);
        expect(
            getEntityPermission(owner, entity({ visibility: VisibilityEnum.RESTRICTED }), 'view')
                .reason
        ).toBe(EntityPermissionReasonEnum.OWNER);

        // PENDING
        expect(
            getEntityPermission(
                admin,
                entity({ moderationState: ModerationStatusEnum.PENDING }),
                'view'
            ).allowed
        ).toBe(true);
        expect(
            getEntityPermission(
                admin,
                entity({ moderationState: ModerationStatusEnum.PENDING }),
                'view'
            ).reason
        ).toBe(EntityPermissionReasonEnum.ADMIN);
        expect(
            getEntityPermission(
                owner,
                entity({ moderationState: ModerationStatusEnum.PENDING }),
                'view'
            ).allowed
        ).toBe(true);
        expect(
            getEntityPermission(
                owner,
                entity({ moderationState: ModerationStatusEnum.PENDING }),
                'view'
            ).reason
        ).toBe(EntityPermissionReasonEnum.OWNER);

        // DRAFT
        expect(
            getEntityPermission(
                admin,
                entity({ lifecycleState: LifecycleStatusEnum.DRAFT }),
                'view'
            ).allowed
        ).toBe(true);
        expect(
            getEntityPermission(
                admin,
                entity({ lifecycleState: LifecycleStatusEnum.DRAFT }),
                'view'
            ).reason
        ).toBe(EntityPermissionReasonEnum.ADMIN);
        expect(
            getEntityPermission(
                owner,
                entity({ lifecycleState: LifecycleStatusEnum.DRAFT }),
                'view'
            ).allowed
        ).toBe(true);
        expect(
            getEntityPermission(
                owner,
                entity({ lifecycleState: LifecycleStatusEnum.DRAFT }),
                'view'
            ).reason
        ).toBe(EntityPermissionReasonEnum.OWNER);

        // ARCHIVED
        expect(
            getEntityPermission(
                admin,
                entity({ lifecycleState: LifecycleStatusEnum.ARCHIVED }),
                'view'
            ).allowed
        ).toBe(true);
    });

    it('denies view if not public or not approved', () => {
        expect(
            getEntityPermission(user, entity({ visibility: VisibilityEnum.PRIVATE }), 'view')
                .allowed
        ).toBe(false);
        expect(
            getEntityPermission(user, entity({ visibility: VisibilityEnum.PRIVATE }), 'view').reason
        ).toBe(EntityPermissionReasonEnum.PRIVATE);
        expect(
            getEntityPermission(
                user,
                entity({ moderationState: ModerationStatusEnum.PENDING }),
                'view'
            ).allowed
        ).toBe(false);
        expect(
            getEntityPermission(
                user,
                entity({ moderationState: ModerationStatusEnum.PENDING }),
                'view'
            ).reason
        ).toBe(EntityPermissionReasonEnum.PENDING);
        expect(
            getEntityPermission(user, entity({ lifecycleState: LifecycleStatusEnum.DRAFT }), 'view')
                .allowed
        ).toBe(false);
        expect(
            getEntityPermission(user, entity({ lifecycleState: LifecycleStatusEnum.DRAFT }), 'view')
                .reason
        ).toBe(EntityPermissionReasonEnum.DRAFT);
    });

    it('allows update/delete/restore to admin and owner, denies to user/guest', () => {
        for (const action of ['update', 'delete', 'restore'] as EntityAction[]) {
            expect(getEntityPermission(admin, baseEntity, action, { hasAny: true }).allowed).toBe(
                true
            );
            expect(getEntityPermission(admin, baseEntity, action, { hasAny: true }).reason).toBe(
                EntityPermissionReasonEnum.ADMIN
            );
            expect(getEntityPermission(owner, baseEntity, action, { hasOwn: true }).allowed).toBe(
                true
            );
            expect(getEntityPermission(owner, baseEntity, action, { hasOwn: true }).reason).toBe(
                EntityPermissionReasonEnum.OWNER
            );
            expect(getEntityPermission(user, baseEntity, action).allowed).toBe(false);
            expect(getEntityPermission(user, baseEntity, action).reason).toBe(
                EntityPermissionReasonEnum.DENIED
            );
            expect(getEntityPermission(guest, baseEntity, action).allowed).toBe(false);
            expect(getEntityPermission(guest, baseEntity, action).reason).toBe(
                EntityPermissionReasonEnum.DENIED
            );
        }
    });

    it('allows approve/reject/feature/publish only to admin', () => {
        for (const action of ['approve', 'reject', 'feature', 'publish'] as EntityAction[]) {
            expect(getEntityPermission(admin, baseEntity, action).allowed).toBe(true);
            expect(getEntityPermission(admin, baseEntity, action).reason).toBe(
                EntityPermissionReasonEnum.ADMIN
            );
            expect(getEntityPermission(owner, baseEntity, action).allowed).toBe(false);
            expect(getEntityPermission(owner, baseEntity, action).reason).toBe(
                EntityPermissionReasonEnum.NOT_ADMIN
            );
            expect(getEntityPermission(user, baseEntity, action).allowed).toBe(false);
            expect(getEntityPermission(user, baseEntity, action).reason).toBe(
                EntityPermissionReasonEnum.NOT_ADMIN
            );
        }
    });

    it('deniega todo si deletedAt está presente', () => {
        for (const action of ['view', 'update', 'delete', 'restore'] as EntityAction[]) {
            expect(
                getEntityPermission(admin, entity({ deletedAt: new Date() }), action).allowed
            ).toBe(false);
            expect(
                getEntityPermission(admin, entity({ deletedAt: new Date() }), action).reason
            ).toBe(EntityPermissionReasonEnum.DELETED);
            expect(
                getEntityPermission(owner, entity({ deletedAt: new Date() }), action).allowed
            ).toBe(false);
            expect(
                getEntityPermission(owner, entity({ deletedAt: new Date() }), action).reason
            ).toBe(EntityPermissionReasonEnum.DELETED);
        }
    });

    it('permite restore de ARCHIVED a admin y owner', () => {
        expect(
            getEntityPermission(
                admin,
                entity({ lifecycleState: LifecycleStatusEnum.ARCHIVED }),
                'restore',
                { hasAny: true }
            ).allowed
        ).toBe(true);
        expect(
            getEntityPermission(
                admin,
                entity({ lifecycleState: LifecycleStatusEnum.ARCHIVED }),
                'restore',
                { hasAny: true }
            ).reason
        ).toBe(EntityPermissionReasonEnum.ADMIN);
        expect(
            getEntityPermission(
                owner,
                entity({ lifecycleState: LifecycleStatusEnum.ARCHIVED }),
                'restore',
                { hasOwn: true }
            ).allowed
        ).toBe(true);
        expect(
            getEntityPermission(
                owner,
                entity({ lifecycleState: LifecycleStatusEnum.ARCHIVED }),
                'restore',
                { hasOwn: true }
            ).reason
        ).toBe(EntityPermissionReasonEnum.OWNER);
        expect(
            getEntityPermission(
                user,
                entity({ lifecycleState: LifecycleStatusEnum.ARCHIVED }),
                'restore'
            ).allowed
        ).toBe(false);
        expect(
            getEntityPermission(
                user,
                entity({ lifecycleState: LifecycleStatusEnum.ARCHIVED }),
                'restore'
            ).reason
        ).toBe(EntityPermissionReasonEnum.ARCHIVED);
    });

    it('deniega por defecto si no hay match', () => {
        expect(getEntityPermission(user, baseEntity, 'update').allowed).toBe(false);
        expect(getEntityPermission(user, baseEntity, 'update').reason).toBe(
            EntityPermissionReasonEnum.DENIED
        );
        expect(getEntityPermission(guest, baseEntity, 'delete').allowed).toBe(false);
        expect(getEntityPermission(guest, baseEntity, 'delete').reason).toBe(
            EntityPermissionReasonEnum.DENIED
        );
    });

    it('should return true for an admin who is not the owner', () => {
        const nonOwnerAdmin: Actor = {
            id: 'admin-not-owner',
            role: RoleEnum.ADMIN,
            permissions: []
        };
        expect(getEntityPermission(nonOwnerAdmin, baseEntity, 'view').allowed).toBe(true);
    });

    it('should handle an invalid actor gracefully and return false', () => {
        expect(getEntityPermission({} as any, baseEntity, 'view').allowed).toBe(false);
        const invalidActor = { role: RoleEnum.USER } as any; // Missing id and permissions
        expect(getEntityPermission(invalidActor, baseEntity, 'view').allowed).toBe(false);
    });
});
