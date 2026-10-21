import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignUp } from '../../../src/components/auth/SignUp.client';

const signUpEmailMock = vi.fn();
vi.mock('../../../src/components/auth/SignUp.module.css', () => ({
    default: new Proxy({}, { get: (_target, key) => String(key) })
}));
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key })
}));
vi.mock('../../../src/lib/auth-client', () => ({
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: (...args: unknown[]) => signUpEmailMock(...args) }
}));
vi.mock('../../../src/lib/analytics/posthog-client', () => ({ trackEvent: vi.fn() }));
vi.mock('../../../src/components/ui/GradientButtonReact', () => ({
    GradientButton: ({ label, ...props }: { label: string; [key: string]: unknown }) => (
        <button {...props}>{label}</button>
    )
}));
function Harness() {
    const [email, setEmail] = useState('person@example.com');
    return (
        <SignUp
            locale="es"
            email={email}
            onEmailChange={setEmail}
            redirectTo="/verify"
            verificationCallbackUrl="https://example.test/account"
        />
    );
}
function submit(value: string) {
    fireEvent.change(document.getElementById('signup-password') as HTMLInputElement, {
        target: { value }
    });
    fireEvent.change(document.getElementById('signup-confirm-password') as HTMLInputElement, {
        target: { value }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
}
describe('TEST:1720:4 SignUp shared schema', () => {
    beforeEach(() => {
        signUpEmailMock.mockReset();
        signUpEmailMock.mockResolvedValue({ data: {} });
    });
    it('sends the smoke password', async () => {
        render(<Harness />);
        submit('Abcdef1234-ghijklm!xy');
        await waitFor(() =>
            expect(signUpEmailMock).toHaveBeenCalledWith(
                expect.objectContaining({ password: 'Abcdef1234-ghijklm!xy' })
            )
        );
    });
    it('rejects a password without an ASCII symbol before network', () => {
        render(<Harness />);
        submit('Abcdef1234 ñ');
        expect(signUpEmailMock).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(
            'La contraseña debe tener mayúsculas, minúsculas, un número y un carácter especial (por ejemplo ! @ # $ - _).'
        );
    });
});
