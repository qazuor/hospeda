import {
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    TagColorEnum,
    TagTypeEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    assertCanCreateTag,
    assertCanDeleteTag,
    assertCanUpdateTag,
    assertCanViewAllAssignments,
    assertCanViewAllUserTags,
    assertCanViewTag,
    checkCanAdminList,
    checkCanCountTags,
    checkCanListTags,
    checkCanRestoreTag,
    checkCanSearchTags,
    checkCanSoftDeleteTag
} from '../../../src/services/tag/tag.permissions';
import { ServiceError } from '../../../src/types';
import { TagFactoryBuilder } from '../../factories/tagFactory';

const baseActor = { id: 'actor-id', role: RoleEnum.ADMIN, permissions: [] };
const ownerId = 'actor-id'; // same as baseActor.id for ownership tests

const systemTag = TagFactoryBuilder.create({
    type: TagTypeEnum.SYSTEM,
    ownerId: null,
    color: TagColorEnum.BLUE
});
const internalTag = TagFactoryBuilder.createInternalTag({ name: 'Spam', color: TagColorEnum.RED });
const userTag = TagFactoryBuilder.createUserTag(ownerId, {
    name: 'My Tag',
    color: TagColorEnum.GREEN
});
const otherUserTag = TagFactoryBuilder.createUserTag('other-user-id', { name: 'Other Tag' });

/**
 * Tests for tag permission helpers (SPEC-086 D-017).
 *
 * Permission dispatch is per tag type:
 * - INTERNAL → TAG_INTERNAL_*
 * - SYSTEM   → TAG_SYSTEM_*
 * - USER     → TAG_USER_*_OWN (own) or TAG_USER_*_ANY (super-admin)
 */
