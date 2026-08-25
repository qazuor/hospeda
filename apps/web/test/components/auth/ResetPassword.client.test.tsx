/**
 * @file ResetPassword.client.test.tsx
 * @description Regression tests for the ResetPassword island's HOS-190
 * slice 3 change: unifying the new-password check onto
 * `StrongPasswordSchema.safeParse` instead of a bare `password.length < 8`
 * check. This form previously enforced NO complexity rule at all (unlike its
 * SignUp/SetPassword siblings) and had no upper bound, so a >128-char string
 * would have been silently accepted and sent to the API.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPassword } from '../../../src/components/auth/ResetPassword.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/auth/ResetPassword.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    return { createTranslations: () => ({ t }) };
});

// HOS-796: `@repo/schemas` is deliberately NOT mocked. It used to be, with a
// whole-module mock that hand-reimplemented StrongPasswordSchema — so the
// bounds under test were a copy free to drift from the real ones. Worse, once
// this form started rendering the shared PasswordField (which imports
// `StrongPasswordRegex` from the same package), the whole-module mock left
// that import `undefined` and the suite blew up. Using the real package fixes
// both: nothing to keep in sync, and every export stays reachable.

const resetPasswordMock = vi.fn();
vi.mock('../../../src/lib/auth-client', () => ({
    resetPassword: (...args: unknown[]) => resetPasswordMock(...args)
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderIsland() {
    return render(
        <ResetPassword
            locale="es"
            token="reset-token-123"
            signInUrl="/es/auth/signin/"
        />
    );
}

const VALID_PASSWORD = 'Aa1!aaaa';

function submit(): void {
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ResetPassword password validation (HOS-190 slice 3)', () => {
    beforeEach(() => {
        resetPasswordMock.mockReset();
        resetPasswordMock.mockResolvedValue({ data: {} });
    });

    it('rejects a password with no complexity (previously accepted — now unified with siblings)', () => {
        renderIsland();

        fireEvent.change(screen.getByLabelText(/^Nueva contraseña/), {
            target: { value: 'alllowercase' }
        });
        fireEvent.change(screen.getByLabelText(/^Confirmar contraseña/), {
            target: { value: 'alllowercase' }
        });
        submit();

        expect(screen.getByRole('alert')).toHaveTextContent(
            'La contraseña debe tener mayúsculas, minúsculas, un número y un carácter especial (@$!%*?&).'
        );
        expect(resetPasswordMock).not.toHaveBeenCalled();
    });

    it('rejects a password longer than 128 characters', () => {
        renderIsland();

        const tooLong = `Aa1!${'a'.repeat(125)}`;
        fireEvent.change(screen.getByLabelText(/^Nueva contraseña/), {
            target: { value: tooLong }
        });
        fireEvent.change(screen.getByLabelText(/^Confirmar contraseña/), {
            target: { value: tooLong }
        });
        submit();

        expect(screen.getByRole('alert')).toHaveTextContent(
            'La contraseña no puede superar los 128 caracteres'
        );
        expect(resetPasswordMock).not.toHaveBeenCalled();
    });

    it('rejects a too-short password', () => {
        renderIsland();

        fireEvent.change(screen.getByLabelText(/^Nueva contraseña/), {
            target: { value: 'Aa1!' }
        });
        fireEvent.change(screen.getByLabelText(/^Confirmar contraseña/), {
            target: { value: 'Aa1!' }
        });
        submit();

        expect(screen.getByRole('alert')).toHaveTextContent(
            'La contraseña debe tener al menos 8 caracteres'
        );
        expect(resetPasswordMock).not.toHaveBeenCalled();
    });

    it('accepts a valid strong password and calls resetPassword', async () => {
        renderIsland();

        fireEvent.change(screen.getByLabelText(/^Nueva contraseña/), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.change(screen.getByLabelText(/^Confirmar contraseña/), {
            target: { value: VALID_PASSWORD }
        });
        submit();

        await waitFor(() => {
            expect(resetPasswordMock).toHaveBeenCalledWith({
                newPassword: VALID_PASSWORD,
                token: 'reset-token-123'
            });
        });
    });
});

describe('ResetPassword reveal controls (HOS-796)', () => {
    beforeEach(() => {
        resetPasswordMock.mockReset();
        resetPasswordMock.mockResolvedValue({ error: null });
    });

    it('offers a reveal control on both password fields', () => {
        renderIsland();

        expect(screen.getAllByRole('button', { name: 'Mostrar contraseña' })).toHaveLength(2);
    });

    it('reveals each field independently', () => {
        renderIsland();

        const newPassword = screen.getByLabelText(/^Nueva contraseña/);
        const confirmPassword = screen.getByLabelText(/^Confirmar contraseña/);
        const [newToggle] = screen.getAllByRole('button', { name: 'Mostrar contraseña' });

        fireEvent.click(newToggle as HTMLElement);

        expect(newPassword).toHaveAttribute('type', 'text');
        expect(confirmPassword).toHaveAttribute('type', 'password');
    });

    it('shows the rule checklist so a rejected password says which rule failed', () => {
        renderIsland();

        fireEvent.change(screen.getByLabelText(/^Nueva contraseña/), {
            target: { value: 'abc' }
        });

        // The checklist only renders once the user starts typing. Each item
        // prefixes the label with a status emoji, so match on a substring.
        expect(screen.getByText(/Al menos 8 caracteres/)).toBeInTheDocument();
        expect(screen.getByText(/Una letra mayúscula \(A-Z\)/)).toBeInTheDocument();
    });
});
