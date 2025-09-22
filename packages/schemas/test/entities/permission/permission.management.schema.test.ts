import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    PermissionAssignmentOutputSchema,
    PermissionRemovalOutputSchema,
    PermissionsByRoleInputSchema,
    PermissionsByUserInputSchema,
    PermissionsQueryOutputSchema,
    RolePermissionManagementInputSchema,
    RolesByPermissionInputSchema,
    RolesQueryOutputSchema,
    UserPermissionManagementInputSchema,
    UsersByPermissionInputSchema,
    UsersQueryOutputSchema
} from '../../../src/entities/permission/permission.management.schema.js';
import { PermissionEnum, RoleEnum } from '../../../src/enums/index.js';

describe('Permission Management Schemas', () => {
    describe('RolePermissionManagementInputSchema', () => {
        it('should validate valid role-permission assignment', () => {
            const input = {
                role: RoleEnum.ADMIN,
                permission: PermissionEnum.USER_CREATE
            };

            expect(() => RolePermissionManagementInputSchema.parse(input)).not.toThrow();

            const result = RolePermissionManagementInputSchema.parse(input);
            expect(result.role).toBe(RoleEnum.ADMIN);
            expect(result.permission).toBe(PermissionEnum.USER_CREATE);
        });

        it('should reject invalid role', () => {
            const input = {
                role: 'INVALID_ROLE',
                permission: PermissionEnum.USER_CREATE
            };

            expect(() => RolePermissionManagementInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject invalid permission', () => {
            const input = {
                role: RoleEnum.ADMIN,
                permission: 'INVALID_PERMISSION'
            };

            expect(() => RolePermissionManagementInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject unexpected fields due to strict validation', () => {
            const input = {
                role: RoleEnum.ADMIN,
                permission: PermissionEnum.USER_CREATE,
                unexpectedField: 'should be rejected'
            };

            expect(() => RolePermissionManagementInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject missing required fields', () => {
            const input = {
                role: RoleEnum.ADMIN
                // missing permission
            };

            expect(() => RolePermissionManagementInputSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('UserPermissionManagementInputSchema', () => {
        it('should validate valid user-permission assignment', () => {
            const input = {
                userId: faker.string.uuid(),
                permission: PermissionEnum.USER_CREATE
            };

            expect(() => UserPermissionManagementInputSchema.parse(input)).not.toThrow();

            const result = UserPermissionManagementInputSchema.parse(input);
            expect(result.userId).toBe(input.userId);
            expect(result.permission).toBe(PermissionEnum.USER_CREATE);
        });

        it('should reject invalid userId format', () => {
            const input = {
                userId: 'not-a-uuid',
                permission: PermissionEnum.USER_CREATE
            };

            expect(() => UserPermissionManagementInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject invalid permission', () => {
            const input = {
                userId: faker.string.uuid(),
                permission: 'INVALID_PERMISSION'
            };

            expect(() => UserPermissionManagementInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject unexpected fields due to strict validation', () => {
            const input = {
                userId: faker.string.uuid(),
                permission: PermissionEnum.USER_CREATE,
                unexpectedField: 'should be rejected'
            };

            expect(() => UserPermissionManagementInputSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('PermissionsByRoleInputSchema', () => {
        it('should validate valid role query', () => {
            const input = {
                role: RoleEnum.EDITOR
            };

            expect(() => PermissionsByRoleInputSchema.parse(input)).not.toThrow();

            const result = PermissionsByRoleInputSchema.parse(input);
            expect(result.role).toBe(RoleEnum.EDITOR);
        });

        it('should reject invalid role', () => {
            const input = {
                role: 'INVALID_ROLE'
            };

            expect(() => PermissionsByRoleInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject unexpected fields', () => {
            const input = {
                role: RoleEnum.EDITOR,
                unexpectedField: 'should be rejected'
            };

            expect(() => PermissionsByRoleInputSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('PermissionsByUserInputSchema', () => {
        it('should validate valid user query', () => {
            const input = {
                userId: faker.string.uuid()
            };

            expect(() => PermissionsByUserInputSchema.parse(input)).not.toThrow();

            const result = PermissionsByUserInputSchema.parse(input);
            expect(result.userId).toBe(input.userId);
        });

        it('should reject invalid userId format', () => {
            const input = {
                userId: 'not-a-uuid'
            };

            expect(() => PermissionsByUserInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject unexpected fields', () => {
            const input = {
                userId: faker.string.uuid(),
                unexpectedField: 'should be rejected'
            };

            expect(() => PermissionsByUserInputSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('RolesByPermissionInputSchema', () => {
        it('should validate valid permission query', () => {
            const input = {
                permission: PermissionEnum.ANALYTICS_VIEW
            };

            expect(() => RolesByPermissionInputSchema.parse(input)).not.toThrow();

            const result = RolesByPermissionInputSchema.parse(input);
            expect(result.permission).toBe(PermissionEnum.ANALYTICS_VIEW);
        });

        it('should reject invalid permission', () => {
            const input = {
                permission: 'INVALID_PERMISSION'
            };

            expect(() => RolesByPermissionInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject unexpected fields', () => {
            const input = {
                permission: PermissionEnum.ANALYTICS_VIEW,
                unexpectedField: 'should be rejected'
            };

            expect(() => RolesByPermissionInputSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('UsersByPermissionInputSchema', () => {
        it('should validate valid permission query', () => {
            const input = {
                permission: PermissionEnum.POST_CREATE
            };

            expect(() => UsersByPermissionInputSchema.parse(input)).not.toThrow();

            const result = UsersByPermissionInputSchema.parse(input);
            expect(result.permission).toBe(PermissionEnum.POST_CREATE);
        });

        it('should reject invalid permission', () => {
            const input = {
                permission: 'INVALID_PERMISSION'
            };

            expect(() => UsersByPermissionInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject unexpected fields', () => {
            const input = {
                permission: PermissionEnum.POST_CREATE,
                unexpectedField: 'should be rejected'
            };

            expect(() => UsersByPermissionInputSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('Output Schemas', () => {
        describe('PermissionAssignmentOutputSchema', () => {
            it('should validate assignment result', () => {
                const output = {
                    assigned: true
                };

                expect(() => PermissionAssignmentOutputSchema.parse(output)).not.toThrow();

                const result = PermissionAssignmentOutputSchema.parse(output);
                expect(result.assigned).toBe(true);
            });

            it('should use default value for assigned', () => {
                const output = {};

                expect(() => PermissionAssignmentOutputSchema.parse(output)).not.toThrow();

                const result = PermissionAssignmentOutputSchema.parse(output);
                expect(result.assigned).toBe(true); // Default value
            });

            it('should reject invalid assigned type', () => {
                const output = {
                    assigned: 'not-boolean'
                };

                expect(() => PermissionAssignmentOutputSchema.parse(output)).toThrow(ZodError);
            });
        });

        describe('PermissionRemovalOutputSchema', () => {
            it('should validate removal result', () => {
                const output = {
                    removed: false
                };

                expect(() => PermissionRemovalOutputSchema.parse(output)).not.toThrow();

                const result = PermissionRemovalOutputSchema.parse(output);
                expect(result.removed).toBe(false);
            });

            it('should use default value for removed', () => {
                const output = {};

                expect(() => PermissionRemovalOutputSchema.parse(output)).not.toThrow();

                const result = PermissionRemovalOutputSchema.parse(output);
                expect(result.removed).toBe(true); // Default value
            });
        });

        describe('PermissionsQueryOutputSchema', () => {
            it('should validate permissions list', () => {
                const output = {
                    permissions: [PermissionEnum.USER_CREATE, PermissionEnum.ANALYTICS_VIEW]
                };

                expect(() => PermissionsQueryOutputSchema.parse(output)).not.toThrow();

                const result = PermissionsQueryOutputSchema.parse(output);
                expect(Array.isArray(result.permissions)).toBe(true);
                expect(result.permissions).toHaveLength(2);
                expect(result.permissions).toContain(PermissionEnum.USER_CREATE);
                expect(result.permissions).toContain(PermissionEnum.ANALYTICS_VIEW);
            });

            it('should validate empty permissions list', () => {
                const output = {
                    permissions: []
                };

                expect(() => PermissionsQueryOutputSchema.parse(output)).not.toThrow();

                const result = PermissionsQueryOutputSchema.parse(output);
                expect(result.permissions).toHaveLength(0);
            });

            it('should reject invalid permission in list', () => {
                const output = {
                    permissions: [PermissionEnum.USER_CREATE, 'INVALID_PERMISSION']
                };

                expect(() => PermissionsQueryOutputSchema.parse(output)).toThrow(ZodError);
            });
        });

        describe('RolesQueryOutputSchema', () => {
            it('should validate roles list', () => {
                const output = {
                    roles: [RoleEnum.ADMIN, RoleEnum.EDITOR]
                };

                expect(() => RolesQueryOutputSchema.parse(output)).not.toThrow();

                const result = RolesQueryOutputSchema.parse(output);
                expect(Array.isArray(result.roles)).toBe(true);
                expect(result.roles).toHaveLength(2);
                expect(result.roles).toContain(RoleEnum.ADMIN);
                expect(result.roles).toContain(RoleEnum.EDITOR);
            });

            it('should validate empty roles list', () => {
                const output = {
                    roles: []
                };

                expect(() => RolesQueryOutputSchema.parse(output)).not.toThrow();

                const result = RolesQueryOutputSchema.parse(output);
                expect(result.roles).toHaveLength(0);
            });

            it('should reject invalid role in list', () => {
                const output = {
                    roles: [RoleEnum.ADMIN, 'INVALID_ROLE']
                };

                expect(() => RolesQueryOutputSchema.parse(output)).toThrow(ZodError);
            });
        });

        describe('UsersQueryOutputSchema', () => {
            it('should validate users list', () => {
                const output = {
                    users: [faker.string.uuid(), faker.string.uuid()]
                };

                expect(() => UsersQueryOutputSchema.parse(output)).not.toThrow();

                const result = UsersQueryOutputSchema.parse(output);
                expect(Array.isArray(result.users)).toBe(true);
                expect(result.users).toHaveLength(2);
            });

            it('should validate empty users list', () => {
                const output = {
                    users: []
                };

                expect(() => UsersQueryOutputSchema.parse(output)).not.toThrow();

                const result = UsersQueryOutputSchema.parse(output);
                expect(result.users).toHaveLength(0);
            });

            it('should reject invalid userId in list', () => {
                const output = {
                    users: [faker.string.uuid(), 'not-a-uuid']
                };

                expect(() => UsersQueryOutputSchema.parse(output)).toThrow(ZodError);
            });
        });
    });
});
