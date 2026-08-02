import { z } from 'zod';
import { RoleGrantActionEnum } from './role-grant-action.enum.js';

/**
 * Zod schema for {@link RoleGrantActionEnum} — the direction of a role
 * mutation recorded in `user_role_audit` (HOS-296).
 */
export const RoleGrantActionSchema = z.nativeEnum(RoleGrantActionEnum, {
    error: () => ({ message: 'zodError.enums.roleGrantAction.invalid' })
});

/** Inferred type for a role-grant action (`'grant' | 'revoke'`). */
export type RoleGrantAction = z.infer<typeof RoleGrantActionSchema>;
