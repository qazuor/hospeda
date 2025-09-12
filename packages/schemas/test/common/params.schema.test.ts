import { faker } from '@faker-js/faker';
import { PermissionEnum, RoleEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    PermissionParamsSchema,
    RoleParamsSchema,
    UserIdParamsSchema
} from '../../src/common/params.schema.js';

describe('Permission-related Parameter Schemas', () => {
    describe('PermissionParamsSchema', () => {
        it('should validate valid permission parameter', () => {
            const params = {
                permission: PermissionEnum.USER_CREATE
            };

            expect(() => PermissionParamsSchema.parse(params)).not.toThrow();

            const result = PermissionParamsSchema.parse(params);
            expect(result.permission).toBe(PermissionEnum.USER_CREATE);
        });

        it('should validate all permission enum values', () => {
            // biome-ignore lint/complexity/noForEach: <explanation>
            Object.values(PermissionEnum).forEach((permission) => {
                const params = { permission };

                expect(() => PermissionParamsSchema.parse(params)).not.toThrow();

                const result = PermissionParamsSchema.parse(params);
                expect(result.permission).toBe(permission);
            });
        });

        it('should reject invalid permission value', () => {
            const params = {
                permission: 'INVALID_PERMISSION'
            };

            expect(() => PermissionParamsSchema.parse(params)).toThrow(ZodError);
        });

        it('should reject missing permission parameter', () => {
            const params = {};

            expect(() => PermissionParamsSchema.parse(params)).toThrow(ZodError);
        });

        it('should reject null permission', () => {
            const params = {
                permission: null
            };

            expect(() => PermissionParamsSchema.parse(params)).toThrow(ZodError);
        });

        it('should reject undefined permission', () => {
            const params = {
                permission: undefined
            };

            expect(() => PermissionParamsSchema.parse(params)).toThrow(ZodError);
        });
    });

    describe('RoleParamsSchema', () => {
        it('should validate valid role parameter', () => {
            const params = {
                role: RoleEnum.ADMIN
            };

            expect(() => RoleParamsSchema.parse(params)).not.toThrow();

            const result = RoleParamsSchema.parse(params);
            expect(result.role).toBe(RoleEnum.ADMIN);
        });

        it('should validate all role enum values', () => {
            // biome-ignore lint/complexity/noForEach: <explanation>
            Object.values(RoleEnum).forEach((role) => {
                const params = { role };

                expect(() => RoleParamsSchema.parse(params)).not.toThrow();

                const result = RoleParamsSchema.parse(params);
                expect(result.role).toBe(role);
            });
        });

        it('should reject invalid role value', () => {
            const params = {
                role: 'INVALID_ROLE'
            };

            expect(() => RoleParamsSchema.parse(params)).toThrow(ZodError);
        });

        it('should reject missing role parameter', () => {
            const params = {};

            expect(() => RoleParamsSchema.parse(params)).toThrow(ZodError);
        });

        it('should reject null role', () => {
            const params = {
                role: null
            };

            expect(() => RoleParamsSchema.parse(params)).toThrow(ZodError);
        });

        it('should reject undefined role', () => {
            const params = {
                role: undefined
            };

            expect(() => RoleParamsSchema.parse(params)).toThrow(ZodError);
        });
    });

    describe('UserIdParamsSchema', () => {
        it('should validate valid userId parameter', () => {
            const userId = faker.string.uuid();
            const params = {
                userId,
                id: faker.string.uuid() // Optional alternative parameter
            };

            expect(() => UserIdParamsSchema.parse(params)).not.toThrow();

            const result = UserIdParamsSchema.parse(params);
            expect(result.userId).toBe(userId);
            expect(result.id).toBeDefined();
        });

        it('should validate userId without optional id', () => {
            const userId = faker.string.uuid();
            const params = {
                userId
            };

            expect(() => UserIdParamsSchema.parse(params)).not.toThrow();

            const result = UserIdParamsSchema.parse(params);
            expect(result.userId).toBe(userId);
            expect(result.id).toBeUndefined();
        });

        it('should validate multiple valid UUIDs', () => {
            for (let i = 0; i < 5; i++) {
                const userId = faker.string.uuid();
                const params = { userId };

                expect(() => UserIdParamsSchema.parse(params)).not.toThrow();

                const result = UserIdParamsSchema.parse(params);
                expect(result.userId).toBe(userId);
            }
        });

        it('should reject invalid userId format', () => {
            const params = {
                userId: 'not-a-uuid'
            };

            expect(() => UserIdParamsSchema.parse(params)).toThrow(ZodError);
        });

        it('should reject empty userId', () => {
            const params = {
                userId: ''
            };

            expect(() => UserIdParamsSchema.parse(params)).toThrow(ZodError);
        });

        it('should reject missing userId parameter', () => {
            const params = {};

            expect(() => UserIdParamsSchema.parse(params)).toThrow(ZodError);
        });

        it('should reject null userId', () => {
            const params = {
                userId: null
            };

            expect(() => UserIdParamsSchema.parse(params)).toThrow(ZodError);
        });

        it('should reject undefined userId', () => {
            const params = {
                userId: undefined
            };

            expect(() => UserIdParamsSchema.parse(params)).toThrow(ZodError);
        });

        it('should reject invalid id format when provided', () => {
            const params = {
                userId: faker.string.uuid(),
                id: 'not-a-uuid'
            };

            expect(() => UserIdParamsSchema.parse(params)).toThrow(ZodError);
        });
    });

    describe('Edge Cases', () => {
        it('should handle permission enum case sensitivity', () => {
            const params = {
                permission: 'manage_users' // lowercase
            };

            expect(() => PermissionParamsSchema.parse(params)).toThrow(ZodError);
        });

        it('should handle role enum case sensitivity', () => {
            const params = {
                role: 'admin' // lowercase
            };

            expect(() => RoleParamsSchema.parse(params)).toThrow(ZodError);
        });

        it('should handle UUID with different formats', () => {
            // Valid UUID formats
            const validUUIDs = [
                '550e8400-e29b-41d4-a716-446655440000',
                'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
            ];

            // biome-ignore lint/complexity/noForEach: <explanation>
            validUUIDs.forEach((uuid) => {
                const params = { userId: uuid };
                expect(() => UserIdParamsSchema.parse(params)).not.toThrow();
            });

            // Invalid UUID formats
            const invalidUUIDs = [
                '550e8400-e29b-41d4-a716-44665544000', // too short
                '550e8400-e29b-41d4-a716-4466554400000', // too long
                '550e8400-e29b-41d4-a716-44665544000g', // invalid character
                '550e8400e29b41d4a716446655440000', // missing hyphens
                'not-a-uuid-at-all'
            ];

            // biome-ignore lint/complexity/noForEach: <explanation>
            invalidUUIDs.forEach((uuid) => {
                const params = { userId: uuid };
                expect(() => UserIdParamsSchema.parse(params)).toThrow(ZodError);
            });
        });
    });
});
