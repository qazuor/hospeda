import { PermissionEnum } from '@repo/types';
import { z } from 'zod';

export const PermissionEnumSchema = z.nativeEnum(PermissionEnum, {
    error: () => ({ message: 'zodError.enums.permission.invalid' })
});
