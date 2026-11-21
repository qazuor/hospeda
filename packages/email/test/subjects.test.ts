import { describe, expect, it } from 'vitest';
import { RESET_PASSWORD_EMAIL_SUBJECT, VERIFY_EMAIL_SUBJECT } from '../src/index.js';

/**
 * HOS-2519 AC-4.5: the auth subjects moved out of `apps/api/src/lib/auth.ts`
 * into constants. These literals are the strings that file sent before the
 * move; a change here is a copy change and needs owner sign-off.
 */
describe('auth email subjects', () => {
    it('keeps the password reset subject byte-identical', () => {
        expect(RESET_PASSWORD_EMAIL_SUBJECT).toBe('Restablece tu contraseña de Hospeda');
    });

    it('keeps the verification subject byte-identical', () => {
        expect(VERIFY_EMAIL_SUBJECT).toBe('Verifica tu cuenta de Hospeda');
    });
});
