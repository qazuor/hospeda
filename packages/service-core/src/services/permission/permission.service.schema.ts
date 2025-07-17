import { PermissionEnum, RoleEnum } from '@repo/types';
import { z } from 'zod';

export const AssignPermissionToRoleSchema = z.object({
    role: z.nativeEnum(RoleEnum),
    permission: z.nativeEnum(PermissionEnum)
});
export type AssignPermissionToRoleInput = z.infer<typeof AssignPermissionToRoleSchema>;

export const AssignPermissionToUserSchema = z.object({
    userId: z.string().uuid(),
    permission: z.nativeEnum(PermissionEnum)
});
export type AssignPermissionToUserInput = z.infer<typeof AssignPermissionToUserSchema>;

export const GetPermissionsForRoleSchema = z.object({
    role: z.nativeEnum(RoleEnum)
});
export type GetPermissionsForRoleInput = z.infer<typeof GetPermissionsForRoleSchema>;

export const GetPermissionsForUserSchema = z.object({
    userId: z.string().uuid()
});
export type GetPermissionsForUserInput = z.infer<typeof GetPermissionsForUserSchema>;

export const GetRolesForPermissionSchema = z.object({
    permission: z.nativeEnum(PermissionEnum)
});
export type GetRolesForPermissionInput = z.infer<typeof GetRolesForPermissionSchema>;

export const GetUsersForPermissionSchema = z.object({
    permission: z.nativeEnum(PermissionEnum)
});
export type GetUsersForPermissionInput = z.infer<typeof GetUsersForPermissionSchema>;
