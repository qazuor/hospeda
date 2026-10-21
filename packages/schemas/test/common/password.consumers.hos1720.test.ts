import { describe, expect, it } from 'vitest';
import { ChangePasswordInputSchema } from '../../src/api/auth.schema.js';
import {
    UserPasswordChangeInputSchema,
    UserPasswordResetInputSchema
} from '../../src/entities/user/user.crud.schema.js';
import { SetPasswordBodySchema } from '../../src/entities/user/user.profile-completion.schema.js';

const smokeCase = 'Abcdef1234-ghijklm!xy';
const noAsciiSymbol = 'Abcdef1234 ñ';

describe('TEST:1720:3 shared password consumers', () => {
    it('accepts the smoke password and rejects a password without an ASCII symbol everywhere', () => {
        const cases = [
            [
                ChangePasswordInputSchema,
                { currentPassword: 'old', newPassword: smokeCase },
                { currentPassword: 'old', newPassword: noAsciiSymbol }
            ],
            [
                UserPasswordChangeInputSchema,
                {
                    id: '00000000-0000-4000-8000-000000000001',
                    currentPassword: 'old',
                    newPassword: smokeCase
                },
                {
                    id: '00000000-0000-4000-8000-000000000001',
                    currentPassword: 'old',
                    newPassword: noAsciiSymbol
                }
            ],
            [
                UserPasswordResetInputSchema,
                { id: '00000000-0000-4000-8000-000000000001', newPassword: smokeCase },
                { id: '00000000-0000-4000-8000-000000000001', newPassword: noAsciiSymbol }
            ],
            [SetPasswordBodySchema, { password: smokeCase }, { password: noAsciiSymbol }]
        ] as const;
        for (const [schema, good, bad] of cases) {
            expect(schema.safeParse(good).success).toBe(true);
            expect(schema.safeParse(bad).success).toBe(false);
        }
    });
});
