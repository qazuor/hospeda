import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    canAddPermission,
    canAssignRole,
    canRemovePermission,
    canSetPermissions,
    canUpdateUser,
    canViewUser
} from '../../../src/services/user/user.permissions';
import { ServiceError } from '../../../src/types';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';

describe('user permission helpers', () => {
    // Regular user with no special permissions
    const self = createUser({ id: getMockId('user'), role: RoleEnum.USER, permissions: [] });

    // Super admin has ALL permissions (as assigned by actor middleware in production)
    const superAdmin = createUser({
        id: getMockId('user'),
        role: RoleEnum.SUPER_ADMIN,
        permissions: Object.values(PermissionEnum)
    });

    // Admin with USER_READ_ALL but no role management or update permissions
    const adminWithReadAll = createUser({
        id: getMockId('user', 'admin-read') as string,
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.USER_READ_ALL]
    });

    // Admin with USER_UPDATE_ANY permission (can update any user's profile)
    const adminWithUpdateAny = createUser({
        id: getMockId('user', 'admin-update') as string,
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.USER_UPDATE_ANY]
    });

    // Admin with USER_UPDATE_ROLES permission
    const adminWithRolePerms = createUser({
        id: getMockId('user', 'admin-roles') as string,
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.USER_UPDATE_ROLES]
    });

    // Admin with no relevant permissions
    const adminNoPerm = createUser({
        id: getMockId('user', 'admin-noperm') as string,
        role: RoleEnum.ADMIN,
        permissions: []
    });

    // Guest with no permissions
    const guestOther = createUser({
        id: getMockId('user', 'guest-other') as string,
        role: RoleEnum.GUEST,
        permissions: []
    });

    describe('canViewUser', () => {
        it('allows self', () => {
            expect(() => canViewUser(self, self)).not.toThrow();
        });
        it('allows super admin (has all permissions)', () => {
            expect(() => canViewUser(superAdmin, self)).not.toThrow();
        });
        it('allows admin with USER_READ_ALL viewing other', () => {
            expect(() => canViewUser(adminWithReadAll, self)).not.toThrow();
        });
        it('forbids admin without USER_READ_ALL viewing other', () => {
            try {
                canViewUser(adminNoPerm, self);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
        it('forbids guest viewing other', () => {
            try {
                canViewUser(guestOther, self);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
        it('forbids undefined actor', () => {
            expect(() => canViewUser(undefined, self)).toThrowError(/Missing actor/);
        });
    });

    describe('canUpdateUser', () => {
        it('allows self', () => {
            expect(() => canUpdateUser(self, self)).not.toThrow();
        });
        it('allows super admin', () => {
            expect(() => canUpdateUser(superAdmin, self)).not.toThrow();
        });
        it('allows admin with USER_UPDATE_ANY updating other', () => {
            expect(() => canUpdateUser(adminWithUpdateAny, self)).not.toThrow();
        });
        it('forbids admin with only USER_READ_ALL updating other', () => {
            try {
                canUpdateUser(adminWithReadAll, self);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
        it('forbids admin without USER_UPDATE_ANY updating other', () => {
            try {
                canUpdateUser(adminNoPerm, self);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
        it('forbids guest updating other', () => {
            try {
                canUpdateUser(guestOther, self);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
        it('forbids undefined actor', () => {
            expect(() => canUpdateUser(undefined, self)).toThrowError(/Missing actor/);
        });
    });

    describe('canAssignRole', () => {
        it('allows super admin (has USER_UPDATE_ROLES)', () => {
            expect(() => canAssignRole(superAdmin)).not.toThrow();
        });
        it('allows admin with USER_UPDATE_ROLES', () => {
            expect(() => canAssignRole(adminWithRolePerms)).not.toThrow();
        });
        it('forbids admin without USER_UPDATE_ROLES', () => {
            try {
                canAssignRole(adminNoPerm);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
        it('forbids guest', () => {
            try {
                canAssignRole(guestOther);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
        it('forbids undefined actor', () => {
            expect(() => canAssignRole(undefined)).toThrowError(/Missing actor/);
        });
    });

    describe('canAddPermission', () => {
        it('allows super admin', () => {
            expect(() => canAddPermission(superAdmin)).not.toThrow();
        });
        it('allows admin with USER_UPDATE_ROLES', () => {
            expect(() => canAddPermission(adminWithRolePerms)).not.toThrow();
        });
        it('forbids admin without USER_UPDATE_ROLES', () => {
            try {
                canAddPermission(adminNoPerm);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
        it('forbids guest', () => {
            try {
                canAddPermission(guestOther);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
        it('forbids undefined actor', () => {
            expect(() => canAddPermission(undefined)).toThrowError(/Missing actor/);
        });
    });

    describe('canSetPermissions', () => {
        it('allows super admin', () => {
            expect(() => canSetPermissions(superAdmin)).not.toThrow();
        });
        it('allows admin with USER_UPDATE_ROLES', () => {
            expect(() => canSetPermissions(adminWithRolePerms)).not.toThrow();
        });
        it('forbids admin without USER_UPDATE_ROLES', () => {
            try {
                canSetPermissions(adminNoPerm);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
        it('forbids guest', () => {
            try {
                canSetPermissions(guestOther);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
        it('forbids undefined actor', () => {
            expect(() => canSetPermissions(undefined)).toThrowError(/Missing actor/);
        });
    });

    describe('canRemovePermission', () => {
        it('allows super admin', () => {
            expect(() => canRemovePermission(superAdmin)).not.toThrow();
        });
        it('allows admin with USER_UPDATE_ROLES', () => {
            expect(() => canRemovePermission(adminWithRolePerms)).not.toThrow();
        });
        it('forbids admin without USER_UPDATE_ROLES', () => {
            try {
                canRemovePermission(adminNoPerm);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
        it('forbids guest', () => {
            try {
                canRemovePermission(guestOther);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
        it('forbids undefined actor', () => {
            expect(() => canRemovePermission(undefined)).toThrowError(/Missing actor/);
        });
    });
});
