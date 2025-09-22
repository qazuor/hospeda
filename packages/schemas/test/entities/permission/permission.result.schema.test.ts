import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    PermissionsListResultSchema,
    RolesListResultSchema,
    UsersListResultSchema
} from '../../../src/entities/permission/permission.management.schema.js';
import { PermissionEnum, RoleEnum } from '../../../src/enums/index.js';

describe('Permission Result Schemas', () => {
    describe('PermissionsListResultSchema', () => {
        it('should validate permissions list with multiple permissions', () => {
            const result = {
                permissions: [PermissionEnum.USER_CREATE, PermissionEnum.ANALYTICS_VIEW]
            };

            expect(() => PermissionsListResultSchema.parse(result)).not.toThrow();

            const parsed = PermissionsListResultSchema.parse(result);
            expect(Array.isArray(parsed.permissions)).toBe(true);
            expect(parsed.permissions).toHaveLength(2);
            expect(parsed.permissions).toContain(PermissionEnum.USER_CREATE);
            expect(parsed.permissions).toContain(PermissionEnum.ANALYTICS_VIEW);
        });

        it('should validate empty permissions list', () => {
            const result = {
                permissions: []
            };

            expect(() => PermissionsListResultSchema.parse(result)).not.toThrow();

            const parsed = PermissionsListResultSchema.parse(result);
            expect(parsed.permissions).toHaveLength(0);
        });

        it('should validate single permission', () => {
            const result = {
                permissions: [PermissionEnum.POST_CREATE]
            };

            expect(() => PermissionsListResultSchema.parse(result)).not.toThrow();

            const parsed = PermissionsListResultSchema.parse(result);
            expect(parsed.permissions).toHaveLength(1);
            expect(parsed.permissions[0]).toBe(PermissionEnum.POST_CREATE);
        });

        it('should reject invalid permission in list', () => {
            const result = {
                permissions: ['INVALID_PERMISSION']
            };

            expect(() => PermissionsListResultSchema.parse(result)).toThrow(ZodError);
        });

        it('should reject non-array permissions', () => {
            const result = {
                permissions: 'not-an-array'
            };

            expect(() => PermissionsListResultSchema.parse(result)).toThrow(ZodError);
        });
    });

    describe('RolesListResultSchema', () => {
        it('should validate roles list with multiple roles', () => {
            const result = {
                roles: [RoleEnum.ADMIN, RoleEnum.EDITOR]
            };

            expect(() => RolesListResultSchema.parse(result)).not.toThrow();

            const parsed = RolesListResultSchema.parse(result);
            expect(Array.isArray(parsed.roles)).toBe(true);
            expect(parsed.roles).toHaveLength(2);
            expect(parsed.roles).toContain(RoleEnum.ADMIN);
            expect(parsed.roles).toContain(RoleEnum.EDITOR);
        });

        it('should validate empty roles list', () => {
            const result = {
                roles: []
            };

            expect(() => RolesListResultSchema.parse(result)).not.toThrow();

            const parsed = RolesListResultSchema.parse(result);
            expect(parsed.roles).toHaveLength(0);
        });

        it('should validate single role', () => {
            const result = {
                roles: [RoleEnum.USER]
            };

            expect(() => RolesListResultSchema.parse(result)).not.toThrow();

            const parsed = RolesListResultSchema.parse(result);
            expect(parsed.roles).toHaveLength(1);
            expect(parsed.roles[0]).toBe(RoleEnum.USER);
        });

        it('should reject invalid role in list', () => {
            const result = {
                roles: ['INVALID_ROLE']
            };

            expect(() => RolesListResultSchema.parse(result)).toThrow(ZodError);
        });

        it('should reject non-array roles', () => {
            const result = {
                roles: 'not-an-array'
            };

            expect(() => RolesListResultSchema.parse(result)).toThrow(ZodError);
        });
    });

    describe('UsersListResultSchema', () => {
        it('should validate users list with multiple users', () => {
            const userId1 = faker.string.uuid();
            const userId2 = faker.string.uuid();
            const result = {
                users: [userId1, userId2]
            };

            expect(() => UsersListResultSchema.parse(result)).not.toThrow();

            const parsed = UsersListResultSchema.parse(result);
            expect(Array.isArray(parsed.users)).toBe(true);
            expect(parsed.users).toHaveLength(2);
            expect(parsed.users).toContain(userId1);
            expect(parsed.users).toContain(userId2);
        });

        it('should validate empty users list', () => {
            const result = {
                users: []
            };

            expect(() => UsersListResultSchema.parse(result)).not.toThrow();

            const parsed = UsersListResultSchema.parse(result);
            expect(parsed.users).toHaveLength(0);
        });

        it('should validate single user', () => {
            const userId = faker.string.uuid();
            const result = {
                users: [userId]
            };

            expect(() => UsersListResultSchema.parse(result)).not.toThrow();

            const parsed = UsersListResultSchema.parse(result);
            expect(parsed.users).toHaveLength(1);
            expect(parsed.users[0]).toBe(userId);
        });

        it('should reject invalid user ID in list', () => {
            const result = {
                users: ['not-a-uuid']
            };

            expect(() => UsersListResultSchema.parse(result)).toThrow(ZodError);
        });

        it('should reject non-array users', () => {
            const result = {
                users: 'not-an-array'
            };

            expect(() => UsersListResultSchema.parse(result)).toThrow(ZodError);
        });
    });
});
