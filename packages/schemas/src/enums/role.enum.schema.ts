import { RoleEnum } from '@repo/types';
import { z } from 'zod';

export const RoleEnumSchema = z.nativeEnum(RoleEnum, {
    errorMap: () => ({ message: 'zodError.enums.role.invalid' })
});
