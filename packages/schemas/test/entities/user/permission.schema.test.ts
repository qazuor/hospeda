import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AssignUserPermissionOverrideBodySchema,
    DeleteUserPermissionOverrideParamsSchema,
    UserPermissionAssignmentSchema,
    UserPermissionOverridesResponseSchema
} from '../../../src/entities/user/permission.schema.js';
import { PermissionEnum } from '../../../src/enums/index.js';

describe('User Permission Schemas (SPEC-170)', () => {
    describe('UserPermissionAssignmentSchema', () => {
        it('should default effect to "grant" when omitted', () => {
            const input = {
                userId: faker.string.uuid(),
                permission: PermissionEnum.USER_CREATE
            };

            const result = UserPermissionAssignmentSchema.parse(input);

            expect(result.effect).toBe('grant');
        });

        it('should accept an explicit "deny" effect', () => {
            const input = {
                userId: faker.string.uuid(),
                permission: PermissionEnum.USER_CREATE,
                effect: 'deny'
            };

            const result = UserPermissionAssignmentSchema.parse(input);

            expect(result.effect).toBe('deny');
        });

        it('should reject an invalid userId', () => {
            const input = {
                userId: 'not-a-uuid',
                permission: PermissionEnum.USER_CREATE
            };

            expect(() => UserPermissionAssignmentSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('UserPermissionOverridesResponseSchema', () => {
        it('should validate a full split response', () => {
            const input = {
                fromRole: [PermissionEnum.USER_CREATE, PermissionEnum.ANALYTICS_VIEW],
                grantOverrides: [PermissionEnum.POST_CREATE],
                denyOverrides: [PermissionEnum.USER_DELETE]
            };

            const result = UserPermissionOverridesResponseSchema.parse(input);

            expect(result.fromRole).toHaveLength(2);
            expect(result.grantOverrides).toContain(PermissionEnum.POST_CREATE);
            expect(result.denyOverrides).toContain(PermissionEnum.USER_DELETE);
        });

        it('should validate empty buckets', () => {
            const input = { fromRole: [], grantOverrides: [], denyOverrides: [] };

            expect(() => UserPermissionOverridesResponseSchema.parse(input)).not.toThrow();
        });

        it('should reject an invalid permission in any bucket', () => {
            const input = {
                fromRole: [],
                grantOverrides: ['not-a-permission'],
                denyOverrides: []
            };

            expect(() => UserPermissionOverridesResponseSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('AssignUserPermissionOverrideBodySchema', () => {
        it('should validate a grant override body', () => {
            const input = { permission: PermissionEnum.POST_CREATE, effect: 'grant' };

            const result = AssignUserPermissionOverrideBodySchema.parse(input);

            expect(result.permission).toBe(PermissionEnum.POST_CREATE);
            expect(result.effect).toBe('grant');
        });

        it('should validate a deny override body', () => {
            const input = { permission: PermissionEnum.POST_CREATE, effect: 'deny' };

            const result = AssignUserPermissionOverrideBodySchema.parse(input);

            expect(result.effect).toBe('deny');
        });

        it('should require effect to be explicit (no default)', () => {
            const input = { permission: PermissionEnum.POST_CREATE };

            expect(() => AssignUserPermissionOverrideBodySchema.parse(input)).toThrow(ZodError);
        });

        it('should reject unexpected fields due to strict validation', () => {
            const input = {
                permission: PermissionEnum.POST_CREATE,
                effect: 'grant',
                userId: faker.string.uuid()
            };

            expect(() => AssignUserPermissionOverrideBodySchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('DeleteUserPermissionOverrideParamsSchema', () => {
        it('should validate valid params', () => {
            const input = {
                id: faker.string.uuid(),
                permission: PermissionEnum.POST_CREATE
            };

            expect(() => DeleteUserPermissionOverrideParamsSchema.parse(input)).not.toThrow();
        });

        it('should reject an invalid user id', () => {
            const input = { id: 'not-a-uuid', permission: PermissionEnum.POST_CREATE };

            expect(() => DeleteUserPermissionOverrideParamsSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject an invalid permission', () => {
            const input = { id: faker.string.uuid(), permission: 'INVALID' };

            expect(() => DeleteUserPermissionOverrideParamsSchema.parse(input)).toThrow(ZodError);
        });
    });
});
