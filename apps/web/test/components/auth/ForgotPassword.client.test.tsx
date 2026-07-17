/**
 * @file ForgotPassword.client.test.tsx
 * @description Regression tests for the ForgotPassword island's HOS-190
 * slice 3 changes: a real email format guard (the form is `noValidate`, so
 * only presence — via `.trim()` — was ever checked), and fixing the trimmed
 * value being discarded (the untrimmed `email` state used to be sent to
 * `forgetPassword()` even though `trimmedEmail` was computed for the check).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPassword } from '../../../src/components/auth/ForgotPassword.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/auth/ForgotPassword.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    return { createTranslations: () => ({ t }) };
});

const forgetPasswordMock = vi.fn();
vi.mock('../../../src/lib/auth-client', () => ({
    forgetPassword: (...args: unknown[]) => forgetPasswordMock(...args)
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderIsland() {
    return render(
        <ForgotPassword
            locale="es"
            resetPasswordUrl="/es/auth/reset-password/"
            signInUrl="/es/auth/signin/"
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ForgotPassword email guard (HOS-190 slice 3)', () => {
    beforeEach(() => {
        forgetPasswordMock.mockReset();
        forgetPasswordMock.mockResolvedValue({ data: {} });
    });

    it('blocks submit when email is empty', () => {
        renderIsland();

        fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));

        expect(screen.getByRole('alert')).toHaveTextContent('Ingresá tu correo electrónico');
        expect(forgetPasswordMock).not.toHaveBeenCalled();
    });

    it('blocks submit when email is malformed', () => {
        renderIsland();

        fireEvent.change(screen.getByLabelText('Correo electrónico'), {
            target: { value: 'not-an-email' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Ingresá un correo electrónico válido.'
        );
        expect(forgetPasswordMock).not.toHaveBeenCalled();
    });

    it('sends the TRIMMED email (not the raw untrimmed state) to forgetPassword', async () => {
        renderIsland();

        fireEvent.change(screen.getByLabelText('Correo electrónico'), {
            target: { value: '  user@example.com  ' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));

        await waitFor(() => {
            expect(forgetPasswordMock).toHaveBeenCalledWith({
                email: 'user@example.com',
                redirectTo: '/es/auth/reset-password/'
            });
        });
    });

    it('shows the success state after a valid submission', async () => {
        renderIsland();

        fireEvent.change(screen.getByLabelText('Correo electrónico'), {
            target: { value: 'user@example.com' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));

        expect(await screen.findByText('Revisá tu email')).toBeInTheDocument();
    });
});