describe('tag.permissions (SPEC-086 D-017)', () => {
    // ---------------------------------------------------------------------------
    // assertCanCreateTag
    // ---------------------------------------------------------------------------
    describe('assertCanCreateTag', () => {
        it('allows INTERNAL creation with TAG_INTERNAL_CREATE', () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.TAG_INTERNAL_CREATE] };
            expect(() => assertCanCreateTag(actor, TagTypeEnum.INTERNAL)).not.toThrow();
        });

        it('denies INTERNAL creation without TAG_INTERNAL_CREATE', () => {
            expect(() => assertCanCreateTag(baseActor, TagTypeEnum.INTERNAL)).toThrow(ServiceError);
        });

        it('allows SYSTEM creation with TAG_SYSTEM_CREATE', () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.TAG_SYSTEM_CREATE] };
            expect(() => assertCanCreateTag(actor, TagTypeEnum.SYSTEM)).not.toThrow();
        });

        it('denies SYSTEM creation without TAG_SYSTEM_CREATE', () => {
            expect(() => assertCanCreateTag(baseActor, TagTypeEnum.SYSTEM)).toThrow(ServiceError);
        });

        it('allows USER creation with TAG_USER_CREATE', () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.TAG_USER_CREATE] };
            expect(() => assertCanCreateTag(actor, TagTypeEnum.USER)).not.toThrow();
        });

        it('denies USER creation without TAG_USER_CREATE', () => {
            expect(() => assertCanCreateTag(baseActor, TagTypeEnum.USER)).toThrow(ServiceError);
        });
    });

    // ---------------------------------------------------------------------------
    // assertCanUpdateTag
    // ---------------------------------------------------------------------------
    describe('assertCanUpdateTag', () => {
        it('allows INTERNAL update with TAG_INTERNAL_UPDATE', () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.TAG_INTERNAL_UPDATE] };
            expect(() => assertCanUpdateTag(actor, internalTag)).not.toThrow();
        });

        it('denies INTERNAL update without TAG_INTERNAL_UPDATE', () => {
            expect(() => assertCanUpdateTag(baseActor, internalTag)).toThrow(ServiceError);
        });

        it('allows SYSTEM update with TAG_SYSTEM_UPDATE', () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.TAG_SYSTEM_UPDATE] };
            expect(() => assertCanUpdateTag(actor, systemTag)).not.toThrow();
        });

        it('allows own USER update with TAG_USER_UPDATE_OWN', () => {
            const actor = {
                ...baseActor,
                id: ownerId,
                permissions: [PermissionEnum.TAG_USER_UPDATE_OWN]
            };
            expect(() => assertCanUpdateTag(actor, userTag)).not.toThrow();
        });

        it('denies USER update when actor is not owner (no TAG_USER_UPDATE_ANY exists per D-012)', () => {
            const actor = {
                ...baseActor,
                id: 'other-actor',
                permissions: [PermissionEnum.TAG_USER_UPDATE_OWN]
            };
            expect(() => assertCanUpdateTag(actor, userTag)).toThrow(ServiceError);
        });
    });

    // ---------------------------------------------------------------------------
    // assertCanDeleteTag
    // ---------------------------------------------------------------------------
    describe('assertCanDeleteTag', () => {
        it('allows INTERNAL delete with TAG_INTERNAL_DELETE', () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.TAG_INTERNAL_DELETE] };
            expect(() => assertCanDeleteTag(actor, internalTag)).not.toThrow();
        });

        it('denies INTERNAL delete without TAG_INTERNAL_DELETE', () => {
            expect(() => assertCanDeleteTag(baseActor, internalTag)).toThrow(ServiceError);
        });

        it('allows SYSTEM delete with TAG_SYSTEM_DELETE', () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.TAG_SYSTEM_DELETE] };
            expect(() => assertCanDeleteTag(actor, systemTag)).not.toThrow();
        });

        it('allows own USER delete with TAG_USER_DELETE_OWN', () => {
            const actor = {
                ...baseActor,
                id: ownerId,
                permissions: [PermissionEnum.TAG_USER_DELETE_OWN]
            };
            expect(() => assertCanDeleteTag(actor, userTag)).not.toThrow();
        });

        it('allows any USER delete with TAG_USER_DELETE_ANY (super-admin)', () => {
            const actor = {
                ...baseActor,
                id: 'superadmin',
                permissions: [PermissionEnum.TAG_USER_DELETE_ANY]
            };
            expect(() => assertCanDeleteTag(actor, otherUserTag)).not.toThrow();
        });

        it('denies USER delete when neither OWN nor ANY permission', () => {
            expect(() => assertCanDeleteTag(baseActor, userTag)).toThrow(ServiceError);
        });

        it('denies USER delete when actor is not owner and only has TAG_USER_DELETE_OWN', () => {
            const actor = {
                ...baseActor,
                id: 'not-owner',
                permissions: [PermissionEnum.TAG_USER_DELETE_OWN]
            };
            expect(() => assertCanDeleteTag(actor, otherUserTag)).toThrow(ServiceError);
        });
    });

    // ---------------------------------------------------------------------------
    // assertCanViewTag
    // ---------------------------------------------------------------------------
    describe('assertCanViewTag', () => {
        it('allows INTERNAL view with TAG_INTERNAL_VIEW', () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.TAG_INTERNAL_VIEW] };
            expect(() => assertCanViewTag(actor, internalTag)).not.toThrow();
        });

        it('denies INTERNAL view without TAG_INTERNAL_VIEW', () => {
            expect(() => assertCanViewTag(baseActor, internalTag)).toThrow(ServiceError);
        });

        it('allows SYSTEM view for any authenticated actor (no special permission needed)', () => {
            expect(() => assertCanViewTag(baseActor, systemTag)).not.toThrow();
        });

        it('allows own USER view with TAG_USER_VIEW_OWN', () => {
            const actor = {
                ...baseActor,
                id: ownerId,
                permissions: [PermissionEnum.TAG_USER_VIEW_OWN]
            };
            expect(() => assertCanViewTag(actor, userTag)).not.toThrow();
        });

        it('allows other USER view with TAG_VIEW_ALL_USER_TAGS (super-admin)', () => {
            const actor = {
                ...baseActor,
                id: 'superadmin',
                permissions: [PermissionEnum.TAG_VIEW_ALL_USER_TAGS]
            };
            expect(() => assertCanViewTag(actor, otherUserTag)).not.toThrow();
        });

        it('denies USER view when actor is not owner and lacks TAG_VIEW_ALL_USER_TAGS', () => {
            const actor = { ...baseActor, id: 'not-owner', permissions: [] };
            expect(() => assertCanViewTag(actor, otherUserTag)).toThrow(ServiceError);
        });

        it('requires authenticated actor (actor.id must be truthy)', () => {
            const anon = { ...baseActor, id: '' };
            expect(() => assertCanViewTag(anon, systemTag)).toThrow(ServiceError);
        });
    });

    // ---------------------------------------------------------------------------
    // Cross-cutting view helpers
    // ---------------------------------------------------------------------------
    describe('assertCanViewAllAssignments', () => {
        it('allows with TAG_VIEW_ALL_ASSIGNMENTS', () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.TAG_VIEW_ALL_ASSIGNMENTS] };
            expect(() => assertCanViewAllAssignments(actor)).not.toThrow();
        });

        it('denies without TAG_VIEW_ALL_ASSIGNMENTS', () => {
            expect(() => assertCanViewAllAssignments(baseActor)).toThrow(ServiceError);
        });
    });

    describe('assertCanViewAllUserTags', () => {
        it('allows with TAG_VIEW_ALL_USER_TAGS', () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.TAG_VIEW_ALL_USER_TAGS] };
            expect(() => assertCanViewAllUserTags(actor)).not.toThrow();
        });

        it('denies without TAG_VIEW_ALL_USER_TAGS', () => {
            expect(() => assertCanViewAllUserTags(baseActor)).toThrow(ServiceError);
        });
    });

    // ---------------------------------------------------------------------------
    // Soft-delete and restore — always FORBIDDEN (D-011)
    // ---------------------------------------------------------------------------
    describe('checkCanSoftDeleteTag', () => {
        it('always throws FORBIDDEN (hard delete only per D-011)', () => {
            const actor = { ...baseActor, permissions: Object.values(PermissionEnum) };
            const err = (() => {
                try {
                    checkCanSoftDeleteTag(actor, systemTag);
                } catch (e) {
                    return e;
                }
            })();
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
    });

    describe('checkCanRestoreTag', () => {
        it('always throws FORBIDDEN (hard delete only per D-011)', () => {
            const actor = { ...baseActor, permissions: Object.values(PermissionEnum) };
            const err = (() => {
                try {
                    checkCanRestoreTag(actor, systemTag);
                } catch (e) {
                    return e;
                }
            })();
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
    });

    // ---------------------------------------------------------------------------
    // List / search / count — any authenticated actor
    // ---------------------------------------------------------------------------
    describe('checkCanListTags / checkCanSearchTags / checkCanCountTags', () => {
        it('checkCanListTags allows authenticated actor', () => {
            expect(() => checkCanListTags(baseActor)).not.toThrow();
        });

        it('checkCanListTags denies anonymous actor (no id)', () => {
            expect(() => checkCanListTags({ ...baseActor, id: '' })).toThrow(ServiceError);
        });

        it('checkCanSearchTags allows authenticated actor', () => {
            expect(() => checkCanSearchTags(baseActor)).not.toThrow();
        });

        it('checkCanCountTags allows authenticated actor', () => {
            expect(() => checkCanCountTags(baseActor)).not.toThrow();
        });
    });

    // ---------------------------------------------------------------------------
    // Admin list
    // ---------------------------------------------------------------------------
    describe('checkCanAdminList', () => {
        it('allows actor with TAG_INTERNAL_VIEW', () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.TAG_INTERNAL_VIEW] };
            expect(() => checkCanAdminList(actor)).not.toThrow();
        });

        it('allows actor with TAG_SYSTEM_VIEW', () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.TAG_SYSTEM_VIEW] };
            expect(() => checkCanAdminList(actor)).not.toThrow();
        });

        it('allows actor with TAG_VIEW_ALL_USER_TAGS', () => {
            const actor = { ...baseActor, permissions: [PermissionEnum.TAG_VIEW_ALL_USER_TAGS] };
            expect(() => checkCanAdminList(actor)).not.toThrow();
        });

        it('denies actor without any tag view permission', () => {
            const err = (() => {
                try {
                    checkCanAdminList(baseActor);
                } catch (e) {
                    return e;
                }
            })();
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
    });
});
