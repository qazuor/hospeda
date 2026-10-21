import { AsciiSpecialCharacterRegex, StrongPasswordSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { PASSWORD_RULES as authPasswordRules } from '../../../src/features/auth/components/password-validation';
import { PASSWORD_RULES as profilePasswordRules } from '../../../src/features/user-profile/components/password-validation';

describe('HOS-1720 admin password symbol rule', () => {
    it('uses the shared symbol regex and agrees with the password schema', () => {
        expect(authPasswordRules.hasSpecial).toBe(AsciiSpecialCharacterRegex);
        expect(profilePasswordRules.hasSpecial).toBe(AsciiSpecialCharacterRegex);

        for (const symbol of ['-', '.', '#', '_', '~']) {
            const password = `Abcdef12${symbol}`;
            const schemaRequiresSymbol = StrongPasswordSchema.safeParse(password).success;

            expect(authPasswordRules.hasSpecial.test(symbol)).toBe(schemaRequiresSymbol);
            expect(profilePasswordRules.hasSpecial.test(symbol)).toBe(schemaRequiresSymbol);
        }
    });
});
