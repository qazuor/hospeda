import { AuthProviderEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Zod schema for AuthProviderEnum
 * Used for validating authentication provider values
 */
export const AuthProviderEnumSchema = z.nativeEnum(AuthProviderEnum, {
    message: 'zodError.authProvider.invalid'
});

export type AuthProviderEnumType = z.infer<typeof AuthProviderEnumSchema>;
