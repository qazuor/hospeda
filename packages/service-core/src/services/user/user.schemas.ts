import { PermissionEnum, RoleEnum } from '@repo/types';
import { z } from 'zod';

export const AssignRoleSchema = z.object({
    userId: z.string().min(1),
    role: z.nativeEnum(RoleEnum)
});

export const AddPermissionSchema = z.object({
    userId: z.string().min(1),
    permission: z.nativeEnum(PermissionEnum)
});

export const SetPermissionsSchema = z.object({
    userId: z.string().min(1),
    permissions: z.array(z.nativeEnum(PermissionEnum)).min(1, 'At least one permission is required')
});

export const RemovePermissionSchema = z.object({
    userId: z.string().min(1),
    permission: z.nativeEnum(PermissionEnum)
});
