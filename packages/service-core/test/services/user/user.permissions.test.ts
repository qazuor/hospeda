import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
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
    const self = createUser({ id: getMockId('user'), role: RoleEnum.USER });
    const superAdmin = createUser({ id: getMockId('user'), role: RoleEnum.SUPER_ADMIN });
    const adminOther = createUser({
        id: getMockId('user', 'admin-other') as string,
        role: RoleEnum.ADMIN
    });
    const guestOther = createUser({
        id: getMockId('user', 'guest-other') as string,
        role: RoleEnum.GUEST
    });

    describe('canViewUser', () => {
        it('allows self', () => {
            expect(() => canViewUser(self, self)).not.toThrow();
        });
        it('allows super admin', () => {
            expect(() => canViewUser(superAdmin, self)).not.toThrow();
        });
        it('forbids admin viewing other', () => {
            try {
                canViewUser(adminOther, self);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                    expect(err.message).toBe('FORBIDDEN: Only self or super admin can view user');
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
                    expect(err.message).toBe('FORBIDDEN: Only self or super admin can view user');
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
        it('forbids admin updating other', () => {
            try {
                canUpdateUser(adminOther, self);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                    expect(err.message).toBe('FORBIDDEN: Only self or super admin can update user');
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
                    expect(err.message).toBe('FORBIDDEN: Only self or super admin can update user');
                }
            }
        });
        it('forbids undefined actor', () => {
            expect(() => canUpdateUser(undefined, self)).toThrowError(/Missing actor/);
        });
    });

    describe('canAssignRole', () => {
        it('allows super admin', () => {
            expect(() => canAssignRole(superAdmin)).not.toThrow();
        });
        it('forbids admin', () => {
            try {
                canAssignRole(adminOther);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                    expect(err.message).toBe('FORBIDDEN: Only super admin can assign roles');
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
                    expect(err.message).toBe('FORBIDDEN: Only super admin can assign roles');
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
        it('forbids admin', () => {
            try {
                canAddPermission(adminOther);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                    expect(err.message).toBe('FORBIDDEN: Only super admin can add permissions');
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
                    expect(err.message).toBe('FORBIDDEN: Only super admin can add permissions');
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
        it('forbids admin', () => {
            try {
                canSetPermissions(adminOther);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                    expect(err.message).toBe('FORBIDDEN: Only super admin can set permissions');
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
                    expect(err.message).toBe('FORBIDDEN: Only super admin can set permissions');
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
        it('forbids admin', () => {
            try {
                canRemovePermission(adminOther);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                    expect(err.message).toBe('FORBIDDEN: Only super admin can remove permissions');
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
                    expect(err.message).toBe('FORBIDDEN: Only super admin can remove permissions');
                }
            }
        });
        it('forbids undefined actor', () => {
            expect(() => canRemovePermission(undefined)).toThrowError(/Missing actor/);
        });
    });
});
