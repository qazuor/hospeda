import { z } from 'zod';
import { RoleEnum } from './role.enum.js';

export const RoleEnumSchema = z.nativeEnum(RoleEnum, {
    error: () => ({ message: 'zodError.enums.role.invalid' })
});
export type Role = z.infer<typeof RoleEnumSchema>;
