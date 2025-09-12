import { AuthProviderEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AuthProviderEnumSchema } from '../../src/enums/auth-provider.enum.schema.js';

describe('AuthProviderEnumSchema', () => {
    it('should validate valid auth provider values', () => {
        // Test each enum value
        // biome-ignore lint/complexity/noForEach: <explanation>
        Object.values(AuthProviderEnum).forEach((provider) => {
            expect(() => AuthProviderEnumSchema.parse(provider)).not.toThrow();
        });
    });

    it('should validate CLERK provider', () => {
        expect(() => AuthProviderEnumSchema.parse(AuthProviderEnum.CLERK)).not.toThrow();
    });

    it('should reject invalid auth provider values', () => {
        const invalidProviders = [
            'invalid-provider',
            'GOOGLE', // Assuming this is not in the enum
            'FACEBOOK',
            '',
            null,
            undefined,
            123,
            {}
        ];

        // biome-ignore lint/complexity/noForEach: <explanation>
        invalidProviders.forEach((provider) => {
            expect(() => AuthProviderEnumSchema.parse(provider)).toThrow(ZodError);
        });
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            AuthProviderEnumSchema.parse('invalid-provider');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.authProvider.invalid');
        }
    });

    it('should infer correct TypeScript type', () => {
        const validProvider = AuthProviderEnumSchema.parse(AuthProviderEnum.CLERK);

        // TypeScript should infer this as AuthProviderEnum
        const _typeCheck: AuthProviderEnum = validProvider;
        expect(validProvider).toBe(AuthProviderEnum.CLERK);
    });
});
