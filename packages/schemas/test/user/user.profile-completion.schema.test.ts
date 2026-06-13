import { describe, expect, it } from 'vitest';
import { SetPasswordBodySchema } from '../../src/entities/user/user.profile-completion.schema.js';

/**
 * SetPasswordBodySchema (POST /api/v1/protected/profile/set-password).
 *
 * The password field uses the monorepo-wide StrongPasswordSchema so the
 * onboarding set-password endpoint enforces the same strength policy as
 * password change/reset (and as the client mirrors via StrongPasswordRegex).
 * Better Auth only checks min length, so this is the strength gate for direct
 * API callers.
 */
describe('SetPasswordBodySchema', () => {
    it('accepts a strong password', () => {
        expect(SetPasswordBodySchema.safeParse({ password: 'Secure1234!' }).success).toBe(true);
    });

    it('rejects a password below the minimum length', () => {
        expect(SetPasswordBodySchema.safeParse({ password: 'Ab1!' }).success).toBe(false);
    });

    it('rejects an 8-char password without strength (digits only)', () => {
        // Previously accepted under the old min-8-only rule; now requires
        // upper/lower/digit/special.
        expect(SetPasswordBodySchema.safeParse({ password: '12345678' }).success).toBe(false);
    });

    it('rejects a password missing a special character', () => {
        expect(SetPasswordBodySchema.safeParse({ password: 'Secure1234' }).success).toBe(false);
    });

    it('rejects unknown extra keys (strict)', () => {
        expect(
            SetPasswordBodySchema.safeParse({ password: 'Secure1234!', extra: true }).success
        ).toBe(false);
    });
});
