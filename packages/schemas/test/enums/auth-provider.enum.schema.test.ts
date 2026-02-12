import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AuthProviderEnumSchema } from '../../src/enums/auth-provider.schema.js';
import { AuthProviderEnum } from '../../src/enums/index.js';

describe('AuthProviderEnumSchema', () => {
    it('should validate valid auth provider values', () => {
        for (const provider of Object.values(AuthProviderEnum)) {
            expect(() => AuthProviderEnumSchema.parse(provider)).not.toThrow();
        }
    });

    it('should validate BETTER_AUTH provider', () => {
        expect(() => AuthProviderEnumSchema.parse(AuthProviderEnum.BETTER_AUTH)).not.toThrow();
    });

    it('should validate legacy CLERK provider for backward compatibility', () => {
        expect(() => AuthProviderEnumSchema.parse(AuthProviderEnum.CLERK)).not.toThrow();
    });

    it('should reject invalid auth provider values', () => {
        const invalidProviders = [
            'invalid-provider',
            'GOOGLE',
            'FACEBOOK',
            '',
            null,
            undefined,
            123,
            {}
        ];

        for (const provider of invalidProviders) {
            expect(() => AuthProviderEnumSchema.parse(provider)).toThrow(ZodError);
        }
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            AuthProviderEnumSchema.parse('invalid-provider');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.authProvider.invalid');
        }
    });

    it('should infer correct TypeScript type', () => {
        const validProvider = AuthProviderEnumSchema.parse(AuthProviderEnum.BETTER_AUTH);

        const _typeCheck: AuthProviderEnum = validProvider;
        expect(validProvider).toBe(AuthProviderEnum.BETTER_AUTH);
    });
});
