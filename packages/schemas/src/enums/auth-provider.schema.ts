import { z } from 'zod';
import { AuthProviderEnum } from './auth-provider.enum.js';

export const AuthProviderEnumSchema = z.nativeEnum(AuthProviderEnum, {
    error: () => ({ message: 'zodError.enums.authProvider.invalid' })
});
