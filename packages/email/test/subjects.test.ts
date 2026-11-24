import { describe, expect, it } from 'vitest';
import { RESET_PASSWORD_EMAIL_SUBJECT, VERIFY_EMAIL_SUBJECT } from '../src/index.js';

/**
 * HOS-2519 AC-4.5: the auth subjects moved out of `apps/api/src/lib/auth.ts`
 * into constants. These literals are the strings that file sent before the
 * move; a change here is a copy change and needs owner sign-off.
 */
describe('auth email subjects', () => {
    it('HOS-2580 says the password reset subject in voseo', () => {
        expect(RESET_PASSWORD_EMAIL_SUBJECT).toBe('Restablecé tu contraseña de Hospeda');
    });

    it('HOS-2580 says the verification subject in voseo', () => {
        expect(VERIFY_EMAIL_SUBJECT).toBe('Verificá tu cuenta de Hospeda');
    });
});
