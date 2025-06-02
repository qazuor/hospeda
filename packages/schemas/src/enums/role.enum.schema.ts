import { RoleEnum } from '@repo/types';
import { z } from 'zod';

export const RoleEnumSchema = z.enum(Object.values(RoleEnum) as [string, ...string[]], {
    errorMap: () => ({ message: 'zodError.enums.role.invalid' })
});
