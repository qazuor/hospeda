import { PermissionEnum } from '@repo/types';
import { z } from 'zod';

export const PermissionEnumSchema = z.enum(Object.values(PermissionEnum) as [string, ...string[]], {
    errorMap: () => ({ message: 'zodError.enums.permission.invalid' })
});
