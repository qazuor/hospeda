import { BuiltinPermissionTypeEnum } from '@repo/types';
import { z } from 'zod';

export const BuiltinPermissionTypeEnumSchema = z.enum(
    Object.values(BuiltinPermissionTypeEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.builtinPermission.invalid' })
    }
);
