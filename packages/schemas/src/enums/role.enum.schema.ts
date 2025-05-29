import { BuiltinRoleTypeEnum } from '@repo/types';
import { z } from 'zod';

export const BuiltinRoleTypeEnumSchema = z.enum(
    Object.values(BuiltinRoleTypeEnum) as [string, ...string[]],
    {
        errorMap: () => ({ message: 'zodError.enums.builtinRoleType.invalid' })
    }
);
