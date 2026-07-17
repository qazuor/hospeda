/**
 * @file SignUp.client.test.tsx
 * @description Regression tests for the SignUp island's HOS-190 slice 3
 * changes: a real email presence/format guard (the form is `noValidate`,
 * so the browser's native check never ran), and unifying the password check
 * onto `StrongPasswordSchema.safeParse` (adds the 128-char cap the old
 * `StrongPasswordRegex.test()` never enforced).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { SignUp } from '../../../src/components/auth/SignUp.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/auth/SignUp.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    return { createTranslations: () => ({ t }) };
});

vi.mock('@repo/schemas', () => ({
    // Mirrors StrongPasswordSchema's bounds (HOS-190 slice 3: min 8, max 128,
    // upper/lower/digit/special) without pulling in the full package.
    StrongPasswordSchema: z
        .string()
        .min(8)
        .max(128)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/)
}));

const signUpEmailMock = vi.fn();
vi.mock('../../../src/lib/auth-client', () => ({
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: (...args: unknown[]) => signUpEmailMock(...args) }
}));

vi.mock('../../../src/components/ui/PasswordField.client', () => ({
    // Wire onChange + error through — otherwise fireEvent.change never
    // reaches the parent's `setPassword`/`setConfirmPassword` state, and the
    // field error message (rendered internally by the real component) would
    // be invisible to the test.
    PasswordField: ({
        id,
        label,
        value,
        onChange,
        error
    }: {
        id: string;
        label: string;
        value: string;
        onChange: (value: string) => void;
        error?: string;
    }) => (
        <label htmlFor={id}>
            {label}
            <input
                id={id}
                type="password"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {error && <p role="alert">{error}</p>}
        </label>
    )
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderIsland() {
    return render(
        <SignUp
            locale="es"
            redirectTo="/es/auth/verify-email-sent/"
            showOAuth={false}
        />
    );
}

async function readyForm(): Promise<void> {
    await screen.findByLabelText('Correo electrónico');
}

const VALID_PASSWORD = 'Aa1!aaaa';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SignUp email + password guards (HOS-190 slice 3)', () => {
    beforeEach(() => {
        signUpEmailMock.mockReset();
        signUpEmailMock.mockResolvedValue({ error: null });
    });

    it('blocks submit when email is empty', async () => {
        renderIsland();
        await readyForm();

        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Ingresá tu correo electrónico.'
        );
        expect(signUpEmailMock).not.toHaveBeenCalled();
    });

    it('blocks submit when email is malformed', async () => {
        renderIsland();
        await readyForm();

        fireEvent.change(screen.getByLabelText('Correo electrónico'), {
            target: { value: 'not-an-email' }
        });
        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Ingresá un correo electrónico válido.'
        );
        expect(signUpEmailMock).not.toHaveBeenCalled();
    });

    it('rejects a password longer than 128 characters', async () => {
        renderIsland();
        await readyForm();

        fireEvent.change(screen.getByLabelText('Correo electrónico'), {
            target: { value: 'user@example.com' }
        });
        const tooLong = `Aa1!${'a'.repeat(125)}`;
        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: tooLong }
        });
        fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
            target: { value: tooLong }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        expect(
            await screen.findByText('La contraseña no puede superar los 128 caracteres.')
        ).toBeInTheDocument();
        expect(signUpEmailMock).not.toHaveBeenCalled();
    });

    it('trims the email and calls signUp.email for valid data', async () => {
        renderIsland();
        await readyForm();

        fireEvent.change(screen.getByLabelText('Correo electrónico'), {
            target: { value: '  user@example.com  ' }
        });
        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        await waitFor(() => {
            expect(signUpEmailMock).toHaveBeenCalledWith({
                email: 'user@example.com',
                password: VALID_PASSWORD,
                name: ''
            });
        });
    });
});
