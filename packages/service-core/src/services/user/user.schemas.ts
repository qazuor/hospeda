import { AuthProviderEnum, PermissionEnum, RoleEnum } from '@repo/types';
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

/**
 * Input schema to fetch a user by authentication provider mapping.
 * Uses provider-agnostic fields to support future IdPs.
 */
export const GetByAuthProviderIdSchema = z
    .object({
        provider: z.nativeEnum(AuthProviderEnum),
        providerUserId: z.string().min(1)
    })
    .strict();
