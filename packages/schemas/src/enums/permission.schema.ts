import { z } from 'zod';
import { PermissionEnum } from './permission.enum.js';

export const PermissionEnumSchema = z.nativeEnum(PermissionEnum, {
    error: () => ({ message: 'zodError.enums.permission.invalid' })
});
export type Permission = z.infer<typeof PermissionEnumSchema>;
